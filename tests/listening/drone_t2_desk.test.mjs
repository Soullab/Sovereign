// SOULLAB TRANSFORM T2 (R2, step A) — the Drone desk's logic: member-file rule, downmix,
// settings limits, recipe load, provenance, and the saved WAV. Uses a synthetic tone only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./ts_resolution_loader.mjs', import.meta.url);
const root = path.join(import.meta.dirname, '../..');
const mod = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const drone = await mod('lib/listening/drone/drone.ts');
const engine = await mod('lib/listening/drone/engine.js');
const wav = await mod('lib/listening/transform/wav.ts');
const prov = await mod('lib/listening/transform/provenance.ts');
const sha = (b) => crypto.createHash('sha256').update(Buffer.from(b)).digest('hex');

const SR = 48000;
function tone(seconds, hz = 220, channels = 2) {
  const n = Math.round(seconds * SR);
  return { sampleRate: SR, channels: Array.from({ length: channels }, (_, c) => Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin(2 * Math.PI * hz * i / SR) * (c ? 0.5 : 1))) };
}

test('downmix matches the lab: each channel / count, summed in order', () => {
  const s = drone.droneSource(tone(1), 'mine.wav');
  assert.equal(s.rate, SR);
  const i = 1234, a = tone(1);
  assert.equal(s.data[i], Math.fround(Math.fround(0 + a.channels[0][i] / 2) + a.channels[1][i] / 2));
  assert.throws(() => drone.droneSource(tone(0.2), 'short.wav'), /at least 0.35 seconds/);
});

test('settings limits: 10–120 s, passage inside the recording and at least the engine minimum', () => {
  const s = drone.defaultSettings('earth');
  assert.equal(drone.settingsProblem(s, 5), null);
  assert.match(drone.settingsProblem({ ...s, duration: 121 }, 5), /10–120/);
  assert.match(drone.settingsProblem({ ...s, duration: 5 }, 5), /10–120/);
  assert.match(drone.settingsProblem({ ...s, region: { startSeconds: 1, endSeconds: 6 } }, 5), /inside the recording/);
  assert.match(drone.settingsProblem({ ...s, region: { startSeconds: 1, endSeconds: 1.1 } }, 5), /at least/);
  assert.ok(drone.DRONE_SECONDS.max <= 20 * 60, 'inside the Transform 20-minute cap');
});

test('solo is applied exactly as the lab applies it', () => {
  const s = { ...drone.defaultSettings('living'), soloLayer: 1 };
  s.layerMix = s.layerMix.map((m, i) => ({ ...m, enabled: i !== 1 })); // even a disabled layer sounds when soloed, as in the lab
  assert.deepEqual(drone.effectiveSettings(s).layerMix.map((m) => m.enabled), [false, true, false]);
});

test('a render is deterministic, stereo 24-bit at the source rate, and its recipe reloads to the same sound', async () => {
  const src = drone.droneSource(tone(3, 196), 'mine.wav');
  const s = { ...drone.defaultSettings('living'), duration: 10, region: { startSeconds: 0.5, endSeconds: 2.5 } };
  const a = await drone.renderDrone(src, s, null), b = await drone.renderDrone(src, s, null);
  const wa = await a.blob.arrayBuffer(), wb = await b.blob.arrayBuffer();
  assert.equal(sha(wa), sha(wb));
  const read = wav.readWav(wa);
  assert.equal(read.sampleRate, SR); assert.equal(read.channels.length, 2); assert.equal(read.channels[0].length, 10 * SR);
  const recipe = JSON.parse(JSON.stringify(drone.droneRecipe(a, src, null)));
  assert.equal(recipe.source.selfReportedRights, 'member-owned');
  const loaded = drone.parseDroneRecipe(JSON.stringify(recipe));
  assert.equal(loaded.ok, true);
  const c = await drone.renderDrone(src, loaded.settings, null);
  assert.equal(sha(await c.blob.arrayBuffer()), sha(wa), 'recipe round-trip reproduces the render bit for bit');
});

test('recipe load refuses what is not a Voice to Drone recipe', () => {
  assert.equal(drone.parseDroneRecipe('not json').ok, false);
  assert.equal(drone.parseDroneRecipe(JSON.stringify({ format: 'soullab.transform.provenance.v1' })).ok, false);
  assert.equal(drone.parseDroneRecipe(JSON.stringify({ format: 'SOULLAB_VOICE_TO_DRONE_X', processing: { preset: 'nope' } })).ok, false);
  const r = drone.parseDroneRecipe(JSON.stringify({ format: 'SOULLAB_VOICE_TO_DRONE_CREATIVE_LAB_V0_3_4', processing: { preset: 'aether', duration: 999, stillness: 80, grainMs: 440, pitch: 0, movement: 47, space: 76, anchor: 35, loop: true } }));
  assert.equal(r.ok, true); assert.equal(r.settings.duration, 120, 'clamped to the lab range');
});

test('provenance: embedded in the WAV without touching the audio, and states the engine', async () => {
  const src = drone.droneSource(tone(2), 'mine.wav');
  const r = await drone.renderDrone(src, { ...drone.defaultSettings(), duration: 10 }, null);
  const bytes = await r.blob.arrayBuffer();
  const audioSha256 = await prov.sha256Hex(wav.wavAudioBytes(bytes));
  const record = drone.buildDroneProvenance({
    source: { name: 'mine.wav', sha256: 'x', sampleRate: SR, frames: 2 * SR, channels: 2, decodedBy: 'soullab-wav' },
    recipe: drone.droneRecipe(r, src, null),
    output: { name: 'mine (drone).wav', audioSha256, sampleRate: SR, frames: r.frames, channels: 2 }, createdAt: '2026-11-21T00:00:00Z',
  });
  assert.equal(record.schema, 'soullab.drone.provenance.v1');
  assert.equal(record.engine.labSha256, '8407c45e8a6b6be17db3072cf1391451d3e28067266e690b6d471b42617e5d83');
  assert.equal(record.derived, true); assert.equal(record.onDevice, true);
  const finished = wav.withProvenance(bytes, JSON.stringify(record));
  assert.equal(JSON.parse(wav.readProvenance(finished)).schema, 'soullab.drone.provenance.v1');
  assert.equal(await prov.sha256Hex(wav.wavAudioBytes(finished)), audioSha256, 'audio unchanged by the embedded record');
});

test('member-owned only: the T1 gate is the one used, and the drone code has no network or storage path', () => {
  assert.equal(prov.acceptMemberFile('https://soullab.life/media/sound-studio/x.m4a').ok, false);
  assert.equal(prov.acceptMemberFile(new File([new Uint8Array(8)], '/media/sound-studio/x.wav', { type: 'audio/wav' })).ok, false);
  const desk = fs.readFileSync(path.join(root, 'app/listen/DroneDesk.tsx'), 'utf8');
  assert.match(desk, /acceptMemberFile\(/);
  for (const f of ['lib/listening/drone/engine.js', 'lib/listening/drone/drone.ts', 'app/listen/DroneDesk.tsx']) {
    const text = fs.readFileSync(path.join(root, f), 'utf8');
    assert.doesNotMatch(text, /\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|indexedDB|getUserMedia|MediaRecorder/, `${f}: no network, storage or microphone`);
  }
  // One player: the desk never makes its own audio element or live audio context.
  assert.doesNotMatch(desk, /new Audio\(|<audio|new AudioContext|webkitAudioContext/);
});
