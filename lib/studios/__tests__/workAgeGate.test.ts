/** @jest-environment node */
/**
 * The age gate by the Work's RECORDED program (founder ruling 2026-11-16, #1900; production walk 2026-11-16: MAIA read a
 * College Essay page with 0 attestations on record, because her Studio routes never named the program).
 * Unit: real module, stubbed database and attestation read.
 */
import fs from 'fs';
import path from 'path';

const query = jest.fn();
jest.mock('@/lib/db/postgres', () => ({ query: (...a: unknown[]) => query(...a) }));
const latestAge = jest.fn();
jest.mock('@/lib/studios/ageAttestationRead', () => ({
  latestAgeAttestation: (...a: unknown[]) => latestAge(...a),
  ageAttestationAdmits: jest.requireActual('@/lib/studios/ageAttestationRead').ageAttestationAdmits,
}));

import {
  MANUSCRIPT_PROGRAMS_SQL, THREAD_SUBJECT_SQL, WORK_PROGRAM_SQL,
  ageGateForManuscript, ageGateForThread, ageGateForWork, ageGateRefusal, workRequiresAgeAttestation,
} from '../workAgeGate';

const ME = '11111111-1111-4111-8111-111111111111';
const rows = (r: unknown[]) => ({ rows: r });
const programs = (...p: (string | null)[]) => rows(p.map((studio_path) => ({ studio_path })));

beforeEach(() => { query.mockReset(); latestAge.mockReset(); });

describe('a Work outside any gated program', () => {
  it('admits without reading the attestation (an ordinary Work never asks for an age)', async () => {
    query.mockResolvedValueOnce(programs(null));
    expect(await ageGateForWork(ME, 'w')).toEqual({ ok: true });
    expect(latestAge).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith(WORK_PROGRAM_SQL, ['w', ME]);
  });
  it('an id that matches no Work of this member admits here; the route’s own not-found follows', async () => {
    query.mockResolvedValueOnce(rows([]));
    expect(await ageGateForWork(ME, 'not-a-uuid')).toEqual({ ok: true });
  });
});

describe('⭐ a Work recorded under College Essay', () => {
  it('refuses with no attestation, an unreadable one, or a minor without supervision', async () => {
    for (const a of [null, 'unknown', { band: 'minor', supervised: false }]) {
      query.mockResolvedValueOnce(programs('college-essay'));
      latestAge.mockResolvedValueOnce(a);
      expect(await ageGateForWork(ME, 'w')).toEqual({ ok: false, refusal: 'age_attestation_required' });
    }
    expect(latestAge).toHaveBeenCalledWith(ME);
  });
  it('admits an adult, or a minor who attested supervision', async () => {
    for (const a of [{ band: 'adult', supervised: false }, { band: 'minor', supervised: true }]) {
      query.mockResolvedValueOnce(programs('college-essay'));
      latestAge.mockResolvedValueOnce(a);
      expect(await ageGateForWork(ME, 'w')).toEqual({ ok: true });
    }
  });
});

describe('manuscripts and threads reach the Work’s program', () => {
  it('a manuscript declared in two Works is gated if EITHER requires it', async () => {
    query.mockResolvedValueOnce(programs(null, 'college-essay'));
    latestAge.mockResolvedValueOnce(null);
    expect(await ageGateForManuscript(ME, 'm')).toEqual({ ok: false, refusal: 'age_attestation_required' });
    expect(query).toHaveBeenCalledWith(MANUSCRIPT_PROGRAMS_SQL, ['m', ME]);
  });
  it('a thread about a Work is gated by that Work; a thread about a manuscript by its Works', async () => {
    query.mockResolvedValueOnce(rows([{ living_work_id: 'w', manuscript_id: null }])).mockResolvedValueOnce(programs('college-essay'));
    latestAge.mockResolvedValueOnce(null);
    expect(await ageGateForThread(ME, 't')).toEqual({ ok: false, refusal: 'age_attestation_required' });
    expect(query.mock.calls[0]).toEqual([THREAD_SUBJECT_SQL, ['t', ME]]);
    expect(query.mock.calls[1]).toEqual([WORK_PROGRAM_SQL, ['w', ME]]);

    query.mockReset();
    query.mockResolvedValueOnce(rows([{ living_work_id: null, manuscript_id: 'm' }])).mockResolvedValueOnce(programs('college-essay'));
    latestAge.mockResolvedValueOnce({ band: 'adult', supervised: false });
    expect(await ageGateForThread(ME, 't')).toEqual({ ok: true });
    expect(query.mock.calls[1]).toEqual([MANUSCRIPT_PROGRAMS_SQL, ['m', ME]]);
  });
});

describe('fails closed', () => {
  it('an unreadable program refuses as unavailable (503), for Works, manuscripts and threads', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    query.mockRejectedValue(new Error('down'));
    for (const g of [ageGateForWork(ME, 'w'), ageGateForManuscript(ME, 'm'), ageGateForThread(ME, 't')]) {
      expect(await g).toEqual({ ok: false, refusal: 'age_check_unavailable' });
    }
    expect(await workRequiresAgeAttestation(ME, 'w')).toBe('unknown');
    expect(latestAge).not.toHaveBeenCalled();
  });
  it('the refusal a route returns: 403 to attest, 503 when it could not be checked; both keys', () => {
    expect(ageGateRefusal({ ok: false, refusal: 'age_attestation_required' }))
      .toEqual({ status: 403, body: { error: 'age_attestation_required', refusal: 'age_attestation_required' } });
    expect(ageGateRefusal({ ok: false, refusal: 'age_check_unavailable' }).status).toBe(503);
  });
});

describe('⭐ every route where MAIA reads or answers about a Work carries the gate', () => {
  const root = process.cwd();
  const routes: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory() && e.name !== '__tests__' && e.name !== 'node_modules') walk(p);
      else if (e.name === 'route.ts') routes.push(p);
    }
  };
  walk(path.join(root, 'app/api'));
  const src = (p: string) => fs.readFileSync(p, 'utf8');
  /* The registry of Writer routes that make MAIA read: every one is exported through meteredRoute and binds the meter. */
  const metered = routes.filter((p) => /\bbindMaiaMeter\(/.test(src(p)));
  /* MAIA acts outside the meter (lib/writersStudio/maiaMeter.ts UNMETERED_WRITER_MAIA_ACTS), named here explicitly. */
  const unmetered = ['app/api/sovereign/manuscripts/[id]/candidates/route.ts', 'app/api/writers-studio/focus/route.ts'];

  it('finds the metered registry (a vanished list would make this pin decorative)', () => {
    expect(metered.length).toBeGreaterThanOrEqual(14);
  });
  it.each([...metered.map((p) => path.relative(root, p)), ...unmetered])('%s checks the age gate wherever it binds MAIA', (rel) => {
    const s = src(path.join(root, rel));
    expect(s).toMatch(/from '@\/lib\/studios\/workAgeGate'/);
    const gates = (s.match(/await ageGateFor(Work|Manuscript|Thread)\(memberId, /g) ?? []).length;
    const binds = (s.match(/\bbindMaiaMeter\(/g) ?? []).length;
    expect(gates).toBeGreaterThanOrEqual(Math.max(1, binds));
    /* the refusal is returned, not merely computed */
    expect(s).toMatch(/if \(!age\.ok\) \{ const r = ageGateRefusal\(age\); return NextResponse\.json\(r\.body, \{ status: r\.status/);
  });
});
