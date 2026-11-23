/**
 * PRACTITIONER-SESSION-OWNERSHIP-01 — tests for the READ-ONLY census of unowned practitioner sessions.
 *
 * EVIDENCE CLASS: every database here is a FAKE client (an object with `query` and `end`). No PostgreSQL,
 * no network, no real DATABASE_URL, fictional counts only. The script's statements are separately checked
 * to be read-only by the script's own statement guard, and (reported in the commit message, not committed)
 * were run against a throwaway PostgreSQL 16 holding fictional rows.
 *
 * The battery `checkCensus(mod)` is a FUNCTION over a module, so it runs against the real script and
 * against deliberately wrong copies of it (mutants written to a temp directory) that it must each catch.
 *
 * Run: node --test scripts/ops/test-census-unowned-practitioner-sessions.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(here, 'census-unowned-practitioner-sessions.mjs');
const real = await import(pathToFileURL(SCRIPT).href);

const URL_SECRET = 'postgres://census_user:s3cr3t-PASSWORD@db.example.invalid:5432/fictional';
const LEAK = ['SECRET-CLIENT-NAME', 'SECRET-SESSION-TITLE', 'SECRET TRANSCRIPT LINE', '9f1c2e4a-aaaa-4bbb-8ccc-0123456789ab'];

const flat = (s) => String(s).replace(/\s+/g, ' ').trim();

/** a fake pg client: answers each fixed statement from `answers` (by the module's own STATEMENTS), records everything */
function fakeDb(mod, answers, { extraColumns = false, failOn = null } = {}) {
  const issued = [];
  let ended = false;
  const byText = new Map(Object.entries(mod.STATEMENTS).map(([k, v]) => [flat(v), k]));
  const client = {
    issued,
    get ended() { return ended; },
    async query(sql) {
      const text = flat(sql);
      issued.push(text);
      if (failOn && failOn(text)) { const e = new Error('relation "scribe_sessions" does not exist\nLINE 1 …'); e.code = '42P01'; throw e; }
      const key = byText.get(text);
      if (!key) return { rows: [] }; // control statements
      const row = { ...answers[key] };
      if (extraColumns) Object.assign(row, { title: LEAK[1], client_name: LEAK[0], note: LEAK[2], id: LEAK[3] });
      return { rows: [row] };
    },
    async end() { ended = true; },
  };
  return client;
}

const GOOD = {
  practiceCounts: { total: 10, owned: 4, unowned: 6 },
  practiceHints: { cited_by_one_practitioner: 2, cited_by_several_practitioners: 1 },
  supervisionCounts: { total: 100, owned: 30, unowned: 70 },
  supervisionHints: { via_scribe_session: 40, via_case: 10, any_hint: 45, both_agree: 4, both_conflict: 1 },
};

async function run(mod, { env, argv = [], answers = GOOD, opts = {}, createClient } = {}) {
  let created = 0;
  let db = null;
  const out = [];
  const err = [];
  const code = await mod.main({
    env: env ?? { DATABASE_URL: URL_SECRET },
    argv,
    createClient: createClient ?? (async () => { created++; db = fakeDb(mod, answers, opts); return db; }),
    stdout: (s) => out.push(s),
    stderr: (s) => err.push(s),
  });
  return { code, out: out.join('\n'), err: err.join('\n'), created, db };
}

/** Returns the violated properties; [] means the script holds. */
async function checkCensus(mod) {
  const v = [];
  const w = mod.assertReadOnlyStatement;

  // B1 — no DATABASE_URL: refuses, never connects, prints no census (also: no PG* fallback)
  for (const env of [{}, { DATABASE_URL: '' }, { DATABASE_URL: '   ' }, { PGHOST: 'localhost', PGDATABASE: 'maia', PGUSER: 'x' }]) {
    const r = await run(mod, { env });
    if (r.code === 0) v.push(`B1: ran without DATABASE_URL (${JSON.stringify(Object.keys(env))})`);
    if (r.created !== 0) v.push('B1: connected without DATABASE_URL');
    if (r.out !== '') v.push('B1: printed output without DATABASE_URL');
  }

  // B2 — there is no write mode: any option but --json is a usage error, and nothing connects
  for (const flag of ['--write', '--apply', '--backfill', '--claim', '--yes', '--dry-run=false']) {
    const r = await run(mod, { argv: [flag] });
    if (r.code === 0 || r.created !== 0) v.push(`B2: accepted ${flag}`);
  }

  // B3 — a normal run: complete census, read-only, in a read-only transaction that is always rolled back
  {
    const r = await run(mod);
    if (r.code !== 0) v.push(`B3: a normal run exited ${r.code}: ${r.err}`);
    const issued = r.db?.issued ?? [];
    if (issued[0] !== 'BEGIN READ ONLY') v.push(`B3: the first statement was not BEGIN READ ONLY (${issued[0]})`);
    if (issued[issued.length - 1] !== 'ROLLBACK') v.push('B3: the last statement was not ROLLBACK');
    for (const s of issued) {
      try { w(s); } catch { v.push(`B3: a statement the read-only guard refuses was sent: ${s.slice(0, 40)}`); }
      if (/\b(?:insert|update|delete|truncate|drop|alter|create|copy)\b/i.test(s)) v.push(`B3: a write keyword was sent: ${s.slice(0, 40)}`);
    }
    if (!r.db?.ended) v.push('B3: the connection was not closed');
    for (const n of ['10', '4', '6', '100', '30', '70', '40', '45']) {
      if (!new RegExp(`(?:^|[^0-9])${n}(?:[^0-9]|$)`).test(r.out)) v.push(`B3: the census does not show ${n}`);
    }
    if (!/practice_sessions: total=10 owned=4 unowned=6/.test(r.out)) v.push('B3: practice line missing');
    if (!/supervision_sessions: total=100 owned=30 unowned=70/.test(r.out)) v.push('B3: supervision line missing');
    if (!/practitioner_growth\.session_refs/.test(r.out) || !/scribeSessionId/.test(r.out) || !/case_id/.test(r.out)) {
      v.push('B3: the hint columns are not named');
    }
    if (r.out.includes('postgres://') || r.out.includes('s3cr3t') || r.err.includes('s3cr3t')) v.push('B3: the connection string was printed');
  }

  // B4 — counts only: even when the database returns row data, none of it reaches the output
  {
    const r = await run(mod, { opts: { extraColumns: true } });
    for (const s of LEAK) if (r.out.includes(s) || r.err.includes(s)) v.push(`B4: row data reached the output (${s.slice(0, 12)}…)`);
    const j = await run(mod, { argv: ['--json'], opts: { extraColumns: true } });
    for (const s of LEAK) if (j.out.includes(s)) v.push(`B4: row data reached the --json output (${s.slice(0, 12)}…)`);
    try { JSON.parse(j.out); } catch { v.push('B4: --json output is not JSON'); }
  }

  // B5 — anything that is not a non-negative integer fails the run, and NO partial census is printed.
  // The bad value goes into fields the consistency checks cannot catch, so the COUNT validation is what is tested.
  for (const [stmt, field] of [
    ['practiceCounts', 'total'],
    ['practiceHints', 'cited_by_several_practitioners'],
    ['supervisionHints', 'via_case'],
    ['supervisionHints', 'both_conflict'],
  ]) {
    for (const bad of [-1, 1.5, 'forty', null, undefined, NaN, '4 OR 1=1']) {
      const r = await run(mod, { answers: { ...GOOD, [stmt]: { ...GOOD[stmt], [field]: bad } } });
      if (r.code === 0) v.push(`B5: accepted a bad count (${stmt}.${field} = ${String(bad)})`);
      if (r.out !== '') v.push(`B5: printed a partial census after a bad count (${stmt}.${field} = ${String(bad)})`);
    }
  }
  {
    const r = await run(mod, { createClient: async () => ({ issued: [], async query(sql) { return /select/i.test(sql) ? { rows: [GOOD.practiceCounts, GOOD.practiceCounts] } : { rows: [] }; }, async end() {} }) });
    if (r.code === 0 || r.out !== '') v.push('B5: accepted a count statement that returned two rows');
  }

  // B6 — an error exits non-zero, with a SHORT reason that carries neither the URL nor the multi-line driver text
  {
    const r = await run(mod, { opts: { failOn: (t) => /scribe_sessions/.test(t) } });
    if (r.code === 0) v.push('B6: a database error exited 0');
    if (r.out !== '') v.push('B6: output was printed after a database error');
    if (r.err.includes('LINE 1')) v.push('B6: the multi-line driver message was printed');
    if (r.err.length > 300) v.push('B6: the error text is not short');
    const c = await run(mod, { createClient: async () => { throw new Error(`connect failed for ${URL_SECRET}`); } });
    if (c.code === 0) v.push('B6: a connection error exited 0');
    // a driver that echoes the URL in its message is the driver's choice; the script must not ADD it. It is printed
    // only as part of the driver message, so the real guard is that the script never composes it itself:
    if (/DATABASE_URL=/.test(c.err)) v.push('B6: the script composed the URL into its error');
  }

  // B7 — the read-only transaction is ended even when a statement fails
  {
    const r = await run(mod, { answers: { ...GOOD, supervisionCounts: { total: 1, owned: 1, unowned: 'x' } } });
    if (r.code === 0) v.push('B7: a bad count exited 0');
    if (r.db?.issued[r.db.issued.length - 1] !== 'ROLLBACK') v.push('B7: no ROLLBACK after a failed statement');
    if (!r.db?.ended) v.push('B7: the connection was not closed after a failure');
  }

  // B8 — a census that contradicts itself is a failed census
  for (const [label, answers] of [
    ['owned+unowned != total', { ...GOOD, practiceCounts: { total: 10, owned: 4, unowned: 5 } }],
    ['more hinted rows than unowned rows (supervision)', { ...GOOD, supervisionHints: { ...GOOD.supervisionHints, any_hint: 71 } }],
    ['more hinted rows than unowned rows (practice)', { ...GOOD, practiceHints: { cited_by_one_practitioner: 6, cited_by_several_practitioners: 1 } }],
    ['agree+conflict exceeds the rows with both hints', { ...GOOD, supervisionHints: { ...GOOD.supervisionHints, both_agree: 8, both_conflict: 5 } }],
  ]) {
    const r = await run(mod, { answers });
    if (r.code === 0 || r.out !== '') v.push(`B8: accepted an inconsistent census (${label})`);
  }

  // B9 — the statement guard refuses everything that is not a plain read
  for (const bad of [
    'UPDATE practice_sessions SET practitioner_id = NULL',
    'INSERT INTO practice_sessions (id) VALUES (1)',
    'DELETE FROM supervision_sessions',
    'DROP TABLE practice_sessions',
    'COPY practice_sessions TO STDOUT',
    'SELECT 1; DELETE FROM supervision_sessions',
    'SELECT * INTO leak FROM practice_sessions',
    'WITH d AS (DELETE FROM supervision_sessions RETURNING 1) SELECT count(*) FROM d',
    'SET LOCAL statement_timeout = 0',
    'SET default_transaction_read_only = off',
    'COMMIT',
  ]) {
    let refused = false;
    try { w(bad); } catch { refused = true; }
    if (!refused) v.push(`B9: the statement guard allowed: ${bad}`);
  }
  for (const ok of ['BEGIN READ ONLY', "SET LOCAL statement_timeout = '30s'", 'ROLLBACK', 'SELECT count(*)::int AS n FROM practice_sessions']) {
    try { w(ok); } catch { v.push(`B9: the statement guard refused a legitimate statement: ${ok}`); }
  }

  // B10 — every shipped statement is an aggregate-only SELECT (no column of a row can be selected)
  for (const [name, sql] of Object.entries(mod.STATEMENTS)) {
    try { w(sql); } catch (e) { v.push(`B10: ${name} fails the read-only guard: ${e.message}`); }
    const text = flat(sql);
    const list = text.slice(text.search(/select/i) + 6, text.search(/\sfrom\s/i));
    const items = []; let depth = 0; let cur = '';
    for (const ch of list) {
      if (ch === '(') depth++; if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { items.push(cur.trim()); cur = ''; } else cur += ch;
    }
    items.push(cur.trim());
    for (const item of items) {
      if (!/^count\(\*\)(?: FILTER \(WHERE [\s\S]+\))?::int AS \w+$/.test(item)) v.push(`B10: ${name} selects something that is not an integer aggregate: ${item.slice(0, 60)}`);
    }
  }

  return v;
}

test('the real script holds every property (B1-B10)', async () => {
  assert.deepEqual(await checkCensus(real), []);
});

test('importing the script has no side effects (it does not connect or print on import)', async () => {
  // `real` was imported above with no DATABASE_URL in the test process env: reaching here proves main() did not run
  assert.equal(typeof real.main, 'function');
});

test('the output names the hint columns and says what a hint is NOT', async () => {
  const r = await run(real);
  assert.match(r.out, /not a verdict that the session belongs to them/);
  assert.match(r.out, /Nothing was written/);
  assert.match(r.out, /counts only/);
});

test('--json prints one parseable object holding only integers', async () => {
  const r = await run(real, { argv: ['--json'] });
  assert.equal(r.code, 0);
  const j = JSON.parse(r.out).practitioner_session_census;
  const ints = [];
  const walk = (o) => { for (const x of Object.values(o)) (typeof x === 'object' ? walk(x) : ints.push(x)); };
  walk(j);
  assert.ok(ints.length >= 10);
  for (const n of ints) assert.ok(Number.isSafeInteger(n) && n >= 0);
  assert.equal(j.supervision_sessions.unowned_without_hint, 70 - 45);
  assert.equal(j.practice_sessions.unowned_without_hint, 6 - 2 - 1);
});

test('pg returns int8 as strings: digit strings are accepted as counts', async () => {
  const r = await run(real, { answers: { ...GOOD, practiceCounts: { total: '10', owned: '4', unowned: '6' } } });
  assert.equal(r.code, 0);
});

/* ── LETHALITY: wrong copies of the script, each of which the battery must catch ── */

const source = readFileSync(SCRIPT, 'utf8');
const dir = mkdtempSync(path.join(tmpdir(), 'census-mutants-'));
let n = 0;

async function mutant(from, to) {
  assert.equal(source.split(from).length - 1, 1, `mutation anchor must occur exactly once: ${String(from).slice(0, 60)}`);
  const file = path.join(dir, `mutant-${n++}.mjs`);
  writeFileSync(file, source.replace(from, to));
  return import(pathToFileURL(file).href);
}

test('DC-C1 falls back to a default database when DATABASE_URL is absent', async () => {
  const m = await mutant("const url = env.DATABASE_URL;", "const url = env.DATABASE_URL ?? 'postgres://localhost/maia_consciousness';");
  assert.ok((await checkCensus(m)).some((x) => x.startsWith('B1')));
});

test('DC-C2 accepts a write flag (the census silently gains a mode)', async () => {
  const m = await mutant("if (f !== '--json') {", "if (f !== '--json' && f !== '--write') {");
  assert.ok((await checkCensus(m)).some((x) => x.startsWith('B2')));
});

test('DC-C3 does not open a READ ONLY transaction', async () => {
  const m = await mutant("await run('BEGIN READ ONLY');", "await run('SET LOCAL statement_timeout = \\'30s\\'');");
  assert.ok((await checkCensus(m)).some((x) => x.startsWith('B3')));
});

test('DC-C4 never rolls back', async () => {
  const m = await mutant("try { await run('ROLLBACK'); } catch { /* the connection is closed next */ }", '');
  const v = await checkCensus(m);
  assert.ok(v.some((x) => x.startsWith('B3') || x.startsWith('B7')));
});

test('DC-C5 selects a row column into the output (a session title)', async () => {
  const m = await mutant(
    "SELECT count(*)::int AS total,\n           count(*) FILTER (WHERE practitioner_id IS NOT NULL)::int AS owned,\n           count(*) FILTER (WHERE practitioner_id IS NULL)::int AS unowned\n    FROM practice_sessions`,",
    "SELECT count(*)::int AS total,\n           count(*) FILTER (WHERE practitioner_id IS NOT NULL)::int AS owned,\n           count(*) FILTER (WHERE practitioner_id IS NULL)::int AS unowned,\n           min(title) AS title\n    FROM practice_sessions`,",
  );
  const v = await checkCensus(m);
  assert.ok(v.some((x) => x.startsWith('B10') || x.startsWith('B3')));
});

test('DC-C6 a statement that writes (a backfill) is shipped among the census statements', async () => {
  const m = await mutant(
    "supervisionHints: `",
    "writeBackfill: `UPDATE supervision_sessions SET practitioner_id = NULL WHERE false`,\n  supervisionHints: `",
  );
  assert.ok((await checkCensus(m)).some((x) => x.startsWith('B10')));
});

test('DC-C7 accepts any value as a count (a string reaches the output)', async () => {
  const m = await mutant(
    "if (!Number.isSafeInteger(n) || n < 0) throw new Error(`a count column (${key}) was not a non-negative integer`);",
    '',
  );
  assert.ok((await checkCensus(m)).some((x) => x.startsWith('B5') || x.startsWith('B4')));
});

test('DC-C8 swallows an error and exits 0', async () => {
  const m = await mutant("    return 1;\n  } finally {", "    return 0;\n  } finally {");
  const v = await checkCensus(m);
  assert.ok(v.some((x) => x.startsWith('B5') || x.startsWith('B6') || x.startsWith('B7') || x.startsWith('B8')));
});

test('DC-C9 does not check the census for self-contradiction', async () => {
  const m = await mutant("if (c.owned + c.unowned !== c.total) throw new Error(`${name}: owned + unowned does not equal total`);", '');
  assert.ok((await checkCensus(m)).some((x) => x.startsWith('B8')));
});

test('DC-C10 the statement guard lets a write through', async () => {
  const m = await mutant("if (FORBIDDEN.test(flat)) throw new Error('refused: statement contains a write keyword');", '');
  assert.ok((await checkCensus(m)).some((x) => x.startsWith('B9')));
});

test('DC-C11 composes the connection string into its error', async () => {
  const m = await mutant("stderr(`census failed${code}:", "stderr(`census failed for ${url}${code}:");
  // the composed URL appears in the failure text: assert it directly (the battery's B6 only sees the literal `DATABASE_URL=`)
  const r = await run(m, { createClient: async () => { throw new Error('boom'); } });
  assert.ok(r.err.includes('s3cr3t'), 'the mutant leaks the URL, which is what this test must be able to see');
  const rr = await run(real, { createClient: async () => { throw new Error('boom'); } });
  assert.ok(!rr.err.includes('s3cr3t'), 'the real script must not');
});

test.after(() => rmSync(dir, { recursive: true, force: true }));
