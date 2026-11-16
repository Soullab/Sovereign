import Link from 'next/link';
import type { Metadata } from 'next';
import { getHexagram } from '@/lib/divination/iching/hexagrams';
import { ICHING_HISTORY } from '@/lib/oracle/ichingExplorer';
import { AtlasHistory } from '@/components/oracle/atlas/AtlasHistory';
import styles from '../atlas.module.css';

export const metadata: Metadata = { title: 'I Ching — The Atlas' };

/** Unicode hexagram symbols run U+4DC0–U+4DFF in King Wen order. */
const hexagramGlyph = (n: number) => String.fromCodePoint(0x4dc0 + n - 1);

export default function IChingAtlasPage() {
  const hexagrams = Array.from({ length: 64 }, (_, i) => getHexagram(i + 1)).filter(Boolean);

  return (
    <div className={styles.page}>
      <nav aria-label="Breadcrumb" className={styles.crumbs}>
        <Link href="/oracle">Divination</Link>
        <span aria-hidden="true">/</span>
        <Link href="/oracle/atlas">The Atlas</Link>
        <span aria-hidden="true">/</span>
        <span>I Ching</span>
      </nav>

      <header style={{ marginTop: 28, display: 'grid', gap: 14 }}>
        <p className={styles.kicker}>The Book of Changes · 易經</p>
        <h1 style={{ margin: 0, color: '#f1eadf', fontSize: 'clamp(3rem, 6vw, 5.4rem)', fontWeight: 300, lineHeight: 0.95 }}>
          I Ching
        </h1>
        <p className={styles.lead}>
          A diviner’s manual that became a philosophy of change. Each of the 64 figures stacks six
          lines, solid or broken, into two trigrams.
        </p>
        <div className={styles.actions}>
          <Link href="/oracle/iching" className={styles.link}>Consult the I Ching →</Link>
        </div>
      </header>

      <section className={styles.section} aria-labelledby="history-h">
        <div className={styles.sectionHead}>
          <h2 id="history-h">How the text grew</h2>
          <p className={styles.note}>Oldest layer first</p>
        </div>
        <AtlasHistory entries={ICHING_HISTORY} />
      </section>

      <section className={styles.section} aria-labelledby="hex-h">
        <div className={styles.sectionHead}>
          <h2 id="hex-h">The 64 hexagrams</h2>
          <p className={styles.note}>In the received (King Wen) order</p>
        </div>
        <ul className={styles.grid}>
          {hexagrams.map((h) => (
            <li key={h!.number}>
              <Link href={`/oracle/atlas/iching/${h!.number}`} className={styles.tile}>
                <span className={styles.tileGlyph} aria-hidden="true">{hexagramGlyph(h!.number)}</span>
                <span className={styles.tileName}>{h!.englishName ?? h!.name}</span>
                <span className={styles.tileMeta}>
                  {h!.number} · <span lang="zh">{h!.chineseName}</span> {h!.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
