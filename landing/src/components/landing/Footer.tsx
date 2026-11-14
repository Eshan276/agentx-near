// Site footer on a faint dot grid: wordmark + tagline, four link columns, live network status.
import { Link } from 'react-router-dom';
import { Wordmark, LiveDot } from './ui';
import { useNearStats } from '../../lib/near';
import { REPO_URL, WORLD_URL, CONTRACT_URL, ROOT_URL, EXPLORER } from '../../site';

const RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

type L = { label: string; href: string; external?: boolean; route?: boolean };

const COLUMNS: { title: string; links: L[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'How it works', href: '/#how-it-works' },
      { label: 'Economy', href: '/#economy' },
      { label: 'Live', href: '/#live' },
      { label: 'Costs', href: '/#costs' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'Docs', href: '/docs', route: true },
      { label: 'Deck', href: '/deck', route: true },
      { label: 'GitHub', href: REPO_URL, external: true },
      { label: 'Contract', href: CONTRACT_URL, external: true },
    ],
  },
  {
    title: 'Network',
    links: [
      { label: 'NEAR testnet', href: EXPLORER, external: true },
      { label: 'Root account', href: ROOT_URL, external: true },
      { label: 'Game contract', href: CONTRACT_URL, external: true },
      { label: 'Spectate', href: WORLD_URL, external: true },
    ],
  },
  {
    title: 'Project',
    links: [
      { label: 'MIT license', href: `${REPO_URL}/blob/main/LICENSE`, external: true },
      { label: 'Art: Ninja Adventure (CC0)', href: 'https://pixel-boy.itch.io/ninja-adventure-asset-pack', external: true },
    ],
  },
];

function FLink({ l, className }: { l: L; className: string }) {
  const cls = `${className} transition-colors ${RING}`;
  if (l.route) return <Link to={l.href} className={cls}>{l.label}</Link>;
  if (l.external) return <a href={l.href} target="_blank" rel="noreferrer" className={cls}>{l.label}</a>;
  return <a href={l.href} className={cls}>{l.label}</a>;
}

export default function Footer() {
  const { status } = useNearStats();
  const live = status === 'live';

  return (
    <footer className="relative overflow-hidden border-t border-line">
      {/* Dot grid, fading out toward the bottom. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(theme(colors.line.strong)_1.2px,transparent_1.6px)] [background-size:20px_20px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]"
      />

      <div className="relative mx-auto max-w-page px-6 md:px-[68px]">
        <div className="grid gap-14 pt-20 pb-16 md:pt-24 md:pb-20 lg:grid-cols-[1.7fr_1fr_1fr_1fr_1fr] lg:gap-8">
          <div>
            <Link to="/" aria-label="AGENTX home" className={`inline-block text-ink ${RING}`}>
              <Wordmark className="[&>span:first-child]:text-[26px]" />
            </Link>
            <p className="mt-6 max-w-[300px] text-[16px] md:text-[17px] leading-[1.55] text-ink-soft">
              Autonomous agents that own their money on NEAR.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-10 gap-y-3 text-[15px]">
              <FLink l={{ label: 'GitHub', href: REPO_URL, external: true }} className="text-ink-soft hover:text-ink" />
              <FLink l={{ label: 'NearBlocks', href: CONTRACT_URL, external: true }} className="text-ink-soft hover:text-ink" />
              <FLink l={{ label: 'Docs', href: '/docs', route: true }} className="text-ink-soft hover:text-ink" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-4 lg:contents">
            {COLUMNS.map((c) => (
              <nav key={c.title} aria-label={c.title}>
                <h2 className="text-[15px] font-medium text-ink">{c.title}</h2>
                <ul className="mt-6 flex flex-col gap-4">
                  {c.links.map((l) => (
                    <li key={l.label}>
                      <FLink l={l} className="text-[15px] text-ink-soft hover:text-ink" />
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-line py-8 md:py-10 text-[15px] text-ink-soft sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; 2026 AGENTX. MIT licensed.</p>
          <p className="inline-flex items-center gap-2" aria-live="polite">
            <LiveDot ok={live} />
            {live ? 'Live on NEAR testnet' : status === 'loading' ? 'Checking NEAR testnet…' : 'Testnet unreachable'}
          </p>
        </div>
      </div>
    </footer>
  );
}
