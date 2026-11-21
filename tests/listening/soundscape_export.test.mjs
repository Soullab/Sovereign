// SAVE AS AN AUDIO FILE (#1979; founder 2026-11-21: "how do I transform this to a recorded loop that plays for 2 hours
// on the external sound players on the micro memory card?", then "Yes, options 1+2": a headphones file, a speaker
// file, or both). The pure parts: the piece plan, the device versions, the file name and the WAV header.
// The sound itself (pieces join without a seam) is proven in Chrome by soundscape_export_browser_witness.cjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const repo = path.join(import.meta.dirname, '../..');
const esbuild = createRequire(import.meta.url)(path.join(repo, 'node_modules/esbuild'));
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'soundscape-export-')), 'm.mjs');
esbuild.buildSync({ stdin: { contents: `export * from './lib/listening/soundscapeExport.ts'; export { phaseAt } from './lib/listening/soundscapeEngine.ts'; export * from './lib/listening/focusSoundscape.ts'; export { EFFECT_WORDS } from './lib/listening/toneLayerSetting.ts';`, resolveDir: repo, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const M = await import(out);

const base = M.focusSoundscapeSpec({ need: 'deep', stimulation: 'medium', world: 'nature', task: 'writing' });
const binaural = { ...base, toneLayer: { hz: 220, pulseMode: 'binaural', pulseHz: 10 } };

test('the plan covers the whole file once, every piece joining the last with the same overlap', () => {
  for (const seconds of [60, 299, 300, 301, 1800, 5400, 7200]) {
    const plan = M.exportPlan(seconds);
    let edge = 0;
    plan.forEach((p, i) => {
      assert.ok(Math.abs(p.keepFrom + p.keepSec - p.renderSec) < 1e-9, 'each piece keeps through its end');
      const keptStart = p.origin + p.keepFrom;
      if (i === 0) assert.equal(keptStart, 0);
      else assert.ok(Math.abs(keptStart - (edge - M.EXPORT_JOIN_SEC)) < 1e-9, `piece ${i} overlaps the last by the join`);
      if (i > 0) assert.ok(p.keepFrom >= M.EXPORT_PREROLL_SEC, 'a later piece discards its settling time');
      edge = keptStart + p.keepSec;
    });
    assert.ok(Math.abs(edge - seconds) < 1e-9, `${seconds}s ends exactly`);
    assert.ok(plan.every(p => p.renderSec <= M.EXPORT_PIECE_SEC + M.EXPORT_PREROLL_SEC + M.EXPORT_JOIN_SEC), 'no piece needs more memory than one piece');
  }
  assert.equal(M.exportPlan(7200).length, 24);
  assert.equal(M.exportPlan(99999).at(-1).origin + M.exportPlan(99999).at(-1).renderSec, M.EXPORT_MAX_SEC, 'never longer than 2 hours');
});

test('with a binaural pulse there are two versions; the speaker one swaps only the pulse mode, at the same rate', () => {
  const v = M.exportVariants(binaural);
  assert.deepEqual(v.map(x => x.device), ['headphones', 'speaker']);
  assert.equal(v[0].spec, binaural, 'the headphones file is the design as it is');
  assert.deepEqual(v[1].spec.toneLayer, { hz: 220, pulseMode: 'isochronic', pulseHz: 10 });
  assert.deepEqual({ ...v[1].spec, toneLayer: null }, { ...binaural, toneLayer: null }, 'nothing else changes');
  const toneLab = { ...base, tone: { hz: 200, pulseMode: 'binaural', pulseHz: 6 } };
  assert.equal(M.speakerSpec(toneLab).tone.pulseMode, 'isochronic');
});

test('without a binaural pulse one file serves every device', () => {
  for (const toneLayer of [null, { hz: 432, pulseMode: 'none', pulseHz: 0 }, { hz: 432, pulseMode: 'isochronic', pulseHz: 6 }, { hz: 432, pulseMode: 'monaural', pulseHz: 6 }]) {
    const v = M.exportVariants({ ...base, toneLayer });
    assert.equal(v.length, 1); assert.equal(v[0].device, 'any');
  }
});

test('file names say what the file is, never what it does, and are safe on a memory card', () => {
  const [h, s] = M.exportVariants(binaural);
  assert.equal(M.exportFileName('Rainy day Fields and Woods', 120, h), 'Rainy day Fields and Woods · 120 min · 220 Hz 10 Hz binaural (headphones).wav');
  assert.equal(M.exportFileName('Rainy day Fields and Woods', 120, s), 'Rainy day Fields and Woods · 120 min · 220 Hz 10 Hz isochronic (speaker).wav');
  assert.equal(M.exportFileName('  ', 30, M.exportVariants(base)[0]), 'Soundscape · 30 min.wav');
  assert.equal(M.exportFileName('a/b:c*?"<>|d', 60, M.exportVariants(base)[0]), 'a b c d · 60 min.wav');
  const copy = fs.readFileSync(path.join(repo, 'app/listen/FocusSoundExport.tsx'), 'utf8').toLowerCase() + fs.readFileSync(path.join(repo, 'lib/listening/soundscapeExport.ts'), 'utf8').split('\n').filter(l => /label:|return `/.test(l)).join('\n').toLowerCase();
  const found = M.EFFECT_WORDS.filter(w => new RegExp(`\\b${w}\\b`).test(copy));
  assert.deepEqual(found, [], 'no effect words in the export copy');
});

test('the WAV header describes 16-bit stereo 44.1 kHz and a 2-hour file fits the format', () => {
  const frames = 7200 * 44100;
  const v = new DataView(M.wavHeader(frames));
  const text = (at, n) => String.fromCharCode(...Array.from({ length: n }, (_, i) => v.getUint8(at + i)));
  assert.equal(text(0, 4), 'RIFF'); assert.equal(text(8, 4), 'WAVE'); assert.equal(text(36, 4), 'data');
  assert.equal(v.getUint16(22, true), 2); assert.equal(v.getUint32(24, true), 44100); assert.equal(v.getUint16(34, true), 16);
  assert.equal(v.getUint32(40, true), frames * 4);
  assert.ok(frames * 4 + 36 < 2 ** 32, 'under the 4 GB limit');
  assert.equal(frames * 4, 1270080000, 'about 1.27 GB');
});

test('phase on the one timeline: zero at the start, the fractional cycle later', () => {
  assert.equal(M.phaseAt(220, 0), 0);
  assert.equal(M.phaseAt(0, 100), 0);
  assert.ok(Math.abs(M.phaseAt(220, 300.25) - 0) < 1e-9);
  assert.ok(Math.abs(M.phaseAt(10, 0.025) - 0.25) < 1e-9);
});
