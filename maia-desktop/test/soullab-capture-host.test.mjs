// SOULLAB-CAPTURE J4a-1 — the MAIA Desktop host for the Soullab Capture helper.
//
// The host is exercised against a fake helper that speaks control protocol v1
// over a real Unix socket, through the package's own client
// (packages/soullab-capture/js/captureClient.mjs). The real helper and the real
// system-audio tap are witnessed on the founder Mac, not here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const {
  createSoullabCaptureHost, createFolderStore, offerableSources, takeNameFor,
} = require('../src/soullab-capture-host.js');
const CLIENT = path.join(here, '..', '..', 'packages', 'soullab-capture', 'js', 'captureClient.mjs');
const loadClient = () => import(pathToFileURL(CLIENT).href);
const mainJs = fs.readFileSync(path.join(here, '..', 'src', 'main.js'), 'utf8');
const hostJs = fs.readFileSync(path.join(here, '..', 'src', 'soullab-capture-host.js'), 'utf8');

const SOURCES = [
  { id: 'pid:20840', name: 'QuickTime Player', bundleID: 'com.apple.QuickTimePlayerX', pid: 20840, producingOutput: true },
  { id: 'pid:300', name: 'Music', bundleID: 'com.apple.Music', pid: 300, producingOutput: false },
  { id: 'pid:438', name: 'coreaudiod', bundleID: 'com.apple.audio.coreaudiod', pid: 438, producingOutput: true },
  { id: 'pid:9', name: '', bundleID: 'x.y', pid: 9, producingOutput: true },
];

const takeOf = (file, frames, hex, stopReason) => ({
  path: file, provenancePath: file.replace(/\.wav$/, '.provenance.json'), sha256: hex.repeat(64),
  frames, sampleRate: 44100, channels: 2, bitsPerSample: 24, stopReason, recovered: false,
});

/** A fake helper: one connection, token-checked, protocol v1. */
function fakeHelperFactory(behaviour = {}) {
  const launches = [];
  const servers = [];
  const sockets = [];
  const launch = async (helperApp, args) => {
    const opt = (k) => args[args.indexOf(k) + 1];
    const socketPath = opt('--socket');
    const token = fs.readFileSync(opt('--token-file'), 'utf8');
    const record = { helperApp, args, requests: [], tokenMode: fs.statSync(opt('--token-file')).mode & 0o777,
      dirMode: fs.statSync(path.dirname(socketPath)).mode & 0o777, closed: false };
    launches.push(record);
    const server = net.createServer((sock) => {
      sockets.push(sock);
      let buf = '';
      const send = (m) => sock.write(`${JSON.stringify(m)}\n`);
      record.emit = send;
      sock.on('data', (chunk) => {
        buf += chunk;
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const msg = JSON.parse(buf.slice(0, i));
          buf = buf.slice(i + 1);
          record.requests.push(msg);
          const reply = (result) => send({ id: msg.id, ok: true, result });
          const error = (code) => send({ id: msg.id, ok: false, error: { code } });
          switch (msg.type) {
            case 'hello':
              if (msg.token !== token) { error('AUTH_FAILED'); sock.destroy(); return; }
              reply({ protocol: 1, version: '0.1.0', build: 'release', mode: 'processTap' });
              break;
            case 'listSources': reply({ sources: SOURCES }); break;
            case 'prepare':
              if (behaviour.nameExists && behaviour.nameExists-- > 0) { error('NAME_EXISTS'); break; }
              send({ event: 'state', state: 'prepared', generation: 0 });
              reply({});
              break;
            case 'start':
              send({ event: 'state', state: 'starting', generation: 1 });
              reply({});
              if (behaviour.violateAfterStart) { sock.write('not json\n'); break; }
              send({ event: 'state', state: 'recording', generation: 1 });
              send({ event: 'meter', seconds: 1.5, peak: [0.1, 0.1], truePeak: [0.1, 0.1], rms: [0.05, 0.05], clipSamples: 0 });
              break;
            case 'stop': {
              const take = takeOf(`${opt('--root')}/take.wav`, 44100 * 3, 'a', 'memberStop');
              send({ event: 'state', state: 'finalizing', generation: 1 });
              send({ event: 'finalized', take });
              reply({ take });
              break;
            }
            case 'shutdown': reply({}); sock.end(); record.closed = true; break;
            default: error('INVALID_REQUEST');
          }
        }
      });
    });
    servers.push(server);
    await new Promise((r) => server.listen(socketPath, r));
  };
  return { launch, launches, closeAll: () => { sockets.forEach((k) => k.destroy()); servers.forEach((k) => k.close()); } };
}

function setup(behaviour) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'slcap-folder-'));
  const fake = fakeHelperFactory(behaviour);
  const killed = [];
  const changes = [];
  const host = createSoullabCaptureHost({
    helperApp: '/Applications/MAIA Desktop.app/Contents/Helpers/Soullab Capture.app',
    loadClient,
    getFolder: () => folder,
    launch: fake.launch,
    findPids: async () => [4242],
    kill: (pid, sig) => killed.push([pid, sig]),
    now: () => new Date(2026, 10, 17, 17, 45, 12),
    onChange: (s) => changes.push(s.phase),
  });
  return { host, fake, folder, killed, changes };
}

const settle = (ms = 30) => new Promise((r) => setTimeout(r, ms));

test('listing apps offers named apps only, never system audio daemons, and lets the helper go', async () => {
  const { host, fake } = setup();
  const sources = await host.listSources();
  assert.deepEqual(sources.map((s) => s.name), ['QuickTime Player', 'Music']);
  assert.equal(fake.launches.length, 1);
  assert.ok(fake.launches[0].requests.some((r) => r.type === 'shutdown'), 'the listing helper was not shut down');
  assert.equal(host.snapshot().phase, 'idle');
  fake.closeAll();
});

test('a take launches one helper with only the folder, a private socket and a 0600 token', async () => {
  const { host, fake, folder } = setup();
  await host.start('pid:20840');
  await settle();
  const l = fake.launches[0];
  assert.equal(l.helperApp.endsWith('Contents/Helpers/Soullab Capture.app'), true);
  assert.deepEqual(l.args.filter((a) => a.startsWith('--')), ['--root', '--socket', '--token-file']);
  assert.equal(l.args[l.args.indexOf('--root') + 1], folder);
  assert.equal(l.tokenMode, 0o600);
  assert.equal(l.dirMode, 0o700);
  const prepare = l.requests.find((r) => r.type === 'prepare');
  assert.deepEqual({ ...prepare, id: 0 }, { id: 0, type: 'prepare', sourceId: 'pid:20840', takeName: 'Soullab Capture 2026-11-17 17.45.12', channels: 2 });
  assert.equal(host.snapshot().phase, 'recording');
  assert.equal(host.snapshot().source.name, 'QuickTime Player');
  await host.stop();
  fake.closeAll();
});

test('member Stop finalizes, reports only the file NAME, removes the socket directory and frees the helper', async () => {
  const { host, fake } = setup();
  await host.start('pid:20840');
  await settle();
  const dir = path.dirname(fake.launches[0].args[fake.launches[0].args.indexOf('--socket') + 1]);
  const snap = await host.stop();
  assert.equal(snap.phase, 'idle');
  assert.deepEqual(snap.lastTake, {
    fileName: 'take.wav', seconds: 3, sampleRate: 44100, empty: false, silent: false, appName: 'QuickTime Player',
    gaps: 0, stopReason: 'memberStop', sha256: 'a'.repeat(64),
  });
  assert.equal(host.lastTakeFile().endsWith('/take.wav'), true, 'main cannot reveal the take');
  assert.ok(!JSON.stringify(snap).includes('/'), 'a location leaked into the snapshot');
  assert.equal(fs.existsSync(dir), false, 'socket directory left behind');
  assert.ok(fake.launches[0].requests.some((r) => r.type === 'shutdown'));
  fake.closeAll();
});

test('a take the helper ends by itself (source quit) closes the helper and NOTHING restarts', async () => {
  const { host, fake } = setup();
  await host.start('pid:20840');
  await settle();
  fake.launches[0].emit({ event: 'finalized', take: takeOf('/x/quit.wav', 44100, 'b', 'sourceExited') });
  await settle(80);
  assert.equal(host.snapshot().phase, 'idle');
  assert.equal(host.snapshot().lastTake.stopReason, 'sourceExited');
  assert.equal(fake.launches.length, 1, 'a helper was relaunched without a member action');
  fake.closeAll();
});

test('an existing take name is never overwritten: the host asks again with a new name', async () => {
  const { host, fake } = setup({ nameExists: 1 });
  await host.start('pid:20840');
  const names = fake.launches[0].requests.filter((r) => r.type === 'prepare').map((r) => r.takeName);
  assert.deepEqual(names, ['Soullab Capture 2026-11-17 17.45.12', 'Soullab Capture 2026-11-17 17.45.12 (2)']);
  await host.stop();
  fake.closeAll();
});

test('a protocol violation terminates the helper and is reported, never retried', async () => {
  const { host, fake, killed } = setup({ violateAfterStart: true });
  await host.start('pid:20840').catch(() => {});
  await settle(80);
  assert.deepEqual(killed, [[4242, 'SIGTERM']]);
  assert.equal(host.snapshot().phase, 'idle');
  assert.equal(host.snapshot().error, 'PROTOCOL_VIOLATION');
  assert.equal(fake.launches.length, 1);
  fake.closeAll();
});

test('start is refused without a folder, with a malformed source, or while busy', async () => {
  const noFolder = createSoullabCaptureHost({ helperApp: '/x', loadClient, getFolder: () => null, launch: async () => { throw new Error('launched'); } });
  await assert.rejects(noFolder.start('pid:1'), { code: 'NO_FOLDER' });
  for (const bad of ['1', 'pid:', 'pid:1;rm', '../pid:1', 'pid:12345678901', 7, null]) {
    await assert.rejects(noFolder.start(bad), { code: 'INVALID_SOURCE' });
  }
  const { host, fake } = setup();
  await host.start('pid:20840');
  await assert.rejects(host.start('pid:20840'), { code: 'BUSY' });
  await assert.rejects(host.listSources(), { code: 'BUSY' });
  await host.stop();
  fake.closeAll();
});

test('app quit finalizes a take in progress and leaves no helper behind', async () => {
  const { host, fake, killed } = setup();
  await host.start('pid:20840');
  await settle();
  await host.shutdown({ timeoutMs: 2000 });
  assert.equal(host.snapshot().phase, 'idle');
  assert.equal(host.snapshot().lastTake.stopReason, 'memberStop');
  assert.deepEqual(killed, [[4242, 'SIGTERM']], 'leftover helper was not terminated');
  fake.closeAll();
});

test('the remembered folder must still exist and be writable; otherwise it reads as not chosen', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slcap-store-'));
  const file = path.join(dir, 'cfg', 'soullab-capture.json');
  const store = createFolderStore({ file });
  assert.equal(store.get(), null);
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'slcap-takes-'));
  assert.equal(store.set(folder), folder);
  assert.equal(store.get(), folder);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  fs.rmSync(folder, { recursive: true });
  assert.equal(store.get(), null, 'a vanished folder is still offered');
  assert.throws(() => store.set('relative/folder'), /FOLDER_INVALID/);
});

test('take names are timestamps the helper accepts (no separators, no colon)', () => {
  const name = takeNameFor(new Date(2026, 0, 2, 3, 4, 5), 3);
  assert.equal(name, 'Soullab Capture 2026-01-02 03.04.05 (4)');
  assert.ok(!/[/:\\]/.test(name));
});

test('offerableSources sorts playing apps first and drops malformed entries', () => {
  const out = offerableSources([...SOURCES, { id: 'bad', name: 'Evil' }, null]);
  assert.deepEqual(out, [
    { id: 'pid:20840', name: 'QuickTime Player', producingOutput: true },
    { id: 'pid:300', name: 'Music', producingOutput: false },
  ]);
});

test('structure: nothing starts a take except a member action in the Capture window', () => {
  const starts = [...mainJs.matchAll(/soullabCapture\.start\(/g)].length;
  assert.equal(starts, 1, 'a new caller of start() appeared');
  const ipc = /ipcMain\.handle\('maia:soullab-capture-start'[\s\S]*?\n\}\);/.exec(mainJs)[0];
  assert.ok(ipc.includes('soullabCapture.start(') && /slice\(0, 32\)/.test(ipc) && /SOURCE_ID\.test/.test(ipc));
  const menu = /function soullabCaptureMenu\(\)[\s\S]*?\n\}\n/.exec(mainJs)[0];
  assert.ok(!menu.includes('.start('), 'the menu can start a recording');
  assert.ok(menu.includes("accelerator: 'Alt+CmdOrCtrl+R'") && menu.includes('openCaptureWindow()'));
  for (const banned of ['setInterval', 'resume', 'autoStart', 'retry']) {
    assert.ok(!hostJs.replace(/\/\/.*$/gm, '').includes(banned), `host contains ${banned}`);
  }
  assert.ok(!/require\(['"]electron['"]\)/.test(hostJs), 'the host imports Electron');
});

test('structure: the packaged helper path is fixed; no environment variable can redirect it', () => {
  const fn = /function soullabCaptureHelperApp\(\)[\s\S]*?\n\}\n/.exec(mainJs)[0];
  assert.ok(!fn.includes('process.env'), 'helper location is environment-controlled');
  assert.ok(fn.includes("path.join(process.resourcesPath, '..', 'Helpers', SOULLAB_CAPTURE_APP_NAME)"));
});

test('structure: packaging keeps the helper off electron-builder signing and the verifier re-checks it', () => {
  const build = fs.readFileSync(path.join(here, '..', 'scripts', 'build.mjs'), 'utf8');
  const verify = fs.readFileSync(path.join(here, '..', 'scripts', 'verify-package.mjs'), 'utf8');
  const helper = fs.readFileSync(path.join(here, '..', 'scripts', 'build-capture-helper.mjs'), 'utf8');
  assert.ok(build.includes("signIgnore: [...(stagedPackage.build.mac.signIgnore || []), 'Contents/Helpers/Soullab Capture\\\\.app']"),
    'electron-builder would re-sign the helper with entitlementsInherit');
  assert.ok(build.includes('to: `Helpers/${CAPTURE_APP_NAME}`'));
  assert.ok(/assertCaptureHelper\(captureHelper\)/.test(verify), 'the finished app is not re-checked');
  assert.ok(helper.includes("path.join(CAPTURE_PACKAGE, 'HelperBundle', 'Helper.entitlements')"));
  const entitlements = fs.readFileSync(path.join(here, '..', '..', 'packages', 'soullab-capture', 'HelperBundle', 'Helper.entitlements'), 'utf8');
  assert.ok(/<dict\/>/.test(entitlements) && !/<key>/.test(entitlements.replace(/<!--[\s\S]*?-->/g, '')), 'helper entitlements are not empty');
});

test('the app list uses names members know and hides background services', () => {
  const raw = [
    { id: 'pid:1', name: 'Google Chrome', bundleID: 'com.google.Chrome', producingOutput: false },
    { id: 'pid:2', name: 'Google Chrome Helper (Aperitif)', bundleID: 'com.google.Chrome.helper', producingOutput: true },
    { id: 'pid:3', name: 'arkaudiod', bundleID: 'com.rogueamoeba.arkaudiod', producingOutput: true },
    { id: 'pid:4', name: 'corespeechd', bundleID: 'com.apple.CoreSpeech', producingOutput: false },
    { id: 'pid:5', name: 'com.apple.WebKit.GPU', bundleID: 'com.apple.WebKit.GPU', producingOutput: false },
    { id: 'pid:6', name: 'Claude Helper', bundleID: 'com.anthropic.claudefordesktop.helper', producingOutput: false },
    { id: 'pid:7', name: 'Claude', bundleID: 'com.anthropic.claudefordesktop', producingOutput: false },
    { id: 'pid:8', name: '', bundleID: '', producingOutput: true },
    { id: 'pid:9', name: 'ControlCenter', bundleID: 'com.apple.controlcenter', producingOutput: false },
  ];
  assert.deepEqual(offerableSources(raw), [
    { id: 'pid:2', name: 'Google Chrome', producingOutput: true },
    { id: 'pid:6', name: 'Claude', producingOutput: false },
    { id: 'pid:5', name: 'Safari and web pages', producingOutput: false },
  ]);
});
