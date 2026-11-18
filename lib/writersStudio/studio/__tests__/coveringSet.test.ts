/**
 * §20 — rereading only what changed. The falsifiers named in the design (a section with no current reading; a stale digest; two
 * readings of different drafts mixed together), plus the observation filter that keeps changed text out of a letter presented as
 * current. TESTING-01 §0: each falsifier is run against the real check AND against deliberately wrong versions; every wrong version
 * must be caught by at least one falsifier, or the suite proves nothing.
 */
import { createHash } from 'node:crypto';
import { checkCoveringSet, keepObservation, planLens, type CoverReading, type CoverOutcome, type CoveringSet } from '@/lib/writersStudio/studio/coveringSet';
import { sectionDigest } from '@/lib/manuscript/development/coverageMap';

const d = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const LIVE = [{ id: 's1', text: 'one' }, { id: 's2', text: 'two, edited' }, { id: 's3', text: 'three' }];
const LENSES = ['arc', 'voice'];
const r = (id: string, lens: string, texts: Record<string, string>, at: string, opts: { draft?: string; depth?: 'body' | 'position' } = {}): CoverReading => ({
  id, lens, draftId: opts.draft ?? 'D', frozenAt: at,
  digests: Object.fromEntries(Object.entries(texts).map(([k, v]) => [k, d(v)])),
  depths: Object.fromEntries(Object.keys(texts).map((k) => [k, opts.depth ?? 'body'])),
});
/** The book before s2 was edited, read whole by both lenses; then s2 reread alone by both. */
const OLD = (lens: string) => r(`old-${lens}`, lens, { s1: 'one', s2: 'two', s3: 'three' }, '2026-11-10T00:00:00Z');
const NEW = (lens: string) => r(`new-${lens}`, lens, { s2: 'two, edited' }, '2026-11-17T00:00:00Z');

type Check = (i: Parameters<typeof checkCoveringSet>[0]) => CoverOutcome;
type Keep = (set: CoveringSet, readingId: string, lens: string, sectionIds: readonly string[]) => boolean;

/** Every falsifier; returns the names of those the implementation fails. */
function falsify(check: Check, keep: Keep): string[] {
  const failed: string[] = [];
  const t = (name: string, ok: boolean) => { if (!ok) failed.push(name); };
  const base = { draftId: 'D', live: LIVE, lenses: LENSES };

  // a section with no current reading: only the old whole readings, s2 has changed since
  const stale = check({ ...base, readings: LENSES.map(OLD) });
  t('a section with no current reading is refused', !stale.ok && stale.refusal === 'section_not_covered' && stale.sectionId === 's2');
  // a stale digest never covers, even when it is the only reading of that section and the newest
  const staleNewest = check({ ...base, readings: [...LENSES.map(OLD), r('x-arc', 'arc', { s2: 'two' }, '2026-11-18T00:00:00Z'), NEW('voice')] });
  t('a stale digest does not cover', !staleNewest.ok && staleNewest.refusal !== 'reading_of_another_draft');
  // a position-only reading of the changed section does not cover it
  const position = check({ ...base, readings: [...LENSES.map(OLD), ...LENSES.map((l) => r(`p-${l}`, l, { s2: 'two, edited' }, '2026-11-17T00:00:00Z', { depth: 'position' }))] });
  t('position depth does not cover', !position.ok);
  // two readings of different drafts mixed together
  const mixed = check({ ...base, readings: [...LENSES.map(OLD), NEW('arc'), { ...NEW('voice'), draftId: 'OTHER' }] });
  t('readings of another draft are refused', !mixed.ok && mixed.refusal === 'reading_of_another_draft');
  // a lens with no reading at all
  const lensless = check({ ...base, readings: [OLD('arc'), NEW('arc')] });
  t('a missing lens is refused', !lensless.ok);
  // the lawful set: old whole readings + the changed section reread
  const good = check({ ...base, readings: [...LENSES.map(OLD), ...LENSES.map(NEW)] });
  t('old unchanged sections + the reread changed one are accepted', good.ok);
  if (good.ok) {
    t('the new reading owns the changed section', good.set.lenses.arc!.owners.s2 === 'new-arc');
    t('the old reading owns the unchanged sections', good.set.lenses.arc!.owners.s1 === 'old-arc' && good.set.lenses.arc!.owners.s3 === 'old-arc');
    t('an old observation about unchanged text is kept', keep(good.set, 'old-arc', 'arc', ['s1', 's3']));
    t('⭐ an old observation about CHANGED text never reaches the letter', !keep(good.set, 'old-arc', 'arc', ['s2']));
    t('⭐ an old observation spanning changed and unchanged text is dropped', !keep(good.set, 'old-arc', 'arc', ['s1', 's2']));
    t('the new observation about the changed section is kept', keep(good.set, 'new-arc', 'arc', ['s2']));
    t('an observation citing a deleted section is dropped', !keep(good.set, 'old-arc', 'arc', ['s9']));
    t('a whole-work observation from a partial owner is dropped', !keep(good.set, 'old-arc', 'arc', []));
    t('an observation is judged under its own lens', !keep(good.set, 'new-voice', 'arc', ['s2']));
  }
  // nothing changed: the classic set (one whole current reading per lens) still works, and whole-work observations survive
  const classic = check({ ...base, live: [{ id: 's1', text: 'one' }, { id: 's2', text: 'two' }, { id: 's3', text: 'three' }], readings: LENSES.map(OLD) });
  t('the classic whole current set is accepted', classic.ok);
  if (classic.ok) t('a whole-work observation from a whole current reading is kept', keep(classic.set, 'old-arc', 'arc', []));
  // two current readings of one section: the newest owns it, and the older one's observation there is not counted twice
  const overlap = check({ ...base, readings: [...LENSES.map(OLD), r('new2-arc', 'arc', { s1: 'one', s2: 'two, edited' }, '2026-11-17T00:00:00Z'), NEW('voice')] });
  t('overlapping current readings are accepted', overlap.ok);
  if (overlap.ok) {
    t('⭐ the newest current reading owns a section two readings cover', overlap.set.lenses.arc!.owners.s1 === 'new2-arc');
    t('⭐ the older reading\'s observation on that section is not counted twice', !keep(overlap.set, 'old-arc', 'arc', ['s1']) && keep(overlap.set, 'old-arc', 'arc', ['s3']));
  }
  // a reading that owns nothing is refused, so the set says exactly what the letter rests on
  const idle = check({ ...base, readings: [...LENSES.map(OLD), ...LENSES.map(NEW), r('idle-arc', 'arc', { s2: 'two' }, '2026-11-12T00:00:00Z')] });
  t('a reading that contributes nothing is refused', !idle.ok && idle.refusal === 'reading_contributes_nothing');
  return failed;
}

describe('§20 the covering set: the real check passes every falsifier', () => {
  it('⭐ zero falsifiers fail against the real implementation', () => {
    expect(falsify(checkCoveringSet, keepObservation)).toEqual([]);
  });
  it('the digest is the coverage map\'s digest (one rule for "read")', () => {
    expect(sectionDigest('abc')).toBe(d('abc'));
  });
  it('planLens names exactly the sections to reread', () => {
    const plan = planLens('D', LIVE, [OLD('arc')]);
    expect(plan.missing).toEqual(['s2']);
    expect(plan.contributing).toEqual(['old-arc']);
    expect(planLens('D', LIVE, []).missing).toEqual(['s1', 's2', 's3']);
    expect(planLens('D', LIVE, [{ ...OLD('arc'), draftId: 'OTHER' }]).missing).toEqual(['s1', 's2', 's3']);
  });
});

describe('§20 defeat candidates (TESTING-01 §0): each deliberately wrong version is caught', () => {
  const ignoreDigest: Check = (i) => checkCoveringSet({ ...i, readings: i.readings.map((x) => ({ ...x, digests: Object.fromEntries(i.live.map((s) => [s.id, d(s.text)])) })) });
  const ignoreDepth: Check = (i) => checkCoveringSet({ ...i, readings: i.readings.map((x) => ({ ...x, depths: Object.fromEntries(Object.keys(x.depths).map((k) => [k, 'body'])) })) });
  const mixDrafts: Check = (i) => checkCoveringSet({ ...i, readings: i.readings.map((x) => ({ ...x, draftId: i.draftId })) });
  const lenientMissing: Check = (i) => { const o = checkCoveringSet(i); return !o.ok && o.refusal === 'section_not_covered' ? checkCoveringSet({ ...i, live: i.live.filter((s) => s.id !== o.sectionId) }) : o; };
  const keepAll: Keep = () => true;
  const keepAnyOwned: Keep = (set, id, lens, ids) => ids.some((s) => set.lenses[lens]?.owners[s] === id);
  const oldestOwns: Check = (i) => checkCoveringSet({ ...i, readings: i.readings.map((x) => ({ ...x, frozenAt: String(9e15 - Date.parse(x.frozenAt)).padStart(20, '0') })) });

  it.each([
    ['ignores the digest (a stale reading covers)', ignoreDigest, keepObservation],
    ['ignores depth (position-only covers)', ignoreDepth, keepObservation],
    ['mixes drafts', mixDrafts, keepObservation],
    ['skips an uncovered section instead of refusing', lenientMissing, keepObservation],
    ['keeps every observation, stale ones included', checkCoveringSet, keepAll],
    ['keeps an observation if any one of its sections is current', checkCoveringSet, keepAnyOwned],
    ['lets the oldest matching reading own a section', oldestOwns, keepObservation],
  ] as const)('⭐ wrong version caught: %s', (_name, check, keep) => {
    expect(falsify(check as Check, keep as Keep).length).toBeGreaterThan(0);
  });
});
