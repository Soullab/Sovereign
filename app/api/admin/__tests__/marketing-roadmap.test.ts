/**
 * Marketing roadmap admin surface.
 * - The route refuses unauthenticated callers and restricts to founder/cto/operations.
 * - The roadmap keeps its proposal standing and its planning-only defaults.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';

const mockCheck = jest.fn<(...a: unknown[]) => Promise<{ authed: boolean }>>();
jest.mock('@/lib/admin/adminAuth', () => ({
  __esModule: true,
  checkAdminAuth: (...a: unknown[]) => mockCheck(...a),
  adminUnauthorized: () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
}));

import { GET } from '../marketing-roadmap/route';
import { ROADMAP, ROADMAP_STANDING } from '@/lib/marketing/strategicRoadmap2027';

const req = () => new NextRequest('http://localhost/api/admin/marketing-roadmap');

describe('GET /api/admin/marketing-roadmap', () => {
  beforeEach(() => mockCheck.mockReset());

  it('returns 401 when admin auth fails', async () => {
    mockCheck.mockResolvedValue({ authed: false });
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it('asks for founder, cto or operations only', async () => {
    mockCheck.mockResolvedValue({ authed: false });
    await GET(req());
    const roles = mockCheck.mock.calls[0][1] as string[];
    expect([...roles].sort()).toEqual(['cto', 'founder', 'operations']);
    expect(roles).not.toContain('tester');
    expect(roles).not.toContain('practitioner_admin');
  });

  it('serves the roadmap with its standing when authorized', async () => {
    mockCheck.mockResolvedValue({ authed: true });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = (await res.json()) as { standing: typeof ROADMAP_STANDING; roadmap: typeof ROADMAP };
    expect(body.standing.ratified).toBe(false);
    expect(body.roadmap.studios).toHaveLength(9);
  });
});

describe('roadmap content standing', () => {
  it('is a proposal, not ratified', () => {
    expect(ROADMAP_STANDING.status).toBe('proposal');
    expect(ROADMAP_STANDING.ratified).toBe(false);
  });

  it('has 48 tasks across three months, with January and February marked as drafts', () => {
    const total = ROADMAP.plan.reduce((n, m) => n + m.weeks.reduce((k, w) => k + w.tasks.length, 0), 0);
    expect(total).toBe(48);
    expect(ROADMAP.plan.find((m) => m.id === 'dec')?.draft).toBe(false);
    expect(ROADMAP.plan.filter((m) => m.id !== 'dec').every((m) => m.draft)).toBe(true);
  });
});
