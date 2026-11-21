// FOCUS SOUNDSCAPE · warm overtones (#1979, founder listening A/B 2026-11-21: option D, "D is really helpful. I like
// the tone by itself but the warm overtone makes it received better", at the Amount heard, 50%).
// The REAL lib/listening/soundscapeEngine.ts, bundled with esbuild and built into a recording fake audio graph.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const repo = path.join(import.meta.dirname, '../..');
const esbuild = createRequire(import.meta.url)(path.join(repo, 'node_modules/esbuild'));
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'soundscape-warm-')), 'engine.mjs');
esbuild.buildSync({ stdin: { contents: `export * from './lib/listening/soundscapeEngine.ts'; export * from './lib/listening/focusSoundscape.ts'; export * from './lib/listening/toneLab.ts';`, resolveDir: repo, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const E = await import(out);

// A minimal recording Web Audio graph: every node, every edge, every param value and scheduled target.
function fakeContext() {
  const nodes = [];
  const param = (value) => ({ value, targets: [], setValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.targets.push(v); },
    exponentialRampToValueAtTime(v) { this.targets.push(v); }, linearRampToValueAtTime(v) { this.targets.push(v); }, cancelScheduledValues() {} });
  const node = (kind, params) => {
    const n = { kind, out: [], started: false, stopped: false, ...params,
      connect(t) { this.out.push(t); return t; }, disconnect() { this.out = []; }, start() { this.started = true; }, stop() { this.stopped = true; } };
    nodes.push(n); return n;
  };
  return { nodes, currentTime: 0, sampleRate: 48000,
    destination: node('destination', {}),
    createGain: () => node('gain', { gain: param(1) }),
    createOscillator: () => node('osc', { type: 'sine', frequency: param(440), detune: param(0) }),
    createBiquadFilter: () => node('filter', { type: 'lowpass', frequency: param(350), Q: param(1) }),
    createStereoPanner: () => node('pan', { pan: param(0) }),
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
    createBufferSource: () => node('buffer', { buffer: null, loop: false, playbackRate: param(1) }),
  };
}
const reaches = (from, to, seen = new Set()) => from === to || (!seen.has(from) && (seen.add(from), from.out.some((n) => reaches(n, to, seen))));
const built = [];
const build = (spec) => { const ctx = fakeContext(); const handle = E.buildSoundscape(ctx, ctx.destination, spec, 0.45); built.push(handle); return { ctx, handle }; };
test.after(() => { for (const h of built) h.dispose(); }); // clears each sound's event timer even when a check fails
const overtoneOscs = (ctx, handle) => ctx.nodes.filter((n) => n.kind === 'osc' && n.frequency.value > 0 && !handle.oscillators.includes(n) && n !== handle.movement && n.frequency.value > 1);

test('the ruled setting: 2×, 3×, 4×, a soft 900 Hz low-pass, at 50% of the Shelf amount', () => {
  assert.deepEqual([...E.SOUNDSCAPE_OVERTONE_PARTIALS], [2, 3, 4]);
  assert.equal(E.SOUNDSCAPE_OVERTONE_SOFT_HZ, 900);
  assert.equal(E.SOUNDSCAPE_OVERTONE_BUS_GAIN, 3.0);
});

test('every Focus soundscape voice carries exact whole-number overtones, detune-locked, at 1/n²', () => {
  const spec = E.focusSoundscapeSpec(E.DEFAULT_SOUNDSCAPE_INPUT);
  const { ctx, handle } = build(spec);
  const ots = overtoneOscs(ctx, handle);
  assert.equal(ots.length, spec.voices.length * 3);
  spec.voices.forEach((voice, v) => {
    [2, 3, 4].forEach((n, k) => {
      const hz = spec.root * voice.ratio * n;
      const osc = ots[v * 3 + k]; // created in voice order, three each
      assert.ok(Math.abs(osc.frequency.value - hz) < 1e-9, `${n}× of voice ${v}`);
      assert.ok(osc, `missing ${n}× of ${spec.root * voice.ratio} Hz`);
      assert.equal(osc.type, 'sine'); assert.equal(osc.detune.value, voice.detuneCents); assert.ok(osc.started);
      const g = osc.out[0]; assert.equal(g.gain.value, hz > 4000 ? 0 : 1 / (n * n));
      assert.equal(g.out[0].gain.value, voice.gain, 'follows its own voice level');
    });
  });
  handle.dispose();
});

test('they pass the soft filter, the slow pulse and the one master (the Level governs them); nothing else reaches the speakers', () => {
  const spec = E.focusSoundscapeSpec({ need: 'activate', stimulation: 'medium', world: 'electronic', task: 'coding' }); // a world with a pulse
  const { ctx, handle } = build(spec);
  const ot = overtoneOscs(ctx, handle)[0];
  const soft = ctx.nodes.find((n) => n.kind === 'filter' && n.frequency.value === 900);
  assert.ok(soft && soft.Q.value === 0.5);
  assert.ok(reaches(ot, soft) && reaches(soft, handle.master));
  const bus = ctx.nodes.find((n) => n.kind === 'gain' && n.gain.value === 3.0);
  assert.ok(bus && bus.out.includes(handle.master), 'the overtone bus feeds the master');
  const swell = ctx.nodes.find((n) => n.kind === 'gain' && handle.movementDepth.out.includes(n.gain) && soft.out.includes(n));
  assert.ok(swell && swell.out.includes(bus), 'the same slow pulse as the voices moves the overtones');
  const toSpeakers = ctx.nodes.filter((n) => n.out.includes(ctx.destination));
  assert.deepEqual(toSpeakers, [handle.master], 'only the master reaches the destination');
  handle.dispose();
});

test('a live change moves the overtones with their voices; dispose stops them', () => {
  const a = E.focusSoundscapeSpec({ need: 'steady', stimulation: 'low', world: 'ambient', task: 'writing' });
  const b = E.focusSoundscapeSpec({ need: 'steady', stimulation: 'high', world: 'ambient', task: 'writing' });
  assert.equal(E.soundscapeNeedsRebuild(a, b), false);
  const { ctx, handle } = build(a);
  const ots = overtoneOscs(ctx, handle);
  assert.equal(handle.update(b), true);
  const shimmer = b.voices.length - 1; // the shimmer voice's level changes with stimulation
  const followers = ots.map((o) => o.out[0].out[0]);
  assert.ok(followers.some((f) => f.gain.targets.includes(b.voices[shimmer].gain)), 'a follower moved to its voice\'s new level');
  handle.dispose();
  assert.ok(ots.every((o) => o.stopped));
});

test('a Tone Lab sound stays a pure tone: no overtones', () => {
  const spec = E.toneSoundscapeSpec({ hz: 220 });
  const { ctx, handle } = build(spec);
  assert.equal(ctx.nodes.filter((n) => n.kind === 'filter' && n.frequency.value === 900).length, 0);
  assert.equal(ctx.nodes.filter((n) => n.kind === 'gain' && n.gain.value === 3.0).length, 0);
  assert.equal(overtoneOscs(ctx, handle).filter((o) => o.frequency.value !== 220 && o.frequency.value !== 220 + (spec.tone?.pulseHz ?? 0)).length, 0);
  handle.dispose();
});
