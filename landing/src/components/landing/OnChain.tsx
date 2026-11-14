// On-chain: two columns. Left, copy + three contract stats; right, a live list of the AMM pools read
// from the game contract (reserves + spot price), with skeleton rows while loading.
import { Section, Eyebrow, Heading, Reveal, LiveDot, Arrow } from './ui';
import { useNearStats, gold, type PoolView } from '../../lib/near';
import { CONTRACT_ID, explorerAccount } from '../../site';

const NAMES: Record<string, string> = {
  plank: 'Wood plank', branch: 'Branch', rock: 'Rock', bar_iron: 'Iron bar', bar_gold: 'Gold bar',
  gem_red: 'Red gem', gem_green: 'Green gem', grass: 'Grass', honey: 'Honey', meat: 'Meat', fish: 'Fish',
};
const pretty = (id: string) => NAMES[id] ?? id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

const int = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
const fixed = (n: number, dp: number) => n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });

function PoolRow({ pool, first }: { pool: PoolView; first: boolean }) {
  const units = Number(pool.reserve_resource);
  return (
    <li className={`flex items-center gap-4 px-6 py-[14px] ${first ? 'bg-paper-2' : ''}`}>
      <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${first ? 'bg-ink' : 'bg-line-strong'}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-medium leading-tight text-ink">{pretty(pool.resource_id)}</span>
        <span className="mt-0.5 block truncate text-[14px] text-ink-soft">
          {int(units)} units · {int(gold(pool.reserve_gold, 0))} GGLD
        </span>
      </span>
      <span className="font-mono text-[13px] tabular-nums text-ink-2">{fixed(gold(pool.price, 3), 3)} GGLD</span>
    </li>
  );
}

function SkeletonRow() {
  return (
    <li className="flex items-center gap-4 px-6 py-[14px]" aria-hidden>
      <span className="h-[6px] w-[6px] rounded-full bg-line" />
      <span className="flex-1">
        <span className="block h-4 w-24 rounded-sm bg-paper-3 motion-safe:animate-pulse" />
        <span className="mt-2 block h-3 w-40 rounded-sm bg-paper-2 motion-safe:animate-pulse" />
      </span>
      <span className="h-3 w-20 rounded-sm bg-paper-3 motion-safe:animate-pulse" />
    </li>
  );
}

export default function OnChain() {
  const { status, pools, config } = useNearStats();

  // Prefer live config, fall back to the deployed defaults.
  const stats = [
    { value: String(config?.pools ?? 10), label: 'Pools' },
    { value: `${config ? config.fee_bps / 100 : 0.3}%`, label: 'Swap fee' },
    { value: String(config ? gold(config.starting_gold, 0) : 100), label: 'Starting GGLD' },
  ];

  const badge =
    status === 'live' ? { ok: true, text: 'Live', cls: 'text-live' }
    : status === 'down' ? { ok: false, text: 'Offline', cls: 'text-ink-faint' }
    : { ok: false, text: 'Connecting', cls: 'text-ink-faint' };

  return (
    <Section id="economy" className="py-24 md:py-[140px]">
      <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-24">
        <Reveal className="min-w-0">
          <Eyebrow>On-chain</Eyebrow>
          <Heading className="mt-8" first="On-chain" second="by default." />
          <p className="mt-8 max-w-[600px] text-[18px] md:text-[20px] leading-[1.6] text-ink-soft">
            One Rust contract holds everything: the GGLD token, a constant-product AMM for every
            resource, and the agent registry. Prices are read from the pool reserves. Gold comes out of
            those reserves and is never minted on a sale.
          </p>
          <dl className="mt-12 md:mt-14 grid grid-cols-3 gap-6">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col-reverse justify-end">
                <dt className="mt-3 text-[14px] text-ink-soft">{s.label}</dt>
                <dd className="text-[36px] sm:text-[44px] md:text-[48px] leading-none tracking-tightish text-ink tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <Reveal delay={120} className="min-w-0">
          <div className="border border-line bg-paper">
            <div className="flex h-[54px] items-center justify-between gap-4 border-b border-line px-6">
              <h3 className="font-mono text-[13px] text-ink-2">AMM pools · NEAR testnet</h3>
              <span className={`inline-flex items-center gap-2 font-mono text-[12px] ${badge.cls}`}>
                <LiveDot ok={badge.ok} />
                {badge.text}
              </span>
            </div>

            {status === 'down' && pools.length === 0 ? (
              <p className="px-6 py-14 text-center text-[15px] text-ink-soft" role="status">
                Couldn&apos;t reach NEAR testnet RPC. Retrying every 15 seconds.
              </p>
            ) : (
              <ul className="divide-y divide-line" aria-busy={status === 'loading'} aria-label="AMM pools">
                {status === 'loading' && pools.length === 0
                  ? Array.from({ length: 10 }, (_, i) => <SkeletonRow key={i} />)
                  : pools.map((p, i) => <PoolRow key={p.resource_id} pool={p} first={i === 0} />)}
              </ul>
            )}

            <a
              href={explorerAccount(CONTRACT_ID)}
              target="_blank"
              rel="noreferrer"
              className="group flex h-[54px] items-center justify-between border-t border-line px-6 text-[14px] text-ink-2 transition-colors hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink"
            >
              View contract on NearBlocks
              <Arrow className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
