/** @jest-environment node */
/** One kept version's text for the Revision Mirror: read-only, owner-scoped. */
const query = jest.fn();
jest.mock('@/lib/db/postgres', () => ({ query: (...a: unknown[]) => query(...a) }));
const member = jest.fn();
jest.mock('@/lib/auth/getMemberFromRequest', () => ({ getMemberIdFromRequest: (...a: unknown[]) => member(...a) }));
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { GET } from '../route';

const ME = '11111111-1111-4111-8111-111111111111';
const MS = 'e8a77629-d941-451c-a603-898952f72ae3';
const get = (n: string) => GET(new NextRequest(`https://soullab.life/api/sovereign/manuscripts/${MS}/draft/revisions/${n}`), { params: Promise.resolve({ id: MS, n }) });
beforeEach(() => { jest.clearAllMocks(); member.mockResolvedValue(ME); jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

it('returns the writer’s own kept version, looked up through THEIR draft only', async () => {
  query.mockResolvedValueOnce({ rows: [{ revision_number: 2, content: 'my words', created_at: 't' }] });
  const res = await get('2');
  expect(await res.json()).toEqual({ revisionNumber: 2, content: 'my words', createdAt: 't' });
  const [sql, params] = query.mock.calls[0]!;
  expect(String(sql)).toContain('d.manuscript_id = $1 AND d.member_id = $2 AND v.revision_number = $3');
  expect(params).toEqual([MS, ME, 2]);
});
it('unauthenticated 401; not theirs or not found 404; malformed 400', async () => {
  member.mockResolvedValueOnce(null);
  expect((await get('2')).status).toBe(401);
  query.mockResolvedValueOnce({ rows: [] });
  expect((await get('2')).status).toBe(404);
  expect((await get('two')).status).toBe(400);
  expect((await get('-1')).status).toBe(400);
});
it('read-only', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'route.ts'), 'utf8');
  expect(src).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/);
  expect(src).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
});
