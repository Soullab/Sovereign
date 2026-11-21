/**
 * WS-STEP4 Package C — persistent, truthful reading receipts (design: IMPLEMENTATION-PROPOSAL v0.2 §C, REVIEW-PACKET-C2C3-R20;
 * R20 reviewer decisions 2026-11-20, all ACCEPT: show the writer what MAIA read · keep a small record · stop sending the rest).
 *
 * PURE. No database, no framework, safe to import in the browser (types) and on the server.
 *
 * C3 · readRecord — written once, inside the answer's own immutable `answer_provenance` row (no migration, no new store):
 *   { v: 1, supplied: [{ sectionId, digest }], notSupplied: [{ sectionId }] }   ids and body digests only, never text.
 *   `supplied: []` RECORDS "none supplied". Old rows are never backfilled.
 *
 * C2 · receipt — what the browser is given INSTEAD of raw provenance (no model, prompt hash, digests or section ids):
 *   evidence  recorded        readRecord present
 *             partial_legacy  only the older `suppliedSections` (written only when non-empty); omissions were not recorded
 *             not_recorded    neither: never shown as "none"
 *   Names are the CURRENT names (writerSectionLabel); a section no longer in the Work is "a section no longer in this Work"
 *   (R4: an erased section's heading is never resolved). textChangedSince compares the recorded digest with the current one.
 *
 * ⛔ A receipt is evidence of past access, NEVER permission to read again. Nothing here grants, loads for MAIA, or calls a model.
 */
import { writerSectionLabel } from './writerSectionLabel';

export interface ReadRecord {
  readonly v: 1;
  readonly supplied: readonly { sectionId: string; digest: string }[];
  readonly notSupplied: readonly { sectionId: string }[];
}

export function readRecordOf(
  supplied: readonly { id: string; digest: string }[],
  notSupplied: readonly string[],
): ReadRecord {
  return {
    v: 1,
    supplied: supplied.map((s) => ({ sectionId: s.id, digest: s.digest })),
    notSupplied: notSupplied.map((sectionId) => ({ sectionId })),
  };
}

export interface ReceiptSection { readonly name: string; readonly textChangedSince: boolean | 'unknown' }
export interface ReadingReceipt {
  readonly evidence: 'recorded' | 'partial_legacy' | 'not_recorded';
  readonly reading: 'none_supplied' | 'some_supplied' | 'unknown';
  /** The passage the writer was in, which reaches MAIA by its own path. */
  readonly current: ReceiptSection | null;
  readonly supplied: readonly ReceiptSection[];
  readonly notSupplied: readonly ReceiptSection[] | 'not_recorded';
}

/** What the server knows NOW about the writer's own sections (member-scoped by the caller). */
export interface SectionsNow {
  readonly heads: ReadonlyMap<string, { heading: string | null; position: number }>;
  readonly digests: ReadonlyMap<string, string>;
}

export const NO_LONGER_IN_WORK = 'a section no longer in this Work';

type Rec = Record<string, unknown>;
const isRec = (x: unknown): x is Rec => typeof x === 'object' && x !== null && !Array.isArray(x);
const idDigest = (x: unknown): { sectionId: string; digest: string | null } | null =>
  isRec(x) && typeof x.sectionId === 'string' ? { sectionId: x.sectionId, digest: typeof x.digest === 'string' ? x.digest : null } : null;

function present(sectionId: string, digest: string | null, now: SectionsNow): ReceiptSection {
  const head = now.heads.get(sectionId);
  if (!head) return { name: NO_LONGER_IN_WORK, textChangedSince: 'unknown' };
  const cur = now.digests.get(sectionId);
  return {
    name: writerSectionLabel(head) ?? NO_LONGER_IN_WORK,
    textChangedSince: digest && cur ? cur !== digest : 'unknown',
  };
}

/** Section ids a receipt for this provenance needs current names/digests for (so the caller loads only those). */
export function sectionIdsIn(provenance: unknown): string[] {
  if (!isRec(provenance)) return [];
  const ids = new Set<string>();
  const rr = isRec(provenance.readRecord) ? provenance.readRecord : null;
  for (const list of [rr?.supplied, rr?.notSupplied, provenance.suppliedSections]) {
    if (Array.isArray(list)) for (const x of list) { const d = idDigest(x); if (d) ids.add(d.sectionId); }
  }
  const locus = idDigest(provenance.locus);
  if (locus) ids.add(locus.sectionId);
  return [...ids];
}

export function receiptOf(provenance: unknown, now: SectionsNow): ReadingReceipt {
  const p = isRec(provenance) ? provenance : {};
  const locus = idDigest(p.locus);
  const current = locus ? present(locus.sectionId, locus.digest, now) : null;
  const rr = isRec(p.readRecord) && p.readRecord.v === 1 ? p.readRecord : null;
  if (rr) {
    const supplied = (Array.isArray(rr.supplied) ? rr.supplied : []).map(idDigest).filter(Boolean) as { sectionId: string; digest: string | null }[];
    const omitted = (Array.isArray(rr.notSupplied) ? rr.notSupplied : []).map(idDigest).filter(Boolean) as { sectionId: string; digest: string | null }[];
    return {
      evidence: 'recorded',
      reading: supplied.length > 0 ? 'some_supplied' : 'none_supplied',
      current,
      supplied: supplied.map((s) => present(s.sectionId, s.digest, now)),
      notSupplied: omitted.map((s) => ({ name: present(s.sectionId, null, now).name, textChangedSince: 'unknown' as const })),
    };
  }
  const legacy = (Array.isArray(p.suppliedSections) ? p.suppliedSections : []).map(idDigest).filter(Boolean) as { sectionId: string; digest: string | null }[];
  if (legacy.length > 0) {
    return { evidence: 'partial_legacy', reading: 'some_supplied', current, supplied: legacy.map((s) => present(s.sectionId, s.digest, now)), notSupplied: 'not_recorded' };
  }
  // ⛔ No record of what was supplied: never "none".
  return { evidence: 'not_recorded', reading: 'unknown', current, supplied: [], notSupplied: 'not_recorded' };
}

const named = (s: ReceiptSection) => s.textChangedSince === true ? `${s.name} (changed since)` : s.name;

/** The one line the writer reads under an answer. Never claims more than the receipt records. */
export function receiptSentence(r: ReadingReceipt): string {
  if (r.evidence === 'not_recorded') return 'What MAIA read for this answer was not recorded.';
  if (r.reading === 'none_supplied') {
    return r.current
      ? `For this answer MAIA had the passage you were in (${named(r.current)}) and none of your other saved work.`
      : 'For this answer MAIA read none of your saved work.';
  }
  const list = r.supplied.map(named).join(', ');
  let s = `For this answer MAIA read your saved ${r.supplied.length === 1 ? 'section' : 'sections'}: ${list}.`;
  if (Array.isArray(r.notSupplied) && r.notSupplied.length > 0) {
    s += ` Left out for length: ${(r.notSupplied as ReceiptSection[]).map((x) => x.name).join(', ')}.`;
  }
  return s;
}
