/**
 * Founder ruling 2026-11-26: keeping a lens response also records that lens on the kept
 * item, so the element mark on a Keep card means "angles you chose to look through".
 * The member's own act, never inferred; recorded once (set-union), scoped to the member.
 */
import { createLensPass } from '../portfolio';
import { query } from '@/lib/db/postgres';

jest.mock('@/lib/db/postgres', () => ({ query: jest.fn() }));

const db = query as jest.Mock;
const MEMBER = '00000000-0000-4000-8000-0000000000bb';
const ATOM = '00000000-0000-4000-8000-0000000000cc';
const now = new Date().toISOString();

beforeEach(() => {
  db.mockReset();
  db.mockImplementation(async (sql: string) => {
    if (/FROM member_memory_atoms/.test(sql) && /SELECT/.test(sql)) {
      return {
        rows: [{
          id: ATOM, member_id: MEMBER, source_type: 'spontaneous', source_id: null, title: 'T', body: 'B',
          primary_register: null, registers: [], elemental_lenses: [], thread_ids: [], status: 'active',
          return_preference: 'contextual_doorway', last_surfaced_at: null, surface_count: 0,
          member_response_status: null, member_response_at: null,
          kept_at: now, last_touched_at: now, created_at: now, updated_at: now, crossing_allowed: false,
        }],
      };
    }
    if (/INSERT INTO member_lens_passes/.test(sql)) {
      return { rows: [{ id: 'p1', member_id: MEMBER, memory_atom_id: ATOM, lens: 'water', prompt: 'q', member_response: 'a', created_at: now }] };
    }
    return { rows: [] };
  });
});

it('records the kept lens on the member’s own atom, once', async () => {
  await createLensPass(MEMBER, { memberId: MEMBER, memoryAtomId: ATOM, lens: 'water', prompt: 'q', memberResponse: 'a' });
  const update = db.mock.calls.find(([sql]) => /UPDATE member_memory_atoms/.test(sql));
  expect(update).toBeDefined();
  const [sql, params] = update!;
  expect(sql).toMatch(/elemental_lenses = \(\s*SELECT ARRAY\(SELECT DISTINCT unnest\(elemental_lenses \|\| ARRAY\[\$3\]\)\)/);
  expect(sql).toMatch(/WHERE member_id = \$1 AND id = \$2/);
  expect(params).toEqual([MEMBER, ATOM, 'water']);
});

it('refuses a pass recorded for another member', async () => {
  await expect(
    createLensPass(MEMBER, { memberId: 'someone-else', memoryAtomId: ATOM, lens: 'fire', prompt: 'q', memberResponse: 'a' }),
  ).rejects.toThrow(/memberId mismatch/);
  expect(db).not.toHaveBeenCalled();
});
