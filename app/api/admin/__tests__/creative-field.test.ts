/**
 * Creative Field admin surface, stage 1 (Soullab/Sovereign#2417).
 * - The route refuses unauthenticated callers and restricts to founder/cto/operations.
 * - Stage 1 stays read-only: no write handlers, worker not connected.
 * - Every tool carries its license; conditional or paid tools carry their obligations.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';

const mockCheck = jest.fn<(...a: unknown[]) => Promise<{ authed: boolean }>>();
jest.mock('@/lib/admin/adminAuth', () => ({
  __esModule: true,
  checkAdminAuth: (...a: unknown[]) => mockCheck(...a),
  adminUnauthorized: () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
}));

import * as routeModule from '../creative-field/route';
import { GET } from '../creative-field/route';
import { CREATIVE_TOOLS, CREATIVE_FIELD_STANDING, type CreativeFieldPayload } from '@/lib/creative/toolRegistry';

const req = () => new NextRequest('http://localhost/api/admin/creative-field');

describe('GET /api/admin/creative-field', () => {
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

  it('serves the registry with its standing when authorized, uncached', async () => {
    mockCheck.mockResolvedValue({ authed: true });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = (await res.json()) as CreativeFieldPayload;
    expect(body.standing.mode).toBe('read-only');
    expect(body.tools.map((t) => t.id)).toEqual(CREATIVE_TOOLS.map((t) => t.id));
  });

  it('exposes no write handlers in stage 1', () => {
    for (const verb of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect((routeModule as Record<string, unknown>)[verb]).toBeUndefined();
    }
  });
});

describe('Creative Field registry', () => {
  it('is stage 1, read-only, with no worker connected', () => {
    expect(CREATIVE_FIELD_STANDING.stage).toBe(1);
    expect(CREATIVE_FIELD_STANDING.mode).toBe('read-only');
    expect(CREATIVE_FIELD_STANDING.worker.connected).toBe(false);
  });

  it('has unique tool ids and limits every tool to the internal team', () => {
    const ids = CREATIVE_TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of CREATIVE_TOOLS) {
      expect([...t.allowedRoles].sort()).toEqual(['cto', 'founder', 'operations']);
    }
  });

  it('gives every tool a license with a link', () => {
    for (const t of CREATIVE_TOOLS) {
      expect(t.license.name.length).toBeGreaterThan(0);
      expect(t.license.url).toMatch(/^https:\/\//);
    }
  });

  it('carries the LTX license obligations, including machine-generated disclosure', () => {
    const ltx = CREATIVE_TOOLS.find((t) => t.id === 'video.ltx23-distilled');
    expect(ltx?.license.commercialUse).toBe('conditional');
    expect(ltx?.obligations).toEqual(
      expect.arrayContaining(['disclose-machine-generated', 'revenue-threshold-10m', 'no-competing-product', 'no-safety-bypass']),
    );
  });

  it('keeps paid tools disabled and behind cost approval', () => {
    const paid = CREATIVE_TOOLS.filter((t) => t.costClass === 'paid');
    expect(paid.length).toBeGreaterThan(0);
    for (const t of paid) {
      expect(t.status).toBe('disabled');
      expect(t.obligations).toContain('cost-approval-required');
    }
  });

  it('does not expose local filesystem paths', () => {
    expect(JSON.stringify(CREATIVE_TOOLS)).not.toMatch(/\/Users\/|\/Volumes\/|~\//);
  });
});
