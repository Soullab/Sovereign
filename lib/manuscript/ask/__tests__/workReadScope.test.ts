import { readFileSync } from 'fs';
import { join } from 'path';
import { activeGrant, selectSections, sectionsNamedIn, movedSince, READ_CHAR_BUDGET, type ScopeEventRow } from '../workReadScope';

const ev = (id: string, event: 'grant' | 'revoke', level: 'chapter' | 'work' | null = null): ScopeEventRow =>
  ({ id, event, level, createdAt: '2026-11-08T00:00:00Z' });
const secs = [
  { id: 's1', position: 1, heading: 'The Harbour' },
  { id: 's2', position: 2, heading: 'Salt' },
  { id: 's3', position: 3, heading: 'Return' },
];
const sizes = new Map([['s1', 100], ['s2', 100], ['s3', 100]]);

describe('standing reading scope · decision', () => {
  it('no events means no grant; nothing is inferred', () => expect(activeGrant([])).toBeNull());
  it('the latest event wins; a revoke ends the grant', () => {
    expect(activeGrant([ev('a', 'grant', 'work')])).toEqual({ id: 'a', level: 'work' });
    expect(activeGrant([ev('a', 'grant', 'work'), ev('b', 'revoke')])).toBeNull();
    expect(activeGrant([ev('a', 'grant', 'work'), ev('b', 'revoke'), ev('c', 'grant', 'chapter')]))
      .toEqual({ id: 'c', level: 'chapter' });
  });
  it('chapter level supplies only the locus, whatever the declared scope (a selection never widens a grant)', () => {
    for (const scope of ['here', 'whole_book'] as const) {
      expect(selectSections({ level: 'chapter', scope, question: 'compare Salt and Return across the whole book', locusId: 's2', sections: secs, sizes }).ids)
        .toEqual(['s2']);
    }
  });
  it('WS-STEP4 A: with a work grant, the DECLARED scope governs; wording and named chapters never widen "where I am"', () => {
    // A2: whole-book wording under "where I am" reads the locus only (was: every section).
    expect(selectSections({ level: 'work', scope: 'here', question: 'what holds across the book?', locusId: 's1', sections: secs, sizes }).ids)
      .toEqual(['s1']);
    // A3: a named chapter under "where I am" reads the locus only (was: locus + the named chapter).
    expect(selectSections({ level: 'work', scope: 'here', question: 'how does Return land?', locusId: 's1', sections: secs, sizes }).ids)
      .toEqual(['s1']);
    // Benchmark 01 S5: "the whole book" selected, wording that names no scope -> every section.
    expect(selectSections({ level: 'work', scope: 'whole_book', question: "What am I missing? Tell me something about this book I haven't seen yet.", locusId: 's3', sections: secs, sizes }).ids)
      .toEqual(['s3', 's1', 's2']);
  });
  it('WS-STEP4 A3/S2: under the whole book, a named chapter only sets priority, and omissions are exact', () => {
    const tight = new Map([['s1', 30_000], ['s2', 30_000], ['s3', 30_000]]);
    const r = selectSections({ level: 'work', scope: 'whole_book', question: 'how does Return land?', locusId: 's1', sections: secs, sizes: tight });
    expect(r.ids).toEqual(['s1', 's3']);
    expect(r.overBudget).toEqual(['s2']);
  });
  it('a client-supplied locus that is not the member\'s own section selects nothing', () => {
    expect(selectSections({ level: 'work', scope: 'here', question: 'x', locusId: 'forged', sections: secs, sizes }).ids).toEqual([]);
  });
  it('over-budget sections are reported, never silently dropped', () => {
    const big = new Map([['s1', READ_CHAR_BUDGET], ['s2', 10], ['s3', 10]]);
    const r = selectSections({ level: 'work', scope: 'whole_book', question: 'x', locusId: 's1', sections: secs, sizes: big });
    expect(r.ids).toEqual(['s1']);
    expect(r.overBudget).toEqual(['s2', 's3']);
  });
  it('WS-STEP4 A4: a single section larger than the whole budget is never admitted, even first; it is disclosed', () => {
    const huge = new Map([['s1', READ_CHAR_BUDGET + 1], ['s2', 10], ['s3', 10]]);
    const r = selectSections({ level: 'work', scope: 'whole_book', question: 'x', locusId: 's1', sections: secs, sizes: huge });
    expect(r.ids).toEqual(['s2', 's3']);
    expect(r.overBudget).toEqual(['s1']);
    expect(selectSections({ level: 'work', scope: 'here', question: 'x', locusId: 's1', sections: secs, sizes: huge }))
      .toEqual({ ids: [], overBudget: ['s1'] });
  });
  it('movedSince flags only sections whose supplied bytes changed', () => {
    expect(movedSince(new Map([['s1', 'a'], ['s2', 'b']]), new Map([['s1', 'a'], ['s2', 'c']]))).toEqual(['s2']);
  });
});

describe('standing reading scope · after independent review', () => {
  const sec = [
    { id: 'a', position: 1, heading: 'Air' }, { id: 'b', position: 2, heading: 'One' }, { id: 'c', position: 3, heading: 'Return' },
  ];
  it('a short heading matches only as a whole word ("Air" is not in "fair", "One" is not in "someone")', () => {
    expect(sectionsNamedIn('is it fair to someone?', sec)).toEqual([]);
    expect(sectionsNamedIn('what does Air do? and one?', sec)).toEqual(['a', 'b']);
  });
});

describe('standing reading scope · route wiring (static)', () => {
  const route = readFileSync(join(__dirname, '..', '..', '..', '..', 'app/api/sovereign/manuscripts/[id]/ask/route.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const turn = route.slice(route.indexOf('async function workTurn'), route.indexOf('async function developmentalTurn'));
  it('receipts are minted before any saved text is loaded', () => {
    expect(turn.indexOf('establishDisclosureBoundary(')).toBeGreaterThan(-1);
    expect(turn.indexOf('establishDisclosureBoundary(')).toBeLessThan(turn.indexOf('loadSuppliedSections('));
  });
  it('the grant is re-read at every Ask and Sanctuary suspends it', () => {
    expect(turn).toMatch(/posture\.sanctuary \|\| !postureKnown\) \? null : await loadActiveGrant\(/);
  });
  it('no scope, level or section list is taken from the request body', () => {
    expect(turn).not.toMatch(/body\.(scope|level|sections|authorizes)/);
  });
  it('the Ask route never imports the scope writer', () => {
    expect(route).not.toContain('workReadScopeWrite');
  });
});

describe('WS-STEP4 A · the route passes the writer\'s declared scope (static)', () => {
  const route = readFileSync(join(__dirname, '..', '..', '..', '..', 'app/api/sovereign/manuscripts/[id]/ask/route.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  it('⭐ MUST FAIL IF the "About: the whole book" selection stops reaching saved-section selection (Benchmark 01, S5)', () => {
    expect(route).toMatch(/selectSections\(\{\s*level: grant\.level, scope: carryScope, question, locusId: sectionId,/);
  });
  it('the grant is still loaded server-side before any selection', () => {
    expect(route.indexOf('loadActiveGrant(')).toBeGreaterThan(-1);
    expect(route.indexOf('loadActiveGrant(')).toBeLessThan(route.indexOf('selectSections({'));
  });
});
