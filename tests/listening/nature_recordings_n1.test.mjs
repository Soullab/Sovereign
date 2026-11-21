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
    exponentialRampToValueAtTime(v) { this.targets.push(v); }, linearRampToValueAtTime(v) { this.targets.push(v); }, cancelScheduledValues() {},
    curves: [], setValueCurveAtTime(c, t, d) { this.curves.push({ t, d, first: c[0], last: c[c.length - 1] }); } });
  const node = (kind, params) => { const n = { kind, out: [], ...params, connect(t) { this.out.push(t); return t; }, disconnect() {}, start(when = 0, offset = 0, duration) { this.started = true; this.at = { when, offset, duration }; }, stop() {} }; nodes.push(n); return n; };
  const createBuffer = (channels, length, sampleRate) => {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate, getChannelData: (c) => data[c] };
  };
  return { nodes, currentTime: 0, sampleRate: 44100, destination: node('destination', {}), createBuffer,
    createGain: () => node('gain', { gain: param(1) }),
    createOscillator: () => node('osc', { type: 'sine', frequency: param(440), detune: param(0) }),
    createBiquadFilter: () => node('filter', { type: 'lowpass', frequency: param(350), Q: param(1) }),
    createStereoPanner: () => node('pan', { pan: param(0) }),
    createConvolver: () => node('convolver', { buffer: null }),
    createBufferSource: () => node('buffer', { buffer: null, loop: false, playbackRate: param(1) }) };
}
const built = [];
test.after(() => { for (const h of built) h.dispose(); });
const settle = () => new Promise((r) => setTimeout(r, 20));
const NATURE = { need: 'deep', stimulation: 'medium', world: 'nature', task: 'coding' };

test('segments: irregular lengths and start points, always inside the recording, never random', () => {
  const L = 6.6; // the Olympic ocean clip with the too-regular gull
  const segs = Array.from({ length: 40 }, (_, k) => M.recordedSegment(k, L));
  for (const s of segs) {
    assert.ok(s.offset >= 0 && s.offset + s.duration <= L + 1e-9, 'inside the recording');
    assert.ok(s.duration >= 2 * s.fade, 'room for both fades');
    assert.ok(Math.abs(s.fade - L / 6) < 1e-9, 'a sixth of a short clip');
  }
  const starts = []; let t = 0; for (const s of segs) { starts.push(t); t += s.duration - s.fade; }
  const gaps = starts.slice(1).map((x, i) => x - starts[i]);
  assert.ok(Math.max(...gaps) - Math.min(...gaps) > 1, 'segment lengths vary by more than a second: no fixed cycle');
  assert.ok(new Set(segs.map((s) => s.offset.toFixed(2))).size > 30, 'start points keep changing');
  assert.deepEqual(M.recordedSegment(7, L), M.recordedSegment(7, L), 'the same every time');
  assert.equal(M.recordedSegment(0, 180).fade, 3, 'a long take crossfades over 3 s');
  const long = Array.from({ length: 20 }, (_, k) => M.recordedSegment(k, 180));
  assert.ok(long.every((s) => s.duration >= 0.4 * 180 - 1e-9 && s.duration <= 0.85 * 180 + 1e-9), '40–85% of a long take');
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
  const sources = ctx.nodes.filter((n) => n.kind === 'buffer' && n.buffer?.sampleRate === 48000); // clips, not the synthesized noise
  const layerGains = new Set(sources.map((s) => s.out[0].out[0]));
  assert.equal(layerGains.size, ids.length, 'one layer per recorded slot');
  assert.ok(sources.length > ids.length, 'each layer is a chain of segments, not one loop');
  for (const s of sources) {
    assert.equal(s.loop, false);
    const env = s.out[0];
    assert.equal(env.gain.curves.length, 2, 'fades in and out');
    assert.equal(env.gain.curves[0].first, 0); assert.ok(Math.abs(env.gain.curves[0].last - 1) < 1e-6);
    assert.ok(Math.abs(env.gain.curves[1].first - 1) < 1e-6); assert.ok(Math.abs(env.gain.curves[1].last) < 1e-6);
    const layerGain = env.out[0]; const bus = layerGain.out[0];
    assert.equal(bus.gain.value, 0.4, 'starts at the member\'s amount');
    assert.ok(bus.out.includes(handle.master), 'through the one master: Level governs recordings too');
  }
  const bus = sources[0].out[0].out[0].out[0];
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
  assert.equal(new Set(ctx.nodes.filter((n) => n.kind === 'buffer' && n.buffer?.sampleRate === 48000).map((n) => n.out[0].out[0])).size, 1, 'a missing file plays nothing in its place');
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

test('consecutive segments overlap by exactly their crossfade, so the layer never drops out', async () => {
  const ctx = fakeContext();
  const handle = M.buildSoundscape(ctx, ctx.destination, M.focusSoundscapeSpec(NATURE), 0.45, async (id) => (id === 'rain' ? ctx.createBuffer(2, 48000 * 6.6, 48000) : null)); built.push(handle);
  await settle();
  const segs = ctx.nodes.filter((n) => n.kind === 'buffer' && n.buffer?.sampleRate === 48000).map((n) => n.at);
  assert.ok(segs.length >= 2);
  for (let i = 1; i < segs.length; i++) {
    const prev = segs[i - 1], fade = 6.6 / 6;
    assert.ok(Math.abs(segs[i].when - (prev.when + prev.duration - fade)) < 1e-9, `segment ${i} starts as ${i - 1} fades`);
  }
  assert.ok(segs.at(-1).when + segs.at(-1).duration >= 8, 'scheduled at least 8 s ahead');
});

test('a world without recordings asks for none', () => {
  const ctx = fakeContext();
  const handle = M.buildSoundscape(ctx, ctx.destination, M.focusSoundscapeSpec({ ...NATURE, world: 'ambient' }), 0.45, async () => null);
  built.push(handle);
  assert.deepEqual(handle.recordedLayers(), {});
});

// WEAVE MOMENTS (#1979 R5.7 Living Weave; founder 2026-11-21: "just audible enough to be heard but fades in and out
// like a dreamscape", "connected but surprising timing"; "Yes, nature first").
test('weave timing: first after 24 s, then gaps of 20–60 s that never settle into a pattern; never the same moment twice running', () => {
  assert.equal(M.weaveMoment(0, 3).gapSec, M.WEAVE_FIRST_SEC);
  const ms = []; for (let k = 0, prev = -1; k < 60; k++) { const m = M.weaveMoment(k, 3, prev); ms.push(m); prev = m.index; }
  const gaps = ms.slice(1).map((m) => m.gapSec);
  assert.ok(gaps.every((g) => g >= 20 && g <= 60));
  assert.ok(Math.max(...gaps) - Math.min(...gaps) > 25, 'wide spread of gaps');
  assert.ok(new Set(gaps.map((g) => g.toFixed(1))).size > 50, 'no repeating cycle of gaps');
  for (let k = 1; k < ms.length; k++) assert.notEqual(ms[k].index, ms[k - 1].index, `moment ${k} differs from the one before`);
  assert.ok(ms.every((m) => m.rate >= 0.88 && m.rate <= 1 && m.pan >= -0.6 && m.pan <= 0.6));
  assert.deepEqual(M.weaveMoment(9, 3), M.weaveMoment(9, 3), 'the same every time');
});

test('the Nature world weaves real recordings: long fades at the edge of hearing, through the weave bus and the one master', async () => {
  const ctx = fakeContext();
  const spec = M.focusSoundscapeSpec(NATURE);
  assert.deepEqual([...spec.weave], ['weave-thrush', 'weave-gull', 'weave-chorus']);
  assert.equal(M.focusSoundscapeSpec({ ...NATURE, world: 'ambient' }).weave, null, 'other worlds: none yet');
  const handle = M.buildSoundscape(ctx, ctx.destination, spec, 0.45,
    async (id) => (String(id).startsWith('weave-') ? ctx.createBuffer(2, 47000 * 8, 47000) : null), 1.2, 1, 0.5); built.push(handle);
  ctx.currentTime = 0; await settle();
  assert.deepEqual(handle.weaveMoments().sort(), ['weave-chorus', 'weave-gull', 'weave-thrush']);
  const moments = ctx.nodes.filter((n) => n.kind === 'buffer' && n.buffer?.sampleRate === 47000);
  assert.equal(moments.length, 0, 'nothing woven within the first 8 s scheduled live');
  ctx.currentTime = 20; await new Promise((r) => setTimeout(r, 450)); // the engine's own timer tops up 8 s ahead
  const woven = ctx.nodes.filter((n) => n.kind === 'buffer' && n.buffer?.sampleRate === 47000);
  assert.equal(woven.length, 1, 'the first moment, at 24 s');
  const [m] = woven; assert.equal(m.at.when, 24);
  assert.ok(m.playbackRate.value >= 0.88 && m.playbackRate.value <= 1, 'slightly slowed');
  const env = m.out[0]; const [inC, outC] = env.gain.curves;
  const length = 8 / m.playbackRate.value;
  assert.ok(Math.abs(inC.d - length * 0.35) < 1e-9 && Math.abs(outC.d - length * 0.35) < 1e-9, 'long fades, 35% each way');
  assert.equal(inC.first, 0); assert.ok(Math.abs(outC.last) < 1e-9, 'from and back to silence');
  const pan = env.out[0]; assert.equal(pan.kind, 'pan');
  const dry = pan.out.find((n) => n.kind === 'gain'); const distance = pan.out.find((n) => n.kind === 'convolver');
  assert.ok(dry && distance, 'dry and into the soft distance');
  const weaveBus = dry.out[0];
  assert.ok(distance.out.includes(weaveBus) && weaveBus.out.includes(handle.master), 'both through the weave bus into the one master');
});

test('weave amount: default 50%, 0 weaves nothing, remembered on this device', () => {
  assert.equal(M.DEFAULT_WEAVE_AMOUNT, 50); assert.equal(M.weaveGain(50), 0.5); assert.equal(M.weaveGain(0), 0);
  const store = new Map(); const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.equal(M.readStoredWeaveAmount(storage), 50); M.writeStoredWeaveAmount(storage, 15); assert.equal(M.readStoredWeaveAmount(storage), 15);
  const ctx = fakeContext();
  const handle = M.buildSoundscape(ctx, ctx.destination, M.focusSoundscapeSpec(NATURE), 0.45, async () => null, 1.2, 1, 0.5); built.push(handle);
  const bus = ctx.nodes.find((n) => n.kind === 'gain' && n.gain.value === 0.5 && n.out.includes(handle.master));
  assert.ok(bus, 'the weave bus feeds the master');
  handle.setWeaveAmount(0); assert.deepEqual(bus.gain.targets, [0]);
});
