/**
 * Step 4 — the editorial pass as a server run (founder ruling 2026-11-11: "Let it run on its own"). In-memory database; every model
 * call is a stub. Each "must fail if" in the design (§18) is a test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { LENS_ORDER } from '@/lib/writersStudio/developPresentation';
import { planLens } from '@/lib/writersStudio/studio/coveringSet';
import { sectionDigest } from '@/lib/manuscript/development/coverageMap';
import { advanceRun, cancelRun, startRun, viewRun, settleStranded, noteWatching, pageWatching, WATCH_WINDOW_MS, RUNS_PER_DAY, type RunDeps } from '@/lib/writersStudio/studio/passRun';

type Ev = { id: number; run_id: string; state: string; lens: string | null; reading_id: string | null; refusal: string | null; letter_id: string | null };
function world(opts: { grant?: 'work' | 'chapter' | null; sanctuary?: boolean | null; frozen?: string[]; refuse?: Record<string, number>; watching?: boolean; changed?: string[] } = {}) {
  let watching = opts.watching ?? true;
  const runs: { id: string; member_id: string; manuscript_id: string; draft_revision: number; created_at: Date }[] = [];
  const events: Ev[] = [];
  const readings: { id: string; lens: string; rev: number; scope: string[] }[] =
    (opts.frozen ?? []).map((lens) => ({ id: `old-${lens}`, lens, rev: 5, scope: ['s1', 's2'] }));
  let grant = opts.grant === undefined ? 'work' : opts.grant;
  let sanctuary = opts.sanctuary === undefined ? false : opts.sanctuary;
  const refuse = { ...(opts.refuse ?? {}) };
  let seq = 0;
  const q = jest.fn(async (sql: string, p: unknown[] = []) => {
    if (sql.includes('FROM manuscript_working_drafts d')) return { rows: [{ id: 'd1', rev: 5, sections: ['s1', 's2'] }] };
    if (sql.includes('FROM editorial_pass_runs WHERE member_id = $1 AND manuscript_id')) {
      const r = runs.filter((x) => x.member_id === p[0] && x.manuscript_id === p[1]).sort((a, b) => +b.created_at - +a.created_at);
      return { rows: r.slice(0, 1) };
    }
    if (sql.includes('FROM editorial_pass_run_events WHERE run_id')) return { rows: events.filter((e) => e.run_id === p[0]) };
    if (sql.startsWith('INSERT INTO editorial_pass_run_events')) {
      events.push({ id: ++seq, run_id: p[0] as string, state: p[1] as string, lens: p[2] as string | null, reading_id: p[3] as string | null, refusal: p[4] as string | null, letter_id: p[5] as string | null });
      return { rows: [] };
    }
    if (sql.includes("INTERVAL '1 day'")) return { rows: [{ n: String(runs.length) }] };
    if (sql.startsWith('INSERT INTO editorial_pass_runs')) {
      const r = { id: `run${runs.length + 1}`, member_id: p[0] as string, manuscript_id: p[1] as string, draft_revision: p[2] as number, created_at: new Date(Date.now() + runs.length) };
      runs.push(r); return { rows: [{ id: r.id }] };
    }
    if (sql.includes('FROM manuscript_structure_units')) return { rows: [{ n: '0' }] };
    if (sql.includes('FROM developmental_readings')) return { rows: readings.filter((r) => r.lens === p[2] && r.rev === p[3]).map((r) => ({ id: r.id })) };
    throw new Error(`unexpected SQL: ${sql.slice(0, 60)}`);
  });
  const read = async (input: { lens: string; bodyScope?: string[] }) => {
    if ((refuse[input.lens] ?? 0) > 0) { refuse[input.lens]! -= 1; return { outcome: 'refused', stage: 'read', refusal: 'claim_unbindable', detail: '' }; }
    const id = `new-${input.lens}-${readings.length}`;
    readings.push({ id, lens: input.lens, rev: 5, scope: input.bodyScope ?? ['s1', 's2'] });
    return { outcome: 'frozen', reading: { id } };
  };
  const commission = jest.fn(read);
  const deps: RunDeps = {
    q: q as any,
    commission: commission as any,
    load: (async (id: string) => { const r = readings.find((x) => x.id === id); return r ? { id: r.id, scope: { bodyScope: r.scope } } : null; }) as any,
    grant: async () => grant,
    sanctuaryDefault: async () => sanctuary,
    synthesize: jest.fn(async () => ({ ok: true, map: { items: [] }, deepMode: true, revisionNumber: 5, readingIds: [], provenance: {} })) as any,
    keepLetter: jest.fn(async () => 'letter-1') as any,
    opening: jest.fn(async () => ({ ok: false, refusal: 'no_observations' })) as any,
    watching: () => watching,
    /* §20: the frozen readings were taken before `opts.changed` sections were edited; their digests there no longer match */
    cover: async (_m: string, _ms: string, lens: string) => planLens('D', [{ id: 's1', text: 'S1' }, { id: 's2', text: 'S2' }],
      readings.filter((x) => x.lens === lens).map((x, i) => ({
        id: x.id, lens: x.lens, draftId: 'D', frozenAt: `2026-11-${String(10 + i).padStart(2, '0')}T00:00:00Z`,
        digests: Object.fromEntries(x.scope.map((sid) => [sid, sectionDigest(x.id.startsWith('old-') && (opts.changed ?? []).includes(sid) ? 'before the edit' : sid.toUpperCase())])),
        depths: Object.fromEntries(x.scope.map((sid) => [sid, 'body'])),
      }))),
  };
  return { deps, commission, read, events, runs, setGrant: (g: typeof grant) => { grant = g; }, setSanctuary: (s: boolean) => { sanctuary = s; }, setWatching: (v: boolean) => { watching = v; } };
}

describe('the server run and the Free / Pro line (writing.wholeWork)', () => {
  it('⭐ not entitled: nothing is started, no run row, no reading commissioned', async () => {
    const w = world();
    w.deps.wholeWork = async () => false;
    expect(await startRun('me', 'm', w.deps)).toEqual({ ok: false, refusal: 'whole_work_entitlement_required' });
    expect(w.runs).toHaveLength(0);
    expect(w.commission).not.toHaveBeenCalled();
  });
  it('entitled: starts as before', async () => {
    const w = world();
    w.deps.wholeWork = async () => true;
    expect(await startRun('me', 'm', w.deps)).toMatchObject({ ok: true, resumed: false });
  });
  it('a failed lookup throws rather than starting or reading as "not Pro"', async () => {
    const w = world();
    w.deps.wholeWork = async () => { throw new Error('db down'); };
    await expect(startRun('me', 'm', w.deps)).rejects.toThrow('db down');
    expect(w.runs).toHaveLength(0);
  });
});

describe('the editorial pass runs on the server', () => {
  it('⭐ a full run reads every lens, synthesizes once with the deep lenses, and keeps the letter', async () => {
    const w = world();
    expect(await startRun('me', 'm', w.deps)).toMatchObject({ ok: true, resumed: false });
    const done = await advanceRun('me', 'm', w.deps);
    expect(done).toMatchObject({ state: 'done', done: LENS_ORDER.length, letterId: 'letter-1' });
    expect(w.commission).toHaveBeenCalledTimes(LENS_ORDER.length);
    const sent = (w.deps.synthesize as jest.Mock).mock.calls[0][2] as string[];
    expect(sent).toHaveLength(LENS_ORDER.length - 1);
    expect(sent.some((id) => id.includes('overview'))).toBe(false);
  });

  it('⭐ MUST FAIL IF reopening pays again for a saved lens: frozen readings of this draft are reused', async () => {
    const w = world({ frozen: ['overview', 'arc', 'voice'] });
    await startRun('me', 'm', w.deps);
    await advanceRun('me', 'm', w.deps);
    const lenses = w.commission.mock.calls.map((c) => (c[0] as { lens: string }).lens);
    expect(lenses).not.toContain('arc');
    expect(lenses).not.toContain('voice');
    expect(lenses).toHaveLength(LENS_ORDER.length - 3);
  });

  it('⭐ MUST FAIL IF a run continues after permission is withdrawn: it stops before the next reading', async () => {
    const w = world();
    await startRun('me', 'm', w.deps);
    let calls = 0;
    (w.commission as jest.Mock).mockImplementation(async (input: { lens: string }) => { calls += 1; if (calls === 2) w.setGrant('chapter'); return w.read(input); });
    const out = await advanceRun('me', 'm', w.deps);
    expect(out).toMatchObject({ state: 'stopped', refusal: 'permission_withdrawn' });
    expect(calls).toBe(2);
    expect(w.deps.synthesize).not.toHaveBeenCalled();
  });

  it('⭐ Sanctuary turned on mid-run stops it; Sanctuary at the start refuses it', async () => {
    const w = world({ sanctuary: true });
    expect(await startRun('me', 'm', w.deps)).toEqual({ ok: false, refusal: 'sanctuary' });
    const w2 = world();
    await startRun('me', 'm', w2.deps);
    (w2.commission as jest.Mock).mockImplementation(async (input: { lens: string }) => { w2.setSanctuary(true); return w2.read(input); });
    expect(await advanceRun('me', 'm', w2.deps)).toMatchObject({ state: 'stopped', refusal: 'sanctuary' });
    expect(w2.commission).toHaveBeenCalledTimes(1);
  });

  it('⭐ MUST FAIL IF a refused reading counts as done: one retry, then the run fails at that lens', async () => {
    const w = world({ refuse: { voice: 2 } });
    await startRun('me', 'm', w.deps);
    const out = await advanceRun('me', 'm', w.deps);
    expect(out).toMatchObject({ state: 'failed', lens: 'voice' });
    expect(w.events.filter((e) => e.state === 'lens_done' && e.lens === 'voice')).toHaveLength(0);
    expect(w.deps.synthesize).not.toHaveBeenCalled();
    const w2 = world({ refuse: { voice: 1 } });
    await startRun('me', 'm', w2.deps);
    expect(await advanceRun('me', 'm', w2.deps)).toMatchObject({ state: 'done' });
  });

  it('a failed run continues on the writer\'s Continue, reusing the readings already made', async () => {
    const w = world({ refuse: { voice: 2 } });
    await startRun('me', 'm', w.deps);
    await advanceRun('me', 'm', w.deps);
    const before = w.commission.mock.calls.length;
    expect(await startRun('me', 'm', w.deps)).toMatchObject({ ok: true, resumed: true });
    expect(await advanceRun('me', 'm', w.deps)).toMatchObject({ state: 'done' });
    const after = w.commission.mock.calls.slice(before).map((c) => (c[0] as { lens: string }).lens);
    expect(after).toEqual(['voice', 'coherence', 'reader'].filter((l) => LENS_ORDER.includes(l as never)).filter((l) => LENS_ORDER.indexOf(l as never) >= LENS_ORDER.indexOf('voice' as never)));
  });

  it('⭐ MUST FAIL IF two runs proceed on one manuscript: an active run is resumed, never doubled', async () => {
    const w = world();
    await startRun('me', 'm', w.deps);
    expect(await startRun('me', 'm', w.deps)).toMatchObject({ ok: true, resumed: true });
    expect(w.runs).toHaveLength(1);
    const [a, b] = await Promise.all([advanceRun('me', 'm', w.deps), advanceRun('me', 'm', w.deps)]);
    expect([a?.state, b?.state]).toContain('done');
    expect(w.commission).toHaveBeenCalledTimes(LENS_ORDER.length);
  });

  it('no whole-Work permission: the run is not started', async () => {
    expect(await startRun('me', 'm', world({ grant: 'chapter' }).deps)).toEqual({ ok: false, refusal: 'not_permitted' });
  });

  it('a cancelled run reads nothing more', async () => {
    const w = world();
    await startRun('me', 'm', w.deps);
    expect(await cancelRun('me', 'm', w.deps)).toBe(true);
    expect(await advanceRun('me', 'm', w.deps)).toMatchObject({ state: 'cancelled' });
    expect(w.commission).not.toHaveBeenCalled();
  });

  it('⭐ the daily ceiling is the founder\'s number: 2 full passes per writer per day (ruling 2026-11-17)', async () => {
    expect(RUNS_PER_DAY).toBe(2);
    const w = world();
    for (let i = 0; i < 2; i += 1) { await startRun('me', 'm', w.deps); await cancelRun('me', 'm', w.deps); }
    expect(await startRun('me', 'm', w.deps)).toEqual({ ok: false, refusal: 'daily_limit' });
  });

  it('⭐ MUST FAIL IF the ceiling can be raised without a founder act: no environment override', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'lib/writersStudio/studio/passRun.ts'), 'utf8');
    expect(src).not.toMatch(/process\.env\.MAIA_PASS_RUNS_PER_DAY/);
  });

  it('⭐ MUST FAIL IF the run and the route synthesize differently: both call the one synthesis', () => {
    const run = fs.readFileSync(path.join(process.cwd(), 'lib/writersStudio/studio/passRun.ts'), 'utf8');
    const route = fs.readFileSync(path.join(process.cwd(), 'app/api/sovereign/manuscripts/[id]/attention-map/route.ts'), 'utf8');
    expect(run).toMatch(/synthesize: synthesizeAttentionMap/);
    expect(route).toMatch(/await synthesizeAttentionMap\(memberId, manuscriptId, body\.readingIds, body\.request\)/);
    expect(route).not.toMatch(/runStructured/);
  });

  it('the start route runs the keep gate before anything', () => {
    const r = fs.readFileSync(path.join(process.cwd(), 'app/api/sovereign/manuscripts/[id]/editorial-pass/route.ts'), 'utf8');
    expect(r.indexOf('await keepGate(memberId, body)')).toBeLessThan(r.indexOf('await startRun('));
  });
});

describe('the taste of Pro: one complimentary whole-book pass for a Free writer (founder ruling 2026-11-13)', () => {
  function tasteSeam(initial: 'available' | 'none' | 'claimed_here') {
    let standing: 'available' | 'none' | 'claimed_here' = initial;
    const log: string[] = [];
    return {
      log,
      seam: {
        standing: jest.fn(async () => standing),
        claim: jest.fn(async () => { log.push('claim'); if (standing === 'available') { standing = 'claimed_here'; return true; } return standing === 'claimed_here'; }),
        settle: jest.fn(async (_m: string, _ms: string, outcome: 'complete' | 'return') => { log.push(outcome); standing = outcome === 'return' ? 'available' : 'none'; }),
      },
    };
  }

  it('⭐ a Free writer with their taste available starts the pass, and the taste is claimed', async () => {
    const w = world(); const t = tasteSeam('available');
    w.deps.wholeWork = async () => false; w.deps.taste = t.seam;
    expect(await startRun('me', 'm', w.deps)).toMatchObject({ ok: true, resumed: false });
    expect(t.log).toEqual(['claim']);
  });

  it('⭐ a refusal for another reason never spends the taste (claimed only after every other check)', async () => {
    const w = world({ grant: 'chapter' }); const t = tasteSeam('available');
    w.deps.wholeWork = async () => false; w.deps.taste = t.seam;
    expect(await startRun('me', 'm', w.deps)).toEqual({ ok: false, refusal: 'not_permitted' });
    expect(t.seam.claim).not.toHaveBeenCalled();
  });

  it('a Free writer whose taste is spent (or who was a beta tester) is refused, nothing started', async () => {
    const w = world(); const t = tasteSeam('none');
    w.deps.wholeWork = async () => false; w.deps.taste = t.seam;
    expect(await startRun('me', 'm', w.deps)).toEqual({ ok: false, refusal: 'whole_work_entitlement_required' });
    expect(w.runs).toHaveLength(0);
  });

  it('⭐ the letter is kept → the taste is spent (and the letter is the writer\'s)', async () => {
    const w = world(); const t = tasteSeam('available');
    w.deps.wholeWork = async () => false; w.deps.taste = t.seam;
    await startRun('me', 'm', w.deps);
    expect(await advanceRun('me', 'm', w.deps)).toMatchObject({ state: 'done', letterId: 'letter-1' });
    expect(t.log).toEqual(['claim', 'complete']);
  });

  it('⭐ the pass fails → the taste is given back, and the writer can try again', async () => {
    const w = world({ refuse: { overview: 2 } }); const t = tasteSeam('available');
    w.deps.wholeWork = async () => false; w.deps.taste = t.seam;
    await startRun('me', 'm', w.deps);
    expect(await advanceRun('me', 'm', w.deps)).toMatchObject({ state: 'failed' });
    expect(t.log).toEqual(['claim', 'return']);
    expect(await startRun('me', 'm', w.deps)).toMatchObject({ ok: true, resumed: true });
    expect(t.log).toEqual(['claim', 'return', 'claim']);
  });

  it('cancelling gives the taste back', async () => {
    const w = world(); const t = tasteSeam('available');
    w.deps.wholeWork = async () => false; w.deps.taste = t.seam;
    await startRun('me', 'm', w.deps);
    expect(await cancelRun('me', 'm', w.deps)).toBe(true);
    expect(t.log).toEqual(['claim', 'return']);
  });

  it('a Pro writer never touches the taste', async () => {
    const w = world(); const t = tasteSeam('available');
    w.deps.wholeWork = async () => true; w.deps.taste = t.seam;
    await startRun('me', 'm', w.deps);
    expect(t.seam.standing).not.toHaveBeenCalled();
    expect(t.seam.claim).not.toHaveBeenCalled();
  });
});

/* Founder rulings 2026-11-17 (Kelly, in session): "resume on request only — a pass stops when no page is watching; the writer presses
   Continue; finished lenses are never paid twice", and a ceiling of 2 full passes per writer per day. */
describe('resume on request only (founder ruling 2026-11-17)', () => {
  it('⭐ MUST FAIL IF a run keeps reading when no page is watching: it stops before the next reading', async () => {
    const w = world();
    await startRun('me', 'm', w.deps);
    let calls = 0;
    (w.commission as jest.Mock).mockImplementation(async (input: { lens: string }) => { calls += 1; if (calls === 2) w.setWatching(false); return w.read(input); });
    expect(await advanceRun('me', 'm', w.deps)).toMatchObject({ state: 'stopped', refusal: 'no_page_watching' });
    expect(calls).toBe(2);
    expect(w.deps.synthesize).not.toHaveBeenCalled();
  });

  it('⭐ MUST FAIL IF the paid synthesis runs with no page watching', async () => {
    const w = world();
    await startRun('me', 'm', w.deps);
    let calls = 0;
    (w.commission as jest.Mock).mockImplementation(async (input: { lens: string }) => { calls += 1; if (calls === LENS_ORDER.length) w.setWatching(false); return w.read(input); });
    expect(await advanceRun('me', 'm', w.deps)).toMatchObject({ state: 'stopped', refusal: 'no_page_watching' });
    expect(w.deps.synthesize).not.toHaveBeenCalled();
  });

  it('⭐ the writer\'s Continue resumes it, and no lens already read is paid for twice', async () => {
    const w = world();
    await startRun('me', 'm', w.deps);
    let calls = 0;
    const real = w.commission.getMockImplementation()!;
    w.commission.mockImplementation(async (input: { lens: string }) => { calls += 1; if (calls === 3) w.setWatching(false); return real(input as never); });
    expect(await advanceRun('me', 'm', w.deps)).toMatchObject({ state: 'stopped', refusal: 'no_page_watching' });
    w.setWatching(true);
    expect(await startRun('me', 'm', w.deps)).toMatchObject({ ok: true, resumed: true });
    expect(await advanceRun('me', 'm', w.deps)).toMatchObject({ state: 'done' });
    const lenses = w.commission.mock.calls.map((c) => (c[0] as { lens: string }).lens);
    expect(lenses).toHaveLength(LENS_ORDER.length);
    expect(new Set(lenses).size).toBe(LENS_ORDER.length);
    expect(w.runs).toHaveLength(1);
  });

  it('⭐ resuming a stopped pass is not a new pass: it does not count against the daily ceiling', async () => {
    const w = world({ watching: false });
    await startRun('me', 'm', w.deps);
    for (let i = 0; i < 4; i += 1) {
      expect(await advanceRun('me', 'm', w.deps)).toMatchObject({ state: 'stopped' });
      expect(await startRun('me', 'm', w.deps)).toMatchObject({ ok: true, resumed: true });
    }
    expect(w.runs).toHaveLength(1);
  });

  it('⭐ MUST FAIL IF a run nobody is advancing shows as "reading": asking about it settles it as stopped, so Continue appears', async () => {
    const w = world();
    await startRun('me', 'm', w.deps); // queued; nothing in this process is advancing it (a restart, a closed page)
    expect(await settleStranded('me', 'm', w.deps)).toMatchObject({ state: 'stopped', refusal: 'interrupted' });
    expect(w.commission).not.toHaveBeenCalled();
    expect(await startRun('me', 'm', w.deps)).toMatchObject({ ok: true, resumed: true });
    expect(await advanceRun('me', 'm', w.deps)).toMatchObject({ state: 'done' });
  });

  it('a finished run is left as it is by settleStranded', async () => {
    const w = world();
    await startRun('me', 'm', w.deps);
    await advanceRun('me', 'm', w.deps);
    expect(await settleStranded('me', 'm', w.deps)).toMatchObject({ state: 'done' });
  });

  it('the default watch: a page that asked within the window is watching; after it, not', () => {
    const t0 = 1_000_000;
    noteWatching('me-watch', 'm-watch', t0);
    expect(pageWatching('me-watch', 'm-watch', t0 + WATCH_WINDOW_MS)).toBe(true);
    expect(pageWatching('me-watch', 'm-watch', t0 + WATCH_WINDOW_MS + 1)).toBe(false);
    expect(pageWatching('someone-else', 'm-watch', t0)).toBe(false);
    expect(WATCH_WINDOW_MS).toBeGreaterThan(5_000 * 6); // the panel checks every 5 s; a slow or background tab is not cut off at once
  });

  it('⭐ MUST FAIL IF opening the page starts paid work: GET only looks (and keeps the page counted as watching)', () => {
    const r = fs.readFileSync(path.join(process.cwd(), 'app/api/sovereign/manuscripts/[id]/editorial-pass/route.ts'), 'utf8');
    const get = r.slice(r.indexOf('async function getHandler'), r.indexOf('export const GET'));
    expect(get).not.toMatch(/advanceRun\(/);
    expect(get).toMatch(/noteWatching\(memberId, id\)/);
    expect(get).toMatch(/settleStranded\(memberId, id\)/);
    const post = r.slice(r.indexOf('async function postHandler'), r.indexOf('export const POST'));
    expect(post.indexOf('noteWatching(memberId, id)')).toBeGreaterThan(-1);
    expect(post.indexOf('noteWatching(memberId, id)')).toBeLessThan(post.indexOf('advanceRun('));
  });
});

/* §20 (lane authorized 2026-11-17): rereading only what changed. */
describe('the run rereads only what changed', () => {
  it('⭐ MUST FAIL IF an edit to one section makes the run pay for the whole book again: each lens rereads only that section', async () => {
    const w = world({ frozen: [...LENS_ORDER], changed: ['s2'] });
    await startRun('me', 'm', w.deps);
    expect(await advanceRun('me', 'm', w.deps)).toMatchObject({ state: 'done' });
    expect(w.commission).toHaveBeenCalledTimes(LENS_ORDER.length);
    for (const call of w.commission.mock.calls) expect((call[0] as { bodyScope: string[] }).bodyScope).toEqual(['s2']);
  });
  it('⭐ the letter is built from the old readings (unchanged text) together with the new ones (the changed section)', async () => {
    const w = world({ frozen: [...LENS_ORDER], changed: ['s2'] });
    await startRun('me', 'm', w.deps);
    await advanceRun('me', 'm', w.deps);
    const sent = (w.deps.synthesize as jest.Mock).mock.calls[0][2] as string[];
    expect(sent.filter((id) => id.startsWith('old-'))).toHaveLength(LENS_ORDER.length - 1);
    expect(sent.filter((id) => id.startsWith('new-'))).toHaveLength(LENS_ORDER.length - 1);
    expect(sent.some((id) => id.includes('overview'))).toBe(false);
  });
  it('nothing changed: nothing is read, nothing paid; the letter is made from what is kept', async () => {
    const w = world({ frozen: [...LENS_ORDER] });
    await startRun('me', 'm', w.deps);
    expect(await advanceRun('me', 'm', w.deps)).toMatchObject({ state: 'done' });
    expect(w.commission).not.toHaveBeenCalled();
  });
  it('⭐ MUST FAIL IF a reading that still leaves a section uncovered counts as done', async () => {
    const w = world({ frozen: [...LENS_ORDER], changed: ['s2'] });
    w.commission.mockImplementation(async (input: { lens: string }) => ({ outcome: 'frozen', reading: { id: `nothing-${input.lens}` } }));
    await startRun('me', 'm', w.deps);
    expect(await advanceRun('me', 'm', w.deps)).toMatchObject({ state: 'failed', refusal: 'section_not_covered' });
    expect(w.deps.synthesize).not.toHaveBeenCalled();
  });
  it('the letter\'s opening is given exactly the observations the synthesis kept', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'lib/writersStudio/studio/passRun.ts'), 'utf8');
    expect(src).toMatch(/deps\.opening\(memberId, manuscriptId, synthesis\.readingIds, synthesis\.observationKeys\)/);
  });
});
