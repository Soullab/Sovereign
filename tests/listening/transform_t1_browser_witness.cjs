/** SOULLAB TRANSFORM T1 · isolated browser witness.
 * 1. Measures the shaping steps (EQ, filters, reverb) through Chrome's real OfflineAudioContext.
 * 2. Walks the real app/listen/TransformDesk.tsx (real listen.module.css) with the persistent player
 *    replaced by a recording shim: choose a WAV, add steps, preview, save as new, original unchanged,
 *    refusal of a non-audio file, desktop and phone screenshots. No Next, no session, no network.
 *   node tests/listening/transform_t1_browser_witness.cjs        Env: CHROME_BIN
 */
'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto');
const esbuild = require('esbuild');
const { chromium } = require('playwright-core');
const repo = path.resolve(__dirname, '../..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soullab-transform-'));
const shots = path.join(repo, 'docs/design/contracts/screenshots');
const { execFileSync } = require('node:child_process');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const riffChunk = (b, id) => { // the body of one RIFF chunk, or null
  for (let p = 12; p + 8 <= b.length;) {
    const size = b.readUInt32LE(p + 4);
    if (b.toString('latin1', p, p + 4) === id) return b.subarray(p + 8, p + 8 + size);
    p += 8 + size + (size & 1);
  }
  return null;
};

// A 4-second 24-bit stereo WAV with a BWF bext chunk, like a Soullab Capture take.
const CAPTURE_TAKE_ID = '2026-11-17T18-40-38Z-j4b1';
function captureLikeWav() {
  const rate = 44100, frames = rate * 4, data = Buffer.alloc(frames * 6);
  for (let i = 0; i < frames; i++) {
    const v = Math.round(0.4 * Math.sin(2 * Math.PI * 220 * i / rate) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.5 * i / rate)) * 8388607);
    data.writeIntLE(v, i * 6, 3); data.writeIntLE(v, i * 6 + 3, 3);
  }
  const fmt = Buffer.alloc(24); fmt.write('fmt '); fmt.writeUInt32LE(16, 4); fmt.writeUInt16LE(1, 8); fmt.writeUInt16LE(2, 10);
  fmt.writeUInt32LE(rate, 12); fmt.writeUInt32LE(rate * 6, 16); fmt.writeUInt16LE(6, 20); fmt.writeUInt16LE(24, 22);
  // The bext fields Soullab Capture writes (WAVLayout.swift / CaptureSession.swift), so the desk sees a real Capture origin (J4b-1).
  const bext = Buffer.alloc(8 + 602); bext.write('bext'); bext.writeUInt32LE(602, 4);
  bext.write(`Soullab Capture take ${CAPTURE_TAKE_ID}`, 8, 256, 'latin1'); bext.write('Soullab Capture', 8 + 256, 32, 'latin1');
  bext.write('2026-11-17', 8 + 320, 10, 'latin1'); bext.write('18:40:38', 8 + 330, 8, 'latin1');
  const dh = Buffer.alloc(8); dh.write('data'); dh.writeUInt32LE(data.length, 4);
  const body = Buffer.concat([Buffer.from('WAVE'), fmt, bext, dh, data]);
  const riff = Buffer.alloc(8); riff.write('RIFF'); riff.writeUInt32LE(body.length, 4);
  return Buffer.concat([riff, body]);
}

fs.writeFileSync(path.join(dir, 'player-shim.tsx'), `
import React from 'react';
const w = window as any; w.__selected = []; w.__played = 0; w.__pos = null; w.__paused = 0;
let snap: any = { kind: 'none', playback: 'idle', title: '' };
export function usePersistentListening() {
  return {
    snapshot: snap,
    selectLocalFile: (file: File) => { w.__selected.push({ name: file.name, size: file.size, type: file.type }); return { accepted: true, message: 'ok' }; },
    playLocalFile: async () => { w.__played += 1; return true; },
    // The real player reports the member's local file position read-only; the witness sets it.
    localFilePosition: () => (w.__pos === null || !w.__selected.length ? null : { title: w.__selected.at(-1).name, seconds: w.__pos, duration: null, playing: true }),
    pause: () => { w.__paused += 1; },
  };
}`);
fs.writeFileSync(path.join(dir, 'engine.ts'),
  `import { renderRecipe } from ${JSON.stringify(path.join(repo, 'lib/listening/transform/render.ts'))};` +
  `(window as any).__T = { renderRecipe };`);
fs.writeFileSync(path.join(dir, 'entry.jsx'),
  "import React from 'react'; import { createRoot } from 'react-dom/client';" +
  `import TransformDesk from ${JSON.stringify(path.join(repo, 'app/listen/TransformDesk.tsx'))};` +
  "createRoot(document.getElementById('app')).render(<main style={{padding:'24px',maxWidth:'900px',margin:'0 auto'}}><TransformDesk /></main>);");

(async () => {
  const common = { outdir: dir, bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic', target: 'es2022',
    loader: { '.module.css': 'local-css' }, alias: { '@/components/listening/PersistentListeningProvider': path.join(dir, 'player-shim.tsx'), '@': repo },
    logLevel: 'error', nodePaths: [path.join(repo, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"' } };
  await esbuild.build({ ...common, entryPoints: [path.join(dir, 'entry.jsx'), path.join(dir, 'engine.ts')] });
  fs.writeFileSync(path.join(dir, 'index.html'),
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Transform · isolated fixture</title><link rel="stylesheet" href="/entry.css">' +
    '<style>:root{--line:rgba(235,220,194,.16);--ink:#f1efe7}body{margin:0;background:#0b1418;color:#f1efe7;font:15px Georgia,serif}</style>' +
    '</head><body><div id="app"></div><script src="/engine.js"></script><script src="/entry.js"></script></body></html>');
  const server = http.createServer((req, res) => {
    const f = path.join(dir, req.url === '/' ? 'index.html' : req.url.split('?')[0].replace(/^\//, ''));
    if (!f.startsWith(dir) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const checks = [];
  const check = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });
  try {
    // ── 1. Shaping steps measured in Chrome's real Web Audio ──────────────────
    const page = await browser.newPage();
    await page.goto(base);
    const m = await page.evaluate(async () => {
      const rate = 44100;
      const tone = (hz, secs = 1) => ({ sampleRate: rate, channels: [Float32Array.from({ length: rate * secs }, (_, i) => 0.25 * Math.sin(2 * Math.PI * hz * i / rate))] });
      const level = (a, hz) => { // least-squares amplitude at hz over the steady part
        const c = a.channels[0]; let I = 0, Q = 0, n = 0;
        for (let i = Math.round(0.2 * rate); i < Math.round(0.9 * rate); i++) { I += c[i] * Math.sin(2 * Math.PI * hz * i / rate); Q += c[i] * Math.cos(2 * Math.PI * hz * i / rate); n++; }
        return 20 * Math.log10((2 * Math.hypot(I, Q) / n) / 0.25);
      };
      const R = (a, steps) => window.__T.renderRecipe(a, steps, { Offline: OfflineAudioContext });
      const eqOf = (hz, step) => R(tone(hz), [step]).then((o) => level(o, hz));
      const out = {};
      out.midAt1k = await eqOf(1000, { kind: 'eq', lowDb: 0, midDb: 6, midHz: 1000, highDb: 0 });
      out.lowAt40 = await eqOf(40, { kind: 'eq', lowDb: 6, midDb: 0, midHz: 1000, highDb: 0 });
      out.highAt16k = await eqOf(16000, { kind: 'eq', lowDb: 0, midDb: 0, midHz: 1000, highDb: 6 });
      out.flatAt1k = await eqOf(1000, { kind: 'eq', lowDb: 0, midDb: 0, midHz: 1000, highDb: 0 });
      out.hp1kAt100 = await eqOf(100, { kind: 'filter', highpassHz: 1000, lowpassHz: null });
      out.hp1kAt10k = await eqOf(10000, { kind: 'filter', highpassHz: 1000, lowpassHz: null });
      out.lp1kAt10k = await eqOf(10000, { kind: 'filter', highpassHz: null, lowpassHz: 1000 });
      const imp = { sampleRate: rate, channels: [Float32Array.from({ length: rate }, (_, i) => (i === 0 ? 1 : 0))] };
      const rv1 = await R(imp, [{ kind: 'reverb', space: 'hall', mix: 1 }]);
      const rv2 = await R(imp, [{ kind: 'reverb', space: 'hall', mix: 1 }]);
      out.reverbChannels = rv1.channels.length;
      out.reverbFrames = rv1.channels[0].length;
      out.reverbDeterministic = rv1.channels[0].every((v, i) => v === rv2.channels[0][i]);
      out.reverbHasTail = Math.max(...Array.from(rv1.channels[0].slice(rate, rate + 4410)).map(Math.abs)) > 0;
      const r48 = await R({ sampleRate: 48000, channels: [new Float32Array(48000)] }, [{ kind: 'filter', highpassHz: 40, lowpassHz: null }]);
      out.rateKept = r48.sampleRate;
      return out;
    });
    check('EQ middle band +6 dB at 1 kHz', Math.abs(m.midAt1k - 6) < 0.2, m.midAt1k);
    check('EQ low shelf ≈ +6 dB at 40 Hz', Math.abs(m.lowAt40 - 6) < 0.6, m.lowAt40);
    check('EQ high shelf ≈ +6 dB at 16 kHz', Math.abs(m.highAt16k - 6) < 0.6, m.highAt16k);
    check('a flat EQ leaves 1 kHz unchanged', Math.abs(m.flatAt1k) < 0.05, m.flatAt1k);
    check('high-pass at 1 kHz removes 100 Hz (< −30 dB)', m.hp1kAt100 < -30, m.hp1kAt100);
    check('high-pass at 1 kHz passes 10 kHz (±0.5 dB)', Math.abs(m.hp1kAt10k) < 0.5, m.hp1kAt10k);
    check('low-pass at 1 kHz removes 10 kHz (< −30 dB)', m.lp1kAt10k < -30, m.lp1kAt10k);
    check('reverb is stereo, with the hall tail appended', m.reverbChannels === 2 && m.reverbFrames === 44100 + Math.round(0.024 * 44100) + Math.round(2.4 * 44100), m.reverbFrames);
    check('reverb is deterministic and rings past the source', m.reverbDeterministic && m.reverbHasTail);
    check('shaping keeps the recording\'s own sample rate (48 kHz in, 48 kHz out)', m.rateKept === 48000, m.rateKept);
    await page.close();

    // ── 2. The real desk, walked ─────────────────────────────────────────────
    const wav = captureLikeWav();
    const wavPath = path.join(dir, 'Soullab Capture 2026-11-17 18.40.38.wav'); fs.writeFileSync(wavPath, wav);
    const textPath = path.join(dir, 'notes.txt'); fs.writeFileSync(textPath, 'not audio');
    for (const [name, viewport] of [['desktop', { width: 1440, height: 1100 }], ['mobile', { width: 390, height: 844 }]]) {
      const ctx = await browser.newContext({ viewport, acceptDownloads: true });
      const p = await ctx.newPage();
      const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
      await p.goto(base);
      await p.setInputFiles('#transform-file', textPath);
      const refusal = await p.locator('[role=status]').textContent();
      check(`${name}: a non-audio file is refused`, /FLAC, WAV/.test(refusal || ''), refusal);
      await p.setInputFiles('#transform-file', wavPath);
      await p.waitForSelector('[data-transform-desk] canvas');
      const origin = await p.locator('[data-capture-origin]').textContent().catch(() => null);
      check(`${name}: a Capture take is named as one, with when it was recorded (J4b-1)`,
        origin === 'A Soullab Capture take, recorded on 2026-11-17 18:40. A new file you save records where it came from.', origin);
      const pick = async (kind) => p.selectOption('select:near(:text("Add a step"))', kind).catch(() => p.locator('label:has-text("Add a step") select').selectOption(kind));
      for (const k of ['trim', 'fade', 'eq', 'reverb', 'normalize']) await pick(k);
      await p.locator('[data-time-field="trim-end"]').fill('0:03'); await p.locator('[data-time-field="trim-end"]').press('Enter');
      await p.locator('[data-transform-step="eq"] input').nth(1).fill('4');
      check(`${name}: five steps listed in order`, (await p.locator('[data-transform-step]').count()) === 5);
      const ruler = await p.locator('[data-transform-ruler] em').allTextContents();
      check(`${name}: the waveform carries a time ruler`, ruler[0] === '0:00' && ruler.length >= 4 && ruler.includes('0:02'), ruler);
      await p.locator('[data-transform-step="trim"] strong').first().click();
      const tf = (n) => p.locator(`[data-time-field="${n}"]`).inputValue();
      check(`${name}: trim reads as times on the recording`, (await tf('trim-start')) === '0:00.00' && (await tf('trim-end')) === '0:03.00', [await tf('trim-start'), await tf('trim-end')]);
      await p.locator('[data-transform-wave]').scrollIntoViewIfNeeded();
      const box = await p.locator('[data-transform-wave]').boundingBox();
      await p.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2); await p.mouse.down();
      await p.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 6 }); await p.mouse.up();
      const dragged = await tf('trim-end');
      check(`${name}: dragging the end handle on the waveform moves the trim end`, /^0:0(1\.9[5-9]|2\.0[0-5])$/.test(dragged), dragged);
      await p.locator('[data-time-field="trim-end"]').fill('0:03'); await p.locator('[data-time-field="trim-end"]').press('Enter');
      await p.locator('[data-transform-step="fade"] strong').first().click();
      check(`${name}: fade reads as times: in until 0:01, out from 0:01 of the trimmed 3 s`, (await tf('fade-in')) === '0:01.00' && (await tf('fade-out')) === '0:01.00', [await tf('fade-in'), await tf('fade-out')]);
      await p.locator('[data-time-field="fade-in"]').fill('0:00.5'); await p.locator('[data-time-field="fade-in"]').press('Enter');
      const fadeNote = await p.locator('[data-transform-step="fade"]').textContent();
      check(`${name}: a typed time sets the fade, and its length is shown`, /0\.50 s in · 2\.00 s out/.test(fadeNote || ''), fadeNote);
      check(`${name}: the waveform says how to mark it`, /Drag where the fade in ends/.test(await p.locator('[data-transform-wave-hint]').textContent() || ''));
      // Play the original, follow it on the waveform, and mark a step where it is.
      await p.getByRole('button', { name: 'Play the original' }).click();
      const orig = await p.evaluate(() => window.__selected.at(-1));
      check(`${name}: Play the original hands the original itself to the one player`, orig && orig.name === 'Soullab Capture 2026-11-17 18.40.38.wav', orig);
      check(`${name}: no playhead before the player reports a position`, (await p.locator('[data-transform-playhead]').count()) === 0);
      await p.evaluate(() => { window.__pos = 2.5; });
      await p.waitForSelector('[data-transform-wave-of="original"] [data-transform-playhead]');
      check(`${name}: the playhead follows the player on the original's waveform`, (await p.locator('[data-transform-wave-of="original"] [data-transform-playhead]').textContent()) === 'Playing · 0:02.50');
      check(`${name}: the button offers to pause while the original plays`, (await p.getByRole('button', { name: 'Pause the original' }).count()) === 1);
      await p.locator('[data-transform-step="trim"] strong').first().click();
      await p.getByRole('button', { name: /^Start here · 0:02\.50$/ }).click();
      check(`${name}: Start here marks the trim where the player is`, (await tf('trim-start')) === '0:02.50', await tf('trim-start'));
      await p.locator('[data-time-field="trim-start"]').fill('0:00'); await p.locator('[data-time-field="trim-start"]').press('Enter');
      await p.locator('[data-transform-step="fade"] strong').first().click();
      const playedBefore = await p.evaluate(() => window.__played);
      await p.getByRole('button', { name: 'Preview in the player' }).click();
      await p.waitForFunction((n) => window.__played > n, playedBefore, { timeout: 15000 });
      const sel = await p.evaluate(() => window.__selected.at(-1));
      check(`${name}: preview goes to the ONE player as a WAV`, sel && sel.type === 'audio/wav' && /\(transformed preview\)\.wav$/.test(sel.name), sel);
      await p.evaluate(() => { window.__pos = 1; });
      await p.waitForFunction(() => document.querySelector('[data-transform-wave-of="result"] [data-transform-playhead]')?.textContent === 'Playing · 0:01.00', null, { timeout: 5000 }).catch(() => undefined);
      check(`${name}: the preview's own waveform appears, and the playhead follows the preview there`,
        (await p.locator('[data-transform-wave-of="result"] [data-transform-playhead]').textContent()) === 'Playing · 0:01.00'
        && (await p.locator('[data-transform-wave-of="original"] [data-transform-playhead]').count()) === 0,
        [await p.locator('[data-transform-wave-of="result"] [data-transform-playhead]').textContent(), await p.locator('[data-transform-wave-of="original"] [data-transform-playhead]').count()]);
      check(`${name}: Mark here is offered only while the original plays`, (await p.locator('[data-mark-here]').count()) === 0);
      const downloads = [];
      p.on('download', (d) => downloads.push(d));
      await p.getByRole('button', { name: 'Save as new' }).click();
      await p.waitForSelector('[data-transform-saved]', { timeout: 15000 });
      await new Promise((r) => setTimeout(r, 500));
      const files = {};
      for (const d of downloads) { const f = path.join(dir, `${name}-${d.suggestedFilename()}`); await d.saveAs(f); files[d.suggestedFilename()] = fs.readFileSync(f); }
      const outWav = files['Soullab Capture 2026-11-17 18.40.38 (transformed).wav'];
      const outJson = files['Soullab Capture 2026-11-17 18.40.38 (transformed).provenance.json'];
      check(`${name}: save produces a NEW wav and its provenance`, !!outWav && !!outJson, Object.keys(files));
      if (outWav && outJson) {
        const p1 = JSON.parse(outJson.toString('utf8'));
        check(`${name}: provenance source hash is the original's`, p1.source.sha256 === sha(wav), p1.source.sha256);
        check(`${name}: provenance output hash is the saved file's`, p1.output.sha256 === sha(outWav));
        const inner = riffChunk(outWav, 'slpv');
        const p2 = inner ? JSON.parse(inner.toString('utf8')) : null;
        check(`${name}: the WAV carries its own provenance`, !!p2 && p2.schema === p1.schema && p2.derived === true);
        check(`${name}: the embedded record matches the file beside it`, !!p2 && p2.source.sha256 === p1.source.sha256 && p2.createdAt === p1.createdAt && JSON.stringify(p2.recipe) === JSON.stringify(p1.recipe));
        check(`${name}: both records carry the Capture take's own claim (J4b-1)`,
          p1.source.capture && p1.source.capture.takeId === CAPTURE_TAKE_ID && p1.source.capture.asserted === 'by-file'
          && p1.source.capture.recordedAt === '2026-11-17 18:40:38' && !!p2 && JSON.stringify(p2.source.capture) === JSON.stringify(p1.source.capture), p1.source.capture);
        check(`${name}: the audio hash in both records is the saved samples'`, !!p2 && p2.output.audioSha256 === sha(riffChunk(outWav, 'data')) && p1.output.audioSha256 === p2.output.audioSha256);
        check(`${name}: the RIFF size covers the whole file`, outWav.readUInt32LE(4) === outWav.length - 8);
        const decoded = await p.evaluate(async (b64) => {
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const d = await new OfflineAudioContext(2, 1, 44100).decodeAudioData(bytes.buffer);
          return { frames: d.length, channels: d.numberOfChannels };
        }, outWav.toString('base64'));
        check(`${name}: Chrome's own decoder plays the saved file at full length`, decoded.channels === 2 && decoded.frames === riffChunk(outWav, 'data').length / 6, decoded);
        const savedPath = path.join(dir, `${name}-${'Soullab Capture 2026-11-17 18.40.38 (transformed).wav'}`);
        const af = execFileSync('/usr/bin/afinfo', [savedPath], { encoding: 'utf8' });
        check(`${name}: macOS Core Audio reads the saved file`, /audio packets: \d+/i.test(af) && /24-bit|24 bits/i.test(af), af);
        check(`${name}: provenance carries the recipe in order and says derived`, p1.derived === true && p1.recipe.map((s) => s.kind).join() === 'trim,fade,eq,reverb,normalize');
        check(`${name}: output keeps 44.1 kHz and the original decoder`, outWav.readUInt32LE(24) === 44100 && p1.source.decodedBy === 'soullab-wav');
      }
      check(`${name}: the original file on disk is byte-identical`, sha(fs.readFileSync(wavPath)) === sha(wav));
      const saved = await p.locator('[data-transform-saved]').textContent();
      check(`${name}: the desk re-reads the original and reports it unchanged`, /unchanged/.test(saved || ''), saved);
      check(`${name}: no horizontal overflow`, await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      check(`${name}: no page errors`, errors.length === 0, errors);
      await p.locator('[data-transform-desk]').screenshot({ path: path.join(shots, `sound-studio-transform-${name}.png`) });
      await ctx.close();
    }
  } finally {
    await browser.close(); server.close();
  }
  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : `  → ${JSON.stringify(c.detail)}`}`);
  console.log(`${checks.length - failed.length}/${checks.length} checks`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
