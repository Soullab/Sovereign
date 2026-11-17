// SOULLAB-CAPTURE J4a-2 — the Capture window: its own bridge, its own
// channels, and every sentence it shows a member.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  CAPTURE_INVOKE_CHANNEL_NAMES, CAPTURE_PUSH_CHANNEL_NAMES, RATIFIED_CAPTURE_INVOKE_CHANNELS,
} from './d01-preload-allowlist.mjs';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(path.join(here, '..', 'src', f), 'utf8');
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|[^:'"`])\/\/.*$/, '$1')).join('\n');
const capturePreload = strip(src('capture-preload.js'));
const mainPreload = strip(src('preload.js'));
const mainJs = strip(src('main.js'));
const View = require('../src/capture-view.js');

test('the Capture preload exposes exactly the ratified Capture channels, under its own name', () => {
  const invoked = [...capturePreload.matchAll(/ipcRenderer\.invoke\('([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(invoked, CAPTURE_INVOKE_CHANNEL_NAMES);
  const pushed = [...capturePreload.matchAll(/ipcRenderer\.on\('([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(pushed, CAPTURE_PUSH_CHANNEL_NAMES);
  assert.ok(capturePreload.includes("exposeInMainWorld('soullabCapture'"));
  assert.equal([...capturePreload.matchAll(/exposeInMainWorld\(/g)].length, 1);
  for (const c of RATIFIED_CAPTURE_INVOKE_CHANNELS) assert.ok(c.purpose.length > 40 && c.ratified_in);
});

test('the Capture bridge carries no location, socket, token, device, Node or general IPC', () => {
  const exposed = capturePreload.slice(capturePreload.indexOf('exposeInMainWorld'));
  for (const banned of ['path', 'url', 'token', 'socket', 'deviceId', 'require(', 'process.', 'ipcRenderer.send(', 'fs.', 'shell.']) {
    assert.ok(!exposed.includes(banned), `the Capture bridge exposes ${banned}`);
  }
  const args = [...exposed.matchAll(/^\s*\w+:\s*\(([^)]*)\)\s*=>\s*ipcRenderer\.invoke/gm)].map((m) => m[1].trim()).filter(Boolean);
  assert.deepEqual(args, ['sourceId'], 'the renderer may supply exactly one value: a source id');
});

test('the conversation window no longer holds any capture authority', () => {
  assert.ok(!/soullab-capture/.test(mainPreload), 'preload.js still exposes a Soullab Capture channel');
});

test('every Capture channel answers the Capture window and nobody else', () => {
  for (const ch of CAPTURE_INVOKE_CHANNEL_NAMES) {
    const h = new RegExp(`ipcMain\\.handle\\('${ch}'[\\s\\S]*?\\n\\}\\);`).exec(mainJs);
    assert.ok(h, `${ch} is not handled`);
    assert.ok(/if \(!fromCaptureWindow\(evt\)\) return NOT_THIS_WINDOW;/.test(h[0]), `${ch} does not check its caller`);
  }
  const check = /function fromCaptureWindow\(evt\)[\s\S]*?\n\}/.exec(mainJs)[0];
  assert.ok(check.includes('evt.sender === captureWindow.webContents'));
});

test('Capture state goes to the Capture window alone, never broadcast', () => {
  assert.ok(!/broadcast\('maia:soullab-capture/.test(mainJs), 'capture state is broadcast to every window');
  const push = /function pushSoullabCaptureState\(\)[\s\S]*?\n\}/.exec(mainJs)[0];
  assert.ok(push.includes("captureWindow.webContents.send('maia:soullab-capture-state-changed'"));
});

test('the Capture window is sandboxed, isolated, never navigates and opens nothing', () => {
  const fn = /function openCaptureWindow\(\)[\s\S]*?\n\}/.exec(mainJs)[0];
  for (const needed of ['contextIsolation: true', 'nodeIntegration: false', 'sandbox: true',
    "preload: path.join(__dirname, 'capture-preload.js')", "loadFile(path.join(__dirname, 'capture.html'))",
    "on('will-navigate', (event) => event.preventDefault())", "setWindowOpenHandler(() => ({ action: 'deny' }))"]) {
    assert.ok(fn.includes(needed), `Capture window lacks ${needed}`);
  }
  assert.ok(!/stop\(/.test(/captureWindow\.on\('closed'[^\n]*/.exec(fn)[0]), 'closing the window must not stop a recording');
  const html = src('capture.html');
  assert.ok(/Content-Security-Policy" content="default-src 'none'; script-src 'self'/.test(html));
  assert.ok(!/<script>/.test(html) && !/https?:\/\//.test(html.replace(/<!--[\s\S]*?-->/g, '')), 'inline script or remote resource');
});

test('Show in Finder reveals the take main recorded; the renderer names nothing', () => {
  const h = /ipcMain\.handle\('maia:soullab-capture-reveal-take'[\s\S]*?\n\}\);/.exec(mainJs)[0];
  assert.ok(h.includes('soullabCapture.lastTakeFile()') && h.includes('shell.showItemInFolder(file)'));
  assert.ok(/async \(evt\) =>/.test(h), 'reveal takes an argument');
  const p = /ipcMain\.handle\('maia:soullab-capture-open-privacy'[\s\S]*?\n\}\);/.exec(mainJs)[0];
  assert.ok(p.includes('shell.openExternal(SYSTEM_AUDIO_PRIVACY_PANE)') && !p.includes('start('));
  assert.ok(mainJs.includes("'x-apple.systempreferences:com.apple.preference.security?Privacy_AudioCapture'"));
});

const recording = (extra) => ({ phase: 'recording', source: { name: 'QuickTime Player' }, seconds: 12.4, peak: [0.5, 0.25], folderName: 'takes', ...extra });

test('"Waiting for audio" appears when the clock stands still for 2 s, and only then', () => {
  const t0 = 1_000_000;
  assert.equal(View.describe(recording(), { now: t0 + 1999, lastAdvanceAt: t0 }).mode, 'recording');
  const w = View.describe(recording(), { now: t0 + 2000, lastAdvanceAt: t0 });
  assert.equal(w.mode, 'waiting');
  assert.equal(w.headline, 'Waiting for audio from QuickTime Player');
  assert.ok(w.recording, 'waiting is still recording and must still show the indicator');
  assert.equal(w.error, '', 'waiting is a state, never an error');
});

test('a recording ending by itself says why, and that it did not restart', () => {
  const idle = (stopReason, extra = {}) => View.describe({ phase: 'idle', folderName: 'takes',
    lastTake: { fileName: 'a.wav', seconds: 93.4, sampleRate: 48000, empty: false, gaps: 0, appName: 'QuickTime Player', stopReason, ...extra } });
  assert.equal(idle('memberStop').lastTake.sentence, 'You stopped the recording.');
  assert.equal(idle('sourceExited').lastTake.sentence, 'QuickTime Player quit, so the recording ended.');
  assert.match(idle('deviceChanged').lastTake.sentence, /sound output changed.*did not restart/);
  assert.match(idle('sleep').lastTake.sentence, /went to sleep.*did not restart/);
  assert.equal(idle('somethingNew').lastTake.sentence, 'The recording ended.');
  const facts = idle('memberStop').lastTake;
  assert.deepEqual([facts.length, facts.rate], ['1:33', '48 kHz']);
});

test('an empty take is labelled, never hidden', () => {
  const v = View.describe({ phase: 'idle', folderName: 'takes',
    lastTake: { fileName: 'b.wav', seconds: 0, sampleRate: 44100, empty: true, appName: 'Music', stopReason: 'memberStop' } });
  assert.ok(v.lastTake, 'the empty take disappeared');
  assert.equal(v.lastTake.sentence, "Nothing was recorded — Music wasn't playing.");
  assert.equal(View.rateLabel(44100), '44.1 kHz');
});

test('permission refusal shows help; other errors say plainly that nothing was recorded', () => {
  const v = View.describe({ phase: 'idle', folderName: 'takes', error: 'PERMISSION_DENIED' });
  assert.equal(v.permissionHelp, true);
  assert.match(v.error, /not allowed Soullab Capture/);
  assert.equal(View.errorSentence('SOMETHING_ELSE'), 'Something went wrong, and nothing was recorded.');
  assert.match(View.errorSentence('PROTOCOL_VIOLATION'), /Nothing restarts by itself/);
});

test('the external-drive note, the recovery notice, and the first-run folder prompt', () => {
  assert.match(View.describe({ phase: 'idle', folderName: 'w', folderExternal: true }).folderNote, /another drive.*also ask/);
  assert.equal(View.describe({ phase: 'idle', folderName: 'w', folderExternal: false }).folderNote, '');
  assert.match(View.describe({ phase: 'idle', folderName: 'w', recovery: { repaired: 1, quarantined: 0 } }).recovery,
    /repaired 1 recording that was interrupted earlier\. They are in your folder\./);
  assert.match(View.describe({ phase: 'idle', folderName: 'w', recovery: { repaired: 0, quarantined: 2 } }).recovery,
    /set aside 2 .*nothing was deleted/);
  assert.match(View.describe({ phase: 'idle', folderName: null }).detail, /choose a folder/);
});

test('starting asks the member to Allow and promises nothing is recorded first', () => {
  const v = View.describe({ phase: 'starting', source: { name: 'Music' }, folderName: 'w' });
  assert.equal(v.headline, 'Starting to record Music…');
  assert.match(v.detail, /choose Allow\. Nothing is recorded until you do\./);
  assert.equal(v.canChoose, false);
});

test('meter and clock arithmetic', () => {
  assert.equal(View.meterFraction(1), 1);
  assert.equal(View.meterFraction(0.001), 0);
  assert.equal(View.meterFraction(0), 0);
  assert.equal(View.clock(3725), '1:02:05');
  assert.equal(View.clock(59.9), '0:59');
});

// J4a-2 witness defect, 2026-11-17: the window treated "listing finished" as
// "recording finished", re-listed forever, and launched the helper 287 times in
// about a minute (no recording, no prompt). These pin both layers of the fix.
test('the app list reloads only after a RECORDING ends, never after listing', () => {
  assert.equal(View.shouldReloadApps('launching', 'idle'), false, 'listing re-triggers listing');
  assert.equal(View.shouldReloadApps('idle', 'idle'), false);
  for (const p of ['starting', 'recording', 'finalizing']) assert.equal(View.shouldReloadApps(p, 'idle'), true);
  assert.equal(View.shouldReloadApps('recording', 'finalizing'), false);
  const r = strip(src('capture-renderer.js'));
  assert.ok(r.includes('if (View.shouldReloadApps(prevPhase, state.phase)) void loadApps();'));
  assert.equal([...r.matchAll(/loadApps\(\)/g)].length, 5, 'a new caller of loadApps() appeared');
});

test('main paces app listing whatever the window does', () => {
  const h = /ipcMain\.handle\('maia:soullab-capture-sources'[\s\S]*?\n\}\);/.exec(mainJs)[0];
  assert.ok(/now - lastSourcesAt < SOURCES_MIN_INTERVAL_MS\) return \{ ok: false, error: 'TOO_SOON' \}/.test(h));
  assert.ok(/const SOURCES_MIN_INTERVAL_MS = 1000;/.test(mainJs));
  assert.match(View.errorSentence('TOO_SOON'), /Refresh again/);
});

// J4a-2 witness, 2026-11-17: a 32.8 s take was pure digital silence, and the
// window called it an ordinary recording.
test('a silent take is labelled; silence while recording is said out loud', () => {
  const v = View.describe({ phase: 'idle', folderName: 'w',
    lastTake: { fileName: 's.wav', seconds: 32.8, sampleRate: 44100, empty: false, silent: true, appName: 'QuickTime Player', stopReason: 'memberStop' } });
  assert.match(v.lastTake.sentence, /^Saved, but it is silent: QuickTime Player sent no sound/);
  const t0 = 5_000_000;
  const hushed = View.describe(recording(), { now: t0 + 2500, lastAdvanceAt: t0 + 2400, lastSoundAt: t0 });
  assert.equal(hushed.mode, 'waiting');
  assert.equal(hushed.headline, 'QuickTime Player is silent right now');
  assert.equal(View.describe(recording(), { now: t0 + 2500, lastAdvanceAt: t0 + 2400, lastSoundAt: t0 + 2000 }).mode, 'recording');
  const r = strip(src('capture-renderer.js'));
  assert.ok(r.includes('if (Array.isArray(next.peak) && next.peak.some((p) => p > 0)) lastSoundAt = Date.now();'));
});
