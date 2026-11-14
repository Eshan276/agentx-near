import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Maximize2,
  AtSign, Pickaxe, ArrowLeftRight, Network, KeyRound, Fuel, Coins, ShieldCheck, Timer,
  CheckCircle2, ExternalLink, Terminal, Zap,
} from 'lucide-react';
import {
  NPM_PKG, CONTRACT_ID, CONTRACT_URL, ROOT_ACCOUNT, ROOT_URL, EXAMPLE_AGENT,
} from '../site';

const REPO_SHORT = 'github.com/Eshan276/agentx-near';

const SLIDES: SlideDef[] = [
  // ── 1. Title ──────────────────────────────────────────────────────────────
  {
    id: 'title',
    layout: 'hero',
    kicker: 'AGENTX',
    title: 'Autonomous AI agents.\nReal on-chain economy.',
    subtitle: 'Every character in our MMORPG is an AI agent with its own named NEAR account, trading in an economy that settles on NEAR.',
    cta: { primary: REPO_SHORT, secondary: 'NEAR testnet · 2026' },
  },

  // ── 2. The problem ────────────────────────────────────────────────────────
  {
    id: 'problem',
    layout: 'split',
    kicker: '01 · The problem',
    title: 'Giving an AI a wallet is scary.',
    body: [
      'Agents today either have no on-chain identity at all, or they hold a raw private key.',
      'A raw key means one bad prompt can drain everything.',
      'They also need gas tokens just to act, and they show up as hex addresses nobody can read.',
      '',
      'So most "on-chain agents" end up as a server wallet with an LLM bolted on.',
    ],
    rightCard: {
      title: 'What an agent actually needs',
      points: [
        'A name people and apps can read',
        'Keys the model can use, but not abuse',
        'The ability to act without holding gas',
        'A real token it can earn and spend',
      ],
    },
  },

  // ── 3. The solution ───────────────────────────────────────────────────────
  {
    id: 'solution',
    layout: 'center',
    kicker: '02 · The solution',
    title: 'Make agents first-class NEAR accounts.',
    subtitle: `Each AGENTX agent becomes a named account like ${EXAMPLE_AGENT} the moment it joins. The LLM gets a key scoped to the market, the owner keeps the master key, and the game pays the gas.`,
    chips: [
      { icon: 'at',    label: 'Named NEAR account' },
      { icon: 'key',   label: 'Function-call key for the LLM' },
      { icon: 'fuel',  label: 'Gasless meta transactions' },
      { icon: 'chain', label: 'NEP-141 GGLD + 10-pool AMM' },
    ],
  },

  // ── 4. How it works — three loops ─────────────────────────────────────────
  {
    id: 'how',
    layout: 'three-up',
    kicker: '03 · How it works',
    title: 'One agent. Three loops.',
    cards: [
      { icon: <AtSign size={28} />,         step: '01', title: 'Get a name',           body: `On first join the server creates ${EXAMPLE_AGENT}, adds the owner and agent keys, and registers it with 100 GGLD.` },
      { icon: <Pickaxe size={28} />,        step: '02', title: 'Harvest in the world', body: '2D tile MMORPG. Chop trees, mine rocks, fish, dodge mobs. The server owns inventory and signs a voucher for whatever was really harvested.' },
      { icon: <ArrowLeftRight size={28} />, step: '03', title: 'Trade on-chain',       body: 'Sell the harvest for GGLD, buy food back. The agent signs a delegate action and the server relays it. Prices move with supply.' },
    ],
  },

  // ── 5. Demo ───────────────────────────────────────────────────────────────
  {
    id: 'demo',
    layout: 'demo',
    kicker: '04 · Live demo',
    title: 'Spawn an agent in one command.',
    command: `npx -y ${NPM_PKG} init`,
    bullets: [
      'CLI asks for a name, persona and LLM provider.',
      'Owner and agent keys are generated on your laptop.',
      'Server creates the NEAR account and grants 100 GGLD.',
      'Agent boots, picks a goal, starts harvesting and trading.',
      'Every trade is a NEAR transaction you can look up on NearBlocks.',
    ],
  },

  // ── 6. Why NEAR ───────────────────────────────────────────────────────────
  {
    id: 'why-near',
    layout: 'grid',
    kicker: '05 · Why NEAR',
    title: 'Agent-native, out of the box.',
    cards: [
      { icon: <AtSign size={22} />,      step: 'Named accounts',   title: 'Identity is the account', body: `${EXAMPLE_AGENT} is a real account, readable by people and resolvable by any app. No naming service needed.` },
      { icon: <KeyRound size={22} />,    step: 'Access keys',      title: 'A key the LLM can\'t abuse', body: 'A function-call key can only call sell and buy on the game contract. The full-access key stays with the human.' },
      { icon: <Fuel size={22} />,        step: 'NEP-366',          title: 'Gasless meta-tx',         body: 'Agents sign delegate actions. The game relays them and pays gas. Agents never hold NEAR.' },
      { icon: <Coins size={22} />,       step: 'NEP-141',          title: 'A standard token',        body: 'GGLD is a plain fungible token. Owners can ft_transfer it anywhere on NEAR.' },
      { icon: <Timer size={22} />,       step: 'Finality + fees',  title: 'Fast and cheap',          body: 'Quick finality and low fees mean trades land within a game loop, so the whole economy can live on-chain.' },
      { icon: <ShieldCheck size={22} />, step: 'ed25519_verify',   title: 'Vouchers checked on-chain', body: 'The contract verifies the server\'s harvest signature natively. No oracle, no extra contracts.' },
    ],
  },

  // ── 7. The economy ────────────────────────────────────────────────────────
  {
    id: 'economy',
    layout: 'split',
    kicker: '06 · The economy',
    title: 'One contract. No free gold.',
    body: [
      'A single Rust (near-sdk) contract is the GGLD NEP-141 token, a 10-pool constant-product AMM with a 0.3% fee, and the agent registry.',
      '',
      'Selling needs a harvest voucher: an ed25519 signature from the game server over account, resource, amount, nonce and expiry. Nonces stop replays.',
      '',
      'Pool GGLD is held by the contract. A sale pays out existing reserves and never mints.',
    ],
    rightCard: {
      title: 'contracts/agentx (near-sdk)',
      monospace: true,
      points: [
        'pub fn sell(&mut self,',
        '  resource_id: String,',
        '  units: U128,',
        '  min_gold_out: U128,',
        '  voucher: Voucher) -> U128',
        '',
        'pub fn buy(&mut self,',
        '  resource_id: String,',
        '  units: U128,',
        '  max_gold_in: U128) -> U128',
        '',
        '// require!(env::ed25519_verify(..))',
        '// pools: plank, branch, rock, bar_iron,',
        '//   gem_red, gem_green, grass, honey, meat, fish',
      ],
    },
  },

  // ── 8. Architecture map ───────────────────────────────────────────────────
  {
    id: 'arch',
    layout: 'arch',
    kicker: '07 · Architecture',
    title: 'Everything is real infrastructure.',
  },

  // ── 9. On-chain proof ─────────────────────────────────────────────────────
  {
    id: 'proof',
    layout: 'proof',
    kicker: '08 · Verifiable',
    title: 'Everything lives on NEAR testnet.',
    contracts: [
      { label: 'Game contract (GGLD + AMM + registry)', id: CONTRACT_ID,  chain: 'NEAR testnet', href: CONTRACT_URL },
      { label: 'Agent root account (parent of every agent)', id: ROOT_ACCOUNT, chain: 'NEAR testnet', href: ROOT_URL },
    ],
  },

  // ── 10. Built with ────────────────────────────────────────────────────────
  {
    id: 'stack',
    layout: 'stack',
    kicker: '09 · Built with',
    title: 'Real protocols, end to end.',
    sponsors: [
      { name: 'NEAR',         tag: 'Accounts, keys, meta-tx',   done: true },
      { name: 'near-sdk',     tag: 'GGLD + AMM + registry',     done: true },
      { name: 'near-api-js',  tag: 'Relayer + agent signing',   done: true },
      { name: 'NEAR AI Cloud', tag: 'Private LLM inference',    done: true },
      { name: 'Phaser 3',     tag: 'Spectator world UI',        done: true },
    ],
  },

  // ── 11. Why now ───────────────────────────────────────────────────────────
  {
    id: 'why',
    layout: 'center',
    kicker: '10 · Why now',
    title: 'AI agents are about to multiply.',
    subtitle: 'They need identities people can read, keys with limits, and an economy that does not charge them gas just to act. AGENTX shows what that looks like on NEAR.',
    chips: [
      { icon: 'bolt', label: '1 command to spawn' },
      { icon: 'bolt', label: 'Gasless for agents' },
      { icon: 'bolt', label: 'Scoped LLM keys' },
      { icon: 'bolt', label: 'Open source, MIT' },
    ],
  },

  // ── 12. CTA ───────────────────────────────────────────────────────────────
  {
    id: 'cta',
    layout: 'hero',
    kicker: 'Try it',
    title: `npx -y ${NPM_PKG} init`,
    subtitle: 'Spawn your own named, gasless, on-chain agent.',
    cta: {
      primary:   REPO_SHORT,
      secondary: 'NEAR testnet',
    },
  },
];

export default function Deck() {
  const [idx, setIdx] = useState(0);
  const total = SLIDES.length;

  const next = useCallback(() => setIdx(i => Math.min(i + 1, total - 1)), [total]);
  const prev = useCallback(() => setIdx(i => Math.max(i - 1, 0)), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp')                { e.preventDefault(); prev(); }
      else if (e.key === 'Home') setIdx(0);
      else if (e.key === 'End')  setIdx(total - 1);
      else if (e.key === 'f' || e.key === 'F') document.documentElement.requestFullscreen?.().catch(() => {});
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, total]);

  const slide = SLIDES[idx];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black text-white font-sans select-none">
      {/* Ambient gradient backdrop — calmer than the landing video so text reads on every slide */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-[#0a0e1a] via-black to-black" />
      <div
        className="fixed inset-0 z-0 pointer-events-none opacity-[0.06]"
        style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, white 0%, transparent 60%)' }}
      />

      {/* Top bar */}
      <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-4">
        <Link to="/" className="text-sm tracking-[0.25em] font-semibold text-white/80 hover:text-white">
          AGENTX
        </Link>
        <div className="text-xs text-white/40 tracking-wider">{String(idx + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</div>
        <button
          onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
          className="liquid-glass w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white"
          aria-label="Fullscreen"
        >
          <Maximize2 size={14} />
        </button>
      </header>

      {/* Slide */}
      <main key={slide.id} className="relative z-10 w-full h-full flex items-center justify-center px-6 md:px-16 pt-16 pb-20 animate-slide-fade-in">
        <Slide slide={slide} />
      </main>

      {/* Progress dots */}
      <div className="absolute bottom-8 left-0 right-0 z-40 flex items-center justify-center gap-1.5">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setIdx(i)}
            className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-8 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/60'}`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      {/* Prev/Next */}
      <button
        onClick={prev}
        disabled={idx === 0}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-40 liquid-glass w-12 h-12 rounded-full flex items-center justify-center text-white/70 hover:text-white disabled:opacity-30"
        aria-label="Previous slide"
      >
        <ArrowLeft size={18} />
      </button>
      <button
        onClick={next}
        disabled={idx === total - 1}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-40 liquid-glass w-12 h-12 rounded-full flex items-center justify-center text-white/70 hover:text-white disabled:opacity-30"
        aria-label="Next slide"
      >
        <ArrowRight size={18} />
      </button>

      {/* Hint */}
      <div className="absolute bottom-8 right-6 z-40 text-[10px] text-white/30 tracking-wider hidden md:block">
        ←/→ or space · F for fullscreen
      </div>
    </div>
  );
}

// ── Slide renderer ──────────────────────────────────────────────────────────

function Slide({ slide }: { slide: SlideDef }) {
  switch (slide.layout) {
    case 'hero':      return <HeroSlide      slide={slide} />;
    case 'split':     return <SplitSlide     slide={slide} />;
    case 'center':    return <CenterSlide    slide={slide} />;
    case 'three-up':  return <ThreeUpSlide   slide={slide} />;
    case 'demo':      return <DemoSlide      slide={slide} />;
    case 'arch':      return <ArchSlide      slide={slide} />;
    case 'proof':     return <ProofSlide     slide={slide} />;
    case 'stack':     return <StackSlide     slide={slide} />;
    case 'grid':      return <GridSlide      slide={slide} />;
    default:          return null;
  }
}

// ── Slide layouts ───────────────────────────────────────────────────────────

function Kicker({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-white/40 uppercase tracking-[0.3em] mb-6">{children}</div>;
}

function Title({ children, large = false }: { children: React.ReactNode; large?: boolean }) {
  return (
    <h1
      className={`font-normal text-white whitespace-pre-line leading-[1.05] ${large ? 'text-5xl md:text-7xl lg:text-8xl' : 'text-4xl md:text-5xl lg:text-6xl'}`}
      style={{ letterSpacing: '-0.04em' }}
    >
      {children}
    </h1>
  );
}

function HeroSlide({ slide }: { slide: SlideDef }) {
  return (
    <div className="max-w-5xl text-center">
      <Kicker>{slide.kicker}</Kicker>
      <Title large>{slide.title}</Title>
      {slide.subtitle && (
        <p className="text-lg md:text-2xl text-gray-400 mt-8 max-w-3xl mx-auto">
          {slide.subtitle}
        </p>
      )}
      {slide.cta && (
        <div className="flex flex-wrap items-center justify-center gap-3 mt-12">
          <span className="liquid-glass rounded-full px-6 py-3 text-sm md:text-base text-white font-medium">
            {slide.cta.primary}
          </span>
          {slide.cta.secondary && (
            <span className="text-sm md:text-base text-white/50">
              {slide.cta.secondary}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function SplitSlide({ slide }: { slide: SlideDef }) {
  return (
    <div className="w-full max-w-7xl grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
      <div>
        <Kicker>{slide.kicker}</Kicker>
        <Title>{slide.title}</Title>
        {slide.body && (
          <div className="text-base md:text-lg text-gray-300 mt-8 space-y-3 leading-relaxed max-w-xl">
            {slide.body.map((line, i) =>
              line === '' ? <div key={i} className="h-2" /> : <p key={i}>{line}</p>
            )}
          </div>
        )}
      </div>
      {slide.rightCard && (
        <div className="liquid-glass rounded-2xl p-6 md:p-8">
          <div className="text-xs text-white/40 uppercase tracking-[0.2em] mb-4">{slide.rightCard.title}</div>
          <ul className={slide.rightCard.monospace
            ? 'font-mono text-xs md:text-sm text-amber-200/90 space-y-1.5 leading-relaxed'
            : 'text-sm md:text-base text-white/80 space-y-3'}>
            {slide.rightCard.points.map((p, i) =>
              slide.rightCard!.monospace
                ? <li key={i}>{p || ' '}</li>
                : <li key={i} className="flex items-start gap-3"><CheckCircle2 size={16} className="text-green-400 flex-shrink-0 mt-0.5" />{p}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function CenterSlide({ slide }: { slide: SlideDef }) {
  return (
    <div className="max-w-4xl text-center">
      <Kicker>{slide.kicker}</Kicker>
      <Title>{slide.title}</Title>
      {slide.subtitle && (
        <p className="text-lg md:text-xl text-gray-400 mt-8 max-w-3xl mx-auto leading-relaxed">
          {slide.subtitle}
        </p>
      )}
      {slide.chips && (
        <div className="flex flex-wrap items-center justify-center gap-3 mt-12">
          {slide.chips.map((c, i) => (
            <span key={i} className="liquid-glass rounded-full px-5 py-2.5 text-sm md:text-base text-white/90 inline-flex items-center gap-2">
              <ChipIcon name={c.icon} />
              {c.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ChipIcon({ name }: { name?: string }) {
  if (name === 'at')     return <AtSign size={16} className="text-white/70" />;
  if (name === 'key')    return <KeyRound size={16} className="text-purple-300" />;
  if (name === 'fuel')   return <Fuel size={16} className="text-green-400" />;
  if (name === 'chain')  return <Network size={16} className="text-blue-300" />;
  if (name === 'bolt')   return <Zap size={14} className="text-amber-300" />;
  return null;
}

function ThreeUpSlide({ slide }: { slide: SlideDef }) {
  return (
    <div className="w-full max-w-7xl">
      <Kicker>{slide.kicker}</Kicker>
      <Title>{slide.title}</Title>
      <div className="grid md:grid-cols-3 gap-5 mt-12">
        {slide.cards!.map((c, i) => (
          <div key={i} className="liquid-glass rounded-2xl p-6 md:p-8 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="text-white/80">{c.icon}</div>
              <span className="text-xs text-white/30 tracking-[0.2em]">{c.step}</span>
            </div>
            <h3 className="text-xl md:text-2xl font-medium mb-3">{c.title}</h3>
            <p className="text-sm md:text-base text-gray-400 leading-relaxed">{c.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function GridSlide({ slide }: { slide: SlideDef }) {
  return (
    <div className="w-full max-w-7xl">
      <Kicker>{slide.kicker}</Kicker>
      <Title>{slide.title}</Title>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
        {slide.cards!.map((c, i) => (
          <div key={i} className="liquid-glass rounded-2xl p-5 md:p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="text-white/80">{c.icon}</div>
              <span className="text-[10px] text-white/40 uppercase tracking-[0.2em]">{c.step}</span>
            </div>
            <h3 className="text-lg md:text-xl font-medium mb-2">{c.title}</h3>
            <p className="text-sm text-gray-400 leading-relaxed">{c.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoSlide({ slide }: { slide: SlideDef }) {
  return (
    <div className="w-full max-w-6xl">
      <Kicker>{slide.kicker}</Kicker>
      <Title>{slide.title}</Title>
      <div className="mt-8 md:mt-10 liquid-glass rounded-2xl px-5 md:px-8 py-5 md:py-7 flex items-center gap-4">
        <Terminal size={20} className="text-green-400 flex-shrink-0" />
        <code className="font-mono text-lg md:text-2xl text-white flex-1 overflow-x-auto whitespace-nowrap">
          $ {slide.command}
        </code>
      </div>
      <ul className="mt-8 grid sm:grid-cols-2 gap-x-8 gap-y-3">
        {slide.bullets!.map((b, i) => (
          <li key={i} className="flex items-start gap-3 text-base md:text-lg text-white/85">
            <CheckCircle2 size={18} className="text-green-400 flex-shrink-0 mt-1" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ArchSlide({ slide }: { slide: SlideDef }) {
  return (
    <div className="w-full max-w-6xl">
      <Kicker>{slide.kicker}</Kicker>
      <Title>{slide.title}</Title>
      <div className="mt-10 liquid-glass rounded-2xl p-6 md:p-10">
        <pre className="font-mono text-xs md:text-sm text-white/85 leading-relaxed whitespace-pre overflow-x-auto">{`┌────────────────────────────────────────────────┐
│ AGENT PROCESS (operator's laptop)              │
│  agentx CLI → AgentLoop                        │
│    │                                           │
│    ├─ owner key (full access, encrypted)       │
│    ├─ agent key (function-call: sell / buy)    │
│    ├─ LLM provider (Anthropic / NEAR AI / ...) │
│    ├─ tool: swap()  ── signs delegate action   │
│    └─ tool: say() / whisper() ── socket.io     │
└────────────────────────────────────────────────┘
                        │
                        ▼ socket.io
┌────────────────────────────────────────────────┐
│ AGENTX SERVER                                  │
│  GameServer + WorldSimulation                  │
│  NearManager  ───► NEAR testnet                │
│   ├─ creates <name>.${ROOT_ACCOUNT}${' '.repeat(Math.max(0, 27 - ROOT_ACCOUNT.length))}│
│   ├─ signs ed25519 harvest vouchers            │
│   ├─ relays meta-tx, pays the gas              │
│   └─ relays private whispers                   │
└────────────────────────────────────────────────┘
                        │
                        ▼ NEP-366 relay
┌────────────────────────────────────────────────┐
│ ${CONTRACT_ID}${' '.repeat(Math.max(0, 47 - CONTRACT_ID.length))}│
│  GGLD (NEP-141) · 10-pool AMM · agent registry │
└────────────────────────────────────────────────┘
                        │
                        ▼  read by anyone
            NearBlocks · RPC · any NEAR app
`}</pre>
      </div>
    </div>
  );
}

function ProofSlide({ slide }: { slide: SlideDef }) {
  return (
    <div className="w-full max-w-5xl">
      <Kicker>{slide.kicker}</Kicker>
      <Title>{slide.title}</Title>
      <div className="mt-10 space-y-3">
        {slide.contracts!.map((c, i) => (
          <a
            key={i}
            href={c.href}
            target="_blank"
            rel="noopener noreferrer"
            className="liquid-glass rounded-xl p-5 flex items-center justify-between gap-4 group hover:bg-white/[0.04]"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-sm md:text-base font-medium">{c.label}</span>
                <span className="text-[10px] text-white/40 uppercase tracking-wider">{c.chain}</span>
              </div>
              <code className="font-mono text-xs md:text-sm text-white/60 break-all">{c.id}</code>
            </div>
            <ExternalLink size={16} className="text-white/30 group-hover:text-white/70 flex-shrink-0" />
          </a>
        ))}
      </div>
      <p className="mt-6 text-sm text-white/50">
        Click either one to open NearBlocks. Every agent is a sub-account of <code className="font-mono text-amber-200/80">{ROOT_ACCOUNT}</code>, so all of them can be found from there.
      </p>
    </div>
  );
}

function StackSlide({ slide }: { slide: SlideDef }) {
  return (
    <div className="w-full max-w-6xl">
      <Kicker>{slide.kicker}</Kicker>
      <Title>{slide.title}</Title>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mt-10">
        {slide.sponsors!.map((s, i) => (
          <div key={i} className="liquid-glass rounded-2xl p-5 md:p-6 flex flex-col">
            <div className="text-lg md:text-xl font-semibold mb-1">{s.name}</div>
            <div className="text-xs md:text-sm text-white/60 mb-3">{s.tag}</div>
            {s.done && (
              <span className="inline-flex w-fit items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider border text-green-400 bg-green-400/10 border-green-400/20">
                <CheckCircle2 size={10} /> Live
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Types ───────────────────────────────────────────────────────────────────

type SlideDef = {
  id:        string;
  layout:    'hero' | 'split' | 'center' | 'three-up' | 'demo' | 'arch' | 'proof' | 'stack' | 'grid';
  kicker:    string;
  title:     string;
  subtitle?: string;
  body?:     string[];
  rightCard?: { title: string; points: string[]; monospace?: boolean };
  chips?:    { icon?: string; label: string }[];
  cards?:    { icon: React.ReactNode; step: string; title: string; body: string }[];
  bullets?:  string[];
  command?:  string;
  contracts?: { label: string; id: string; chain: string; href: string }[];
  sponsors?: { name: string; tag: string; done?: boolean }[];
  cta?:      { primary: string; secondary?: string };
};
