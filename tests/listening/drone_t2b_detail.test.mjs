// SOULLAB TRANSFORM T2 step B — Resonance & Detail. Founder: "Yes, start step B" (2026-11-21).
// 1. engine3 (derived from the accepted engine by counted patches) is NEUTRAL by default: it renders the eight
//    founder-accepted drones bit-identically, and with neutral detail the desk still uses the accepted engine.
// 2. Each control does what it says, within range; the meter finds a planted click; recipes carry the detail.
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
const engine = await mod('lib/listening/drone/engine.js');
const engine3 = await mod('lib/listening/drone/engine3.js');
const drone = await mod('lib/listening/drone/drone.ts');
const detail = await mod('lib/listening/drone/detail.ts');
const sha = (b) => crypto.createHash('sha256').update(Buffer.from(b)).digest('hex');
const SR = 48000;
const tone = (seconds, hz = 196) => ({ sampleRate: SR, channels: [Float32Array.from({ length: Math.round(seconds * SR) }, (_, i) => { const t = i / SR; let v = 0; for (let k = 1; k <= 5; k++) v += Math.sin(2 * Math.PI * hz * k * t) / k; return 0.3 * v; })] });
const render = async (s) => drone.renderDrone(drone.droneSource(tone(3), 'mine.wav'), { ...drone.defaultSettings('living'), duration: 10, region: { startSeconds: 0.5, endSeconds: 2.5 }, ...s }, null);

const LAB = '/Users/soullab/Documents/Soullab Sound Lab/Soullab_Voice_to_Drone_Lab_v0.3.4-clean-level-tune';
const SERIES = '/Users/soullab/Documents/Soullab Sound Lab/Drone_Series_01_VocalSet';
const present = fs.existsSync(path.join(LAB, 'source')) && fs.existsSync(path.join(SERIES, 'recipes'));

test('engine.js is untouched; engine3.js differs from it only by the counted patches', () => {
  const e = fs.readFileSync(path.join(root, 'lib/listening/drone/engine.js'), 'utf8');
  const e3 = fs.readFileSync(path.join(root, 'lib/listening/drone/engine3.js'), 'utf8');
  assert.match(e, /^\/\/ GENERATED — do not edit by hand\. Regenerate/m);
  assert.doesNotMatch(e, /D3\.|completeDetail|resonanceInPlace/, 'the accepted engine carries no step B code');
  assert.match(e3, /const D3=completeDetail\(opts\.detail\);/);
  assert.equal((e3.match(/D3\./g) || []).length, 10, 'tone ×2, size, decay ×2, dry ×2, wet ×2, band');
});

test('engine3 with no detail renders the 8 founder-accepted drones bit-identically', { skip: !present && 'founder lab folder not on this machine' }, async () => {
  const buf = fs.readFileSync(path.join(LAB, 'source', 'm1_long_straight_o_WORKING_48k32float.wav'));
  let p = 12, data; while (p + 8 <= buf.length) { const id = buf.toString('ascii', p, p + 4), sz = buf.readUInt32LE(p + 4); if (id === 'data') data = buf.subarray(p + 8, p + 8 + sz); p += 8 + sz + (sz % 2); }
  const x = new Float32Array(data.length / 4); for (let i = 0; i < x.length; i++) x[i] = data.readFloatLE(i * 4);
  const src = { data: x, rate: 48000, name: 'm1_long_straight_o_ORIGINAL_44k16.wav', synthetic: false };
  for (const f of fs.readdirSync(path.join(SERIES, 'recipes')).filter((n) => n.endsWith('_recipe.json')).sort()) {
    const recipe = JSON.parse(fs.readFileSync(path.join(SERIES, 'recipes', f), 'utf8'));
    const out = await engine3.render(src, { ...engine.recipeToSettings(recipe), detail: detail.NEUTRAL_DETAIL }, () => {});
    assert.equal(sha(await out.blob.arrayBuffer()), recipe.output.sha256, `${f}: engine3 neutral = accepted master`);
  }
});

test('neutral detail uses the accepted engine and leaves no detail in the recipe', async () => {
  assert.equal(detail.isNeutralDetail(null), true);
  assert.equal(detail.isNeutralDetail(detail.NEUTRAL_DETAIL), true);
  assert.equal(detail.isNeutralDetail({ band: { on: true, db: 0 } }), true, 'a band at 0 dB changes nothing');
  assert.equal(detail.isNeutralDetail({ decay: 0.6 }), false);
  const a = await render({ detail: null }), b = await render({ detail: detail.NEUTRAL_DETAIL });
  assert.equal(sha(await a.blob.arrayBuffer()), sha(await b.blob.arrayBuffer()));
  const rec = JSON.parse(JSON.stringify(drone.droneRecipe(a, drone.droneSource(tone(3), 'mine.wav'), null)));
  assert.equal(rec.processing.detail, undefined);
});

test('each control changes the sound, and clamps to its range', async () => {
  const base = sha(await (await render({})).blob.arrayBuffer());
  for (const d of [{ decay: 0.7 }, { size: 2 }, { wet: 2.5 }, { dry: 0.5 }, { toneHz: 2000 }, { band: { on: true, hz: 600, q: 4, db: 9 } }]) {
    assert.notEqual(sha(await (await render({ detail: d })).blob.arrayBuffer()), base, JSON.stringify(d));
  }
  const c = detail.completeDetail({ decay: 5, size: 9, wet: -1, dry: 9, toneHz: 50, band: { on: true, hz: 1, q: 99, db: 99 } });
  assert.deepEqual([c.decay, c.size, c.wet, c.dry, c.toneHz, c.band.hz, c.band.q, c.band.db], [0.8, 2.5, 0, 1.5, 800, 40, 12, 18]);
});

test('a heavy decay stays finite and inside the ceiling; the loop seam stays smooth', async () => {
  const r = await render({ detail: { decay: 0.8, size: 2.5, wet: 3 } });
  let finite = true, pk = 0; for (const v of r.left) { if (!Number.isFinite(v)) finite = false; pk = Math.max(pk, Math.abs(v)); }
  assert.ok(finite); assert.ok(20 * Math.log10(pk) <= -4.1, `peak ${20 * Math.log10(pk)}`);
  assert.equal(detail.analyseDetail(r.left, r.right, r.rate, true).seam.smooth, true);
});

test('a moved control travels in the recipe and the recipe brings it back', async () => {
  const d = { decay: 0.62, size: 1.4, wet: 1.5, dry: 0.8, toneHz: 4200, band: { on: true, hz: 784, q: 3, db: 6 } };
  const r = await render({ detail: d });
  const rec = JSON.parse(JSON.stringify(drone.droneRecipe(r, drone.droneSource(tone(3), 'mine.wav'), null)));
  assert.deepEqual(rec.processing.detail, detail.completeDetail(d));
  const back = drone.parseDroneRecipe(JSON.stringify(rec));
  assert.equal(back.ok, true);
  const again = await drone.renderDrone(drone.droneSource(tone(3), 'mine.wav'), back.settings, null);
  assert.equal(sha(await again.blob.arrayBuffer()), sha(await r.blob.arrayBuffer()), 'bit-identical round trip with detail');
  const prov = drone.buildDroneProvenance({ source: { name: 'mine.wav', sha256: 'x', sampleRate: SR, frames: 1, channels: 1, decodedBy: 'soullab-wav' }, recipe: rec, output: { name: 'o', audioSha256: 'y', sampleRate: SR, frames: 1, channels: 2 }, createdAt: 'now' });
  assert.match(prov.engine.resonanceAndDetail, /engine3/);
});

test('the Detail meter finds a planted click and a planted swell; Keep changes nothing', () => {
  const n = SR * 6, L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; const v = 0.2 * Math.sin(2 * Math.PI * 220 * t) * (1 + 0.3 * Math.sin(2 * Math.PI * 1.5 * t)); L[i] = v; R[i] = v; }
  const at = Math.round(3.21 * SR); L[at] += 0.6; R[at] += 0.6; L[at + 1] -= 0.6; R[at + 1] -= 0.6;
  const rep = detail.analyseDetail(L, R, SR, false);
  assert.ok(rep.clicks.some((c) => Math.abs(c.at - 3.21) < 0.01), JSON.stringify(rep.clicks));
  assert.ok(rep.beat && Math.abs(rep.beat.hz - 1.5) < 0.1, JSON.stringify(rep.beat));
  const s = { stillness: 80, movement: 30, clean: { repairClips: false, lowCutHz: 0, soften: 10, smooth: 0 } };
  assert.deepEqual(detail.answerReading('click', 'keep', s), {});
  assert.equal(detail.answerReading('click', 'reduce', s).clean.soften, 25);
  assert.equal(detail.answerReading('flutter', 'emphasise', s).movement, 40);
});

test('listening tools: excerpt, band-only and loudness match', () => {
  const n = SR * 4, L = Float32Array.from({ length: n }, (_, i) => 0.1 * Math.sin(2 * Math.PI * 220 * i / SR) + 0.1 * Math.sin(2 * Math.PI * 2000 * i / SR)), R = L.slice();
  const ex = detail.excerptLoop(L, R, SR, 2, 2, 3);
  assert.equal(ex.left.length, 3 * 2 * SR);
  const b = detail.bandOnly(L, R, SR, 2000, 4);
  const sp = detail.spectrum(b.left, b.right, SR);
  const peakHz = sp.hz[sp.db.indexOf(Math.max(...sp.db))];
  assert.ok(Math.abs(Math.log2(peakHz / 2000)) < 0.1, `band-only keeps 2 kHz (peak at ${peakHz})`);
  const m = detail.matchLoudness(L, R, SR, -20);
  assert.ok(Math.abs(engine.measureLufs(m.left, m.right, SR) - -20) < 0.2);
});
