/** SOULLAB SHELF LIVE VIEW · isolated browser witness (LISTEN-23 Shelf, #1979, founder approval 2026-11-19).
 * The REAL app/listen/ReceptiveFieldDesk.tsx inside the REAL PersistentListeningProvider (the one player),
 * compiled with their real stylesheets, in local Chrome. No Next, no session, no network, no member data.
 * Proves: the live view moves while the field plays and is flat when paused; the notes and settings differ
 * between cards; the chosen card is marked; and the output tap is read-only (it adds exactly one edge,
 * master → analyser, and nothing new reaches the speakers). Also measures the field's real output level.
 *   node tests/listening/shelf_live_view_browser_witness.cjs        Env: CHROME_BIN
 */
'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require('playwright-core');
const repo = path.resolve(__dirname, '../..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soullab-shelf-live-'));
const shots = path.join(repo, 'docs/design/contracts/screenshots');

// The same notes ListenRoom hands the player for each journey (app/listen/ListenRoom.tsx).
const room = fs.readFileSync(path.join(repo, 'app/listen/ListenRoom.tsx'), 'utf8');
const freqs = {};
for (const m of room.matchAll(/^\s*(focus|create|drift|rest):\s*\{[^\n]*frequencies:\[([^\]]+)\]/gm)) freqs[m[1]] = m[2].split(',').map(Number);
if (Object.keys(freqs).length !== 4) throw new Error('Could not read the journey notes from ListenRoom.tsx');

fs.writeFileSync(path.join(dir, 'entry.jsx'), `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PersistentListeningProvider, usePersistentListening } from ${JSON.stringify(path.join(repo, 'components/listening/PersistentListeningProvider.tsx'))};
import ReceptiveFieldDesk from ${JSON.stringify(path.join(repo, 'app/listen/ReceptiveFieldDesk.tsx'))};
const FREQS = ${JSON.stringify(freqs)};
function Shelf() {
  const persistent = usePersistentListening();
  const [journey, setJourney] = useState('drift');
  return <ReceptiveFieldDesk journey={journey} onSelectJourney={setJourney}
    onPlay={(next) => persistent ? persistent.playSketch(next, FREQS[next]) : Promise.resolve(false)} />;
}
createRoot(document.getElementById('app')).render(
  <PersistentListeningProvider reviewMemberKey="fictional-shelf-witness"><main style={{padding:'24px',maxWidth:'1200px',margin:'0 auto'}}><Shelf /></main></PersistentListeningProvider>);
`);

(async () => {
  await esbuild.build({ entryPoints: [path.join(dir, 'entry.jsx')], outdir: dir, bundle: true, format: 'iife', platform: 'browser',
    jsx: 'automatic', target: 'es2022', loader: { '.module.css': 'local-css' }, alias: { '@': repo }, logLevel: 'error',
    nodePaths: [path.join(repo, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"' },
    banner: { js: 'var process = { env: {} };' } }); // the provider reads optional NEXT_PUBLIC_ flags; none are set here
  fs.writeFileSync(path.join(dir, 'index.html'),
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Shelf live view · isolated fixture</title><link rel="stylesheet" href="/entry.css">' +
    '<style>body{margin:0;background:#0b1418;color:#f1efe7;font:15px Georgia,serif}button{background:transparent;color:inherit;font:inherit;cursor:pointer}input[type=range]{accent-color:#d4af37}</style>' + // the app shell\'s button reset, which this fixture does not load
    '</head><body><div id="app"></div><script src="/entry.js"></script></body></html>');
  const server = http.createServer((req, res) => {
    const f = path.join(dir, req.url === '/' ? 'index.html' : req.url.split('?')[0].replace(/^\//, ''));
    if (!f.startsWith(dir) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--autoplay-policy=no-user-gesture-required'] });
  const checks = [];
  const check = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });
  const measured = {};
  try {
    for (const [name, viewport] of [['desktop', { width: 1440, height: 1200 }], ['mobile', { width: 390, height: 844 }]]) {
      const ctx = await browser.newContext({ viewport });
      const p = await ctx.newPage();
      const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
      const external = []; p.on('request', (r) => { if (!r.url().startsWith(base) && /^https?:/.test(r.url())) external.push(r.url()); });
      // Record every audio-graph edge, so the tap can be shown to add exactly one: master → analyser.
      await p.addInitScript(() => {
        const edges = []; window.__edges = edges;
        const kind = (n) => (n instanceof AudioDestinationNode ? 'destination' : n instanceof AnalyserNode ? 'analyser' : n instanceof GainNode ? 'gain' : n?.constructor?.name || 'param');
        const connect = AudioNode.prototype.connect;
        AudioNode.prototype.connect = function (dst, ...rest) { edges.push([kind(this), kind(dst)]); return connect.call(this, dst, ...rest); };
      });
      await p.goto(base);
      await p.waitForSelector('[data-listen23-live]');
      const live = () => p.locator('[data-listen23-live]').getAttribute('data-live-state');
      check(`${name}: before anything, the live view says nothing is playing`, (await live()) === 'stopped' && /Not playing/.test(await p.locator('[data-listen23-live]').textContent()));
      check(`${name}: no card is marked before one is chosen`, (await p.locator('[data-listen23-chosen]').count()) === 0);

      await p.locator('[data-listen23-invitation="open"]').click();
      check(`${name}: choosing a card marks it, and only it`, (await p.locator('[data-listen23-invitation="open"]').getAttribute('aria-pressed')) === 'true'
        && (await p.locator('[aria-pressed="true"][data-listen23-invitation]').count()) === 1
        && (await p.locator('[data-listen23-chosen]').textContent()) === 'Chosen');

      await p.getByRole('button', { name: 'Play this sound field' }).click();
      await p.waitForFunction(() => document.querySelector('[data-listen23-live]')?.getAttribute('data-live-state') === 'playing', null, { timeout: 8000 });
      await p.waitForTimeout(2500); // the field fades in over 1.8 s
      check(`${name}: while playing, the card says Playing`, (await p.locator('[data-listen23-chosen]').textContent()) === 'Playing');
      const notes1 = await p.locator('[data-live-notes]').textContent().catch(() => null);
      check(`${name}: the live view names the field's notes (A wider horizon: G2 · D3 · G3)`, notes1 === 'G2 · D3 · G3', notes1);
      const levelText = await p.locator('[data-live-level]').textContent();
      check(`${name}: the live view shows a real output level`, /^Output −?-?\d+ dBFS$/.test(levelText), levelText);
      const wave = await p.evaluate(() => {
        const c = document.querySelector('[data-live-wave]'); const g = c.getContext('2d');
        const { data, width, height } = g.getImageData(0, 0, c.width, c.height); let top = height, bottom = 0;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x += 4) if (data[(y * width + x) * 4 + 3] > 40) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
        return { span: bottom - top, height };
      });
      check(`${name}: the waveform moves (it is not a flat line)`, wave.span > wave.height * 0.3, wave);
      const settings = await p.locator('[data-live-settings]').textContent();
      const tint1 = await p.locator('[data-listen23-live]').getAttribute('data-live-tint');
      check(`${name}: the field's settings are shown (the card's values on the dials' steps of 5)`, /Organic Current 30 · Open Water 90 · Texture & stillness 30/.test(settings), settings);
      const edges = await p.evaluate(() => window.__edges);
      const taps = edges.filter(([, d]) => d === 'analyser');
      check(`${name}: the tap adds exactly one edge, master gain → analyser`, taps.length === 1 && taps[0][0] === 'gain', taps);
      check(`${name}: the analyser feeds nothing (read-only)`, edges.every(([s]) => s !== 'analyser'));
      check(`${name}: only one path reaches the speakers`, edges.filter(([, d]) => d === 'destination').length === 1, edges.filter(([, d]) => d === 'destination'));
      const lvl = Number(levelText.replace(/[^\d.-]/g, '').replace(/^-?/, '-'));
      if (name === 'desktop') measured.driftDbfs = lvl;

      // Another card: different notes, and Listen starts it.
      await p.locator('[data-listen23-invitation="warmth"]').click();
      await p.getByRole('button', { name: 'Play this sound field' }).click();
      await p.waitForFunction(() => document.querySelector('[data-live-notes]')?.textContent === 'C3 · G3 · C4', null, { timeout: 8000 }).catch(() => undefined);
      const notes2 = await p.locator('[data-live-notes]').textContent().catch(() => null);
      await p.waitForTimeout(2500); // let the new field fade in before reading and photographing it
      check(`${name}: a different card shows different notes (A moving current: C3 · G3 · C4)`, notes2 === 'C3 · G3 · C4', notes2);
      const settings2 = await p.locator('[data-live-settings]').textContent();
      check(`${name}: and different settings`, settings2 !== settings && /Organic Current (75|80) · Open Water 50 · Texture & stillness 60/.test(settings2), settings2);
      check(`${name}: each field has its own colour (sea for A wider horizon, amber for A moving current)`, tint1 === '110,190,200' && (await p.locator('[data-listen23-live]').getAttribute('data-live-tint')) === '226,170,92', [tint1]);
      check(`${name}: the newly chosen card is the one marked Playing`, (await p.locator('[data-listen23-invitation="warmth"] [data-listen23-chosen]').textContent()) === 'Playing'
        && (await p.locator('[data-listen23-invitation="open"] [data-listen23-chosen]').count()) === 0);

      // Tailoring marks the card as tailored.
      await p.getByRole('button', { name: 'Tailor this sound' }).click();
      await p.locator('#receptive-pulse').fill('40');
      check(`${name}: tailoring a dial marks the card as tailored`, /Playing · tailored/.test(await p.locator('[data-listen23-chosen]').textContent()));
      await p.locator('[data-listen23-live]').screenshot({ path: path.join(dir, `${name}-live.png`) });
      await p.locator('[data-listen23-receptive-field]').screenshot({ path: path.join(shots, `sound-studio-shelf-live-${name}.png`) });

      // Pause: the view says so and goes flat.
      await p.getByRole('button', { name: 'Pause this sound field' }).click();
      await p.waitForFunction(() => document.querySelector('[data-listen23-live]')?.getAttribute('data-live-state') === 'paused', null, { timeout: 8000 }).catch(() => undefined);
      check(`${name}: paused, the live view says Paused`, (await live()) === 'paused' && /Paused/.test(await p.locator('[data-listen23-live]').textContent()));
      await p.waitForTimeout(300);
      const flat = await p.evaluate(() => {
        const c = document.querySelector('[data-live-wave]'); const g = c.getContext('2d');
        const { data, width, height } = g.getImageData(0, 0, c.width, c.height); let top = height, bottom = 0;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x += 4) if (data[(y * width + x) * 4 + 3] > 40) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
        return bottom - top;
      });
      check(`${name}: paused, the waveform is a flat line (only its soft glow has height)`, flat <= 12, flat);
      check(`${name}: no horizontal overflow`, await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      check(`${name}: no page errors and no outside requests`, errors.length === 0 && external.length === 0, { errors, external });
      await ctx.close();
    }
  } finally {
    await browser.close(); server.close();
  }
  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : `  → ${JSON.stringify(c.detail)}`}`);
  if (measured.driftDbfs !== undefined) console.log(`MEASURED  A wider horizon at the default level: output RMS ${measured.driftDbfs} dBFS`);
  console.log(`${checks.length - failed.length}/${checks.length} checks`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
