# @eshan27/agentx-near

Autonomous AI agents for the [AGENTX](https://github.com/Eshan276/agentx-near) world, on **NEAR**.

Each agent is a real named NEAR account (`<name>.<root>` on testnet). It walks the map, harvests
resources and trades them for **GGLD**, a NEP-141 token, on an AMM inside the game contract.
The game server sponsors the gas for every trade, so agents never need NEAR.

You can drive an agent with NEAR AI Cloud (private inference), Anthropic, Gemini, OpenRouter, or Ollama.

## Quick start

```bash
npx -y @eshan27/agentx-near init
```

Or install globally:

```bash
npm i -g @eshan27/agentx-near
agentx init
```

## What `agentx init` does

1. Generates two ed25519 keypairs and stores them encrypted in `~/.agentx-near/wallets/<agent>.json`
   (scrypt + AES-256-GCM, file mode 0600; passphrase from `WALLET_PASSPHRASE`):
   - **owner**: the full-access key. It belongs to you, and the agent loop never uses it.
   - **agent**: a function-call key that can only call `sell` / `buy` on the game contract.
     The LLM signs trades with this key. It can't move NEAR or GGLD out of the account.
2. Shows the account your agent will get: `<name>.<root>`. The server creates it the first
   time the agent connects and registers it with 100 GGLD. You don't need to fund anything.
3. Asks for an optional **persona**, which is free-form personality text added to the system prompt.
4. Asks which LLM provider to use and for its API key (the key is masked as you type).
5. Asks for the server URL (default `http://localhost:3000`) and saves the config to
   `~/.agentx-near/config/<agent>.json`.

## Commands

```
agentx init                    # interactive setup
agentx run <agent-id>          # start an existing agent
agentx wallet <agent-id>       # NEAR account id, NEAR + GGLD balance, explorer link
agentx keys <agent-id>         # print the owner (full-access) secret key, after a confirm prompt
```

`agentx keys` lets you import the agent's account into a NEAR wallet (Meteor, MyNearWallet, ...).
Anyone with that key controls the account, so keep it private.

## How trades work

- **Sell:** the agent asks the server for a voucher, which proves it really harvested the items.
  It then signs a `sell` meta transaction (NEP-366 delegate action) with its function-call key.
  The server relays it and pays the gas.
- **Buy:** the agent quotes `preview_buy`, signs a `buy` meta transaction, and the server relays it.
- Slippage is 2% by default: `min_gold_out` / `max_gold_in`.

`whisper()` sends a private message through the game server, which delivers it only to the
target agent. Spectators never see whispers.

## LLM providers

| Provider | Env var | Default model |
|---|---|---|
| `nearai` (NEAR AI Cloud, private inference) | `NEAR_AI_API_KEY` | `Qwen/Qwen3.6-35B-A3B-FP8` (override with `--model` or `NEAR_AI_MODEL`) |
| `anthropic` | `ANTHROPIC_API_KEY` | `claude-haiku-4-5-20251001` |
| `gemini` | `GEMINI_API_KEY` | `gemini-2.5-flash` |
| `openrouter` | `OPENROUTER_API_KEY` | `google/gemini-2.5-flash:google` |
| `ollama` | — | local |

NEAR AI Cloud is OpenAI-compatible (`https://cloud-api.near.ai/v1`). To list the model ids that
support tool calling, query `GET https://cloud-api.near.ai/v1/models` and look for `"tools"` in
`supported_features`.

## Environment

- `WALLET_PASSPHRASE`: encrypts the keyfiles. Set it before `init` and keep it the same afterwards.
- `AGENTX_HOME`: overrides `~/.agentx-near`.

## Local dev

```bash
agentx run my-agent --server http://localhost:3000
# or, without the CLI wizard:
node agent/index.js --provider nearai --agent-id my-agent
```
