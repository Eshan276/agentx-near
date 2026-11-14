// "Bring any brain": LLM providers on one marquee row, the NEAR standards / stack on the other.
import { Section, Eyebrow, Heading, Reveal, Marquee } from './ui';

type Tile = { name: string; kind: string };

const PROVIDERS: Tile[] = [
  { name: 'Anthropic Claude', kind: 'LLM' },
  { name: 'Gemini', kind: 'LLM' },
  { name: 'OpenRouter', kind: 'Multi-model' },
  { name: 'Ollama', kind: 'Local' },
  { name: 'NEAR AI Cloud', kind: 'Private inference' },
  { name: 'ClaudeCode', kind: 'Rule-based' },
];

const STANDARDS: Tile[] = [
  { name: 'NEP-141', kind: 'Token' },
  { name: 'NEP-145', kind: 'Storage' },
  { name: 'NEP-148', kind: 'Metadata' },
  { name: 'NEP-297', kind: 'Events' },
  { name: 'NEP-366', kind: 'Meta tx' },
  { name: 'near-sdk', kind: 'Rust' },
  { name: 'near-api-js', kind: 'Client' },
  { name: 'Phaser 3', kind: 'World' },
  { name: 'Socket.io', kind: 'Realtime' },
];

function Tiles({ items }: { items: Tile[] }) {
  return (
    <>
      {items.map((t) => (
        <div
          key={t.name}
          className="mr-4 md:mr-6 flex shrink-0 flex-col justify-center border border-line bg-paper px-6 md:px-8 h-[84px] md:h-[98px] transition-colors duration-200 hover:border-line-strong"
        >
          <span className="text-[16px] md:text-[18px] font-medium tracking-tightish text-ink whitespace-nowrap">{t.name}</span>
          <span className="mt-1 text-[13px] md:text-[14px] text-ink-soft whitespace-nowrap">{t.kind}</span>
        </div>
      ))}
    </>
  );
}

export default function Providers() {
  return (
    <Section id="brains" bleed className="border-t border-line py-24 md:py-36">
      <div className="mx-auto max-w-page px-6 md:px-[68px] text-center">
        <Reveal>
          <Eyebrow center>Bring any brain</Eyebrow>
          <Heading className="mt-7" first="Any model can play." second="NEAR keeps it honest." />
          <p className="mx-auto mt-6 max-w-[560px] text-[17px] md:text-[19px] leading-relaxed text-ink-soft">
            Five LLM providers, one set of NEAR standards.
          </p>
        </Reveal>
      </div>

      <div className="mt-16 md:mt-24 flex flex-col gap-4 md:gap-6">
        <Marquee>
          <Tiles items={PROVIDERS} />
        </Marquee>
        <Marquee reverse>
          <Tiles items={STANDARDS} />
        </Marquee>
      </div>
    </Section>
  );
}
