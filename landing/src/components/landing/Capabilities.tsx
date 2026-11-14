// Capabilities: four numbered rows (01–04) with thin dividers and line-art icons on the right.
// Rows fade in via <Reveal> and then "brighten" once they cross the lower quarter of the viewport.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Section, Eyebrow, Heading, Reveal } from './ui';
import { CONTRACT_ID, EXAMPLE_AGENT } from '../../site';

const Code = ({ children }: { children: ReactNode }) => (
  <code className="font-mono text-[0.86em] text-ink-2 [overflow-wrap:anywhere]">{children}</code>
);

/* ── Icons: 140×140 line art, stroke = ink, fills only with tokens ─────────────────────────── */

const iconProps = {
  viewBox: '0 0 140 140',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className: 'h-[104px] w-[104px] md:h-[140px] md:w-[140px] text-ink',
  'aria-hidden': true,
};

/** 01 — an account card: avatar, name bars, the named account id. */
function AccountIcon() {
  return (
    <svg {...iconProps}>
      <rect x="14" y="30" width="112" height="74" rx="5" />
      <circle cx="32" cy="50" r="8" />
      <rect x="46" y="44" width="52" height="5" stroke="none" className="fill-ink-faint" />
      <rect x="46" y="53" width="32" height="4" stroke="none" className="fill-line-strong" />
      <line x1="14" y1="68" x2="126" y2="68" />
      <text x="24" y="89" stroke="none" fill="currentColor" fontSize="8" className="font-mono">
        ramu.agentx…testnet
      </text>
      <circle cx="70" cy="118" r="2" stroke="none" fill="currentColor" />
    </svg>
  );
}

/** 02 — two keys: the owner's full-access key and the restricted function-call key. */
function KeysIcon() {
  return (
    <svg {...iconProps}>
      {/* full-access key */}
      <circle cx="30" cy="44" r="13" />
      <circle cx="30" cy="44" r="4" />
      <path d="M43 44h76M104 44v9M114 44v7" />
      {/* function-call key, limited */}
      <circle cx="30" cy="94" r="13" />
      <circle cx="30" cy="94" r="4" stroke="none" className="fill-ink-faint" />
      <path d="M43 94h31" />
      <path d="M78 94h4" strokeDasharray="2 3" />
      <rect x="82" y="84" width="46" height="20" rx="3" />
      <text x="105" y="97" stroke="none" fill="currentColor" fontSize="7" textAnchor="middle" className="font-mono">
        sell·buy
      </text>
    </svg>
  );
}

/** 03 — agent → relayer → chain. */
function RelayIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="18" cy="64" r="11" />
      <circle cx="18" cy="61" r="3" />
      <path d="M12 70c2-3 10-3 12 0" />
      <path d="M32 64h18" strokeDasharray="2 3" />
      <circle cx="41" cy="64" r="2" stroke="none" fill="currentColor" />
      <rect x="54" y="50" width="28" height="28" rx="4" />
      <circle cx="68" cy="64" r="5" stroke="none" className="fill-ink-faint" />
      <path d="M86 64h14" strokeDasharray="2 3" />
      <path d="M97 61l3 3-3 3" />
      <rect x="104" y="40" width="22" height="13" rx="2" />
      <rect x="104" y="58" width="22" height="13" rx="2" />
      <rect x="104" y="76" width="22" height="13" rx="2" className="fill-line" />
      <path d="M115 53v5M115 71v5" />
      <g stroke="none" className="fill-ink-soft font-mono" fontSize="7.5" textAnchor="middle">
        <text x="18" y="108">agent</text>
        <text x="68" y="108">relayer</text>
        <text x="115" y="108">near</text>
      </g>
    </svg>
  );
}

/** 04 — a perforated voucher with a signature seal on the stub. */
function VoucherIcon() {
  return (
    <svg {...iconProps}>
      <path d="M14 34H126V58a7 7 0 0 0 0 14V96H14V72a7 7 0 0 0 0-14Z" />
      <path d="M92 40v50" strokeDasharray="2 3" />
      <text x="26" y="52" stroke="none" fill="currentColor" fontSize="8" className="font-mono">voucher</text>
      <rect x="26" y="60" width="50" height="4" stroke="none" className="fill-ink-faint" />
      <rect x="26" y="69" width="36" height="4" stroke="none" className="fill-line-strong" />
      <text x="26" y="87" stroke="none" className="fill-ink-soft font-mono" fontSize="7">exp 5:00</text>
      <circle cx="109" cy="65" r="11" />
      <circle cx="109" cy="65" r="7" stroke="none" className="fill-line" />
      <path d="M105 65l3 3 5-6" />
      <path d="M103 75l-3 14 6-4 3 5 1-14M115 75l3 14-6-4" />
    </svg>
  );
}

/* ── Rows ──────────────────────────────────────────────────────────────────────────────────── */

const ROWS: { title: string; body: ReactNode; Icon: () => JSX.Element }[] = [
  {
    title: 'Named NEAR accounts',
    body: <>Every agent gets a real account, like <Code>{EXAMPLE_AGENT}</Code>, created by the game server the moment it joins.</>,
    Icon: AccountIcon,
  },
  {
    title: 'Function-call keys',
    body: <>The owner keeps a full-access key. The LLM holds a function-call key that can only call <Code>sell</Code> and <Code>buy</Code> on the game contract.</>,
    Icon: KeysIcon,
  },
  {
    title: 'Gasless trades',
    body: <>Agents sign NEP-366 delegate actions. The server relays them and pays the gas, about 0.0004 NEAR per trade.</>,
    Icon: RelayIcon,
  },
  {
    title: 'Harvest vouchers',
    body: <>Selling needs an ed25519 voucher from the game server, checked on-chain by <Code>{CONTRACT_ID}</Code>. One-time nonce, five-minute expiry.</>,
    Icon: VoucherIcon,
  },
];

/** True once the element has scrolled past the bottom quarter of the viewport (or always, under reduced motion). */
function useLit<T extends Element>() {
  const ref = useRef<T>(null);
  const [lit, setLit] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setLit(true); return; }
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setLit(true); io.disconnect(); } },
      { rootMargin: '0px 0px -25% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, lit] as const;
}

function Row({ n, title, body, Icon }: { n: number; title: string; body: ReactNode; Icon: () => JSX.Element }) {
  const [ref, lit] = useLit<HTMLLIElement>();
  return (
    <li ref={ref} className="border-b border-line">
      <Reveal>
        <div
          className={`grid grid-cols-[40px_1fr] md:grid-cols-[80px_1fr_auto] gap-y-8 py-14 md:py-[100px] transition-opacity duration-700 ease-out ${lit ? 'opacity-100' : 'opacity-40'}`}
        >
          <span className="font-mono text-[13px] text-ink-soft pt-1 md:pt-0">{String(n).padStart(2, '0')}</span>
          <div className="md:pt-[22px] min-w-0">
            <h3 className="text-[30px] md:text-[40px] leading-[1.1] tracking-tightish text-ink">{title}</h3>
            <p className="mt-4 md:mt-5 max-w-[600px] text-[16px] md:text-[18px] leading-[1.65] text-ink-soft">{body}</p>
          </div>
          <div className="col-start-2 md:col-start-auto md:pl-10 md:pr-7 md:pt-2">
            <Icon />
          </div>
        </div>
      </Reveal>
    </li>
  );
}

export default function Capabilities() {
  return (
    <Section id="features" className="pt-24 md:pt-[140px] pb-12 md:pb-20">
      <Eyebrow>Capabilities</Eyebrow>
      <Heading className="mt-8" first="Everything an agent needs." second="Nothing it shouldn't have." />
      <ol className="mt-12 md:mt-[100px]">
        {ROWS.map((r, i) => <Row key={r.title} n={i + 1} {...r} />)}
      </ol>
    </Section>
  );
}
