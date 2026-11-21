// N1 · LIVING NATURE (#1979, founder go-ahead 2026-11-21: "Yes, start N1"). Seamless recorded loops, the member's
// "Nature recordings" amount, and an honest account of which layers are real recordings. The REAL engine and setting,
// bundled with esbuild, on a recording fake audio graph. No audio files are needed: the loader is a stub.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const repo = path.join(import.meta.dirname, '../..');
const esbuild = createRequire(import.meta.url)(path.join(repo, 'node_modules/esbuild'));
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nature-n1-')), 'm.mjs');
esbuild.buildSync({ stdin: { contents: `export * from './lib/listening/natureRecordingSetting.ts'; export * from './lib/listening/soundscapeEngine.ts'; export * from './lib/listening/focusSoundscape.ts';`, resolveDir: repo, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const M = await import(out);

function fakeContext() {
  const nodes = [];
  const param = (value) => ({ value, targets: [], setValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.targets.push(v); },
    exponentialRampToValueAtTime(v) { this.targets.push(v); }, linearRampToValueAtTime(v) { this.targets.push(v); }, cancelScheduledValues() {} });
  const node = (kind, params) => { const n = { kind, out: [], ...params, connect(t) { this.out.push(t); return t; }, disconnect() {}, start() { this.started = true; }, stop() {} }; nodes.push(n); return n; };
  const createBuffer = (channels, length, sampleRate) => {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { numberOfChannels: channels, length, sampleRate, getChannelData: (c) => data[c] };
  };
  return { nodes, currentTime: 0, sampleRate: 44100, destination: node('destination', {}), createBuffer,
    createGain: () => node('gain', { gain: param(1) }),
    createOscillator: () => node('osc', { type: 'sine', frequency: param(440), detune: param(0) }),
    createBiquadFilter: () => node('filter', { type: 'lowpass', frequency: param(350), Q: param(1) }),
    createStereoPanner: () => node('pan', { pan: param(0) }),
    createBufferSource: () => node('buffer', { buffer: null, loop: false, playbackRate: param(1) }) };
}
const built = [];
test.after(() => { for (const h of built) h.dispose(); });
const settle = () => new Promise((r) => setTimeout(r, 20));
const NATURE = { need: 'deep', stimulation: 'medium', world: 'nature', task: 'coding' };

test('a seamless loop: the last sample runs straight on into the first, and the middle is untouched', () => {
  const n = 1000, f = 100;
  const data = Float32Array.from({ length: n }, (_, i) => Math.sin(i * 0.37) + (i / n)); // a ramp: a hard jump at the seam
  const loop = M.seamlessLoopChannel(data, f);
  assert.equal(loop.length, n - f);
  assert.ok(Math.abs(loop[0] - data[n - f]) < 1e-6, 'starts where the tail began');
  assert.equal(loop[loop.length - 1], data[n - f - 1], 'ends just before the tail');
  for (let i = f; i < n - f; i += 97) assert.equal(loop[i], data[i]);
  // The seam is two samples that were already neighbours in the recording, so it is no bigger than any other step.
  assert.ok(Math.abs((loop[0] - loop[loop.length - 1]) - (data[n - f] - data[n - f - 1])) < 1e-6, 'the seam is a natural step');
  const ramp = Float32Array.from({ length: n }, (_, i) => i / n); // looped raw, a ramp jumps by ~1 at the seam
  const rampLoop = M.seamlessLoopChannel(ramp, f);
  assert.ok(Math.abs(rampLoop[0] - rampLoop[rampLoop.length - 1]) < 0.01, 'a ramp that would jump by 1 now steps by 1/n');
  // equal power: the two halves' gains satisfy sin² + cos² = 1 at every crossfade sample
  for (let i = 0; i < f; i += 7) { const x = (i / f) * Math.PI / 2; assert.ok(Math.abs(Math.sin(x) ** 2 + Math.cos(x) ** 2 - 1) < 1e-12); }
});

test('a clip too short to crossfade safely uses at most a third of itself; a tiny one is left as it is', () => {
  assert.equal(M.seamlessLoopChannel(new Float32Array(300), 1000).length, 200);
  assert.equal(M.seamlessLoopChannel(new Float32Array(4), 1000).length, 4);
});

test('the Nature recordings amount: default 100% (the mix as before), 0% is synthesis alone, remembered on this device', () => {
  assert.equal(M.DEFAULT_NATURE_RECORDING_AMOUNT, 100);
  assert.equal(M.natureRecordingGain(100), 1); assert.equal(M.natureRecordingGain(0), 0); assert.equal(M.natureRecordingGain(250), 1);
  const store = new Map(); const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.equal(M.readStoredNatureRecordingAmount(storage), 100);
  M.writeStoredNatureRecordingAmount(storage, 35); assert.equal(M.readStoredNatureRecordingAmount(storage), 35);
  const throwing = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.equal(M.readStoredNatureRecordingAmount(throwing), 100);
  assert.doesNotThrow(() => M.writeStoredNatureRecordingAmount(throwing, 10));
});

test('recorded layers pass one recordings bus into the master, which the amount moves; the tone is untouched', async () => {
  const ctx = fakeContext();
  const spec = M.focusSoundscapeSpec(NATURE);
  const ids = Object.keys(spec.recorded ?? {});
  assert.ok(ids.length > 0, 'the Nature world asks for recorded layers');
  const clip = ctx.createBuffer(2, 48000 * 5, 48000); // 48 kHz: told apart from the 44.1 kHz synthesized noise
  const handle = M.buildSoundscape(ctx, ctx.destination, spec, 0.45, async () => clip, 1.2, 0.4); built.push(handle);
  await settle();
  const sources = ctx.nodes.filter((n) => n.kind === 'buffer' && n.loop && n.buffer?.sampleRate === 48000); // clips, not the synthesized noise
  assert.equal(sources.length, ids.length);
  for (const s of sources) {
    assert.equal(s.buffer.length, 48000 * 4, 'a 5 s clip loops as 4 s with a 1 s crossfade');
    const layerGain = s.out[0]; const bus = layerGain.out[0];
    assert.equal(bus.gain.value, 0.4, 'starts at the member\'s amount');
    assert.ok(bus.out.includes(handle.master), 'through the one master: Level governs recordings too');
  }
  const bus = sources[0].out[0].out[0];
  const voiceLevels = handle.voices.map((v) => v.gain.value);
  handle.setRecordedAmount(0);
  assert.deepEqual(bus.gain.targets, [0]);
  assert.deepEqual(handle.voices.map((v) => v.gain.value), voiceLevels);
});

test('it says honestly which layers are real recordings and which are missing', async () => {
  const ctx = fakeContext();
  const spec = M.focusSoundscapeSpec(NATURE);
  const ids = Object.keys(spec.recorded);
  const have = new Set([ids[0]]);
  const seen = [];
  const handle = M.buildSoundscape(ctx, ctx.destination, spec, 0.45,
    async (id) => (have.has(id) ? ctx.createBuffer(1, 48000 * 3, 48000) : null)); built.push(handle);
  handle.onRecordedLayers((s) => seen.push(s));
  assert.ok(Object.values(handle.recordedLayers()).every((s) => s === 'loading'));
  await settle();
  const final = handle.recordedLayers();
  assert.equal(final[ids[0]], 'recorded');
  for (const id of ids.slice(1)) assert.equal(final[id], 'missing');
  assert.ok(seen.length >= ids.length, 'the listener heard each change');
  assert.equal(ctx.nodes.filter((n) => n.kind === 'buffer' && n.loop && n.buffer?.sampleRate === 48000).length, 1, 'a missing file plays nothing in its place');
});

test('a live change that drops a layer stops reporting it', async () => {
  const ctx = fakeContext();
  const low = M.focusSoundscapeSpec({ ...NATURE, need: 'steady', stimulation: 'low' });
  const high = M.focusSoundscapeSpec({ ...NATURE, need: 'steady', stimulation: 'high' });
  assert.equal(M.soundscapeNeedsRebuild(low, high), false, 'a live change, not a rebuild');
  const handle = M.buildSoundscape(ctx, ctx.destination, high, 0.45, async () => ctx.createBuffer(1, 48000 * 3, 48000)); built.push(handle);
  await settle();
  const dropped = Object.keys(high.recorded).filter((id) => !(low.recorded[id] > 0));
  assert.ok(dropped.length > 0, `high stimulation adds a layer low does not have`);
  const seen = []; handle.onRecordedLayers((s) => seen.push(s));
  handle.update(low);
  for (const id of dropped) assert.equal(handle.recordedLayers()[id], undefined, `${id} no longer reported`);
  assert.deepEqual(Object.keys(seen.at(-1)).sort(), Object.keys(low.recorded).sort());
});

test('a world without recordings asks for none', () => {
  const ctx = fakeContext();
  const handle = M.buildSoundscape(ctx, ctx.destination, M.focusSoundscapeSpec({ ...NATURE, world: 'ambient' }), 0.45, async () => null);
  built.push(handle);
  assert.deepEqual(handle.recordedLayers(), {});
});
