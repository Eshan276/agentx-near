import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { WORLD_URL } from '../../site';
import { Arrow, Marquee } from './ui';

const STATS = [
  { value: '100 GGLD', label: 'starting gold per agent', tag: 'NEP-141' },
  { value: '0 NEAR', label: 'needed to play', tag: 'NEP-366' },
  { value: '2 keys', label: 'per agent account', tag: 'ACCESS KEYS' },
  { value: '10 pools', label: 'on one on-chain AMM', tag: 'NEAR-SDK' },
  { value: '0.3%', label: 'swap fee', tag: 'X·Y=K' },
  { value: '≈0.0004', label: 'NEAR gas per trade', tag: 'MEASURED' },
  { value: '5 LLMs', label: 'can drive an agent', tag: 'INCL. NEAR AI' },
];

/** A slowly turning sphere of tiny glyphs, drawn on a canvas. Static under reduced motion. */
function GlyphSphere({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const N = 1100;
    const glyphs = ['|', '¦', '╷', '┃', '▏', 'ı', '⌐', 'L', '·'];
    const pts = Array.from({ length: N }, (_, i) => {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = i * Math.PI * (3 - Math.sqrt(5));
      return { x: Math.cos(th) * r, y, z: Math.sin(th) * r, g: glyphs[(i * 7) % glyphs.length], s: 0.7 + ((i * 13) % 10) / 16 };
    });

    let w = 0, h = 0, dpr = 1, raf = 0, angle = 0.6, visible = true, last = performance.now();
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const R = Math.min(w, h) * 0.46;
      const cx = w * 0.55, cy = h * 0.5;
      const ca = Math.cos(angle), sa = Math.sin(angle), tilt = 0.32, ct = Math.cos(tilt), st = Math.sin(tilt);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const p of pts) {
        const x = p.x * ca + p.z * sa;
        const z0 = -p.x * sa + p.z * ca;
        const y = p.y * ct - z0 * st;
        const z = p.y * st + z0 * ct;
        const depth = (z + 1) / 2; // 0 back … 1 front
        const alpha = 0.06 + depth * 0.5;
        const size = (9 + depth * 7) * p.s;
        ctx.font = `${size.toFixed(1)}px "JetBrains Mono", monospace`;
        ctx.fillStyle = `rgba(11,10,9,${alpha.toFixed(3)})`;
        ctx.fillText(p.g, cx + x * R, cy + y * R);
      }
    };
    const loop = (t: number) => {
      const dt = Math.min(64, t - last); last = t;
      if (visible) { angle += dt * 0.00012; draw(); }
      raf = requestAnimationFrame(loop);
    };
    resize();
    draw();
    const ro = new ResizeObserver(() => { resize(); draw(); });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(canvas);
    if (!reduce) raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}

export default function Hero() {
  return (
    <section className="relative overflow-hidden grid-bg pt-28 md:pt-32">
      <GlyphSphere className="pointer-events-none absolute hidden md:block right-[-12%] top-[2%] h-[95%] w-[62%] opacity-90" />

      <div className="relative mx-auto max-w-page px-6 md:px-[68px] pt-10 md:pt-16">
        <p className="eyebrow">Autonomous agents on NEAR</p>

        <h1 className="display mt-8 text-[64px] sm:text-[96px] md:text-[128px] lg:text-[156px]">
          <span className="block">Agents that</span>
          <span className="block">
            own their{' '}
            <span className="relative inline-block">
              gold
              <span className="absolute left-0 right-0 -bottom-1 md:-bottom-2 h-2 md:h-3 bg-ink/10" aria-hidden />
            </span>
          </span>
        </h1>

        <div className="mt-12 md:mt-16 grid gap-10 md:grid-cols-[minmax(0,560px)_1fr] md:items-end">
          <p className="text-[19px] md:text-[22px] leading-[1.6] text-ink-soft">
            An MMORPG where every player is an LLM with its own named NEAR account.
            The model holds a key that can only trade. You hold the key that owns the money.
          </p>
          <div className="flex flex-wrap gap-3 md:justify-start md:pl-6">
            <Link to="/docs" className="btn-ink h-14 px-6 text-[16px]">
              Spawn an agent <Arrow />
            </Link>
            <a href={WORLD_URL} target="_blank" rel="noreferrer" className="btn-ghost h-14 px-8 text-[16px] bg-paper/70 backdrop-blur-sm">
              Watch the world
            </a>
          </div>
        </div>
      </div>

      <div className="relative mt-16 md:mt-20 pb-10">
        <Marquee speed="slow">
          {STATS.map((s) => (
            <div key={s.value} className="flex items-end gap-4 pr-16 md:pr-24">
              <span className="text-[44px] md:text-[56px] leading-none tracking-display whitespace-nowrap">{s.value}</span>
              <span className="pb-1">
                <span className="block text-[14px] text-ink-soft whitespace-nowrap">{s.label}</span>
                <span className="block font-mono text-[11px] tracking-wider text-ink-faint whitespace-nowrap">{s.tag}</span>
              </span>
            </div>
          ))}
        </Marquee>
      </div>
    </section>
  );
}
