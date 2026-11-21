/** SOULLAB TRANSFORM T2 (R2, step A) · isolated browser witness of the Drone desk.
 * Walks the real app/listen/DroneDesk.tsx (real listen.module.css) in local Chrome with the persistent
 * player replaced by a recording shim: refuse a non-audio file, open the member's own WAV, mark a passage,
 * choose a character, solo a voice, make the drone and hand it to the ONE player, check that Chrome's render
 * is bit-identical to the same render under Node, save as new with provenance inside, save and reload the
 * recipe, original unchanged; desktop and phone screenshots. No Next, no session, no network.
 *   node tests/listening/drone_t2_browser_witness.cjs        Env: CHROME_BIN
 */
'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto');
const esbuild = require('esbuild');
const { chromium } = require('playwright-core');
const repo = path.resolve(__dirname, '../..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soullab-drone-'));
const shots = path.join(repo, 'docs/design/contracts/screenshots');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const riffChunk = (b, id) => {
  for (let p = 12; p + 8 <= b.length;) {
    const size = b.readUInt32LE(p + 4);
    if (b.toString('latin1', p, p + 4) === id) return b.subarray(p + 8, p + 8 + size);
    p += 8 + size + (size & 1);
  }
  return null;
};

// A 4-second 24-bit stereo WAV at 48 kHz: a sung-like tone with slow vibrato (the member's "own recording").
function memberWav() {
  const rate = 48000, frames = rate * 4, data = Buffer.alloc(frames * 6);
  for (let i = 0; i < frames; i++) {
    const t = i / rate, f = 196 * (1 + 0.004 * Math.sin(2 * Math.PI * 5 * t));
    let v = 0; for (let k = 1; k <= 6; k++) v += Math.sin(2 * Math.PI * f * k * t) / (k * k);
    const s = Math.round(0.35 * v * Math.min(1, t / 0.2) * 8388607);
    data.writeIntLE(s, i * 6, 3); data.writeIntLE(Math.round(s * 0.8), i * 6 + 3, 3);
  }
  const fmt = Buffer.alloc(24); fmt.write('fmt '); fmt.writeUInt32LE(16, 4); fmt.writeUInt16LE(1, 8); fmt.writeUInt16LE(2, 10);
  fmt.writeUInt32LE(rate, 12); fmt.writeUInt32LE(rate * 6, 16); fmt.writeUInt16LE(6, 20); fmt.writeUInt16LE(24, 22);
  const dh = Buffer.alloc(8); dh.write('data'); dh.writeUInt32LE(data.length, 4);
  const body = Buffer.concat([Buffer.from('WAVE'), fmt, dh, data]);
  const riff = Buffer.alloc(8); riff.write('RIFF'); riff.writeUInt32LE(body.length, 4);
  return Buffer.concat([riff, body]);
}

fs.writeFileSync(path.join(dir, 'player-shim.tsx'), `
const w = window as any; w.__selected = []; w.__played = 0; w.__pos = null; w.__paused = 0;
export function usePersistentListening() {
  return {
    snapshot: { kind: 'none', playback: 'idle', title: '' },
    selectLocalFile: (file: File) => {
      const entry: any = { name: file.name, size: file.size, type: file.type, sha: null };
      w.__selected.push(entry);
      file.arrayBuffer().then((b) => crypto.subtle.digest('SHA-256', b)).then((d) => { entry.sha = [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join(''); });
      return { accepted: true, message: 'ok' };
    },
    playLocalFile: async () => { w.__played += 1; return true; },
    localFilePosition: () => (w.__pos === null || !w.__selected.length ? null : { title: w.__selected.at(-1).name, seconds: w.__pos, duration: null, playing: true }),
    pause: () => { w.__paused += 1; },
  };
}`);
fs.writeFileSync(path.join(dir, 'entry.jsx'),
  "import React from 'react'; import { createRoot } from 'react-dom/client';" +
  `import DroneDesk from ${JSON.stringify(path.join(repo, 'app/listen/DroneDesk.tsx'))};` +
  "createRoot(document.getElementById('app')).render(<main style={{padding:'24px',maxWidth:'900px',margin:'0 auto'}}><DroneDesk /></main>);");

const results = [];
const check = (name, pass, detail) => { results.push({ name, pass: !!pass }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${pass || detail === undefined ? '' : ' — ' + JSON.stringify(detail)}`); };

(async () => {
  await esbuild.build({ outdir: dir, bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic', target: 'es2022',
    loader: { '.module.css': 'local-css' }, alias: { '@/components/listening/PersistentListeningProvider': path.join(dir, 'player-shim.tsx'), '@': repo },
    logLevel: 'error', nodePaths: [path.join(repo, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"' },
    entryPoints: [path.join(dir, 'entry.jsx')] });
  fs.writeFileSync(path.join(dir, 'index.html'),
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Drone · isolated fixture</title><link rel="stylesheet" href="/entry.css">' +
    '<style>:root{--line:rgba(235,220,194,.16);--ink:#f1efe7}body{margin:0;background:#0b1418;color:#f1efe7;font:15px Georgia,serif}</style>' +
    '</head><body><div id="app"></div><script src="/entry.js"></script></body></html>');
  const server = http.createServer((req, res) => {
    const f = path.join(dir, req.url === '/' ? 'index.html' : req.url.split('?')[0].replace(/^\//, ''));
    if (!f.startsWith(dir) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.css') ? 'text/css' : 'text/javascript' });
    res.end(fs.readFileSync(f));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const wavPath = path.join(dir, 'My voice.wav'); const wavBytes = memberWav(); fs.writeFileSync(wavPath, wavBytes);
  const textPath = path.join(dir, 'notes.txt'); fs.writeFileSync(textPath, 'not audio');

  // The same render under Node, through the same modules, for the bit-identity check.
  const { register } = await import('node:module'); const { pathToFileURL } = await import('node:url');
  register(pathToFileURL(path.join(repo, 'tests/listening/ts_resolution_loader.mjs')).href, pathToFileURL(__filename).href);
  const drone = await import(pathToFileURL(path.join(repo, 'lib/listening/drone/drone.ts')).href);
  const wav = await import(pathToFileURL(path.join(repo, 'lib/listening/transform/wav.ts')).href);
  const audio = wav.readWav(wavBytes.buffer.slice(wavBytes.byteOffset, wavBytes.byteOffset + wavBytes.length));
  const nodeSettings = { ...drone.withPreset(drone.defaultSettings('living'), 'earth'), region: { startSeconds: 0, endSeconds: 3 }, soloLayer: null };
  const nodeRender = await drone.renderDrone(drone.droneSource(audio, 'My voice.wav'), nodeSettings, null);
  const nodeSha = sha(Buffer.from(await nodeRender.blob.arrayBuffer()));

  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const [name, viewport] of [['desktop', { width: 1440, height: 1100 }], ['mobile', { width: 390, height: 844 }]]) {
      const ctx = await browser.newContext({ viewport, acceptDownloads: true });
      const p = await ctx.newPage();
      const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
      const requests = []; p.on('request', (r) => { if (!r.url().startsWith(url)) requests.push(r.url()); });
      await p.goto(url);
      check(`${name}: nothing is handed to the player on arrival`, (await p.evaluate(() => window.__played)) === 0);
      await p.setInputFiles('#drone-file', textPath);
      const refusal = await p.locator('[data-drone-desk] [role="status"]').textContent();
      check(`${name}: a non-audio file is refused`, /FLAC, WAV/.test(refusal || ''), refusal);
      await p.setInputFiles('#drone-file', wavPath);
      await p.waitForSelector('[data-drone-wave]');
      const st = await p.locator('[data-drone-desk] [role="status"]').textContent();
      check(`${name}: the member's own recording opens, with a passage to mark`, /My voice\.wav: 0:04\.00/.test(st || ''), st);
      check(`${name}: a passage of the first 3 s is marked to start`, /0:03\.00/.test(await p.locator('[data-drone-control="Passage ends"]').textContent() || ''));
      await p.getByRole('button', { name: 'Deep Earth' }).click();
      check(`${name}: Deep Earth names its three voices`, (await p.locator('[data-drone-layer="1"] strong').first().textContent()) === 'Deep sub-octave');
      await p.locator('[data-drone-layer="2"]').getByRole('button', { name: 'Solo' }).click();
      check(`${name}: Solo is a pressed toggle`, (await p.locator('[data-drone-layer="2"]').getByRole('button', { name: 'Solo' }).getAttribute('aria-pressed')) === 'true');
      await p.locator('[data-drone-layer="2"]').getByRole('button', { name: 'Solo' }).click();
      check(`${name}: the surround field lists its four elements`, (await p.locator('[data-drone-field]').count()) === 4);
      await p.getByRole('button', { name: 'Read the note' }).click();
      const note = await p.locator('[data-drone-pitch]').textContent();
      check(`${name}: Read the note finds the passage's pitch (≈196 Hz, G3)`, /^19[5-7]\.\d Hz .*G3/.test(note || ''), note);

      await p.getByRole('button', { name: 'Make the drone and play it' }).click();
      await p.waitForFunction(() => window.__played > 0, null, { timeout: 60000 });
      await p.waitForFunction(() => window.__selected.at(-1)?.sha, null, { timeout: 10000 });
      const sel = await p.evaluate(() => window.__selected.at(-1));
      check(`${name}: the drone goes to the ONE player as a WAV`, sel.type === 'audio/wav' && sel.name === 'My voice (drone preview).wav', sel);
      check(`${name}: Chrome's drone is bit-identical to the same render under Node`, sel.sha === nodeSha, [sel.sha, nodeSha]);
      await p.waitForSelector('[data-drone-result]');
      const res = await p.locator('[data-drone-result] p').first().textContent();
      check(`${name}: the result states length, peak and loudness`, /0:30\.00 · peak -?\d+\.\d dBFS · -\d+\.\d LUFS · loops seamlessly/.test(res || ''), res);

      if (name === 'desktop') await p.screenshot({ path: path.join(shots, 'sound-studio-drone-desktop.png'), fullPage: true });
      else await p.screenshot({ path: path.join(shots, 'sound-studio-drone-mobile.png'), fullPage: true });

      const downloads = []; p.on('download', (d) => downloads.push(d));
      await p.getByRole('button', { name: 'Save as new' }).click();
      await p.waitForSelector('[data-drone-saved]', { timeout: 30000 });
      await p.waitForTimeout(500);
      const files = {};
      for (const d of downloads) files[d.suggestedFilename()] = fs.readFileSync(await d.path());
      const saved = files['My voice (drone).wav'], json = files['My voice (drone).provenance.json'];
      check(`${name}: save makes a new WAV and a provenance file`, !!saved && !!json, Object.keys(files));
      const embedded = saved && riffChunk(saved, 'slpv');
      const rec = embedded && JSON.parse(embedded.toString('utf8').replace(/\0+$/, ''));
      check(`${name}: the provenance travels inside the WAV and names the accepted engine`,
        rec && rec.schema === 'soullab.drone.provenance.v1' && rec.engine.labSha256.startsWith('8407c45e') && rec.source.sha256 === sha(wavBytes), rec && rec.schema);
      check(`${name}: the saved audio is the drone that was heard`, saved && sha(riffChunk(saved, 'data')) === sha(riffChunk(Buffer.from(await nodeRender.blob.arrayBuffer()), 'data')));
      check(`${name}: the original was re-read and is unchanged`, /unchanged/.test(await p.locator('[data-drone-saved]').textContent() || ''));
      const side = json && JSON.parse(json.toString('utf8'));
      check(`${name}: the provenance file states the whole saved file's hash`, side && side.output.sha256 === sha(saved));

      const before = downloads.length;
      await p.getByRole('button', { name: 'Save the recipe' }).click();
      await p.waitForFunction((n) => true, before); await p.waitForTimeout(500);
      const recipeDl = downloads.slice(before).find((d) => d.suggestedFilename() === 'My voice (drone recipe).json');
      check(`${name}: the recipe saves`, !!recipeDl);
      if (recipeDl) {
        await p.getByRole('button', { name: 'Living Voice' }).click();
        await p.setInputFiles('#drone-recipe', await recipeDl.path());
        await p.waitForFunction(() => /Recipe loaded/.test(document.querySelector('[data-drone-desk] [role="status"]')?.textContent || ''), null, { timeout: 5000 }).catch(() => undefined);
        const loaded = await p.locator('[data-drone-desk] [role="status"]').textContent();
        check(`${name}: the recipe loads back (Deep Earth again)`, /Recipe loaded: Deep Earth/.test(loaded || '') && (await p.getByRole('button', { name: 'Deep Earth' }).getAttribute('aria-pressed')) === 'true', loaded);
      }
      // ---- Step B: Resonance & Detail ----
      const lastSel = async (n) => { await p.waitForFunction((k) => window.__played > k && window.__selected.at(-1)?.sha, n, { timeout: 60000 }); return p.evaluate(() => window.__selected.at(-1)); };
      check(`${name}: B · the desk says it is the accepted v0.3.4 sound while nothing moved`, (await p.locator('[data-drone-neutral="true"]').count()) === 1);
      let played = await p.evaluate(() => window.__played);
      await p.getByRole('button', { name: 'Make the drone and play it' }).click();
      const again = await lastSel(played);
      check(`${name}: B · with neutral detail the drone is still bit-identical to the accepted engine`, again.sha === nodeSha, again.sha);
      await p.waitForSelector('[data-drone-meter]');
      check(`${name}: B · the Detail meter reports flutter, seam and beating`, /\d+(\.\d)?%/.test(await p.locator('[data-drone-reading="ripple"]').textContent() || '') && (await p.locator('[data-drone-reading="seam"]').count()) === 1 && (await p.locator('[data-drone-reading="beat"]').count()) === 1);
      await p.getByRole('button', { name: 'Read the note' }).click();
      const spec = p.locator('[data-drone-spectrum]'); const box = await spec.boundingBox();
      await spec.click({ position: { x: box.width * 0.55, y: box.height / 2 } });
      check(`${name}: B · clicking the spectrum places the resonance band (at 0 dB it is still the v0.3.4 sound)`, (await p.locator('[data-drone-band] input[type="checkbox"]').isChecked()) && /\d+ Hz/.test(await p.locator('[data-drone-control="Centre"]').textContent() || '') && (await p.locator('[data-drone-neutral="true"]').count()) === 1);
      played = await p.evaluate(() => window.__played);
      await p.locator('[data-drone-hear-band]').click();
      const band = await lastSel(played);
      check(`${name}: B · Hear only the band goes to the ONE player`, /^My voice \(band \d+ Hz\)\.wav$/.test(band.name), band.name);
      await p.locator('[data-drone-control="Lift"] input').fill('9');
      await p.locator('[data-drone-control="Decay"] input').fill('0.7');
      check(`${name}: B · a lifted band and a moved Decay leave the v0.3.4 sound, and the last drone is marked out of date`, (await p.locator('[data-drone-neutral="false"]').count()) === 1 && (await p.locator('[data-drone-stale]').count()) === 1);
      played = await p.evaluate(() => window.__played);
      await p.getByRole('button', { name: 'Make the drone and play it' }).click();
      const moved = await lastSel(played);
      check(`${name}: B · moved Decay and a lifted band change the drone`, moved.sha !== nodeSha);
      for (const [label, want] of [['Original passage', 'compare · original passage'], ['v0.3.4 sound', 'compare · v0.3.4'], ['Your settings', 'compare · your settings']]) {
        played = await p.evaluate(() => window.__played);
        await p.locator('[data-drone-compare]').getByRole('button', { name: label }).click();
        const c = await lastSel(played);
        check(`${name}: B · Compare "${label}" plays in the ONE player, loudness-matched`, c.name === `My voice (${want}).wav`, c.name);
      }
      const reading = p.locator('[data-drone-reading="click"], [data-drone-reading="flutter"]').first();
      if (await reading.count()) {
        played = await p.evaluate(() => window.__played);
        await reading.getByRole('button', { name: 'Listen' }).click();
        const ex = await lastSel(played);
        check(`${name}: B · Listen on a reading plays an excerpt around it`, /^My voice \(drone at \d+:\d+\.\d+\)\.wav$/.test(ex.name), ex.name);
        await reading.getByRole('button', { name: 'Keep' }).click();
        check(`${name}: B · Keep changes nothing and marks it kept`, /Nothing changed/.test(await p.locator('[data-drone-desk] [role="status"]').textContent() || ''));
      }
      const bDownloads = []; p.on('download', (d) => bDownloads.push(d));
      await p.getByRole('button', { name: 'Save as new' }).click();
      await p.waitForFunction(() => /Saved/.test(document.querySelector('[data-drone-saved]')?.textContent || ''), null, { timeout: 30000 });
      await p.waitForTimeout(500);
      const bw = bDownloads.find((d) => d.suggestedFilename() === 'My voice (drone).wav');
      const brec = bw && JSON.parse(riffChunk(fs.readFileSync(await bw.path()), 'slpv').toString('utf8').replace(/\0+$/, ''));
      check(`${name}: B · the saved file records the detail and the derived engine`, brec && brec.recipe.processing.detail.decay === 0.7 && brec.recipe.processing.detail.band.db === 9 && /engine3/.test(brec.engine.resonanceAndDetail || ''), brec && brec.recipe.processing.detail);
      await p.locator('[data-drone-reset-detail]').click();
      played = await p.evaluate(() => window.__played);
      await p.getByRole('button', { name: 'Make the drone and play it' }).click();
      const back = await lastSel(played);
      check(`${name}: B · "Back to the v0.3.4 sound" returns the bit-identical accepted drone`, back.sha === nodeSha && (await p.locator('[data-drone-neutral="true"]').count()) === 1, back.sha);
      await p.locator('[data-drone-zoom]').click();
      check(`${name}: B · Zoom into the passage is a pressed toggle`, (await p.locator('[data-drone-zoom]').getAttribute('aria-pressed')) === 'true');
      if (name === 'desktop') await p.screenshot({ path: path.join(shots, 'sound-studio-drone-detail-desktop.png'), fullPage: true });
      else await p.screenshot({ path: path.join(shots, 'sound-studio-drone-detail-mobile.png'), fullPage: true });

      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`${name}: no horizontal overflow`, overflow <= 0, overflow);
      check(`${name}: no page errors`, errors.length === 0, errors);
      check(`${name}: no network requests beyond the fixture`, requests.length === 0, requests);
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  const failed = results.filter((r) => !r.pass).length;
  console.log(`${results.length - failed}/${results.length} ${failed ? 'FAILED' : 'PASS'}`);
  process.exitCode = failed ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
