import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getRuneAtlasEntry, listRunes } from '@/lib/oracle/atlas/runes';
import { EvidenceLayer } from '@/components/oracle/atlas/EvidenceLayer';
import styles from '../../atlas.module.css';

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return listRunes().map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const e = getRuneAtlasEntry(slug);
  return { title: e ? `${e.name} — Rune Atlas` : 'Rune Atlas' };
}

export default async function RuneEntryPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const e = getRuneAtlasEntry(slug);
  if (!e) notFound();

  return (
    <div className={styles.page}>
      <nav aria-label="Breadcrumb" className={styles.crumbs}>
        <Link href="/oracle">Divination</Link>
        <span aria-hidden="true">/</span>
        <Link href="/oracle/atlas">The Atlas</Link>
        <span aria-hidden="true">/</span>
        <Link href="/oracle/atlas/runes">Runes</Link>
        <span aria-hidden="true">/</span>
        <span>{e.name}</span>
      </nav>

      <section className={styles.hero}>
        <div className={styles.glyph} role="img" aria-label={`The rune ${e.name}`}>
          {e.symbol}
        </div>
        <div>
          <p className={styles.kicker}>Elder Futhark · rune {e.position} of 24</p>
          <h1>{e.name}</h1>
          <p className={styles.lead}>
            Its sound, its name, and its divinatory meaning come from different centuries and
            with very different evidence. The layers below keep them apart, surest first.
          </p>
          <ul className={styles.facts}>
            <li>Sound <b>“{e.transliteration}”</b></li>
            <li>Ætt <b>{e.aett} of 3</b></li>
            <li>In use <b>c. 150–750 CE</b></li>
          </ul>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="layers-h">
        <div className={styles.sectionHead}>
          <h2 id="layers-h">Layers of meaning</h2>
          <p className={styles.note}>Four bars is direct physical evidence; one is modern practice.</p>
        </div>
        <ol className={styles.layers}>
          {e.layers.map((layer, i) => (
            <EvidenceLayer key={layer.id} layer={layer} index={i} />
          ))}
        </ol>
        {!e.hasExemplarLayers && (
          <p className={styles.note} style={{ marginTop: 16 }}>
            The rune poems and myth for {e.name} have not been written and sourced for the Atlas yet,
            so they are left out rather than filled with modern lore.
          </p>
        )}
      </section>

      <nav aria-label="Neighbouring runes" className={styles.actions} style={{ justifyContent: 'space-between', marginTop: 32 }}>
        <Link href={`/oracle/atlas/runes/${e.prev.slug}`} className={styles.link}>← {e.prev.symbol} {e.prev.name}</Link>
        <Link href="/oracle/runes" className={styles.link}>Cast the runes</Link>
        <Link href={`/oracle/atlas/runes/${e.next.slug}`} className={styles.link}>{e.next.name} {e.next.symbol} →</Link>
      </nav>
    </div>
  );
}
