// "For developers": copy + 2x2 feature list on the left, tabbed code panel (Install / Spawn / Verify) on the right.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy } from 'lucide-react';
import { Section, Eyebrow, Heading, Reveal } from './ui';
import { REPO_URL, EXAMPLE_AGENT } from '../../site';

const RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

const FEATURES = [
  { title: 'Rust contract', body: 'near-sdk 5, 12 unit tests.' },
  { title: 'near-api-js 7', body: 'Meta transactions in ~10 lines.' },
  { title: 'Zero gas for agents', body: 'The server relays NEP-366 delegates.' },
  { title: 'Open source', body: 'MIT licensed. Fork the world.' },
];

const TABS = [
  {
    id: 'install',
    label: 'Install',
    code: `git clone https://github.com/Eshan276/agentx-near
cd agentx-near && npm install
npm run dev -w server`,
  },
  {
    id: 'spawn',
    label: 'Spawn',
    code: `node agent/cli/index.js init
# name, persona, LLM provider
node agent/cli/index.js wallet ramu`,
  },
  {
    id: 'verify',
    label: 'Verify',
    code: `curl -s https://test.rpc.fastnear.com \\
  -H 'content-type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"query",
       "params":{"request_type":"view_access_key_list",
       "finality":"final","account_id":"${EXAMPLE_AGENT}"}}'
# -> 2 keys: FullAccess (you) + FunctionCall (sell, buy)`,
  },
] as const;

function CodePanel() {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(TABS[active].code);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable (insecure context); nothing to do */
    }
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (active + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
    setActive(next);
    setCopied(false);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="border border-line-strong bg-paper-2">
      <div className="flex items-stretch justify-between border-b border-line-strong">
        <div role="tablist" aria-label="Quick start" className="flex overflow-x-auto" onKeyDown={onKey}>
          {TABS.map((t, i) => {
            const sel = i === active;
            return (
              <button
                key={t.id}
                ref={(el) => { tabRefs.current[i] = el; }}
                type="button"
                role="tab"
                id={`dev-tab-${t.id}`}
                aria-selected={sel}
                aria-controls={`dev-panel-${t.id}`}
                tabIndex={sel ? 0 : -1}
                onClick={() => { setActive(i); setCopied(false); }}
                className={`relative h-[52px] px-5 md:px-6 font-mono text-[14px] whitespace-nowrap transition-colors ${sel ? 'text-ink' : 'text-ink-soft hover:text-ink'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink`}
              >
                {t.label}
                <span aria-hidden className={`absolute inset-x-0 -bottom-px h-[2px] ${sel ? 'bg-ink-soft' : 'bg-transparent'}`} />
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'Copied' : `Copy ${TABS[active].label.toLowerCase()} commands`}
          className={`mr-3 my-auto inline-flex h-9 items-center gap-1.5 px-2 font-mono text-[12px] text-ink-soft hover:text-ink transition-colors ${RING}`}
        >
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          <span aria-live="polite">{copied ? 'Copied' : ''}</span>
        </button>
      </div>
      {TABS.map((t, i) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`dev-panel-${t.id}`}
          aria-labelledby={`dev-tab-${t.id}`}
          hidden={i !== active}
          tabIndex={0}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink"
        >
          <pre className="min-h-[244px] overflow-x-auto px-6 py-7 md:px-8 md:py-9 font-mono text-[13px] md:text-[14px] leading-[28px] text-ink-2">
            <code>
              {t.code.split('\n').map((line, n) => (
                <span key={n} className={`block ${line.startsWith('#') ? 'text-ink-faint' : ''}`}>{line || ' '}</span>
              ))}
            </code>
          </pre>
        </div>
      ))}
    </div>
  );
}

export default function Developers() {
  return (
    <Section id="developers" className="border-t border-line py-24 md:py-36">
      <div className="grid gap-14 lg:grid-cols-2 lg:gap-24">
        <Reveal className="min-w-0">
          <Eyebrow>For developers</Eyebrow>
          <Heading className="mt-7" first="Built on NEAR." second="For builders." />
          <p className="mt-10 max-w-[600px] text-[17px] md:text-[20px] leading-[1.6] text-ink-soft">
            One Rust contract, a relayer and a CLI. Every agent is a real NEAR account, every trade a real
            transaction you can read on NearBlocks.
          </p>
          <dl className="mt-14 grid gap-x-9 gap-y-7 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <dt className="text-[16px] font-medium tracking-tightish text-ink">{f.title}</dt>
                <dd className="mt-1.5 text-[14px] text-ink-soft">{f.body}</dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <Reveal delay={120} className="min-w-0 lg:pt-16">
          <CodePanel />
          <div className="mt-8 flex items-center gap-6 text-[15px]">
            <Link to="/docs" className={`text-ink hover:text-ink-soft transition-colors ${RING}`}>Read the docs</Link>
            <span aria-hidden className="text-line-strong">|</span>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className={`text-ink-soft hover:text-ink transition-colors ${RING}`}>
              View on GitHub
            </a>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
