// SOULLAB TRANSFORM T2 — the Voice to Drone Lab's own four suites (MERGE 24, REGION 15,
// FIELD 21, FINISH 30) still pass on the accepted lab.js, whose engine lines
// lib/listening/drone/engine.js carries verbatim (proved in drone_t2_parity.test.mjs).
//
// The suites write their reports into the folder they run from, so they are run on a
// TEMPORARY COPY of the lab, never in the founder's folder. Skipped when the private lab
// folders are not on this machine.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const BASE = process.env.SOULLAB_SOUND_LAB_DIR ?? '/Users/soullab/Documents/Soullab Sound Lab';
const LAB = path.join(BASE, 'Soullab_Voice_to_Drone_Lab_v0.3.4-clean-level-tune');
const V02 = process.env.SOULLAB_DRONE_V02 ?? '/Users/soullab/Downloads/Soullab_Voice_to_Drone_Lab_v0.2/lab.js';
const V03 = process.env.SOULLAB_DRONE_V03 ?? '/Users/soullab/Downloads/Soullab_Voice_to_Drone_Lab_v0.3/lab.js';
const prev = (v) => path.join(BASE, `Soullab_Voice_to_Drone_Lab_${v}`, 'lab.js');
const SUITES = [
  ['layers', [V02, V03], 24],
  ['region', [prev('v0.3.1-merge-candidate')], 15],
  ['field', [prev('v0.3.2-region-select')], 21],
  ['finish', [prev('v0.3.3-spatial-field')], 30],
];
const present = fs.existsSync(path.join(LAB, 'lab.js')) && SUITES.every(([, args]) => args.every((a) => fs.existsSync(a)));

test('the lab suites pass on a temporary copy of the accepted lab', { skip: !present && 'private lab folders not on this machine', timeout: 900_000 }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'soullab-drone-lab-'));
  try {
    const copy = path.join(tmp, 'lab');
    fs.cpSync(LAB, copy, { recursive: true });
    for (const [name, args, expected] of SUITES) {
      let out;
      try {
        out = execFileSync(process.execPath, [path.join(copy, 'tools', `test_${name}.js`), ...args], { cwd: copy, encoding: 'utf8', maxBuffer: 1 << 26 });
      } catch (e) { out = String(e.stdout ?? '') + String(e.stderr ?? ''); }
      const pass = (out.match(/^PASS /gm) ?? []).length, fail = (out.match(/^FAIL /gm) ?? []).length;
      assert.equal(fail, 0, `${name}: no failures\n${out.split('\n').filter((l) => l.startsWith('FAIL')).join('\n')}`);
      assert.equal(pass, expected, `${name}: ${expected} checks pass`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
