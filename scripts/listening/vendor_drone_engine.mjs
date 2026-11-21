#!/usr/bin/env node
// SOULLAB TRANSFORM T2 — derive lib/listening/drone/engine.js from the founder-accepted
// Voice to Drone Lab v0.3.4 (engine revision 2) lab.js, VERBATIM.
//
// The founder accepted the sound of eight renders from this exact lab.js (2026-11-21,
// "they are all phenomenal!"). So the engine is not rewritten: its DOM-free functions are
// copied line for line, and this script refuses any lab.js whose SHA-256 differs.
//
//   node scripts/listening/vendor_drone_engine.mjs "<path to>/Soullab_Voice_to_Drone_Lab_v0.3.4-clean-level-tune/lab.js"
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const LAB_SHA256 = '8407c45e8a6b6be17db3072cf1391451d3e28067266e690b6d471b42617e5d83';

// 1-based inclusive line ranges of lab.js holding the engine (no DOM, no page state).
export const RANGES = [
  [11, 15], // presets
  [17, 23], // MIN_REGION_SECONDS, INTERVAL_RANGE, clampNum, completeMix, signedSt
  [33, 33], // safeName
  [41, 62], // makeWaveBlob, writeHeader, wav24, syntheticVowel
  [85, 85], // defaultLayerMix
  [221, 224], // fieldRecipe
  [232, 235], // NOTE_NAMES, noteInfo, snapCents, fmtC
  [321, 628], // seedRand … render (clean, level, tune, field, granular engine)
  [650, 664], // buildRecipe, recipeToSettings
];

export const EXPORTS = [
  'presets', 'MIN_REGION_SECONDS', 'INTERVAL_RANGE', 'clampNum', 'completeMix', 'defaultLayerMix', 'safeName',
  'makeWaveBlob', 'wav24', 'syntheticVowel', 'noteInfo', 'snapCents', 'seedRand',
  'completeClean', 'completeLevel', 'completeTune', 'findClipRuns', 'repairClipped', 'applyTone', 'limitInPlace',
  'measureLufs', 'detectPitch', 'FIELD_MODEL', 'FIELD_PATHS', 'FIELD_ELEMENTS', 'defaultField', 'completeField',
  'fieldCycles', 'fieldPosition', 'binauralPass', 'voiceTexture', 'render', 'buildRecipe', 'recipeToSettings',
];

const labPath = process.argv[2];
if (!labPath) { console.error('usage: vendor_drone_engine.mjs <lab.js>'); process.exit(2); }
const bytes = fs.readFileSync(labPath);
const sha = crypto.createHash('sha256').update(bytes).digest('hex');
if (sha !== LAB_SHA256) { console.error(`refused: lab.js sha256 ${sha} is not the accepted ${LAB_SHA256}`); process.exit(1); }
const lines = bytes.toString('utf8').split('\n');

const out = [
  '// GENERATED — do not edit by hand. Regenerate with scripts/listening/vendor_drone_engine.mjs.',
  '// SOULLAB TRANSFORM T2: the Voice to Drone Lab v0.3.4 engine (revision 2), copied verbatim from',
  `// lab.js sha256 ${LAB_SHA256}, lines ${RANGES.map(([a, b]) => (a === b ? a : `${a}-${b}`)).join(', ')}.`,
  '// Founder accepted its sound 2026-11-21; T2 approved 2026-11-21 ("Approve as recommended"), #1979.',
  '// On-device, offline sample arithmetic. No DOM, no network, no storage, no microphone.',
  '/* eslint-disable */',
  '',
];
for (const [a, b] of RANGES) {
  out.push(`// ---- lab.js ${a}-${b} ----`);
  for (let i = a; i <= b; i++) out.push(lines[i - 1]);
}
out.push('', `export { ${EXPORTS.join(', ')} };`, '');

const dest = path.join(import.meta.dirname, '../../lib/listening/drone/engine.js');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out.join('\n'));
console.log(`wrote ${path.relative(process.cwd(), dest)} from lab.js ${sha.slice(0, 16)}…`);
