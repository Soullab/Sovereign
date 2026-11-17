#!/usr/bin/env node
/**
 * Mutation check for the ledger and the classifier: copy lib/ to a temp directory, break ONE line of ledger.mjs or
 * classify.mjs, run the unit tests against the copy, and require that they fail. A mutant that survives means the tests
 * cannot see that line being wrong.
 *
 *   node tests/e2e/journey-ledger/lib/mutants.mjs        (exit 0 only if every mutant is killed)
 *
 * The repository copy is never modified.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const MUTANTS = [
  ['ledger', 'M01 NOT RUN no longer blocks "works"', "counts['DEAD END'] === 0 && counts['NOT RUN'] === 0", "counts['DEAD END'] === 0"],
  ['ledger', 'M02 an empty ledger works', "if (rows.length === 0) return { works: false", "if (rows.length === 0) return { works: true"],
  ['ledger', 'M03 a row may end twice', "if (row.settled) throw new Error(`row ${id} already ended as ${row.status}`);", ''],
  ['ledger', 'M04 PASS needs no evidence', "if (typeof evidence !== 'string' || evidence.trim() === '') {", "if (false) {"],
  ['ledger', 'M05 a crashed step does not stop the walk', "      throw e;\n    }\n  }\n\n  note(", "      return { status: NOT_RUN, evidence: 'swallowed' };\n    }\n  }\n\n  note("],
  ['ledger', 'M06 the report always claims works', "lines.push(v.works ? 'VERDICT: works' : `VERDICT: does NOT work (${v.reason})`);", "lines.push('VERDICT: works');"],
  ['ledger', 'M07 the exit code is always 0', "exitCode() { return this.verdict().works ? 0 : 1; }", "exitCode() { return 0; }"],
  ['ledger', 'M08 a planned row starts as PASS', "this.rows.push({ id, title, status: NOT_RUN, evidence: 'planned, not exercised' });\n    return this;\n  }\n\n  /** Insert", "this.rows.push({ id, title, status: PASS, evidence: 'planned, not exercised' });\n    return this;\n  }\n\n  /** Insert"],
  ['classify', 'M10 a blank landing page is fine', "if (text.length < REAL_TEXT_MIN) {", "if (false) {"],
  ['classify', 'M11 a rendered 404 page with words is fine', "const marker = ERROR_MARKERS.find(m => text.toLowerCase().includes(m.toLowerCase()));", "const marker = null;"],
  ['classify', 'M12 a failed request is ignored', "const failed = (o.requests || []).find(r => r.status >= 400);", "const failed = null;"],
  ['classify', 'M13 a dead link probed as 404 passes when the client rendered text', "if (probe != null && probe >= 400) {", "if (false) {"],
  ['classify', 'M14 a document 4xx/5xx is ignored', "if (doc != null && doc >= 400) {", "if (false) {"],
  ['classify', 'M15 a model call is scored as the page working', "if (o.modelCalls > 0) {", "if (false) {"],
  ['classify', 'M16 a press that does nothing passes', "return { status: DEAD_END, evidence: `${who}: nothing happened", "return { status: PASS, evidence: `${who}: nothing happened"],
  ['classify', 'M17 a bounce to sign-in is fine', "if (/^\\/(signin|invitation-required)(\\/|$)/.test(landedPath) && landedPath !== hrefPath) {", "if (false) {"],
  ['classify', 'M18 a click the page itself blocked is hidden as NOT RUN', "if (o.clickError.kind === 'intercepted-by-page') {", "if (false) {"],
  ['classify', 'M19 a disabled control with no stated reason passes', ": { status: NOT_RUN, evidence: `${who} is disabled on arrival and nothing on it says why", ": { status: PASS, evidence: `${who} is disabled on arrival and nothing on it says why"],
  ['classify', 'M19b a disabled control with no stated reason is called a dead end', ": { status: NOT_RUN, evidence: `${who} is disabled on arrival and nothing on it says why", ": { status: DEAD_END, evidence: `${who} is disabled on arrival and nothing on it says why"],
  ['classify', 'M25 a request still in flight is ignored', "if (o.pendingRequests > 0) {", "if (false) {"],
  ['classify', 'M26 the native file chooser is not seen', "if (o.dialogOpened || o.fileChooserOpened || textChanged", "if (o.dialogOpened || textChanged"],
  ['classify', 'M20 an external link is followed as if it were ours', "if (o.externalHref) {", "if (false) {"],
  ['classify', 'M21 a framework error overlay is ignored', "if (o.overlay) {\n      return { status: DEAD_END, evidence: `${who} led to", "if (false) {\n      return { status: DEAD_END, evidence: `${who} led to"],
  ['classify', 'M23 every inert button is excused as already selected', "if (o.alreadySelected) {", "if (true) {"],
  ['classify', 'M24 the current choice is never excused', "if (o.alreadySelected) {", "if (false) {"],
  ['classify', 'M22 a same-page anchor to a missing id passes', ": { status: DEAD_END, evidence: `${who} points at ${o.href}", ": { status: PASS, evidence: `${who} points at ${o.href}"],
];

// The unmutated copy must pass, or "killed" means nothing.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-mutant-base-'));
  try {
    for (const f of fs.readdirSync(here)) if (f.endsWith('.mjs') && f !== 'mutants.mjs') fs.copyFileSync(path.join(here, f), path.join(tmp, f));
    const r = spawnSync(process.execPath, ['--test', ...fs.readdirSync(tmp).filter(f => f.endsWith('.test.mjs')).map(f => path.join(tmp, f))], { encoding: 'utf8' });
    if (r.status !== 0) { console.log('BASELINE FAILS: the unmutated tests do not pass, so no mutant can be judged'); process.exit(2); }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

let survived = 0;
for (const [file, name, from, to] of MUTANTS) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-mutant-'));
  try {
    for (const f of fs.readdirSync(here)) if (/\.(mjs)$/.test(f) && f !== 'mutants.mjs') fs.copyFileSync(path.join(here, f), path.join(tmp, f));
    const target = path.join(tmp, `${file}.mjs`);
    const src = fs.readFileSync(target, 'utf8');
    if (!src.includes(from)) { console.log(`INVALID  ${name}: the line it breaks is not in ${file}.mjs (the mutant list is stale)`); survived += 1; continue; }
    fs.writeFileSync(target, src.replace(from, to));
    // A mutant that does not even parse would be "killed" by accident, which proves nothing about the tests.
    if (spawnSync(process.execPath, ['--check', target], { encoding: 'utf8' }).status !== 0) { console.log(`INVALID  ${name}: the mutant does not parse`); survived += 1; continue; }
    const r = spawnSync(process.execPath, ['--test', ...fs.readdirSync(tmp).filter(f => f.endsWith('.test.mjs')).map(f => path.join(tmp, f))], { encoding: 'utf8' });
    if (r.status === 0) { console.log(`SURVIVED ${name}`); survived += 1; } else console.log(`killed   ${name}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
console.log(survived === 0 ? `\nall ${MUTANTS.length} mutants killed` : `\n${survived} mutant(s) survived or were invalid`);
process.exit(survived === 0 ? 0 : 1);
