/** TONE-LAB-01 · isolated fixture witness for app/listen/ToneLabDesk.tsx.
 * Compiles the real component with esbuild (real listen.module.css), swaps the persistent player for a recording
 * shim, and walks the dial in local Chrome at desktop and phone size. No Next, no session, no audio device, no network.
 *   node tests/listening/tone_lab_fixture_witness.cjs        Env: CHROME_BIN
 */
'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require('playwright-core');

const repo = path.resolve(__dirname, '../..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soullab-tone-lab-'));
const shots = path.join(repo, 'docs/design/contracts/screenshots');
const shim = path.join(dir, 'player-shim.tsx');
fs.writeFileSync(shim, `
import React from 'react';
const calls: any[] = (window as any).__plays = [];
let listeners: Array<() => void> = [];
let snap: any = { kind: 'none', playback: 'idle', title: '' };
export function usePersistentListening() {
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => { listeners.push(force); return () => { listeners = listeners.filter(l => l !== force); }; }, []);
  return {
    snapshot: snap,
    playSketch: async (_m: any, _f: any, _e: any, spec: any) => { calls.push(spec); snap = { kind: 'sketch', playback: 'playing', title: 'Tone Lab' }; listeners.forEach(l => l()); return true; },
    stopMusic: () => { (window as any).__stopped = true; snap = { kind: 'none', playback: 'idle', title: '' }; listeners.forEach(l => l()); },
  };
}`);
fs.writeFileSync(path.join(dir, 'entry.jsx'),
  "import React from 'react'; import { createRoot } from 'react-dom/client';" +
  `import ToneLabDesk from ${JSON.stringify(path.join(repo, 'app/listen/ToneLabDesk.tsx'))};` +
  "createRoot(document.getElementById('app')).render(<main style={{padding:'24px',maxWidth:'900px',margin:'0 auto'}}><ToneLabDesk /></main>);");

(async () => {
  await esbuild.build({
    entryPoints: [path.join(dir, 'entry.jsx')], outdir: dir, bundle: true, format: 'iife', platform: 'browser',
    jsx: 'automatic', target: 'es2022', loader: { '.module.css': 'local-css' },
    alias: { '@/components/listening/PersistentListeningProvider': shim, '@': repo }, logLevel: 'error',
    nodePaths: [path.join(repo, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"' },
  });
  fs.writeFileSync(path.join(dir, 'index.html'),
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Tone Lab · isolated fixture</title><link rel="stylesheet" href="/entry.css">' +
    '<style>:root{--line:rgba(235,220,194,.16);--ink:#f1efe7}body{margin:0;background:#0b1418;color:#f1efe7;font:15px Georgia,serif}</style>' +
    '</head><body><div id="app"></div><script src="/entry.js"></script></body></html>');
  const server = http.createServer((req, res) => {
    const f = path.join(dir, req.url === '/' ? 'index.html' : req.url.split('?')[0].replace(/^\//, ''));
    if (!f.startsWith(dir) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const checks = [];
  try {
    for (const [name, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
      const page = await browser.newPage({ viewport });
      const errors = []; page.on('pageerror', e => errors.push(String(e)));
      await page.goto(base);
      await page.locator('[data-tone-lab]').waitFor();
      checks.push([`${name}: nothing plays on arrival`, (await page.evaluate(() => window.__plays.length)) === 0]);
      checks.push([`${name}: states plainly that no effect is claimed`, (await page.locator('[data-tone-lab-claim]').innerText()).includes('makes no claim')]);
      checks.push([`${name}: headphones note hidden until binaural`, (await page.getByText('Binaural needs headphones').count()) === 0]);
      await page.locator('[data-tone-preset="solfeggio-528"]').click();
      const prov = await page.locator('[data-tone-provenance]').innerText();
      checks.push([`${name}: 528 Hz shows its provenance and no outcome`, /Joseph Puleo/.test(prov) && /no evidence of a physical effect/.test(prov)]);
      checks.push([`${name}: pitch field follows the preset`, (await page.locator('#tone-hz').inputValue()) === '528']);
      await page.locator('#tone-hz').fill('5000');
      checks.push([`${name}: pitch clamps to 1000`, (await page.locator('#tone-hz').inputValue()) === '1000']);
      await page.locator('[data-tone-preset="rhythm-alpha-10"]').click();
      checks.push([`${name}: alpha preset shows its honest label`, /not proven to change your state/.test(await page.locator('[data-tone-provenance]').innerText())]);
      await page.locator('[data-tone-pulse="binaural"]').click();
      checks.push([`${name}: binaural shows the headphones note`, (await page.getByText('Binaural needs headphones').count()) === 1]);
      checks.push([`${name}: driving note always shown`, (await page.getByText('do not use Tone Lab while driving').count()) === 1]);
      if (name === 'desktop') await page.screenshot({ path: path.join(shots, 'sound-studio-tone-lab-desktop.png'), fullPage: true });
      await page.locator('[data-tone-play]').click();
      await page.locator('[data-tone-stop]').waitFor();
      const spec = await page.evaluate(() => window.__plays[window.__plays.length - 1]);
      checks.push([`${name}: Play hands the dial to the one player (binaural 10 Hz, capped fade)`, spec.tone.pulseMode === 'binaural' && spec.tone.pulseHz === 10 && spec.fadeInSec >= 4]);
      await page.locator('#tone-pulse').fill('99');
      await page.waitForTimeout(500);
      checks.push([`${name}: dial moves a playing sound smoothly, clamped to 40 Hz`, (await page.evaluate(() => window.__plays.at(-1).tone.pulseHz)) === 40]);
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      if (name === 'mobile') await page.screenshot({ path: path.join(shots, 'sound-studio-tone-lab-mobile.png'), fullPage: true });
      await page.waitForTimeout(300); // let the full-page capture's temporary resize settle
      await page.locator('[data-tone-stop]').click();
      checks.push([`${name}: Stop reaches the player`, await page.waitForFunction(() => window.__stopped === true, null, { timeout: 3000 }).then(() => true, () => false)]);
      checks.push([`${name}: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)]);
      checks.push([`${name}: no page errors`, errors.length === 0]);
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  for (const [label, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (checks.some(([, ok]) => !ok)) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
