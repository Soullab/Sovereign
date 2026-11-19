/** FOCUS SOUND LEVEL · isolated browser witness (#1979, founder request 2026-11-19).
 * The REAL app/listen/FocusSoundPicker.tsx inside the REAL PersistentListeningProvider (and its dock), in
 * local Chrome. Proves: a Level slider appears once a sound is chosen; it IS the one player's level (moving
 * it moves the player bar's Level, and the other way round); and it changes what is actually heard,
 * measured from the player's own output tap. No Next, no session, no network.
 *   node tests/listening/focus_sound_level_browser_witness.cjs [--serve PORT]      Env: CHROME_BIN
 */
'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');
const esbuild = require('esbuild');
const repo = path.resolve(__dirname, '../..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soullab-focus-level-'));
const shots = path.join(repo, 'docs/design/contracts/screenshots');
const serveAt = process.argv.includes('--serve') ? Number(process.argv[process.argv.indexOf('--serve') + 1] || 4722) : null;
const BUILD = String(Date.now());

fs.writeFileSync(path.join(dir, 'entry.jsx'), `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PersistentListeningProvider, usePersistentListening } from ${JSON.stringify(path.join(repo, 'components/listening/PersistentListeningProvider.tsx'))};
import FocusSoundPicker from ${JSON.stringify(path.join(repo, 'app/listen/FocusSoundPicker.tsx'))};
function Expose() { window.__transport = usePersistentListening(); return null; } // test-only window onto the one player
createRoot(document.getElementById('app')).render(
  <PersistentListeningProvider reviewMemberKey="fictional-focus-level-witness"><Expose /><main style={{padding:'24px',maxWidth:'1000px',margin:'0 auto'}}><FocusSoundPicker /></main></PersistentListeningProvider>);
`);

(async () => {
  await esbuild.build({ entryPoints: [path.join(dir, 'entry.jsx')], outdir: dir, bundle: true, format: 'iife', platform: 'browser',
    jsx: 'automatic', target: 'es2022', loader: { '.module.css': 'local-css' }, alias: { '@': repo }, logLevel: 'error',
    nodePaths: [path.join(repo, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"' }, banner: { js: 'var process = { env: {} };' } });
  fs.writeFileSync(path.join(dir, 'index.html'),
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    `<title>Focus sound level · isolated fixture</title><link rel="stylesheet" href="/entry.css?v=${BUILD}">` +
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
  if (serveAt) { console.log(`Focus sound level harness: ${base}`); return; }

  const { chromium } = require('playwright-core');
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--autoplay-policy=no-user-gesture-required'] });
  const checks = [];
  const check = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });
  const rms = (p) => p.evaluate(async () => {
    const out = window.__transport.generatedOutput(); if (!out) return null;
    const d = new Float32Array(out.analyser.fftSize); let sum = 0, n = 0;
    for (let k = 0; k < 10; k++) { await new Promise((r) => setTimeout(r, 50)); out.analyser.getFloatTimeDomainData(d); for (const v of d) { sum += v * v; n++; } }
    return 20 * Math.log10(Math.sqrt(sum / n));
  });
  try {
    for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
      const ctx = await browser.newContext({ viewport });
      const p = await ctx.newPage();
      const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
      await p.goto(base); await p.waitForSelector('[data-focus-sound-picker]');
      check(`${name}: with No sound chosen, there is no Level`, (await p.locator('[data-focus-sound-level]').count()) === 0);
      await p.locator('[data-focus-sound="creative-flow"]').click().catch(async () => p.getByRole('radio', { name: 'Creative flow' }).click());
      const panel = p.locator('[data-focus-sound-level="adjustable"] input');
      check(`${name}: choosing a sound shows a Level slider here`, (await panel.count()) === 1);
      await p.locator('[data-focus-play-sound]').click();
      await p.waitForSelector('[data-listen-bar-level="adjustable"] input', { timeout: 10000 });
      const bar = p.locator('[data-listen-bar-level="adjustable"] input');
      check(`${name}: it shows the same level as the player bar`, (await panel.inputValue()) === (await bar.inputValue()), [await panel.inputValue(), await bar.inputValue()]);
      await p.waitForTimeout(2500);
      await panel.fill('80'); await p.waitForTimeout(900); const loud = await rms(p);
      check(`${name}: moving it here moves the player bar's Level`, (await bar.inputValue()) === '80');
      await panel.fill('20'); await p.waitForTimeout(900); const quiet = await rms(p);
      check(`${name}: and changes what is heard (80% → 20% is quieter by more than 6 dB, measured at the player's output)`, loud !== null && quiet !== null && loud - quiet > 6, { loud, quiet });
      await bar.fill('55'); await p.waitForTimeout(300);
      check(`${name}: moving the player bar's Level moves this one too`, (await panel.inputValue()) === '55' && /55%/.test(await p.locator('[data-focus-sound-level] output').textContent()));
      await p.locator('[data-focus-sound-picker]').screenshot({ path: path.join(shots, `sound-field-focus-sound-level-${name}.png`) });
      check(`${name}: no horizontal overflow`, await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      check(`${name}: no page errors`, errors.length === 0, errors);
      await ctx.close();
    }
    // Regression (founder witness 2026-11-19): a desktop browser must not be taken for a phone because the
    // remembered level (45% by default) was restored while the volume probe was running.
    for (const stored of [null, '45', '73', '50']) {
      const ctx = await browser.newContext(); const p = await ctx.newPage();
      if (stored !== null) await p.addInitScript((v) => localStorage.setItem('soullab.listen.level.v1', v), stored);
      await p.goto(base); await p.waitForTimeout(700);
      const r = await p.evaluate(() => ({ adjustable: window.__transport.volumeAdjustable, element: document.querySelector('[data-listen10-audio]').volume }));
      const want = (stored === null ? 45 : Number(stored)) / 100;
      check(`desktop with a remembered level of ${stored ?? 'none (default 45%)'}: Level stays adjustable, and the remembered level is applied`,
        r.adjustable === true && Math.abs(r.element - want) < 0.01, r);
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : `  → ${JSON.stringify(c.detail)}`}`);
  console.log(`${checks.length - failed.length}/${checks.length} checks`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
