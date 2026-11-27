/** LISTEN-01 · Living Library — isolated fixture build (founder go-ahead 2026-11-21, review-only).
 * Bundles the REAL PersistentListeningProvider (one player, output lease, level, dock) with the real
 * SoundAtlasDesk and listen.module.css into a static folder. No Next, no session, no network, no recorded media.
 * Serve the folder from 127.0.0.1 (Web Locks need a secure context) to listen or to witness in a browser.
 *   node tests/listening/sound_atlas_fixture.cjs <outDir>            build only
 *   node tests/listening/sound_atlas_fixture.cjs <outDir> --serve    build, then serve on http://127.0.0.1:8752/
 */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const esbuild = require('esbuild');

const repo = path.resolve(__dirname, '../..');
const outArg = process.argv.slice(2).find(a => !a.startsWith('--'));
const out = path.resolve(outArg || path.join(require('node:os').tmpdir(), 'soullab-sound-atlas-fixture'));
fs.mkdirSync(out, { recursive: true });

fs.writeFileSync(path.join(out, 'entry.jsx'), `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {PersistentListeningProvider} from ${JSON.stringify(path.join(repo, 'components/listening/PersistentListeningProvider.tsx'))};
import SoundAtlasDesk from ${JSON.stringify(path.join(repo, 'app/listen/SoundAtlasDesk.tsx'))};
function App(){
  const [room,setRoom]=useState('lab');
  return <PersistentListeningProvider reviewMemberKey="11111111-2222-4333-8444-555555555555">
    <nav className="fixtureNav" aria-label="Fixture navigation">
      <button onClick={()=>setRoom('lab')}>Sound Studio · Library</button>
      <button onClick={()=>setRoom('other')}>Another room</button>
      <span>REVIEW FIXTURE · NOT DEPLOYED</span>
    </nav>
    <main className="fixtureMain">{room==='lab' ? <SoundAtlasDesk/> : <p data-other-room="true">Another Soullab room. The player stays mounted above it.</p>}</main>
  </PersistentListeningProvider>;
}
createRoot(document.getElementById('app')).render(<App/>);
`);
fs.writeFileSync(path.join(out, 'next-link-shim.jsx'),
  "import React from 'react'; export default function Link({href,children,...rest}){return <a href={href} {...rest}>{children}</a>}");

(async () => {
  await esbuild.build({
    entryPoints: [path.join(out, 'entry.jsx')], outdir: out, entryNames: 'bundle', bundle: true, format: 'iife',
    platform: 'browser', jsx: 'automatic', target: 'es2022',
    alias: {
      '@': repo,
      'react': require.resolve('react'),
      'react-dom/client': require.resolve('react-dom/client'),
      'react/jsx-runtime': require.resolve('react/jsx-runtime'),
    },
    loader: { '.css': 'local-css' },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'next-link-shim', setup(b) { b.onResolve({ filter: /^next\/link$/ }, () => ({ path: path.join(out, 'next-link-shim.jsx') })); } }],
    logLevel: 'error',
  });
  fs.writeFileSync(path.join(out, 'index.html'),
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Living Library · review fixture</title><link rel="stylesheet" href="/bundle.css">' +
    '<style>body{margin:0;background:#071015;color:#efe9dc;font:15px Inter,system-ui,sans-serif}' +
    '.fixtureNav{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid rgba(241,225,193,.16);font-size:11px;letter-spacing:.12em;color:#b3b3ac}' +
    '.fixtureNav button{font:inherit;letter-spacing:0;font-size:13px;background:transparent;color:#ead7b5;border:1px solid #6e6153;border-radius:20px;padding:8px 12px}' +
    '.fixtureMain{max-width:1260px;margin:0 auto;padding:24px 16px 160px}</style>' +
    '</head><body><div id="app"></div><script src="/bundle.js"></script></body></html>');
  if (!process.argv.includes('--serve')) { console.log(out); return; }
  // --serve: listen locally on this Mac only (loopback), until Ctrl-C.
  const http = require('node:http'), types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  http.createServer((req, res) => {
    const file = path.join(out, req.url === '/' ? 'index.html' : path.normalize(req.url).replace(/^[/\\]+/, ''));
    if (!file.startsWith(out) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  }).listen(8752, '127.0.0.1', () => console.log('Living Library review fixture: http://127.0.0.1:8752/  (Ctrl-C to stop)'));
})().catch(e => { console.error(e); process.exit(1); });
