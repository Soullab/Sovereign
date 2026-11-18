// SOULLAB TRANSFORM T1 — the edit steps, WAV in/out, the recipe, provenance,
// and the member-owned-only rule. Shaping steps (EQ, filters, reverb) run in
// the browser's OfflineAudioContext and are measured in
// tests/listening/transform_t1_browser_witness.cjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./ts_resolution_loader.mjs', import.meta.url); // extensionless local TS imports, for tests only
const root = path.join(import.meta.dirname, '../..');
const mod = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const audio = await mod('lib/listening/transform/audio.ts');
const wav = await mod('lib/listening/transform/wav.ts');
const recipe = await mod('lib/listening/transform/recipe.ts');
const render = await mod('lib/listening/transform/render.ts');
const prov = await mod('lib/listening/transform/provenance.ts');
const ir = await mod('lib/listening/transform/impulses.ts');

const RATE = 44100;
const tone = (secs, hz = 997, amp = 0.5, rate = RATE, channels = 2) => ({
  sampleRate: rate,
  channels: Array.from({ length: channels }, () => Float32Array.from({ length: Math.round(secs * rate) }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / rate))),
});
const ramp = (n) => ({ sampleRate: RATE, channels: [Float32Array.from({ length: n }, (_, i) => i / n)] });
const copy = (a) => ({ sampleRate: a.sampleRate, channels: a.channels.map((c) => c.slice()) });
const same = (a, b) => a.sampleRate === b.sampleRate && a.channels.length === b.channels.length && a.channels.every((c, i) => c.length === b.channels[i].length && c.every((v, j) => Object.is(v, b.channels[i][j])));

test('trim keeps exactly the frames asked for', () => {
  const a = tone(2);
  const t = audio.trim(a, 0.5, 1.25);
  assert.equal(audio.frameCount(t), Math.round(1.25 * RATE) - Math.round(0.5 * RATE));
  assert.equal(t.channels[0][0], a.channels[0][Math.round(0.5 * RATE)]);
  assert.throws(() => audio.trim(a, 1, 1), /empty/);
});

test('fades start and end at silence and never move the wrong way', () => {
  const ones = { sampleRate: RATE, channels: [new Float32Array(RATE).fill(1)] };
  const f = audio.fade(ones, 0.25, 0.25).channels[0];
  assert.equal(f[0], 0);
  assert.ok(Math.abs(f[f.length - 1]) < 1e-12);
  const n = Math.round(0.25 * RATE);
  for (let i = 1; i < n; i++) assert.ok(f[i] >= f[i - 1], 'fade-in went down');
  for (let i = f.length - n + 1; i < f.length; i++) assert.ok(f[i] <= f[i - 1], 'fade-out went up');
  assert.equal(f[RATE / 2], 1, 'the middle was touched');
});

test('normalize lands exactly on the target and never above −1 dBFS; silence stays silence', () => {
  const n = audio.normalize(tone(1, 997, 0.1), -1);
  assert.ok(Math.abs(20 * Math.log10(audio.peak(n)) - -1) < 1e-4);
  const silent = { sampleRate: RATE, channels: [new Float32Array(100)] };
  assert.equal(audio.peak(audio.normalize(silent, -1)), 0);
  assert.match(recipe.stepProblem({ kind: 'normalize', peakDbfs: 0 }), /−1 dBFS/);
});

test('reverse is the exact sample reversal', () => {
  const r = audio.reverse(ramp(1000)).channels[0];
  const src = ramp(1000).channels[0];
  for (let i = 0; i < 1000; i++) assert.equal(r[i], src[999 - i]);
});

test('loop has the exact length and a continuous, equal-power join', () => {
  const a = tone(1);
  const l = audio.loop(a, 3, 20);
  const xf = Math.round(0.02 * RATE);
  assert.equal(audio.frameCount(l), 3 * RATE - 2 * xf);
  // An integer-cycle 997 Hz second loops seamlessly: the crossfade keeps the tone's level.
  let maxJump = 0;
  const c = l.channels[0];
  for (let i = 1; i < c.length; i++) maxJump = Math.max(maxJump, Math.abs(c[i] - c[i - 1]));
  assert.ok(maxJump < 0.5 * (2 * Math.PI * 997 / RATE) * 1.5, `click at a join (${maxJump})`);
});

test('join refuses different sample rates rather than resampling silently, and lifts mono to stereo', () => {
  assert.throws(() => audio.join(tone(1), tone(1, 997, 0.5, 48000), 0), /different sample rates/);
  const j = audio.join(tone(1, 997, 0.5, RATE, 2), tone(0.5, 440, 0.5, RATE, 1), 0);
  assert.equal(j.channels.length, 2);
  assert.equal(audio.frameCount(j), Math.round(1.5 * RATE));
});

test('gain is exact', () => {
  const g = audio.gain(tone(0.1, 997, 0.25), 6.0206);
  assert.ok(Math.abs(audio.peak(g) / audio.peak(tone(0.1, 997, 0.25)) - 2) < 1e-4);
});

test('24-bit WAV round-trips exactly; other chunks (BWF bext, cue) are skipped', () => {
  const a = tone(0.5);
  const q = wav.readWav(wav.writeWav24(a)); // quantized once
  const again = wav.readWav(wav.writeWav24(q));
  assert.ok(same(q, again), 'a 24-bit take does not survive save → open unchanged');
  assert.equal(q.sampleRate, RATE);
  // Insert a bext chunk before data, as Soullab Capture writes.
  const plain = new Uint8Array(wav.writeWav24(a));
  const bext = new Uint8Array(8 + 602); bext.set([98, 101, 120, 116]); new DataView(bext.buffer).setUint32(4, 602, true);
  const withBext = new Uint8Array(plain.length + bext.length);
  withBext.set(plain.subarray(0, 36)); withBext.set(bext, 36); withBext.set(plain.subarray(36), 36 + bext.length);
  assert.ok(same(wav.readWav(withBext.buffer), q));
  assert.throws(() => wav.readWav(new ArrayBuffer(10)), /not a WAV/);
});

test('a recording longer than 20 minutes is refused', () => {
  const hdr = new Uint8Array(wav.writeWav24({ sampleRate: 8000, channels: [new Float32Array(8)] }));
  const v = new DataView(hdr.buffer);
  v.setUint32(40, 8000 * 3 * (20 * 60 + 1), true); // claims 20 min + 1 s of mono
  const big = new Uint8Array(44 + 8000 * 3 * (20 * 60 + 1)); big.set(hdr.subarray(0, 44));
  assert.throws(() => wav.readWav(big.buffer), /longer than 20 minutes/);
  assert.equal(recipe.MAX_TRANSFORM_SECONDS, 1200);
});

test('a recipe renders in order, the original is untouched, and a loop past 20 minutes is refused', async () => {
  const src = tone(2);
  const before = copy(src);
  const out = await render.renderRecipe(src, [
    { kind: 'trim', startSec: 0.5, endSec: 1.5 }, { kind: 'reverse' }, { kind: 'fade', inSec: 0.1, outSec: 0.1 }, { kind: 'normalize', peakDbfs: -1 },
  ]);
  assert.ok(same(src, before), 'the source audio was modified');
  assert.equal(audio.frameCount(out), RATE);
  assert.ok(Math.abs(20 * Math.log10(audio.peak(out)) + 1) < 1e-4);
  await assert.rejects(render.renderRecipe(tone(30, 997, 0.5, 8000, 1), [{ kind: 'loop', times: 64, crossfadeMs: 0 }]), /20 minutes/);
  await assert.rejects(render.renderRecipe(src, [{ kind: 'eq', lowDb: 3, midDb: 0, midHz: 1000, highDb: 0 }]), /cannot render EQ/);
  await assert.rejects(render.renderRecipe(src, [{ kind: 'join', crossfadeMs: 0 }]), /Choose the recording to join/);
  await assert.rejects(render.renderRecipe(src, []), /at least one step/);
});

test('recipe validation names the problem plainly', () => {
  assert.equal(recipe.recipeProblem([{ kind: 'gain', db: 3 }]), null);
  assert.match(recipe.recipeProblem([{ kind: 'filter', highpassHz: 5000, lowpassHz: 1000 }]), /below low-pass/);
  assert.match(recipe.recipeProblem([{ kind: 'reverb', space: 'cathedral', mix: 0.5 }]), /space/);
  assert.match(recipe.recipeProblem([{ kind: 'join', crossfadeMs: 0 }, { kind: 'join', crossfadeMs: 0 }]), /one other recording/);
  assert.match(recipe.recipeProblem([{ kind: 'eq', lowDb: 0, midDb: 0, midHz: 30000, highDb: 0 }], 22050), /middle band/);
});

test('only a file the member chose is accepted — never a link, a gate path, or a bare Blob', () => {
  assert.equal(prov.acceptMemberFile(new File([new Uint8Array(10)], 'take.wav', { type: 'audio/wav' })).ok, true);
  for (const bad of ['/media/sound-studio/night-ground/01.flac', 'https://soullab.life/media/x.wav', new URL('https://x.test/a.wav'),
    new Blob([new Uint8Array(10)], { type: 'audio/wav' }), { name: 'x.wav', size: 10, type: 'audio/wav' }, null,
    new File([new Uint8Array(10)], '/media/sound-studio/x.wav', { type: 'audio/wav' })]) {
    assert.equal(prov.acceptMemberFile(bad).ok, false, `accepted ${String(bad)}`);
  }
});

test('provenance hashes are SHA-256 and the record says it is derived', async () => {
  assert.equal(await prov.sha256Hex(new TextEncoder().encode('abc').buffer), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const p = prov.buildProvenance({ source: { name: 'a.wav', sha256: 'x', sampleRate: RATE, frames: 1, channels: 2, decodedBy: 'soullab-wav' },
    steps: [{ kind: 'reverse' }], output: { name: 'b.wav', sha256: 'y', sampleRate: RATE, frames: 1, channels: 2 }, createdAt: '2026-11-17T00:00:00Z' });
  assert.equal(p.derived, true);
  assert.equal(p.transformVersion, recipe.TRANSFORM_VERSION);
  assert.deepEqual(p.recipe, [{ kind: 'reverse' }]);
});

test('reverb spaces are Soullab-made, deterministic, and decay to silence', () => {
  const [l1] = ir.impulseResponse('hall', RATE);
  const [l2, r2] = ir.impulseResponse('hall', RATE);
  assert.ok(l1.every((v, i) => v === l2[i]), 'the same space differs between runs');
  assert.ok(!l2.every((v, i) => v === r2[i]), 'left and right are identical (no width)');
  assert.equal(l2.length, Math.round(0.024 * RATE) + Math.round(2.4 * RATE));
  const energy = l2.reduce((s, v) => s + v * v, 0);
  assert.ok(Math.abs(energy - 1) < 1e-3);
  const head = Math.max(...l2.slice(Math.round(0.024 * RATE), Math.round(0.124 * RATE)).map(Math.abs));
  const tail = Math.max(...l2.slice(-200).map(Math.abs));
  assert.ok(20 * Math.log10(tail / head) < -50, 'the hall does not decay');
});

test('structure: Transform never reaches the network, the media gate, or the rights policy', () => {
  const dir = path.join(root, 'lib/listening/transform');
  for (const f of fs.readdirSync(dir)) {
    const body = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const banned of ['fetch(', 'XMLHttpRequest', 'soundStudioMediaGate', 'rightsPolicy', 'mediaTicket', 'navigator.sendBeacon', 'localStorage', 'indexedDB']) {
      assert.ok(!body.includes(banned), `${f} uses ${banned}`);
    }
  }
});
