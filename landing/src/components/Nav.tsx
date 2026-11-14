// Top navigation. Full-width and transparent at the top of the page; once you scroll it turns into
// a floating rounded bar (like the reference). Mobile: a disclosure menu.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { REPO_URL, WORLD_URL } from '../site';
import { Wordmark } from './landing/ui';

const LINKS = [
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Economy',      href: '/#economy' },
  { label: 'Developers',   href: '/#developers' },
  { label: 'Docs',         href: '/docs' },
  { label: 'Deck',         href: '/deck' },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function Nav(_props: { animated?: boolean } = {}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 md:px-6 pt-3 md:pt-4 pointer-events-none">
      <nav
        aria-label="Main"
        className={`pointer-events-auto mx-auto flex items-center justify-between transition-all duration-500 ease-out
          ${scrolled
            ? 'max-w-[1200px] h-14 rounded-2xl border border-line bg-paper/85 backdrop-blur-md shadow-[0_8px_30px_-12px_rgba(11,10,9,.25)] px-5 md:px-8'
            : 'max-w-page h-16 border border-transparent px-3 md:px-[40px]'}`}
      >
        <Link to="/" className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink" aria-label="AGENTX home">
          <Wordmark />
        </Link>

        <ul className="hidden md:flex items-center gap-10 text-[14px] text-ink-2">
          {LINKS.map((l) => (
            <li key={l.label}>
              <a href={l.href} className="rounded transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden md:flex items-center gap-5">
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-[14px] text-ink-2 hover:text-ink rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
            GitHub
          </a>
          <a href={WORLD_URL} target="_blank" rel="noreferrer" className="btn-ink h-9 px-4 text-[14px]">
            Watch the world
          </a>
        </div>

        <button
          type="button"
          className="md:hidden h-10 w-10 grid place-items-center rounded-full border border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
            {open
              ? <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              : <path d="M3 7h14M3 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
          </svg>
        </button>
      </nav>

      {open && (
        <div id="mobile-menu" className="pointer-events-auto md:hidden mx-auto mt-2 max-w-page rounded-2xl border border-line bg-paper p-4 shadow-lg">
          <ul className="flex flex-col">
            {[...LINKS, { label: 'GitHub', href: REPO_URL }].map((l) => (
              <li key={l.label}>
                <a href={l.href} onClick={() => setOpen(false)} className="block rounded px-2 py-3 text-[16px] border-b border-line last:border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <a href={WORLD_URL} target="_blank" rel="noreferrer" className="btn-ink mt-3 w-full justify-center">Watch the world</a>
        </div>
      )}
    </header>
  );
}
