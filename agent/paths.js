// Single source of truth for where the CLI persists user data.
//
// Keyfiles and configs live under ~/.agentx-near/ so they survive npm reinstalls
// and never end up inside the package directory (read-only when run via npx).
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const HOME = process.env.AGENTX_HOME || join(homedir(), '.agentx-near');

export const AGENTX_HOME = HOME;
export const WALLETS_DIR = join(HOME, 'wallets');
export const CONFIG_DIR  = join(HOME, 'config');

// Path to the agent package root (for bundled assets).
export const PACKAGE_ROOT = dirname(fileURLToPath(import.meta.url));
