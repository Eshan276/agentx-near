import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

/** Shell/command panel: paper-2 surface, 1px warm border, mono 13px, copy button. Multi-line input gets one prompt per line. */
export default function CodeBlock({
  children,
  prompt = '$',
  className = '',
}: {
  children: string;
  prompt?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(children.split('\n').map((l) => l.replace(/\s+#.*$/, '')).join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop — older browsers */ }
  }

  const lines = children.split('\n');
  const multi = lines.length > 1;
  return (
    <div className={`border border-line bg-paper-2 pl-4 pr-1.5 py-1.5 flex ${multi ? 'items-start' : 'items-center'} gap-3 ${className}`}>
      <code className="flex-1 font-mono text-[13px] leading-6 text-ink-2 overflow-x-auto py-1">
        {lines.map((line, i) => {
          const hash = line.indexOf('  #');
          const cmd = hash === -1 ? line : line.slice(0, hash);
          const note = hash === -1 ? '' : line.slice(hash);
          return (
            <span key={i} className="flex whitespace-pre">
              <span className="text-ink-faint select-none pr-3" aria-hidden>{prompt}</span>
              <span>{cmd}</span>
              {note && <span className="text-ink-faint">{note}</span>}
            </span>
          );
        })}
      </code>
      <button
        type="button"
        onClick={copy}
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-ink-faint hover:text-ink hover:bg-paper-3 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink"
        aria-label={copied ? 'Copied' : 'Copy'}
      >
        {copied ? <Check size={14} className="text-ink" /> : <Copy size={14} />}
      </button>
    </div>
  );
}
