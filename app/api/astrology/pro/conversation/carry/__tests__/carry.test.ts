/**
 * "Keep with MAIA" (ASTRO-PRO-KEEP Phase 2): one own-chart exchange is carried
 * into MAIA's memory through keepSource, by the member's press only. A client
 * chart, a two-chart thread, another member's thread or a malformed request is
 * refused and nothing is kept.
 */
import { NextRequest } from 'next/server';
import { resolveCarrySource } from '@/lib/astrology/proConversationStore';
import { keepSource } from '@/lib/psyche/portfolio';
import { POST } from '../route';

jest.mock('@/lib/astrology/proConversationStore', () => ({
  isThreadId: (v: unknown) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v),
  resolveCarrySource: jest.fn(),
}));
jest.mock('@/lib/psyche/portfolio', () => ({ keepSource: jest.fn() }));
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
const TURN_ID = '66666666-6666-6666-6666-666666666666';
const post = (body: unknown) => POST(new NextRequest('http://localhost/api/astrology/pro/conversation/carry', {
  method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
}));

beforeEach(() => {
  jest.mocked(resolveCarrySource).mockReset();
  jest.mocked(keepSource).mockReset().mockResolvedValue({ id: 'atom-1', wasCreated: true } as never);
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

describe('POST carry', () => {
  it('keeps the exchange verbatim through keepSource, with its origin, for the caller only', async () => {
    jest.mocked(resolveCarrySource).mockResolvedValue({ ok: true, source: {
      memberTurn: 'What is my Saturn return asking?', maiaTurn: 'Your Saturn returns to Capricorn…',
      maiaTurnId: TURN_ID, section: 'natal', askedAt: '2026-11-20T10:00:00.000Z',
    } });
    const res = await post({ threadId: THREAD, turnIndex: 3 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ carried: true, atomId: 'atom-1', created: true });
    expect(resolveCarrySource).toHaveBeenCalledWith('member-A', THREAD, 3);
    expect(keepSource).toHaveBeenCalledWith('member-A', {
      memberId: 'member-A', sourceType: 'astro_pro_exchange', sourceId: TURN_ID,
      title: 'What is my Saturn return asking?', body: 'Your Saturn returns to Capricorn…',
      astroProOrigin: { provenance: {
        surface: 'astro_pro', section: 'natal', thread_id: THREAD, turn_index: 3, asked_at: '2026-11-20T10:00:00.000Z',
      } },
    });
  });

  it('clips a long reading instead of summarising it', async () => {
    jest.mocked(resolveCarrySource).mockResolvedValue({ ok: true, source: {
      memberTurn: 'Q', maiaTurn: 'x'.repeat(5000), maiaTurnId: TURN_ID, section: 'natal', askedAt: '2026-11-20T10:00:00.000Z',
    } });
    await post({ threadId: THREAD, turnIndex: 1 });
    const input = jest.mocked(keepSource).mock.calls[0][1];
    expect(input.body).toBe(`${'x'.repeat(1200)}…`);
  });

  it('refuses a client chart or two-chart thread and keeps nothing', async () => {
    jest.mocked(resolveCarrySource).mockResolvedValue({ ok: false, reason: 'not_own_chart' });
    const res = await post({ threadId: THREAD, turnIndex: 1 });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('own_chart_only');
    expect(keepSource).not.toHaveBeenCalled();
  });

  it('refuses a thread that is not the caller\'s kept thread, or a turn that is not an answer', async () => {
    jest.mocked(resolveCarrySource).mockResolvedValueOnce({ ok: false, reason: 'thread_not_found' })
      .mockResolvedValueOnce({ ok: false, reason: 'turn_not_found' });
    expect((await post({ threadId: THREAD, turnIndex: 1 })).status).toBe(404);
    expect((await post({ threadId: THREAD, turnIndex: 2 })).status).toBe(404);
    expect(keepSource).not.toHaveBeenCalled();
  });

  it.each([
    [{}], [{ threadId: 'nope', turnIndex: 1 }], [{ threadId: THREAD, turnIndex: '1' }],
    [{ threadId: THREAD, turnIndex: 1.5 }], [{ threadId: THREAD, turnIndex: 1, subjectKey: 'ask.natal.own.' }],
  ])('refuses a malformed request %j', async (body) => {
    expect((await post(body)).status).toBe(400);
    expect(resolveCarrySource).not.toHaveBeenCalled();
  });

  it('answers 503 without content when keeping fails', async () => {
    jest.mocked(resolveCarrySource).mockResolvedValue({ ok: true, source: {
      memberTurn: 'Q', maiaTurn: 'A', maiaTurnId: TURN_ID, section: 'natal', askedAt: '2026-11-20T10:00:00.000Z',
    } });
    jest.mocked(keepSource).mockRejectedValue(new Error('secret detail'));
    const res = await post({ threadId: THREAD, turnIndex: 1 });
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toContain('secret');
  });
});
