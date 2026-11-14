// Shared building blocks for the landing page. Every section uses these so spacing, labels and
// motion stay consistent: Section, Eyebrow, Reveal, Marquee, LiveDot, Arrow.
import { useEffect, useRef, useState, type ReactNode } from 'react';

export function Section({
  id, children, className = '', dark = false, bleed = false,
}: { id?: string; children: ReactNode; className?: string; dark?: boolean; bleed?: boolean }) {
  return (
    <section id={id} className={`${dark ? 'bg-night text-night-text hatch-dark' : ''} ${className} scroll-mt-24`}>
      {bleed ? children : <div className="mx-auto max-w-page px-6 md:px-[68px]">{children}</div>}
    </section>
  );
}

/** Mono label with a short rule before it: "—— Capabilities". */
export function Eyebrow({ children, dark = false, center = false }: { children: ReactNode; dark?: boolean; center?: boolean }) {
  return (
    <p className={`eyebrow ${dark ? 'eyebrow-dark' : ''} ${center ? 'justify-center after:block after:w-8 after:h-px after:bg-ink-faint' : ''}`}>
      {children}
    </p>
  );
}

/** Two-tone section heading: first line ink, second line muted. */
export function Heading({ first, second, dark = false, className = '' }: { first: ReactNode; second?: ReactNode; dark?: boolean; className?: string }) {
  return (
    <h2 className={`h-section ${className}`}>
      <span className="block">{first}</span>
      {second && <span className={`block ${dark ? 'text-night-soft' : 'text-ink-soft'}`}>{second}</span>}
    </h2>
  );
}

/** Fades + lifts children in when they scroll into view (disabled under reduced motion via CSS). */
export function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${inView ? 'in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/** Infinite horizontal scroller. Children are rendered twice; the track moves -50%. */
export function Marquee({ children, speed = 'normal', reverse = false, className = '' }: {
  children: ReactNode; speed?: 'normal' | 'slow'; reverse?: boolean; className?: string;
}) {
  const anim = reverse ? 'animate-marquee-rev' : speed === 'slow' ? 'animate-marquee-slow' : 'animate-marquee';
  return (
    <div className={`overflow-hidden mask-fade-x ${className}`}>
      <div className={`flex w-max ${anim} hover:[animation-play-state:paused]`}>
        <div className="flex shrink-0">{children}</div>
        <div className="flex shrink-0" aria-hidden>{children}</div>
      </div>
    </div>
  );
}

export function LiveDot({ ok = true }: { ok?: boolean }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${ok ? 'bg-live animate-pulse-dot' : 'bg-ink-faint'}`} aria-hidden />;
}

export function Arrow({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Logo wordmark: "AGENTX" + small mono "NEAR" tag, like the reference's "Optimus TM". */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-1.5 ${className}`}>
      <span className="text-[22px] tracking-tightish">AGENTX</span>
      <span className="font-mono text-[11px] text-ink-soft">NEAR</span>
    </span>
  );
}
