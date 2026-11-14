import { useEffect, useState, useCallback, createContext, useContext } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Maximize2,
  AtSign, Pickaxe, ArrowLeftRight, Network, KeyRound, Fuel, Coins, ShieldCheck, Timer,
  Check, ExternalLink, Terminal, Zap,
} from 'lucide-react';
import { Eyebrow, Wordmark, LiveDot, Arrow } from '../components/landing/ui';
import {
  INIT_CMD, CONTRACT_ID, CONTRACT_URL, ROOT_ACCOUNT, ROOT_URL, EXAMPLE_AGENT,
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
    command: INIT_CMD,
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
    title: INIT_CMD,
    subtitle: 'Spawn your own named, gasless, on-chain agent.',
    cta: {
      primary:   REPO_SHORT,
      secondary: 'NEAR testnet',
    },
  },
];

// Slides that flip to the dark "night" surface for contrast (code + architecture).
const DARK_SLIDES = new Set(['economy', 'arch']);

const Dark = createContext(false);
/** Token set for the current slide surface. */
function useTone() {
  const dark = useContext(Dark);
  return dark
    ? {
        dark,
        text:   'text-night-text',
        soft:   'text-night-soft',
        faint:  'text-night-soft/70',
        border: 'border-night-line',
        card:   'border border-night-line bg-night-2/70',
        panel:  'border border-night-line bg-night-2',
        hover:  'hover:bg-night-2',
      }
    : {
        dark,
        text:   'text-ink',
        soft:   'text-ink-soft',
        faint:  'text-ink-faint',
        border: 'border-line',
        card:   'border border-line bg-paper',
        panel:  'border border-line bg-paper-2',
        hover:  'hover:bg-paper-2',
      };
}

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
  const dark  = DARK_SLIDES.has(slide.id);

  const chrome = dark
    ? 'border-night-line bg-night-2/80 text-night-text hover:bg-night-2'
    : 'border-line-strong bg-paper/80 text-ink-2 hover:bg-paper-2';

  return (
    <Dark.Provider value={dark}>
      <style>{`@keyframes deckIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}`}</style>
      <div
        className={`relative w-screen h-screen overflow-hidden font-sans select-none transition-colors duration-500 ${
          dark ? 'bg-night text-night-text hatch-dark' : 'bg-paper text-ink grid-bg'
        }`}
      >
        {/* Top bar */}
        <header className={`absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 h-16 border-b ${dark ? 'border-night-line' : 'border-line'}`}>
          <Link to="/" className={`transition-opacity hover:opacity-70 ${dark ? '[&_span.font-mono]:text-night-soft' : ''}`}>
            <Wordmark />
          </Link>
          <div className={`font-mono text-[13px] tabular-nums ${dark ? 'text-night-soft' : 'text-ink-soft'}`} aria-live="polite">
            <span className={dark ? 'text-night-text' : 'text-ink'}>{String(idx + 1).padStart(2, '0')}</span>
            {' / '}
            {String(total).padStart(2, '0')}
          </div>
          <button
            onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
            className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${chrome}`}
            aria-label="Fullscreen"
          >
            <Maximize2 size={14} />
          </button>
        </header>

        {/* Slide */}
        <main
          key={slide.id}
          className="relative z-10 w-full h-full flex px-8 md:px-24 pt-24 pb-24 overflow-y-auto animate-[deckIn_.55s_cubic-bezier(.2,.7,.2,1)_both] motion-reduce:animate-none"
        >
          {/* m-auto centres the slide but still lets tall slides scroll from the top */}
          <div className="m-auto w-full flex justify-center">
            <Slide slide={slide} />
          </div>
        </main>

        {/* Progress */}
        <div className="absolute bottom-8 left-0 right-0 z-40 flex items-center justify-center gap-1">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setIdx(i)}
              className="group py-2 px-0.5"
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === idx ? 'step' : undefined}
            >
              <span
                className={`block h-[2px] transition-all duration-300 ${
                  i === idx
                    ? `w-8 ${dark ? 'bg-night-text' : 'bg-ink'}`
                    : `w-4 ${dark ? 'bg-night-line group-hover:bg-night-soft' : 'bg-line-strong group-hover:bg-ink-faint'}`
                }`}
              />
            </button>
          ))}
        </div>

        {/* Prev/Next */}
        <button
          onClick={prev}
          disabled={idx === 0}
          className={`absolute left-4 md:left-6 top-1/2 -translate-y-1/2 z-40 w-11 h-11 rounded-full border flex items-center justify-center transition-colors disabled:opacity-30 disabled:pointer-events-none ${chrome}`}
          aria-label="Previous slide"
        >
          <ArrowLeft size={16} />
        </button>
        <button
          onClick={next}
          disabled={idx === total - 1}
          className={`absolute right-4 md:right-6 top-1/2 -translate-y-1/2 z-40 w-11 h-11 rounded-full border flex items-center justify-center transition-colors disabled:opacity-30 disabled:pointer-events-none ${chrome}`}
          aria-label="Next slide"
        >
          <ArrowRight size={16} />
        </button>

        {/* Hint */}
        <div className={`absolute bottom-8 right-6 md:right-12 z-40 font-mono text-[11px] hidden md:block ${dark ? 'text-night-soft' : 'text-ink-faint'}`}>
          ←/→ or space · F for fullscreen
        </div>
      </div>
    </Dark.Provider>
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

function Kicker({ children, center = false }: { children: React.ReactNode; center?: boolean }) {
  const { dark } = useTone();
  return (
    <div className={`mb-8 ${center ? 'flex justify-center' : ''}`}>
      <Eyebrow dark={dark} center={center}>{children}</Eyebrow>
    </div>
  );
}

/** Two-tone split: explicit newline, else first sentence / rest ("One agent." / "Three loops."). */
function splitTitle(title: string): [string, string?] {
  if (title.includes('\n')) {
    const [a, ...rest] = title.split('\n');
    return [a, rest.join(' ')];
  }
  const m = title.match(/^(.+?\.)\s+(.+)$/);
  return m ? [m[1], m[2]] : [title];
}

function Title({ children, large = false }: { children: string; large?: boolean }) {
  const { soft } = useTone();
  const [first, second] = splitTitle(children);
  return (
    <h1
      className={`font-normal tracking-display ${
        large ? 'leading-[0.94] text-[52px] md:text-[88px] lg:text-[112px]' : 'leading-[1] text-[40px] md:text-[60px] lg:text-[72px]'
      }`}
    >
      <span className="block">{first}</span>
      {second && <span className={`block ${soft}`}>{second}</span>}
    </h1>
  );
}

function HeroSlide({ slide }: { slide: SlideDef }) {
  const t = useTone();
  const isCommand = slide.title === INIT_CMD;
  return (
    <div className="w-full max-w-6xl">
      <Kicker>{slide.kicker}</Kicker>
      {isCommand ? (
        <h1 className={`${t.panel} inline-flex items-center gap-4 md:gap-6 px-6 md:px-10 py-6 md:py-8 font-mono font-normal tracking-tight text-[24px] md:text-[40px] lg:text-[52px] leading-none max-w-full overflow-x-auto whitespace-nowrap`}>
          <span className={t.faint} aria-hidden>$</span>
          {slide.title}
        </h1>
      ) : (
        <Title large>{slide.title}</Title>
      )}
      {slide.subtitle && (
        <p className={`text-[18px] md:text-[24px] leading-[1.45] ${t.soft} mt-10 max-w-3xl`}>
          {slide.subtitle}
        </p>
      )}
      {slide.cta && (
        <div className={`flex flex-wrap items-center gap-x-6 gap-y-3 mt-12 pt-8 border-t ${t.border} max-w-3xl`}>
          <span className="inline-flex items-center gap-2 rounded-full bg-ink text-paper px-5 h-11 font-mono text-[13px] md:text-[14px]">
            {slide.cta.primary}
            <Arrow className="h-3.5 w-3.5" />
          </span>
          {slide.cta.secondary && (
            <span className={`inline-flex items-center gap-2 font-mono text-[13px] ${t.soft}`}>
              <LiveDot /> {slide.cta.secondary}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function SplitSlide({ slide }: { slide: SlideDef }) {
  const t = useTone();
  const card = slide.rightCard;
  return (
    <div className="w-full max-w-7xl grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
      <div>
        <Kicker>{slide.kicker}</Kicker>
        <Title>{slide.title}</Title>
        {slide.body && (
          <div className={`text-[16px] md:text-[18px] ${t.soft} mt-10 space-y-3 leading-relaxed max-w-xl`}>
            {slide.body.map((line, i) =>
              line === '' ? <div key={i} className="h-2" /> : <p key={i}>{line}</p>
            )}
          </div>
        )}
      </div>
      {card && (card.monospace ? (
        // Code panel, like an editor window.
        <div className={t.panel}>
          <div className={`flex items-center justify-between px-5 h-12 border-b ${t.border}`}>
            <div className="flex gap-2" aria-hidden>
              {[0, 1, 2].map(i => <span key={i} className={`h-2.5 w-2.5 rounded-full ${t.dark ? 'bg-night-line' : 'bg-line-strong'}`} />)}
            </div>
            <span className={`font-mono text-[12px] ${t.soft}`}>{card.title}</span>
          </div>
          <ol className="py-5 font-mono text-[12px] md:text-[13px] leading-[1.8] overflow-x-auto">
            {card.points.map((p, i) => (
              <li key={i} className="flex whitespace-pre">
                <span className={`w-12 shrink-0 pr-4 text-right select-none ${t.faint}`}>{i + 1}</span>
                <span className={p.trimStart().startsWith('//') ? t.soft : t.text}>{p || ' '}</span>
              </li>
            ))}
          </ol>
          <div className={`flex items-center gap-2 px-5 h-11 border-t ${t.border} font-mono text-[12px] ${t.soft}`}>
            <LiveDot /> NEAR testnet
          </div>
        </div>
      ) : (
        <div className={`${t.card} p-7 md:p-10`}>
          <div className={`font-mono text-[12px] ${t.soft} mb-6`}>{card.title}</div>
          <ul className={`divide-y ${t.dark ? 'divide-night-line' : 'divide-line'}`}>
            {card.points.map((p, i) => (
              <li key={i} className="flex items-start gap-4 py-4 text-[16px] md:text-[18px]">
                <Check size={18} className="flex-shrink-0 mt-1" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function CenterSlide({ slide }: { slide: SlideDef }) {
  const t = useTone();
  return (
    <div className="max-w-5xl text-center">
      <Kicker center>{slide.kicker}</Kicker>
      <Title>{slide.title}</Title>
      {slide.subtitle && (
        <p className={`text-[18px] md:text-[21px] ${t.soft} mt-10 max-w-3xl mx-auto leading-relaxed`}>
          {slide.subtitle}
        </p>
      )}
      {slide.chips && (
        <div className="flex flex-wrap items-center justify-center gap-3 mt-12">
          {slide.chips.map((c, i) => (
            <span
              key={i}
              className={`rounded-full border ${t.dark ? 'border-night-line' : 'border-line-strong bg-paper'} px-5 h-11 text-[15px] inline-flex items-center gap-2.5`}
            >
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
  const { soft } = useTone();
  if (name === 'at')     return <AtSign size={15} className={soft} />;
  if (name === 'key')    return <KeyRound size={15} className={soft} />;
  if (name === 'fuel')   return <Fuel size={15} className={soft} />;
  if (name === 'chain')  return <Network size={15} className={soft} />;
  if (name === 'bolt')   return <Zap size={14} className={soft} />;
  return null;
}

/** Ruled grid: cells share 1px borders, like a spec sheet. */
function RuledGrid({ cols, children }: { cols: string; children: React.ReactNode }) {
  const t = useTone();
  return <div className={`grid ${cols} border-l border-t ${t.border}`}>{children}</div>;
}

function ThreeUpSlide({ slide }: { slide: SlideDef }) {
  const t = useTone();
  return (
    <div className="w-full max-w-7xl">
      <Kicker>{slide.kicker}</Kicker>
      <Title>{slide.title}</Title>
      <div className="mt-14">
        <RuledGrid cols="md:grid-cols-3">
          {slide.cards!.map((c, i) => (
            <div key={i} className={`border-r border-b ${t.border} ${t.dark ? '' : 'bg-paper'} p-7 md:p-9 flex flex-col`}>
              <div className="flex items-center justify-between mb-10">
                <div className={`${t.text} [&>svg]:h-6 [&>svg]:w-6 [&>svg]:stroke-[1.5]`}>{c.icon}</div>
                <span className={`font-mono text-[13px] ${t.faint}`}>{c.step}</span>
              </div>
              <h3 className="text-[24px] md:text-[28px] tracking-tightish leading-tight mb-3">{c.title}</h3>
              <p className={`text-[15px] md:text-[16px] ${t.soft} leading-relaxed`}>{c.body}</p>
            </div>
          ))}
        </RuledGrid>
      </div>
    </div>
  );
}

function GridSlide({ slide }: { slide: SlideDef }) {
  const t = useTone();
  return (
    <div className="w-full max-w-7xl">
      <Kicker>{slide.kicker}</Kicker>
      <Title>{slide.title}</Title>
      <div className="mt-12">
        <RuledGrid cols="sm:grid-cols-2 lg:grid-cols-3">
          {slide.cards!.map((c, i) => (
            <div key={i} className={`border-r border-b ${t.border} ${t.dark ? '' : 'bg-paper'} p-6 md:p-7 flex flex-col`}>
              <div className="flex items-center justify-between mb-6">
                <div className={`${t.text} [&>svg]:h-5 [&>svg]:w-5 [&>svg]:stroke-[1.5]`}>{c.icon}</div>
                <span className={`font-mono text-[11px] ${t.faint}`}>{c.step}</span>
              </div>
              <h3 className="text-[19px] md:text-[21px] tracking-tightish mb-2">{c.title}</h3>
              <p className={`text-[14px] md:text-[15px] ${t.soft} leading-relaxed`}>{c.body}</p>
            </div>
          ))}
        </RuledGrid>
      </div>
    </div>
  );
}

function DemoSlide({ slide }: { slide: SlideDef }) {
  const t = useTone();
  return (
    <div className="w-full max-w-6xl">
      <Kicker>{slide.kicker}</Kicker>
      <Title>{slide.title}</Title>
      <div className={`mt-10 md:mt-12 ${t.panel} px-6 md:px-8 py-6 md:py-7 flex items-center gap-5`}>
        <Terminal size={20} className={`${t.soft} flex-shrink-0`} />
        <code className="font-mono text-[18px] md:text-[26px] flex-1 overflow-x-auto whitespace-nowrap">
          $ {slide.command}
        </code>
      </div>
      <ul className="mt-10 grid sm:grid-cols-2 gap-x-12">
        {slide.bullets!.map((b, i) => (
          <li key={i} className={`flex items-start gap-4 py-3.5 border-b ${t.border} text-[16px] md:text-[18px]`}>
            <span className={`font-mono text-[12px] ${t.faint} mt-1.5 w-5 shrink-0`}>{String(i + 1).padStart(2, '0')}</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ArchSlide({ slide }: { slide: SlideDef }) {
  const t = useTone();
  return (
    <div className="w-full max-w-7xl grid xl:grid-cols-[minmax(0,1fr)_auto] gap-10 xl:gap-16 items-center">
      <div>
        <Kicker>{slide.kicker}</Kicker>
        <Title>{slide.title}</Title>
      </div>
      <div className={`${t.panel} min-w-0`}>
        <div className={`flex items-center gap-2 px-5 h-10 border-b ${t.border}`} aria-hidden>
          {[0, 1, 2].map(i => <span key={i} className={`h-2.5 w-2.5 rounded-full ${t.dark ? 'bg-night-line' : 'bg-line-strong'}`} />)}
        </div>
        <pre className={`px-6 md:px-8 py-5 md:py-6 font-mono text-[11px] md:text-[12px] ${t.text} leading-[1.45] whitespace-pre overflow-x-auto`}>{`┌────────────────────────────────────────────────┐
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
  const t = useTone();
  return (
    <div className="w-full max-w-5xl">
      <Kicker>{slide.kicker}</Kicker>
      <Title>{slide.title}</Title>
      <div className={`mt-12 border-t ${t.border}`}>
        {slide.contracts!.map((c, i) => (
          <a
            key={i}
            href={c.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-between gap-6 py-6 px-2 border-b ${t.border} group transition-colors ${t.hover}`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
                <span className="text-[18px] md:text-[22px] tracking-tightish">{c.label}</span>
                <span className={`inline-flex items-center gap-2 font-mono text-[11px] ${t.soft}`}><LiveDot /> {c.chain}</span>
              </div>
              <code className={`font-mono text-[13px] md:text-[14px] ${t.soft} break-all`}>{c.id}</code>
            </div>
            <ExternalLink size={18} className={`${t.faint} ${t.dark ? 'group-hover:text-night-text' : 'group-hover:text-ink'} flex-shrink-0 transition-colors`} />
          </a>
        ))}
      </div>
      <p className={`mt-8 text-[15px] ${t.soft} max-w-3xl leading-relaxed`}>
        Click either one to open NearBlocks. Every agent is a sub-account of <code className={`font-mono text-[0.9em] ${t.text} border ${t.border} ${t.dark ? 'bg-night-2' : 'bg-paper-2'} px-1.5 py-px`}>{ROOT_ACCOUNT}</code>, so all of them can be found from there.
      </p>
    </div>
  );
}

function StackSlide({ slide }: { slide: SlideDef }) {
  const t = useTone();
  return (
    <div className="w-full max-w-6xl">
      <Kicker>{slide.kicker}</Kicker>
      <Title>{slide.title}</Title>
      <div className="mt-12">
        <RuledGrid cols="sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {slide.sponsors!.map((s, i) => (
            <div key={i} className={`border-r border-b ${t.border} ${t.dark ? '' : 'bg-paper'} p-6 md:p-7 flex flex-col min-h-[180px]`}>
              <span className={`font-mono text-[11px] ${t.faint} mb-8`}>{String(i + 1).padStart(2, '0')}</span>
              <div className="text-[22px] md:text-[24px] tracking-tightish mb-1">{s.name}</div>
              <div className={`text-[14px] ${t.soft} mb-5`}>{s.tag}</div>
              {s.done && (
                <span className={`mt-auto inline-flex w-fit items-center gap-2 font-mono text-[11px] ${t.soft}`}>
                  <LiveDot /> Live
                </span>
              )}
            </div>
          ))}
        </RuledGrid>
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
