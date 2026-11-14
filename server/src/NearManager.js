// Everything the game server does on NEAR:
//  - gives each agent a named account (ramu.<root>) with two keys: the human owner's full-access key
//    and the LLM's function-call key that can only call sell/buy on the game contract,
//  - registers it in the game contract (100 GGLD starting gold),
//  - signs sell vouchers (proof the agent harvested what it sells),
//  - relays the agents' meta transactions, so agents never need NEAR for gas,
//  - caches AMM prices and GGLD balances for observations.
import {
  Account,
  FailoverRpcProvider,
  JsonRpcProvider,
  KeyPair,
  PublicKey,
  SCHEMA,
  actions,
  baseEncode,
  nearToYocto,
  teraToGas,
} from 'near-api-js';
import { deserialize } from 'borsh';
import { createHash } from 'node:crypto';

const GOLD = 10n ** 18n;
const VOUCHER_TTL_MS = 5 * 60 * 1000;
const BALANCE_TTL_MS = 5000;
const SWAP_METHODS = ['sell', 'buy'];
const HISTORY_MAX = 240; // 240 × 15 s = one hour of price history

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Agent ids become the first label of a NEAR account id. */
export function accountLabel(agentId) {
  return String(agentId).toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^[-_]+|[-_]+$/g, '').slice(0, 32) || 'agent';
}

export function nearEvents(logs) {
  return logs
    .filter((l) => l.startsWith('EVENT_JSON:'))
    .map((l) => {
      try {
        const e = JSON.parse(l.slice('EVENT_JSON:'.length));
        return e.standard === 'agentx' ? { event: e.event, data: e.data?.[0] ?? {} } : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

class NearManager {
  constructor() {
    this._ready = false;
    this._priceCache = {};
    this._priceHistory = {};
    this._balances = new Map(); // accountId → { at, value: bigint, pending }
    this._lastNonce = new Map(); // accountId → last voucher nonce issued
    this._queue = Promise.resolve(); // root-account transactions, one at a time (nonces)
  }

  async init() {
    const env = process.env;
    this.network = env.NEAR_NETWORK || 'testnet';
    this.rootId = env.AGENTX_ROOT_ACCOUNT_ID;
    this.contractId = env.AGENTX_CONTRACT_ID || (this.rootId ? `game.${this.rootId}` : null);
    const rootKey = env.AGENTX_ROOT_PRIVATE_KEY;
    const voucherKey = env.AGENTX_VOUCHER_PRIVATE_KEY;
    if (!this.rootId || !rootKey || !voucherKey) {
      console.warn('[NEAR] AGENTX_ROOT_ACCOUNT_ID / AGENTX_ROOT_PRIVATE_KEY / AGENTX_VOUCHER_PRIVATE_KEY not set — chain features disabled. Run `npm run deploy:testnet`.');
      return;
    }
    const mainnet = this.network === 'mainnet';
    this.rpcUrl = env.NEAR_RPC_URL || (mainnet ? 'https://free.rpc.fastnear.com' : 'https://test.rpc.fastnear.com');
    this.explorerUrl = mainnet ? 'https://nearblocks.io' : 'https://testnet.nearblocks.io';
    const urls = [this.rpcUrl, ...(mainnet ? ['https://rpc.mainnet.near.org'] : ['https://near-testnet.drpc.org', 'https://rpc.testnet.near.org'])]
      .filter((u, i, a) => a.indexOf(u) === i);
    this.provider = new FailoverRpcProvider(urls.map((url) => new JsonRpcProvider({ url }, { retries: 2, backoff: 1.5, wait: 300 })));
    this.root = new Account(this.rootId, this.provider, rootKey);
    this.voucherKey = KeyPair.fromString(voucherKey);
    this.accountDeposit = nearToYocto(env.AGENT_ACCOUNT_DEPOSIT || '0.005');

    const cfg = await this.view('get_config');
    if (cfg.voucher_public_key !== this.voucherKey.getPublicKey().toString()) {
      console.warn('[NEAR] AGENTX_VOUCHER_PRIVATE_KEY does not match the contract voucher key — sells will fail');
    }
    console.log(`[NEAR] connected — ${this.network}, contract ${this.contractId}, root ${this.rootId}, ${cfg.agents} agents, ${cfg.pools} pools`);
    this._ready = true;
    this._refreshPrices();
    setInterval(() => this._refreshPrices(), 15_000);
  }

  get ready() {
    return this._ready;
  }

  accountIdFor(agentId) {
    return `${accountLabel(agentId)}.${this.rootId}`;
  }

  view(method, args = {}, contractId = this.contractId) {
    return this.provider.callFunction({ contractId, method, args });
  }

  // ── Agent accounts ────────────────────────────────────────────────────────

  /**
   * Make sure `<agent>.<root>` exists, belongs to whoever holds `agentPublicKey`, and is registered
   * in the game contract. Creates it on first sight. Returns { accountId, created, txHash }.
   */
  async ensureAgentAccount({ agentId, ownerPublicKey, agentPublicKey }) {
    if (!this._ready) throw new Error('NEAR disabled');
    const accountId = this.accountIdFor(agentId);
    const agentPk = PublicKey.fromString(agentPublicKey);
    let created = false;
    let txHash = null;

    const exists = await this.provider.viewAccount({ accountId }).then(() => true, () => false);
    if (exists) {
      const hasKey = await this.provider.viewAccessKey({ accountId, publicKey: agentPk.toString() }).then(() => true, () => false);
      if (!hasKey) throw new Error(`${accountId} is taken by someone else — pick another agent name`);
    } else {
      const ownerPk = PublicKey.fromString(ownerPublicKey || agentPublicKey);
      const acts = [
        actions.createAccount(),
        actions.transfer(this.accountDeposit),
        actions.addFullAccessKey(ownerPk),
      ];
      if (ownerPk.toString() !== agentPk.toString()) {
        // The LLM's key: can only call sell/buy on the game contract, can't move NEAR or GGLD.
        acts.push(actions.addFunctionCallAccessKey(agentPk, this.contractId, SWAP_METHODS, nearToYocto('0.002')));
      }
      const res = await this._send(accountId, acts);
      txHash = res.transaction.hash;
      created = true;
      console.log(`[NEAR] created ${accountId} tx=${txHash}`);
    }

    const registered = await this.view('get_agent', { account_id: accountId });
    if (!registered) {
      const res = await this._send(this.contractId, [actions.functionCall('register_agent', { account_id: accountId }, teraToGas(30), 0n)]);
      txHash = txHash ?? res.transaction.hash;
      console.log(`[NEAR] registered ${accountId} (+100 GGLD) tx=${res.transaction.hash}`);
    }
    this._balances.delete(accountId);
    return { accountId, created, txHash };
  }

  // ── Vouchers ──────────────────────────────────────────────────────────────

  signSellVoucher(accountId, resourceId, units) {
    const nonce = Math.max(Date.now(), (this._lastNonce.get(accountId) ?? 0) + 1);
    this._lastNonce.set(accountId, nonce);
    const expiresAt = Date.now() + VOUCHER_TTL_MS;
    const msg = `agentx-sell:${this.contractId}:${accountId}:${resourceId}:${units}:${nonce}:${expiresAt}`;
    const { signature } = this.voucherKey.sign(new TextEncoder().encode(msg));
    return { nonce, expires_at_ms: expiresAt, signature: Buffer.from(signature).toString('base64') };
  }

  // ── Meta transactions ─────────────────────────────────────────────────────

  /**
   * Relay an agent's signed sell/buy. Checks the delegate does exactly what the agent told the server
   * (one sell/buy on the game contract, no deposit) so the relayer can't be used for anything else.
   */
  async relaySwap({ accountId, signedDelegate, direction, resourceId, units }) {
    if (!this._ready) throw new Error('NEAR disabled');
    let sd;
    try {
      sd = deserialize(SCHEMA.SignedDelegate, Buffer.from(signedDelegate, 'base64'));
    } catch {
      throw new Error('signedDelegate is not a base64 borsh SignedDelegate');
    }
    const da = sd.delegateAction;
    if (da.senderId !== accountId) throw new Error(`delegate is from ${da.senderId}, not ${accountId}`);
    if (da.receiverId !== this.contractId) throw new Error(`relayer only sponsors calls to ${this.contractId}`);
    if (da.actions.length !== 1 || !da.actions[0].functionCall) throw new Error('exactly one function call expected');
    const fc = da.actions[0].functionCall;
    if (fc.methodName !== direction || !SWAP_METHODS.includes(direction)) throw new Error(`method must be ${direction}`);
    if (BigInt(fc.deposit) !== 0n) throw new Error('swaps carry no deposit');
    if (BigInt(fc.gas) > teraToGas(100)) throw new Error('too much gas');
    let args;
    try {
      args = JSON.parse(Buffer.from(fc.args).toString('utf8'));
    } catch {
      throw new Error('args are not JSON');
    }
    if (args.resource_id !== resourceId || String(args.units) !== String(units)) throw new Error('delegate args do not match the swap');

    const res = await this._send(accountId, [actions.signedDelegate(sd)]);
    const outcomes = res.receipts_outcome ?? [];
    const failure = outcomes.find((o) => o.outcome?.status?.Failure)?.outcome?.status?.Failure;
    const logs = outcomes.flatMap((o) => o.outcome?.logs ?? []);
    const ev = nearEvents(logs).find((e) => e.event === direction && e.data.account_id === accountId);
    this._balances.delete(accountId);
    if (failure || !ev) {
      const reason = failure ? JSON.stringify(failure).match(/Smart contract panicked: ([^"\\]+)/)?.[1] ?? 'transaction failed' : 'no swap event';
      return { ok: false, txHash: res.transaction.hash, error: reason };
    }
    const gold = Number(BigInt(ev.data.gold_out ?? ev.data.gold_in) * 10000n / GOLD) / 10000;
    this._applyPrice(resourceId, Number(BigInt(ev.data.price_after) * 10000n / GOLD) / 10000);
    return { ok: true, txHash: res.transaction.hash, gold, event: ev.data };
  }

  /** Root-account transactions go out one at a time so access-key nonces never collide. */
  _send(receiverId, acts) {
    const run = this._queue.then(() => this._signAndSend(receiverId, acts));
    this._queue = run.catch(() => {});
    return run;
  }

  async _signAndSend(receiverId, acts) {
    const signed = await this.root.createSignedTransaction({ receiverId, actions: acts });
    const hash = baseEncode(createHash('sha256').update(signed.transaction.encode()).digest());
    try {
      return await this.provider.sendTransactionUntil(signed, 'EXECUTED_OPTIMISTIC');
    } catch (e) {
      if (/NotEnoughBalance|LackBalanceForState/.test(`${e.name} ${e.message}`)) {
        throw new Error(`the AGENTX relayer (${this.rootId}) is out of NEAR — top it up`);
      }
      if (/InvalidTxError|InvalidSignature|InvalidAccessKey|Expired|InvalidNonce|DelegateAction/.test(`${e.name} ${e.message}`)) throw e;
      // The RPC may have errored after broadcasting: look the transaction up before calling it failed.
      for (let i = 0; i < 8; i++) {
        await sleep(1500 + i * 1000);
        const out = await this.provider
          .viewTransactionStatus({ txHash: hash, accountId: this.rootId, waitUntil: 'EXECUTED_OPTIMISTIC' })
          .catch(() => null);
        if (out?.transaction_outcome) return out;
      }
      throw e;
    }
  }

  // ── Balances & prices ─────────────────────────────────────────────────────

  /** Cached GGLD balance (bigint, base units); refreshes in the background at most every 5 s. */
  getGoldBalanceCached(accountId) {
    const hit = this._balances.get(accountId);
    if (!hit || (Date.now() - hit.at > BALANCE_TTL_MS && !hit.pending)) {
      const entry = hit ?? { at: 0, value: 0n };
      entry.pending = true;
      this._balances.set(accountId, entry);
      this.view('ft_balance_of', { account_id: accountId })
        .then((v) => Object.assign(entry, { value: BigInt(v), at: Date.now() }))
        .catch(() => {})
        .finally(() => { entry.pending = false; });
    }
    return hit?.value ?? 0n;
  }

  async getGoldBalance(accountId) {
    return BigInt(await this.view('ft_balance_of', { account_id: accountId }).catch(() => '0'));
  }

  /** Sell quote (GGLD base units, string) from the cached reserves: same x·y=k + 0.3% fee as the contract. */
  quoteSellLocal(resourceId, units) {
    const pool = this._pools?.[resourceId];
    if (!pool) return '0';
    const inWithFee = BigInt(units) * 997n;
    return ((inWithFee * BigInt(pool.reserve_gold)) / (BigInt(pool.reserve_resource) * 1000n + inWithFee)).toString();
  }

  /** Contract quote when the RPC answers quickly, otherwise the local one (the agent applies 2% slippage). */
  async quoteSell(resourceId, units) {
    const timeout = new Promise((r) => setTimeout(() => r(null), 4000));
    const live = await Promise.race([this.view('preview_sell', { resource_id: resourceId, units: String(units) }).catch(() => null), timeout]);
    return live ?? this.quoteSellLocal(resourceId, units);
  }

  _applyPrice(id, p) {
    this._priceCache[id] = p;
    const arr = (this._priceHistory[id] ??= []);
    arr.push({ t: Date.now(), p });
    if (arr.length > HISTORY_MAX) arr.shift();
  }

  async _refreshPrices() {
    try {
      const pools = await this.view('get_pools');
      this._pools = Object.fromEntries(pools.map((p) => [p.resource_id, p]));
      for (const pool of pools) this._applyPrice(pool.resource_id, Number(BigInt(pool.price) * 10000n / GOLD) / 10000);
    } catch { /* keep the previous cache */ }
  }

  getCachedPrices() {
    return { ...this._priceCache };
  }

  getPriceHistory() {
    return this._priceHistory;
  }

  getContractAddresses() {
    if (!this._ready) return null;
    return {
      chain: 'near',
      network: this.network,
      contractId: this.contractId,
      rootAccountId: this.rootId,
      rpcUrl: this.rpcUrl,
      explorerUrl: this.explorerUrl,
    };
  }
}

export const near = new NearManager();
