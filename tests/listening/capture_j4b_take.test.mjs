// SOULLAB CAPTURE → SOUND STUDIO (J4b-1). A Capture take opened in Transform
// keeps its own rate and samples, and its origin travels into the derived
// take's provenance as the file's own claim.
//
// Two kinds of evidence:
//   1. Hand-built WAVs for the edge cases (not a Capture take, recovered take,
//      marked gaps, hostile bytes).
//   2. REAL takes written by the Soullab Capture debug helper in synthetic mode
//      (packages/soullab-capture/.build/debug/soullab-capture-helper), at 44.1
//      and 48 kHz, stereo and mono. This is the helper's own writer, not a copy
//      of its layout. It is skipped, and says so, when the debug helper has not
//      been built (`swift build --product soullab-capture-helper`).
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
const wav = await mod('lib/listening/transform/wav.ts');
const take = await mod('lib/listening/transform/captureTake.ts');
const prov = await mod('lib/listening/transform/provenance.ts');
const audio = await mod('lib/listening/transform/audio.ts');
const { createCaptureClient } = await mod('packages/soullab-capture/js/captureClient.mjs');

// ── hand-built ────────────────────────────────────────────────────────────
function bextChunk({ description = '', originator = '', date = '', time = '', history = '' }) {
  const hist = Buffer.from(history, 'latin1');
  const size = 602 + hist.length + (hist.length & 1);
  const b = Buffer.alloc(8 + size);
  b.write('bext'); b.writeUInt32LE(size, 4);
  b.write(description, 8, 256, 'latin1');
  b.write(originator, 8 + 256, 32, 'latin1');
  b.write(date, 8 + 320, 10, 'latin1');
  b.write(time, 8 + 330, 8, 'latin1');
  hist.copy(b, 8 + 602);
  return b;
}
function cueChunk(n) {
  const b = Buffer.alloc(8 + 4 + 24 * n);
  b.write('cue '); b.writeUInt32LE(4 + 24 * n, 4); b.writeUInt32LE(n, 8);
  return b;
}
function wavWith(extra = [], after = []) {
  const plain = Buffer.from(wav.writeWav24({ sampleRate: 48000, channels: [new Float32Array(480), new Float32Array(480)] }));
  const body = Buffer.concat([plain.subarray(12, 36), ...extra, plain.subarray(36), ...after]);
  const head = Buffer.alloc(12); head.write('RIFF'); head.writeUInt32LE(4 + body.length, 4); head.write('WAVE', 8);
  const out = Buffer.concat([head, body]);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.length);
}

test('a plain WAV, or a BWF from another recorder, is not called a Capture take', () => {
  assert.equal(take.readCaptureOrigin(wavWith()), null);
  assert.equal(take.readCaptureOrigin(wavWith([bextChunk({ description: 'Soullab Capture take x', originator: 'Pro Tools' })])), null);
  assert.equal(take.readCaptureOrigin(wavWith([bextChunk({ description: 'My field recording', originator: 'Soullab Capture' })])), null);
  assert.equal(take.readCaptureOrigin(wavWith([bextChunk({ description: 'Soullab Capture take ', originator: 'Soullab Capture' })])), null, 'no take id');
  assert.equal(take.readCaptureOrigin(new ArrayBuffer(4)), null);
});

test('a Capture take: id, time, coding history, recovered and marked gaps, labelled as the file\'s own claim', () => {
  const o = take.readCaptureOrigin(wavWith(
    [bextChunk({ description: 'Soullab Capture take 2026-11-17T17-57-47Z-ab12 [recovered]', originator: 'Soullab Capture',
      date: '2026-11-17', time: '17:57:47', history: 'A=PCM,F=44100,W=24,M=stereo,T=Soullab Capture 0.1.0; no dither; source=processTap\r\n' })],
    [cueChunk(2)]));
  assert.deepEqual(o, {
    recorder: 'soullab-capture', takeId: '2026-11-17T17-57-47Z-ab12', recovered: true, recordedAt: '2026-11-17 17:57:47',
    codingHistory: 'A=PCM,F=44100,W=24,M=stereo,T=Soullab Capture 0.1.0; no dither; source=processTap', markedGaps: 2, asserted: 'by-file',
  });
  assert.equal(take.describeCaptureOrigin(o), 'A Soullab Capture take, recorded on 2026-11-17 17:57 (recovered after an interruption) · 2 gaps marked by Capture.');
});

test('hostile bytes in the bext text are dropped, not carried into provenance', () => {
  const o = take.readCaptureOrigin(wavWith([bextChunk({
    description: 'Soullab Capture take abc\u0007<script>', originator: 'Soullab Capture', date: 'not-a-date', time: '99',
    history: 'x'.repeat(5000),
  })]));
  assert.equal(o.takeId, 'abc<script>', 'control bytes dropped; text stays inert data (rendered by React as text)');
  assert.equal(o.recordedAt, '', 'a malformed date is left out, not guessed');
  assert.ok(o.codingHistory.length <= 512);
});

test('provenance carries the Capture origin inside the source record, and only there', () => {
  const origin = { recorder: 'soullab-capture', takeId: 't1', recovered: false, recordedAt: '', codingHistory: '', markedGaps: 0, asserted: 'by-file' };
  const p = prov.buildProvenance({
    source: { name: 'a.wav', sha256: 'f'.repeat(64), sampleRate: 44100, frames: 10, channels: 2, decodedBy: 'soullab-wav', capture: origin },
    steps: [], output: { name: 'b.wav', audioSha256: 'e'.repeat(64), sampleRate: 44100, frames: 10, channels: 2 }, createdAt: 'now',
  });
  assert.deepEqual(p.source.capture, origin);
  assert.equal(p.schema, 'soullab.transform.provenance.v1');
  const plain = prov.buildProvenance({
    source: { name: 'a.wav', sha256: 'f'.repeat(64), sampleRate: 48000, frames: 10, channels: 2, decodedBy: 'soullab-wav' },
    steps: [], output: { name: 'b.wav', audioSha256: 'e'.repeat(64), sampleRate: 48000, frames: 10, channels: 2 }, createdAt: 'now',
  });
  assert.equal('capture' in plain.source, false);
});

// ── real takes from the Capture helper ────────────────────────────────────
const HELPER = path.join(root, 'packages/soullab-capture/.build/debug/soullab-capture-helper');
const haveHelper = fs.existsSync(HELPER);
const cleanups = [];
test.after(() => { for (const c of cleanups) c(); });

async function recordSynthetic({ sampleRate, channels, seconds = 1.2 }) {
  // The control socket stays in a short temp path (AF_UNIX limit). The takes go where
  // SLC_J4B_TAKES_ROOT says when set (the helper refuses a volume that is nearly full).
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slc-j4b-'));
  const takesParent = process.env.SLC_J4B_TAKES_ROOT ? fs.mkdtempSync(path.join(process.env.SLC_J4B_TAKES_ROOT, 'slc-j4b-')) : dir;
  const takes = path.join(takesParent, 'takes'); fs.mkdirSync(takes);
  cleanups.push(() => { if (takesParent !== dir) fs.rmSync(takesParent, { recursive: true, force: true }); });
  const token = crypto.randomBytes(32).toString('hex');
  const tokenFile = path.join(dir, 'token'); fs.writeFileSync(tokenFile, token, { mode: 0o600 });
  const socketPath = path.join(dir, 'c.sock');
  const helper = spawn(HELPER, ['--root', takes, '--socket', socketPath, '--token-file', tokenFile, '--synthetic'], { stdio: 'ignore' });
  try {
    for (let i = 0; i < 100 && !fs.existsSync(socketPath); i++) await new Promise((r) => setTimeout(r, 50));
    let finalized;
    const done = new Promise((resolve) => { finalized = resolve; });
    const client = createCaptureClient({ socketPath, token, onEvent: (e) => { if (e.event === 'finalized') finalized(e); } });
    const hello = await client.ready;
    assert.equal(hello.mode, 'synthetic');
    await client.request('prepare', { sourceId: 'synthetic:sine1k', takeName: `j4b-${sampleRate}-${channels}`, channels, sampleRate });
    await client.request('start');
    await new Promise((r) => setTimeout(r, seconds * 1000));
    await client.request('stop');
    const event = await Promise.race([done, new Promise((_, no) => setTimeout(() => no(new Error('no finalized event')), 10_000))]);
    client.close();
    return { dir, takes, event };
  } finally { helper.kill(); }
}

for (const [sampleRate, channels] of [[44100, 2], [48000, 2], [48000, 1]]) {
  test(`a real Capture take at ${sampleRate / 1000} kHz ${channels === 2 ? 'stereo' : 'mono'} opens at its own rate, with its origin`,
    { skip: haveHelper ? false : 'debug Capture helper not built' }, async () => {
      const { dir, takes, event } = await recordSynthetic({ sampleRate, channels });
      try {
        const files = fs.readdirSync(takes);
        const wavName = files.find((f) => f.endsWith('.wav'));
        const provName = files.find((f) => f.endsWith('.provenance.json'));
        assert.ok(wavName && provName, `take files: ${files.join(', ')} (event ${JSON.stringify(event).slice(0, 200)})`);
        const fileBytes = fs.readFileSync(path.join(takes, wavName));
        const bytes = fileBytes.buffer.slice(fileBytes.byteOffset, fileBytes.byteOffset + fileBytes.length);
        const record = JSON.parse(fs.readFileSync(path.join(takes, provName), 'utf8'));

        // Transform's reader: the take's own rate, layout and length. No resampling.
        const a = wav.readWav(bytes);
        assert.equal(a.sampleRate, sampleRate);
        assert.equal(a.channels.length, channels);
        assert.equal(audio.frameCount(a), record.frames);
        assert.ok(audio.peak(a) > 0.01, 'the synthetic tone is in the samples');

        // The origin the file claims matches what the helper recorded beside it.
        const o = take.readCaptureOrigin(bytes);
        assert.equal(o.takeId, record.takeId);
        assert.equal(o.recovered, record.recovered);
        assert.equal(o.markedGaps, record.discontinuities.length);
        assert.match(o.codingHistory, new RegExp(`^A=PCM,F=${sampleRate},W=24,M=${channels === 2 ? 'stereo' : 'mono'},T=Soullab Capture `));
        assert.match(o.recordedAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

        // The anchor that reconciles the derived take with the take's provenance.json.
        assert.equal(await prov.sha256Hex(bytes), record.sha256);

        // A trim saves at the same rate and depth; the original is not touched.
        const trimmed = audio.trim(a, 0.1, 0.6);
        const out = wav.readWav(wav.writeWav24(trimmed));
        assert.equal(out.sampleRate, sampleRate);
        assert.equal(await prov.sha256Hex(fs.readFileSync(path.join(takes, wavName))), record.sha256);
      } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    });
}
