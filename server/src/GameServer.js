import { Server }          from 'socket.io';
import { WorldSimulation } from './WorldSimulation.js';
import { logAction, flush } from './AxiomLogger.js';
import { near }             from './NearManager.js';

const RENDER_INTERVAL_MS = 200;
const CHAT_TTL_MS = 6000; // bubbles last 6 seconds
const FEED_MAX = 30;      // on-chain activity feed shown to spectators

export class GameServer {
  constructor(httpServer) {
    this.io   = new Server(httpServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });
    this._sim = new WorldSimulation();

    this._agents     = new Map();  // agentId → { socketId, target? }
    this._spectators = new Set();  // socketId[]
    this._chatMsgs   = new Map();  // agentId → { message, expiresAt }
    this._chainFeed  = [];         // [{ t, agentId, kind, text, txHash }]

    this.io.on('connection', socket => this._onConnect(socket));

    setInterval(() => this._broadcastWorldState(), RENDER_INTERVAL_MS);
    process.on('SIGTERM', () => flush().finally(() => process.exit(0)));
    process.on('SIGINT',  () => flush().finally(() => process.exit(0)));
    console.log('[GameServer] server-authoritative mode ready');
  }

  get chainFeed() { return this._chainFeed; }

  _pushFeed(entry) {
    this._chainFeed.unshift({ t: Date.now(), ...entry });
    if (this._chainFeed.length > FEED_MAX) this._chainFeed.pop();
  }

  _observationFor(agentId) {
    const obs = this._sim.buildObservation(agentId);
    if (!obs) return null;
    const now = Date.now();
    obs.agentChat = [...this._chatMsgs.entries()]
      .filter(([id, c]) => id !== agentId && now < c.expiresAt)
      .map(([id, c]) => ({ agentId: id, message: c.message }));
    return obs;
  }

  _pushObservation(socket, agentId) {
    const obs = this._observationFor(agentId);
    if (obs) socket.emit('server:observation', obs);
  }

  _onConnect(socket) {
    let role    = null;
    let agentId = null;

    socket.on('spectator:register', () => {
      role = 'spectator';
      this._spectators.add(socket.id);
      console.log(`[GameServer] spectator connected: ${socket.id}`);
      socket.emit('server:worldState', this._sim.buildRendererState());
    });

    socket.on('agent:register', ({ agentId: id, ownerPublicKey, agentPublicKey, persona }) => {
      role    = 'agent';
      agentId = id;
      this._agents.set(agentId, { socketId: socket.id });
      const accountId = near.ready && agentPublicKey ? near.accountIdFor(agentId) : null;
      this._sim.registerPlayer(agentId, accountId);

      const player = this._sim.getPlayer(agentId);
      if (player) player.persona = persona ?? '';

      // Create the agent's named NEAR account (first time) and register it in the game contract.
      if (accountId) {
        near.ensureAgentAccount({ agentId, ownerPublicKey, agentPublicKey })
          .then(({ created, txHash }) => {
            const p = this._sim.getPlayer(agentId);
            if (!p) return;
            p.nearReady = true;
            if (created) {
              p.pushEvent(`Your NEAR account ${accountId} is live with 100 GGLD`);
              this._pushFeed({ agentId, kind: 'account', text: `${accountId} joined the chain (+100 GGLD)`, txHash });
            }
            socket.emit('server:account', { ok: true, accountId, created, txHash, ...near.getContractAddresses() });
            this._pushObservation(socket, agentId);
          })
          .catch((e) => {
            console.error(`[NEAR] account setup failed for ${agentId}: ${e.message}`);
            socket.emit('server:account', { ok: false, accountId, error: e.message });
          });
      }
      this._pushObservation(socket, agentId);
    });

    // Step 1 of a sale: the server checks the agent really holds the items and signs a voucher.
    socket.on('agent:sell_voucher', async ({ resourceId, units } = {}, ack) => {
      if (typeof ack !== 'function') return;
      const player = agentId ? this._sim.getPlayer(agentId) : null;
      if (role !== 'agent' || !player) return ack({ ok: false, error: 'not registered' });
      if (!near.ready || !player.nearReady) return ack({ ok: false, error: 'NEAR account not ready yet — try again in a few seconds' });
      const n = Math.floor(Number(units));
      if (!(n > 0)) return ack({ ok: false, error: 'units must be a positive integer' });
      const have = player.countItem(resourceId);
      if (have < n) return ack({ ok: false, error: `You only have ${have} ${resourceId}` });
      try {
        const quote = await near.view('preview_sell', { resource_id: resourceId, units: String(n) });
        if (quote === '0') return ack({ ok: false, error: `No AMM pool for ${resourceId}` });
        ack({ ok: true, voucher: near.signSellVoucher(player.walletAddress, resourceId, n), quote });
      } catch (e) {
        ack({ ok: false, error: e.message });
      }
    });

    // Step 2: the agent's signed meta transaction. The server pays the gas, then applies the inventory change.
    socket.on('agent:swap', async ({ direction, resourceId, units, signedDelegate } = {}, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      const player = agentId ? this._sim.getPlayer(agentId) : null;
      if (role !== 'agent' || !player || !player.nearReady) return reply({ ok: false, error: 'NEAR account not ready' });
      const n = Math.floor(Number(units));
      if (direction === 'sell' && player.countItem(resourceId) < n) {
        return reply({ ok: false, error: `You no longer have ${n} ${resourceId}` });
      }
      try {
        const res = await near.relaySwap({ accountId: player.walletAddress, signedDelegate, direction, resourceId, units: n });
        const explorer = `${near.explorerUrl}/txns/${res.txHash}`;
        if (!res.ok) {
          player.pushEvent(`Swap failed on-chain: ${res.error}`);
          reply({ ...res, explorer });
          return this._pushObservation(socket, agentId);
        }
        const p = this._sim.getPlayer(agentId);
        if (p) {
          if (direction === 'sell') {
            p.removeItem(resourceId, n);
            p.pushEvent(`Sold ${n} ${resourceId} → ${res.gold.toFixed(2)} GGLD (NEAR tx ${res.txHash.slice(0, 8)}…)`);
          } else {
            p.addItem(resourceId, n);
            p.pushEvent(`Bought ${n} ${resourceId} for ${res.gold.toFixed(2)} GGLD (NEAR tx ${res.txHash.slice(0, 8)}…)`);
          }
          p.totalSwaps = (p.totalSwaps ?? 0) + 1;
        }
        this._pushFeed({
          agentId,
          kind: direction,
          text: `${agentId} ${direction === 'sell' ? 'sold' : 'bought'} ${n} ${resourceId} for ${res.gold.toFixed(2)} GGLD`,
          txHash: res.txHash,
        });
        console.log(`[NEAR] ${agentId} ${direction} ${n} ${resourceId} = ${res.gold} GGLD tx=${res.txHash}`);
        logAction(agentId, `swap:${direction}`, { events: `${n} ${resourceId} ↔ ${res.gold} GGLD tx=${res.txHash}` });
        reply({ ...res, explorer });
        this._pushObservation(socket, agentId);
      } catch (e) {
        console.warn(`[NEAR] relay failed for ${agentId}: ${e.message}`);
        reply({ ok: false, error: e.message });
      }
    });

    socket.on('agent:chat', ({ message }) => {
      if (role !== 'agent' || !agentId) return;
      const text = String(message ?? '').slice(0, 60);
      this._chatMsgs.set(agentId, { message: text, expiresAt: Date.now() + CHAT_TTL_MS });
      console.log(`[Chat] ${agentId}: "${text}"`);
      const p = this._sim.getPlayer(agentId);
      logAction(agentId, 'say', {
        tileX: p?.tileX, tileY: p?.tileY, hp: p?.hp, energy: p?.energy,
        gold: p?.gold, zone: p?.zone, events: `💬 "${text}"`,
      });
    });

    // Private message to one agent. Delivered only to that agent's socket, never to spectators.
    socket.on('agent:whisper', ({ target, message } = {}, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      if (role !== 'agent' || !agentId) return reply({ ok: false, error: 'not registered' });
      const to = [...this._agents.entries()].find(([id]) => id === target || near.ready && near.accountIdFor(id) === target);
      if (!to || to[0] === agentId) return reply({ ok: false, error: `unknown agent "${target}"` });
      const from = this._sim.getPlayer(agentId);
      this.io.to(to[1].socketId).emit('server:whisper', {
        from: agentId,
        fromAccount: from?.walletAddress ?? null,
        message: String(message ?? '').slice(0, 200),
      });
      reply({ ok: true, to: to[0] });
    });

    socket.on('agent:target', ({ tileX, tileY, reason }) => {
      if (role !== 'agent' || !agentId) return;
      this._agents.get(agentId).target = { tileX, tileY, reason };
    });

    socket.on('agent:action', ({ action }) => {
      if (role !== 'agent' || !agentId) return;
      this._sim.processAction(agentId, action);
      const obs = this._observationFor(agentId);
      if (obs) {
        socket.emit('server:observation', obs);
        const events = obs.recentEvents?.join(' | ') ?? '';
        const isMeaningful = action === 'interact' || action === 'eat' ||
          action.startsWith('buy:') || events.length > 0;
        if (isMeaningful) {
          logAction(agentId, action, {
            tileX:  obs.player.tileX,
            tileY:  obs.player.tileY,
            hp:     obs.player.hp,
            energy: obs.player.energy,
            gold:   obs.gold,
            zone:   obs.player.zone,
            events,
          });
        }
      }
    });

    socket.on('disconnect', () => {
      if (role === 'spectator') {
        this._spectators.delete(socket.id);
        console.log(`[GameServer] spectator disconnected: ${socket.id}`);
      } else if (role === 'agent' && agentId) {
        this._sim.removePlayer(agentId);
        this._agents.delete(agentId);
        console.log(`[GameServer] agent disconnected: ${agentId}`);
      }
    });
  }

  _broadcastWorldState() {
    if (this._spectators.size === 0) return;
    const state = this._sim.buildRendererState();

    state.agentTargets = [...this._agents.entries()]
      .filter(([, a]) => a.target)
      .map(([id, a]) => ({ agentId: id, ...a.target }));

    // Attach active chat messages, prune expired ones
    const now = Date.now();
    for (const [id, chat] of this._chatMsgs) {
      if (now >= chat.expiresAt) this._chatMsgs.delete(id);
    }
    state.chatMessages = [...this._chatMsgs.entries()]
      .map(([agentId, { message }]) => ({ agentId, message }));
    state.chainFeed = this._chainFeed.slice(0, 8);
    state.chain = near.getContractAddresses();

    for (const sid of this._spectators) {
      this.io.to(sid).emit('server:worldState', state);
    }
  }
}
