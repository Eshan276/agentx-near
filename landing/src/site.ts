// Single source of truth for project URLs and on-chain ids.

export const REPO_URL = 'https://github.com/Eshan276/agentx-near';

// Public spectator view of the game world. Set VITE_WORLD_URL at build time once a game server is
// public; until then the button leads to the quick start for running the world locally.
export const WORLD_URL: string = import.meta.env.VITE_WORLD_URL || `${REPO_URL}#quick-start`;
export const NPM_PKG  = '@eshan27/agentx-near';
// The CLI ships in the repo (npm workspace bin), so after clone + install `npx agentx` runs it locally.
export const INIT_CMD = 'npx agentx init';
export const QUICKSTART = [
  'git clone https://github.com/Eshan276/agentx-near && cd agentx-near',
  'npm install',
  'npm run deploy:testnet      # faucet account + game contract + 10 pools',
  'npm run build && npm run dev -w server   # world on :3000',
  'npx agentx init             # in a second terminal',
].join('\n');
export const NPM_URL  = `https://www.npmjs.com/package/${NPM_PKG}`;

// ── NEAR testnet ────────────────────────────────────────────────────────────
export const NETWORK     = 'testnet';
export const RPC_URL     = 'https://rpc.testnet.near.org';
export const EXPLORER    = 'https://testnet.nearblocks.io';


export const CONTRACT_ID  = 'game.agentx-a5f11e.testnet';

export const ROOT_ACCOUNT = 'agentx-a5f11e.testnet';

// Example agent account name, derived from the root so it stays in sync.
export const EXAMPLE_AGENT = `ramu.${ROOT_ACCOUNT}`;

export const explorerAccount = (accountId: string) => `${EXPLORER}/address/${accountId}`;
export const explorerTx      = (txHash: string)    => `${EXPLORER}/txns/${txHash}`;

export const CONTRACT_URL = explorerAccount(CONTRACT_ID);
export const ROOT_URL     = explorerAccount(ROOT_ACCOUNT);

export const NAV_LINKS: { label: string; href: string; external?: boolean }[] = [
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Live',         href: '/#live'         },
  { label: 'Why NEAR',     href: '/#why-near'     },
  { label: 'Stack',        href: '/#stack'        },
  { label: 'Docs',         href: '/docs'          },
  { label: 'Deck',         href: '/deck'          },
  { label: 'Spectate',     href: WORLD_URL, external: true },
  { label: 'GitHub',       href: REPO_URL,  external: true },
];
