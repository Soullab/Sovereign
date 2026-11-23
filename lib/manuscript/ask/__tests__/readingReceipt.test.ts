import { readRecordOf, receiptOf, receiptSentence, sectionIdsIn, NO_LONGER_IN_WORK, type SectionsNow } from '../readingReceipt';

const now: SectionsNow = {
  heads: new Map([
    ['s1', { heading: 'The Harbour', position: 0 }],
    ['s2', { heading: null, position: 1 }],
    ['s3', { heading: 'Return', position: 2 }],
  ]),
  digests: new Map([['s1', 'd1'], ['s2', 'd2-now'], ['s3', 'd3']]),
};

describe('Package C3 · the reading record written with each new answer', () => {
  it('records ids and digests only; an empty supplied list RECORDS "none supplied"', () => {
    expect(readRecordOf([{ id: 's1', digest: 'd1' }], ['s3'])).toEqual({ v: 1, supplied: [{ sectionId: 's1', digest: 'd1' }], notSupplied: [{ sectionId: 's3' }] });
    expect(readRecordOf([], [])).toEqual({ v: 1, supplied: [], notSupplied: [] });
    expect(JSON.stringify(readRecordOf([{ id: 's1', digest: 'd1' }], []))).not.toMatch(/body|text|heading/);
  });
});

describe('Package C2 · the receipt the browser gets instead of raw provenance', () => {
  it('recorded: current names, change since, and omissions', () => {
    const r = receiptOf({ readRecord: readRecordOf([{ id: 's1', digest: 'd1' }, { id: 's2', digest: 'd2-then' }], ['s3']), locus: { sectionId: 's1', digest: 'd1' }, model: 'm', promptHash: 'h' }, now);
    expect(r.evidence).toBe('recorded');
    expect(r.supplied).toEqual([{ name: 'The Harbour', textChangedSince: false }, { name: 'Section 2', textChangedSince: true }]);
    expect(receiptSentence(r)).toBe('For this answer MAIA read your saved sections: The Harbour, Section 2 (changed since). Left out for length: Return.');
  });
  it('⭐ MUST FAIL IF the receipt carries model, prompt hash, digests or section ids to the browser', () => {
    const r = receiptOf({ readRecord: readRecordOf([{ id: 's1', digest: 'd1' }], []), model: 'claude-x', promptHash: 'abc', provider: 'p' }, now);
    expect(JSON.stringify(r)).not.toMatch(/claude-x|abc|"d1"|"s1"|model|promptHash|provider|digest|sectionId/);
  });
  it('recorded zero says none; with the passage she was in, it says so instead of a bare "none"', () => {
    expect(receiptSentence(receiptOf({ readRecord: readRecordOf([], []) }, now))).toBe('For this answer MAIA read none of your saved work.');
    expect(receiptSentence(receiptOf({ readRecord: readRecordOf([], []), locus: { sectionId: 's2', digest: 'd2-now' } }, now)))
      .toBe('For this answer MAIA had the passage you were in (Section 2) and none of your other saved work.');
  });
  it('⭐ MUST FAIL IF a row with no record is ever shown as "none" (old rows, or rows restored from an older backup)', () => {
    const r = receiptOf({ model: 'm' }, now);
    expect(r.evidence).toBe('not_recorded');
    expect(receiptSentence(r)).toBe('What MAIA read for this answer was not recorded.');
    expect(receiptOf(null, now).evidence).toBe('not_recorded');
  });
  it('⭐ MUST FAIL IF omissions are invented for a legacy row (only suppliedSections was ever written)', () => {
    const r = receiptOf({ suppliedSections: [{ sectionId: 's3', digest: 'd3' }] }, now);
    expect(r.evidence).toBe('partial_legacy');
    expect(r.notSupplied).toBe('not_recorded');
    expect(receiptSentence(r)).toBe('For this answer MAIA read your saved section: Return.');
  });
  it('⭐ MUST FAIL IF a deleted or erased section\'s name can be resolved through a receipt (R4)', () => {
    const r = receiptOf({ readRecord: readRecordOf([{ id: 'gone', digest: 'dx' }], ['gone2']) }, now);
    expect(r.supplied).toEqual([{ name: NO_LONGER_IN_WORK, textChangedSince: 'unknown' }]);
    expect(r.notSupplied).toEqual([{ name: NO_LONGER_IN_WORK, textChangedSince: 'unknown' }]);
  });
  it('a renamed section shows its current name with text unchanged', () => {
    const renamed: SectionsNow = { heads: new Map([['s1', { heading: 'The Quay', position: 0 }]]), digests: new Map([['s1', 'd1']]) };
    expect(receiptOf({ readRecord: readRecordOf([{ id: 's1', digest: 'd1' }], []) }, renamed).supplied).toEqual([{ name: 'The Quay', textChangedSince: false }]);
  });
  it('sectionIdsIn names only the ids a receipt needs', () => {
    expect(sectionIdsIn({ readRecord: readRecordOf([{ id: 's1', digest: 'd' }], ['s3']), locus: { sectionId: 's2', digest: 'x' }, suppliedSections: [{ sectionId: 's1', digest: 'd' }] }).sort())
      .toEqual(['s1', 's2', 's3']);
    expect(sectionIdsIn(null)).toEqual([]);
  });
});
