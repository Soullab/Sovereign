/** LISTEN-01 · Liquid Harmonics — local Chrome LOGIC witness (not a listening witness).
 * Builds the isolated fixture (real PersistentListeningProvider + real LiquidHarmonicsDesk), serves it on 127.0.0.1,
 * and walks it: nothing plays on arrival, Begin plays through the one player, a slider is heard in the live engine,
 * a hostile score file is clamped, a journey rises (throb rate only climbs, Hold is locked during the rise),
 * breaks into true silence, comes back, ends by itself and the player pauses; Stop clears the player.
 * "Sound" here is read from the desk's own spectrum, which draws the study's analyser.
 *   node tests/listening/liquid_harmonics_browser_witness.cjs        Env: CHROME_BIN
 */
'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

const repo = path.resolve(__dirname, '../..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soullab-liquid-witness-'));
execFileSync(process.execPath, [path.join(__dirname, 'liquid_harmonics_fixture.cjs'), dir], { stdio: 'ignore' });
const chrome = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const file = path.join(dir, req.url === '/' ? 'index.html' : path.normalize(req.url).replace(/^[/\\]+/, ''));
  if (!file.startsWith(dir) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const results = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 1300 } });
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(url);
    const shots = path.join(repo, 'docs/design/contracts/screenshots');
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const dockEl = () => page.locator('[data-listen10-persistent-dock="true"]');
    const dock = () => dockEl().innerText().catch(() => '');
    const energy = () => page.evaluate(() => {
      const c = document.querySelector('[data-liquid-harmonics] canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let s = 0; for (let i = 0; i < d.length; i += 4) s += Math.max(0, d[i] - 3); return s;
    });
    const out = k => page.locator(`[data-liquid-param="${k}"]`).locator('xpath=following-sibling::span[1]').innerText();
    const rate = async () => parseFloat(await out('rate'));
    const loadScore = async (score) => {
      await page.locator('[data-liquid-load]').setInputFiles({ name: 'score.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(score)) });
      await page.waitForTimeout(300);
    };

    // Phone width first: nothing plays on arrival, no horizontal overflow.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    assert.ok(await overflow() <= 0, 'no horizontal overflow at 390 px');
    assert.equal(await dockEl().isVisible().catch(() => false), false, 'nothing plays on arrival');
    await page.locator('[data-liquid-harmonics]').screenshot({ path: path.join(shots, 'sound-studio-liquid-harmonics-mobile.png') });
    await page.setViewportSize({ width: 1100, height: 1300 });
    results.push('phone width: no overflow, nothing plays on arrival');

    await page.click('[data-liquid-play]');
    await page.waitForTimeout(2500);
    assert.match(await dock(), /Liquid Harmonics[\s\S]*PLAYING/);
    const e0 = await energy();
    assert.ok(e0 > 1000, `spectrum shows sound (${e0})`);
    results.push(`begin: plays through the one persistent player (dock PLAYING, spectrum energy ${e0})`);

    // A slider reaches the live engine.
    await page.click('[data-liquid-harmonics] summary:text-is("Oscillation")');
    await page.locator('[data-liquid-param="rate"]').fill('0.2');
    await page.waitForTimeout(300);
    assert.ok(Math.abs(await rate() - 0.5 * Math.pow(120, 0.2)) < 0.05, 'throb rate follows the slider');
    await page.click('[data-liquid-gather]'); await page.waitForTimeout(1200);
    assert.match(await page.locator('[data-liquid-note]').innerText(), /Gathering/);
    results.push('slider and Gather act on the running engine');

    // Music layer: off by default; at full balance the field is gone and only the in-key melody sounds.
    const mOut = () => page.locator('[data-liquid-param="music"]').locator('xpath=following-sibling::span[1]').innerText();
    assert.equal(await mOut(), '0.00', 'music layer starts off');
    await page.locator('[data-liquid-param="music"]').fill('1');
    await page.waitForTimeout(4000);
    const eMusic = await energy();
    assert.ok(eMusic > 1000, `music alone is heard (${eMusic})`);
    assert.match(await page.locator('[data-liquid-music-note]').innerText(), /\(now [A-G][♯♭]?\)/, 'the desk names the key');
    await page.locator('[data-liquid-param="music"]').fill('0.5');
    results.push(`music layer: off by default; music alone measures energy ${eMusic}; key shown`);

    // Touch (Phase 1 preview): zero until the listener raises it; then lower and upper zones carry signal, nothing above
    // 150 Hz (the music layer is at 0.5 here and must not leak in), and the upper zones swing left-right with rotation.
    const meter = async () => page.evaluate(() => [...document.querySelectorAll('[data-liquid-touch-meter]')].map(m => Number(m.dataset.rms)));
    const above = () => page.evaluate(() => Number(document.querySelector('[data-liquid-touch-meter]').dataset.above150));
    assert.ok(Math.max(...await meter()) < 1e-3, 'touch is zero until raised');
    await page.click('[data-liquid-harmonics] summary:text-is("Touch")');
    await page.locator('[data-liquid-param="touch"]').fill('1');
    await page.waitForTimeout(5000);
    // The pressure swells and draws back, so take each zone's peak over two seconds rather than one instant.
    const tm = [0, 0, 0, 0];
    for (let i = 0; i < 14; i++) { (await meter()).forEach((v, j) => { tm[j] = Math.max(tm[j], v); }); await page.waitForTimeout(150); }
    assert.ok(tm[0] > 0.01 && tm[1] > 0.01 && tm[2] > 0.01 && tm[3] > 0.01, `all four zones carry touch (${tm.map(x => x.toFixed(3))})`);
    const hi = await above();
    assert.ok(hi < 0.01, `touch stays below 150 Hz with the music layer on (share above 150 Hz: ${hi})`);
    // Gathered (the earlier Gather has just finished at centre 1): both upper zones stay equal.
    const g0 = []; for (let i = 0; i < 6; i++) { const m = await meter(); g0.push(Math.abs(m[2] - m[3])); await page.waitForTimeout(150); }
    assert.ok(Math.max(...g0) < 0.005, `gathered: left and right touch stay equal (${Math.max(...g0)})`);
    // Released to the periphery: the upper zones follow the rotation left and right.
    await page.click('[data-liquid-harmonics] summary:text-is("Space")');
    await page.locator('[data-liquid-param="center"]').fill('0');
    await page.waitForTimeout(1500);
    const diffs = [];
    for (let i = 0; i < 24; i++) { const m = await meter(); diffs.push(m[2] - m[3]); await page.waitForTimeout(200); }
    assert.ok(Math.max(...diffs) > 0.01 && Math.min(...diffs) < -0.01, `upper zones swing left-right (${Math.min(...diffs).toFixed(3)}..${Math.max(...diffs).toFixed(3)})`);
    results.push(`touch: zero until raised; zones ${tm.map(x => x.toFixed(2)).join('/')}; above 150 Hz ${(hi * 100).toFixed(2)}%; left-right swing ${Math.min(...diffs).toFixed(2)}..${Math.max(...diffs).toFixed(2)}`);

    // A hostile score file is clamped by the player itself.
    await loadScore({ title: 'hostile', steps: [{ type: 'rise', peak: 9999, length: 1, pitch: 99 }, { type: 'rm -rf' }, { type: 'morph', params: { f0: 1e6 } }] });
    const fields = await page.locator('[data-liquid-step="rise"] [data-liquid-step-field]').evaluateAll(els => Object.fromEntries(els.map(e => [e.dataset.liquidStepField, +e.value])));
    assert.deepEqual([fields.peak, fields.length, fields.pitch], [60, 30, 24]);
    assert.equal(await page.locator('[data-liquid-step]').count(), 2, 'unknown step dropped');
    results.push('hostile score: peak 9999→60, length 1→30, pitch 99→24, unknown step dropped');

    // A short journey: morph, rise into silence, gather (the sound returns), end.
    await page.waitForTimeout(9000); // let the gather finish so the desk is free
    await loadScore({ title: 'witness journey', author: 'witness', steps: [
      { type: 'morph', params: { rate: 3, depth: 0.7 }, seconds: 5, hold: 0 },
      { type: 'rise', peak: 30, length: 30, pitch: 7, throbAccel: 2, brk: 'silence', gather: 'yes', hold: 4 },
      { type: 'gather', seconds: 5, hold: 2 },
      { type: 'end', seconds: 3 },
    ] });
    // The timeline previews the loaded journey before it plays: one segment per step, no playhead yet.
    assert.equal(await page.locator('[data-liquid-timeline] [data-liquid-seg]').count(), 4, 'timeline: one segment per step');
    assert.equal(await page.locator('[data-liquid-playhead]').count(), 0, 'no playhead before playing');
    assert.match(await page.locator('[data-liquid-timeline-note]').innerText(), /4 steps/);
    // Journey controls sit under the timeline too; start the journey from there this time.
    assert.equal(await page.locator('[data-liquid-top-journey] button').count(), 4, 'Play / Hold / Extend / Next under the timeline');
    await page.click('[data-liquid-top-journey-play]');
    // The journey keeps the music balance at 0.5 (checked after the morph below).
    await page.waitForTimeout(500);
    assert.ok(await page.locator('[data-liquid-journey-play]').isDisabled(), 'both Play journey buttons lock while it plays');
    assert.ok(await page.locator('[data-liquid-top-journey-play]').isDisabled());
    assert.equal(await page.locator('[data-liquid-top-hold]').isDisabled(), false, 'top Hold works during a morph');
    await page.waitForTimeout(5300);
    const rates = [], heads = [], notes = new Set();
    const head = async () => Number(await page.locator('[data-liquid-playhead]').getAttribute('data-liquid-playhead'));
    let holdLocked = true;
    for (let i = 0; i < 8; i++) {
      rates.push(await rate());
      heads.push(await head());
      notes.add(await page.locator('[data-liquid-timeline-note]').innerText());
      if (!(await page.locator('[data-liquid-hold]').isDisabled())) holdLocked = false;
      if (!(await page.locator('[data-liquid-top-hold]').isDisabled())) holdLocked = false;
      if (i === 3) await page.locator('[data-liquid-harmonics]').screenshot({ path: path.join(shots, 'sound-studio-liquid-harmonics-desktop.png') });
      await page.waitForTimeout(3500);
    }
    for (let i = 1; i < rates.length; i++) assert.ok(rates[i] >= rates[i - 1] - 0.01, `throb rate never falls during the rise: ${rates.join(', ')}`);
    assert.ok(rates[rates.length - 1] > rates[0] * 3, 'and climbs a long way');
    assert.ok(holdLocked, 'Hold / Extend / Next are locked during a rise');
    results.push(`rise: throb ${rates.map(r => r.toFixed(1)).join(' → ')} /s; Hold locked throughout`);
    for (let i = 1; i < heads.length; i++) assert.ok(heads[i] > heads[i - 1], `the playhead moves forward: ${heads.join(', ')}`);
    assert.ok([...notes].some(n => /^Step 2 of 4 · Rise · .* · rising$/.test(n)), `timeline names the step: ${[...notes].join(' | ')}`);

    // Breakthrough into true silence.
    for (let i = 0; i < 40 && !/Silence/.test(await page.locator('[data-liquid-note]').innerText()); i++) await page.waitForTimeout(250);
    await page.waitForTimeout(1500);
    const silent = await energy();
    const tSilent = Math.max(...await meter());
    assert.ok(tSilent < 1e-3, `touch is silent with the sound (${tSilent})`);
    assert.ok(silent < e0 / 50, `silence measures ~0 (${silent})`);
    await page.waitForTimeout(5500);
    const back = await energy();
    assert.ok(back > silent * 10 + 1000, `the next step brings the sound back (${back})`);
    results.push(`breakthrough: silence (energy ${silent}, with the music layer at 0.5); next step returns (energy ${back})`);
    assert.equal(await mOut(), '0.50', 'a journey never moves the listener’s music balance');
    assert.equal(await page.locator('[data-liquid-param="touch"]').locator('xpath=following-sibling::span[1]').innerText(), '1.00', 'nor the touch level');
    const later = await page.locator('[data-liquid-timeline-note]').innerText();
    assert.match(later, /^Step [34] of 4 · (Gather|End)/);
    assert.ok(await head() > heads[heads.length - 1], 'playhead keeps moving after the rise');
    results.push(`timeline: playhead ${heads[0].toFixed(2)} → ${(await head()).toFixed(2)} of the journey; "${later}"`);

    // End fades out, the study ends itself, and the player pauses and releases the output.
    for (let i = 0; i < 60 && !/PAUSED/.test(await dock()); i++) await page.waitForTimeout(250);
    assert.match(await dock(), /PAUSED/);
    results.push('end: the journey ends by itself; the player paused');

    // Begin again starts fresh; Stop clears the player.
    await page.click('[data-liquid-play]'); await page.waitForTimeout(1500);
    assert.match(await dock(), /PLAYING/);
    await page.click('[data-liquid-stop]'); await page.waitForTimeout(800);
    assert.equal(await dockEl().isVisible().catch(() => false), false);
    results.push('begin again plays; Stop: dock cleared');

    assert.deepEqual(errors, []);
    results.push('no page errors');
    console.log(results.map(r => '✓ ' + r).join('\n'));
  } finally {
    await browser.close(); server.close(); fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(e => { console.error(e); server.close(); process.exit(1); });
