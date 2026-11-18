/**
 * §20: the letter's opening rests on exactly the observations the letter rests on. When the letter was built from readings that together
 * cover the draft, the opening must not be handed an older reading's observation about text that has since changed.
 */
const q = jest.fn();
const load = jest.fn();
const run = jest.fn();
jest.mock('@/lib/db/postgres', () => ({ query: (...a: unknown[]) => q(...a) }));
jest.mock('@/lib/manuscript/developmentalReading/store', () => ({ loadReading: (...a: unknown[]) => load(...a) }));
jest.mock('@/lib/writersStudio/meteredStructured', () => ({ runStructured: (...a: unknown[]) => run(...a) }));
jest.mock('@/lib/writersStudio/writerUnderstandingServer', () => ({ writerUnderstandingContextForManuscript: async () => null }));

import fs from 'node:fs';
import path from 'node:path';
import { composeOpening } from '@/lib/writersStudio/studio/letterOpening';

const obs = (id: string, s: string) => ({ key: `${id}-${s}`, lens: 'arc', observation: `about ${s} in ${id}`, doesNotEstablish: 'x', evidenceRefs: [{ kind: 'section', sectionId: s }] });
beforeEach(() => {
  q.mockReset(); load.mockReset(); run.mockReset();
  q.mockResolvedValue({ rows: [{ id: 's1', text: 'one' }, { id: 's2', text: 'two, edited' }] });
  load.mockImplementation(async (id: string) => ({ id, manuscriptId: 'm', outcome: 'reading', observations: id === 'old' ? [obs('old', 's1'), obs('old', 's2')] : [obs('new', 's2')] }));
  run.mockResolvedValue({ ok: false });
});
const sentObservations = () => {
  const c = (run.mock.calls[0]![0] as { messages: { content: string }[] }).messages[0]!.content;
  return JSON.parse(c.slice(c.indexOf('\n') + 1)) as { observation: string }[];
};

describe('§20 the opening and the letter rest on the same observations', () => {
  it('⭐ MUST FAIL IF the opening is handed an old observation about changed text', async () => {
    await composeOpening('me', 'm', ['old', 'new'], ['old:old-s1', 'new:new-s2']);
    const sent = sentObservations().map((o) => o.observation);
    expect(sent).toEqual(['about s1 in old', 'about s2 in new']);
  });
  it('without a kept list (the chapter overview path), every observation of the given readings is offered, as before', async () => {
    await composeOpening('me', 'm', ['old']);
    expect(sentObservations()).toHaveLength(2);
  });
  it('the route and the run pass the synthesis\'s kept observations', () => {
    const route = fs.readFileSync(path.join(process.cwd(), 'app/api/sovereign/manuscripts/[id]/attention-map/route.ts'), 'utf8');
    const runSrc = fs.readFileSync(path.join(process.cwd(), 'lib/writersStudio/studio/passRun.ts'), 'utf8');
    expect(route).toMatch(/composeOpening\(memberId, manuscriptId, readingIds, synthesis\.observationKeys\)/);
    expect(runSrc).toMatch(/deps\.opening\(memberId, manuscriptId, synthesis\.readingIds, synthesis\.observationKeys\)/);
  });
});
