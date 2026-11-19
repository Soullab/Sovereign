// TONE-LAB-01 · Tone Lab is an instrument for listening, never a remedy. Source/pure-level contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./ts_resolution_loader.mjs', import.meta.url); // extensionless local TS imports, for tests only
const root = path.join(import.meta.dirname, '../..');
const toneUrl = pathToFileURL(path.join(root, 'lib/listening/toneLab.ts')).href;
const lab = await import(toneUrl);
const { toneSoundscapeSpec, TONE_PRESETS } = lab;

const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const code = rel => strip(read(rel));

// Each check takes a module, so the same assertions can be pointed at a deliberately broken copy (mutation test below).
const checks = {
  presets(m) {
    const ids = new Set();
    for (const p of m.TONE_PRESETS) {
      assert.ok(!ids.has(p.id), `duplicate id ${p.id}`); ids.add(p.id);
      assert.ok(typeof p.provenance === 'string' && p.provenance.trim().length >= 40, `${p.id} needs a provenance label`);
      assert.match(p.provenance, /no evidence|not supported|not proven|no outcome is claimed|no support|unsettled|convention|nothing more|none is conclusive/i, `${p.id} must say what is not known`);
      assert.ok(!/\b(will|makes you|helps you|improves|reduces|increases|induces|promotes)\b/i.test(p.provenance), `${p.id} reads like an outcome claim`);
    }
  },
  cap(m) {
    assert.equal(m.toneEffectiveLevel(100), m.TONE_LEVEL_CAP);
    assert.equal(m.toneEffectiveLevel(0), 0);
    assert.ok(m.TONE_LEVEL_CAP <= 40, 'the cap stays quiet');
  },
};

test('preset table: full Solfeggio set, 432, Schumann and the four rhythm rates, each with a provenance label and no claim', () => {
  const hz = TONE_PRESETS.filter(p => p.group === 'Solfeggio tradition').map(p => p.dial.hz);
  assert.deepEqual(hz, [174, 285, 396, 417, 528, 639, 741, 852, 963]);
  const by = id => TONE_PRESETS.find(p => p.id === id);
  assert.equal(by('reference-432').dial.hz, 432);
  assert.equal(by('schumann-7-83').dial.pulseHz, 7.83);
  assert.deepEqual(['theta-6', 'alpha-10', 'beta-16', 'gamma-40'].map(k => by(`rhythm-${k}`).dial.pulseHz), [6, 10, 16, 40]);
  assert.match(by('solfeggio-528').provenance, /^528 Hz: from the Solfeggio tradition \(Joseph Puleo, 1970s/);
  assert.match(by('solfeggio-528').provenance, /no evidence of a physical effect/);
  assert.match(by('rhythm-alpha-10').provenance, /not proven to change your state/);
  assert.match(by('rhythm-gamma-40').provenance, /no outcome is claimed here/);
  checks.presets(lab);
});

test('pitch and pulse are clamped: 40–1000 Hz and 0.5–40 Hz, whatever is typed', () => {
  assert.equal(lab.clampToneHz(5), 40); assert.equal(lab.clampToneHz(99999), 1000);
  assert.equal(lab.clampToneHz('528'), 528); assert.equal(lab.clampToneHz('abc'), lab.DEFAULT_TONE_DIAL.hz);
  assert.equal(lab.clampToneHz(NaN), lab.DEFAULT_TONE_DIAL.hz); assert.equal(lab.clampToneHz(Infinity), lab.DEFAULT_TONE_DIAL.hz);
  assert.equal(lab.clampPulseHz(0), 0.5); assert.equal(lab.clampPulseHz(400), 40); assert.equal(lab.clampPulseHz(7.834), 7.83);
  const spec = toneSoundscapeSpec({ hz: 1e9, pulseMode: 'binaural', pulseHz: 1e9, bed: 'none' });
  assert.equal(spec.tone.hz, 1000); assert.equal(spec.tone.pulseHz, 40);
  assert.equal(lab.normalizeToneDial({ pulseMode: 'nonsense', bed: 'nonsense' }).pulseMode, 'none');
  for (const p of TONE_PRESETS) {
    assert.ok(p.dial.hz >= 40 && p.dial.hz <= 1000 && p.dial.pulseHz >= 0.5 && p.dial.pulseHz <= 40, p.id);
  }
});

test('binaural shows the headphones note; other modes do not', () => {
  const noteFor = mode => lab.toneNotes({ ...lab.DEFAULT_TONE_DIAL, pulseMode: mode });
  assert.ok(noteFor('binaural').includes(lab.HEADPHONES_NOTE));
  for (const mode of ['none', 'monaural', 'isochronic']) assert.ok(!noteFor(mode).includes(lab.HEADPHONES_NOTE));
  for (const mode of ['none', 'binaural', 'monaural', 'isochronic']) {
    assert.ok(noteFor(mode).includes(lab.DRIVING_NOTE)); assert.match(lab.DRIVING_NOTE, /driving/);
    assert.ok(noteFor(mode).includes(lab.NO_FLICKER_NOTE));
  }
  assert.match(lab.HEADPHONES_NOTE, /headphones/i);
  assert.match(code('app/listen/ToneLabDesk.tsx'), /toneNotes\(dial\)/, 'the desk renders the notes');
});

test('level cap: Tone Lab never plays above the cap, in the engine and when the shared level changes', () => {
  checks.cap(lab);
  assert.equal(lab.toneEffectiveLevel(35), 35);
  assert.match(code('lib/listening/soundscapeEngine.ts'), /toneEffectiveLevel\(value \* 100\)/);
  // The cap AND Tone Lab's original absolute scale (founder ruling 2026-11-19: the general raise does not reach Tone Lab).
  assert.match(code('components/listening/PersistentListeningProvider.tsx'), /spec\.tone\s*\? generatedGainForLevel\(toneEffectiveLevel\(next\), \{ tone: true \}\)/);
  assert.match(code('lib/listening/soundscapeEngine.ts'), /spec\.tone \? TONE_OUTPUT_SCALE : SCALE/);
  assert.ok(lab.TONE_FADE_IN_SEC >= 4, 'gentle fade in'); assert.ok(lab.TONE_FADE_OUT_SEC > 0, 'gentle fade out');
  assert.equal(toneSoundscapeSpec({}).fadeInSec, lab.TONE_FADE_IN_SEC);
  assert.match(code('components/listening/PersistentListeningProvider.tsx'), /TONE_FADE_OUT_SEC/);
});

test('one player, one level control, no flicker, no second audio path', () => {
  const desk = code('app/listen/ToneLabDesk.tsx');
  assert.match(desk, /usePersistentListening/); assert.match(desk, /transport\.playSketch\(/);
  assert.doesNotMatch(desk, /new Audio\(|AudioContext|createOscillator|<audio|setVolume|type="range"[^>]*volume/i, 'Tone Lab adds no player or level control');
  assert.doesNotMatch(desk, /requestAnimationFrame|@keyframes|animation|blink|strobe/i);
  const css = read('app/listen/listen.module.css').split('\n').filter(l => /\.tone/.test(l)).join('\n');
  assert.doesNotMatch(css, /animation|@keyframes|transition/i, 'nothing on screen pulses');
  // Nothing starts without the member: the only caller of playSketch is the Play handler.
  assert.equal((desk.match(/playSketch\(/g) ?? []).length, 2, 'Play and the live dial update while already playing');
  assert.match(desk, /first\.current/); assert.match(desk, /if \(liveRef\.current\)/);
});

test('one-source / Stop / MAIA rules still hold: Tone Lab rides the unchanged playSketch path', () => {
  const p = code('components/listening/PersistentListeningProvider.tsx');
  assert.match(p, /refuseDuringMaiaSpeech\(\)\) return false/); // refuses before allocating a context
  assert.match(p, /acquireAudioOutput\('listening-music'\)/); // the one output lease
  assert.match(p, /if \(active\.soundscape\.spec\.tone\) return; \/\/|spec\.tone\) return;/); // Focus live-follow never rewrites a tone
  const stop = p.slice(p.indexOf('const stopAll = useCallback'), p.indexOf('const stopAll = useCallback') + 900);
  assert.match(stop, /endSketch\(sketch\.current\)/); // Stop ends the sketch (with the short fade) and nulls it
  assert.match(stop, /sketch\.current = null/);
  // Resume from the bar keeps the tone's own dial, never swaps in a Focus sound.
  assert.match(p, /spec\.tone \? sketch\.current\.soundscape\.spec : focusSoundscapeSpec/);
  // The engine adds no autoplay: no context is created and nothing starts at import or render.
  assert.doesNotMatch(code('lib/listening/toneLab.ts'), /AudioContext|setInterval|setTimeout|\.start\(|\.play\(/);
});

test('mutation: removing the level cap, or a provenance label, makes the checks fail', async () => {
  const src = read('lib/listening/toneLab.ts');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tone-mutant-'));
  const build = async (name, transform) => {
    const text = transform(src).replace("from './focusSoundscape'", `from '${pathToFileURL(path.join(root, 'lib/listening/focusSoundscape.ts')).href}'`);
    const file = path.join(dir, `${name}.ts`); fs.writeFileSync(file, text);
    return import(pathToFileURL(file).href);
  };
  try {
    const intact = await build('intact', s => s);
    checks.cap(intact); checks.presets(intact); // the harness itself passes on an unmutated copy
    const noCap = await build('nocap', s => s.replace('TONE_LEVEL_CAP = 40', 'TONE_LEVEL_CAP = 100'));
    assert.throws(() => checks.cap(noCap), 'a missing cap must be caught');
    const noLabel = await build('nolabel', s => s.replace("provenance: `${hz} Hz: ${SOLFEGGIO_NOTE}${extra}`", "provenance: ''"));
    assert.throws(() => checks.presets(noLabel), 'a missing label must be caught');
    const claim = await build('claim', s => s.replace('there is no evidence of a physical effect', 'it will improve your focus'));
    assert.throws(() => checks.presets(claim), 'an outcome claim must be caught');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('banned-word scan: no healing / unlock / activate / entrain / frequency-medicine language in Tone Lab copy, code strings or docs', () => {
  const files = [
    'lib/listening/toneLab.ts', 'app/listen/ToneLabDesk.tsx',
    'docs/design/contracts/sound-studio-tone-lab.md',
  ];
  const banned = lab.BANNED_TONE_WORDS.map(w => ({ w, re: new RegExp(`\\b${w.replace(/ /g, '\\s+')}`, 'i') }));
  assert.ok(['healing', 'unlock', 'activate', 'entrain', 'frequency medicine'].every(w => lab.BANNED_TONE_WORDS.includes(w)));
  for (const rel of files) {
    let text = read(rel);
    // toneLab.ts lists the words once, as the list itself; nothing else in the file may use them.
    if (rel === 'lib/listening/toneLab.ts') text = text.replace(/export const BANNED_TONE_WORDS[\s\S]*?\];/, '');
    for (const { w, re } of banned) {
      const hit = text.match(re);
      assert.ok(!hit, `"${w}" found in ${rel}: …${hit ? text.slice(Math.max(0, hit.index - 30), hit.index + 40).replace(/\n/g, ' ') : ''}…`);
    }
  }
  // The scan reaches what the member actually sees: every preset label and provenance, and every note.
  for (const text of [...TONE_PRESETS.flatMap(p => [p.label, p.provenance]), ...lab.toneNotes({ ...lab.DEFAULT_TONE_DIAL, pulseMode: 'binaural' }),
    lab.NO_CLAIM_NOTE, ...lab.PULSE_MODES.map(m => m.line), ...lab.TONE_BEDS.map(b => b.label)]) {
    for (const { w, re } of banned) assert.ok(!re.test(text), `"${w}" in member-facing copy: ${text}`);
  }
});
