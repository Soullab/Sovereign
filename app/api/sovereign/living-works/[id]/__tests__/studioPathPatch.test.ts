/**
 * PATCH /api/sovereign/living-works/[id] — the Work's Studio program (review findings F1/F2, 2026-11-15).
 * Hermetic: no database. The migration's FK and fixed-once trigger are the database backstop; this pins the route.
 *   - only a registered program id is accepted (never free text, never null);
 *   - a program is chosen ONCE: the same id again is fine, a different id or clearing it is refused (409);
 *   - a racing second choice refused by the trigger reads as the same 409.
 */
jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('@/lib/cabin/request', () => ({ cabinStore: jest.fn(), cabinMemberFromRequest: jest.fn(), setCabinSessionCookie: jest.fn() }));
jest.mock('@/lib/db/postgres', () => ({ query: jest.fn(), transaction: jest.fn() }));
jest.mock('@/lib/auth/getMemberFromRequest', () => ({ getMemberIdFromRequest: jest.fn() }));
jest.mock('@/lib/manuscript/source/eraseManuscript', () => ({ sweepVaultErasureQueue: jest.fn() }));
jest.mock('@/lib/recovery/r20DeletionLedger', () => ({ sealR20DeletionLedger: jest.fn(), r20LedgerErrorCode: jest.fn(() => 'R20_X') }));
import { NextRequest } from 'next/server';
import { query } from '@/lib/db/postgres';
import { getMemberIdFromRequest } from '@/lib/auth/getMemberFromRequest';
import { PATCH } from '../route';

const q = query as jest.Mock;
const member = getMemberIdFromRequest as jest.Mock;
const MEMBER = '11111111-1111-4111-8111-111111111111';
const WORK = 'a0000000-0000-4000-8000-00000000000a';
const req = (body: unknown) => new NextRequest(`https://soullab.life/api/sovereign/living-works/${WORK}`, { method: 'PATCH', body: JSON.stringify(body) });
const ctx = { params: Promise.resolve({ id: WORK }) };
const row = (studio_path: string | null) => ({
  id: WORK, title: 'College essay', purpose: null, form: null, stage: null, manuscript_state: null,
  maia_revisions_paused: true, studio_path, created_at: 't', updated_at: 't',
});
const updates = () => q.mock.calls.filter(([sql]) => String(sql).includes('UPDATE living_works'));

beforeEach(() => { jest.resetAllMocks(); member.mockResolvedValue(MEMBER); });

function db(existing: string | null, updateError?: Error, age: { age_band: string; supervision_attested: boolean } | null | 'throw' = { age_band: 'adult', supervision_attested: false }) {
  q.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM member_age_attestations')) {
      if (age === 'throw') throw new Error('db down');
      return { rows: age ? [age] : [] };
    }
    if (sql.includes('SELECT studio_path FROM living_works')) return { rows: [{ studio_path: existing }] };
    if (sql.includes('UPDATE living_works')) {
      if (updateError) throw updateError;
      return { rows: [row('college-essay')] };
    }
    return { rows: [] };
  });
}

it('a Work with no program may take a registered one, once, through the member\'s own act', async () => {
  db(null);
  const res = await PATCH(req({ studioPath: 'college-essay' }), ctx as never);
  expect(res.status).toBe(200);
  expect((await res.json()).work.studioPath).toBe('college-essay');
  const [sql, params] = updates()[0]!;
  expect(String(sql)).toContain('studio_path = $');
  expect(params).toContain('college-essay');
});

it('the same program again is not a change', async () => {
  db('college-essay');
  expect((await PATCH(req({ studioPath: 'college-essay' }), ctx as never)).status).toBe(200);
});

it('NEGATIVE: an unregistered program is refused before anything is read or written', async () => {
  db(null);
  const res = await PATCH(req({ studioPath: 'grant-proposal' }), ctx as never);
  expect(res.status).toBe(400);
  expect((await res.json()).error).toBe('unknown_studio_path');
  expect(updates()).toHaveLength(0);
});

it('NEGATIVE: a program cannot be cleared', async () => {
  db('college-essay');
  const res = await PATCH(req({ studioPath: null }), ctx as never);
  expect(res.status).toBe(400);
  expect(updates()).toHaveLength(0);
});

it('NEGATIVE: once chosen, a Work\'s program cannot be changed to another', async () => {
  // A second registered program is simulated by a stored id the request does not match.
  db('another-program');
  const res = await PATCH(req({ studioPath: 'college-essay' }), ctx as never);
  expect(res.status).toBe(409);
  expect((await res.json()).error).toBe('studio_path_fixed');
  expect(updates()).toHaveLength(0);
});

it('a racing second choice refused by the database trigger reads as the same 409', async () => {
  const err = Object.assign(new Error('living_works.studio_path is fixed once chosen'), { code: '23514' });
  db(null, err);
  const res = await PATCH(req({ studioPath: 'college-essay' }), ctx as never);
  expect(res.status).toBe(409);
});

it('every registered program is seeded in the database registry (F1: registry and database agree)', () => {
  const fs = jest.requireActual('fs') as typeof import('fs');
  const path = jest.requireActual('path') as typeof import('path');
  const dir = path.join(process.cwd(), 'database/migrations');
  const seeded = fs.readdirSync(dir).filter((f) => f.endsWith('.sql'))
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n');
  const { STUDIO_PATHS } = jest.requireActual('@/lib/writersStudio/studioPaths');
  for (const p of STUDIO_PATHS) {
    expect(seeded).toMatch(new RegExp(`INSERT INTO studio_programs \\(id\\) VALUES \\('${p.id}'\\)`));
  }
});

describe('the writer moves their Work through its program’s stages (founder 2026-11-16)', () => {
  function dbStage(program: string | null) {
    q.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT studio_path FROM living_works')) return { rows: [{ studio_path: program }] };
      if (sql.includes('UPDATE living_works')) return { rows: [{ ...row(program), studio_stage: 'voice' }] };
      return { rows: [] };
    });
  }
  it('a built stage of the Work’s own program is saved by the member’s own act', async () => {
    dbStage('college-essay');
    const res = await PATCH(req({ studioStage: 'voice' }), ctx as never);
    expect(res.status).toBe(200);
    expect((await res.json()).work.studioStage).toBe('voice');
    const [sql, params] = updates()[0]!;
    expect(String(sql)).toContain('studio_stage = $');
    expect(String(sql)).toContain('WHERE id = $1 AND member_id = $2');
    expect(params).toContain('voice');
  });
  it('NEGATIVE: an unknown stage, a non-string, or a stage on a Work with no program is refused and nothing is written', async () => {
    dbStage('college-essay');
    for (const bad of ['chapter-one', 'Voice', 7, null]) {
      expect((await PATCH(req({ studioStage: bad }), ctx as never)).status).toBe(400);
    }
    dbStage(null);
    const res = await PATCH(req({ studioStage: 'voice' }), ctx as never);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'no_studio_program' });
    expect(updates()).toHaveLength(0);
  });
  it('another member’s Work is not found', async () => {
    q.mockImplementation(async () => ({ rows: [] }));
    expect((await PATCH(req({ studioStage: 'voice' }), ctx as never)).status).toBe(404);
    expect(updates()).toHaveLength(0);
  });
});

describe('founder ruling 2026-11-16 (#1900): a Work joins College Essay only after the member has attested', () => {
  it.each([
    ['no attestation', null],
    ['an unreadable record (fails closed)', 'throw'],
  ] as const)('%s → 403, and nothing is written', async (_label, age) => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    db(null, undefined, age as never);
    const res = await PATCH(req({ studioPath: 'college-essay' }), ctx as never);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'age_attestation_required' });
    expect(updates()).toHaveLength(0);
  });

  it('a supervised minor (13–17) may begin; an adult may begin', async () => {
    db(null, undefined, { age_band: 'minor', supervision_attested: true });
    expect((await PATCH(req({ studioPath: 'college-essay' }), ctx as never)).status).toBe(200);
    db(null, undefined, { age_band: 'adult', supervision_attested: false });
    expect((await PATCH(req({ studioPath: 'college-essay' }), ctx as never)).status).toBe(200);
  });

  it('the check reads only this member’s own attestation', async () => {
    db(null);
    await PATCH(req({ studioPath: 'college-essay' }), ctx as never);
    const call = q.mock.calls.find(([sql]) => String(sql).includes('FROM member_age_attestations'))!;
    expect(call[1]).toEqual([MEMBER]);
  });
});
