// "Why it matters": rotating product statements (in place of a testimonial; no invented people)
// with a key-fact card, then a "Built with" marquee.
import { useEffect, useState } from 'react';
import { Section, Reveal, Marquee } from './ui';

const SLIDES = [
  { text: "Kill the server. The agent’s account, gold and history are still on NEAR.", fact: '0 keys held by the platform' },
  { text: 'The model holds a key that can only trade. You hold the key that owns the money.', fact: '2 keys per agent' },
  { text: 'No gas, no seed phrase. The server creates the account and pays every fee.', fact: '0 NEAR needed to play' },
];

const BUILT_WITH = ['NEAR Protocol', 'near-sdk', 'near-api-js', 'NearBlocks', 'FastNEAR RPC', 'Phaser', 'Socket.io', 'Ninja Adventure (CC0)'];

const pad = (n: number) => String(n).padStart(2, '0');

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

export default function Statement() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || paused) return;
    const t = window.setTimeout(() => setI((n) => (n + 1) % SLIDES.length), 6000);
    return () => window.clearTimeout(t);
  }, [i, paused, reduced]);

  return (
    <Section bleed className="border-t border-line pt-24 md:pt-36 pb-16 md:pb-20">
      <div className="mx-auto max-w-page px-6 md:px-[68px] xl:px-[128px]">
        <div
          role="region"
          aria-roledescription="carousel"
          aria-label="Why it matters"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false); }}
        >
          <div className="flex items-center gap-4 md:gap-6 font-mono text-[12px] md:text-[13px] uppercase tracking-[0.14em] text-ink-soft">
            <span className="whitespace-nowrap">Why it matters</span>
            <span aria-hidden className="h-px flex-1 bg-line" />
            <span className="whitespace-nowrap tabular-nums" aria-hidden>{pad(i + 1)} / {pad(SLIDES.length)}</span>
          </div>

          <div className="mt-14 md:mt-20 grid gap-12 lg:grid-cols-[1fr_340px] lg:gap-20 items-start">
            {/* All slides share one grid cell so the height never jumps between them. */}
            <div className="grid">
              {SLIDES.map((s, n) => (
                <p
                  key={n}
                  aria-hidden={n !== i}
                  className={`[grid-area:1/1] font-sans font-normal tracking-display text-ink text-[34px] leading-[1.08] sm:text-[44px] md:text-[64px] md:leading-[1.04] motion-safe:transition-opacity ${n === i ? 'opacity-100 motion-safe:duration-500 motion-safe:delay-300' : 'opacity-0 pointer-events-none motion-safe:duration-200'}`}
                >
                  {s.text}
                </p>
              ))}
            </div>

            <div>
              <div className="border border-line px-8 py-7">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">Key fact</p>
                <div className="mt-3 grid">
                  {SLIDES.map((s, n) => (
                    <p
                      key={n}
                      aria-hidden={n !== i}
                      className={`[grid-area:1/1] text-[30px] md:text-[34px] leading-[1.15] tracking-tightish text-ink motion-safe:transition-opacity ${n === i ? 'opacity-100 motion-safe:duration-500 motion-safe:delay-300' : 'opacity-0 motion-safe:duration-200'}`}
                    >
                      {s.fact}
                    </p>
                  ))}
                </div>
              </div>
              <div className="mt-6 flex items-center gap-1">
                {SLIDES.map((_, n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setI(n)}
                    aria-label={`Show statement ${n + 1} of ${SLIDES.length}`}
                    aria-current={n === i ? 'true' : undefined}
                    className="group flex h-6 items-center px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                  >
                    <span
                      aria-hidden
                      className={`block h-1.5 motion-safe:transition-all motion-safe:duration-300 ${n === i ? 'w-8 bg-ink' : 'w-2 bg-line-strong group-hover:bg-ink-faint'}`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Reveal className="mt-20 md:mt-28 border-t border-line pt-12 md:pt-14">
          <p className="text-center font-mono text-[12px] uppercase tracking-[0.14em] text-ink-soft">Built with</p>
        </Reveal>
      </div>

      <div className="mt-8">
        <Marquee speed="slow">
          {BUILT_WITH.map((w) => (
            <span key={w} className="mr-12 md:mr-16 whitespace-nowrap text-[22px] md:text-[26px] tracking-tightish text-ink-soft/70">
              {w}
            </span>
          ))}
        </Marquee>
      </div>
    </Section>
  );
}
