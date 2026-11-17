// Contract tests for the host-side client, against the DEBUG helper in synthetic mode
// (no OS capture, no permission prompt) and against fake misbehaving helpers.
//
// Run after `swift build`:  node --test js/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCaptureClient, MAX_MESSAGE_BYTES } from './captureClient.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const HELPER = process.env.SOULLAB_CAPTURE_HELPER ?? path.resolve(here, '../.build/debug/soullab-capture-helper');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(predicate, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return;
    await sleep(20);
  }
  throw new Error('timed out');
}

function privateDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slc-'));
  fs.chmodSync(dir, 0o700);
  return dir;
}

async function launchHelper() {
  const dir = privateDir();
  const root = path.join(dir, 'takes');
  fs.mkdirSync(root);
  const token = crypto.randomBytes(32).toString('hex');
  const tokenFile = path.join(dir, 'token');
  fs.writeFileSync(tokenFile, token, { mode: 0o600 });
  const socketPath = path.join(dir, 'c.sock');
  const child = spawn(HELPER, ['--root', root, '--socket', socketPath, '--token-file', tokenFile, '--synthetic'], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const exited = new Promise((resolve) => child.on('exit', (code) => resolve(code)));
  await waitFor(() => fs.existsSync(socketPath));
  return { dir, root, token, socketPath, child, exited };
}

function connect(h, extra = {}) {
  const events = [];
  const client = createCaptureClient({
    socketPath: h.socketPath, token: extra.token ?? h.token, onEvent: (e) => events.push(e), ...extra,
  });
  return { client, events };
}

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

test('records a synthetic take end to end and the reported hash matches the file', async () => {
  const h = await launchHelper();
  const { client, events } = connect(h);
  const hello = await client.ready;
  assert.equal(hello.protocol, 1);
  assert.equal(hello.build, 'debug');
  assert.equal(hello.mode, 'synthetic');
  assert.equal(hello.orphansRemoved, 0);

  const { sources } = await client.request('listSources');
  assert.ok(sources.some((s) => s.id === 'synthetic:sine1k'));

  await client.request('prepare', {
    sourceId: 'synthetic:sine1k', channels: 2, sampleRate: 48000, takeName: 'js-take',
    member: { performer: 'Test performer', rightsNote: 'synthetic test signal' },
  });
  await client.request('start');
  await waitFor(() => events.some((e) => e.event === 'state' && e.state === 'recording'));
  await sleep(500);
  const meters = events.filter((e) => e.event === 'meter');
  assert.ok(meters.length >= 1, 'meter events arrive while recording');
  assert.ok(meters.at(-1).peak.every((p) => p > 0.45 && p < 0.55), 'sine peak is about 0.5');

  const { take } = await client.request('stop');
  assert.equal(take.bitsPerSample, 24);
  assert.equal(take.channels, 2);
  assert.equal(take.sampleRate, 48000);
  assert.equal(take.stopReason, 'memberStop');
  assert.ok(take.frames > 48000 * 0.3);
  assert.equal(take.sha256, sha256(take.path));

  const provenance = JSON.parse(fs.readFileSync(take.provenancePath, 'utf8'));
  assert.equal(provenance.schema, 'soullab.capture.provenance.v1');
  assert.equal(provenance.sha256, take.sha256);
  assert.equal(provenance.rights.soullabClaim, 'none');
  assert.equal(provenance.rights.attestation, 'member-asserted');
  assert.equal(provenance.upstreamConversion, 'unknown');
  assert.equal(provenance.member.performer, 'Test performer');
  assert.ok(!fs.existsSync(path.join(h.root, 'js-take.journal.json')), 'journal removed after finalize');
  assert.ok(events.some((e) => e.event === 'finalized'));

  // No auto-resume: the session stays idle.
  await sleep(300);
  const status = await client.request('status');
  assert.equal(status.state, 'idle');

  await client.request('shutdown');
  assert.equal(await h.exited, 0);
});

test('wrong token is refused and the helper exits with code 2', async () => {
  const h = await launchHelper();
  const { client } = connect(h, { token: 'x'.repeat(64) });
  await assert.rejects(client.ready, /AUTH_FAILED|closed/);
  assert.equal(await h.exited, 2);
});

test('invalid and duplicate take names are refused', async () => {
  const h = await launchHelper();
  const { client } = connect(h);
  await client.ready;
  for (const takeName of ['../escape', '.hidden', 'a/b', 'x'.repeat(129), '']) {
    await assert.rejects(client.request('prepare', { sourceId: 'synthetic:silence', takeName }), { code: 'INVALID_NAME' });
  }
  fs.writeFileSync(path.join(h.root, 'taken.wav'), 'existing');
  await assert.rejects(client.request('prepare', { sourceId: 'synthetic:silence', takeName: 'taken' }), { code: 'NAME_EXISTS' });
  await assert.rejects(client.request('start'), { code: 'INVALID_STATE' });
  await client.request('shutdown');
  assert.equal(await h.exited, 0);
});

test('a host disconnect during recording finalizes the take', async () => {
  const h = await launchHelper();
  const { client, events } = connect(h);
  await client.ready;
  await client.request('prepare', { sourceId: 'synthetic:ramp', channels: 1, sampleRate: 44100, takeName: 'cut' });
  await client.request('start');
  await waitFor(() => events.some((e) => e.event === 'state' && e.state === 'recording'));
  await sleep(300);
  client.close();
  assert.equal(await h.exited, 0);
  const provenance = JSON.parse(fs.readFileSync(path.join(h.root, 'cut.provenance.json'), 'utf8'));
  assert.equal(provenance.stopReason, 'clientDisconnected');
  assert.equal(provenance.sha256, sha256(path.join(h.root, 'cut.wav')));
});

// --- Misbehaving helpers: the client must flag a violation (the supervisor then kills it).

async function fakeHelper(behaviour) {
  const dir = privateDir();
  const socketPath = path.join(dir, 'f.sock');
  const server = net.createServer((socket) => {
    socket.setEncoding('utf8');
    let buf = '';
    socket.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const msg = JSON.parse(buf.slice(0, i));
        buf = buf.slice(i + 1);
        behaviour(socket, msg);
      }
    });
  });
  await new Promise((r) => server.listen(socketPath, r));
  return { socketPath, close: () => server.close() };
}

async function expectViolation(behaviour, pattern, options = {}) {
  const fake = await fakeHelper(behaviour);
  let reason = null;
  const client = createCaptureClient({
    socketPath: fake.socketPath, token: 't'.repeat(64), onViolation: (r) => { reason = r; }, ...options,
  });
  await client.ready.then(() => client.request('status')).catch(() => {});
  await waitFor(() => reason !== null);
  assert.match(reason, pattern);
  assert.equal(client.violated, true);
  fake.close();
}

const helloOK = (socket, msg) => socket.write(`${JSON.stringify({ id: msg.id, ok: true, result: { protocol: 1 } })}\n`);

test('protocol version drift is a violation', async () => {
  await expectViolation((s, m) => s.write(`${JSON.stringify({ id: m.id, ok: true, result: { protocol: 2 } })}\n`), /version/);
});

test('an unknown event is a violation', async () => {
  await expectViolation((s, m) => {
    if (m.type === 'hello') { helloOK(s, m); s.write('{"event":"surprise"}\n'); }
  }, /unknown event/);
});

test('an oversize message is a violation', async () => {
  await expectViolation((s, m) => {
    if (m.type === 'hello') { helloOK(s, m); s.write('x'.repeat(MAX_MESSAGE_BYTES + 10)); }
  }, /oversize/);
});

test('malformed JSON is a violation', async () => {
  await expectViolation((s, m) => { if (m.type === 'hello') { helloOK(s, m); s.write('{nope\n'); } }, /malformed/);
});

test('an error code outside the closed set is a violation', async () => {
  await expectViolation((s, m) => {
    if (m.type === 'hello') helloOK(s, m);
    else s.write(`${JSON.stringify({ id: m.id, ok: false, error: { code: 'SOMETHING_NEW' } })}\n`);
  }, /unknown error code/);
});

test('a request that gets no answer times out as a violation', async () => {
  await expectViolation((s, m) => { if (m.type === 'hello') helloOK(s, m); }, /timeout/, { requestTimeoutMs: 200 });
});

test('a finalized event with a malformed take is a violation', async () => {
  await expectViolation((s, m) => {
    if (m.type === 'hello') { helloOK(s, m); s.write('{"event":"finalized","take":{"path":"x"}}\n'); }
  }, /finalized/);
});
