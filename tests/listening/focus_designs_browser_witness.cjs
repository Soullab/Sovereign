/** FOCUS DESIGNS · isolated browser witness (#1979, founder approval 2026-11-19).
 * The REAL app/listen/FocusSoundPicker.tsx and components/listening/FocusFieldDesk.tsx (as on the real Focus page) inside the REAL PersistentListeningProvider, with their
 * real stylesheets, in local Chrome. No Next, no session, no network, no member data.
 * Proves: save a design, it survives a reload, Use fills every choice and starts nothing, Remove and Forget
 * work, the stored record holds no private task label, the encrypted file hides the designs and restores
 * them, and blocked storage falls back to "this visit only". The session sound is saved BESIDE the design (not in
 * it), Use selects it and plays nothing, and Remove / Forget all take it away (founder ruling 2026-11-19).
 *   node tests/listening/focus_designs_browser_witness.cjs [--serve PORT]      Env: CHROME_BIN
 */
'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');
const esbuild = require('esbuild');
const repo = path.resolve(__dirname, '../..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soullab-focus-designs-'));
const shots = path.join(repo, 'docs/design/contracts/screenshots');
const serveAt = process.argv.includes('--serve') ? Number(process.argv[process.argv.indexOf('--serve') + 1] || 4721) : null;
const BUILD = String(Date.now());
const KEY = 'soullab.listen.focus.designs.v1';
const SOUNDS = 'soullab.listen.focus.design-sounds.v1'; // the sound saved BESIDE a design (founder ruling 2026-11-19)

fs.writeFileSync(path.join(dir, 'entry.jsx'), `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PersistentListeningProvider } from ${JSON.stringify(path.join(repo, 'components/listening/PersistentListeningProvider.tsx'))};
import FocusFieldDesk from ${JSON.stringify(path.join(repo, 'components/listening/FocusFieldDesk.tsx'))};
import FocusSoundPicker from ${JSON.stringify(path.join(repo, 'app/listen/FocusSoundPicker.tsx'))};
createRoot(document.getElementById('app')).render(
  <PersistentListeningProvider reviewMemberKey="fictional-focus-designs-witness"><main style={{padding:'24px',maxWidth:'1200px',margin:'0 auto'}}><FocusSoundPicker /><FocusFieldDesk /></main></PersistentListeningProvider>);
`);

(async () => {
  await esbuild.build({ entryPoints: [path.join(dir, 'entry.jsx')], outdir: dir, bundle: true, format: 'iife', platform: 'browser',
    jsx: 'automatic', target: 'es2022', loader: { '.module.css': 'local-css' }, alias: { '@': repo }, logLevel: 'error',
    nodePaths: [path.join(repo, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"' },
    banner: { js: 'var process = { env: {} };' } });
  fs.writeFileSync(path.join(dir, 'index.html'),
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    `<title>Focus designs · isolated fixture</title><link rel="stylesheet" href="/entry.css?v=${BUILD}">` +
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
  if (serveAt) { console.log(`Focus designs harness: ${base}`); return; }

  const { chromium } = require('playwright-core');
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const checks = [];
  const check = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });
  try {
    for (const [name, viewport] of [['desktop', { width: 1440, height: 1300 }], ['mobile', { width: 390, height: 844 }]]) {
      const ctx = await browser.newContext({ viewport, acceptDownloads: true });
      const p = await ctx.newPage();
      const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
      const external = []; p.on('request', (r) => { if (!r.url().startsWith(base) && /^https?:/.test(r.url())) external.push(r.url()); });
      p.on('dialog', (d) => d.accept());
      await p.addInitScript(() => { window.__audioContexts = 0; const A = window.AudioContext; if (A) window.AudioContext = class extends A { constructor(...a) { super(...a); window.__audioContexts += 1; } }; });
      await p.goto(base);
      await p.waitForSelector('[data-focus-designs]');
      const heading = () => p.locator('[data-focus-designs] h3 span').textContent();
      check(`${name}: no designs at first, kept on this device`, (await heading()) === '0/24 · on this device');

      // Choose a design, with a private label that must NOT be saved.
      await p.getByRole('button', { name: 'Coding', exact: true }).click();
      await p.getByRole('button', { name: /^Create/ }).click();
      await p.getByRole('button', { name: '90 minutes' }).click();
      await p.locator('summary:has-text("Tune session")').first().click();
      await p.locator('#focus-task-label').fill('Chapter 4 secret');
      const summary = async () => p.locator('[class*="focusStartRow"]').first().textContent();
      const chosen = await summary();
      await p.locator('[data-focus-sound="creative-flow"]').click(); // the session sound, chosen in the sound picker
      await p.locator('#focus-design-name').fill('Morning code');
      await p.locator('[data-focus-design-save]').click();
      check(`${name}: the saved design shows the sound saved beside it`, /Sound: Creative flow/.test(await p.locator('[data-focus-design]').first().textContent()));
      const pair = await p.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), SOUNDS);
      const designId = await p.locator('[data-focus-design]').first().getAttribute('data-focus-design');
      check(`${name}: the sound is stored beside the design, as the picker's choice name only`,
        !!pair && pair.format === 'SOULLAB_FOCUS_DESIGN_SOUNDS_V1' && JSON.stringify(pair.sounds) === JSON.stringify({ [designId]: 'creative-flow' }), pair);
      check(`${name}: the design record itself still holds no sound (LISTEN-48)`,
        !/creative-flow|Creative flow|sound/i.test(await p.evaluate((k) => localStorage.getItem(k), KEY)));
      check(`${name}: the saved design is listed with its choices`, /Morning code/.test(await p.locator('[data-focus-design]').first().textContent())
        && /Create · .+ · Coding · Medium stimulation · 90 minutes/.test(await p.locator('[data-focus-design]').first().textContent()), await p.locator('[data-focus-design]').first().textContent());
      check(`${name}: saving says it is on this device and who can see it`, /on this device\. Anyone using this browser can see/.test(await p.locator('[data-focus-design-note]').textContent()));
      const stored = await p.evaluate((k) => localStorage.getItem(k), KEY);
      check(`${name}: stored in this browser, without the private label`, !!stored && /Morning code/.test(stored) && !/Chapter 4/.test(stored), stored);

      await p.reload(); await p.waitForSelector('[data-focus-designs]');
      check(`${name}: still there after a reload`, (await heading()) === '1/24 · on this device' && (await p.locator('[data-focus-design]').count()) === 1);

      // Change the choices, then Use the design.
      await p.getByRole('button', { name: 'Writing', exact: true }).click();
      await p.getByRole('button', { name: /^Deep/ }).click();
      await p.getByRole('button', { name: '25 minutes' }).click();
      await p.locator('[data-focus-sound="none"]').click();
      check(`${name}: (the choices really changed)`, (await summary()) !== chosen);
      await p.getByRole('button', { name: 'Use this design' }).click();
      check(`${name}: Use this design selects its saved sound in the picker`, (await p.locator('[data-focus-sound="creative-flow"]').getAttribute('aria-checked')) === 'true');
      check(`${name}: and says the sound plays only on its own Play`, /with Creative flow chosen as its sound.*plays only when you press its Play/.test(await p.locator('[data-focus-design-note]').textContent()), await p.locator('[data-focus-design-note]').textContent());
      check(`${name}: Use this design fills in every choice`, (await summary()) === chosen, [await summary(), chosen]);
      check(`${name}: and starts nothing (no session, no sound)`, (await p.locator('[data-focus-field-session]').count()) === 0 && (await p.evaluate(() => window.__audioContexts)) === 0);

      // Encrypted file: export, forget, restore.
      await p.locator('summary:has-text("Keep a copy")').click();
      await p.locator('#focus-design-passphrase').fill('a long private phrase');
      await p.locator('#focus-design-passphrase-again').fill('a long private phrase');
      const [download] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Export my encrypted designs' }).click()]);
      const filePath = path.join(dir, `${name}-${download.suggestedFilename()}`); await download.saveAs(filePath);
      const file = fs.readFileSync(filePath, 'utf8');
      check(`${name}: the exported file is encrypted (no design name, no choices in it)`, /SOULLAB_FOCUS_DESIGNS_PRIVATE_V1/.test(file) && !/Morning code|coding|cinematic/i.test(file));
      await p.locator('[data-focus-design-forget]').click();
      check(`${name}: Forget all removes them from this browser`, (await p.locator('[data-focus-design]').count()) === 0 && (await p.evaluate((k) => localStorage.getItem(k), KEY)) === null);
      check(`${name}: and their saved sounds with them`, (await p.evaluate((k) => localStorage.getItem(k), SOUNDS)) === null);
      await p.locator('#focus-design-file').setInputFiles(filePath);
      await p.locator('#focus-design-passphrase').fill('a long private phrase');
      await p.getByRole('button', { name: 'Restore designs' }).click();
      await p.waitForSelector('[data-focus-design]', { timeout: 15000 }).catch(() => undefined);
      check(`${name}: the file restores the design with its passphrase`, (await p.locator('[data-focus-design]').count()) === 1 && /Morning code/.test(await p.locator('[data-focus-design]').textContent()));
      await p.locator('#focus-design-passphrase').fill('the wrong phrase entirely');
      await p.getByRole('button', { name: 'Restore designs' }).click();
      await p.waitForFunction(() => /Unable to unlock/.test(document.querySelector('[data-focus-design-note]')?.textContent || ''), null, { timeout: 15000 }).catch(() => undefined);
      check(`${name}: a wrong passphrase is refused and changes nothing`, /Unable to unlock/.test(await p.locator('[data-focus-design-note]').textContent()) && (await p.locator('[data-focus-design]').count()) === 1);

      await p.getByRole('button', { name: 'Remove', exact: true }).click();
      check(`${name}: Remove deletes the design`, (await p.locator('[data-focus-design]').count()) === 0);
      check(`${name}: the page says saved designs stay in this browser`, /Designs you choose to save are kept in this browser on this device, never on a server/.test(await p.locator('section#focus-field').textContent()));
      // Save DURING a running session: it saves the session's own plan, including a retune.
      await p.getByRole('button', { name: 'Start focus session' }).click();
      await p.waitForSelector('[data-focus-design-during]');
      await p.locator('select').first().selectOption('organic');
      await p.locator('[data-focus-sound="open-ground"]').click(); // a recorded work: only its choice name is kept
      await p.locator('#focus-design-name-during').fill('Mid-session');
      await p.locator('[data-focus-design-save-during]').click();
      const midNote = await p.locator('[data-focus-design-note]').textContent();
      const midStored = await p.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{"designs":[]}').designs.find((d) => d.name === 'Mid-session'), KEY);
      check(`${name}: a design can be saved while a session runs, and it keeps the retuned world`, !!midStored && midStored.musicalWorld === 'organic' && /next session/.test(midNote), { midStored, midNote });
      const row = await p.locator('[data-focus-design-during]').boundingBox();
      const card = await p.locator('[data-focus-field-session]').boundingBox();
      const btn = await p.locator('[data-focus-design-save-during]').boundingBox();
      const field = await p.locator('#focus-design-name-during').boundingBox();
      check(`${name}: the mid-session save row spans the card and its button does not overlap the name`,
        row.width >= Math.min(card.width - 60, 640) && (btn.x >= field.x + field.width - 1 || btn.y >= field.y + field.height - 1), { row, card, btn, field });
      check(`${name}: saving mid-session leaves the session running`, (await p.locator('[data-focus-field-session="running"]').count()) === 1);
      await p.locator('[data-focus-choose-another]').click();
      await p.waitForSelector('[data-focus-designs]');
      check(`${name}: the mid-session design is in My focus designs for the next session`, /Mid-session[\s\S]*Organic \/ acoustic/.test(await p.locator('[data-focus-design]').first().textContent()), await p.locator('[data-focus-design]').first().textContent());
      check(`${name}: the mid-session design keeps Open Ground beside it, by name only`,
        /Sound: Open Ground/.test(await p.locator('[data-focus-design]').first().textContent())
        && Object.values((await p.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{"sounds":{}}'), SOUNDS)).sounds).join() === 'open-ground');
      await p.getByRole('button', { name: 'Remove', exact: true }).first().click();
      check(`${name}: Remove takes its saved sound away too`, (await p.evaluate((k) => localStorage.getItem(k), SOUNDS)) === null);
      await p.locator('[data-focus-sound="creative-flow"]').click();
      // A saved design back, for the screenshot (the encrypted-file section is folded again after the session).
      await p.locator('#focus-design-name').fill('Morning code'); await p.locator('[data-focus-design-save]').click();
      await p.locator('[data-focus-designs]').scrollIntoViewIfNeeded();
      await p.locator('section#focus-field').screenshot({ path: path.join(shots, `sound-field-focus-designs-${name}.png`) });
      check(`${name}: no horizontal overflow`, await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      check(`${name}: no page errors and no outside requests`, errors.length === 0 && external.length === 0, { errors, external });
      await ctx.close();
    }
    // Blocked storage (a private window, or site data blocked): this visit only, and the desk says so.
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } }); });
    await p.goto(base); await p.waitForSelector('[data-focus-designs]');
    await p.locator('#focus-design-name').fill('Visit only'); await p.locator('[data-focus-design-save]').click();
    check('blocked storage: the design is kept for this visit, and the desk says so',
      (await p.locator('[data-focus-design]').count()) === 1 && /this visit only/.test(await p.locator('[data-focus-design-note]').textContent())
      && /this visit only/.test(await p.locator('[data-focus-designs] h3 span').textContent()));
    await ctx.close();
  } finally {
    await browser.close(); server.close();
  }
  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : `  → ${JSON.stringify(c.detail)}`}`);
  console.log(`${checks.length - failed.length}/${checks.length} checks`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
