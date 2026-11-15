import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getHexagram } from '@/lib/divination/iching/hexagrams';
import { LivingExplorer } from '@/components/oracle/iching/LivingExplorer';
import { AskMaia } from '@/components/oracle/atlas/AskMaia';
import { getExplorerEntry } from '@/lib/oracle/ichingExplorer';
import styles from '../../atlas.module.css';

type Params = { number: string };

export function generateStaticParams(): Params[] {
  return Array.from({ length: 64 }, (_, i) => ({ number: String(i + 1) }));
}

const glyph = (n: number) => String.fromCodePoint(0x4dc0 + n - 1);

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { number } = await params;
  const h = getHexagram(Number(number));
  return { title: h ? `${h.number} · ${h.englishName ?? h.name} — I Ching Atlas` : 'I Ching Atlas' };
}

export default async function HexagramAtlasPage({ params }: { params: Promise<Params> }) {
  const { number } = await params;
  const n = Number(number);
  const h = Number.isInteger(n) ? getHexagram(n) : undefined;
  if (!h) notFound();

  const entry = getExplorerEntry(n);
  const upper = entry?.upper;
  const lower = entry?.lower;
  const prev = n === 1 ? 64 : n - 1;
  const next = n === 64 ? 1 : n + 1;
  const subject = `Hexagram ${n} · ${h.chineseName ?? ''} ${h.englishName ?? h.name}`.replace(/\s+/g, ' ');

  return (
    <div className={styles.page}>
      <nav aria-label="Breadcrumb" className={styles.crumbs}>
        <Link href="/oracle">Divination</Link>
        <span aria-hidden="true">/</span>
        <Link href="/oracle/atlas">The Atlas</Link>
        <span aria-hidden="true">/</span>
        <Link href="/oracle/atlas/iching">I Ching</Link>
        <span aria-hidden="true">/</span>
        <span>{n}</span>
      </nav>

      <section className={styles.hero}>
        <div className={styles.glyph} role="img" aria-label={`Hexagram ${n}`}>
          {glyph(n)}
        </div>
        <div>
          <p className={styles.kicker}>Hexagram {n} of 64</p>
          <h1>
            <span lang="zh" style={{ color: '#e2cfb0' }}>{h.chineseName}</span> {h.englishName ?? h.name}
          </h1>
          <p className={styles.lead}>{h.name}</p>
          <ul className={styles.facts}>
            {upper && <li>Upper trigram <b>{upper.symbol} {upper.image}</b></li>}
            {lower && <li>Lower trigram <b>{lower.symbol} {lower.image}</b></li>}
          </ul>
          <AskMaia
            prominent
            tradition="I Ching"
            subject={subject}
            label={`Ask MAIA about ${h.englishName ?? h.name}`}
            body={[
              upper && lower ? `${upper.image} over ${lower.image}.` : '',
              h.judgment ? `Judgment: ${h.judgment}` : '',
            ].filter(Boolean).join('\n')}
          />
        </div>
      </section>

      <section className={styles.section} aria-label="Explorer">
        <LivingExplorer hexagramNumber={n} askMaia={{ subject }} />
      </section>

      <nav aria-label="Neighbouring hexagrams" className={styles.actions} style={{ justifyContent: 'space-between', marginTop: 32 }}>
        <Link href={`/oracle/atlas/iching/${prev}`} className={styles.link}>← {prev}</Link>
        <Link href="/oracle/iching" className={styles.link}>Consult the I Ching</Link>
        <Link href={`/oracle/atlas/iching/${next}`} className={styles.link}>{next} →</Link>
      </nav>
    </div>
  );
}
