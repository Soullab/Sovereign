/** NOW PLAYING FOR GENERATED SOUND · isolated browser witness (#1979, founder witness and go-ahead 2026-11-20).
 * The founder saw Velvet Current playing in Safari while macOS Now Playing showed another app: a browser reports
 * a page to the system's Now Playing and media keys only while a media ELEMENT plays, and a sketch was Web Audio
 * only. The one player now carries every generated sound through its existing keep-alive element.
 * The REAL app/listen/FocusSoundPicker.tsx inside the REAL PersistentListeningProvider (and its dock), in local
 * Chrome or Playwright WebKit. A test can't see macOS Now Playing itself, so this proves what the browser needs:
 *   - a media element is playing, and what it plays IS the sketch (measured from its own stream);
 *   - the sketch reaches the speakers only through it (no doubled direct path);
 *   - the page reports the title and playing/paused to the Media Session;
 *   - the play/pause the system's controls send (Media Session action handlers) really pause and resume it;
 *   - Stop pauses the element and clears Now Playing.
 *   node tests/listening/now_playing_sketch_browser_witness.cjs      Env: CHROME_BIN, BROWSER=webkit, PROVIDER_PATH
 */
'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');
const esbuild = require('esbuild');
const repo = path.resolve(__dirname, '../..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soullab-now-playing-'));
const providerPath = process.env.PROVIDER_PATH || path.join(repo, 'components/listening/PersistentListeningProvider.tsx');

fs.writeFileSync(path.join(dir, 'entry.jsx'), `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PersistentListeningProvider, usePersistentListening } from ${JSON.stringify(providerPath)};
import FocusSoundPicker from ${JSON.stringify(path.join(repo, 'app/listen/FocusSoundPicker.tsx'))};
function Expose() { window.__transport = usePersistentListening(); return null; } // test-only window onto the one player
createRoot(document.getElementById('app')).render(
  <PersistentListeningProvider reviewMemberKey="fictional-now-playing-witness"><Expose /><main style={{padding:'24px'}}><FocusSoundPicker /></main></PersistentListeningProvider>);
`);

// Test-only observation. It records; it changes nothing the player does.
const OBSERVE = () => {
  window.__np = { elements: new Set(), handlers: {}, toSpeakers: [] };
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...a) { window.__np.elements.add(this); return play.apply(this, a); };
  if (navigator.mediaSession) {
    const set = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession);
    navigator.mediaSession.setActionHandler = (action, handler) => { window.__np.handlers[action] = handler; try { set(action, handler); } catch { /* unsupported */ } };
  }
  const connect = AudioNode.prototype.connect, disconnect = AudioNode.prototype.disconnect;
  AudioNode.prototype.connect = function (t, ...r) { if (t instanceof AudioDestinationNode) window.__np.toSpeakers.push(this); return connect.call(this, t, ...r); };
  AudioNode.prototype.disconnect = function (...a) { if (a.length === 0) window.__np.toSpeakers = window.__np.toSpeakers.filter((n) => n !== this); return disconnect.apply(this, a); };
};

(async () => {
  await esbuild.build({ entryPoints: [path.join(dir, 'entry.jsx')], outdir: dir, bundle: true, format: 'iife', platform: 'browser',
    jsx: 'automatic', target: 'es2022', loader: { '.module.css': 'local-css' }, alias: { '@': repo }, logLevel: 'error',
    plugins: [{ name: 'provider-under-test', setup(b) { b.onResolve({ filter: /PersistentListeningProvider(\.tsx)?$/ }, () => ({ path: providerPath })); } }],
    nodePaths: [path.join(repo, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"' }, banner: { js: 'var process = { env: {} };' } });
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/entry.css">' +
    '<style>body{margin:0;background:#0b1418;color:#f1efe7}button{background:transparent;color:inherit}</style></head><body><div id="app"></div><script src="/entry.js"></script></body></html>');
  const server = http.createServer((req, res) => {
    const f = path.join(dir, req.url === '/' ? 'index.html' : req.url.split('?')[0].replace(/^\//, ''));
    if (!f.startsWith(dir) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const { chromium, webkit } = require('playwright-core');
  const browser = process.env.BROWSER === 'webkit' ? await webkit.launch() : await chromium.launch({
    executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  const checks = []; const check = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });
  try {
    const p = await (await browser.newContext()).newPage();
    const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
    await p.addInitScript(OBSERVE);
    await p.goto(base);
    await p.locator('[data-focus-sound="creative-flow"]').click();
    await p.locator('[data-focus-play-sound]').click();
    await p.waitForFunction(() => window.__transport?.snapshot.playback === 'playing', null, { timeout: 10000 });
    await p.waitForTimeout(2500); // past the fade-in
    const carrier = () => p.evaluate(() => {
      const el = [...window.__np.elements].find((e) => e.srcObject instanceof MediaStream);
      return el ? { playing: !el.paused, tracks: el.srcObject.getAudioTracks().filter((t) => t.readyState === 'live').length } : null;
    });
    const c = await carrier();
    check('a media element is playing while the sketch plays (what Now Playing and the media keys need)', c && c.playing && c.tracks === 1, c);
    const level = await p.evaluate(async () => {
      const el = [...window.__np.elements].find((e) => e.srcObject instanceof MediaStream); if (!el) return null;
      const ctx = new AudioContext(); const an = ctx.createAnalyser(); an.fftSize = 2048;
      ctx.createMediaStreamSource(el.srcObject).connect(an); await ctx.resume();
      const d = new Float32Array(an.fftSize); let sum = 0, n = 0;
      for (let k = 0; k < 12; k++) { await new Promise((r) => setTimeout(r, 60)); an.getFloatTimeDomainData(d); for (const v of d) { sum += v * v; n++; } }
      void ctx.close(); return 20 * Math.log10(Math.sqrt(sum / n) || 1e-12);
    });
    check('what the element carries IS the sketch (its own stream is not silent)', level !== null && level > -60, level);
    const direct = await p.evaluate(() => window.__np.toSpeakers.filter((n) => n.context.state !== 'closed' && n.context === window.__transport.generatedOutput()?.analyser.context).length);
    check('the sketch is not ALSO sent straight to the speakers (no doubled sound)', direct === 0, direct);
    const ms = () => p.evaluate(() => navigator.mediaSession ? { title: navigator.mediaSession.metadata?.title ?? null, state: navigator.mediaSession.playbackState } : null);
    const playing = await ms();
    check('the page reports the title and "playing" to the Media Session', playing && playing.title === 'Velvet Current' && playing.state === 'playing', playing);
    const hasHandlers = await p.evaluate(() => typeof window.__np.handlers.pause === 'function' && typeof window.__np.handlers.play === 'function');
    check('play and pause handlers are registered for the system controls', hasHandlers);
    await p.evaluate(() => window.__np.handlers.pause?.());
    await p.waitForTimeout(600);
    const afterPause = { snap: await p.evaluate(() => window.__transport.snapshot.playback), el: await carrier(), ms: await ms() };
    check('the system Pause (F8 / Control Center) pauses the sound and the element, and Now Playing says paused',
      afterPause.snap === 'paused' && afterPause.el && !afterPause.el.playing && afterPause.ms.state === 'paused', afterPause);
    await p.evaluate(() => window.__np.handlers.play?.());
    await p.waitForFunction(() => window.__transport.snapshot.playback === 'playing', null, { timeout: 8000 }).catch(() => undefined);
    await p.waitForTimeout(800);
    const afterPlay = { snap: await p.evaluate(() => window.__transport.snapshot.playback), el: await carrier(), ms: await ms() };
    check('the system Play resumes it through the same element', afterPlay.snap === 'playing' && afterPlay.el && afterPlay.el.playing && afterPlay.ms.state === 'playing', afterPlay);
    await p.getByRole('button', { name: 'Stop' }).first().click();
    await p.waitForTimeout(600);
    const afterStop = { el: await carrier(), ms: await ms() };
    check('Stop pauses the element and clears Now Playing', (!afterStop.el || !afterStop.el.playing) && afterStop.ms.title === null && afterStop.ms.state === 'none', afterStop);
    check('no page errors', errors.length === 0, errors);
  } finally { await browser.close(); server.close(); }
  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : `  → ${JSON.stringify(c.detail)}`}`);
  console.log(`${checks.length - failed.length}/${checks.length} checks`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
