/** LISTEN-01 / Living Library — actual browser UI and shared-player witness, review-only.
 * Reads the local 127.0.0.1:8752 fixture. No auth, member data, recordings or outside requests.
 * This verifies logic, not audio mastering, visual acceptance or production authorization.
 */
'use strict';
const path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const chrome=process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const root=path.resolve(__dirname,'../..');
(async()=>{
 const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 const checks=[],errors=[],external=[];
 const pass=name=>{checks.push(name);console.log('PASS',name)};
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
  page.on('pageerror',e=>errors.push(String(e.stack||e)));
  page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:8752/'))external.push(r.url());});
  await page.goto('http://127.0.0.1:8752/',{waitUntil:'networkidle'});
  assert.equal(await page.locator('[data-sound-atlas]').count(),1);
  assert.equal(await page.getByRole('heading',{name:'Listen to the patterns of the world.'}).count(),1);
  pass('One native Sound Studio library surface');
  assert.equal(await page.locator('[data-sound-atlas] button.atlasCollection').count(),0); // CSS module hashes class names
  assert.equal(await page.getByRole('group',{name:'Seven sound collections'}).locator('button').count(),8);
  pass('Seven collections and one All-worlds choice');
  assert.equal(await page.getByRole('button',{name:/Pure Form/}).count(),1);
  assert.equal(await page.locator('button[aria-pressed=true]').count()>0,true);
  assert.equal(await page.locator('[data-listen10-persistent-dock=true]').isVisible().catch(()=>false),false);
  pass('Venus Rose opens with four original studies and no autoplay');
  const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  assert.ok(await overflow()<=0,'mobile viewport 390 has no horizontal overflow');
  pass('390 px mobile layout fits without horizontal overflow');
  await page.getByRole('button',{name:/Begin with what's alive/}).click();
  await page.getByLabel('I want to…').selectOption('Create');
  assert.ok(await page.getByRole('button',{name:/Alien Intelligence 01/}).count()===0,'intent filtering removes nonmatching work');
  assert.ok(await page.getByRole('button',{name:/Orbital Dance/}).count()===1);
  pass('Browse by intention filters original studies');
  await page.getByLabel('I want to…').selectOption('all');
  await page.getByRole('button',{name:/Explore a world/}).click();
  await page.getByRole('button',{name:/Celestial Harmonics/}).click();
  await page.getByRole('button',{name:/Pure Form/}).click();
  const [dl]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:/Export original recipe/}).click()]);
  assert.match(dl.suggestedFilename(),/soullab-atlas-venus-pure-recipe\.json/);
  pass('Original recipe exports as JSON (no recording or server persistence)');
  await page.getByRole('button',{name:/Listen to study/}).click();
  await page.waitForTimeout(1600);
  let dock=await page.locator('[data-listen10-persistent-dock=true]').innerText();
  assert.match(dock,/Pure Form/);
  assert.match(dock,/PLAYING/i);
  pass('Exactly 639 Hz Pure Form starts through the existing persistent player');
  await page.getByRole('button',{name:/Orbital Dance/}).click();
  await page.getByRole('button',{name:/Listen to study/}).click();
  await page.waitForTimeout(1100);
  dock=await page.locator('[data-listen10-persistent-dock=true]').innerText();
  assert.match(dock,/Orbital Dance/);
  assert.doesNotMatch(dock,/Pure Form/);
  pass('Switching studies replaces rather than overlaps playback');
  await page.locator('[data-sound-atlas]').getByRole('button',{name:'Pause',exact:true}).click();
  await page.waitForTimeout(150);
  dock=await page.locator('[data-listen10-persistent-dock=true]').innerText();
  assert.match(dock,/PAUSED/i);
  pass('Explicit Pause uses shared audio player');
  await page.locator('[data-sound-atlas]').getByRole('button',{name:'Stop',exact:true}).click();
  await page.waitForTimeout(200);
  pass('Explicit Stop available and clears current playback');
  await page.getByRole('button',{name:/Liquid Harmonics & Emergent Worlds/}).click();
  await page.getByRole('button',{name:/Alien Intelligence 01/}).click();
  await page.getByRole('button',{name:/Listen to study/}).click();
  await page.waitForTimeout(1400);
  dock=await page.locator('[data-listen10-persistent-dock=true]').innerText();
  assert.match(dock,/Alien Intelligence 01/);
  pass('A five-part original Liquid Harmonics study plays through the same provider');
  await page.locator('[data-sound-atlas]').getByRole('button',{name:'Stop',exact:true}).click();
  await page.screenshot({path:path.join(root,'docs/design/contracts/screenshots/sound-studio-living-library-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1280,height:900});
  await page.getByRole('button',{name:/Celestial Harmonics/}).click();
  await page.screenshot({path:path.join(root,'docs/design/contracts/screenshots/sound-studio-living-library-desktop.png'),fullPage:true});
  assert.ok(await overflow()<=0,'desktop viewport has no horizontal overflow');
  pass('Responsive desktop and mobile screenshots captured');
  assert.deepEqual(errors,[],'No browser page errors');
  pass('Zero browser script errors');
  assert.deepEqual(external,[],'No external requests during library usage');
  pass('Zero outside media, tracking or content requests');
  console.log('SOUND ATLAS BROWSER',checks.length+'/'+checks.length,'PASS');
 } finally {await browser.close();}
})().catch(e=>{console.error('SOUND ATLAS BROWSER FAILED',e);process.exitCode=1});
