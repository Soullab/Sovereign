/**
 * One layer of meaning in an Atlas entry, with its evidence strength shown
 * as four bars and a label. Strongest layers get the firmest border.
 */
import { EVIDENCE, type AtlasLayer, type EvidenceClass } from '@/lib/oracle/atlas/evidence';
import styles from '@/app/oracle/atlas/atlas.module.css';

export function EvidenceBadge({ kind }: { kind: EvidenceClass }) {
  const { label, strength } = EVIDENCE[kind];
  return (
    <span className={styles.evidence}>
      <span className={styles.bars} aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <i key={n} className={n <= strength ? styles.barOn : undefined} />
        ))}
      </span>
      {label}
      <span className={styles.srOnly}>, evidence strength {strength} of 4</span>
    </span>
  );
}

export function EvidenceLayer({ layer, index }: { layer: AtlasLayer; index: number }) {
  const strength = EVIDENCE[layer.evidence].strength;
  return (
    <li className={styles.layer} data-strength={strength}>
      <div className={styles.layerKey}>
        <p className={styles.layerTitle}>
          <span>{index + 1}</span> {layer.title}
        </p>
        <EvidenceBadge kind={layer.evidence} />
      </div>
      <div className={styles.layerBody}>
        <p>{layer.body}</p>
        {layer.tags && layer.tags.length > 0 && (
          <ul className={styles.tags} aria-label="Terms">
            {layer.tags.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
        {layer.source && <p className={styles.source}>{layer.source}</p>}
      </div>
    </li>
  );
}
