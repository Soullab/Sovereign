/** LISTEN ROOM SECTIONS · isolated browser witness (#1979, founder 2026-11-19: "selecting Choose a Sound goes
 * to a dark page"). The REAL app/listen/ListenRoom.tsx inside the REAL PersistentListeningProvider, built outside
 * Next, in local Chrome. Proves: /listen opens on Now; /listen#focus-sound and /listen#focus-field open Focus
 * Field with Sound for this session on screen; and the player bar's section event switches an open room from
 * Now to Focus. Against the code before this fix, every Focus case landed on Now.
 *   node tests/listening/listen_room_sections_browser_witness.cjs      Env: CHROME_BIN
 */
'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require('playwright-core');
const repo = path.resolve(__dirname, '../..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soullab-listen-room-'));
fs.writeFileSync(path.join(dir, 'entry.jsx'), `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PersistentListeningProvider } from ${JSON.stringify(path.join(repo, 'components/listening/PersistentListeningProvider.tsx'))};
import ListenRoom from ${JSON.stringify(path.join(repo, 'app/listen/ListenRoom.tsx'))};
createRoot(document.getElementById('app')).render(<PersistentListeningProvider reviewMemberKey="fictional-listen-room"><ListenRoom /></PersistentListeningProvider>);`);
fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/entry.css"></head><body><div id="app"></div><script src="/entry.js"></script></body></html>');
(async () => {
  await esbuild.build({ entryPoints: [path.join(dir, 'entry.jsx')], outdir: dir, bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic',
    target: 'es2022', loader: { '.module.css': 'local-css', '.css': 'css' }, alias: { '@': repo }, logLevel: 'error',
    nodePaths: [path.join(repo, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"' }, banner: { js: 'var process = { env: {} };' } });
  const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0]; const f = path.join(dir, /\.(js|css)$/.test(u) ? u.slice(1) : 'index.html');
    res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const checks = []; const check = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });
  try {
    const visit = async (url) => {
      const p = await browser.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
      await p.goto(base + url); await p.waitForTimeout(1200);
      const view = () => p.evaluate(() => document.querySelector('main[data-studio-view]')?.getAttribute('data-studio-view'));
      const onScreen = async () => { const b = await p.locator('#focus-sound').boundingBox().catch(() => null); return !!b && b.y < 900; };
      return { p, errors, view, onScreen };
    };
    const plain = await visit('/listen');
    check('/listen opens on Now', (await plain.view()) === 'now');
    await plain.p.evaluate(() => window.dispatchEvent(new CustomEvent('soullab:studio-section', { detail: 'focus-sound' })));
    await plain.p.waitForTimeout(900);
    check("the player bar's section event switches an open room to Focus, with Sound for this session on screen", (await plain.view()) === 'focus' && (await plain.onScreen()));
    check('no page errors', plain.errors.length === 0, plain.errors); await plain.p.close();
    for (const url of ['/listen#focus-sound', '/listen#focus-field']) {
      const v = await visit(url);
      check(`${url} opens Focus Field with Sound for this session on screen`, (await v.view()) === 'focus' && (await v.onScreen()));
      check(`${url}: no page errors`, v.errors.length === 0, v.errors); await v.p.close();
    }
  } finally { await browser.close(); server.close(); }
  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : `  → ${JSON.stringify(c.detail)}`}`);
  console.log(`${checks.length - failed.length}/${checks.length} checks`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
