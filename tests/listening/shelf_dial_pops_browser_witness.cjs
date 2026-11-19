/** SHELF DIAL POPS · isolated browser witness (#1979, founder report 2026-11-19: "the field tailoring works
 * although I hear little pops").
 * The REAL app/listen/ReceptiveFieldDesk.tsx inside the REAL PersistentListeningProvider, in local Chrome.
 * A test-only recorder copies every sample the page sends to the speakers (it changes nothing that is heard),
 * then the dials are moved the way a hand moves them. A click is a sudden step in the waveform: it shows as a
 * spike in the sample-to-sample curvature (third difference: the soft filter rounds a jump, but cannot hide its corner), far above what the smooth tones ever make.
 *   node tests/listening/shelf_dial_pops_browser_witness.cjs [--report]      Env: CHROME_BIN, BROWSER=webkit (Safari's engine), FORCE_RATE, PROVIDER_PATH
 * LIMIT: every voice passes the sketch's low-pass filter, which rounds a jump off. A deliberately jumpy control
 * is caught clearly only on Organic Current (Chrome 3.8×, WebKit 4.8×); on the other two dials it reads about 2×.
 * So this is a regression check for Organic Current and a measurement for the others, not a gate for them.
 */
'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');
const esbuild = require('esbuild');
const repo = path.resolve(__dirname, '../..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soullab-shelf-pops-'));
const providerPath = process.env.PROVIDER_PATH || path.join(repo, 'components/listening/PersistentListeningProvider.tsx');

const room = fs.readFileSync(path.join(repo, 'app/listen/ListenRoom.tsx'), 'utf8');
const freqs = {};
for (const m of room.matchAll(/^\s*(focus|create|drift|rest):\s*\{[^\n]*frequencies:\[([^\]]+)\]/gm)) freqs[m[1]] = m[2].split(',').map(Number);
if (Object.keys(freqs).length !== 4) throw new Error('Could not read the journey notes from ListenRoom.tsx');

fs.writeFileSync(path.join(dir, 'entry.jsx'), `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PersistentListeningProvider, usePersistentListening } from ${JSON.stringify(providerPath)};
import ReceptiveFieldDesk from ${JSON.stringify(path.join(repo, 'app/listen/ReceptiveFieldDesk.tsx'))};
const FREQS = ${JSON.stringify(freqs)};
function Shelf() {
  const persistent = usePersistentListening();
  const [journey, setJourney] = useState('drift');
  return <ReceptiveFieldDesk journey={journey} onSelectJourney={setJourney}
    onPlay={(next) => persistent ? persistent.playSketch(next, FREQS[next]) : Promise.resolve(false)} />;
}
createRoot(document.getElementById('app')).render(
  <PersistentListeningProvider reviewMemberKey="fictional-shelf-pops-witness"><main style={{padding:'24px',maxWidth:'1200px',margin:'0 auto'}}><Shelf /></main></PersistentListeningProvider>);
`);

// Test-only: whatever is connected to a context's speakers is ALSO copied into a recorder (which outputs silence).
const RATE = Number(process.env.FORCE_RATE || 0); // optional: force a sample rate (the founder's Mac runs at 192 kHz)
const RECORDER = () => {
  const original = AudioNode.prototype.connect;
  window.__rec = { chunks: [], rate: 0, on: false };
  const taps = new WeakMap();
  AudioNode.prototype.connect = function (target, ...rest) {
    const result = original.call(this, target, ...rest);
    if (target instanceof AudioDestinationNode && !taps.has(this)) {
      const ctx = this.context; window.__rec.rate = ctx.sampleRate;
      const sp = ctx.createScriptProcessor(4096, 1, 1);
      sp.onaudioprocess = (e) => { if (window.__rec.on) window.__rec.chunks.push(Float32Array.from(e.inputBuffer.getChannelData(0))); };
      original.call(this, sp); original.call(sp, ctx.destination); taps.set(this, sp);
    }
    return result;
  };
};

(async () => {
  await esbuild.build({ entryPoints: [path.join(dir, 'entry.jsx')], outdir: dir, bundle: true, format: 'iife', platform: 'browser',
    jsx: 'automatic', target: 'es2022', loader: { '.module.css': 'local-css' }, alias: { '@': repo }, logLevel: 'error',
    plugins: [{ name: 'provider-under-test', setup(b) { // every import of the provider gets the one under test (a control can swap it)
      b.onResolve({ filter: /PersistentListeningProvider(\.tsx)?$/ }, () => ({ path: providerPath })); } }],
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
  const browser = process.env.BROWSER === 'webkit' ? await webkit.launch() : await chromium.launch({ executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--autoplay-policy=no-user-gesture-required'] });
  const checks = []; const check = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });
  const report = {};
  try {
    const p = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
    const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
    if (RATE) await p.addInitScript((r) => { const A = window.AudioContext; window.AudioContext = function (o) { return new A({ ...(o || {}), sampleRate: r }); }; window.AudioContext.prototype = A.prototype; }, RATE);
    await p.addInitScript(RECORDER);
    await p.goto(base);
    await p.getByRole('button', { name: /^Play/ }).first().click();
    await p.waitForTimeout(2600); // past the 1.8 s fade-in
    await p.getByRole('button', { name: 'Tailor this sound' }).click();
    let seen = new Set(); const watch = setInterval(() => p.evaluate(() => [...document.querySelectorAll('[data-listen23-dial]')].map((e) => e.textContent).join(' ')).then((v) => seen.add(v)).catch(() => {}), 40);
    const take = async (label, act) => {
      seen = new Set();
      await p.evaluate(() => { window.__rec.chunks = []; window.__rec.on = true; });
      await act();
      await p.waitForTimeout(400);
      const r = await p.evaluate(() => {
        window.__rec.on = false;
        const all = []; for (const c of window.__rec.chunks) for (const v of c) all.push(v);
        let peak = 0, curv = 0, sum = 0, n = 0; const spikes = [];
        for (let i = 3; i < all.length; i++) {
          const d2 = Math.abs(all[i] - 3 * all[i - 1] + 3 * all[i - 2] - all[i - 3]); curv = Math.max(curv, d2);
          sum += all[i] * all[i]; n++; peak = Math.max(peak, Math.abs(all[i]));
        }
        return { samples: all.length, rate: window.__rec.rate, rms: Math.sqrt(sum / Math.max(1, n)), peak, maxCurvature: curv,
          curv: (() => { const t = []; for (let i = 3; i < all.length; i++) t.push(Math.abs(all[i] - 3 * all[i - 1] + 3 * all[i - 2] - all[i - 3])); return t; })() };
      });
      report[label] = r; return r;
    };
    const steady = await take('steady', () => p.waitForTimeout(1500));
    const ratio = (r) => r.maxCurvature / Math.max(1e-12, steady.maxCurvature);
    const spikes = (r) => r.curv.filter((v) => v > 4 * steady.maxCurvature).length;
    const moves = {
      'pulse dragged up and down': async () => { const s = p.locator('#receptive-pulse'); const b = await s.boundingBox();
        await p.mouse.move(b.x + b.width * 0.5, b.y + b.height / 2); await p.mouse.down();
        for (let k = 0; k <= 40; k++) { await p.mouse.move(b.x + b.width * (0.5 + 0.5 * Math.sin(k / 40 * Math.PI * 2)), b.y + b.height / 2); await p.waitForTimeout(25); }
        await p.mouse.up(); },
      'space dragged up and down': async () => { const s = p.locator('#receptive-space'); const b = await s.boundingBox();
        await p.mouse.move(b.x + b.width * 0.5, b.y + b.height / 2); await p.mouse.down();
        for (let k = 0; k <= 40; k++) { await p.mouse.move(b.x + b.width * (0.5 + 0.5 * Math.sin(k / 40 * Math.PI * 2)), b.y + b.height / 2); await p.waitForTimeout(25); }
        await p.mouse.up(); },
      'density stepped with arrow keys': async () => { await p.locator('#receptive-density').focus();
        for (let k = 0; k < 10; k++) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(60); }
        for (let k = 0; k < 10; k++) { await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(60); } },
    };
    const dialValues = () => p.evaluate(() => [...document.querySelectorAll('[data-listen23-dial]')].map((e) => e.textContent).join(' '));
    for (const [label, act] of Object.entries(moves)) {
      const before = await dialValues();
      const r = await take(label, act);
      report[label].dials = [...seen];
      check(`${label}: the dials really moved (${seen.size} different settings heard)`, seen.size >= 4, [...seen]);
      check(`${label}: no clicks (third difference stays within 4× the steady tone; got ${ratio(r).toFixed(1)}×, ${spikes(r)} spike samples)`,
        spikes(r) === 0, { ratio: ratio(r), spikes: spikes(r), steadyMax: steady.maxCurvature, max: r.maxCurvature });
    }
    check('the recorder heard the field (not silence)', steady.rms > 1e-4, steady.rms);
    check('no page errors', errors.length === 0, errors);
  clearInterval(watch);
  } finally { await browser.close(); server.close(); }
  if (process.argv.includes('--report')) for (const [k, v] of Object.entries(report)) console.log(k, JSON.stringify({ ...v, curv: undefined }));
  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : `  → ${JSON.stringify(c.detail)}`}`);
  console.log(`${checks.length - failed.length}/${checks.length} checks`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
