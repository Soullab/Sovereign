/**
 * E1LC SAMPLER — execution matrix.
 *
 * Proves the suite is LETHAL (every candidate dies on its named law) and
 * DISCRIMINATING (collateral is declared with a reason; undeclared collateral
 * is a defect in candidate isolation, never licence).
 *
 * Also asserts the frozen LC-1…LC-8 judge laws still hold, because this repair
 * is permitted only on the condition that it never weakens them.
 *
 * exit 0 = lethal + discriminating + reference clean + LC intact.
 */
import { LAWS, LAW_IDS } from './falsifiers.mjs';
import { CANDIDATES, REFERENCE } from './candidates.mjs';
import * as SHIPPED from '../../../jarvis-desktop/src/e1-local-capacity.js';

function runLaws(impl) {
  const failed = [];
  for (const id of LAW_IDS) {
    try { LAWS[id](impl); } catch (err) { failed.push({ id, message: err.message }); }
  }
  return failed;
}

let exit = 0;
const line = (s = '') => console.log(s);

line('E1LC SAMPLER constitutional matrix  (additive to the frozen LC-1…LC-8)');
line(`laws: ${LAW_IDS.length}   candidates: ${CANDIDATES.length}`);
line();

const shipped = runLaws(SHIPPED);
if (shipped.length) {
  exit = 1;
  line(`SHIPPED   ✗ FAILS ${shipped.length}/${LAW_IDS.length}`);
  for (const f of shipped) line(`          ${f.id}`);
} else {
  line(`SHIPPED   ✓ passes ${LAW_IDS.length}/${LAW_IDS.length}`);
}

const ref = runLaws(REFERENCE);
if (ref.length) {
  exit = 1;
  line(`REFERENCE ✗ FAILS ${ref.length} — the laws are not mutually satisfiable`);
  for (const f of ref) line(`          ${f.id}: ${f.message}`);
} else {
  line(`REFERENCE ✓ passes ${LAW_IDS.length}/${LAW_IDS.length}`);
}

line();
let dead = 0;
let unclassified = 0;
for (const c of CANDIDATES) {
  const ids = runLaws(c.impl).map((f) => f.id);
  const diedOnNamed = ids.includes(c.dies_on);
  const extra = ids.filter((id) => id !== c.dies_on && !(c.collateral || []).includes(id));

  if (diedOnNamed) dead += 1; else exit = 1;
  if (extra.length) { unclassified += 1; exit = 1; }

  line(`${diedOnNamed ? (extra.length ? '⚠' : '✓') : '✗'} ${c.id.padEnd(34)} ${diedOnNamed ? 'DEAD on' : 'SURVIVED'} ${c.dies_on}`);
  line(`    ${c.error}`);
  if ((c.collateral || []).length) {
    line(`    declared collateral: ${c.collateral.join(', ')}`);
    if (c.collateral_reason) line(`      reason: ${c.collateral_reason}`);
  }
  if (extra.length) line(`    UNCLASSIFIED COLLATERAL: ${extra.join(', ')}  → repair candidate isolation`);
  if (!diedOnNamed) line(`    laws it failed: ${ids.length ? ids.join(', ') : '(none — the law is not lethal)'}`);
}

// ── the frozen judge laws must be undisturbed ────────────────────────────────
line();
let lcFailed = 0;
try {
  const LC = await import('../jarvis-o5-r3-runtime-binding/capacity/falsifiers.mjs');
  for (const [id, f] of Object.entries(LC.LC_FALSIFIERS)) {
    const got = LC.REAL_CAPACITY(f.model, f.sample);
    if (got.ok !== f.ok || (got.reason ?? null) !== (f.reason ?? null)) {
      lcFailed += 1; exit = 1;
      line(`LC ✗ ${id} — expected ok=${f.ok} reason=${f.reason}, got ok=${got.ok} reason=${got.reason}`);
    }
  }
  line(`FROZEN LC-1…LC-8  ${lcFailed === 0 ? `✓ all ${Object.keys(LC.LC_FALSIFIERS).length} intact` : `✗ ${lcFailed} BROKEN`}`);
} catch (err) {
  exit = 1;
  line(`FROZEN LC-1…LC-8  ✗ could not be evaluated: ${err.message}`);
}

line();
line(`lethality      ${dead}/${CANDIDATES.length} dead on their named law`);
line(`discrimination ${unclassified === 0 ? 'clean' : `${unclassified} with unclassified collateral`}`);
line(`verdict        ${exit === 0 ? 'LETHAL + DISCRIMINATING · LC INTACT' : 'NOT ACCEPTABLE'}`);
process.exit(exit);
