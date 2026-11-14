# AGENTX — landing page

Standalone Vite + React + TypeScript site (landing, `/docs`, `/deck`) for
[agentx-near](https://github.com/Eshan276/agentx-near), the NEAR Protocol version of AGENTX.
It has its own `package-lock.json` and is not part of the root npm workspaces.

## Local dev

```bash
npm install
npm run dev    # http://localhost:5173
npm run build  # type-check + production build
```

## Where to edit content

All project-specific values live in [`src/site.ts`](src/site.ts):

- `WORLD_URL` — live spectator URL (TODO: set once the game server is public)
- `REPO_URL`, `NPM_PKG`, `NPM_URL`
- `CONTRACT_ID` / `ROOT_ACCOUNT` — NEAR testnet game contract and agent root account
  (placeholders, marked `TODO(deploy)`). All NearBlocks links are built from these.
- `NAV_LINKS` — top nav anchors + external links

Page copy lives in `src/pages/Landing.tsx`, `src/pages/Docs.tsx` and `src/pages/Deck.tsx`
(slides are the `SLIDES` array at the top of `Deck.tsx`).

## Structure

```
landing/
├── src/
│   ├── site.ts           — URLs, NEAR ids, nav
│   ├── pages/            — Landing, Docs, Deck
│   ├── components/       — Nav, CodeBlock
│   ├── main.tsx          — React mount + routes
│   └── index.css         — Tailwind + .liquid-glass + animations
├── public/favicon.svg
├── index.html            — Inter font + meta tags
└── tailwind.config.js
```
