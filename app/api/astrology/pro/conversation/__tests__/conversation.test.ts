/**
 * Kept Pro conversation route: resume returns only the caller's own thread;
 * Keep off deletes the stored turns (ASTRO-PRO-KEEP Phase 1).
 */
import { NextRequest } from 'next/server';
import { query, transaction } from '@/lib/db/postgres';
import { GET, PATCH } from '../route';

jest.mock('@/lib/db/postgres', () => ({ query: jest.fn(), transaction: jest.fn() }));
jest.mock('@/lib/astrology/proRouteAccess', () => {
  const { NextResponse } = jest.requireActual('next/server');
  const headers = { 'Cache-Control': 'private, no-store' };
  return {
    PRO_RESPONSE_HEADERS: headers,
    proError: (status: number, error: string) => NextResponse.json({ error }, { status, headers }),
    resolveProOwner: jest.fn(async () => ({ ok: true, memberId: 'member-A' })),
  };
});

const THREAD = '33333333-3333-3333-3333-333333333333';
const get = (key: string) => GET(new NextRequest(`http://localhost/api/astrology/pro/conversation?subjectKey=${encodeURIComponent(key)}`));
const patch = (body: unknown) => PATCH(new NextRequest('http://localhost/api/astrology/pro/conversation', {
  method: 'PATCH', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
}));

beforeEach(() => { jest.mocked(query).mockReset(); jest.mocked(transaction).mockReset(); });

describe('GET conversation', () => {
  it('returns the caller\'s latest kept thread as q/a pairs', async () => {
    jest.mocked(query)
      .mockResolvedValueOnce({ rows: [{ id: THREAD, keep: true }] } as never)
      .mockResolvedValueOnce({ rows: [
        { speaker: 'member', body: 'Q1' }, { speaker: 'maia', body: 'A1' },
      ] } as never);
    const body = await (await get('ask.natal.own.')).json();
    expect(body).toEqual({ threadId: THREAD, keep: true, turns: [{ q: 'Q1', a: 'A1' }] });
  });

  it('filters every query by the caller\'s member id, so another member\'s thread cannot be returned', async () => {
    jest.mocked(query)
      .mockResolvedValueOnce({ rows: [] } as never);
    const body = await (await get('ask.natal.own.')).json();
    expect(body).toEqual({ threadId: null });
    const [sql, params] = jest.mocked(query).mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('member_id = $1');
    expect(params[0]).toBe('member-A');
  });

  it('also scopes the turns read to the caller', async () => {
    jest.mocked(query)
      .mockResolvedValueOnce({ rows: [{ id: THREAD, keep: true }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    await get('ask.natal.own.');
    const [sql, params] = jest.mocked(query).mock.calls[1] as [string, unknown[]];
    expect(sql).toContain('th.member_id = $2');
    expect(params).toEqual([THREAD, 'member-A']);
  });

  it('refuses a missing subject key', async () => {
    expect((await get('')).status).toBe(400);
  });
});

describe('PATCH conversation', () => {
  function deleteReturns(owned: boolean) {
    jest.mocked(query).mockResolvedValue({ rows: owned ? [{ id: THREAD }] : [] } as never);
  }

  it('keep=false deletes the whole thread (turns go by cascade), scoped to the caller', async () => {
    deleteReturns(true);
    const res = await patch({ threadId: THREAD, keep: false });
    expect(res.status).toBe(200);
    const [sql, params] = jest.mocked(query).mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/DELETE FROM astro_pro_threads WHERE id = \$1 AND member_id = \$2/);
    expect(params[0]).toBe(THREAD);
    expect(jest.mocked(query).mock.calls.some(([q]) => /UPDATE/.test(String(q)))).toBe(false);
  });

  it('does nothing to a thread that is not the caller\'s', async () => {
    deleteReturns(false);
    const res = await patch({ threadId: THREAD, keep: false });
    expect(res.status).toBe(404);
  });

  it('refuses a malformed request', async () => {
    expect((await patch({ threadId: 'nope', keep: false })).status).toBe(400);
    expect((await patch({ threadId: THREAD })).status).toBe(400);
  });
});
