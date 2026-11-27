// LISTEN-01 · Orbit & Threshold (sketch 06) — sequencing, single-authority and no-claim contract.
// Founder ruling 2026-11-17: review-only branch; plays only through the persistent player.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./ts_resolution_loader.mjs', import.meta.url);
const root = path.join(import.meta.dirname, '../..');
const orbit = await import(pathToFileURL(path.join(root, 'lib/listening/orbitThreshold.ts')).href);
const { buildSequence, ROUTES, elementPitches, instantSeconds, normalizeBreaths, ORBIT_NOTES, DEFAULT_ORBIT_SETTINGS } = orbit;

const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const code = rel => strip(fs.readFileSync(path.join(root, rel), 'utf8'));

test('founder route, one breath per point: 26 steps; lineage, three breaths: 86 steps', () => {
  assert.equal(buildSequence('founder', 1).length, 26);
  assert.equal(buildSequence('lineage', 3).length, 86);
});

for (const route of ['founder', 'lineage']) {
  for (const n of [1, 3, 5, 7, 9]) {
    test(`${route} · ${n} breath(s): every station in order, breaths alternate, one opening at the third eye`, () => {
      const seq = buildSequence(route, n);
      const { up, down } = ROUTES[route];
      assert.deepEqual(seq.filter(s => s.act === 'move' && s.leg === 'up').map(s => s.to), up.slice(1).map((_, i) => i + 1));
      assert.deepEqual(seq.filter(s => s.act === 'move' && s.leg === 'down').map(s => s.to), down.slice(1).map((_, i) => i + 1));
      seq.forEach((s, i) => assert.notEqual(s.br, seq[(i + 1) % seq.length].br, `breath ${i} must alternate`));
      seq.filter(s => s.act === 'move').forEach(s => assert.equal(s.br, s.leg === 'up' ? 'in' : 'out', 'in-breath rises, out-breath falls'));
      const third = seq.filter(s => s.third);
      assert.equal(third.length, 1);
      assert.equal(third[0].act, 'turn'); assert.equal(third[0].leg, 'up'); assert.equal(third[0].at, up.length - 1);
      assert.match(up[up.length - 1][0], /third eye/i);
      // N breaths at each resting point: the arrival breath plus N−1 full breaths
      const restsAt = seq.filter(s => s.leg === 'up' && s.act === 'rest' && s.at === 1).length;
      assert.equal(restsAt, 1 + 2 * (n - 1));
    });
  }
}

test('pitch: fire climbs two octaves up the back, water falls two octaves down the front', () => {
  assert.deepEqual(elementPitches(true, 0), { fire: 110, water: 440 });
  assert.deepEqual(elementPitches(true, 1), { fire: 440, water: 440 });
  assert.deepEqual(elementPitches(false, 0), { fire: 110, water: 440 });
  assert.deepEqual(elementPitches(false, 1), { fire: 110, water: 110 });
});

test('the instant stays within the founder-reported 4–7 s', () => {
  for (const c of [4, 5, 6, 7]) assert.equal(instantSeconds(c), c);
  assert.equal(instantSeconds('random', () => 0), 4);
  assert.equal(instantSeconds('random', () => 0.999999), 4 + 0.999999 * 3);
  assert.equal(instantSeconds(2), 4); assert.equal(instantSeconds(30), 7);
  assert.equal(normalizeBreaths(4), 1); assert.equal(normalizeBreaths('x'), 1); assert.equal(normalizeBreaths(9), 9);
});

test('defaults: follow my breath, one breath per point, founder route, threshold only by hand, end in silence', () => {
  const d = DEFAULT_ORBIT_SETTINGS;
  assert.equal(d.pacing, 'follow'); assert.equal(d.rhythm, 'point'); assert.equal(d.breaths, 1);
  assert.equal(d.route, 'founder'); assert.equal(d.autoOrbits, 0); assert.equal(d.returnAfterSec, 0);
});

test('one audio authority: the study never opens its own context or output, and fetches nothing', () => {
  for (const rel of ['lib/listening/orbitThreshold.ts', 'lib/listening/proceduralStudy.ts', 'app/listen/OrbitThresholdDesk.tsx']) {
    const src = code(rel);
    assert.ok(!/new\s+(window\.)?(webkit)?AudioContext|AudioContext\s*\(/.test(src), `${rel} must not create an AudioContext`);
    assert.ok(!/\.destination\b/.test(src), `${rel} must not reach the device output (context.destination)`);
    assert.ok(!/\bfetch\(|XMLHttpRequest|localStorage|getUserMedia/.test(src), `${rel} must not use network, storage or microphone`);
  }
  const desk = code('app/listen/OrbitThresholdDesk.tsx');
  assert.match(desk, /transport\.playStudy\(/);
  assert.match(desk, /transport\.stopMusic\(\)/);
  const provider = code('components/listening/PersistentListeningProvider.tsx');
  const playStudy = provider.slice(provider.indexOf('const playStudy'), provider.indexOf('const playExperienceMedia'));
  assert.match(playStudy, /refuseDuringMaiaSpeech\(\)/, 'refuses while MAIA speaks');
  assert.match(playStudy, /acquireAudioOutput\('listening-music'\)/, 'takes the one output lease');
  assert.match(playStudy, /releaseOutput\(\)/);
  assert.match(provider, /sketch\.study\?\.handle\.dispose\(\)/, 'Stop disposes the study');
  assert.match(provider, /!sketch\.current\.study\)\s*\n?\s*applyReceptiveShape/, 'Receptive shaping never touches a study');
});

test('no recorded media is admitted for this study', async () => {
  const gate = code('lib/listening/soundStudioMediaGate.ts');
  assert.ok(!/orbit|threshold/i.test(gate));
});

test('copy makes no state, effect or health claim, and says what Follow my breath can and cannot know', () => {
  const words = [code('app/listen/OrbitThresholdDesk.tsx'), ...Object.values(ORBIT_NOTES)].join('\n');
  assert.ok(!/\b(heal(s|ing)?|cure|therap(y|eutic)|activat(e|es|ion)|unlock|DMT|pineal|gamma|entrain\w*|guarantee\w*|awaken\w*)\b/i.test(words));
  assert.match(ORBIT_NOTES.breath, /Nothing measures your breathing/);
  assert.match(ORBIT_NOTES.lineage, /not a single prescribed Taoist sequence/);
  assert.match(ORBIT_NOTES.safety, /no breath holds/);
  assert.match(ORBIT_NOTES.claim, /makes no health claim/);
});
