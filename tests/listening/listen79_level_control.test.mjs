// LISTEN-79 · one level control, in the bar, honoured by every source the one shared player plays.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_LISTENING_LEVEL, GENERATED_OUTPUT_SCALE, LISTENING_LEVEL_STORAGE_KEY, ORIGINAL_OUTPUT_SCALE, TONE_OUTPUT_SCALE,
  generatedGainForLevel, normalizeListeningLevel, readStoredListeningLevel, writeStoredListeningLevel,
} from '../../lib/listening/listeningLevel.ts';

const read = rel => fs.readFileSync(path.join(import.meta.dirname, '../..', rel), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const provider = read('components/listening/PersistentListeningProvider.tsx');
const dock = read('components/listening/PersistentListeningDock.tsx');
const engine = read('lib/listening/soundscapeEngine.ts');
const css = read('components/listening/persistentListeningDock.module.css');
const fnBody = (src, name) => {
  const start = src.indexOf(`const ${name} = useCallback(`);
  assert.ok(start >= 0, `${name} missing`);
  const next = src.indexOf('useCallback(', start + 30);
  return src.slice(start, next < 0 ? undefined : next);
};

const memoryStorage = (init = {}) => {
  const data = { ...init };
  return { data, getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
};

test('pure · the level is clamped to 0–100 and junk is refused', () => {
  assert.equal(normalizeListeningLevel(130), 100);
  assert.equal(normalizeListeningLevel(-4), 0);
  assert.equal(normalizeListeningLevel('37'), 37);
  assert.equal(normalizeListeningLevel('loud'), null);
  assert.equal(normalizeListeningLevel(NaN), null);
  assert.equal(normalizeListeningLevel(''), null);
});

test('pure · remembered per device; missing, junk or throwing storage falls back to the default', () => {
  const s = memoryStorage();
  assert.equal(readStoredListeningLevel(s), DEFAULT_LISTENING_LEVEL);
  writeStoredListeningLevel(s, 18);
  assert.equal(s.data[LISTENING_LEVEL_STORAGE_KEY], '18');
  assert.equal(readStoredListeningLevel(s), 18);
  assert.equal(readStoredListeningLevel(memoryStorage({ [LISTENING_LEVEL_STORAGE_KEY]: 'x' })), DEFAULT_LISTENING_LEVEL);
  const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(readStoredListeningLevel(throwing), DEFAULT_LISTENING_LEVEL);
  assert.doesNotThrow(() => writeStoredListeningLevel(throwing, 20));
  assert.equal(readStoredListeningLevel(null), DEFAULT_LISTENING_LEVEL);
});

test('pure · generated gain follows the level and never reaches 0 (Web Audio ramps)', () => {
  assert.equal(generatedGainForLevel(100), GENERATED_OUTPUT_SCALE);
  assert.ok(Math.abs(generatedGainForLevel(50) - GENERATED_OUTPUT_SCALE / 2) < 1e-12);
  assert.equal(generatedGainForLevel(0), 0.0001);
});

test('ceiling · raised about 19 dB by founder ruling 2026-11-19; Tone Lab keeps its original absolute scale', () => {
  const dB = 20 * Math.log10(GENERATED_OUTPUT_SCALE / ORIGINAL_OUTPUT_SCALE);
  assert.ok(dB > 18.5 && dB < 19.5, `raise is ${dB.toFixed(2)} dB`);
  assert.equal(ORIGINAL_OUTPUT_SCALE, 0.027);
  assert.equal(TONE_OUTPUT_SCALE, ORIGINAL_OUTPUT_SCALE);
  assert.equal(generatedGainForLevel(40, { tone: true }), 0.4 * 0.027); // Tone Lab's top: its cap of 40, at 0.027
  // One owner: no hard-coded ceiling left in the player or the engine.
  for (const [name, src] of [['provider', provider], ['engine', engine]])
    assert.ok(!/0\.027/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')), `${name} hard-codes 0.027`);
});

test('generated sound · soundscapes start at, and are scaled by, the same output scale the control uses', () => {
  assert.match(engine, /import \{ GENERATED_OUTPUT_SCALE, ORIGINAL_OUTPUT_SCALE, TONE_OUTPUT_SCALE \} from '\.\/listeningLevel'/);
  assert.match(engine, /const SCALE = GENERATED_OUTPUT_SCALE;/);
  // playLevel is the identity except for a Tone Lab sound, which is capped; Tone Lab also keeps its original scale.
  assert.match(engine, /master\.gain\.exponentialRampToValueAtTime\(Math\.max\(0\.0001, playLevel\(level\) \* \(spec\.tone \? TONE_OUTPUT_SCALE : SCALE\)\)/);
  assert.match(engine, /\?\? 0\) \/ ORIGINAL_OUTPUT_SCALE;/); // recorded layers keep their balance with the raised master
  // Every audible part of a soundscape (tones, noise, recorded nature, ticks) ends in the master the control sets.
  assert.match(engine, /filter\.connect\(master\)/);
  assert.match(engine, /noiseGain\.connect\(master\)/);
  assert.match(engine, /gain\.connect\(master\)/);
  assert.match(engine, /out\.connect\(master\)/);
  assert.deepEqual(engine.match(/\w+\.connect\(destination\)/g), ['master.connect(destination)'], 'only the master reaches the destination');
});

test('every source · setVolume reaches the generated master gain and the one media element', () => {
  const body = fnBody(provider, 'setVolume');
  // Identity except Tone Lab: capped, and at its original scale (founder ruling 2026-11-19).
  assert.match(body, /master\.gain\.setTargetAtTime\(\s*sketch\.current\.soundscape\?\.spec\.tone\s*\? generatedGainForLevel\(toneEffectiveLevel\(next\), \{ tone: true \}\)[\s\S]*?: generatedGainForLevel\(next\)/);
  assert.match(body, /media\.current\.volume = next \/ 100/);
});

test('every source · each start path begins at the member\'s level, not a default', () => {
  // Focus presets (Deep focus, Creative flow) and the Focus Field / "Your soundscape" generated sounds.
  assert.match(provider, /newSketch\(mood, frequencies, volumeRef\.current \/ 100/);
  assert.match(provider, /newSoundscapeSketch\(soundscape, volumeRef\.current \/ 100\)/);
  assert.match(provider, /function newSketch[\s\S]*?master\.gain\.exponentialRampToValueAtTime\(\s*generatedGainForLevel\(level \* 100\)/); // the one owner of the ceiling
  // Recorded works (Open Ground, Night Ground editions, Music Only) — also reached by the Open Ground focus preset.
  assert.match(fnBody(provider, 'playExperienceMedia'), /audio\.volume = volumeRef\.current \/ 100;\s*await audio\.play\(\)/);
  // A file chosen from the device.
  assert.match(fnBody(provider, 'playLocalFile'), /media\.current\.volume = volumeRef\.current \/ 100;\s*await media\.current\.play\(\)/);
});

test('remembered · read once after mount without starting sound; member changes are saved, fades are not', () => {
  assert.match(provider, /stored = readStoredListeningLevel\(window\.localStorage\)/);
  const mount = provider.slice(provider.indexOf('stored = readStoredListeningLevel'), provider.indexOf('stored = readStoredListeningLevel') + 400);
  assert.doesNotMatch(mount, /play\(|resume\(|playSketch|playExperienceMedia/);
  const body = fnBody(provider, 'setVolume');
  assert.match(body, /\(value: number, transient = false\)/);
  assert.match(body, /if \(!transient\) \{\s*try \{ writeStoredListeningLevel\(window\.localStorage, next\); \} catch/);
  assert.match(dock, /onVolume\(Math\.round\(restoreVolume \* remaining\), true\)/);
  assert.match(dock, /onVolume\(restoreVolume, true\)/);
});

test('bar · the level slider is in the bar itself (not behind More), and honest where the device fixes it', () => {
  // Founder ruling 2026-11-19 (#1979, "Yes, in the bar" / "at least have volume"): Level is in the bar whenever
  // the bar shows, including a silent focus timer, where it sets the level the next sound starts at.
  assert.match(dock, /\{\(audioDisplayed \|\| focusDisplayed\) && !mixOpen && \(volumeAdjustable \|\| !audioDisplayed \|\| snapshot\.kind === 'sketch' \? \(\s*<label className=\{styles\.volume\} data-listen-bar-level="adjustable">/);
  assert.match(dock, /data-listen-bar-level="device">Level: phone volume buttons</);
  // a generated sound is always adjustable, so the bar shows the slider for it even on iOS
  assert.match(provider, /volumeAdjustable=\{volumeAdjustable \|\| snapshot\.kind === 'sketch'\}/);
  assert.doesNotMatch(css, /\.volume[^{]*\{display:none/, 'the bar level must not be hidden');
});

test('bar · on a phone the level takes its own slim row, not a seat beside Pause / Stop', () => {
  assert.match(css, /@media\(max-width:600px\)\{\.dock \.volume,\.dock \.volumeFixed\{grid-column:1\/-1\}/);
  assert.match(css, /\.controls\{grid-column:2;grid-row:1/);
});
