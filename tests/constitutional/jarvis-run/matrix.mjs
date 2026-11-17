/**
 * JARVIS-RUN — execution matrix.
 *
 * Proves the suite is LETHAL (every candidate dies on its named falsifier) and
 * DISCRIMINATING (collateral kills are declared, with a reason; an undeclared
 * one is a defect in candidate isolation, never licence).
 *
 * The shipped implementation must pass every law. A surviving candidate repairs
 * the SUITE, never the candidate.
 *
 * exit 0 = lethal + discriminating + reference clean.
 */
import { LAWS, LAW_IDS } from './falsifiers.mjs';
import { CANDIDATES, REFERENCE } from './candidates.mjs';
import * as SHIPPED from '../../../scripts/builder/jarvis-run.mjs';

function runLaws(impl) {
  const failed = [];
  for (const id of LAW_IDS) {
    try { LAWS[id](impl); } catch (err) { failed.push({ id, message: err.message }); }
  }
  return failed;
}

let exit = 0;
const line = (s = '') => console.log(s);

line('JARVIS-RUN constitutional matrix');
line(`laws: ${LAW_IDS.length}   candidates: ${CANDIDATES.length}`);

// ── the shipped implementation must satisfy every law ────────────────────────
line();
const shippedFailed = runLaws(SHIPPED);
if (shippedFailed.length) {
  exit = 1;
  line(`SHIPPED  ✗ FAILS ${shippedFailed.length}/${LAW_IDS.length}`);
  for (const f of shippedFailed) line(`         ${f.id}: ${f.message}`);
} else {
  line(`SHIPPED  ✓ passes ${LAW_IDS.length}/${LAW_IDS.length}`);
}

// ── the reference double must agree, proving the laws are mutually satisfiable ─
const refFailed = runLaws(REFERENCE);
if (refFailed.length) {
  exit = 1;
  line(`REFERENCE ✗ FAILS ${refFailed.length} — the laws are not mutually satisfiable`);
  for (const f of refFailed) line(`          ${f.id}: ${f.message}`);
} else {
  line(`REFERENCE ✓ passes ${LAW_IDS.length}/${LAW_IDS.length}`);
}

// ── each candidate must die on its named law ─────────────────────────────────
line();
let dead = 0;
let unclassified = 0;
for (const c of CANDIDATES) {
  const failed = runLaws(c.impl);
  const ids = failed.map((f) => f.id);
  const diedOnNamed = ids.includes(c.dies_on);
  const extra = ids.filter((id) => id !== c.dies_on && !c.collateral.includes(id));

  if (diedOnNamed) dead += 1; else exit = 1;
  if (extra.length) { unclassified += 1; exit = 1; }

  const mark = diedOnNamed ? (extra.length ? '⚠' : '✓') : '✗';
  line(`${mark} ${c.id.padEnd(34)} ${diedOnNamed ? 'DEAD on' : 'SURVIVED'} ${c.dies_on}`);
  line(`    ${c.error}`);
  if (c.collateral.length) line(`    declared collateral: ${c.collateral.join(', ')}`);
  if (extra.length) line(`    UNCLASSIFIED COLLATERAL: ${extra.join(', ')}  → repair candidate isolation`);
  if (!diedOnNamed) line(`    laws it failed: ${ids.length ? ids.join(', ') : '(none — the law is not lethal)'}`);
}

line();
line(`lethality      ${dead}/${CANDIDATES.length} candidates dead on their named law`);
line(`discrimination ${unclassified === 0 ? 'clean' : `${unclassified} candidate(s) with unclassified collateral`}`);
line(`verdict        ${exit === 0 ? 'LETHAL + DISCRIMINATING' : 'NOT ACCEPTABLE'}`);
process.exit(exit);
