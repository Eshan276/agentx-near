// NEAR keys + gasless swaps for one agent.
//
// Every agent has TWO ed25519 keypairs, stored encrypted together in
// ~/.agentx-near/wallets/<agentId>.json:
//   - owner: FULL-ACCESS key on the agent's NEAR account. It belongs to the human;
//            the LLM loop never uses it. Export it with `agentx keys <name>`.
//   - agent: FUNCTION-CALL key the server adds, restricted to the game contract's
//            sell/buy methods. The LLM loop signs meta transactions with it; the
//            game server relays them and pays the gas.
import {
  Account,
  JsonRpcProvider,
  KeyPair,
  KeyPairSigner,
  actions,
  buildDelegateAction,
  encodeSignedDelegate,
  teraToGas,
} from 'near-api-js';
import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { WALLETS_DIR } from './paths.js';

const PASSPHRASE = process.env.WALLET_PASSPHRASE || 'agentx-near-default';
const GOLD_DECIMALS = 18n;
const GOLD = 10n ** GOLD_DECIMALS;
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const SWAP_GAS = teraToGas(50);

export function keyfilePath(agentId) {
  return join(WALLETS_DIR, `${agentId}.json`);
}

// ── Encryption (scrypt → aes-256-gcm) ─────────────────────────────────────────

function deriveKey(passphrase, salt, params = SCRYPT) {
  return scryptSync(passphrase, salt, 32, params);
}

function encryptSecrets(secrets, passphrase) {
  const salt = randomBytes(16);
  const iv   = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(secrets), 'utf8'), cipher.final()]);
  return {
    cipher: 'aes-256-gcm',
    kdf: 'scrypt',
    kdfparams: { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p },
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

function decryptSecrets(crypto, passphrase) {
  const { N, r, p } = crypto.kdfparams ?? SCRYPT;
  const key = deriveKey(passphrase, Buffer.from(crypto.salt, 'base64'), { N, r, p, maxmem: SCRYPT.maxmem });
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(crypto.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(crypto.tag, 'base64'));
  try {
    const plain = Buffer.concat([decipher.update(Buffer.from(crypto.ciphertext, 'base64')), decipher.final()]);
    return JSON.parse(plain.toString('utf8'));
  } catch {
    throw new Error('could not decrypt keyfile — wrong WALLET_PASSPHRASE?');
  }
}

// ── Keys ──────────────────────────────────────────────────────────────────────

/**
 * Load the agent's keypairs, creating and saving them on first use.
 * @returns {Promise<{ ownerKey: KeyPair, agentKey: KeyPair, ownerPublicKey: string, agentPublicKey: string, created: boolean }>}
 */
export async function loadOrCreateKeys(agentId) {
  mkdirSync(WALLETS_DIR, { recursive: true, mode: 0o700 });
  const file = keyfilePath(agentId);

  if (existsSync(file)) {
    const json = JSON.parse(readFileSync(file, 'utf-8'));
    if (!json.crypto || json.chain !== 'near') throw new Error(`${file} is not an agentx-near keyfile`);
    const secrets = decryptSecrets(json.crypto, PASSPHRASE);
    const ownerKey = KeyPair.fromString(secrets.owner);
    const agentKey = KeyPair.fromString(secrets.agent);
    return {
      ownerKey,
      agentKey,
      ownerPublicKey: ownerKey.getPublicKey().toString(),
      agentPublicKey: agentKey.getPublicKey().toString(),
      created: false,
    };
  }

  const ownerKey = KeyPair.fromRandom('ed25519');
  const agentKey = KeyPair.fromRandom('ed25519');
  const ownerPublicKey = ownerKey.getPublicKey().toString();
  const agentPublicKey = agentKey.getPublicKey().toString();
  const doc = {
    version: 1,
    chain: 'near',
    agentId,
    ownerPublicKey,
    agentPublicKey,
    createdAt: new Date().toISOString(),
    crypto: encryptSecrets({ owner: ownerKey.toString(), agent: agentKey.toString() }, PASSPHRASE),
  };
  writeFileSync(file, JSON.stringify(doc, null, 2), { encoding: 'utf-8', mode: 0o600 });
  chmodSync(file, 0o600);
  return { ownerKey, agentKey, ownerPublicKey, agentPublicKey, created: true };
}

// ── Chain reads ───────────────────────────────────────────────────────────────

/** GGLD base units (18 decimals) → float with 4 decimal places. */
export function goldToFloat(base) {
  return Number(BigInt(base ?? 0) * 10000n / GOLD) / 10000;
}

/** GGLD balance of `accountId` as a float. */
export async function viewGold(rpcUrl, contractId, accountId) {
  const provider = new JsonRpcProvider({ url: rpcUrl });
  const bal = await provider.callFunction({ contractId, method: 'ft_balance_of', args: { account_id: accountId } });
  return goldToFloat(bal ?? '0');
}

// ── Swaps (meta transactions relayed by the game server) ─────────────────────

// Last delegate nonce used per account+key. The access-key nonce is read at "final"
// finality, which can lag a just-relayed swap, so back-to-back swaps bump locally.
const lastNonce = new Map();

async function signSwapDelegate({ accountId, agentKey, rpcUrl, contractId, method, args }) {
  const keyPair = typeof agentKey === 'string' ? KeyPair.fromString(agentKey) : agentKey;
  const signer  = new KeyPairSigner(keyPair);
  const account = new Account(accountId, new JsonRpcProvider({ url: rpcUrl }), signer);
  const action  = actions.functionCall(method, args, SWAP_GAS, 0n);

  let delegate = await account.createMetaTransaction({
    receiverId: contractId,
    actions: [action],
    blockHeightTtl: 120,
    publicKey: keyPair.getPublicKey(),
  });
  const nonceKey = `${accountId}:${keyPair.getPublicKey().toString()}`;
  const prev = lastNonce.get(nonceKey);
  if (prev !== undefined && BigInt(delegate.nonce) <= prev) {
    delegate = buildDelegateAction({
      receiverId: contractId,
      senderId: accountId,
      actions: [action],
      publicKey: keyPair.getPublicKey(),
      nonce: prev + 1n,
      maxBlockHeight: BigInt(delegate.maxBlockHeight),
    });
  }
  lastNonce.set(nonceKey, BigInt(delegate.nonce));

  const { signedDelegate } = await signer.signDelegateAction(delegate);
  return Buffer.from(encodeSignedDelegate(signedDelegate)).toString('base64');
}

/**
 * Sell resources for GGLD or buy resources with GGLD on the game contract's AMM.
 *  sell: ask the server for a voucher (proof we hold the items) → sign `sell` → server relays.
 *  buy:  quote preview_buy → sign `buy` → server relays.
 * The agent never pays gas. `contract` is the observation's `contractAddresses`.
 * @returns {Promise<{ ok: boolean, txHash?: string, gold?: number, explorer?: string, error?: string }>}
 */
export async function executeSwap({ socket, accountId, agentKey, contract, direction, resourceId, units, slippagePct = 2 }) {
  if (!contract?.contractId || !contract?.rpcUrl) return { ok: false, error: 'NEAR contract info not available yet' };
  if (!accountId) return { ok: false, error: 'no NEAR account yet' };
  if (!agentKey) return { ok: false, error: 'agent key missing' };
  if (direction !== 'sell' && direction !== 'buy') return { ok: false, error: `direction must be "sell" or "buy"` };
  const n = Math.floor(Number(units));
  if (!(n > 0)) return { ok: false, error: 'units must be a positive whole number' };
  const slip = BigInt(Math.max(0, Math.min(50, Math.round(slippagePct))));
  const { contractId, rpcUrl } = contract;

  let args, quote;
  if (direction === 'sell') {
    let r;
    try {
      r = await socket.timeout(15000).emitWithAck('agent:sell_voucher', { resourceId, units: n });
    } catch (e) {
      return { ok: false, error: `server did not answer the sell voucher request (${e?.message ?? e})` };
    }
    if (!r?.ok) return { ok: false, error: r?.error ?? 'sell voucher refused' };
    quote = BigInt(r.quote);
    args = {
      resource_id: resourceId,
      units: String(n),
      min_gold_out: String(quote * (100n - slip) / 100n),
      voucher: r.voucher,
    };
  } else {
    const provider = new JsonRpcProvider({ url: rpcUrl });
    const [q, bal] = await Promise.all([
      provider.callFunction({ contractId, method: 'preview_buy', args: { resource_id: resourceId, units: String(n) } }),
      provider.callFunction({ contractId, method: 'ft_balance_of', args: { account_id: accountId } }).catch(() => null),
    ]);
    quote = BigInt(q ?? '0');
    if (quote === 0n) return { ok: false, error: `No AMM pool for ${resourceId}` };
    const maxIn = quote * (100n + slip) / 100n;
    if (bal !== null && BigInt(bal) < quote) {
      return { ok: false, error: `Not enough GGLD: have ${goldToFloat(bal)}, need ~${goldToFloat(quote)}` };
    }
    args = { resource_id: resourceId, units: String(n), max_gold_in: String(maxIn) };
  }

  let signedDelegate;
  try {
    signedDelegate = await signSwapDelegate({ accountId, agentKey, rpcUrl, contractId, method: direction, args });
  } catch (e) {
    return { ok: false, error: `could not sign meta transaction: ${e.message}` };
  }

  let res;
  try {
    res = await socket.timeout(60000).emitWithAck('agent:swap', { direction, resourceId, units: n, signedDelegate });
  } catch (e) {
    const timedOut = /timed out|timeout/i.test(String(e?.message ?? ''));
    return { ok: false, error: timedOut
      ? 'server did not confirm the swap in time — check your balance before retrying'
      : `swap relay failed: ${e?.message ?? e}` };
  }
  return {
    ok: Boolean(res?.ok),
    direction,
    resourceId,
    units: n,
    quoteGold: goldToFloat(quote),
    gold: res?.gold,
    txHash: res?.txHash,
    explorer: res?.explorer,
    ...(res?.ok ? {} : { error: res?.error ?? 'swap failed' }),
  };
}

/** First label of the agent's NEAR account id (mirrors server/src/NearManager.js accountLabel). */
export function accountLabel(agentId) {
  return String(agentId).toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^[-_]+|[-_]+$/g, '').slice(0, 32) || 'agent';
}
