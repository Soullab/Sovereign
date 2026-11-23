/**
 * GET /api/astrology/pro/access answers only "does this signed-in member have
 * Pro", for the verified session's own member, and refuses as Pro does.
 */
const resolveProOwner = jest.fn();
jest.mock('@/lib/astrology/proRouteAccess', () => {
  const { NextResponse } = jest.requireActual('next/server');
  const headers = { 'Cache-Control': 'private, no-store' };
  return {
    PRO_RESPONSE_HEADERS: headers,
    resolveProOwner: (...args: unknown[]) => resolveProOwner(...args),
    __refuse: (status: number, error: string) => NextResponse.json({ error }, { status, headers }),
  };
});

import { NextRequest } from 'next/server';
import { GET } from '../route';

const refuse = (status: number, error: string) =>
  (jest.requireMock('@/lib/astrology/proRouteAccess') as { __refuse: (s: number, e: string) => Response }).__refuse(status, error);
const req = () => new NextRequest('https://soullab.life/api/astrology/pro/access');

describe('Pro access check', () => {
  beforeEach(() => resolveProOwner.mockReset());

  it('says yes for a member with Pro, reading nothing else', async () => {
    resolveProOwner.mockResolvedValue({ ok: true, memberId: 'm-1' });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pro: true });
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(resolveProOwner).toHaveBeenCalledWith(expect.anything(), false);
  });

  it.each([[401, 'session_required'], [403, 'preview_access_required'], [404, 'preview_unavailable']])(
    'refuses exactly as Pro does (%s %s)', async (status, error) => {
      resolveProOwner.mockResolvedValue({ ok: false, response: refuse(status, error) });
      const res = await GET(req());
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ error });
    });
});
