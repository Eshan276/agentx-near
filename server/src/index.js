import { createServer }  from 'http';
import express           from 'express';
import { existsSync }    from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { GameServer }   from './GameServer.js';
import { logsHandler }  from './logsHandler.js';
import { near }         from './NearManager.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const PORT  = process.env.PORT || 3000;

// In production the Dockerfile copies the built client into server/public.
// For local dev, fall back to ../../client/dist (run after `npm run build -w client`).
const CLIENT_DIST_CANDIDATES = [
  join(__dir, '..', 'public'),
  join(__dir, '..', '..', 'client', 'dist'),
];
const CLIENT_DIST = CLIENT_DIST_CANDIDATES.find(existsSync);

const app = express();

// ── API ─────────────────────────────────────────────────────────────────────
app.get('/api/logs', (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  return logsHandler(req, res, url);
});

app.get('/api/prices', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.json({
    ready:     near.ready,
    prices:    near.ready ? near.getCachedPrices()       : {},
    history:   near.ready ? near.getPriceHistory()        : {},
    contracts: near.getContractAddresses(),
  });
});

// Which NEAR network/contract this server plays on — the CLI's `wallet` command reads it.
app.get('/api/near', (_req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.json({ ready: near.ready, ...(near.getContractAddresses() ?? {}) });
});

// Recent on-chain activity (account creations, sells, buys) with tx hashes.
app.get('/api/feed', (_req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.json({ feed: gameServer.chainFeed, chain: near.getContractAddresses() });
});

// ── Static client (production) ──────────────────────────────────────────────
if (CLIENT_DIST) {
  console.log(`[server] serving client from ${CLIENT_DIST}`);
  // Root and /world both go to the spectator world view
  app.get('/',                    (_req, res) => res.redirect('/world.html'));
  app.get(['/world', '/world/'],  (_req, res) => res.redirect('/world.html'));
  app.use(express.static(CLIENT_DIST));
  // Any unknown GET → world.html so deep links work
  app.get(/.*/, (_req, res) => res.sendFile(join(CLIENT_DIST, 'world.html')));
} else {
  console.log('[server] no client/dist found — running in API-only mode');
}

// ── HTTP + Socket.io ────────────────────────────────────────────────────────
const httpServer = createServer(app);

// Connect to NEAR (non-blocking — the world still runs without chain features if env vars are absent)
near.init().catch(e => console.error('[NEAR] init error:', e.message));

const gameServer = new GameServer(httpServer);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] running on http://0.0.0.0:${PORT}`);
});
