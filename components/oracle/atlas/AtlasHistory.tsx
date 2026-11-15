/** A tradition's history, oldest first, each entry with its evidence class. */
import type { AtlasHistoryEntry } from '@/lib/oracle/atlas/evidence';
import { EvidenceBadge } from './EvidenceLayer';
import styles from '@/app/oracle/atlas/atlas.module.css';

export function AtlasHistory({ entries }: { entries: AtlasHistoryEntry[] }) {
  return (
    <ol className={styles.timeline}>
      {entries.map((h) => (
        <li key={h.period + h.title}>
          <p className={styles.period}>{h.period}</p>
          <div style={{ display: 'grid', gap: 8 }}>
            <p>
              <b>{h.title}.</b> {h.body}
            </p>
            <EvidenceBadge kind={h.evidence} />
          </div>
        </li>
      ))}
    </ol>
  );
}
