// SOULLAB TRANSFORM T2 — the same sound the founder accepted.
//
// The founder heard Drone Series 01 (eight renders of the Voice to Drone Lab v0.3.4 engine)
// and said "they are all phenomenal!" (2026-11-21). This test re-renders each of those eight
// from its own saved recipe, through lib/listening/drone/engine.js, and requires the WAV to be
// BIT-IDENTICAL to the master the founder's MP3s were made from.
//
// Rights: the VocalSet source and the eight drones are NOT in this repository and are not
// admitted to Sound Studio. They are read from the founder's private folder; only hashes are
// compared. Without that folder the test is skipped, and says so.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.join(import.meta.dirname, '../..');
const engine = await import(path.join(root, 'lib/listening/drone/engine.js'));

const LAB = process.env.SOULLAB_DRONE_LAB_DIR
  ?? '/Users/soullab/Documents/Soullab Sound Lab/Soullab_Voice_to_Drone_Lab_v0.3.4-clean-level-tune';
const SERIES = process.env.SOULLAB_DRONE_SERIES_DIR
  ?? '/Users/soullab/Documents/Soullab Sound Lab/Drone_Series_01_VocalSet';
const SOURCE = path.join(LAB, 'source', 'm1_long_straight_o_WORKING_48k32float.wav');
const ACCEPTED_SOURCE_SHA = 'd04320044b19d51dab17a7d04b857777a9571c9c4ec5b129be6affdbde228846';
const present = fs.existsSync(SOURCE) && fs.existsSync(path.join(SERIES, 'recipes'));
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

function readFloatWav(buf) {
  let p = 12, data = null;
  while (p + 8 <= buf.length) {
    const id = buf.toString('ascii', p, p + 4), sz = buf.readUInt32LE(p + 4);
    if (id === 'data') data = buf.subarray(p + 8, p + 8 + sz);
    p += 8 + sz + (sz % 2);
  }
  const x = new Float32Array(data.length / 4);
  for (let i = 0; i < x.length; i++) x[i] = data.readFloatLE(i * 4);
  return x;
}

test('engine.js is the accepted lab.js, verbatim', { skip: !present && 'founder lab folder not on this machine' }, async () => {
  const lab = fs.readFileSync(path.join(LAB, 'lab.js'));
  assert.equal(sha(lab), '8407c45e8a6b6be17db3072cf1391451d3e28067266e690b6d471b42617e5d83');
  const labLines = lab.toString('utf8').split('\n');
  const engineText = fs.readFileSync(path.join(root, 'lib/listening/drone/engine.js'), 'utf8');
  const blocks = [...engineText.matchAll(/^\/\/ ---- lab\.js (\d+)-(\d+) ----$/gm)];
  assert.ok(blocks.length >= 9, 'engine.js carries its lab.js line ranges');
  for (const m of blocks) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    const expected = labLines.slice(a - 1, b).join('\n');
    assert.ok(engineText.includes(`${m[0]}\n${expected}\n`), `lab.js ${a}-${b} copied verbatim`);
  }
});

test('all eight accepted drones re-render bit-identically from their recipes', { skip: !present && 'founder lab folder not on this machine' }, async () => {
  const srcBuf = fs.readFileSync(SOURCE);
  assert.equal(sha(srcBuf), ACCEPTED_SOURCE_SHA, 'same source the series was rendered from');
  const src = { data: readFloatWav(srcBuf), rate: 48000, name: 'm1_long_straight_o_ORIGINAL_44k16.wav', synthetic: false };
  const recipes = fs.readdirSync(path.join(SERIES, 'recipes')).filter((f) => f.endsWith('_recipe.json')).sort();
  assert.equal(recipes.length, 8);
  for (const f of recipes) {
    const recipe = JSON.parse(fs.readFileSync(path.join(SERIES, 'recipes', f), 'utf8'));
    const master = fs.readFileSync(path.join(SERIES, 'wav', f.replace('_recipe.json', '.wav')));
    assert.equal(sha(master), recipe.output.sha256, `${f}: master on disk is the one recorded`);
    const out = await engine.render(src, engine.recipeToSettings(recipe), () => {});
    const wav = Buffer.from(await out.blob.arrayBuffer());
    assert.equal(sha(wav), recipe.output.sha256, `${f}: bit-identical to the accepted master`);
  }
});
