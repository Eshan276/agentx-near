#!/usr/bin/env node
import { program } from 'commander';
import chalk       from 'chalk';
import { input, password, select, confirm } from '@inquirer/prompts';
import { JsonRpcProvider, yoctoToNear } from 'near-api-js';

import { printBanner, section, ok, warn, info, err, dim } from './banner.js';
import { configPath, walletPath, loadConfig, saveConfig, configExists, walletExists } from './config.js';
import { loadOrCreateKeys, viewGold, accountLabel } from '../wallet.js';
import { runAgent }           from './run.js';
import { readFileSync }       from 'node:fs';

const PKG = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));

const DEFAULT_SERVER = 'http://localhost:3000';

const PROVIDERS = [
  { name: 'NEAR AI Cloud (private inference)', value: 'nearai'     },
  { name: 'Gemini (Google)',                   value: 'gemini'     },
  { name: 'Anthropic Claude',                  value: 'anthropic'  },
  { name: 'OpenRouter (multi-model)',          value: 'openrouter' },
  { name: 'Ollama (local)',                    value: 'ollama'     },
  { name: 'ClaudeCode (no API)',               value: 'claudecode' },
];

const PROVIDER_ENV = {
  nearai:     'NEAR_AI_API_KEY',
  gemini:     'GEMINI_API_KEY',
  anthropic:  'ANTHROPIC_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

/** GET <server>/api/near → { ready, network, contractId, rootAccountId, rpcUrl, explorerUrl } or null. */
async function fetchNearInfo(serverUrl) {
  try {
    const res = await fetch(`${serverUrl.replace(/\/+$/, '')}/api/near`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── init ──────────────────────────────────────────────────────────────────────

async function cmdInit(opts) {
  printBanner();
  section('Agent setup');

  const agentId = await input({
    message: 'Agent name (used as id and NEAR account name):',
    default: opts.agentId || 'agent-01',
    validate: v => (/^[a-z0-9]+([_-][a-z0-9]+)*$/i.test(v) && v.length <= 32)
      || 'letters and digits, optionally separated by single _ or - (max 32 chars)',
  });

  if (configExists(agentId) && !opts.force) {
    const overwrite = await confirm({
      message: `Config for "${agentId}" already exists at ${configPath(agentId)}. Overwrite?`,
      default: false,
    });
    if (!overwrite) {
      info('Aborted. Run with --force to overwrite, or pick a different agent id.');
      return;
    }
  }

  // ── Keys ──
  section('NEAR keys');
  const existed = walletExists(agentId);
  const keys = await loadOrCreateKeys(agentId);
  ok(`${existed ? 'Loaded existing' : 'Created new'} keys ${chalk.gray(`(${walletPath(agentId)}, encrypted)`)}`);
  console.log(chalk.bold('    owner (full access, yours): ') + chalk.cyan(keys.ownerPublicKey));
  console.log(chalk.bold('    agent (sell/buy only):      ') + chalk.cyan(keys.agentPublicKey));
  dim(`Your NEAR account will be ${chalk.bold(`${accountLabel(agentId)}.<root>`)} — the game server creates it`);
  dim('on first connect, registers it with 100 GGLD and pays all gas. No funding needed.');
  dim(`Export the owner key any time with: agentx keys ${agentId}`);

  // ── Persona ──
  section('Persona');
  dim('Optional flavor text injected into the agent\'s system prompt.');
  dim('Example: "You are a greedy merchant who hoards gold and trash-talks rivals."');
  const persona = await input({
    message: 'Persona (leave blank for default):',
    default: '',
  });

  // ── Provider ──
  section('LLM provider');
  const providerName = await select({
    message: 'Which LLM provider should drive this agent?',
    choices: PROVIDERS,
  });

  let apiKey, model;
  if (PROVIDER_ENV[providerName]) {
    const envKey = process.env[PROVIDER_ENV[providerName]];
    if (envKey) {
      const useEnv = await confirm({
        message: `Use ${PROVIDER_ENV[providerName]} from environment?`,
        default: true,
      });
      if (useEnv) apiKey = envKey;
    }
    if (!apiKey) {
      apiKey = await password({
        message: `Paste your ${providerName} API key:`,
        mask: '•',
        validate: v => v.length > 5 || 'API key looks too short',
      });
    }
  }
  if (providerName === 'nearai') dim('Model ids with tool support: GET https://cloud-api.near.ai/v1/models (look for "tools").');
  const customModel = await input({
    message: 'Custom model name (leave blank for provider default):',
    default: '',
  });
  if (customModel) model = customModel;

  // ── Server ──
  section('Game server');
  const serverUrl = await input({
    message: 'Server URL:',
    default: opts.server || DEFAULT_SERVER,
  });
  const nearInfo = await fetchNearInfo(serverUrl);
  if (nearInfo?.ready && nearInfo.rootAccountId) {
    ok(`Server is on NEAR ${nearInfo.network} — your account: ${chalk.bold(`${accountLabel(agentId)}.${nearInfo.rootAccountId}`)}`);
  } else {
    warn('Could not reach the server\'s NEAR info right now — the account id is assigned when the agent connects.');
  }

  // ── Save ──
  const cfg = {
    agentId,
    serverUrl,
    persona,
    provider:  providerName,
    apiKey:    apiKey   ?? null,
    model:     model    ?? null,
    createdAt: new Date().toISOString(),
  };
  saveConfig(agentId, cfg);
  ok(`Config saved to ${configPath(agentId)}`);

  console.log();
  const startNow = await confirm({ message: 'Run the agent now?', default: true });
  if (startNow) {
    console.log();
    await runAgent(cfg);
  } else {
    console.log();
    info(`Run later with: ${chalk.bold(`agentx run ${agentId}`)}`);
    dim('Tip: install globally for shorter commands: npm i -g @eshan27/agentx-near');
  }
}

// ── run ────────────────────────────────────────────────────────────────────────

async function cmdRun(agentId, opts) {
  printBanner();
  const cfg = loadConfig(agentId);
  if (!cfg) {
    err(`No config for "${agentId}". Run ${chalk.bold(`agentx init --agent-id ${agentId}`)} first.`);
    process.exit(1);
  }
  if (opts.server) cfg.serverUrl = opts.server;
  await runAgent(cfg);
}

// ── wallet ────────────────────────────────────────────────────────────────────

async function cmdWallet(agentId, opts) {
  printBanner();
  if (!walletExists(agentId)) {
    err(`No keys for "${agentId}". Run ${chalk.bold(`agentx init --agent-id ${agentId}`)} first.`);
    process.exit(1);
  }
  const keys = await loadOrCreateKeys(agentId);
  const serverUrl = opts.server || loadConfig(agentId)?.serverUrl || DEFAULT_SERVER;
  section(`Wallet: ${agentId}`);

  const nearInfo = await fetchNearInfo(serverUrl);
  if (!nearInfo?.ready || !nearInfo.rootAccountId) {
    err(`Could not get NEAR info from ${serverUrl}/api/near — is the server running with NEAR enabled?`);
    console.log(chalk.bold('  Agent key: ') + chalk.cyan(keys.agentPublicKey));
    dim(`keyfile: ${walletPath(agentId)}`);
    return;
  }
  const accountId = `${accountLabel(agentId)}.${nearInfo.rootAccountId}`;
  console.log(chalk.bold('  Account:  ') + chalk.cyan(accountId) + chalk.gray(` (${nearInfo.network})`));

  const provider = new JsonRpcProvider({ url: nearInfo.rpcUrl });
  try {
    const acc = await provider.viewAccount({ accountId });
    console.log(chalk.bold('  NEAR:     ') + chalk.cyan(yoctoToNear(acc.amount, 4)) + ' NEAR');
  } catch (e) {
    if (/does not exist|UNKNOWN_ACCOUNT/i.test(String(e?.message ?? e))) {
      warn('Account does not exist yet — it is created the first time the agent connects.');
    } else {
      err('Could not read NEAR balance: ' + e.message);
    }
  }
  try {
    const gold = await viewGold(nearInfo.rpcUrl, nearInfo.contractId, accountId);
    console.log(chalk.bold('  GGLD:     ') + chalk.yellow(gold) + ' GGLD');
  } catch (e) {
    err('Could not read GGLD balance: ' + e.message);
  }
  console.log(chalk.bold('  Owner key:') + ' ' + chalk.cyan(keys.ownerPublicKey) + chalk.gray(' (full access)'));
  console.log(chalk.bold('  Agent key:') + ' ' + chalk.cyan(keys.agentPublicKey) + chalk.gray(' (sell/buy only)'));
  dim(`keyfile:  ${walletPath(agentId)}`);
  dim(`explorer: ${nearInfo.explorerUrl}/address/${accountId}`);
}

// ── keys ──────────────────────────────────────────────────────────────────────

async function cmdKeys(agentId) {
  printBanner();
  if (!walletExists(agentId)) {
    err(`No keys for "${agentId}". Run ${chalk.bold(`agentx init --agent-id ${agentId}`)} first.`);
    process.exit(1);
  }
  section(`Owner key: ${agentId}`);
  warn(chalk.bold('This prints the FULL-ACCESS secret key of your agent\'s NEAR account.'));
  dim('Anyone with it controls the account: they can move its NEAR and GGLD, add or remove keys,');
  dim('or delete it. Only use it to import the account into a NEAR wallet you control.');
  dim('Do not paste it into chats, issues, or screenshots.');
  console.log();
  const sure = await confirm({ message: 'Show the owner secret key now?', default: false });
  if (!sure) {
    info('Cancelled — nothing printed.');
    return;
  }
  const { ownerKey, ownerPublicKey } = await loadOrCreateKeys(agentId);
  console.log();
  console.log(chalk.bold('  Public key: ') + chalk.cyan(ownerPublicKey));
  console.log(chalk.bold('  Secret key: ') + chalk.red(ownerKey.toString()));
  console.log();
  dim('Import it in a NEAR wallet (e.g. Meteor or MyNearWallet → "import with private key").');
}

// ── CLI wiring ────────────────────────────────────────────────────────────────

program
  .name('agentx')
  .description('AGENTX on NEAR — autonomous on-chain agent CLI')
  .version(PKG.version);

program
  .command('init')
  .description('Interactive setup: NEAR keys, persona, provider, server')
  .option('--agent-id <id>',  'Skip the agent name prompt')
  .option('--server <url>',   'Skip the server URL prompt')
  .option('--force',          'Overwrite existing config without asking')
  .action(cmdInit);

program
  .command('run <agent-id>')
  .description('Start an agent using its saved config')
  .option('--server <url>', 'Override saved server URL')
  .action(cmdRun);

program
  .command('wallet <agent-id>')
  .description('Show the NEAR account, NEAR + GGLD balances and explorer link')
  .option('--server <url>', 'Server to ask for NEAR network info (default: saved config)')
  .action(cmdWallet);

program
  .command('keys <agent-id>')
  .description('Print the owner (full-access) secret key after confirmation, to import into a NEAR wallet')
  .action(cmdKeys);

program.parseAsync(process.argv).catch(e => {
  // @inquirer throws when user hits Ctrl+C — exit cleanly
  if (e?.name === 'ExitPromptError') {
    console.log(chalk.gray('\n  cancelled'));
    process.exit(0);
  }
  console.error(chalk.red('\n  error: ') + (e.message ?? e));
  process.exit(1);
});
