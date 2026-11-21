// LISTEN-01 · Liquid Harmonics (sketch 09) — score safety, takeoff shape, single-authority and no-claim contract.
// Founder go-ahead 2026-11-21: review-only branch; plays only through the persistent player.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./ts_resolution_loader.mjs', import.meta.url);
const root = path.join(import.meta.dirname, '../..');
const L = await import(pathToFileURL(path.join(root, 'lib/listening/liquidHarmonics.ts')).href);
const { CONTROLS, DEFAULT_PARAMS, cleanScore, cleanParams, starterScore, riseTargets, lerpKey, accel, stepSeconds, scoreSeconds, SCORE_LIMITS, LIQUID_NOTES, toSlider, fromSlider, vowelAt } = L;

const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const code = rel => strip(fs.readFileSync(path.join(root, rel), 'utf8'));

test('36 controls; defaults are the founder settings of 21 Nov (sawtooth throb, 209 Hz, 6 voices)', () => {
  assert.equal(CONTROLS.length, 36);
  assert.equal(DEFAULT_PARAMS.shape, 'sawtooth'); assert.equal(DEFAULT_PARAMS.f0, 209); assert.equal(DEFAULT_PARAMS.voices, 6);
  for (const c of CONTROLS) if (!c.options) {
    assert.ok(c.v >= c.min && c.v <= c.max, `${c.k} default in range`);
    assert.ok(Math.abs(fromSlider(c, toSlider(c, c.v)) - c.v) < 1e-9, `${c.k} slider round-trips`);
  }
  assert.deepEqual(vowelAt(0), [300, 870, 2240]); assert.deepEqual(vowelAt(4), [270, 2290, 3010]);
});

test('a hostile score is clamped: ranges, unknown keys and types, step and length limits', () => {
  const s = cleanScore({ title: 'x'.repeat(500), author: { evil: 1 }, steps: [
    { type: 'morph', name: 'n', params: { f0: 99999, rate: -5, shape: 'noise', evil: 1, peakRate: 60 }, seconds: 0, hold: 1e9 },
    { type: 'rise', peak: 1000, length: 1, pitch: 99, emerge: 7, transform: -1, throbAccel: 0, pitchAccel: 50, harmAccel: 'x', brk: 'explode', gather: 'maybe' },
    { type: 'gather', seconds: 'NaN' }, { type: 'drop-table' }, null, 'end',
  ] });
  assert.equal(s.format, 'liquid-harmonics-score/1');
  assert.equal(s.title.length, 120);
  assert.equal(s.steps.length, 3, 'unknown steps are dropped');
  const [m, r, g] = s.steps;
  assert.deepEqual(m.params, { f0: 440, rate: 0.5 }, 'clamped, invalid option and unknown and rise-only keys dropped');
  assert.equal(m.seconds, 5); assert.equal(m.hold, 1800);
  assert.deepEqual([r.peak, r.length, r.pitch, r.emerge, r.transform, r.throbAccel, r.pitchAccel, r.harmAccel, r.brk, r.gather],
    [60, 30, 24, 1, 0, 1, 5, 3, 'open into stillness', 'yes']);
  assert.equal(g.seconds, 10);
  const many = cleanScore({ steps: Array.from({ length: 100 }, () => ({ type: 'morph', params: {}, seconds: 1800, hold: 1800 })) });
  assert.ok(many.steps.length <= SCORE_LIMITS.steps);
  assert.ok(scoreSeconds(many) <= SCORE_LIMITS.totalSeconds);
  assert.deepEqual(cleanParams({ brk: 'silence', riseTime: '30' }, true), { riseTime: '30', brk: 'silence' });
});

test('the starter score is labelled as a template, not as the founder’s composition', () => {
  const s = starterScore('getting closer!', DEFAULT_PARAMS);
  assert.match(s.title, /starter template/); assert.match(s.author, /starter template by Claude/);
  assert.deepEqual(s.steps.map(x => x.type), ['morph', 'gather', 'rise', 'release', 'morph', 'end']);
  assert.equal(s.steps[0].name, 'getting closer!');
  assert.equal(stepSeconds(s.steps[2]), 160);
});

test('takeoff: throb rate and depth only rise, pitch climbs, and acceleration bends the curve upward', () => {
  const P = { ...DEFAULT_PARAMS };
  const st = cleanScore({ steps: [{ type: 'rise', peak: 30, pitch: 12, emerge: 1, transform: 1, pitchAccel: 3 }] }).steps[0];
  const to = riseTargets(P, st);
  assert.ok(to.rate >= P.rate && to.depth === 1 && to.f0 === 418 && to.center === 1);
  assert.equal(to.voices, 8); assert.equal(to.shift, 200); assert.equal(to.spiralSpeed, 5); assert.equal(to.vowel, 4);
  // A peak below the current rate never makes the rise fall.
  assert.equal(riseTargets({ ...P, rate: 50 }, st).rate, 50);
  // Pitch at quarter, half, three-quarters of the rise: steady (1) vs takeoff (3).
  const at = p => [0.25, 0.5, 0.75].map(f => lerpKey('f0', P.f0, to.f0, accel(p)(f)));
  const steady = at(1), takeoff = at(3);
  takeoff.forEach((v, i) => assert.ok(v < steady[i], 'takeoff holds back early'));
  assert.ok(takeoff[2] - takeoff[1] > takeoff[1] - takeoff[0], 'and speeds up late');
  assert.ok(Math.abs(lerpKey('f0', 209, 418, 0.5) - 209 * Math.SQRT2) < 1e-9, 'pitch moves on a log scale');
});

test('one audio authority: the study never opens its own context or output, and fetches nothing', () => {
  for (const rel of ['lib/listening/liquidHarmonics.ts', 'app/listen/LiquidHarmonicsDesk.tsx']) {
    const src = code(rel);
    assert.ok(!/new\s+(window\.)?(webkit)?AudioContext|AudioContext\s*\(/.test(src), `${rel} must not create an AudioContext`);
    assert.ok(!/\.destination\b/.test(src), `${rel} must not reach the device output (context.destination)`);
    assert.ok(!/\bfetch\(|XMLHttpRequest|sendBeacon|getUserMedia|AudioWorklet|addModule/.test(src), `${rel} must not use network, microphone or worklets`);
  }
  assert.ok(!/localStorage|sessionStorage/.test(code('lib/listening/liquidHarmonics.ts')), 'the engine stores nothing');
  const desk = code('app/listen/LiquidHarmonicsDesk.tsx');
  assert.match(desk, /transport\.playStudy\(/); assert.match(desk, /transport\.stopMusic\(\)/);
  assert.ok(!/autoPlay|useEffect\([^)]*playStudy/.test(desk), 'nothing starts by itself');
  assert.match(desk, /soullab-liquid-harmonics-(kept|score|last)-v1/, 'device-local keys only');
  const room = code('app/listen/ListenRoom.tsx');
  assert.match(room, /<LiquidHarmonicsDesk \/>/);
});

test('no recorded media is admitted for this study', () => {
  assert.ok(!/liquid|harmonics/i.test(code('lib/listening/soundStudioMediaGate.ts')));
});

test('copy makes no state, effect or health claim', () => {
  const words = [code('app/listen/LiquidHarmonicsDesk.tsx'), ...CONTROLS.map(c => `${c.label} ${c.hint ?? ''}`), ...Object.values(LIQUID_NOTES)].join('\n');
  assert.ok(!/\b(heal(s|ing)?|cure|therap(y|eutic)|activat(e|es|ion)|unlock|DMT|pineal|gamma|entrain\w*|guarantee\w*|awaken\w*|entheogen\w*|psychedelic|trip)\b/i.test(words));
  assert.match(LIQUID_NOTES.claim, /makes no health claim/);
  assert.match(LIQUID_NOTES.safety, /Stop always works/);
  assert.match(LIQUID_NOTES.local, /only in this browser/);
});
