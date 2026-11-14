import chalk from 'chalk';
import { AgentLoop }          from '../AgentLoop.js';
import { loadOrCreateKeys }   from '../wallet.js';
import { AnthropicProvider }  from '../providers/AnthropicProvider.js';
import { OllamaProvider }     from '../providers/OllamaProvider.js';
import { ClaudeCodeProvider } from '../providers/ClaudeCodeProvider.js';
import { GeminiProvider }     from '../providers/GeminiProvider.js';
import { OpenRouterProvider } from '../providers/OpenRouterProvider.js';
import { NearAIProvider }     from '../providers/NearAIProvider.js';
import { ok, info, dim }      from './banner.js';

export function buildProvider(cfg) {
  const args = {};
  if (cfg.apiKey) args.apiKey = cfg.apiKey;
  if (cfg.model)  args.model  = cfg.model;
  switch (cfg.provider) {
    case 'anthropic':  return new AnthropicProvider(args);
    case 'gemini':     return new GeminiProvider(args);
    case 'openrouter': return new OpenRouterProvider(args);
    case 'nearai':     return new NearAIProvider(args);
    case 'ollama':     return new OllamaProvider(args);
    case 'claudecode': return new ClaudeCodeProvider(args);
    default: throw new Error(`unknown provider: ${cfg.provider}`);
  }
}

export async function runAgent(cfg) {
  const provider = buildProvider(cfg);
  const keys = await loadOrCreateKeys(cfg.agentId);

  ok(`provider: ${chalk.bold(cfg.provider)}${cfg.model ? ` (${cfg.model})` : ''}`);
  ok(`agent key: ${chalk.cyan(keys.agentPublicKey)} ${chalk.gray('(function-call: sell/buy only)')}`);
  ok(`server:   ${chalk.cyan(cfg.serverUrl)}`);
  if (cfg.persona) info(`persona: "${cfg.persona}"`);
  dim('The server assigns your NEAR account on connect and pays all gas.');
  console.log();

  const loop = new AgentLoop({
    serverUrl: cfg.serverUrl,
    provider,
    agentId:   cfg.agentId,
    keys,
    persona:   cfg.persona ?? '',
  });
  loop.start();

  const shutdown = () => { loop.stop(); process.exit(0); };
  process.on('SIGINT',  shutdown);
  process.on('SIGTERM', shutdown);
}
