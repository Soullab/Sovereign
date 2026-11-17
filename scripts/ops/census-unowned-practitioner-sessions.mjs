#!/usr/bin/env node
/**
 * PRACTITIONER-SESSION-OWNERSHIP-01 — READ-ONLY census of practitioner sessions that have NO owner.
 *
 * Context. Since PRACTITIONER-SESSION-OWNERSHIP-01 a practice_sessions / supervision_sessions row is
 * reachable through the practice and supervision routes only by the practitioner whose id is in its
 * `practitioner_id` column (lib/auth/requireOwnedSession.ts). A legacy row whose `practitioner_id` is NULL
 * is therefore unreachable there (fail closed). Most such rows exist because the live-scribe and studio
 * recorders never sent an owner. Whether any of them can be recovered, and to whom, is a founder-run,
 * audited decision. THIS SCRIPT DECIDES NOTHING AND CHANGES NOTHING: it only counts, so that decision can
 * be made from numbers instead of from a guess.
 *
 * What it is, and is not
 *   · COUNTS ONLY. Per table: total, owned, unowned; and for the unowned rows, how many carry a
 *     deterministic ownership HINT in columns that already exist, naming those columns. No row, id, name,
 *     title, note or transcript text is selected into the output, and the output is built only from values
 *     that parsed as non-negative integers (a statement that returned anything else makes the run FAIL).
 *   · READ ONLY. One `BEGIN READ ONLY` transaction, only SELECT statements (each statement is checked
 *     against an allowlist before it is sent), always ROLLBACK. There is no write flag, no `--apply`, no
 *     backfill, and deliberately no "claim" endpoint anywhere: a claim flow would let anyone claim someone
 *     else's legacy session.
 *   · EXPLICIT. It refuses to run without DATABASE_URL in the environment. It never falls back to a
 *     default, a PG* variable or a local socket, and it never prints the URL.
 *   · FAIL CLOSED. Any error (connection, missing table, bad count, forbidden statement) prints a short
 *     reason and exits non-zero; it never prints a partial census.
 *
 * A hint is a column that already names an owner, not a verdict that the row belongs to that person:
 *   supervision_sessions
 *     · metadata->>'scribeSessionId'  →  scribe_sessions.id  →  scribe_sessions.member_id
 *     · case_id                       →  practitioner_cases.id →  practitioner_cases.practitioner_id
 *   practice_sessions
 *     · practitioner_growth.session_refs (uuid[]) ∋ practice_sessions.id  →  practitioner_growth.practitioner_id
 *       (counted separately when exactly one practitioner's growth rows cite the session, and when several do)
 *
 * Usage
 *   DATABASE_URL=… node scripts/ops/census-unowned-practitioner-sessions.mjs [--json]
 *
 * Exit 0 on a complete census; 1 on any error; 2 on a usage error (no DATABASE_URL, unknown flag).
 */

import { pathToFileURL } from 'node:url';

/** Control statements that are allowed verbatim. Everything else must be a read-only SELECT. */
const CONTROL = Object.freeze(['BEGIN READ ONLY', "SET LOCAL statement_timeout = '30s'", 'ROLLBACK']);

const FORBIDDEN =
  /\b(?:insert|update|delete|truncate|drop|alter|create|grant|revoke|copy|merge|call|do|into|vacuum|reindex|cluster|lock|notify|listen|set\s+(?!local\s+statement_timeout))\b/i;

/** @throws if the statement could write, or is not one of the fixed control statements / a SELECT */
export function assertReadOnlyStatement(sql) {
  const flat = String(sql).replace(/\s+/g, ' ').trim();
  if (CONTROL.includes(flat)) return flat;
  if (!/^select\b/i.test(flat)) throw new Error('refused: not a SELECT');
  if (FORBIDDEN.test(flat)) throw new Error('refused: statement contains a write keyword');
  if (flat.includes(';')) throw new Error('refused: more than one statement');
  return flat;
}

/**
 * The fixed statement list. Each selects ONLY integer aggregates. `name` identifies the statement to a
 * test double; nothing here selects a column of a row.
 */
export const STATEMENTS = Object.freeze({
  practiceCounts: `
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE practitioner_id IS NOT NULL)::int AS owned,
           count(*) FILTER (WHERE practitioner_id IS NULL)::int AS unowned
    FROM practice_sessions`,
  practiceHints: `
    SELECT count(*) FILTER (WHERE h.owners = 1)::int AS cited_by_one_practitioner,
           count(*) FILTER (WHERE h.owners > 1)::int AS cited_by_several_practitioners
    FROM practice_sessions s
    CROSS JOIN LATERAL (
      SELECT count(DISTINCT g.practitioner_id)::int AS owners
      FROM practitioner_growth g
      WHERE g.session_refs @> ARRAY[s.id]
    ) h
    WHERE s.practitioner_id IS NULL`,
  supervisionCounts: `
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE practitioner_id IS NOT NULL)::int AS owned,
           count(*) FILTER (WHERE practitioner_id IS NULL)::int AS unowned
    FROM supervision_sessions`,
  supervisionHints: `
    SELECT count(*) FILTER (WHERE sc.member_id IS NOT NULL)::int AS via_scribe_session,
           count(*) FILTER (WHERE c.practitioner_id IS NOT NULL)::int AS via_case,
           count(*) FILTER (WHERE sc.member_id IS NOT NULL OR c.practitioner_id IS NOT NULL)::int AS any_hint,
           count(*) FILTER (WHERE sc.member_id IS NOT NULL AND c.practitioner_id IS NOT NULL
                              AND sc.member_id = c.practitioner_id)::int AS both_agree,
           count(*) FILTER (WHERE sc.member_id IS NOT NULL AND c.practitioner_id IS NOT NULL
                              AND sc.member_id <> c.practitioner_id)::int AS both_conflict
    FROM supervision_sessions s
    LEFT JOIN scribe_sessions sc ON sc.id::text = s.metadata->>'scribeSessionId'
    LEFT JOIN practitioner_cases c ON c.id = s.case_id
    WHERE s.practitioner_id IS NULL`,
});

/** a count is a non-negative safe integer, or the run fails — nothing else can reach the output */
function count(row, key) {
  const v = row?.[key];
  const n = typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v;
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`a count column (${key}) was not a non-negative integer`);
  return n;
}

function only(rows, keys) {
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error('a count statement did not return exactly one row');
  return Object.fromEntries(keys.map((k) => [k, count(rows[0], k)]));
}

/** @returns {Promise<object>} the census, all integers; throws on anything unexpected */
export async function collectCensus(client) {
  const run = async (sql) => {
    const checked = assertReadOnlyStatement(sql);
    const res = await client.query(checked);
    return res?.rows;
  };

  await run('BEGIN READ ONLY');
  try {
    await run("SET LOCAL statement_timeout = '30s'");
    const pc = only(await run(STATEMENTS.practiceCounts), ['total', 'owned', 'unowned']);
    const ph = only(await run(STATEMENTS.practiceHints), ['cited_by_one_practitioner', 'cited_by_several_practitioners']);
    const sc = only(await run(STATEMENTS.supervisionCounts), ['total', 'owned', 'unowned']);
    const sh = only(await run(STATEMENTS.supervisionHints), [
      'via_scribe_session', 'via_case', 'any_hint', 'both_agree', 'both_conflict',
    ]);

    // internal consistency: a census that contradicts itself is a failed census, not a result
    for (const [name, c] of [['practice_sessions', pc], ['supervision_sessions', sc]]) {
      if (c.owned + c.unowned !== c.total) throw new Error(`${name}: owned + unowned does not equal total`);
    }
    if (ph.cited_by_one_practitioner + ph.cited_by_several_practitioners > pc.unowned) {
      throw new Error('practice_sessions: more hinted rows than unowned rows');
    }
    if (sh.any_hint > sc.unowned) throw new Error('supervision_sessions: more hinted rows than unowned rows');
    if (sh.any_hint < Math.max(sh.via_scribe_session, sh.via_case)) throw new Error('supervision_sessions: any_hint is smaller than one of its parts');
    if (sh.both_agree + sh.both_conflict > Math.min(sh.via_scribe_session, sh.via_case)) {
      throw new Error('supervision_sessions: both_agree + both_conflict exceeds the rows that carry both hints');
    }

    return {
      practice_sessions: {
        total: pc.total,
        owned: pc.owned,
        unowned: pc.unowned,
        unowned_with_hint: {
          'practitioner_growth.session_refs (cited by exactly one practitioner)': ph.cited_by_one_practitioner,
          'practitioner_growth.session_refs (cited by several practitioners)': ph.cited_by_several_practitioners,
        },
        unowned_without_hint: pc.unowned - ph.cited_by_one_practitioner - ph.cited_by_several_practitioners,
      },
      supervision_sessions: {
        total: sc.total,
        owned: sc.owned,
        unowned: sc.unowned,
        unowned_with_hint: {
          "metadata->>'scribeSessionId' -> scribe_sessions.member_id": sh.via_scribe_session,
          'case_id -> practitioner_cases.practitioner_id': sh.via_case,
          'either hint': sh.any_hint,
          'both hints, same practitioner': sh.both_agree,
          'both hints, DIFFERENT practitioners': sh.both_conflict,
        },
        unowned_without_hint: sc.unowned - sh.any_hint,
      },
    };
  } finally {
    // always end the read-only transaction; its own failure must not mask the real one
    try { await run('ROLLBACK'); } catch { /* the connection is closed next */ }
  }
}

export function formatCensus(c) {
  const lines = [
    'practitioner-session census — READ ONLY, counts only (no row, id, name, title or transcript text is selected or printed)',
  ];
  for (const [table, t] of Object.entries(c)) {
    lines.push(`${table}: total=${t.total} owned=${t.owned} unowned=${t.unowned}`);
    lines.push('  unowned rows carrying an ownership hint in an existing column:');
    for (const [col, n] of Object.entries(t.unowned_with_hint)) lines.push(`    ${col}: ${n}`);
    lines.push(`  unowned rows with no hint: ${t.unowned_without_hint}`);
  }
  lines.push('A hint names a column that already points at a member; it is not a verdict that the session belongs to them.');
  lines.push('Nothing was written. Recovery, if any, is a separate founder-run, audited step that is NOT built.');
  return lines.join('\n');
}

async function defaultCreateClient(connectionString) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString });
  await client.connect();
  return client;
}

/**
 * The testable entry point. `createClient(url)` returns `{ query(sql), end() }` — the real one is pg.
 * @returns {Promise<number>} the exit code
 */
export async function main({
  env = process.env,
  argv = process.argv.slice(2),
  createClient = defaultCreateClient,
  stdout = (s) => process.stdout.write(`${s}\n`),
  stderr = (s) => process.stderr.write(`${s}\n`),
} = {}) {
  const flags = new Set(argv);
  for (const f of flags) {
    if (f !== '--json') {
      stderr(`usage: DATABASE_URL=… node scripts/ops/census-unowned-practitioner-sessions.mjs [--json]\nthis script has no "${f}" option: it is read-only and has no write mode`);
      return 2;
    }
  }
  const url = env.DATABASE_URL;
  if (typeof url !== 'string' || url.trim() === '') {
    stderr('refused: DATABASE_URL is not set. This script never falls back to a default database; name the one you mean.');
    return 2;
  }

  let client;
  try {
    client = await createClient(url);
    const census = await collectCensus(client);
    stdout(flags.has('--json') ? JSON.stringify({ practitioner_session_census: census }) : formatCensus(census));
    return 0;
  } catch (e) {
    // a short reason, never the URL, never a row
    const code = e && typeof e === 'object' && 'code' in e && typeof e.code === 'string' ? ` (${e.code})` : '';
    stderr(`census failed${code}: ${e instanceof Error ? e.message.split('\n')[0].slice(0, 160) : 'unknown error'}`);
    return 1;
  } finally {
    try { await client?.end?.(); } catch { /* nothing to do */ }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => { process.exitCode = code; });
}
