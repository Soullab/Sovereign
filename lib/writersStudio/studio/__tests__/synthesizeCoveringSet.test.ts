/**
 * §20 at the synthesis: the whole-book letter accepts a set of readings that TOGETHER cover the current draft (per lens, by digest),
 * and only observations about text that is still current reach the model. Database, store, entitlement and model are stubbed; the
 * gate itself is the real function.
 */
import { createHash } from 'node:crypto';

const q = jest.fn();
const load = jest.fn();
const run = jest.fn();
jest.mock('@/lib/db/postgres', () => ({ query: (...a: unknown[]) => q(...a) }));
jest.mock('@/lib/manuscript/developmentalReading/store', () => ({ loadReading: (...a: unknown[]) => load(...a) }));
jest.mock('@/lib/writersStudio/meteredStructured', () => ({ runStructured: (...a: unknown[]) => run(...a) }));
jest.mock('@/lib/writersStudio/writerUnderstandingServer', () => ({ writerUnderstandingContextForManuscript: async () => null }));
jest.mock('@/lib/writersStudio/proTaste', () => ({ wholeWorkForManuscript: async () => true }));

import { synthesizeAttentionMap } from '@/lib/writersStudio/studio/synthesizeAttentionMap';
import { DEVELOPMENTAL_LENSES } from '@/lib/manuscript/developmentalReader/contract';
import { ATTENTION_SYNTHESIS_VERSION } from '@/lib/writersStudio/studio/attentionMapSynthesis';

const DEEP = DEVELOPMENTAL_LENSES.filter((l) => l !== 'overview');
const dg = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const OLD_TEXT = { s1: 'one', s2: 'two', s3: 'three' } as Record<string, string>;
const NOW_TEXT = { s1: 'one', s2: 'two, edited', s3: 'three' } as Record<string, string>;

function reading(id: string, lens: string, rev: number, texts: Record<string, string>, body: string[], at: string, draftId = 'D') {
  return {
    id, manuscriptId: 'm', outcome: 'reading',
    scope: { commissionedLens: lens, bodyScope: body, withStructure: false },
    readState: { draftId, revisionNumber: rev, sections: Object.fromEntries(Object.entries(texts).map(([k, v]) => [k, { revisionNumber: rev, range: { start: 0, end: 1 }, digest: dg(v) }])) },
    coverage: { sections: Object.fromEntries(Object.keys(texts).map((k) => [k, body.includes(k) ? 'body' : 'position'])) },
    provenance: { frozenAt: at },
    observations: body.map((s) => ({ key: `${id}-${s}`, lens, observation: `about ${s} as read in ${id}`, doesNotEstablish: 'x', evidenceRefs: [{ kind: 'section', sectionId: s }] })),
  };
}
const OLD = DEEP.map((l) => reading(`old-${l}`, l, 5, OLD_TEXT, ['s1', 's2', 's3'], '2026-11-10T00:00:00Z'));
const NEW = DEEP.map((l) => reading(`new-${l}`, l, 7, NOW_TEXT, ['s2'], '2026-11-17T00:00:00Z'));

beforeEach(() => {
  q.mockReset(); load.mockReset(); run.mockReset();
  q.mockImplementation(async (sql: string) => {
    if (sql.includes('working_draft_revisions')) return { rows: [{ revision_number: 7 }] };
    if (sql.includes('manuscript_draft_sections')) return { rows: ['s1', 's2', 's3'].map((id) => ({ id, text: NOW_TEXT[id], draft_id: 'D' })) };
    throw new Error(`unexpected SQL ${sql.slice(0, 40)}`);
  });
  const all = [...OLD, ...NEW, reading('other-arc', 'arc', 7, NOW_TEXT, ['s2'], '2026-11-17T00:00:00Z', 'OTHER')];
  load.mockImplementation(async (id: string) => all.find((r) => r.id === id) ?? null);
  run.mockImplementation(async () => ({ ok: true, result: {
    provenance: { modelAgreement: 'agreed', provider: 'p', model: 'm', reportedModel: 'm' }, stopReason: 'end_turn',
    content: [{ type: 'tool_use', name: 'return_attention_map', input: { version: ATTENTION_SYNTHESIS_VERSION, items: [
      { band: 'next', scale: 'passage', label: 'L', notice: 'N', whyItMatters: 'W', uncertainty: null, evidenceRefs: ['E1'] }] } }],
  } }));
});
const sent = () => {
  const content = (run.mock.calls[0]![0] as { messages: { content: string }[] }).messages[0]!.content;
  return JSON.parse(content.slice(content.indexOf('FROZEN OBSERVATIONS:') + 'FROZEN OBSERVATIONS:'.length)) as { readingId: string; sectionIds: string[] }[];
};

describe('§20 the whole-book letter from readings that together cover the current draft', () => {
  it('⭐ old whole readings + the changed section reread are accepted, without paying to reread the whole book', async () => {
    const out = await synthesizeAttentionMap('me', 'm', [...OLD, ...NEW].map((r) => r.id), 'letter');
    expect(out).toMatchObject({ ok: true, deepMode: true, revisionNumber: 7 });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('⭐ MUST FAIL IF a stale observation reaches the letter: nothing old about the changed section is sent to the model', async () => {
    await synthesizeAttentionMap('me', 'm', [...OLD, ...NEW].map((r) => r.id), 'letter');
    const obs = sent();
    expect(obs.filter((o) => o.readingId.startsWith('old-') && o.sectionIds.includes('s2'))).toEqual([]);
    expect(obs.filter((o) => o.readingId.startsWith('new-') && o.sectionIds.includes('s2'))).toHaveLength(DEEP.length);
    expect(obs.filter((o) => o.readingId.startsWith('old-'))).toHaveLength(DEEP.length * 2); // s1 and s3, still current
  });

  it('⭐ the kept observations are named, so the letter\'s opening can rest on the same ones', async () => {
    const out = await synthesizeAttentionMap('me', 'm', [...OLD, ...NEW].map((r) => r.id), 'letter');
    expect(out.ok && out.observationKeys).toEqual(expect.arrayContaining(['old-arc:old-arc-s1', 'new-arc:new-arc-s2']));
    expect(out.ok && out.observationKeys).not.toContain('old-arc:old-arc-s2');
  });

  it('⭐ MUST FAIL IF a section with no current reading is accepted: the old readings alone are refused, no model call', async () => {
    const out = await synthesizeAttentionMap('me', 'm', OLD.map((r) => r.id), 'letter');
    expect(out).toMatchObject({ ok: false, status: 409, error: 'section_not_covered' });
    expect(run).not.toHaveBeenCalled();
  });

  it('⭐ MUST FAIL IF readings of different drafts are mixed', async () => {
    const ids = [...OLD, ...NEW].map((r) => r.id).filter((id) => id !== 'new-arc');
    const out = await synthesizeAttentionMap('me', 'm', [...ids, 'other-arc'], 'letter');
    expect(out).toMatchObject({ ok: false, error: 'reading_of_another_draft' });
    expect(run).not.toHaveBeenCalled();
  });

  it('a lens left out is refused by its old name', async () => {
    const out = await synthesizeAttentionMap('me', 'm', [...OLD, ...NEW].filter((r) => !r.id.endsWith('-arc')).map((r) => r.id), 'letter');
    expect(out).toMatchObject({ ok: false, error: 'overview_or_complete_eight_lens_set_required' });
    expect(run).not.toHaveBeenCalled();
  });
});
