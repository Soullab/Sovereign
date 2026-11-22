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
const { pinkNoise, swellChord, touchCarrier, touchRate, touchCurve, TOUCH_LIMITS, musicRoot, musicKeyName, musicNote, nextDegree, musicDensity, PENTATONIC, MUSIC_DEGREES, CONTROLS, DEFAULT_PARAMS, cleanScore, cleanParams, starterScore, riseTargets, lerpKey, accel, stepSeconds, scoreSeconds, SCORE_LIMITS, LIQUID_NOTES, toSlider, fromSlider, vowelAt } = L;

const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const code = rel => strip(fs.readFileSync(path.join(root, rel), 'utf8'));

test('42 controls (39 field incl. 3 atmosphere + 2 listener music + 1 listener touch); defaults are the founder settings of 21 Nov (sawtooth throb, 209 Hz, 6 voices)', () => {
  assert.equal(CONTROLS.length, 42);
  assert.equal(CONTROLS.filter(c => c.g !== 'Music' && c.g !== 'Touch').length, 39, 'the field: 36 + 3 atmosphere');
  assert.equal(DEFAULT_PARAMS.air, 0); assert.equal(DEFAULT_PARAMS.swell, 0);
  assert.equal(DEFAULT_PARAMS.touch, 0, 'touch starts at zero');
  assert.equal(DEFAULT_PARAMS.music, 0, 'the music layer is off until the listener raises it');
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

test('music layer: in the key of the field, consonant, never moved by a journey, quiet in a rise', () => {
  // Root: the fundamental snapped to a semitone, placed in 220–440 Hz.
  for (const [f0, key] of [[98, 'G'], [73.4, 'D'], [110, 'A'], [147, 'D'], [196, 'G'], [209, 'A♭'], [55, 'A'], [440, 'A']]) {
    const r = musicRoot(f0);
    assert.ok(r >= 220 - 1e-9 && r < 440, `${f0} → root ${r} in range`);
    assert.equal(musicKeyName(f0), key, `${f0} Hz is ${key}`);
    const semis = Math.round(12 * Math.log2(r / f0)); assert.equal(((semis % 12) + 12) % 12, 0, 'root is the field fundamental, octave-shifted');
  }
  // Every note the melody can reach is a major-pentatonic degree of the root.
  const root = musicRoot(98);
  for (let d = MUSIC_DEGREES.lo; d <= MUSIC_DEGREES.hi; d++) {
    const semi = Math.round(12 * Math.log2(musicNote(root, d) / root));
    assert.ok(PENTATONIC.includes(((semi % 12) + 12) % 12), `degree ${d} is in the pentatonic`);
  }
  // Wandering stays in range whatever the random source does.
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let deg = 2; for (let i = 0; i < 5000; i++) { deg = nextDegree(deg, i % 2, (i % 9) - 2, rnd); assert.ok(deg >= MUSIC_DEGREES.lo && deg <= MUSIC_DEGREES.hi); }
  assert.ok(Math.abs(nextDegree(3, 0, 3, () => 0.99) - 3) <= 1, 'calm music moves by step');
  // The listener's balance is never written by a score.
  const s = cleanScore({ steps: [{ type: 'morph', params: { music: 1, musicMove: 1, f0: 98 }, seconds: 10, hold: 0 }] });
  assert.deepEqual(s.steps[0].params, { f0: 98 }, 'music keys are dropped from journey morphs');
  assert.deepEqual(cleanParams({ music: 0.5 }, true), { music: 0.5 }, 'but kept for the listener’s own last settings');
  // Quieter and sparser in a rise.
  const P = { ...DEFAULT_PARAMS, musicMove: 0.5 };
  assert.ok(musicDensity(P, 'rising') < musicDensity(P, 'journey') * 0.5);
  assert.ok(musicDensity({ ...P, musicMove: 1 }, 'free') > musicDensity({ ...P, musicMove: 0 }, 'free') * 2, 'movement setting is audible in density');
});

test('touch (Phase 1): felt band, rate cap, hard ceiling, listener-owned, and no path from the music layer', () => {
  for (const f0 of [55, 73.4, 98, 110, 147, 196, 209, 440]) { const c = touchCarrier(f0); assert.ok(c >= 40 && c <= 120, `${f0} → carrier ${c}`); }
  assert.equal(touchRate(60), TOUCH_LIMITS.maxRate); assert.equal(touchRate(40), 20); assert.equal(touchRate(3), 3);
  assert.equal(TOUCH_LIMITS.highHz, 150); assert.equal(TOUCH_LIMITS.lowHz, 20);
  const c = touchCurve(); assert.ok(Math.max(...c.map(Math.abs)) <= TOUCH_LIMITS.ceiling + 1e-9, 'no sample above the ceiling');
  const s = cleanScore({ steps: [{ type: 'morph', params: { touch: 1, f0: 98 }, seconds: 10, hold: 0 }] });
  assert.deepEqual(s.steps[0].params, { f0: 98 }, 'a journey never sets the touch level');
  const src = code('lib/listening/liquidHarmonics.ts');
  for (const m of src.matchAll(/\b(musicIn|musicDuck|musicBus|mDl|mLp|mFb|mEcho|mCv|mVerb)\.connect\(([^)]*)\)/g))
    assert.ok(!/^t[A-Z]|tMerge|tLevel|tPresence/.test(m[2].trim()), `music node ${m[1]} must not feed touch (${m[2]})`);
  assert.doesNotMatch(src, /destination[^;\n]*t(Merge|Level|Presence|Split)|t(Merge|Level|Presence|Split)\.connect\(destination/, 'Phase 1: touch is not routed to the output');
});

test('atmosphere: bounded deterministic air, a chord on the field’s own tone, journey-shaped, never in touch', () => {
  const a = pinkNoise(48000, 7), b = pinkNoise(48000, 7);
  assert.deepEqual(a, b, 'deterministic'); assert.ok(a.every(x => x >= -1 && x <= 1), 'bounded');
  const rms = Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length); assert.ok(rms > 0.05 && rms < 0.6, `usable level (${rms})`);
  assert.deepEqual(swellChord(98), [49, 73.5, 98, 147]);
  const s = cleanScore({ steps: [{ type: 'morph', params: { air: 0.7, swell: 2, breath: 9 }, seconds: 10, hold: 0 }] });
  assert.deepEqual(s.steps[0].params, { air: 0.7, swell: 1, breath: 0.3 }, 'journeys may shape the atmosphere, within range');
  const src = code('lib/listening/liquidHarmonics.ts');
  for (const m of src.matchAll(/\b(air\w*|swell\w*)\.connect\(([^,)]*)/g))
    assert.ok(!/^t[A-Z]|tMerge|tLevel|tPresence/.test(m[2].trim()), `atmosphere node ${m[1]} must not feed touch`);
});
