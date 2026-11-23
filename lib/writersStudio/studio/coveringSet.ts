/**
 * WS-RELATIONAL-ARCHITECTURE §20 — rereading only what changed. (Design: docs/programme/WS-RELATIONAL-ARCHITECTURE_DESIGN_CONCEPT_DRAFT_
 * 2026-11-11.md §10 and §20; lane authorized by the founder 2026-11-17.)
 *
 * Before this, the whole-book letter accepted only eight readings of the CURRENT revision over the whole draft, so any edit made every
 * lens stale and the next pass paid for the whole book again. Now the synthesis accepts, per lens, a SET of readings that together cover
 * every section of the current draft at body depth, each section by a reading whose frozen digest equals the section's current text.
 *
 * Laws (each a falsifier in __tests__/coveringSet.test.ts):
 *  - A section with no current reading, for any lens, refuses the set (`section_not_covered`). Nothing is filled in or assumed.
 *  - A stale digest never covers: "covered" is digest equality with the current text, the same rule as the coverage map (step 1).
 *  - Readings of different drafts are never mixed (`reading_of_another_draft`). Readings of earlier REVISIONS of the same draft are the
 *    point: a section unchanged since then still matches its digest.
 *  - Per lens and section, the NEWEST matching reading owns the section. An observation is kept only if every section it cites is owned
 *    by its own reading; an observation citing changed (or deleted) text never reaches the letter. An observation that cites no section
 *    is kept only from a reading that owns the whole current draft for its lens.
 *  - A reading that owns nothing is refused (`reading_contributes_nothing`): the set says exactly what the letter rests on.
 * Pure: ids, digests and depths in; no prose.
 */
import { sectionDigest } from '@/lib/manuscript/development/coverageMap';

export interface CoverReading {
  id: string;
  lens: string;
  draftId: string;
  frozenAt: string;
  /** read_state.sections[id].digest */
  digests: Readonly<Record<string, string | undefined>>;
  /** coverage.sections[id]: 'body' | 'position' */
  depths: Readonly<Record<string, string | undefined>>;
}
export interface LiveSection { id: string; text: string }

export interface LensPlan {
  /** section id -> the newest reading of this lens that read it at body depth with its current digest */
  owners: Record<string, string>;
  /** current sections no reading of this lens covers */
  missing: string[];
  /** reading ids that own at least one section, in order of first ownership */
  contributing: string[];
}

/** Pure. Which sections of the current draft this lens's readings still cover, and which must be read. */
export function planLens(draftId: string, live: readonly LiveSection[], readings: readonly CoverReading[]): LensPlan {
  const own = readings.filter((r) => r.draftId === draftId);
  const owners: Record<string, string> = {};
  const missing: string[] = [];
  const contributing: string[] = [];
  for (const s of live) {
    const digest = sectionDigest(s.text);
    let best: CoverReading | null = null;
    for (const r of own) {
      if (r.depths[s.id] !== 'body' || r.digests[s.id] !== digest) continue;
      if (!best || r.frozenAt > best.frozenAt) best = r;
    }
    if (!best) { missing.push(s.id); continue; }
    owners[s.id] = best.id;
    if (!contributing.includes(best.id)) contributing.push(best.id);
  }
  return { owners, missing, contributing };
}

export type CoverRefusal =
  | 'draft_empty' | 'reading_of_another_draft' | 'lens_missing' | 'lens_not_expected' | 'section_not_covered' | 'reading_contributes_nothing';

export interface CoveringSet {
  /** lens -> plan (every plan has missing = []) */
  lenses: Record<string, LensPlan>;
  liveIds: readonly string[];
}

export type CoverOutcome =
  | { ok: true; set: CoveringSet }
  | { ok: false; refusal: CoverRefusal; lens?: string; sectionId?: string; readingId?: string };

/** Pure. Does this set of readings, together, cover every section of the current draft for every expected lens? */
export function checkCoveringSet(input: {
  draftId: string;
  live: readonly LiveSection[];
  lenses: readonly string[];
  readings: readonly CoverReading[];
}): CoverOutcome {
  if (input.live.length === 0) return { ok: false, refusal: 'draft_empty' };
  const other = input.readings.find((r) => r.draftId !== input.draftId);
  if (other) return { ok: false, refusal: 'reading_of_another_draft', readingId: other.id };
  const unexpected = input.readings.find((r) => !input.lenses.includes(r.lens));
  if (unexpected) return { ok: false, refusal: 'lens_not_expected', lens: unexpected.lens, readingId: unexpected.id };
  const lenses: Record<string, LensPlan> = {};
  for (const lens of input.lenses) {
    const mine = input.readings.filter((r) => r.lens === lens);
    if (mine.length === 0) return { ok: false, refusal: 'lens_missing', lens };
    const plan = planLens(input.draftId, input.live, mine);
    if (plan.missing.length > 0) return { ok: false, refusal: 'section_not_covered', lens, sectionId: plan.missing[0] };
    const idle = mine.find((r) => !plan.contributing.includes(r.id));
    if (idle) return { ok: false, refusal: 'reading_contributes_nothing', lens, readingId: idle.id };
    lenses[lens] = plan;
  }
  return { ok: true, set: { lenses, liveIds: input.live.map((s) => s.id) } };
}

/** Pure. May this observation (of `readingId`, lens `lens`, citing `sectionIds`) reach the letter? */
export function keepObservation(set: CoveringSet, readingId: string, lens: string, sectionIds: readonly string[]): boolean {
  const plan = set.lenses[lens];
  if (!plan) return false;
  if (sectionIds.length === 0) return set.liveIds.every((id) => plan.owners[id] === readingId);
  return sectionIds.every((id) => plan.owners[id] === readingId);
}

/** The reading's per-section digests and depths, as the covering set needs them. */
export function coverReadingOf(r: {
  id: string; scope: { commissionedLens: string }; readState: { draftId: string; sections: Readonly<Record<string, { digest: string }>> };
  coverage: { sections: Readonly<Record<string, string>> }; provenance: { frozenAt: string };
}): CoverReading {
  const digests: Record<string, string> = {};
  for (const [id, st] of Object.entries(r.readState.sections)) digests[id] = st.digest;
  return { id: r.id, lens: r.scope.commissionedLens, draftId: r.readState.draftId, frozenAt: r.provenance.frozenAt, digests, depths: { ...r.coverage.sections } };
}
