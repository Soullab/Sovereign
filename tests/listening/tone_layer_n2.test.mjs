// N2 · TONE AND PULSE LAYERS IN SOUNDSCAPES (#1979; founder 2026-11-21: "Yes, design it", "Yes, build N2"; positioning
// ruling "This would be enough for me": labels name what a sound IS, never what it does).
// The REAL engine, toneLab and toneLayerSetting, bundled with esbuild, on a recording fake audio graph.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const repo = path.join(import.meta.dirname, '../..');
const esbuild = createRequire(import.meta.url)(path.join(repo, 'node_modules/esbuild'));
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tone-layer-')), 'm.mjs');
esbuild.buildSync({ stdin: { contents: `export * from './lib/listening/toneLayerSetting.ts'; export * from './lib/listening/soundscapeEngine.ts'; export * from './lib/listening/focusSoundscape.ts'; export * from './lib/listening/toneLab.ts'; export * from './lib/listening/listeningLevel.ts';`, resolveDir: repo, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const M = await import(out);

function fakeContext() {
  const nodes = [];
  const param = (value) => ({ value, targets: [], setValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.targets.push(v); },
    exponentialRampToValueAtTime(v) { this.targets.push(v); }, linearRampToValueAtTime(v) { this.targets.push(v); }, cancelScheduledValues() {},
    setValueCurveAtTime() {} });
  const node = (kind, params) => { const n = { kind, out: [], ...params, connect(t) { this.out.push(t); return t; }, disconnect() {}, start() { this.started = true; }, stop(at) { this.stoppedAt = at ?? 0; } }; nodes.push(n); return n; };
  return { nodes, currentTime: 0, sampleRate: 48000, destination: node('destination', {}),
    createBuffer: (ch, len, sr) => ({ numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr, getChannelData: () => new Float32Array(len) }),
    createGain: () => node('gain', { gain: param(1) }),
    createOscillator: () => node('osc', { type: 'sine', frequency: param(440), detune: param(0) }),
    createBiquadFilter: () => node('filter', { type: 'lowpass', frequency: param(350), Q: param(1) }),
    createStereoPanner: () => node('pan', { pan: param(0) }),
    createConvolver: () => node('convolver', { buffer: null }),
    createBufferSource: () => node('buffer', { buffer: null, loop: false, playbackRate: param(1) }) };
}
const built = [];
test.after(() => { for (const h of built) h.dispose(); });
const reaches = (from, to, seen = new Set()) => from === to || (!seen.has(from) && (seen.add(from), from.out.some((n) => reaches(n, to, seen))));
const NATURE = { need: 'deep', stimulation: 'medium', world: 'nature', task: 'coding' };
const build = (layer, level = 0.45, amount = 0.5, input = NATURE) => {
  const ctx = fakeContext();
  const spec = { ...M.focusSoundscapeSpec(input), toneLayer: layer };
  const handle = M.buildSoundscape(ctx, ctx.destination, spec, level, async () => null, 1.2, 1, 0.5, amount); built.push(handle);
  return { ctx, handle, spec };
};
const toneOscs = (ctx, hz) => ctx.nodes.filter((n) => n.kind === 'osc' && Math.abs(n.frequency.value - hz) < 1e-9);

test('the setting: off by default, factual labels, Tone Lab limits, remembered on this device', () => {
  assert.equal(M.DEFAULT_TONE_LAYER.on, false);
  assert.equal(M.toneLayerSpec(M.DEFAULT_TONE_LAYER), null);
  assert.equal(M.toneLayerLabel({ on: true, hz: 528, pulseMode: 'none', pulseHz: 6, amount: 50 }), '528 Hz tone');
  assert.equal(M.toneLayerLabel({ on: true, hz: 432, pulseMode: 'isochronic', pulseHz: 6, amount: 50 }), '432 Hz tone · 6 Hz isochronic pulse');
  assert.equal(M.toneLayerLabel({ on: true, hz: 220, pulseMode: 'binaural', pulseHz: 10, amount: 50 }), '220 Hz tone · 10 Hz binaural pulse (headphones)');
  const n = M.normalizeToneLayer({ on: true, hz: 5000, pulseMode: 'zap', pulseHz: 99, amount: 400 });
  assert.deepEqual(n, { on: true, hz: M.TONE_MAX_HZ, pulseMode: 'none', pulseHz: M.PULSE_MAX_HZ, amount: 100 });
  const store = new Map(); const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  M.writeStoredToneLayer(storage, { on: true, hz: 528, pulseMode: 'isochronic', pulseHz: 6, amount: 30 });
  assert.deepEqual(M.readStoredToneLayer(storage), { on: true, hz: 528, pulseMode: 'isochronic', pulseHz: 6, amount: 30 });
  store.set(M.TONE_LAYER_STORAGE_KEY, '{bad'); assert.equal(M.readStoredToneLayer(storage).on, false);
});

test('positioning: no quick pick or label names an effect', () => {
  const texts = [...M.TONE_LAYER_PICKS.map((p) => p.label),
    ...M.TONE_LAYER_PICKS.map((p) => M.toneLayerLabel({ on: true, ...p.set, amount: 50 })), M.toneLayerLabel(M.DEFAULT_TONE_LAYER)];
  for (const t of texts) for (const w of M.EFFECT_WORDS) assert.ok(!t.toLowerCase().includes(w), `"${t}" names an effect ("${w}")`);
  assert.deepEqual(M.TONE_LAYER_PICKS.map((p) => p.label), ['432 Hz', '528 Hz', '6 Hz isochronic', '10 Hz binaural (headphones)']);
});

test('a tone layer joins the one master on its own bus, never through the overtones; off means no tone', () => {
  const { ctx, handle } = build({ hz: 528, pulseMode: 'none', pulseHz: 0 });
  const [tone] = toneOscs(ctx, 528);
  assert.ok(tone && tone.started);
  assert.ok(reaches(tone, handle.master));
  const softs = ctx.nodes.filter((n) => n.kind === 'filter' && n.Q.value === 0.5);
  assert.ok(softs.every((f) => !reaches(tone, f)), 'the tone never passes the overtone softening');
  assert.equal(toneOscs(ctx, 1056).length + toneOscs(ctx, 1584).length, 0, 'no overtones of the tone');
  const off = build(null);
  assert.equal(off.handle.toneLayerGain(), 0);
});

test('THE CAP: at every Level, the tone reaches the speaker at most as Tone Lab itself would', () => {
  for (const level of [0.1, 0.25, 0.4, 0.6, 0.8, 1]) {
    for (const amount of [0.5, 1]) {
      const { ctx, handle } = build({ hz: 432, pulseMode: 'none', pulseHz: 0 }, level, amount);
      const [tone] = toneOscs(ctx, 432); const bus = tone.out[0];
      assert.ok(bus.out.includes(handle.master), 'the tone bus feeds the master directly');
      const scheduled = bus.gain.targets.at(-1); // what the audio graph will actually reach after the fade-in
      assert.ok(Math.abs(scheduled - handle.toneLayerGain()) < 1e-12 || (handle.toneLayerGain() === 0 && scheduled === 0.0001));
      const atSpeaker = scheduled * level * M.GENERATED_OUTPUT_SCALE; // layer bus × the soundscape master
      const toneLab = M.TONE_VOICE_GAIN * (M.toneEffectiveLevel(level * 100) / 100) * M.TONE_OUTPUT_SCALE; // Tone Lab at this Level
      assert.ok(atSpeaker <= toneLab * amount + 1e-12, `Level ${level * 100}, amount ${amount}: ${atSpeaker} vs ${toneLab}`);
      assert.ok(Math.abs(atSpeaker - toneLab * amount) < 1e-12, 'exactly Tone Lab × amount');
    }
  }
  const { handle } = build({ hz: 432, pulseMode: 'none', pulseHz: 0 }, 0.4, 1);
  const at40 = handle.toneLayerGain() * 0.4;
  handle.setLevel(1);
  assert.ok(Math.abs(handle.toneLayerGain() * 1 - at40) < 1e-12, 'turning the Level from 40 to 100 does not make the tone louder');
});

test('live: retune in place; a new pulse mode swaps the layer smoothly; a Tone Lab sound carries no second tone', () => {
  const { ctx, handle, spec } = build({ hz: 432, pulseMode: 'isochronic', pulseHz: 6 });
  const [base] = toneOscs(ctx, 432);
  handle.update({ ...spec, toneLayer: { hz: 440, pulseMode: 'isochronic', pulseHz: 7 } });
  assert.ok(base.frequency.targets.includes(440), 'retuned in place');
  handle.update({ ...spec, toneLayer: { hz: 440, pulseMode: 'binaural', pulseHz: 10 } });
  assert.ok(base.stoppedAt !== undefined, 'the old layer fades and stops');
  assert.equal(toneOscs(ctx, 450).length, 1, 'the binaural partner tone at 440 + 10 Hz');
  handle.update({ ...spec, toneLayer: null });
  assert.equal(handle.toneLayerGain(), 0, 'off');
  const tctx = fakeContext();
  const tone = { ...M.toneSoundscapeSpec({ hz: 220 }), toneLayer: { hz: 528, pulseMode: 'none', pulseHz: 0 } };
  const t = M.buildSoundscape(tctx, tctx.destination, tone, 0.45); built.push(t);
  assert.equal(toneOscs(tctx, 528).length, 0, 'Tone Lab keeps its one tone');
});

test('positioning: every member-facing text in Sound for this session and Tone Lab\'s notes names no effect', () => {
  const src = fs.readFileSync(path.join(repo, 'app/listen/FocusSoundPicker.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\s*\/\/[^\n]*/g, '{');
  const literals = [...src.matchAll(/'([^'\n]{3,})'|`([^`]{3,})`|>([^<>{}\n]{3,})</g)].map((m) => m[1] ?? m[2] ?? m[3]);
  const texts = [...literals, M.NO_CLAIM_NOTE, M.HEADPHONES_NOTE, M.DRIVING_NOTE, M.NO_FLICKER_NOTE,
    ...M.PULSE_MODES.flatMap((m) => [m.label, m.line])];
  assert.ok(texts.length > 20, 'found the texts');
  const hits = texts.flatMap((t) => M.EFFECT_WORDS.filter((w) => new RegExp(`\\b${w}`, 'i').test(t)).map((w) => `${w} in "${t.slice(0, 60)}"`));
  assert.deepEqual(hits, []);
});

test('N2-c: a design keeps its tone layer beside it on this device; deleted designs drop theirs; bad storage is safe', () => {
  const t = (hz) => ({ on: true, hz, pulseMode: 'none', pulseHz: 6, amount: 40 });
  let tones = M.withDesignTone({}, 'design-a', t(528));
  tones = M.withDesignTone(tones, 'design-b', { on: false, hz: 432, pulseMode: 'binaural', pulseHz: 10, amount: 50 });
  assert.deepEqual(tones['design-a'], t(528));
  assert.equal(Object.keys(M.keepDesignTones(tones, ['design-b'])).join(), 'design-b', 'a deleted design drops its tone');
  for (let i = 0; i < 30; i++) tones = M.withDesignTone(tones, `d${i}`, t(100 + i));
  assert.equal(Object.keys(tones).length, M.DESIGN_TONES_MAX, 'at most 24, like the designs');
  const store = new Map(); const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  M.writeDesignTones(storage, tones); assert.deepEqual(M.readDesignTones(storage), tones);
  store.set(M.DESIGN_TONES_STORAGE_KEY, '{"x":{"on":"yes"},"y":{"on":true,"hz":99999}}');
  assert.deepEqual(Object.keys(M.readDesignTones(storage)), ['y'], 'invalid entries dropped');
  assert.equal(M.readDesignTones(storage).y.hz, M.TONE_MAX_HZ, 'clamped to Tone Lab limits');
  store.set(M.DESIGN_TONES_STORAGE_KEY, 'not json'); assert.deepEqual(M.readDesignTones(storage), {});
});

test('N2-c: recalling a design selects its tone layer and never starts sound', () => {
  const src = fs.readFileSync(path.join(repo, 'components/listening/PersistentListeningProvider.tsx'), 'utf8');
  const body = src.slice(src.indexOf('const recallDesignSound'), src.indexOf('const keepDesignSoundsFor'));
  assert.match(body, /setToneLayer\(tone\)/);
  assert.doesNotMatch(body, /play|resume\(|playSketch|playFocusSound/i);
  const setter = src.slice(src.indexOf('const setToneLayer = useCallback'), src.indexOf('const setToneLayer = useCallback') + 900);
  assert.doesNotMatch(setter, /\.resume\(|playSketch|playFocusSound|\.play\(/, 'changing the tone never starts sound');
});
