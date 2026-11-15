import Link from 'next/link';
import type { Metadata } from 'next';
import { TAROT_HISTORY, listCards } from '@/lib/oracle/atlas/tarot';
import { AtlasHistory } from '@/components/oracle/atlas/AtlasHistory';
import styles from '../atlas.module.css';

export const metadata: Metadata = { title: 'Tarot — The Atlas' };

export default function TarotAtlasPage() {
  const { majors, suits } = listCards();

  return (
    <div className={styles.page}>
      <nav aria-label="Breadcrumb" className={styles.crumbs}>
        <Link href="/oracle">Divination</Link>
        <span aria-hidden="true">/</span>
        <Link href="/oracle/atlas">The Atlas</Link>
        <span aria-hidden="true">/</span>
        <span>Tarot</span>
      </nav>

      <header style={{ marginTop: 28, display: 'grid', gap: 14 }}>
        <p className={styles.kicker}>Image · archetype · sequence</p>
        <h1 style={{ margin: 0, color: '#f1eadf', fontSize: 'clamp(3rem, 6vw, 5.4rem)', fontWeight: 300, lineHeight: 0.95 }}>
          Tarot
        </h1>
        <p className={styles.lead}>
          Twenty-two trumps and fifty-six suit cards. Played as a game for three centuries before it
          was read as an oracle.
        </p>
        <div className={styles.actions}>
          <Link href="/oracle/tarot" className={styles.link}>Draw the cards →</Link>
        </div>
      </header>

      <section className={styles.section} aria-labelledby="history-h">
        <div className={styles.sectionHead}>
          <h2 id="history-h">From game to oracle</h2>
          <p className={styles.note}>Oldest layer first</p>
        </div>
        <AtlasHistory entries={TAROT_HISTORY} />
      </section>

      <section className={styles.section} aria-labelledby="majors-h">
        <div className={styles.sectionHead}>
          <h2 id="majors-h">The trumps</h2>
          <p className={styles.note}>Later called the Major Arcana</p>
        </div>
        <ul className={styles.grid}>
          {majors.map((c) => (
            <li key={c.id}>
              <Link href={`/oracle/atlas/tarot/${c.id}`} className={styles.tile}>
                <span className={styles.tileGlyph} aria-hidden="true">{c.label}</span>
                <span className={styles.tileName}>{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {suits.map((s) => (
        <section key={s.suit} className={styles.section} aria-labelledby={`suit-${s.suit}`}>
          <div className={styles.sectionHead}>
            <h2 id={`suit-${s.suit}`}>{s.label}</h2>
            <p className={styles.note}>Fourteen cards</p>
          </div>
          <ul className={styles.grid}>
            {s.cards.map((c) => (
              <li key={c.id}>
                <Link href={`/oracle/atlas/tarot/${c.id}`} className={styles.tile}>
                  <span className={styles.tileName}>{c.name}</span>
                  <span className={styles.tileMeta}>{c.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
