/** @jest-environment node */
/**
 * "Share this with Soullab" (Studio Academy slice 6, founder rulings 2026-11-19). Hermetic: stubbed database and auth, REAL
 * encryption, so the stored row is proven to hold no plaintext and to be bound to its row and writer.
 */
const query = jest.fn();
jest.mock('@/lib/db/postgres', () => ({ query: (...a: unknown[]) => query(...a) }));
const member = jest.fn();
jest.mock('@/lib/auth/getMemberFromRequest', () => ({ getMemberIdFromRequest: (...a: unknown[]) => member(...a) }));
import { NextRequest } from 'next/server';
import { generateKey, clearKeyCache } from '@/lib/security/phiEncryption';
import { decryptSharedExchange } from '@/lib/security/phiAccessors/sharedExchanges';
import { DELETE, GET, POST } from '../route';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '99999999-9999-4999-8999-999999999999';
const WORK = 'a0000000-0000-4000-8000-00000000000a';
const THREAD = 'b0000000-0000-4000-8000-00000000000b';
const SHARE = 'c0000000-0000-4000-8000-00000000000c';
const URL_ = 'https://soullab.life/api/sovereign/writers-studio/shared-exchanges';
const post = (body: unknown) => new NextRequest(URL_, { method: 'POST', body: JSON.stringify(body) } as never);
const ordinary = { workId: WORK, threadId: THREAD, maiaTurnIndex: 1, sanctuary: false };
const inserts = () => query.mock.calls.filter(([sql]) => /INSERT INTO writer_studio_shared_exchanges/.test(String(sql)));

function db(opts: { owns?: boolean; maia?: boolean; founder?: boolean; deleted?: number } = {}) {
  const { owns = true, maia = true, founder = false, deleted = 1 } = opts;
  query.mockImplementation(async (sql: string) => {
    if (sql.startsWith('DELETE FROM writer_studio_shared_exchanges WHERE expires_at')) return { rows: [], rowCount: 0 };
    if (sql.startsWith('DELETE FROM writer_studio_shared_exchanges WHERE id')) return { rows: [], rowCount: deleted };
    if (sql.includes('FROM living_works WHERE id')) return { rows: owns ? [{ '?column?': 1 }] : [] };
    if (sql.includes('FROM ask_threads th')) return { rows: [
      { living_work_id: WORK, manuscript_id: null, speaker: 'author', body: 'How do I open chapter one?', turn_index: 0 },
      { living_work_id: WORK, manuscript_id: null, speaker: maia ? 'maia' : 'author', body: 'Begin with the reader’s moment.', turn_index: 1 },
    ] };
    if (sql.includes("admin_role = 'founder'")) return { rows: [{ founder }] };
    if (sql.includes('SELECT id, created_at, expires_at')) return { rows: [{ id: SHARE, created_at: '2026-11-19T00:00:00Z', expires_at: '2027-11-19T00:00:00Z' }] };
    return { rows: [] };
  });
}

const ORIGINAL = { key: process.env.PHI_ENCRYPTION_KEY, flag: process.env.WS_SHARE_EXCHANGE_ENABLED, beta: process.env.WS_BETA_END_DATE };
beforeAll(() => { process.env.PHI_ENCRYPTION_KEY = generateKey(); clearKeyCache(); });
afterAll(() => {
  for (const [k, v] of [['PHI_ENCRYPTION_KEY', ORIGINAL.key], ['WS_SHARE_EXCHANGE_ENABLED', ORIGINAL.flag], ['WS_BETA_END_DATE', ORIGINAL.beta]] as const) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  clearKeyCache();
});
beforeEach(() => {
  jest.clearAllMocks(); member.mockResolvedValue(ME); process.env.WS_SHARE_EXCHANGE_ENABLED = '1'; delete process.env.WS_BETA_END_DATE;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('dark: with the switch off, reading and sharing answer 404 and touch nothing', async () => {
  process.env.WS_SHARE_EXCHANGE_ENABLED = 'true';
  db();
  expect((await POST(post(ordinary))).status).toBe(404);
  expect((await GET(new NextRequest(`${URL_}?work=${WORK}`))).status).toBe(404);
  expect((await GET(new NextRequest(`${URL_}?scope=all`))).status).toBe(404);
  expect(query).not.toHaveBeenCalled();
});

it('withdrawal always works, even with the switch off, and deletes only the writer’s own share', async () => {
  delete process.env.WS_SHARE_EXCHANGE_ENABLED;
  db({ deleted: 1 });
  expect((await DELETE(new NextRequest(`${URL_}?id=${SHARE}`, { method: 'DELETE' } as never))).status).toBe(200);
  const [sql, params] = query.mock.calls.find(([s]) => String(s).startsWith('DELETE FROM writer_studio_shared_exchanges WHERE id'))!;
  expect(String(sql).trim()).toBe('DELETE FROM writer_studio_shared_exchanges WHERE id = $1 AND member_id = $2');
  expect(params).toEqual([SHARE, ME]);
  db({ deleted: 0 });
  expect((await DELETE(new NextRequest(`${URL_}?id=${SHARE}`, { method: 'DELETE' } as never))).status).toBe(404);
});

it('Sanctuary: refused before any read of the Work, and nothing is stored', async () => {
  db();
  for (const sanctuary of [true, undefined, 'yes']) {
    const res = await POST(post({ ...ordinary, sanctuary }));
    expect(res.status).toBe(409);
  }
  expect(query.mock.calls.some(([s]) => String(s).includes('living_works'))).toBe(false);
  expect(inserts()).toHaveLength(0);
});

it('another writer’s Work, or a turn that is not MAIA’s, is refused and nothing is stored', async () => {
  db({ owns: false });
  expect((await POST(post(ordinary))).status).toBe(404);
  db({ maia: false });
  expect((await POST(post(ordinary))).status).toBe(404);
  expect(inserts()).toHaveLength(0);
});

it('a share stores the question and answer encrypted, bound to its row and writer, expiring within a year', async () => {
  db();
  const res = await POST(post(ordinary));
  expect(res.status).toBe(200);
  const [, params] = inserts()[0]!;
  const [id, memberId, workId, threadId, turn, ciphertext, meta, createdAt, expiresAt] = params as string[];
  expect([memberId, workId, threadId, turn]).toEqual([ME, WORK, THREAD, 1]);
  expect(ciphertext).not.toContain('chapter one');
  expect(ciphertext).not.toContain('reader’s moment');
  expect(decryptSharedExchange(ciphertext, meta, { rowId: id, memberId: ME }))
    .toEqual({ question: 'How do I open chapter one?', answer: 'Begin with the reader’s moment.' });
  expect(() => decryptSharedExchange(ciphertext, meta, { rowId: id, memberId: OTHER })).toThrow();
  expect(() => decryptSharedExchange(ciphertext, meta, { rowId: SHARE, memberId: ME })).toThrow();
  const days = (Date.parse(expiresAt) - Date.parse(createdAt)) / 86_400_000;
  expect(days).toBeLessThanOrEqual(365);
  expect(days).toBeGreaterThan(364);
});

it('after the beta ends nothing more can be shared; before it, a share expires at the beta’s end', async () => {
  db();
  process.env.WS_BETA_END_DATE = '2000-01-01T00:00:00Z';
  expect((await POST(post(ordinary))).status).toBe(409);
  expect(inserts()).toHaveLength(0);
  const soon = new Date(Date.now() + 10 * 86_400_000).toISOString();
  process.env.WS_BETA_END_DATE = soon;
  expect((await POST(post(ordinary))).status).toBe(200);
  expect((inserts()[0]![1] as string[])[8]).toBe(soon);
});

it('unknown fields are refused (nothing extra can ride along)', async () => {
  db();
  expect((await POST(post({ ...ordinary, note: 'and my whole manuscript' }))).status).toBe(400);
  expect(inserts()).toHaveLength(0);
});

it('only the founder can read everyone’s shares; reads purge expired shares first', async () => {
  db({ founder: false });
  expect((await GET(new NextRequest(`${URL_}?scope=all`))).status).toBe(403);
  db({ founder: true });
  expect((await GET(new NextRequest(`${URL_}?scope=all`))).status).toBe(200);
  const sqls = query.mock.calls.map(([s]) => String(s));
  const purge = sqls.findIndex((s) => s.startsWith('DELETE FROM writer_studio_shared_exchanges WHERE expires_at <= now()'));
  const read = sqls.findIndex((s) => s.includes('FROM writer_studio_shared_exchanges s'));
  expect(purge).toBeGreaterThanOrEqual(0);
  expect(read).toBeGreaterThan(purge);
  expect(sqls[read]).toContain('s.expires_at > now()');
});
