#!/usr/bin/env node
/**
 * WORK-UNIT STALENESS CENSUS — read-only.
 *
 * The Desktop queue presents every unrouted Work Unit as the same pending
 * decision: "Bind canonical route." They are not the same. A unit authored
 * weeks ago is scoped to a base_ref and a path set that may no longer exist,
 * so binding it is a reconciliation, not a yes.
 *
 * This reports, per unit: whether it is routed, whether anything ever ran,
 * whether its base_ref is still reachable, and how much of its declared scope
 * survives at the current head. Nothing is written. No unit is bound, claimed,
 * retired or mutated in any way.
 *
 * usage:
 *   node work-unit-census.mjs [--repo <path>] [--home <delegation home>] [--json]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').slice(n.length + 3) || null;
const REPO = arg('repo') || process.cwd();
const HOME = arg('home') || process.env.AIN_DELEGATION_HOME || path.join(os.homedir(), '.claude', 'ain-delegation');
const AS_JSON = process.argv.includes('--json');

const UNITS = path.join(HOME, 'work-units-v2');
if (!fs.existsSync(UNITS)) {
  console.error(`no work-units-v2 under ${HOME}`);
  console.error('pass --home=<delegation home>, or set AIN_DELEGATION_HOME.');
  process.exit(4);
}

const git = (args) => {
  try {
    return execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
};
const reachable = (sha) => !!sha && git(['cat-file', '-e', sha]) !== null;
const existsAtHead = (p) => git(['cat-file', '-e', `HEAD:${p}`]) !== null;

const rows = [];
for (const file of fs.readdirSync(UNITS).filter((f) => f.endsWith('.json')).sort()) {
  const full = path.join(UNITS, file);
  let doc;
  try { doc = JSON.parse(fs.readFileSync(full, 'utf8')); }
  catch (err) { rows.push({ file, verdict: 'UNREADABLE', detail: err.message }); continue; }

  const wu = doc.work_unit;
  if (!wu) { rows.push({ file, verdict: 'NOT_A_WORK_UNIT' }); continue; }

  const id = wu.identity?.id ?? file;
  const objective = wu.identity?.objective ?? '(none)';
  const state = wu.state?.lifecycle_state ?? '(none)';
  const disposition = wu.state?.disposition ?? '(none)';
  const routed = !!(wu.routing?.route_record || wu.routing?.route_digest || wu.routing?.bound_at_sha);
  const attempts = Array.isArray(wu.execution?.attempts) ? wu.execution.attempts.length : 0;
  const baseRef = wu.scope?.base_ref ?? null;
  const baseOk = reachable(baseRef);

  const allowed = Array.isArray(wu.scope?.allowed_paths) ? wu.scope.allowed_paths : [];
  const present = allowed.filter(existsAtHead);
  const missing = allowed.filter((p) => !present.includes(p));

  // Verdict is descriptive. It authorizes nothing and recommends nothing.
  let verdict;
  if (routed || attempts > 0) verdict = 'ROUTED';
  else if (!allowed.length) verdict = 'UNROUTED · NO SCOPE DECLARED';
  else if (missing.length === 0 && baseOk) verdict = 'UNROUTED · SCOPE INTACT';
  else if (missing.length === allowed.length) verdict = 'UNROUTED · SCOPE GONE';
  else verdict = 'UNROUTED · SCOPE DRIFTED';

  rows.push({
    file, id, objective, state, disposition, routed, attempts,
    base_ref: baseRef, base_reachable: baseOk,
    scope_total: allowed.length, scope_present: present.length,
    scope_missing: missing, verdict,
  });
}

if (AS_JSON) { console.log(JSON.stringify({ home: HOME, repo: REPO, units: rows }, null, 2)); process.exit(0); }

const by = (v) => rows.filter((r) => r.verdict === v);
const ORDER = ['UNROUTED · SCOPE INTACT', 'UNROUTED · SCOPE DRIFTED', 'UNROUTED · SCOPE GONE',
  'UNROUTED · NO SCOPE DECLARED', 'ROUTED', 'UNREADABLE', 'NOT_A_WORK_UNIT'];

console.log(`WORK-UNIT CENSUS   (read-only — nothing was bound, claimed or changed)`);
console.log(`home ${HOME}`);
console.log(`repo ${REPO}  @ ${git(['rev-parse', '--short', 'HEAD']) ?? '?'}`);
console.log(`units ${rows.length}`);

for (const v of ORDER) {
  const group = by(v);
  if (!group.length) continue;
  console.log(`\n── ${v}  (${group.length}) ${'─'.repeat(Math.max(0, 48 - v.length))}`);
  for (const r of group) {
    console.log(`  ${r.id ?? r.file}`);
    if (r.objective) console.log(`      ${r.objective}`);
    const bits = [];
    if (r.state) bits.push(`state=${r.state}`);
    if (r.attempts !== undefined) bits.push(`attempts=${r.attempts}`);
    if (r.base_ref) bits.push(`base=${String(r.base_ref).slice(0, 9)}${r.base_reachable ? '' : ' UNREACHABLE'}`);
    if (r.scope_total) bits.push(`scope=${r.scope_present}/${r.scope_total}`);
    if (bits.length) console.log(`      ${bits.join('  ')}`);
    if (r.scope_missing?.length) console.log(`      missing: ${r.scope_missing.join(', ')}`);
  }
}

console.log(`\nSCOPE INTACT units are the ones where "bind canonical route" is a simple decision.`);
console.log(`DRIFTED and GONE units need reconciliation first; the queue does not distinguish them.`);
