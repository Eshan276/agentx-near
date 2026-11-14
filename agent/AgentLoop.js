import { io }             from 'socket.io-client';
import { TOOLS, SYSTEM_PROMPT } from './tools.js';
import { buildObsPrompt } from './prompt.js';
import { executeSwap }    from './wallet.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Step one tile toward (toX,toY), respecting blocked directions.
function stepToward(fromX, fromY, toX, toY, blocked) {
  const dx = toX - fromX, dy = toY - fromY;
  if (dx === 0 && dy === 0) return null;
  const blockedSet = new Set(blocked ?? []);
  const candidates = [];
  if (Math.abs(dx) >= Math.abs(dy)) {
    candidates.push(dx > 0 ? 'right' : 'left');
    candidates.push(dy > 0 ? 'down'  : 'up');
    candidates.push(dy > 0 ? 'up'    : 'down');
    candidates.push(dx > 0 ? 'left'  : 'right');
  } else {
    candidates.push(dy > 0 ? 'down'  : 'up');
    candidates.push(dx > 0 ? 'right' : 'left');
    candidates.push(dx > 0 ? 'left'  : 'right');
    candidates.push(dy > 0 ? 'up'    : 'down');
  }
  for (const dir of candidates) {
    if (!blockedSet.has(dir)) return `move_${dir}`;
  }
  return 'wait';
}

function dirFromDelta(dx, dy) {
  if (dx === 1  && dy === 0) return 'right';
  if (dx === -1 && dy === 0) return 'left';
  if (dx === 0  && dy === 1) return 'down';
  if (dx === 0  && dy === -1) return 'up';
  return null;
}

export class AgentLoop {
  /**
   * @param {object} o
   * @param {string} o.serverUrl
   * @param {object} o.provider  LLM provider with completeWithTools()
   * @param {string} o.agentId
   * @param {{ ownerPublicKey: string, agentPublicKey: string, agentKey: import('near-api-js').KeyPair }} o.keys
   *        from wallet.loadOrCreateKeys(). Only public keys leave this process.
   * @param {string} [o.persona]
   */
  constructor({ serverUrl, provider, agentId, keys, persona }) {
    this._serverUrl = serverUrl;
    this._provider  = provider;
    this._agentId   = agentId;
    this._keys      = keys ?? null;
    this._persona   = persona ?? '';
    this._account   = null;   // server:account payload once the NEAR account is live
    this._inbox     = [];     // incoming whispers since the last session
    this._socket    = null;
    this._snapshot  = null;
    this._running   = false;
    // Resolves the pending _act() promise when a new observation arrives
    this._obsResolve = null;
  }

  _systemPrompt() {
    if (!this._persona) return SYSTEM_PROMPT;
    return `## Your personality\n${this._persona}\nStay in character at all times. Let your personality colour your say() messages and trade decisions.\n\n${SYSTEM_PROMPT}`;
  }

  start() {
    this._socket = io(this._serverUrl, { reconnectionAttempts: Infinity });

    this._socket.on('connect', () => {
      console.log(`[Agent:${this._agentId}] connected`);
      this._socket.emit('agent:register', {
        agentId:        this._agentId,
        ownerPublicKey: this._keys?.ownerPublicKey ?? null,
        agentPublicKey: this._keys?.agentPublicKey ?? null,
        persona:        this._persona ?? '',
      });
      if (!this._running) {
        this._running = true;
        this._loop();
      }
    });

    this._socket.on('server:account', acc => {
      if (!acc?.ok) {
        console.error(`[Agent:${this._agentId}] NEAR account setup failed${acc?.accountId ? ` for ${acc.accountId}` : ''}: ${acc?.error ?? 'unknown error'}`);
        return;
      }
      this._account = acc;
      const link = acc.explorerUrl ? `${acc.explorerUrl}/address/${acc.accountId}` : '';
      console.log(`[Agent:${this._agentId}] NEAR account ${acc.created ? 'created' : 'ready'}: ${acc.accountId} (${acc.network})${link ? ` — ${link}` : ''}`);
      if (acc.created && acc.txHash && acc.explorerUrl) console.log(`[Agent:${this._agentId}]   setup tx: ${acc.explorerUrl}/txns/${acc.txHash}`);
    });

    this._socket.on('server:whisper', w => {
      const text = String(w?.message ?? '').slice(0, 200);
      if (!text) return;
      this._inbox.push({ from: w.from ?? 'unknown', fromAccount: w.fromAccount ?? null, text });
      if (this._inbox.length > 20) this._inbox.shift();
      console.log(`[Agent:${this._agentId}] whisper from ${w.from}: "${text}"`);
    });

    this._socket.on('server:observation', snap => {
      this._snapshot = snap;
      if (this._obsResolve) {
        const resolve = this._obsResolve;
        this._obsResolve = null;
        resolve(snap);
      }
    });

    this._socket.on('disconnect', () => {
      console.log(`[Agent:${this._agentId}] disconnected`);
      this._running = false;
    });

    this._socket.on('connect_error', err => {
      console.error(`[Agent:${this._agentId}] connect error:`, err.message);
    });
  }

  stop() {
    this._running = false;
    this._socket?.disconnect();
  }

  // ── Main loop ────────────────────────────────────────────────────────────────

  async _loop() {
    while (this._running) {
      // Wait for first observation
      if (!this._snapshot) { await sleep(200); continue; }
      try {
        await this._runSession();
      } catch (err) {
        console.error(`[Agent:${this._agentId}] session error:`, err.message);
      }
      await sleep(500); // brief pause between sessions
    }
  }

  // ── Session: LLM calls tools until done() ───────────────────────────────────

  async _runSession() {
    const snap = this._snapshot;

    // Drain whispers received since the last session and attach them to the snapshot
    // so they show up in the observation prompt under "Whispers (private)".
    if (this._inbox.length) {
      snap.whispers = this._inbox.splice(0);
    }

    const { tileX, tileY, hp, energy, zone } = snap.player;
    console.log(`\n[Agent:${this._agentId}] ── new session ── pos=(${tileX},${tileY}) hp=${hp} en=${energy} GGLD=${snap.goldBalance ?? '?'} zone=${zone}`);

    const messages = [{ role: 'user', content: buildObsPrompt(snap) }];
    let toolCallCount = 0;

    while (this._running) {
      if (toolCallCount >= 60) {
        console.log(`[Agent:${this._agentId}] session limit reached, ending`);
        break;
      }

      const response = await this._provider.completeWithTools(this._systemPrompt(), messages, TOOLS);
      messages.push({ role: 'assistant', content: response.content });

      // Collect all tool calls from this response
      const toolUses = response.content.filter(b => b.type === 'tool_use');
      if (toolUses.length === 0) {
        console.log(`[Agent:${this._agentId}] no tool calls — ending session`);
        break;
      }

      // Execute each tool call and collect results
      const toolResults = [];
      let shouldEnd = false;

      for (const toolUse of toolUses) {
        toolCallCount++;
        console.log(`[Agent:${this._agentId}] tool: ${toolUse.name}(${JSON.stringify(toolUse.input)})`);

        const result = await this._executeTool(toolUse.name, toolUse.input);
        console.log(`[Agent:${this._agentId}] result: ${JSON.stringify(result)}`);

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          _toolName: toolUse.name,
          content: JSON.stringify(result),
        });

        if (toolUse.name === 'done') { shouldEnd = true; break; }
        if (!this._running) break;
      }

      messages.push({ role: 'user', content: toolResults });
      if (shouldEnd) break;
    }
  }

  // ── Tool execution ───────────────────────────────────────────────────────────

  async _executeTool(name, input) {
    switch (name) {
      case 'go_to':
        this._socket.emit('agent:target', {
          tileX:  input._nodeTileX ?? input.tileX,
          tileY:  input._nodeTileY ?? input.tileY,
          reason: input.reason ?? '',
        });
        return this._walkTo(input.tileX, input.tileY, input.facingDir);

      case 'interact': {
        const snap = await this._act('interact');
        const events = snap.recentEvents ?? [];
        const failed = events.some(e => e.includes('Not enough energy') || e.includes('Nothing to') || e.includes('Cannot'));
        return {
          ok: !failed,
          events,
          facing: snap.facing ?? null,
          hp: snap.player.hp,
          energy: snap.player.energy,
          gold: snap.gold,
          inventory: snap.inventory,
        };
      }

      case 'eat': {
        const snap = await this._act('eat');
        const events = snap.recentEvents ?? [];
        const failed = events.some(e => e.includes('Nothing to eat'));
        return {
          ok: !failed,
          events,
          hp: snap.player.hp,
          energy: snap.player.energy,
          inventory: snap.inventory,
        };
      }

      case 'buy': {
        const snap = await this._act(`buy:${input.itemId}`);
        const events = snap.recentEvents ?? [];
        const failed = events.some(e => e.includes('Not facing') || e.includes('Need') || e.includes('Cannot buy') || e.includes('full'));
        return {
          ok: !failed,
          events,
          gold: snap.gold,
          inventory: snap.inventory,
        };
      }

      case 'swap': {
        const snap = this._snapshot;
        const contract  = snap.contractAddresses;
        const accountId = snap.nearAccount ?? this._account?.accountId ?? null;
        if (!contract?.contractId || !this._keys?.agentKey) {
          return { ok: false, error: 'NEAR is not available on this server right now — keep harvesting and try later' };
        }
        if (!snap.nearAccountReady || !accountId) {
          return { ok: false, error: 'Your NEAR account is still being created — do something else (harvest, explore) and swap in a moment' };
        }
        const { resourceId, direction, amount } = input;

        // Guard: don't ask for a voucher for resources we don't have.
        if (direction === 'sell') {
          const have = (snap.inventory ?? []).find(s => s.id === resourceId)?.qty ?? 0;
          if (have < amount) {
            return { ok: false, error: `Inventory has only ${have} ${resourceId}, cannot sell ${amount}. Harvest more first.` };
          }
        }

        // The server pushes a fresh observation (new inventory) right after relaying the swap.
        const obsPromise = new Promise(r => { this._obsResolve = r; });

        let result;
        try {
          result = await executeSwap({
            socket:    this._socket,
            accountId,
            agentKey:  this._keys.agentKey,
            contract,
            direction,
            resourceId,
            units:     amount,
          });
        } catch (err) {
          this._obsResolve = null;
          return { ok: false, error: err.message };
        }

        if (result.ok) {
          await Promise.race([obsPromise, sleep(5000)]);
        }
        this._obsResolve = null;
        const fresh = this._snapshot;
        return { ...result, goldBalance: fresh?.goldBalance ?? null, inventory: fresh?.inventory };
      }

      case 'get_prices': {
        const snap = this._snapshot;
        return { prices: snap.ammPrices ?? {}, note: 'GGLD per 1 unit of resource' };
      }

      case 'check_status': {
        const snap = this._snapshot;
        return this._snapSummary(snap);
      }

      case 'say': {
        const msg = String(input.message ?? '').slice(0, 60);
        this._socket.emit('agent:chat', { agentId: this._agentId, message: msg });
        console.log(`[Agent:${this._agentId}] says: "${msg}"`);
        return { ok: true, said: msg };
      }

      case 'whisper': {
        const target = String(input.target ?? '').trim();
        const text   = String(input.message ?? '').slice(0, 200);
        if (!target || !text) return { ok: false, error: 'whisper needs a target and a message' };
        const others = this._snapshot?.otherAgents ?? [];
        try {
          const r = await this._socket.timeout(5000).emitWithAck('agent:whisper', { target, message: text });
          if (!r?.ok) {
            const visible = others.map(o => o.nearAccount ? `${o.agentId} (${o.nearAccount})` : o.agentId).join(', ') || 'none';
            return { ok: false, error: `${r?.error ?? 'whisper failed'} — visible agents: ${visible}` };
          }
          console.log(`[Agent:${this._agentId}] whisper → ${r.to}: "${text}"`);
          return { ok: true, sentTo: r.to };
        } catch {
          return { ok: false, error: 'server did not confirm the whisper' };
        }
      }

      case 'done':
        console.log(`[Agent:${this._agentId}] done: ${input.summary}`);
        return { ok: true };

      default:
        return { error: `unknown tool: ${name}` };
    }
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  async _walkTo(tileX, tileY, facingDir) {
    const posHistory = [];

    while (this._running) {
      const snap = this._snapshot;
      const { tileX: cx, tileY: cy } = snap.player;
      const dx = tileX - cx, dy = tileY - cy;
      const dist = Math.abs(dx) + Math.abs(dy);

      // Arrived
      if (dist === 0) {
        if (facingDir && snap.player.direction !== facingDir) {
          await this._act(`move_${facingDir}`);
        }
        const finalSnap = this._snapshot;
        console.log(`[Agent:${this._agentId}] arrived at (${finalSnap.player.tileX},${finalSnap.player.tileY}) facing=${JSON.stringify(finalSnap.facing)}`);
        return {
          arrived: true,
          tileX: finalSnap.player.tileX,
          tileY: finalSnap.player.tileY,
          facing: finalSnap.facing ?? null,
          nearbyNodes: finalSnap.nearbyNodes?.filter(n => !n.depleted) ?? [],
          hp: finalSnap.player.hp,
          zone: finalSnap.player.zone,
        };
      }

      // One tile away and it's a harvest/chest tile — face it and return
      // (but NOT if an NPC/player is blocking — let pathfinder route around them)
      if (dist === 1) {
        const dir = dirFromDelta(dx, dy);
        if (dir && snap.blockedDirections?.includes(dir)) {
          // Peek at what's facing to decide if this is the intended target
          await this._act(`move_${dir}`);
          const finalSnap = this._snapshot;
          const facingType = finalSnap.facing?.type;
          console.log(`[Agent:${this._agentId}] dist1-blocked at (${finalSnap.player.tileX},${finalSnap.player.tileY}) facing=${JSON.stringify(finalSnap.facing)}`);
          if (facingType === 'harvest' || facingType === 'chest') {
            return {
              arrived: true,
              tileX: finalSnap.player.tileX,
              tileY: finalSnap.player.tileY,
              facing: finalSnap.facing ?? null,
              nearbyNodes: finalSnap.nearbyNodes?.filter(n => !n.depleted) ?? [],
              hp: finalSnap.player.hp,
              zone: finalSnap.player.zone,
            };
          }
          // NPC or player blocking — don't return, let loop continue routing around
        }
      }

      // Stuck detection — track last 10 positions, detect no-progress
      const posKey = `${cx},${cy}`;
      posHistory.push(posKey);
      if (posHistory.length > 10) posHistory.shift();
      if (posHistory.length === 10) {
        const unique = new Set(posHistory);
        // Oscillating between ≤3 tiles for 10 steps = stuck
        if (unique.size <= 3) {
          return { arrived: false, stuck: true, tileX: cx, tileY: cy, reason: 'navigation blocked' };
        }
      }

      const action = stepToward(cx, cy, tileX, tileY, snap.blockedDirections);
      await this._act(action ?? 'wait');
    }

    return { arrived: false, reason: 'agent stopped' };
  }

  // ── Primitives ───────────────────────────────────────────────────────────────

  // Emit one action and wait for the server's next observation response.
  // The server has a 150ms rate limit — we wait at least 200ms before each action.
  _act(action) {
    return new Promise(resolve => {
      this._obsResolve = resolve;
      setTimeout(() => {
        this._socket.emit('agent:action', { action });
      }, 200);
    });
  }

  _snapSummary(snap) {
    return {
      hp:           snap.player.hp,
      maxHp:        snap.player.maxHp,
      energy:       snap.player.energy,
      maxEnergy:    snap.player.maxEnergy,
      gold:         snap.gold,
      goldBalance:  snap.goldBalance ?? null,
      ammPrices:    snap.ammPrices ?? {},
      zone:         snap.player.zone,
      position:     { tileX: snap.player.tileX, tileY: snap.player.tileY },
      facing:       snap.facing ?? null,
      inventory:    snap.inventory,
      nearbyNodes:  snap.nearbyNodes?.filter(n => !n.depleted) ?? [],
    };
  }
}
