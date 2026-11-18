/** SOULLAB TRANSFORM T1 · founder listening harness (local only).
 * Serves the REAL app/listen/TransformDesk.tsx (real stylesheet) on 127.0.0.1 with a small stand-in
 * for the persistent player that really plays the preview through one <audio> element, so the founder
 * can hear the result. Not /listen, not authenticated, no network beyond loopback.
 *   node tests/listening/transform_t1_founder_harness.cjs [port]
 */
'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');
const esbuild = require('esbuild');
const repo = path.resolve(__dirname, '../..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soullab-transform-harness-'));
fs.writeFileSync(path.join(dir, 'player.tsx'), `
import React from 'react';
let el: HTMLAudioElement | null = null; let url: string | null = null;
export function usePersistentListening() {
  return {
    snapshot: { kind: 'none', playback: 'idle', title: '' },
    selectLocalFile: (file: File) => {
      if (!el) { el = document.createElement('audio'); el.controls = true; el.style.width = '100%'; document.getElementById('player')!.append(el); }
      if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(file); el.src = url;
      document.getElementById('playerTitle')!.textContent = file.name;
      return { accepted: true, message: 'ok' };
    },
    playLocalFile: async () => { await el?.play(); return true; },
  };
}`);
fs.writeFileSync(path.join(dir, 'entry.jsx'),
  "import React from 'react'; import { createRoot } from 'react-dom/client';" +
  `import TransformDesk from ${JSON.stringify(path.join(repo, 'app/listen/TransformDesk.tsx'))};` +
  "createRoot(document.getElementById('app')).render(<TransformDesk />);");
(async () => {
  await esbuild.build({ entryPoints: [path.join(dir, 'entry.jsx')], outdir: dir, bundle: true, format: 'iife', platform: 'browser',
    jsx: 'automatic', target: 'es2022', loader: { '.module.css': 'local-css' },
    alias: { '@/components/listening/PersistentListeningProvider': path.join(dir, 'player.tsx'), '@': repo },
    logLevel: 'error', nodePaths: [path.join(repo, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"' } });
  fs.writeFileSync(path.join(dir, 'index.html'),
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Soullab Transform · founder listening harness</title><link rel="stylesheet" href="/entry.css">' +
    '<style>body{margin:0;background:#0b1418;color:#f1efe7;font:15px Georgia,serif}main{max-width:900px;margin:0 auto;padding:24px}' +
    '.bar{position:sticky;bottom:0;background:#071217;border-top:1px solid #2b3a3f;padding:12px 24px}.note{color:#9aafb0;font-size:13px}</style>' +
    '</head><body><main><p class="note">Founder listening harness — the real Transform desk; the player below stands in for Sound Studio\'s persistent player. Local only.</p><div id="app"></div></main>' +
    '<div class="bar"><div class="note">Player · <span id="playerTitle">nothing selected</span></div><div id="player"></div></div><script src="/entry.js"></script></body></html>');
  const server = http.createServer((req, res) => {
    const f = path.join(dir, req.url === '/' ? 'index.html' : req.url.split('?')[0].replace(/^\//, ''));
    if (!f.startsWith(dir) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' });
    fs.createReadStream(f).pipe(res);
  });
  const port = Number(process.argv[2] || 4719);
  server.listen(port, '127.0.0.1', () => console.log(`Transform harness: http://127.0.0.1:${port}/`));
})();
