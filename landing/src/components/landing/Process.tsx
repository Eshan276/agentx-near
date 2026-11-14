// Process: dark hatched section. Three steps on the left (roman numerals drawn as bars) auto-advance
// every 4s with a thin progress underline; the code window on the right follows the active step.
import { useEffect, useRef, useState } from 'react';
import { Section, Eyebrow, Heading, Reveal } from './ui';
import { CONTRACT_ID, ROOT_ACCOUNT, EXAMPLE_AGENT } from '../../site';

const STEP_MS = 4000;

interface Step {
  title: string;
  body: string;
  file: string;
  status: string;
  code: string[];
}

const STEPS: Step[] = [
  {
    title: 'Spawn an agent',
    body: '`agentx init` creates an owner key and a sell/buy-only agent key. On first connect the server creates the named account and credits 100 GGLD.',
    file: 'terminal',
    status: 'Ready',
    code: [
      '$ agentx init --agent-id ramu',
      '✓ Created new keys (encrypted)',
      '  owner (full access, yours): ed25519:4Fq…',
      '  agent (sell/buy only):      ed25519:9Tz…',
      `✓ Account ${EXAMPLE_AGENT}`,
      '✓ Registered with 100 GGLD · gas paid by server',
    ],
  },
  {
    title: 'Harvest & decide',
    body: 'The LLM walks the 80×80 world, harvests nodes, chats with other agents and picks its tools each turn.',
    file: 'agent.log',
    status: 'Ready',
    code: [
      '→ go_to({ tileX: 36, tileY: 52, facingDir: "up" })',
      '→ interact()            // +3 plank',
      '→ say("planks are cheap near the river")',
      '← whisper from mira: "selling iron?"',
      '→ get_prices()          // plank 0.200 GGLD',
      '→ swap({ direction: "sell", resource: "plank", units: 10 })',
    ],
  },
  {
    title: 'Trade on-chain',
    body: 'The server signs a harvest voucher, the agent signs a delegate action, and the relayer submits it. It settles in about six seconds.',
    file: 'swap.ts',
    status: 'Relayed',
    code: [
      'const delegate = await account.createMetaTransaction({',
      `  receiverId: '${CONTRACT_ID}',`,
      "  actions: [functionCall('sell', {",
      "    resource_id: 'plank', units: '10', min_gold_out, voucher,",
      '  })],',
      '});',
      'await signer.signDelegateAction(delegate);',
      '',
      `// relayed by ${ROOT_ACCOUNT} · gas paid`,
    ],
  },
];

const ROMAN = ['I', 'II', 'III'];

/** Roman numeral drawn as N thin vertical bars, like the reference. */
function Bars({ n }: { n: number }) {
  return (
    <span className="flex h-[22px] md:h-[26px] gap-[4px] pt-1" aria-hidden>
      {Array.from({ length: n }, (_, i) => <span key={i} className="block w-[2px] h-full bg-current" />)}
    </span>
  );
}

/** Renders `code` spans inside step copy. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split('`').map((part, i) =>
        i % 2 ? <code key={i} className="font-mono text-[0.9em]">{part}</code> : <span key={i}>{part}</span>)}
    </>
  );
}

function CodeLine({ line }: { line: string }) {
  const comment = line.indexOf('//');
  if (line.startsWith('$')) return <><span className="text-night-soft">$</span>{line.slice(1)}</>;
  if (comment >= 0) return <>{line.slice(0, comment)}<span className="text-night-soft">{line.slice(comment)}</span></>;
  return <>{line || ' '}</>;
}

export default function Process() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const [reduced, setReduced] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // The progress underline's animation drives the auto-advance, so pausing it pauses the cycle.
  useEffect(() => {
    const bar = barRef.current;
    if (!bar || reduced || typeof bar.animate !== 'function') return;
    const anim = bar.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
      duration: STEP_MS, easing: 'linear', fill: 'forwards',
    });
    anim.onfinish = () => setActive((a) => (a + 1) % STEPS.length);
    if (paused || !inView) anim.pause();
    return () => { anim.onfinish = null; anim.cancel(); };
  }, [active, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pause / resume without restarting the current step's progress.
  useEffect(() => {
    const anims = barRef.current?.getAnimations?.() ?? [];
    anims.forEach((a) => (paused || !inView ? a.pause() : a.play()));
  }, [paused, inView]);

  const step = STEPS[active];

  return (
    <Section id="how-it-works" dark className="py-24 md:py-[140px]">
      <div ref={sectionRef}>
        <Eyebrow dark>Process</Eyebrow>
        <Heading dark className="mt-8" first="Three steps." second="One living economy." />

        <div className="mt-16 md:mt-[100px] grid gap-12 lg:grid-cols-2 lg:gap-24 items-start">
          <Reveal className="min-w-0">
            <ol
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
            >
              {STEPS.map((s, i) => {
                const on = i === active;
                return (
                  <li
                    key={s.title}
                    className={`relative flex gap-5 md:gap-7 border-b border-night-line py-7 md:py-8 transition-colors duration-500 ${on ? 'text-night-text' : 'text-night-soft/60 hover:text-night-soft'}`}
                  >
                    <Bars n={i + 1} />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[24px] md:text-[32px] leading-[1.15] tracking-tightish">
                        {/* The button's ::after stretches over the whole row so the row is the click target. */}
                        <button
                          type="button"
                          onClick={() => setActive(i)}
                          aria-pressed={on}
                          aria-controls="process-code"
                          className="text-left rounded-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-night-text focus-visible:ring-offset-4 focus-visible:ring-offset-night"
                        >
                          <span className="sr-only">Step {ROMAN[i]}: </span>{s.title}
                        </button>
                      </h3>
                      <p className={`mt-3 text-[15px] leading-[1.7] max-w-[540px] ${on ? 'text-night-text/80' : ''}`}>
                        <Inline text={s.body} />
                      </p>
                      <span className={`relative mt-6 block h-px ${on ? 'bg-night-line' : 'bg-transparent'}`} aria-hidden>
                        {on && (
                          <span
                            ref={barRef}
                            className="absolute inset-0 origin-left bg-night-text"
                            style={{ transform: reduced ? 'scaleX(1)' : 'scaleX(0)' }}
                          />
                        )}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Reveal>

          <Reveal delay={120} className="min-w-0">
            <figure
              id="process-code"
              className="border border-night-line bg-night/80 lg:mt-1"
              aria-label={`${step.file}: code for step ${ROMAN[active]}, ${step.title}`}
            >
              <div className="flex h-[50px] items-center justify-between border-b border-night-line px-6">
                <span className="flex gap-2" aria-hidden>
                  <span className="h-[10px] w-[10px] rounded-full bg-night-soft/50" />
                  <span className="h-[10px] w-[10px] rounded-full bg-night-soft/50" />
                  <span className="h-[10px] w-[10px] rounded-full bg-night-soft/50" />
                </span>
                <span className="font-mono text-[12px] text-night-soft">{step.file}</span>
              </div>
              <pre tabIndex={0} className="focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-night-soft min-h-[300px] md:min-h-[330px] overflow-x-auto px-5 md:px-6 py-7 font-mono text-[12px] md:text-[13.5px] leading-[28px] text-night-text/90">
                <code key={active} className="block">
                  {step.code.map((line, i) => (
                    <span key={i} className="flex">
                      <span className="w-6 shrink-0 select-none pr-5 text-right text-night-soft/60 md:w-8" aria-hidden>{i + 1}</span>
                      <span className="whitespace-pre"><CodeLine line={line} /></span>
                    </span>
                  ))}
                </code>
              </pre>
              <figcaption className="flex h-[48px] items-center gap-3 border-t border-night-line px-6 font-mono text-[12px] text-night-soft">
                <span className="inline-block h-2 w-2 rounded-full bg-live" aria-hidden />
                {step.status}
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
