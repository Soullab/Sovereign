/**
 * GET /api/reflections/river — the Web view's data boundary (Life Web step 1).
 *
 * Pins what the founder's acceptance asked to be verified: member isolation, archived
 * exclusion, honest truncation, no prose from the other end, and that other-end lookups
 * cannot take the whole connection pool.
 */
import { GET } from '../route';
import { requireMemberId } from '@/lib/auth/session';
import { query } from '@/lib/db/postgres';
import { resolveFacetFlowSource, resolveFacetTarget } from '@/lib/house/facetCrossing.server';

jest.mock('@/lib/auth/session', () => ({ requireMemberId: jest.fn() }));
jest.mock('@/lib/db/postgres', () => ({ query: jest.fn() }));
jest.mock('@/lib/house/facetCrossing.server', () => ({
  resolveFacetTarget: jest.fn(),
  resolveFacetFlowSource: jest.fn(),
}));

const MEMBER = '00000000-0000-4000-8000-0000000000aa';
const auth = requireMemberId as jest.Mock;
const db = query as jest.Mock;
const target = resolveFacetTarget as jest.Mock;
const source = resolveFacetFlowSource as jest.Mock;

function node(i: number) {
  return {
    id: `r${i}`,
    title: `Reflection ${i}`,
    created_at: new Date(Date.UTC(2026, 0, 1) + i * 60_000),
    source_type: 'journal',
    element: 'water',
    draft: false,
  };
}

function crossing(i: number, reflectionId: string) {
  return {
    id: `c${i}`,
    crossing_id: 'reflections-name-change',
    source_facet: 'reflections',
    source_ref_id: reflectionId,
    target_facet: 'changes',
    target_ref_id: `ch${i}`,
    created_at: new Date(Date.UTC(2026, 5, 1)),
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  auth.mockResolvedValue(MEMBER);
});

describe('GET /api/reflections/river', () => {
  it('refuses without a member', async () => {
    auth.mockRejectedValue(new Error('no session'));
    const res = await GET();
    expect(res.status).toBe(401);
    expect(db).not.toHaveBeenCalled();
  });

  it('reads only the signed-in member’s non-archived Reflections and crossings', async () => {
    db.mockResolvedValueOnce({ rows: [node(1)] }).mockResolvedValueOnce({ rows: [] });
    await GET();
    const [nodesSql, nodesParams] = db.mock.calls[0];
    expect(nodesSql).toMatch(/FROM reflection_capsules/);
    expect(nodesSql).toMatch(/WHERE user_id = \$1/);
    expect(nodesSql).toMatch(/archived = false/);
    expect(nodesSql).not.toMatch(/summary|gold_lines|source_excerpt/);
    expect(nodesParams[0]).toBe(MEMBER);
    const [crossSql, crossParams] = db.mock.calls[1];
    expect(crossSql).toMatch(/FROM member_facet_crossings/);
    expect(crossSql).toMatch(/WHERE member_id = \$1::uuid/);
    expect(crossParams).toEqual([MEMBER]);
  });

  it('keeps the most recent thousand, oldest first, and reports truncation only when rows were left out', async () => {
    const newestFirst = Array.from({ length: 1001 }, (_, i) => node(1001 - i));
    db.mockResolvedValueOnce({ rows: newestFirst }).mockResolvedValueOnce({ rows: [] });
    const body = await (await GET()).json();
    expect(db.mock.calls[0][0]).toMatch(/ORDER BY created_at DESC/);
    expect(body.nodes).toHaveLength(1000);
    expect(body.nodes[999].id).toBe('r1001');
    expect(body.nodes[0].id).toBe('r2');
    expect(body.truncated).toBe(true);

    db.mockReset();
    db.mockResolvedValueOnce({ rows: newestFirst.slice(0, 1000) }).mockResolvedValueOnce({ rows: [] });
    expect((await (await GET()).json()).truncated).toBe(false);
  });

  it('carries only label and return link from the other end, never its prose', async () => {
    db.mockResolvedValueOnce({ rows: [node(1)] }).mockResolvedValueOnce({ rows: [crossing(1, 'r1')] });
    target.mockResolvedValue({
      facet: 'changes', refId: 'ch1', label: 'Leave the job', href: '/studio/changes/ch1',
      excerpt: 'PRIVATE PROSE', description: 'PRIVATE PROSE',
    });
    const body = await (await GET()).json();
    expect(target).toHaveBeenCalledWith(MEMBER, 'changes', 'ch1');
    expect(body.threads).toHaveLength(1);
    expect(body.threads[0].other).toEqual({ facet: 'changes', label: 'Leave the job', href: '/studio/changes/ch1' });
    expect(JSON.stringify(body)).not.toContain('PRIVATE PROSE');
  });

  it('drops crossings whose Reflection is archived or not the member’s', async () => {
    db.mockResolvedValueOnce({ rows: [node(1)] }).mockResolvedValueOnce({ rows: [crossing(1, 'r-archived')] });
    const body = await (await GET()).json();
    expect(body.threads).toHaveLength(0);
    expect(target).not.toHaveBeenCalled();
  });

  it('gives both Reflections a thread when one is carried into another', async () => {
    db.mockResolvedValueOnce({ rows: [node(1), node(2)] }).mockResolvedValueOnce({
      rows: [{ ...crossing(1, 'r1'), target_facet: 'reflections', target_ref_id: 'r2' }],
    });
    target.mockResolvedValue(null);
    source.mockResolvedValue(null);
    const body = await (await GET()).json();
    expect(body.threads.map((t: { reflectionId: string; direction: string }) => `${t.reflectionId}:${t.direction}`))
      .toEqual(['r1:out', 'r2:in']);
  });

  it('never runs more than four other-end lookups at once', async () => {
    const nodes = Array.from({ length: 50 }, (_, i) => node(i));
    db.mockResolvedValueOnce({ rows: nodes }).mockResolvedValueOnce({
      rows: nodes.map((n, i) => crossing(i, n.id)),
    });
    let inFlight = 0;
    let peak = 0;
    target.mockImplementation(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 2));
      inFlight -= 1;
      return null;
    });
    const body = await (await GET()).json();
    expect(target).toHaveBeenCalledTimes(50);
    expect(body.threads).toHaveLength(50);
    expect(peak).toBeLessThanOrEqual(4);
  });
});
