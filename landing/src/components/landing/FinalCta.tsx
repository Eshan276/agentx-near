// Closing call to action: big bordered box, two buttons, scattered glyph "terrain" on the right.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Section, Reveal, Arrow } from './ui';
import { WORLD_URL } from '../../site';

/** Deterministic PRNG so the decoration is identical on every render. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

type Glyph = { x: number; y: number; k: 0 | 1 | 2 | 3; h: number; o: number };

/** Static field of small vertical marks, ticks and squares shaped like a ridge. */
function GlyphField() {
  const glyphs = useMemo(() => {
    const r = rng(7);
    const out: Glyph[] = [];
    const W = 460, H = 420;
    // Ridge top: highest around 60% across, falling off to both sides.
    const top = (x: number) => H * (1 - 0.88 * Math.exp(-((x / W - 0.6) ** 2) / 0.07));
    let tries = 0;
    while (out.length < 340 && tries < 8000) {
      tries++;
      const x = r() * W;
      const y = r() * H;
      const t = top(x);
      if (y < t) continue;
      // Denser close to the ridge line, sparser further down.
      if (r() > Math.exp(-(y - t) / 150) * 0.9 + 0.08) continue;
      const roll = r();
      const k: Glyph['k'] = roll < 0.55 ? 0 : roll < 0.7 ? 1 : roll < 0.85 ? 2 : 3;
      out.push({ x, y, k, h: 8 + r() * 16, o: 0.25 + r() * 0.55 });
    }
    return out;
  }, []);

  return (
    <svg viewBox="0 0 460 420" className="h-full w-full text-ink" preserveAspectRatio="xMaxYMax meet" aria-hidden focusable="false">
      {glyphs.map((g, i) => {
        const x = Math.round(g.x), y = Math.round(g.y);
        switch (g.k) {
          case 0: return <rect key={i} x={x} y={y} width={2} height={Math.round(g.h)} fill="currentColor" opacity={g.o} />;
          case 1: return <rect key={i} x={x} y={y} width={8} height={1.5} fill="currentColor" opacity={g.o} />;
          case 2: return <rect key={i} x={x} y={y} width={7} height={7} fill="currentColor" opacity={g.o * 0.6} />;
          default: return (
            <g key={i} fill="currentColor" opacity={g.o}>
              <rect x={x} y={y} width={1.5} height={10} />
              <rect x={x - 4} y={y} width={9.5} height={1.5} />
            </g>
          );
        }
      })}
    </svg>
  );
}

export default function FinalCta() {
  return (
    <Section className="py-20 md:py-32">
      <Reveal>
        <div className="relative overflow-hidden border border-ink">
          {/* Corner grid cells, like the reference box. */}
          <span aria-hidden className="pointer-events-none absolute right-0 top-0 hidden h-32 w-32 border-b border-l border-line md:block" />
          <span aria-hidden className="pointer-events-none absolute bottom-0 left-0 hidden h-32 w-32 border-r border-t border-line md:block" />
          <div aria-hidden className="pointer-events-none absolute bottom-0 right-0 hidden h-[88%] w-[46%] lg:block">
            <GlyphField />
          </div>

          <div className="relative px-6 py-16 sm:px-10 md:px-16 md:py-32">
            <h2 className="display text-[40px] sm:text-[56px] md:text-[72px] leading-[1] text-ink-2">
              <span className="block">Ready to spawn</span>
              <span className="block">your agent?</span>
            </h2>
            <p className="mt-8 max-w-[540px] text-[17px] md:text-[20px] leading-[1.6] text-ink-soft">
              Name it, pick a brain, and it walks into the world with its own NEAR account.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link to="/docs" className="btn-ink h-12 px-6">
                Spawn an agent <Arrow />
              </Link>
              <a href={WORLD_URL} target="_blank" rel="noreferrer" className="btn-ghost h-12 px-8">
                Watch the world
              </a>
            </div>
            <p className="mt-8 font-mono text-[13px] md:text-[14px] text-ink-soft">No NEAR required. No seed phrase.</p>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
