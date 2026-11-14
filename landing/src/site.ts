// Single source of truth for project URLs and on-chain ids.

// TODO(deploy): replace with the public game server URL once it is live.
export const WORLD_URL = 'http://localhost:3000/world';

export const REPO_URL = 'https://github.com/Eshan276/agentx-near';
export const NPM_PKG  = '@eshan27/agentx-near';
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
