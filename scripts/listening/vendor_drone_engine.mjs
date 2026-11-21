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

// ---- T2 step B (Resonance & Detail): engine3.js, DERIVED from engine.js by exact, counted patches ----
// The accepted engine.js is never edited. engine3.js opens its fixed reverb and tone numbers to the member and adds
// a resonance band. Every patch keeps the original arithmetic when its control is at its default, so a neutral
// detail renders bit-identically (proved in tests/listening/drone_t2b_detail.test.mjs). Founder: "Yes, start step B".
export const PATCHES = [
  // the detail controls, completed and clamped once per render
  ['  async function render(src, opts, onProgress, assets={}){\n',
   '  async function render(src, opts, onProgress, assets={}){\n    const D3=completeDetail(opts.detail);\n'],
  // Tone: the drone's own low-pass (the preset cutoff) becomes a control
  ['const alpha=1-Math.exp(-2*Math.PI*config.cutoff/sr);',
   'const alpha=1-Math.exp(-2*Math.PI*(D3.toneHz===null?config.cutoff:D3.toneHz)/sr);'],
  // Size: the four diffusion delays scale together (× 1 is exact)
  ['lengths=delayMs.map(ms=>Math.max(1,Math.floor(sr*ms/1000)));',
   'lengths=delayMs.map(ms=>Math.max(1,Math.floor(sr*(ms*D3.size)/1000)));'],
  // Decay: the delays' cross-feedback (0.48 by default)
  ['delayL[z][p]=x*.36+outR*.48;delayR[z][p]=y*.36+outL*.48;',
   'delayL[z][p]=x*.36+outR*D3.decay;delayR[z][p]=y*.36+outL*D3.decay;'],
  // Dry and Wet, separately (× 1 is exact)
  ['left[i]=x*(1-space*.4)+wetL*space*.21;right[i]=y*(1-space*.4)+wetR*space*.21;',
   'left[i]=x*((1-space*.4)*D3.dry)+wetL*space*.21*D3.wet;right[i]=y*((1-space*.4)*D3.dry)+wetR*space*.21*D3.wet;'],
  // Resonance band, after Clean and before the loop seam and the level stage, so the seam and ceiling still hold
  ['    applyTone(left,right,clean,sr);\n',
   '    applyTone(left,right,clean,sr);\n    resonanceInPlace(left,right,D3.band,sr);\n'],
];
const DETAIL = `
// ---- T2 step B additions (not from lab.js) ----
const DETAIL_DEFAULTS={toneHz:null,size:1,decay:.48,wet:1,dry:1,band:{on:false,hz:1000,q:2,db:0}};
function completeDetail(d){d=d||{};const b=d.band||{};
  return {toneHz:d.toneHz==null?null:clampNum(d.toneHz,800,14000,null),size:clampNum(d.size,.5,2.5,1),decay:clampNum(d.decay,0,.8,.48),
    wet:clampNum(d.wet,0,3,1),dry:clampNum(d.dry,0,1.5,1),
    band:{on:b.on===true,hz:clampNum(b.hz,40,12000,1000),q:clampNum(b.q,.3,12,2),db:clampNum(b.db,-18,18,0)}};}
// RBJ peaking EQ on both channels; off, or 0 dB, leaves the samples untouched.
function resonanceInPlace(L,R,band,sr){if(!band||!band.on||band.db===0)return;
  const A=Math.pow(10,band.db/40),w=2*Math.PI*Math.min(band.hz,sr*.45)/sr,al=Math.sin(w)/(2*band.q),c=Math.cos(w),a0=1+al/A;
  const b0=(1+al*A)/a0,b1=-2*c/a0,b2=(1-al*A)/a0,a1=-2*c/a0,a2=(1-al/A)/a0;
  for(const x of [L,R]){let x1=0,x2=0,y1=0,y2=0;for(let i=0;i<x.length;i++){const v=b0*x[i]+b1*x1+b2*x2-a1*y1-a2*y2;x2=x1;x1=x[i];y2=y1;y1=v;x[i]=v;}}}
`;
let e3 = fs.readFileSync(dest, 'utf8');
for (const [from, to] of PATCHES) {
  const n = e3.split(from).length - 1;
  if (n !== 1) { console.error(`refused: patch target found ${n} times, expected once:\n${from}`); process.exit(1); }
  e3 = e3.replace(from, () => to);
}
e3 = e3
  .replace(/^\/\/ GENERATED — do not edit by hand\..*$/m, '// GENERATED — do not edit by hand. Derived from engine.js by scripts/listening/vendor_drone_engine.mjs (PATCHES).')
  .replace(/^export \{ /m, `${DETAIL}\nexport { completeDetail, DETAIL_DEFAULTS, `);
const dest3 = path.join(import.meta.dirname, '../../lib/listening/drone/engine3.js');
fs.writeFileSync(dest3, e3);
console.log(`wrote ${path.relative(process.cwd(), dest3)} (${PATCHES.length} patches)`);
