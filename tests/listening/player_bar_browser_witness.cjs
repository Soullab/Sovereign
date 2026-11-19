/** PLAYER BAR · isolated browser witness (#1979, founder ruling 2026-11-19: "Yes, in the bar").
 * The REAL PersistentListeningProvider and its REAL dock, with the real Focus page parts (FocusSoundPicker,
 * FocusFieldDesk), in local Chrome. Proves: Level is in the bar even with only a silent focus timer, and it
 * sets the one player's level; the silent bar offers "Choose a sound"; a generated sound shows a moving
 * waveform in its colour and how long it has played; a member's own recording shows a waveform through a
 * read-only stream copy and its play length; and no copy is ever routed to the speakers.
 * Not covered: Safari (no captureStream for recordings; the bar says so) and a phone.
 *   node tests/listening/player_bar_browser_witness.cjs [--serve PORT]      Env: CHROME_BIN
 */
'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');
const esbuild = require('esbuild');
const repo = path.resolve(__dirname, '../..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soullab-player-bar-'));
const shots = path.join(repo, 'docs/design/contracts/screenshots');
const serveAt = process.argv.includes('--serve') ? Number(process.argv[process.argv.indexOf('--serve') + 1] || 4723) : null;
const BUILD = String(Date.now());

fs.writeFileSync(path.join(dir, 'entry.jsx'), `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PersistentListeningProvider, usePersistentListening } from ${JSON.stringify(path.join(repo, 'components/listening/PersistentListeningProvider.tsx'))};
import FocusSoundPicker from ${JSON.stringify(path.join(repo, 'app/listen/FocusSoundPicker.tsx'))};
import FocusFieldDesk from ${JSON.stringify(path.join(repo, 'components/listening/FocusFieldDesk.tsx'))};
function Expose() { window.__transport = usePersistentListening(); return null; } // test-only window onto the one player
createRoot(document.getElementById('app')).render(
  <PersistentListeningProvider reviewMemberKey="fictional-player-bar-witness"><Expose /><main style={{padding:'24px 24px 140px',maxWidth:'1200px',margin:'0 auto'}}><FocusSoundPicker /><FocusFieldDesk /></main></PersistentListeningProvider>);
`);

(async () => {
  await esbuild.build({ entryPoints: [path.join(dir, 'entry.jsx')], outdir: dir, bundle: true, format: 'iife', platform: 'browser',
    jsx: 'automatic', target: 'es2022', loader: { '.module.css': 'local-css' }, alias: { '@': repo }, logLevel: 'error',
    nodePaths: [path.join(repo, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"' }, banner: { js: 'var process = { env: {} };' } });
  fs.writeFileSync(path.join(dir, 'index.html'),
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    `<title>Player bar · isolated fixture</title><link rel="stylesheet" href="/entry.css?v=${BUILD}">` +
    '<style>body{margin:0;background:#0b1418;color:#f1efe7;font:15px Georgia,serif}button{background:transparent;color:inherit;font:inherit;cursor:pointer}</style>' +
    `</head><body><div id="app"></div><script src="/entry.js?v=${BUILD}"></script></body></html>`);
  const server = http.createServer((req, res) => {
    const f = path.join(dir, req.url === '/' ? 'index.html' : req.url.split('?')[0].replace(/^\//, ''));
    if (!f.startsWith(dir) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(serveAt ?? 0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  if (serveAt) { console.log(`Player bar harness: ${base}`); return; }

  const { chromium } = require('playwright-core');
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--autoplay-policy=no-user-gesture-required'] });
  const checks = [];
  const check = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });
  const waveSpan = (p) => p.evaluate(() => {
    const c = document.querySelector('[data-listen-bar-wave]'); if (!c) return -1;
    const { data, width, height } = c.getContext('2d').getImageData(0, 0, c.width, c.height); let t = height, b = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x += 2) if (data[(y * width + x) * 4 + 3] > 120) { t = Math.min(t, y); b = Math.max(b, y); }
    return { span: b - t, height };
  });
  try {
    for (const [name, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
      const ctx = await browser.newContext({ viewport });
      const p = await ctx.newPage();
      const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
      await p.addInitScript(() => {
        const edges = []; window.__edges = edges;
        const kind = (n) => (n instanceof AudioDestinationNode ? 'destination' : n instanceof AnalyserNode ? 'analyser' : n instanceof MediaStreamAudioSourceNode ? 'stream-copy' : n?.constructor?.name || 'param');
        const connect = AudioNode.prototype.connect;
        AudioNode.prototype.connect = function (dst, ...rest) { edges.push([kind(this), kind(dst)]); return connect.call(this, dst, ...rest); };
      });
      await p.goto(base); await p.waitForSelector('[data-focus-sound-picker]');

      // A silent focus session: the bar still has Level, and offers a sound.
      await p.getByRole('button', { name: 'Start focus session' }).click();
      await p.waitForSelector('[data-focus-field-dock]');
      const level = p.locator('[data-listen-bar-level="adjustable"] input');
      check(`${name}: with only a silent focus timer, the bar has Level`, (await level.count()) === 1);
      await level.fill('30');
      check(`${name}: and it sets the one player's level`, (await p.evaluate(() => window.__transport.volume)) === 30);
      check(`${name}: the silent bar offers Choose a sound`, (await p.locator('[data-focus-dock-choose-sound]').getAttribute('href')) === '/listen#focus-sound');

      const chooseBox = await p.locator('[data-focus-dock-choose-sound]').boundingBox();
      const pauseBox = await p.getByRole('button', { name: 'Pause Focus Field session' }).boundingBox();
      const deco = await p.locator('[data-focus-dock-choose-sound]').evaluate((el) => getComputedStyle(el).textDecorationLine);
      check(`${name}: Choose a sound looks like the bar's other buttons (same height, no underline)`, Math.abs(chooseBox.height - pauseBox.height) <= 2 && deco === 'none', { chooseBox, pauseBox, deco });
      // Choose a sound stays in the app and brings Sound for this session into view (it used to leave the page).
      await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const before = p.url();
      await p.locator('[data-focus-dock-choose-sound]').click();
      await p.waitForTimeout(900);
      const picker = await p.locator('#focus-sound').boundingBox();
      check(`${name}: Choose a sound stays on the page and brings Sound for this session into view`, p.url() === before && picker && picker.y >= -2 && picker.y < viewport.height / 2, { url: p.url(), before, picker });
      // A generated sound: waveform in its colour, and how long it has played.
      await p.locator('[data-focus-sound="creative-flow"]').click();
      await p.locator('[data-focus-play-sound]').click();
      await p.waitForSelector('[data-listen-bar-live="playing"]', { timeout: 10000 });
      await p.waitForTimeout(3200);
      const w1 = await waveSpan(p);
      check(`${name}: a generated sound draws a moving waveform in the bar`, w1.span > w1.height * 0.3, w1);
      const tint = await p.locator('[data-listen-bar-live]').getAttribute('data-listen-bar-tint');
      check(`${name}: in the sound's own colour, not only gold`, tint !== '212,175,55', tint);
      const t1 = await p.locator('[data-listen-bar-time]').textContent();
      check(`${name}: and how long it has played, until Stop`, /^0:0[2-4] · until Stop$/.test(t1), t1);
      check(`${name}: Level is in the bar while it plays`, (await level.count()) === 1);
      if (name === 'desktop') await p.locator('[data-listen10-persistent-dock]').screenshot({ path: path.join(shots, 'sound-studio-player-bar-generated-desktop.png') });

      // A member's own recording: waveform via a read-only stream copy, and its play length.
      await p.evaluate(async () => {
        const rate = 44100, n = rate * 6, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
        const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
        w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
        for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(0.3 * Math.sin(2 * Math.PI * 330 * i / rate) * 32767), true);
        window.__transport.selectLocalFile(new File([buf], 'my take.wav', { type: 'audio/wav' }));
        await window.__transport.playLocalFile();
      });
      await p.waitForFunction(() => document.querySelector('[data-listen-bar-live]')?.getAttribute('data-listen-bar-live') === 'playing', null, { timeout: 10000 }).catch(() => undefined);
      await p.waitForTimeout(1800);
      const w2 = await waveSpan(p);
      check(`${name}: a recording draws its waveform in the bar (Chrome: read-only stream copy)`, w2.span > w2.height * 0.3, w2);
      const t2 = await p.locator('[data-listen-bar-time]').textContent();
      check(`${name}: and its play length, elapsed / total`, /^0:0[1-3] \/ 0:06$/.test(t2), t2);
      const edges = await p.evaluate(() => window.__edges);
      check(`${name}: the stream copy feeds only an analyser, never the speakers`, edges.filter(([s]) => s === 'stream-copy').every(([, d]) => d === 'analyser') && edges.some(([s]) => s === 'stream-copy'), edges.filter(([s]) => s === 'stream-copy'));
      check(`${name}: no analyser feeds anything`, edges.every(([s]) => s !== 'analyser'));
      if (name === 'desktop') await p.locator('[data-listen10-persistent-dock]').screenshot({ path: path.join(shots, 'sound-studio-player-bar-recording-desktop.png') });
      else await p.locator('[data-listen10-persistent-dock]').screenshot({ path: path.join(shots, 'sound-studio-player-bar-mobile.png') });
      const tb = await p.locator('[data-listen-bar-time]').boundingBox();
      check(`${name}: the play length stays on one line`, tb && tb.height < 24, tb);
      check(`${name}: no horizontal overflow`, await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      check(`${name}: no page errors`, errors.length === 0, errors);
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : `  → ${JSON.stringify(c.detail)}`}`);
  console.log(`${checks.length - failed.length}/${checks.length} checks`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
