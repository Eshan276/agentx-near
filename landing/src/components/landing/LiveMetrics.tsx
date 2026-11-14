// Live metrics: a 2×2 grid of big numbers read from the game contract. Numbers count up when the
// grid scrolls into view (and ease to new values on each 15s refresh); a local clock ticks beside "Live".
import { useEffect, useRef, useState } from 'react';
import { Section, Eyebrow, Heading, Reveal, LiveDot } from './ui';
import { useNearStats } from '../../lib/near';
import { CONTRACT_ID, explorerAccount } from '../../site';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animates from the last shown value to `target` once `start` is true. Jumps under reduced motion. */
function useCountUp(target: number | undefined, start: boolean, ms = 1400) {
  const [val, setVal] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (target === undefined || !start) return;
    if (reducedMotion()) { from.current = target; setVal(target); return; }
    const a = from.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const v = a + (target - a) * (1 - Math.pow(1 - p, 3));
      from.current = v;
      setVal(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, start, ms]);
  return val;
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const p = (n: number) => String(n).padStart(2, '0');
  return { text: `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`, iso: now.toISOString() };
}

const fmt = (n: number, dp: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });

function Metric({ value, dp = 0, label, start, className = '' }: {
  value: number | undefined; dp?: number; label: string; start: boolean; className?: string;
}) {
  const v = useCountUp(value, start);
  const shown = value === undefined ? '—' : fmt(dp ? v : Math.round(v), dp);
  return (
    <div className={`py-10 sm:px-8 md:py-14 lg:px-12 transition-colors duration-300 hover:bg-paper-2 ${className}`}>
      <p
        className="text-[56px] sm:text-[48px] md:text-[64px] lg:text-[76px] xl:text-[104px] leading-none tracking-display text-ink"
        aria-hidden={value === undefined}
      >
        {shown}
      </p>
      <p className="mt-5 md:mt-6 text-[16px] md:text-[17px] text-ink-soft">{label}</p>
    </div>
  );
}

export default function LiveMetrics() {
  const stats = useNearStats();
  const clock = useClock();
  const gridRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Only show numbers we actually read; loading or offline-without-data shows "—".
  const has = stats.status === 'live' || stats.config !== undefined;
  const metrics = [
    { label: 'Agents registered', value: has ? stats.config?.agents : undefined },
    { label: 'GGLD in circulation', value: has ? stats.supply : undefined },
    { label: 'Trades settled', value: has ? stats.swaps : undefined },
    { label: 'Trade volume (GGLD)', value: has ? stats.volume : undefined, dp: 2 },
  ];

  const live = stats.status === 'live';
  const statusText = live ? 'Live' : stats.status === 'down' ? 'Offline' : 'Connecting';

  return (
    <Section id="live" className="py-24 md:py-[140px]">
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div>
          <Eyebrow>Live metrics</Eyebrow>
          <Heading className="mt-8" first="An economy" second="you can audit." />
        </div>
        <div className="flex items-center gap-4 font-mono text-[13px] text-ink-2 md:pb-3">
          <span className="inline-flex items-center gap-2" role="status">
            <LiveDot ok={live} />
            {statusText}
          </span>
          <span className="text-ink-faint" aria-hidden>|</span>
          <time dateTime={clock.iso} className="tabular-nums" aria-label="Local time">{clock.text}</time>
        </div>
      </div>

      <Reveal>
        <div ref={gridRef} className="mt-14 md:mt-24 grid sm:grid-cols-2">
          {metrics.map((m, i) => (
            <Metric
              key={m.label}
              label={m.label}
              value={m.value}
              dp={m.dp}
              start={visible}
              className={[
                i < 2 ? 'border-b border-line' : '',
                i === 2 ? 'border-b border-line sm:border-b-0' : '',
                i % 2 === 0 ? 'sm:border-r sm:border-line' : '',
              ].join(' ')}
            />
          ))}
        </div>
      </Reveal>

      <p className="mt-8 font-mono text-[12px] text-ink-soft">
        Read straight from{' '}
        <a
          href={explorerAccount(CONTRACT_ID)}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-line-strong underline-offset-4 hover:text-ink hover:decoration-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper rounded-sm"
        >
          {CONTRACT_ID}
        </a>{' '}
        every 15 seconds.
        {stats.status === 'down' && ' The RPC is not answering right now, so values may be stale.'}
      </p>
    </Section>
  );
}
