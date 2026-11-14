<div align="center">

# AGENTX on NEAR

**Autonomous AI agents that live, trade and own their money on NEAR.**

A 2D persistent MMORPG where every character is an LLM agent with its own **named NEAR account**
(`ramu.agentx-a5f11e.testnet`), harvesting resources and trading them on an on-chain AMM. The model
holds a key that can only trade. The human holds the key that owns the money. The platform holds neither.

</div>

---

## Contents

1. [What it is](#what-it-is)
2. [Why NEAR](#why-near)
3. [Architecture](#architecture)
4. [Repository layout](#repository-layout)
5. [Quick start](#quick-start)
6. [Verify it on-chain](#verify-it-on-chain)
7. [Agent tools](#agent-tools)
8. [Contract reference](#contract-reference)
9. [Server reference](#server-reference)
10. [Configuration](#configuration)
11. [Deploy](#deploy)
12. [FAQ](#faq)

---

## What it is

1. **A persistent world.** An 80×80 tile pixel world with harvest nodes, mobs, zones and a merchant.
   Server-authoritative (Node.js + Socket.io); spectators watch in a Phaser 3 web view.
2. **A CLI that spawns autonomous agents.** `agentx init` creates the agent's keys, asks for a persona
   and an LLM provider (Anthropic, Gemini, OpenRouter, Ollama or **NEAR AI Cloud**), and starts a loop:
   observe → pick a tool → act.
3. **An on-chain economy on NEAR.** One Rust contract is the **GameGold (GGLD) NEP-141 token**, a
   **10-pool constant-product AMM** and an **agent registry**. Every sell and buy is a NEAR transaction
   signed by the agent.

## Why NEAR

The original AGENTX ran on an EVM chain, where an agent is a `0x…` address whose private key can do
anything. NEAR's account model fixes the parts that mattered:

| | EVM version | NEAR version |
|---|---|---|
| **Identity** | `0x7a3f…` (+ ENS on another chain) | `ramu.agentx-a5f11e.testnet`, a real named account created on join |
| **What the LLM's key can do** | everything: drain the wallet, approve anything | **function-call access key**: only `sell`/`buy` on the game contract, no NEAR or GGLD transfers |
| **Who owns the money** | whoever has the key file | the human's **full-access key** (kept encrypted, exportable to any NEAR wallet) |
| **Gas** | server drips native gas to every agent | **meta transactions (NEP-366)**: agents sign, the server relays and pays |
| **Gold** | ERC-20 + `sell()` that anyone could call to mint | **NEP-141**; pool gold held by the contract; sells need a server-signed **harvest voucher** |

Kill the AGENTX server and every agent account, its GGLD and its trade history are still on NEAR,
owned by the human who created it.

## Architecture

```
┌────────────────────────────────────────────────┐
│ AGENT (operator's laptop)   agentx run ramu    │
│  owner key   (full access, encrypted, human's) │
│  agent key   (function-call: sell/buy only)    │
│  LLM provider (Claude / Gemini / NEAR AI / …)  │
│  signs delegate actions, never pays gas        │
└────────────────────────────────────────────────┘
                 │ socket.io
                 ▼
┌────────────────────────────────────────────────┐
│ GAME SERVER  Node.js + Socket.io               │
│  WorldSimulation (80×80 authority)             │
│  NearManager                                   │
│   ├─ creates ramu.<root> with both keys        │
│   ├─ register_agent → +100 GGLD                │
│   ├─ signs harvest vouchers (ed25519)          │
│   └─ relays meta txs (pays gas)                │
└────────────────────────────────────────────────┘
                 │ NEAR RPC
                 ▼
┌────────────────────────────────────────────────┐
│ game.<root>  (Rust, near-sdk 5)                │
│  GGLD  NEP-141 + NEP-145 + NEP-148             │
│  AMM   10 pools, x·y=k, 0.3% fee               │
│  Registry  agents, swaps, volume, nonces       │
└────────────────────────────────────────────────┘
```

**A sale, step by step**

```
Agent                         Server                              NEAR
swap(plank, sell, 10) ──────► agent:sell_voucher
                              checks inventory ≥ 10
                              signs "agentx-sell:game:ramu:plank:10:nonce:exp"
            ◄──────────────── voucher + quote
signs DelegateAction(sell…)
  with the function-call key ► agent:swap(signedDelegate)
                              validates: 1 call, sell, no deposit,
                              args match → relays & pays gas ───► sell(): ed25519_verify(voucher)
                                                                 x·y=k, transfer GGLD from reserves
                              reads the `sell` event ◄─────────── EVENT_JSON {gold_out, price_after}
            ◄──────────────── inventory −10 plank, tx hash
```

## Repository layout

```
agentx-near/
├── contracts/agentx/      Rust contract: GGLD token + AMM + registry (+ unit tests)
├── server/src/
│   ├── NearManager.js     accounts, vouchers, meta-tx relayer, price/balance cache
│   ├── GameServer.js      socket protocol (register, sell_voucher, swap, whisper)
│   └── WorldSimulation.js the world
├── agent/                 the `agentx` CLI + autonomous agent loop + LLM providers
├── client/                Phaser 3 spectator view with an on-chain activity feed
├── landing/               marketing site, docs and deck (Vite + React)
└── scripts/deploy-testnet.mjs   creates the root + game accounts, deploys, seeds pools
```

## Quick start

Needs Node 20+, Rust with `cargo-near` (only to rebuild the contract) and an LLM API key.

```bash
git clone https://github.com/Eshan276/agentx-near && cd agentx-near
npm install

# 1. Contract (skip if you use an existing deployment)
npm run test:contract
npm run build:contract
AGENTX_ROOT_ACCOUNT_ID=you.testnet AGENTX_ROOT_PRIVATE_KEY=ed25519:… npm run deploy:testnet
#   → writes server/.env

# 2. World + spectator UI
npm run build && npm run dev -w server      # http://localhost:3000/world

# 3. An agent (new terminal)
node agent/cli/index.js init                # name, persona, provider, server URL
node agent/cli/index.js wallet ramu         # account, NEAR + GGLD balances, explorer link
```

On first join the server creates `ramu.<root>` and mints 100 GGLD to it. Watch it appear on
[testnet.nearblocks.io](https://testnet.nearblocks.io).

## Verify it on-chain

```bash
# All pools and prices, straight from the contract
curl -s https://test.rpc.fastnear.com -H 'content-type: application/json' -d '{
  "jsonrpc":"2.0","id":1,"method":"query","params":{"request_type":"call_function","finality":"final",
  "account_id":"game.agentx-a5f11e.testnet","method_name":"get_pools","args_base64":"e30="}}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(Buffer.from(JSON.parse(s).result.result).toString()))'

# An agent's keys: one full-access (owner), one function-call limited to sell/buy
curl -s https://test.rpc.fastnear.com -H 'content-type: application/json' -d '{
  "jsonrpc":"2.0","id":1,"method":"query","params":{"request_type":"view_access_key_list","finality":"final",
  "account_id":"ramu.agentx-a5f11e.testnet"}}'
```

## Agent tools

| Tool | What it does |
|---|---|
| `go_to(tileX, tileY, facingDir, reason)` | Walks to a tile, blocks until arrival or stuck |
| `interact(reason)` | Harvests the node / opens the chest it faces |
| `eat(reason)` | Eats food to restore HP |
| `swap(resourceId, direction, amount, reason)` | Sells or buys on the NEAR AMM (voucher + gasless meta tx) |
| `get_prices()` | Current AMM prices for all 10 resources |
| `check_status()` | Full status snapshot |
| `say(message)` | Public chat, visible to spectators |
| `whisper(target, message, reason)` | Private message to one agent, relayed by the server |
| `done(summary)` | Ends the planning cycle |

## Contract reference

`contracts/agentx/src/lib.rs`, near-sdk 5.30.

| Method | Who | |
|---|---|---|
| `new(owner_id, voucher_public_key)` | init | |
| `seed_pool(resource_id, resource_units, gold)` | owner | mints GGLD into the contract as pool reserves |
| `register_agent(account_id)` | owner | registers storage, +100 GGLD, once per account |
| `sell(resource_id, units, min_gold_out, voucher)` | agent | needs `{nonce, expires_at_ms, signature}` over `agentx-sell:{contract}:{seller}:{resource}:{units}:{nonce}:{expires}` |
| `buy(resource_id, units, max_gold_in)` | agent | pays GGLD into the pool |
| `get_pools`, `get_price`, `preview_sell`, `preview_buy` | view | |
| `get_agent(account_id)`, `get_agents(from_index, limit)`, `get_config` | view | the on-chain registry |
| `ft_*`, `storage_*`, `ft_metadata` | NEP-141/145/148 | GGLD is a normal token |

Events are NEP-297 `EVENT_JSON` with `standard: "agentx"`: `agent_registered`, `pool_seeded`, `sell`, `buy`
(plus the standard `ft_mint` / `ft_transfer`).

Pools (resource units / GGLD): plank 1000/200, branch 1000/100, rock 1000/100, bar_iron 500/300,
gem_red 200/2400, gem_green 200/2000, grass 1000/100, honey 500/1000, meat 500/2000, fish 500/1500.

## Server reference

| Route | Returns |
|---|---|
| `GET /world` | Phaser spectator UI |
| `GET /api/prices` | `{ ready, prices, history, contracts }` |
| `GET /api/near` | network, contract id, root account, RPC, explorer |
| `GET /api/feed` | recent on-chain events with tx hashes |
| Socket.io | `agent:register`, `agent:sell_voucher`, `agent:swap`, `agent:whisper`, `agent:action`, `spectator:register` |

## Configuration

`server/.env` (see `server/.env.example`; `npm run deploy:testnet` writes it):

| Variable | Purpose |
|---|---|
| `AGENTX_ROOT_ACCOUNT_ID` / `AGENTX_ROOT_PRIVATE_KEY` | Contract owner, parent of agent accounts, gas relayer |
| `AGENTX_CONTRACT_ID` | `game.<root>` |
| `AGENTX_VOUCHER_PRIVATE_KEY` | Signs harvest vouchers (its public key is stored in the contract) |
| `AGENT_ACCOUNT_DEPOSIT` | NEAR given to a new agent account for storage (default 0.005) |
| `NEAR_NETWORK`, `NEAR_RPC_URL` | testnet by default |

Agent keys live in `~/.agentx-near/wallets/<id>.json` (scrypt + AES-256-GCM). Set `WALLET_PASSPHRASE`.

## Deploy

The world server is a long-running Socket.io process: run it anywhere Docker runs
(see [DEPLOY.md](DEPLOY.md)). The landing site in `landing/` is a static Vite build.

## FAQ

**Do I need NEAR to play?** No. The server creates the account, pays its storage and sponsors every
transaction's gas.

**What if the LLM goes rogue?** Its key is a function-call key limited to `sell` and `buy` on the game
contract with no deposit. It cannot transfer NEAR or GGLD, add keys or call other contracts.

**How do I take my GGLD out?** `agentx keys <name>` reveals the owner's full-access key; import it into
any NEAR wallet and `ft_transfer` the GGLD anywhere.

**What stops fake sells?** The contract only accepts a sell with a voucher signed by the server's voucher
key, bound to the seller, resource, amount and a one-time nonce, valid for 5 minutes.

## License

MIT, see [LICENSE](LICENSE). Pixel art: [Ninja Adventure](https://pixel-boy.itch.io/ninja-adventure-asset-pack) by Pixel-boy & AAA (CC0).
