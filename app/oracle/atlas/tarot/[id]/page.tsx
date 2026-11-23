import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ALL_CARDS, getTarotAtlasEntry } from '@/lib/oracle/atlas/tarot';
import { EvidenceLayer } from '@/components/oracle/atlas/EvidenceLayer';
import { AskMaia } from '@/components/oracle/atlas/AskMaia';
import styles from '../../atlas.module.css';

type Params = { id: string };

export function generateStaticParams(): Params[] {
  return ALL_CARDS.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const e = getTarotAtlasEntry(id);
  return { title: e ? `${e.name} — Tarot Atlas` : 'Tarot Atlas' };
}

export default async function TarotCardPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const e = getTarotAtlasEntry(id);
  if (!e) notFound();

  return (
    <div className={styles.page}>
      <nav aria-label="Breadcrumb" className={styles.crumbs}>
        <Link href="/oracle">Divination</Link>
        <span aria-hidden="true">/</span>
        <Link href="/oracle/atlas">The Atlas</Link>
        <span aria-hidden="true">/</span>
        <Link href="/oracle/atlas/tarot">Tarot</Link>
        <span aria-hidden="true">/</span>
        <span>{e.name}</span>
      </nav>

      <section className={styles.hero}>
        <div className={styles.glyph} aria-hidden="true" style={{ fontSize: 'clamp(3rem, 7vw, 5.5rem)' }}>
          {e.label}
        </div>
        <div>
          <p className={styles.kicker}>{e.arcana === 'major' ? 'Trump · Major Arcana' : `${e.suit} · suit card`}</p>
          <h1>{e.name}</h1>
          <p className={styles.lead}>
            A card’s place in the deck is centuries old; its esoteric correspondences are from the
            1880s; most of its divinatory meanings are modern. The layers below keep them apart.
          </p>
          <AskMaia
            prominent
            tradition="Tarot"
            subject={e.name}
            body={e.arcana === 'major' ? `${e.name}, a trump of the Major Arcana.` : `${e.name}, a card of the suit of ${e.suit}.`}
          />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="layers-h">
        <div className={styles.sectionHead}>
          <h2 id="layers-h">Layers of meaning</h2>
          <p className={styles.note}>Four bars is direct physical evidence; one is modern practice.</p>
        </div>
        <ol className={styles.layers}>
          {e.layers.map((layer, i) => (
            <EvidenceLayer key={layer.id} layer={layer} index={i} ask={{ tradition: 'Tarot', subject: e.name }} />
          ))}
        </ol>
      </section>

      <nav aria-label="Neighbouring cards" className={styles.actions} style={{ justifyContent: 'space-between', marginTop: 32 }}>
        <Link href={`/oracle/atlas/tarot/${e.prev.id}`} className={styles.link}>← {e.prev.name}</Link>
        <Link href="/oracle/tarot" className={styles.link}>Draw the cards</Link>
        <Link href={`/oracle/atlas/tarot/${e.next.id}`} className={styles.link}>{e.next.name} →</Link>
      </nav>
    </div>
  );
}
