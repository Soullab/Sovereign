/**
 * ASTRO-PRO-KEEP Phase 2 — a carried Pro Astrology exchange in MAIA's memory.
 *
 * keepSource: an astro_pro_exchange atom is written only with its origin, and
 * states its return authority, provenance and epistemic standing explicitly at
 * the write site (P6). Other keeps are written exactly as before.
 * formatAtomsForPrompt: the member's question and MAIA's earlier reading are
 * rendered as an interpretation at the time, never as a finding.
 */
import { keepSource } from '../portfolio';
import type { KeepGestureInput } from '../types';
import { formatAtomsForPrompt, type MemoryAtomSnapshot } from '../../maia/memoryAtomsLoader';

jest.mock('@/lib/db/postgres', () => ({ query: jest.fn() }));
const { query } = jest.requireMock('@/lib/db/postgres');

const MEMBER = '11111111-1111-4111-8111-111111111111';
const TURN_ID = '66666666-6666-4666-8666-666666666666';
const origin = { provenance: {
  surface: 'astro_pro' as const, section: 'natal', thread_id: '33333333-3333-4333-8333-333333333333',
  turn_index: 3, asked_at: '2026-11-20T10:00:00.000Z',
} };

const atomRow = (over: Record<string, unknown> = {}) => ({ rows: [{
  id: 'atom-1', member_id: MEMBER, source_type: 'astro_pro_exchange', source_id: TURN_ID,
  title: 'Q', body: 'A', primary_register: null, registers: [], elemental_lenses: [], thread_ids: [],
  status: 'active', return_preference: 'contextual_doorway', last_surfaced_at: null, surface_count: 0,
  member_response_status: null, member_response_at: null, kept_at: new Date().toISOString(),
  last_touched_at: new Date().toISOString(), created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(), crossing_allowed: false, was_created: true, ...over,
}] });

function insertCall(): [string, unknown[]] {
  const call = query.mock.calls.find(([sql]: [string]) => /INSERT INTO member_memory_atoms/i.test(sql));
  if (!call) throw new Error('no insert');
  return call as [string, unknown[]];
}

beforeEach(() => {
  jest.clearAllMocks();
  query.mockImplementation((sql: string) =>
    Promise.resolve(/INSERT INTO member_memory_atoms/i.test(sql) ? atomRow() : { rows: [] }));
});

const carried = (over: Partial<KeepGestureInput> = {}): KeepGestureInput => ({
  memberId: MEMBER, sourceType: 'astro_pro_exchange', sourceId: TURN_ID,
  title: 'What is my Saturn return asking?', body: 'Your Saturn returns…', astroProOrigin: origin, ...over,
});

describe('keepSource — astro_pro_exchange', () => {
  it('writes return authority, provenance and epistemic standing explicitly', async () => {
    await keepSource(MEMBER, carried());
    const [sql, params] = insertCall();
    expect(sql).toContain('return_preference, provenance, epistemological_status');
    expect(params.slice(9)).toEqual(['contextual_doorway', JSON.stringify(origin.provenance), 'inferred']);
    expect(params[1]).toBe('astro_pro_exchange');
    expect(params[2]).toBe(TURN_ID);
    expect(params[4]).toBe('Your Saturn returns…');
  });

  it('is idempotent on the same turn (ON CONFLICT on member, source type and source id)', async () => {
    await keepSource(MEMBER, carried());
    expect(insertCall()[0]).toContain('ON CONFLICT (member_id, source_type, source_id)');
  });

  it('refuses an astro_pro_exchange without its origin', async () => {
    await expect(keepSource(MEMBER, carried({ astroProOrigin: undefined }))).rejects.toThrow(/astroProOrigin/);
    expect(query).not.toHaveBeenCalled();
  });

  it('refuses an origin on any other source type', async () => {
    await expect(keepSource(MEMBER, carried({ sourceType: 'idea' }))).rejects.toThrow(/only for astro_pro_exchange/);
  });

  it('gives ordinary keeps only the shared member-conferred return authority (no Pro columns)', async () => {
    query.mockImplementation((sql: string) =>
      Promise.resolve(/INSERT INTO member_memory_atoms/i.test(sql) ? atomRow({ source_type: 'idea' }) : { rows: [] }));
    await keepSource(MEMBER, { memberId: MEMBER, sourceType: 'idea', sourceId: TURN_ID, title: 't', body: null });
    const [sql, params] = insertCall();
    expect(sql).not.toContain('provenance');
    expect(params).toHaveLength(10);
    expect(params[9]).toBe('contextual_doorway');
  });
});

describe('formatAtomsForPrompt — astro_pro_exchange', () => {
  const snapshot = (over: Partial<MemoryAtomSnapshot> = {}): MemoryAtomSnapshot => ({
    id: 'atom-1', title: 'What is my Saturn return asking?', body: 'Your Saturn returns to Capricorn…',
    primaryRegister: null, registers: [], elementalLenses: [], status: 'active',
    keptAt: new Date(Date.now() - 3 * 86_400_000), returnPreference: 'contextual_doorway',
    sourceType: 'astro_pro_exchange', isBreakthrough: false, markedBreakthroughAt: null,
    epistemologicalStatus: 'inferred', facilitatorId: null, ...over,
  });

  it('names where it came from, who said what, and that the reading was an interpretation', () => {
    const out = formatAtomsForPrompt([snapshot()]);
    expect(out).toContain('In Pro Astrology, about their own chart, the member asked: "What is my Saturn return asking?"');
    expect(out).toContain('Your reading then (an interpretation offered at the time, not a finding about them): Your Saturn returns to Capricorn…');
    expect(out).toContain('No cross-atom claims');
  });

  it('clips a long reading', () => {
    const out = formatAtomsForPrompt([snapshot({ body: 'y'.repeat(2000) })]);
    expect(out).toContain(`${'y'.repeat(600)}…`);
    expect(out).not.toContain('y'.repeat(601));
  });
});
