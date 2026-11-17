/** LISTEN-01 · Orbit & Threshold — local Chrome LOGIC witness (not a listening witness).
 * Builds the isolated fixture (real PersistentListeningProvider + real OrbitThresholdDesk), serves it on 127.0.0.1,
 * and walks it with simulated Space-key breaths: every station in order, Pause/Resume holds the place, the sound
 * survives a room change, the threshold opens at the third eye, the silence ends by itself, Stop clears the player.
 *   node tests/listening/orbit_threshold_browser_witness.cjs        Env: CHROME_BIN
 */
'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

const repo = path.resolve(__dirname, '../..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soullab-orbit-witness-'));
execFileSync(process.execPath, [path.join(__dirname, 'orbit_threshold_fixture.cjs'), dir], { stdio: 'ignore' });
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

    // Phone width first: nothing plays on arrival, no horizontal overflow.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    assert.ok(await overflow() <= 0, 'no horizontal overflow at 390 px');
    assert.equal(await page.locator('[data-listen10-persistent-dock="true"]').isVisible().catch(() => false), false, 'nothing plays on arrival');
    await page.locator('[data-orbit-threshold]').screenshot({ path: path.join(shots, 'sound-studio-orbit-threshold-mobile.png') });
    await page.setViewportSize({ width: 1100, height: 1300 });
    results.push('phone width: no overflow, nothing plays on arrival');
    const guide = () => page.locator('[class*=orbitGuide]').textContent();
    const dock = () => page.locator('[data-listen10-persistent-dock="true"]').innerText().catch(() => '');
    const breath = async (ms = 700) => { await page.keyboard.down('Space'); await page.waitForTimeout(ms); await page.keyboard.up('Space'); await page.waitForTimeout(ms); };

    await page.click('[data-orbit-play]');
    await page.waitForTimeout(900);
    assert.match(await dock(), /Orbit & Threshold[\s\S]*PLAYING/);
    results.push('begin: plays through the one persistent player (dock shows PLAYING)');

    // Founder route, one breath per point: every station up the back, in order.
    const seen = [];
    const watch = setInterval(async () => { const g = await guide().catch(() => ''); if (g && seen[seen.length - 1] !== g) seen.push(g); }, 60);
    for (let i = 0; i < 7; i++) {
      await breath();
      if (i === 2) await page.locator('[data-orbit-threshold]').screenshot({ path: path.join(shots, 'sound-studio-orbit-threshold-desktop.png') });
    }
    clearInterval(watch);
    const rising = seen.filter(g => /^Breathe in: rising to the /.test(g)).map(g => g.replace('Breathe in: rising to the ', ''));
    assert.deepEqual(rising.slice(0, 6), ['sacrum', 'kidneys', 'heart (back)', 'base of neck', 'base of skull', 'crown']);
    results.push(`stations up the back in order: ${rising.join(' → ')}`);

    // Pause holds the place; Resume continues from it.
    await page.keyboard.down('Space'); await page.waitForTimeout(500);
    const before = await guide();
    await page.locator('[data-listen10-persistent-dock="true"] button', { hasText: /^Pause$/ }).click();
    await page.keyboard.up('Space'); await page.waitForTimeout(1500);
    assert.equal(await guide(), before, 'paused: the orbit does not move');
    assert.match(await dock(), /PAUSED/);
    await page.locator('[data-listen10-persistent-dock="true"] button', { hasText: /^Resume$/ }).click();
    await page.waitForTimeout(900);
    const after = await guide();
    assert.notEqual(after, before, 'resumed: the released breath is taken up');
    assert.match(await dock(), /PLAYING/);
    results.push(`pause/resume: held at "${before}", continued to "${after}"`);

    // Another room: the player keeps the sound; returning re-attaches the desk to the running study.
    await page.click('text=Another room'); await page.waitForTimeout(600);
    assert.match(await dock(), /PLAYING/);
    await page.click('text=Sound Studio · Lab'); await page.waitForTimeout(600);
    assert.ok((await guide()).trim().length > 0, 'desk re-attached to the running study');
    results.push('room change: still PLAYING elsewhere; desk re-attached on return');

    // Arm, finish the rise: the third eye opens the threshold → the line → silence → end.
    await page.click('[data-orbit-arm]');
    const phases = [];
    for (let i = 0; i < 14 && !/Threshold|line|Silence/.test(await guide()); i++) await breath();
    for (let i = 0; i < 90; i++) { const g = await guide(); if (phases[phases.length - 1] !== g) phases.push(g); if (g === 'End') break; await page.waitForTimeout(250); }
    const tail = phases.slice(phases.indexOf('Threshold'));
    assert.deepEqual(tail, ['Threshold', 'The line', 'Silence', 'End']);
    assert.match(await dock(), /PAUSED/, 'after the silence the player pauses and releases the output');
    results.push(`threshold: ${tail.join(' → ')}; player paused itself`);

    // Begin again starts fresh; Stop clears the player.
    await page.click('[data-orbit-play]'); await page.waitForTimeout(900);
    assert.match(await guide(), /perineum/i);
    await page.locator('[data-listen10-persistent-dock="true"] button', { hasText: /^Stop$/ }).click();
    await page.waitForTimeout(600);
    assert.equal(await page.locator('[data-listen10-persistent-dock="true"]').isVisible().catch(() => false), false);
    results.push('begin again: from the perineum; Stop: dock cleared');

    // Lineage route walks its own stations.
    await page.selectOption('label:has-text("Route") select', 'lineage');
    await page.click('[data-orbit-play]'); await page.waitForTimeout(900);
    await breath();
    assert.match(await guide(), /Huiyin/);
    await page.locator('[data-listen10-persistent-dock="true"] button', { hasText: /^Stop$/ }).click();
    results.push('lineage route: first rise goes to Huiyin (perineum)');

    assert.deepEqual(errors, []);
    results.push('no page errors');
    console.log(results.map(r => '✓ ' + r).join('\n'));
  } finally {
    await browser.close(); server.close(); fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(e => { console.error(e); server.close(); process.exit(1); });
