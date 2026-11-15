import Link from 'next/link';
import type { Metadata } from 'next';
import { EvidenceBadge } from '@/components/oracle/atlas/EvidenceLayer';
import styles from './atlas.module.css';

export const metadata: Metadata = { title: 'The Atlas — Divination' };

const DOORS = [
  {
    href: '/oracle/atlas/iching',
    kicker: 'THE BOOK OF CHANGES',
    title: 'I Ching',
    body: 'Sixty-four figures, their trigrams and their place in the turning year — with three thousand years of commentary that does not always agree.',
    go: 'Explore the 64 hexagrams →',
  },
  {
    href: '/oracle/atlas/tarot',
    kicker: 'IMAGE · ARCHETYPE · SEQUENCE',
    title: 'Tarot',
    body: 'Seventy-eight cards — a Renaissance game that became a language of images, then an esoteric system, then a mirror for psychology.',
    go: 'Explore the 78 cards →',
  },
  {
    href: '/oracle/atlas/runes',
    kicker: 'MARK · SOUND · SYMBOL',
    title: 'Runes',
    body: 'Twenty-four signs carved in stone and bone — an alphabet first, and an oracle much later.',
    go: 'Explore the 24 runes →',
  },
];

export default function AtlasPage() {
  return (
    <div className={styles.page}>
      <nav aria-label="Breadcrumb" className={styles.crumbs}>
        <Link href="/oracle">Divination</Link>
        <span aria-hidden="true">/</span>
        <span>The Atlas</span>
      </nav>

      <header style={{ marginTop: 28, display: 'grid', gap: 14 }}>
        <p className={styles.kicker}>The Atlas</p>
        <h1 style={{ margin: 0, color: '#f1eadf', fontSize: 'clamp(3rem, 6vw, 5.4rem)', fontWeight: 300, lineHeight: 0.95, letterSpacing: '-.02em' }}>
          Where the symbols come from.
        </h1>
        <p className={styles.lead}>
          Every symbol you meet in a reading has a history. The Atlas lays it out in layers — what
          is carved or written, what was reconstructed, what later traditions added, and what
          modern readers use today — and shows how strong the evidence is for each.
        </p>
      </header>

      <section className={styles.section} aria-labelledby="evidence-h">
        <div className={styles.sectionHead}>
          <h2 id="evidence-h">How to read the evidence</h2>
          <p className={styles.note}>Four bars: physical evidence. One bar: modern practice.</p>
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '14px 30px' }}>
          <li><EvidenceBadge kind="attested" /></li>
          <li><EvidenceBadge kind="reconstructed" /></li>
          <li><EvidenceBadge kind="later-tradition" /></li>
          <li><EvidenceBadge kind="esoteric-tradition" /></li>
          <li><EvidenceBadge kind="contemporary" /></li>
        </ul>
      </section>

      <section className={styles.section} aria-label="Traditions">
        <div className={styles.doors}>
          {DOORS.map((d) => (
            <Link key={d.href} href={d.href} className={styles.door}>
              <p className={styles.kicker}>{d.kicker}</p>
              <h2>{d.title}</h2>
              <p>{d.body}</p>
              <p className={styles.doorGo}>{d.go}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.panel}>
          <p>
            The Atlas teaches the traditions. It does not tell you what a symbol means for your life
            — that stays with you.
          </p>
          <div className={styles.actions}>
            <Link href="/oracle" className={styles.link}>Return to Divination →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
