// "What it costs to run a world": honest, measured testnet numbers in the reference's pricing-card layout.
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Section, Eyebrow, Heading, Reveal, Arrow } from './ui';
import { REPO_URL, CONTRACT_ID, CONTRACT_URL } from '../../site';

const RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

type Tier = {
  n: string;
  name: string;
  desc: string;
  price: string;
  unit: string;
  checks: string[];
  cta: { label: string; href: string; external?: boolean };
  tag?: string;
};

const TIERS: Tier[] = [
  {
    n: '01', name: 'Player', desc: 'Spawn an agent and play', price: '0', unit: 'NEAR',
    checks: ['Named account created for you', '100 GGLD starting gold', 'Gas sponsored on every trade', 'Your own full-access key'],
    cta: { label: 'Spawn an agent', href: '/docs' },
  },
  {
    n: '02', name: 'Operator', desc: 'Paid by whoever runs the world', price: '0.005', unit: 'NEAR per agent',
    checks: ['Account storage per agent', '≈0.0004 NEAR gas per trade', 'Contract pays token storage', 'Relayer validates every delegate'],
    cta: { label: 'Read the economics', href: '/docs' },
    tag: 'What we pay',
  },
  {
    n: '03', name: 'Self-host', desc: 'Fork the whole world', price: 'MIT', unit: 'Open-source license',
    checks: ['Rust contract + deploy script', 'Game server + spectator', 'Agent CLI + 6 providers', 'Landing, docs and deck'],
    cta: { label: 'View on GitHub', href: REPO_URL, external: true },
  },
];

function Cta({ tier, hi }: { tier: Tier; hi: boolean }) {
  const cls = `flex h-[54px] w-full items-center justify-center gap-2 text-[15px] font-medium transition-colors ${
    hi ? 'bg-ink text-paper hover:bg-ink-2' : 'border border-line-strong text-ink hover:bg-paper-2'
  } ${RING}`;
  const inner = <>{tier.cta.label} <Arrow className="h-4 w-4" /></>;
  return tier.cta.external
    ? <a href={tier.cta.href} target="_blank" rel="noreferrer" className={cls}>{inner}</a>
    : <Link to={tier.cta.href} className={cls}>{inner}</Link>;
}

export default function Costs() {
  return (
    <Section id="costs" className="border-t border-line py-24 md:py-36">
      <div className="xl:px-[60px]">
        <Reveal>
          <Eyebrow>Costs</Eyebrow>
          <Heading className="mt-7" first="What it costs" second="to run a world." />
          <p className="mt-6 max-w-[620px] text-[17px] md:text-[19px] leading-relaxed text-ink-soft">
            Testnet numbers, measured on <span className="font-mono text-[0.9em] text-ink-2">{CONTRACT_ID}</span>.
          </p>
        </Reveal>

        <div className="mt-16 md:mt-24 grid gap-6 lg:grid-cols-3 lg:gap-0 lg:items-start">
          {TIERS.map((t, idx) => {
            const hi = Boolean(t.tag);
            return (
              <Reveal key={t.n} delay={idx * 90} className="h-full">
                <article
                  aria-label={t.name}
                  className={`relative flex h-full flex-col px-7 py-10 md:px-12 md:py-14 ${
                    hi ? 'border-2 border-ink lg:-my-4 lg:py-[72px]' : 'border border-line lg:border-transparent'
                  }`}
                >
                  {t.tag && (
                    <span className="absolute -top-3 left-6 md:left-8 bg-ink px-3 py-1 font-mono text-[12px] uppercase tracking-[0.14em] text-paper">
                      {t.tag}
                    </span>
                  )}
                  <p className="font-mono text-[12px] text-ink-soft">{t.n}</p>
                  <h3 className="mt-3 text-[30px] md:text-[32px] tracking-tightish leading-tight text-ink">{t.name}</h3>
                  <p className="mt-2 text-[15px] text-ink-soft">{t.desc}</p>

                  <p className="mt-10 border-b border-line pb-8">
                    <span className="block text-[56px] md:text-[64px] leading-none tracking-display text-ink">{t.price}</span>
                    <span className="mt-3 block text-[16px] text-ink-soft">{t.unit}</span>
                  </p>

                  <ul className="mt-8 flex flex-1 flex-col gap-4">
                    {t.checks.map((c) => (
                      <li key={c} className="flex items-start gap-3 text-[15px] text-ink-2">
                        <Check className="mt-[3px] h-4 w-4 shrink-0 text-ink" aria-hidden />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-12">
                    <Cta tier={t} hi={hi} />
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>

        <p className="mt-14 md:mt-20 text-center text-[15px] text-ink-soft">
          Agents never hold NEAR for gas; the relayer pays it.{' '}
          <a href={CONTRACT_URL} target="_blank" rel="noreferrer" className={`text-ink-2 underline decoration-line-strong underline-offset-4 hover:decoration-ink ${RING}`}>
            Check every transaction on NearBlocks
          </a>
        </p>
      </div>
    </Section>
  );
}
