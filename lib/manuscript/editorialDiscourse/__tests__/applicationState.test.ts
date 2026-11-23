/**
 * Continuity (#1800, E0 walk 2026-11-23): MAIA must be able to tell what she
 * proposed, what the writer applied, what the writer undid, and what the page says now.
 * Before this, every proposal was shown to her identically, and after Use it → Undo
 * she described the undone cut as the manuscript.
 */
import { editorialCandidates, type VersionRecord } from '../contract';

const ORIGINAL = 'The island was simply changed by the storm. I wrote this because it was the explanation I could bear to give.';
const CUT = 'The island was simply changed by the storm.';

function render(version: Partial<VersionRecord>, presentNow?: boolean): string {
  const v: VersionRecord = { kind: 'version', id: 'v1', author: 'maia', wording: CUT, supersedes: null, ...version } as VersionRecord;
  const out = editorialCandidates({
    locus: { chainId: 'c1', originalText: ORIGINAL, ...(presentNow === undefined ? {} : { presentNow }) },
    surround: null, turns: [], versions: [v], insights: [], directions: [], bindings: [],
    declaredAct: 'discourse',
  });
  if (!out.ok) throw new Error(out.reason);
  return out.blocks.map((b) => b.text).join('\n');
}

describe('what the writer did with a proposal reaches MAIA', () => {
  test('a proposal never applied is said to be only a proposal', () => {
    const text = render({});
    expect(text).toContain('only proposed: never applied to the manuscript');
    expect(text).not.toContain('APPLIED by the writer');
  });

  test('an applied proposal is said to be in the manuscript', () => {
    const text = render({ application: 'applied' });
    expect(text).toContain('APPLIED by the writer: the manuscript took this wording');
  });

  test('an applied-then-undone proposal is said NOT to be in the manuscript', () => {
    const text = render({ application: 'undone' });
    expect(text).toContain('the writer applied this, then UNDID it: the manuscript does not hold it');
    expect(text).not.toContain('APPLIED by the writer: the manuscript took');
  });
});

describe('whether the page still reads the passage reaches MAIA', () => {
  test('present now', () => {
    expect(render({}, true)).toContain('The manuscript reads exactly this wording now.');
  });
  test('changed since', () => {
    const text = render({ application: 'applied' }, false);
    expect(text).toContain('The manuscript NO LONGER reads exactly this wording');
    expect(text).toContain('Do not describe it, or any proposal, as what the page says now.');
  });
  test('unknown is never said as a yes or a no', () => {
    const text = render({});
    expect(text).not.toContain('reads exactly this wording now');
    expect(text).not.toContain('NO LONGER reads');
  });
});
