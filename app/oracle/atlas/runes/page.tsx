import Link from 'next/link';
import type { Metadata } from 'next';
import { RUNE_HISTORY, listRunes } from '@/lib/oracle/atlas/runes';
import { AtlasHistory } from '@/components/oracle/atlas/AtlasHistory';
import styles from '../atlas.module.css';

export const metadata: Metadata = { title: 'Runes — The Atlas' };

const AETTIR = ['First ætt', 'Second ætt', 'Third ætt'];

export default function RuneAtlasPage() {
  const runes = listRunes();

  return (
    <div className={styles.page}>
      <nav aria-label="Breadcrumb" className={styles.crumbs}>
        <Link href="/oracle">Divination</Link>
        <span aria-hidden="true">/</span>
        <Link href="/oracle/atlas">The Atlas</Link>
        <span aria-hidden="true">/</span>
        <span>Runes</span>
      </nav>

      <header style={{ marginTop: 28, display: 'grid', gap: 14 }}>
        <p className={styles.kicker}>Elder Futhark</p>
        <h1 style={{ margin: 0, color: '#f1eadf', fontSize: 'clamp(3rem, 6vw, 5.4rem)', fontWeight: 300, lineHeight: 0.95 }}>
          Runes
        </h1>
        <p className={styles.lead}>
          Twenty-four signs, named for their first sounds — f, u, þ, a, r, k — and carved as an
          alphabet for six centuries before anyone wrote down what they meant.
        </p>
        <div className={styles.actions}>
          <Link href="/oracle/runes" className={styles.link}>Cast the runes →</Link>
        </div>
      </header>

      <section className={styles.section} aria-labelledby="history-h">
        <div className={styles.sectionHead}>
          <h2 id="history-h">From inscription to oracle</h2>
          <p className={styles.note}>Oldest layer first</p>
        </div>
        <AtlasHistory entries={RUNE_HISTORY} />
      </section>

      {AETTIR.map((label, a) => (
        <section key={label} className={styles.section} aria-labelledby={`aett-${a}`}>
          <div className={styles.sectionHead}>
            <h2 id={`aett-${a}`}>{label}</h2>
            <p className={styles.note}>Runes {a * 8 + 1}–{a * 8 + 8}</p>
          </div>
          <ul className={styles.grid}>
            {runes.filter((r) => r.aett === a + 1).map((r) => (
              <li key={r.slug}>
                <Link href={`/oracle/atlas/runes/${r.slug}`} className={styles.tile}>
                  <span className={styles.tileGlyph} aria-hidden="true">{r.symbol}</span>
                  <span className={styles.tileName}>{r.name}</span>
                  <span className={styles.tileMeta}>{r.position} · “{r.transliteration}”</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
