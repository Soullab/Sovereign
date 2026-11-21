// OVERTONES SETTING (#1979, founder 2026-11-21: "we need to have the option to have the overtones on or off and even
// what level of overtone. Right now, it is too obvious, even with it on low level").
// The real lib/listening/overtoneSetting.ts and soundscapeEngine.ts, bundled with esbuild, on a recording fake graph.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const repo = path.join(import.meta.dirname, '../..');
const esbuild = createRequire(import.meta.url)(path.join(repo, 'node_modules/esbuild'));
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'overtone-setting-')), 'm.mjs');
esbuild.buildSync({ stdin: { contents: `export * from './lib/listening/overtoneSetting.ts'; export * from './lib/listening/soundscapeEngine.ts'; export * from './lib/listening/focusSoundscape.ts'; export * from './lib/listening/toneLab.ts';`, resolveDir: repo, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const M = await import(out);

function fakeContext() {
  const nodes = [];
  const param = (value) => ({ value, targets: [], setValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.targets.push(v); },
    exponentialRampToValueAtTime(v) { this.targets.push(v); }, linearRampToValueAtTime(v) { this.targets.push(v); }, cancelScheduledValues() {} });
  const node = (kind, params) => { const n = { kind, out: [], ...params, connect(t) { this.out.push(t); return t; }, disconnect() {}, start() {}, stop() {} }; nodes.push(n); return n; };
  return { nodes, currentTime: 0, sampleRate: 48000, destination: node('destination', {}),
    createGain: () => node('gain', { gain: param(1) }),
    createOscillator: () => node('osc', { type: 'sine', frequency: param(440), detune: param(0) }),
    createBiquadFilter: () => node('filter', { type: 'lowpass', frequency: param(350), Q: param(1) }),
    createStereoPanner: () => node('pan', { pan: param(0) }),
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
    createBufferSource: () => node('buffer', { buffer: null, loop: false, playbackRate: param(1) }) };
}
const built = [];
test.after(() => { for (const h of built) h.dispose(); });
// The overtone bus: the gain node fed by the overtone swell and feeding the master.
const busOf = (ctx, handle) => ctx.nodes.find((n) => n.kind === 'gain' && n.out.includes(handle.master) &&
  ctx.nodes.some((s) => s.kind === 'gain' && s.out.includes(n) && handle.movementDepth.out.includes(s.gain)));

test('default is on at 50%, which is option D: the bus the founder chose (3.0, half of 6.0)', () => {
  assert.deepEqual({ ...M.DEFAULT_OVERTONE_SETTING }, { on: true, amount: 50 });
  assert.equal(M.overtoneBusGain(M.DEFAULT_OVERTONE_SETTING), M.SOUNDSCAPE_OVERTONE_BUS_GAIN);
  assert.equal(M.overtoneBusGain({ on: true, amount: 100 }), 6.0);
});

test('off silences the overtones whatever the amount; the amount scales linearly and is clamped', () => {
  assert.equal(M.overtoneBusGain({ on: false, amount: 100 }), 0);
  assert.equal(M.overtoneBusGain({ on: true, amount: 0 }), 0);
  assert.equal(M.overtoneBusGain({ on: true, amount: 10 }), 0.6);
  assert.equal(M.overtoneBusGain({ on: true, amount: 250 }), 6.0);
  assert.equal(M.overtoneBusGain({ on: true, amount: -5 }), 0);
});

test('it is remembered on this device, and a bad or missing value falls back to the default', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.deepEqual(M.readStoredOvertoneSetting(storage), { on: true, amount: 50 });
  M.writeStoredOvertoneSetting(storage, { on: false, amount: 20 });
  assert.deepEqual(M.readStoredOvertoneSetting(storage), { on: false, amount: 20 });
  store.set(M.OVERTONE_SETTING_STORAGE_KEY, '{not json');
  assert.deepEqual(M.readStoredOvertoneSetting(storage), { on: true, amount: 50 });
  store.set(M.OVERTONE_SETTING_STORAGE_KEY, JSON.stringify({ on: 'yes', amount: 20 }));
  assert.deepEqual(M.readStoredOvertoneSetting(storage), { on: true, amount: 50 });
  const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(M.readStoredOvertoneSetting(throwing), { on: true, amount: 50 });
  assert.doesNotThrow(() => M.writeStoredOvertoneSetting(throwing, { on: true, amount: 5 }));
});

test('Your soundscape starts at the member\'s amount, and a change moves only the overtone bus', () => {
  const ctx = fakeContext();
  const spec = M.focusSoundscapeSpec(M.DEFAULT_SOUNDSCAPE_INPUT);
  const handle = M.buildSoundscape(ctx, ctx.destination, spec, 0.45, undefined, M.overtoneBusGain({ on: true, amount: 20 })); built.push(handle);
  const bus = busOf(ctx, handle);
  assert.ok(bus, 'overtone bus found');
  assert.ok(Math.abs(bus.gain.value - 1.2) < 1e-9);
  const voiceLevels = handle.voices.map((v) => v.gain.value);
  handle.setOvertoneBusGain(M.overtoneBusGain({ on: false, amount: 20 }));
  assert.deepEqual(bus.gain.targets, [0], 'off → the bus goes to 0');
  assert.deepEqual(handle.voices.map((v) => v.gain.value), voiceLevels, 'the tone itself is untouched');
  assert.equal(handle.master.gain.targets.length, 1, 'the Level (master) is untouched: only its fade-in');
});

test('built without a setting, the engine keeps the ruled 3.0; a Tone Lab sound ignores the setting', () => {
  const ctx = fakeContext();
  const h = M.buildSoundscape(ctx, ctx.destination, M.focusSoundscapeSpec(M.DEFAULT_SOUNDSCAPE_INPUT), 0.45); built.push(h);
  assert.equal(busOf(ctx, h).gain.value, 3.0);
  const tctx = fakeContext();
  const t = M.buildSoundscape(tctx, tctx.destination, M.toneSoundscapeSpec({ hz: 220 }), 0.45, undefined, 6.0); built.push(t);
  assert.equal(busOf(tctx, t), undefined);
  assert.doesNotThrow(() => t.setOvertoneBusGain(0));
});
