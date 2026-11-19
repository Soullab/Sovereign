/** SOULLAB SHELF LIVE VIEW · founder listening harness (#1979).
 * Serves the REAL app/listen/ReceptiveFieldDesk.tsx inside the REAL PersistentListeningProvider on 127.0.0.1,
 * so the founder can hear a field and watch the live view before it is deployed. No session, no network.
 *   node tests/listening/shelf_live_view_founder_harness.cjs [port]
 */
'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');
const esbuild = require('esbuild');
const repo = path.resolve(__dirname, '../..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soullab-shelf-live-'));

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
    res.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(Number(process.argv[2] || 4720), '127.0.0.1', r));
  console.log(`Shelf live view harness: http://127.0.0.1:${server.address().port}/`);
})().catch((e) => { console.error(e); process.exit(2); });
