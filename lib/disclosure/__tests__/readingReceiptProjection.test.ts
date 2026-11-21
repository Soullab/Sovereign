import { readFileSync } from 'fs';
import { join } from 'path';

const mockHeads = jest.fn(), mockSupplied = jest.fn();
jest.mock('@/lib/manuscript/ask/frozenReading', () => ({ loadSectionHeads: (...a: unknown[]) => mockHeads(...a) }));
jest.mock('@/lib/disclosure/workReadScopeRead', () => ({ loadSuppliedSections: (...a: unknown[]) => mockSupplied(...a) }));

import { withReceipts, withoutProvenance } from '../readingReceiptProjection';
import { readRecordOf } from '@/lib/manuscript/ask/readingReceipt';

const thread = {
  id: 'thread-a', manuscriptId: 'm1',
  turns: [
    { index: 0, speaker: 'author' as const, body: 'q1', staleness: 'current', answerProvenance: null },
    { index: 1, speaker: 'maia' as const, body: 'a1', staleness: 'current',
      answerProvenance: { model: 'claude-x', promptHash: 'h1', readRecord: readRecordOf([{ id: 's1', digest: 'd1' }], ['s3']), locus: { sectionId: 's1', digest: 'd1' } } },
    { index: 2, speaker: 'author' as const, body: 'q2', staleness: 'current', answerProvenance: null },
    { index: 3, speaker: 'maia' as const, body: 'a2', staleness: 'current', answerProvenance: { model: 'claude-x' } },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockHeads.mockResolvedValue([{ id: 's1', position: 0, heading: 'The Harbour' }, { id: 's3', position: 2, heading: null }]);
  mockSupplied.mockImplementation(async (_m: string, _u: string, ids: string[]) => ids.map((id) => ({ id, digest: id === 's1' ? 'd1' : 'dx' })));
});

describe('Package C2 · the thread the browser receives', () => {
  it('⭐ MUST FAIL IF raw answer provenance (model, hash, digests, ids) reaches the browser', async () => {
    const out = await withReceipts(thread, 'm1', 'member-1');
    const json = JSON.stringify(out);
    expect(json).not.toMatch(/answerProvenance|claude-x|promptHash|"h1"|"d1"|readRecord|sectionId/);
  });
  it('every MAIA answer carries its own receipt (so reopening shows each one), author turns carry none', async () => {
    const out = (await withReceipts(thread, 'm1', 'member-1'))!;
    expect(out.turns[0]).not.toHaveProperty('receipt');
    expect(out.turns[1].receipt).toMatchObject({ evidence: 'recorded', reading: 'some_supplied',
      supplied: [{ name: 'The Harbour', textChangedSince: false }], notSupplied: [{ name: 'Section 3' }] });
    expect(out.turns[3].receipt).toMatchObject({ evidence: 'not_recorded' });     // an old answer: "not recorded", never "none"
  });
  it('⭐ MUST FAIL IF the projection reads anything not scoped to this member and Work', async () => {
    await withReceipts(thread, 'm1', 'member-1');
    expect(mockHeads).toHaveBeenCalledWith('m1', 'member-1');
    for (const call of mockSupplied.mock.calls) expect(call.slice(0, 2)).toEqual(['m1', 'member-1']);
  });
  it('a section no longer in the Work is never looked up for text, and is never named (R4 erasure)', async () => {
    mockHeads.mockResolvedValue([{ id: 's3', position: 2, heading: null }]);   // s1 deleted
    const out = (await withReceipts(thread, 'm1', 'member-1'))!;
    expect(mockSupplied.mock.calls[0][2]).toEqual(['s3']);
    expect(out.turns[1].receipt?.supplied).toEqual([{ name: 'a section no longer in this Work', textChangedSince: 'unknown' }]);
  });
  it('a thread with no recorded reading makes no section query at all', async () => {
    await withReceipts({ turns: [{ speaker: 'maia' as const, answerProvenance: { model: 'x' } }] }, 'm1', 'member-1');
    expect(mockHeads).not.toHaveBeenCalled();
    expect(mockSupplied).not.toHaveBeenCalled();
  });
  it('withoutProvenance strips the field and adds nothing', () => {
    const out = withoutProvenance(thread);
    expect(JSON.stringify(out)).not.toMatch(/answerProvenance|claude-x/);
    expect(out.turns[1]).not.toHaveProperty('receipt');
  });
  it('null stays null', async () => { expect(await withReceipts(null, 'm1', 'member-1')).toBeNull(); });
});

describe('Package C · route wiring (static)', () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
  const ASK = strip(readFileSync(join(process.cwd(), 'app/api/sovereign/manuscripts/[id]/ask/route.ts'), 'utf8'));
  const LW = strip(readFileSync(join(process.cwd(), 'app/api/sovereign/living-works/[id]/ask/route.ts'), 'utf8'));
  it('⭐ MUST FAIL IF any Ask response sends a thread straight from loadThread (raw provenance)', () => {
    expect(ASK).not.toMatch(/NextResponse\.json\(\{\s*thread: t\s*\}\)/);
    expect(ASK).toContain('thread: await withReceipts(t, id, memberId)');
    expect(ASK).toContain('withReceipts(await loadThread(liveThreadId, memberId), manuscriptId, memberId)');
    expect(ASK).toContain('withReceipts(await loadThread(existing.id, memberId), manuscriptId, memberId)');
    expect((ASK.match(/withoutProvenance\(loaded\)/g) ?? []).length).toBe(2);
    expect(ASK).toContain('thread: thread && withoutProvenance(thread)');
  });
  it('⭐ MUST FAIL IF a Living Work response sends raw provenance', () => {
    expect(LW).not.toMatch(/NextResponse\.json\(\{\s*thread\s*\}\)/);
    expect((LW.match(/withoutProvenance\(/g) ?? []).length).toBe(3);
  });
  it('⭐ MUST FAIL IF a new work answer is saved without its reading record (always present, even when nothing was supplied)', () => {
    expect(ASK).toMatch(/readRecord: readRecordOf\(supplied, standingRead \? standingRead\.notSupplied\.map\(\(n\) => n\.id\) : \[\]\)/);
  });
});
