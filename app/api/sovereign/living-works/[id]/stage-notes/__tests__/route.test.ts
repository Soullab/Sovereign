/** @jest-environment node */
/**
 * The writer's private stage notes (founder 2026-11-16: "Yes, private by default"). Owner-scoped; only a built stage of the
 * Work's own program; an empty note removes it. Hermetic: stubbed database and auth.
 */
const query = jest.fn();
jest.mock('@/lib/db/postgres', () => ({ query: (...a: unknown[]) => query(...a) }));
const member = jest.fn();
jest.mock('@/lib/auth/getMemberFromRequest', () => ({ getMemberIdFromRequest: (...a: unknown[]) => member(...a) }));
import { NextRequest } from 'next/server';
import { GET, PUT } from '../route';

const ME = '11111111-1111-4111-8111-111111111111';
const WORK = 'a0000000-0000-4000-8000-00000000000a';
const ctx = { params: Promise.resolve({ id: WORK }) };
const put = (body: unknown) => new NextRequest(`https://soullab.life/api/sovereign/living-works/${WORK}/stage-notes`, { method: 'PUT', body: JSON.stringify(body) } as never);
const get = () => new NextRequest(`https://soullab.life/api/sovereign/living-works/${WORK}/stage-notes`);
const writes = () => query.mock.calls.filter(([sql]) => /INSERT INTO studio_stage_notes|DELETE FROM studio_stage_notes/.test(String(sql)));
function db(program: string | null | 'none') {
  query.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT studio_path FROM living_works')) return { rows: program === 'none' ? [] : [{ studio_path: program }] };
    if (sql.includes('INSERT INTO studio_stage_notes')) return { rows: [{ stage: 'meaning', body: 'mine', updated_at: 't' }] };
    if (sql.includes('SELECT stage, body')) return { rows: [{ stage: 'meaning', body: 'mine', updated_at: 't' }] };
    return { rows: [] };
  });
}
beforeEach(() => { jest.clearAllMocks(); member.mockResolvedValue(ME); jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

it('unauthenticated: 401; another member’s Work: 404; nothing written', async () => {
  member.mockResolvedValueOnce(null);
  expect((await PUT(put({ stage: 'meaning', body: 'x' }), ctx)).status).toBe(401);
  db('none');
  expect((await PUT(put({ stage: 'meaning', body: 'x' }), ctx)).status).toBe(404);
  expect((await GET(get(), ctx)).status).toBe(404);
  expect(writes()).toHaveLength(0);
});

it('saves a note for a built stage of the Work’s own program, for THIS member only', async () => {
  db('college-essay');
  const res = await PUT(put({ stage: 'meaning', body: 'mine' }), ctx);
  expect(res.status).toBe(200);
  const [sql, params] = writes()[0]!;
  expect(String(sql)).toContain('INSERT INTO studio_stage_notes');
  expect(params).toEqual([WORK, ME, 'meaning', 'mine']);
});

it('NEGATIVE: unknown stage, a Work with no program, malformed or oversize body: refused, nothing written', async () => {
  db('college-essay');
  expect((await PUT(put({ stage: 'chapter-one', body: 'x' }), ctx)).status).toBe(400);
  expect((await PUT(put({ stage: 'meaning', body: 7 }), ctx)).status).toBe(400);
  expect((await PUT(put({ stage: 'meaning', body: 'x'.repeat(20001) }), ctx)).status).toBe(400);
  db(null);
  expect((await PUT(put({ stage: 'meaning', body: 'x' }), ctx)).status).toBe(400);
  expect(writes()).toHaveLength(0);
});

it('an empty note removes it', async () => {
  db('college-essay');
  const res = await PUT(put({ stage: 'meaning', body: '   ' }), ctx);
  expect(await res.json()).toEqual({ note: null });
  expect(String(writes()[0]![0])).toContain('DELETE FROM studio_stage_notes');
  expect(writes()[0]![1]).toEqual([WORK, ME, 'meaning']);
});

it('GET returns only this member’s notes on this Work', async () => {
  db('college-essay');
  const res = await GET(get(), ctx);
  expect(await res.json()).toEqual({ notes: [{ stage: 'meaning', body: 'mine', updatedAt: 't' }] });
  const call = query.mock.calls.find(([sql]) => String(sql).includes('SELECT stage, body'))!;
  expect(call[1]).toEqual([WORK, ME]);
});
