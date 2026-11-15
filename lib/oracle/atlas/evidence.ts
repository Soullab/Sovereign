/**
 * Evidence classes for the Divination Atlas.
 *
 * Every layer of meaning the Atlas shows carries one of these, so a member can
 * see how strong a claim is as well as what it says. Strength runs from 4
 * (physical or archaeological evidence) to 1 (modern practice).
 */
export type EvidenceClass =
  | 'attested'
  | 'archaeological'
  | 'documented'
  | 'scholarly-consensus'
  | 'reconstructed'
  | 'attribution-disputed'
  | 'later-tradition'
  | 'literary'
  | 'esoteric-tradition'
  | 'traditional'
  | 'contemporary';

export const EVIDENCE: Record<EvidenceClass, { label: string; strength: 1 | 2 | 3 | 4 }> = {
  attested: { label: 'Attested', strength: 4 },
  archaeological: { label: 'Archaeological', strength: 4 },
  documented: { label: 'Documented', strength: 3 },
  'scholarly-consensus': { label: 'Scholarly consensus', strength: 3 },
  reconstructed: { label: 'Reconstructed', strength: 3 },
  'attribution-disputed': { label: 'Attribution disputed', strength: 2 },
  'later-tradition': { label: 'Later tradition', strength: 2 },
  literary: { label: 'Literary', strength: 2 },
  'esoteric-tradition': { label: 'Esoteric tradition', strength: 2 },
  traditional: { label: 'Traditional teaching', strength: 2 },
  contemporary: { label: 'Contemporary practice', strength: 1 },
};

/** One layer of meaning in an Atlas entry. */
export interface AtlasLayer {
  id: string;
  title: string;
  evidence: EvidenceClass;
  body: string;
  /** Short list of terms shown as tags, e.g. keywords or imagery. */
  tags?: string[];
  source?: string;
}

export interface AtlasHistoryEntry {
  period: string;
  title: string;
  body: string;
  evidence: EvidenceClass;
}
