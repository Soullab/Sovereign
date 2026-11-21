// SOULLAB CAPTURE → SOUND STUDIO (J4b-2). A Capture take opened on the Drone
// desk carries its origin into the drone's provenance, as it does in Transform
// (J4b-1), and the member may hand over the take's .provenance.json so the
// file's own claim is compared with the record the helper wrote beside it.
//
// A match means that record names these exact bytes. It does not authenticate
// either file: neither is signed, and anyone can write both. The tests hold the
// reader to saying no more than that.
//
// Real takes come from the Soullab Capture debug helper in synthetic mode, as in
// capture_j4b_take.test.mjs; skipped, and saying so, when it has not been built.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./ts_resolution_loader.mjs', import.meta.url);
const root = path.join(import.meta.dirname, '../..');
const mod = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const take = await mod('lib/listening/transform/captureTake.ts');
const prov = await mod('lib/listening/transform/provenance.ts');
const drone = await mod('lib/listening/drone/drone.ts');
const { createCaptureClient } = await mod('packages/soullab-capture/js/captureClient.mjs');

const SHA = 'ab'.repeat(32);
const origin = () => ({ recorder: 'soullab-capture', takeId: 't1', recovered: false, recordedAt: '2026-11-21 10:00:00', codingHistory: '', markedGaps: 0, asserted: 'by-file' });
const record = (over = {}) => JSON.stringify({ schema: 'soullab.capture.provenance.v1', takeId: 't1', sha256: SHA, recovered: false, ...over });

test('a matching record: sidecar-matched, and the sentence claims a byte match only, not authenticity', () => {
  const o = origin();
  const m = take.checkCaptureSidecar(o, SHA, record());
  assert.equal(m.asserted, 'sidecar-matched');
  assert.deepEqual(m.sidecar.mismatched, []);
  assert.equal(o.asserted, 'by-file', 'the input origin is not changed');
  const says = take.describeCaptureSidecar(m);
  assert.match(says, /exact bytes/);
  assert.match(says, /Neither file is signed/);
  assert.doesNotMatch(says, /\b(verified|authentic|genuine|proves?|proven)\b/i);
  assert.equal(take.checkCaptureSidecar(o, SHA.toUpperCase(), record()).asserted, 'sidecar-matched', 'hex case does not matter');
});

test('each disagreement is named, and any one makes it sidecar-mismatch', () => {
  const cases = [
    [record({ sha256: 'cd'.repeat(32) }), ['sha256']],
    [record({ takeId: 't2' }), ['takeId']],
    [record({ recovered: true }), ['recovered']],
    [record({ recovered: 'no' }), ['recovered']],
    [record({ sha256: 'cd'.repeat(32), takeId: 't2' }), ['sha256', 'takeId']],
  ];
  for (const [text, fields] of cases) {
    const m = take.checkCaptureSidecar(origin(), SHA, text);
    assert.equal(m.asserted, 'sidecar-mismatch', text);
    assert.deepEqual(m.sidecar.mismatched, fields, text);
    assert.match(take.describeCaptureSidecar(m), /does not match/);
  }
});

test('anything that is not a Capture provenance record is refused, and the origin stays by-file', () => {
  for (const text of ['', 'not json', '[]', 'null', JSON.stringify({ schema: 'soullab.transform.provenance.v1', sha256: SHA, takeId: 't1' }),
    JSON.stringify({ schema: 'soullab.capture.provenance.v1', takeId: 't1' }), JSON.stringify({ schema: 'soullab.capture.provenance.v1', sha256: SHA })]) {
    assert.throws(() => take.checkCaptureSidecar(origin(), SHA, text), /not a Soullab Capture provenance file/, text);
  }
  assert.equal(take.describeCaptureSidecar(origin()), '');
});

test('the drone provenance carries the Capture origin inside the source record, and only there', () => {
  const src = (extra = {}) => ({ name: 'take.wav', sha256: SHA, sampleRate: 48000, frames: 10, channels: 2, decodedBy: 'soullab-wav', ...extra });
  const out = { name: 'take (drone).wav', audioSha256: 'e'.repeat(64), sampleRate: 48000, frames: 10, channels: 2 };
  const matched = take.checkCaptureSidecar(origin(), SHA, record());
  const p = drone.buildDroneProvenance({ source: src({ capture: matched }), recipe: {}, output: out, createdAt: 'now' });
  assert.deepEqual(p.source.capture, matched);
  assert.equal(p.schema, drone.DRONE_PROVENANCE_SCHEMA);
  assert.equal(JSON.stringify(p).split('"capture"').length - 1, 1, 'the origin appears once, in source');
  const plain = drone.buildDroneProvenance({ source: src(), recipe: {}, output: out, createdAt: 'now' });
  assert.equal('capture' in plain.source, false);
});

// ── real takes from the Capture helper ────────────────────────────────────
const HELPER = path.join(root, 'packages/soullab-capture/.build/debug/soullab-capture-helper');
const haveHelper = fs.existsSync(HELPER);

async function recordSynthetic({ sampleRate, channels, seconds = 1.2 }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slc-j4b2-'));
  const takes = path.join(dir, 'takes'); fs.mkdirSync(takes);
  const token = crypto.randomBytes(32).toString('hex');
  const tokenFile = path.join(dir, 'token'); fs.writeFileSync(tokenFile, token, { mode: 0o600 });
  const socketPath = path.join(dir, 'c.sock');
  const helper = spawn(HELPER, ['--root', takes, '--socket', socketPath, '--token-file', tokenFile, '--synthetic'], { stdio: 'ignore' });
  try {
    for (let i = 0; i < 100 && !fs.existsSync(socketPath); i++) await new Promise((r) => setTimeout(r, 50));
    let finalized;
    const done = new Promise((resolve) => { finalized = resolve; });
    const client = createCaptureClient({ socketPath, token, onEvent: (e) => { if (e.event === 'finalized') finalized(e); } });
    assert.equal((await client.ready).mode, 'synthetic');
    await client.request('prepare', { sourceId: 'synthetic:sine1k', takeName: `j4b2-${sampleRate}-${channels}`, channels, sampleRate });
    await client.request('start');
    await new Promise((r) => setTimeout(r, seconds * 1000));
    await client.request('stop');
    await Promise.race([done, new Promise((_, no) => setTimeout(() => no(new Error('no finalized event')), 10_000))]);
    client.close();
    return { dir, takes };
  } finally { helper.kill(); }
}

test('a real Capture take and the record its helper wrote: sidecar-matched; one changed byte: sidecar-mismatch on sha256',
  { skip: haveHelper ? false : 'debug Capture helper not built' }, async () => {
    const { dir, takes } = await recordSynthetic({ sampleRate: 48000, channels: 2 });
    try {
      const files = fs.readdirSync(takes);
      const wavName = files.find((f) => f.endsWith('.wav'));
      const provName = files.find((f) => f.endsWith('.provenance.json'));
      assert.ok(wavName && provName, `take files: ${files.join(', ')}`);
      const buf = fs.readFileSync(path.join(takes, wavName));
      const bytes = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
      const text = fs.readFileSync(path.join(takes, provName), 'utf8');

      const o = take.readCaptureOrigin(bytes);
      assert.equal(o.asserted, 'by-file');
      const m = take.checkCaptureSidecar(o, await prov.sha256Hex(bytes), text);
      assert.equal(m.asserted, 'sidecar-matched', JSON.stringify(m.sidecar));

      const tampered = Buffer.from(buf); tampered[tampered.length - 1] ^= 1;
      const tb = tampered.buffer.slice(tampered.byteOffset, tampered.byteOffset + tampered.length);
      const t = take.checkCaptureSidecar(take.readCaptureOrigin(tb), await prov.sha256Hex(tb), text);
      assert.equal(t.asserted, 'sidecar-mismatch');
      assert.deepEqual(t.sidecar.mismatched, ['sha256']);

      // The original take on disk is not changed by any of this.
      assert.equal(await prov.sha256Hex(fs.readFileSync(path.join(takes, wavName))), JSON.parse(text).sha256);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
