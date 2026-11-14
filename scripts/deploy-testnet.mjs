#!/usr/bin/env node
/**
 * One-shot NEAR testnet deployment for AGENTX.
 *
 *   npm run build:contract && npm run deploy:testnet
 *
 * Root account (owner of the game contract, parent of every agent account, gas relayer):
 *   - AGENTX_ROOT_ACCOUNT_ID + AGENTX_ROOT_PRIVATE_KEY  → use that funded account, or
 *   - FUNDER_ACCOUNT_ID + FUNDER_PRIVATE_KEY            → create a fresh agentx-xxxx.testnet funded with ROOT_NEAR (default 4.5)
 *
 * Creates game.<root> (the Rust contract: GGLD token + AMM + agent registry), seeds the 10 pools
 * and writes server/.env. Re-running is safe: existing accounts/pools are kept.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(resolve(dirname(fileURLToPath(import.meta.url)), '../server/package.json'));
const { Account, JsonRpcProvider, KeyPair, actions, nearToYocto, teraToGas } = await import(require.resolve('near-api-js'));

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RPC = process.env.NEAR_RPC_URL ?? 'https://test.rpc.fastnear.com';
const provider = new JsonRpcProvider({ url: RPC });
const GOLD = 10n ** 18n;
const log = (...a) => console.log('›', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (accountId) => provider.viewAccount({ accountId }).then(() => true, () => false);

// Same starting liquidity as the original GameAMM seed (resource units, GGLD).
const POOLS = [
  ['plank', 1000, 200], ['branch', 1000, 100], ['rock', 1000, 100], ['bar_iron', 500, 300],
  ['gem_red', 200, 2400], ['gem_green', 200, 2000], ['grass', 1000, 100], ['honey', 500, 1000],
  ['meat', 500, 2000], ['fish', 500, 1500],
];

async function rootAccount() {
  const e = process.env;
  if (e.AGENTX_ROOT_ACCOUNT_ID && e.AGENTX_ROOT_PRIVATE_KEY) return { id: e.AGENTX_ROOT_ACCOUNT_ID, key: e.AGENTX_ROOT_PRIVATE_KEY };
  if (!e.FUNDER_ACCOUNT_ID || !e.FUNDER_PRIVATE_KEY) {
    throw new Error('Set AGENTX_ROOT_ACCOUNT_ID + AGENTX_ROOT_PRIVATE_KEY (a funded testnet account), or FUNDER_ACCOUNT_ID + FUNDER_PRIVATE_KEY to create one.');
  }
  const id = `agentx-${randomBytes(3).toString('hex')}.testnet`;
  const kp = KeyPair.fromRandom('ed25519');
  const funder = new Account(e.FUNDER_ACCOUNT_ID, provider, e.FUNDER_PRIVATE_KEY);
  const amount = e.ROOT_NEAR ?? '4.5';
  log(`creating ${id} with ${amount} NEAR from ${e.FUNDER_ACCOUNT_ID}`);
  await funder.callFunction({
    contractId: 'testnet',
    methodName: 'create_account',
    args: { new_account_id: id, new_public_key: kp.getPublicKey().toString() },
    deposit: nearToYocto(amount),
    gas: teraToGas(100),
  });
  for (let i = 0; i < 20 && !(await exists(id)); i++) await sleep(1500);
  return { id, key: kp.toString() };
}

async function main() {
  const wasmPath = resolve(repo, 'contracts/target/near/agentx/agentx.wasm');
  if (!existsSync(wasmPath)) throw new Error('Missing contract wasm — run `npm run build:contract` first.');

  const root = await rootAccount();
  const rootAcc = new Account(root.id, provider, root.key);
  const rootPk = KeyPair.fromString(root.key).getPublicKey();
  const state = await rootAcc.getState();
  log(`root ${root.id}: ${(Number(state.balance.available) / 1e24).toFixed(3)} NEAR available`);

  const envPath = resolve(repo, 'server/.env');
  const prev = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  const voucherKey = prev.match(/^AGENTX_VOUCHER_PRIVATE_KEY=(.+)$/m)?.[1] ?? KeyPair.fromRandom('ed25519').toString();
  const contractId = `game.${root.id}`;

  if (!(await exists(contractId))) {
    const wasm = new Uint8Array(readFileSync(wasmPath));
    const stake = Math.ceil(wasm.length / 100_000 * 10 + 3) / 10; // 1 NEAR per 100 kB, plus headroom for agent storage
    log(`creating ${contractId} (${(wasm.length / 1024).toFixed(0)} kB wasm, ${stake} NEAR)`);
    await rootAcc.createSubAccount({ accountOrPrefix: 'game', publicKey: rootPk, nearToTransfer: nearToYocto(String(stake)) });
    const game = new Account(contractId, provider, root.key);
    await game.signAndSendTransaction({
      receiverId: contractId,
      actions: [
        actions.deployContract(wasm),
        actions.functionCall('new', { owner_id: root.id, voucher_public_key: KeyPair.fromString(voucherKey).getPublicKey().toString() }, teraToGas(30), 0n),
      ],
    });
  } else {
    log(`${contractId} already exists — keeping it`);
  }

  const existing = new Set((await provider.callFunction({ contractId, method: 'get_pools', args: {} })).map((p) => p.resource_id));
  for (const [id, units, gold] of POOLS) {
    if (existing.has(id)) continue;
    await rootAcc.callFunction({
      contractId,
      methodName: 'seed_pool',
      args: { resource_id: id, resource_units: String(units), gold: String(BigInt(gold) * GOLD) },
      gas: teraToGas(30),
    });
    log(`pool ${id.padEnd(10)} ${units} units / ${gold} GGLD → ${(gold / units).toFixed(3)} GGLD each`);
  }

  writeFileSync(
    envPath,
    `# generated by scripts/deploy-testnet.mjs — ${new Date().toISOString()}
NEAR_NETWORK=testnet
NEAR_RPC_URL=${RPC}
AGENTX_ROOT_ACCOUNT_ID=${root.id}
AGENTX_ROOT_PRIVATE_KEY=${root.key}
AGENTX_CONTRACT_ID=${contractId}
AGENTX_VOUCHER_PRIVATE_KEY=${voucherKey}
AGENT_ACCOUNT_DEPOSIT=0.005
`,
    { mode: 0o600 },
  );
  log('wrote server/.env');
  const cfg = await provider.callFunction({ contractId, method: 'get_config', args: {} });
  console.log(`\n✅ AGENTX deployed on NEAR testnet
   contract  ${contractId}  (${cfg.pools} pools, ${cfg.agents} agents)
   root      ${root.id}
   explorer  https://testnet.nearblocks.io/address/${contractId}\n`);
}

main().catch((e) => {
  console.error('\n✖', e.message ?? e);
  process.exit(1);
});
