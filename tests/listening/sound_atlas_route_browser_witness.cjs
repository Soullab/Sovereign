/** Sound Studio Living Library — route-level review witness on the native ListenRoom. */
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const chrome=process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const url='http://127.0.0.1:8753/';
(async()=>{
 const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 const results=[],errors=[];
 try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('pageerror',e=>errors.push(String(e.stack||e)));
  await page.goto(url,{waitUntil:'networkidle'});
  assert.equal(await page.locator('[data-studio-view="now"]').count(),1,'starts in native Now');
  results.push('Native Now door is intact');
  assert.equal(await page.locator('[data-sound-atlas]').count(),0,'Library not mounted yet');
  const nav=page.getByRole('navigation',{name:'Sound Studio sections'}).getByRole('button',{name:'Library'});
  await nav.click();
  assert.equal(await page.locator('[data-studio-view="library"]').count(),1);
  assert.equal(await page.locator('[data-sound-atlas]').count(),1);
  results.push('Library navigation opens the native Sound Studio Library');
  assert.equal(await page.getByRole('group',{name:'Seven sound collections'}).locator('button').count(),8);
  results.push('Seven editorial collections render in the actual route');
  assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))<=0);
  results.push('Native mobile 390 px route has no horizontal overflow');
  assert.equal(await page.locator('[data-listen10-persistent-dock=true]').isVisible().catch(()=>false),false);
  await page.getByRole('button',{name:/Pure Form/}).click();
  await page.getByRole('button',{name:/Listen to study/}).click();
  await page.waitForTimeout(1400);
  assert.match(await page.locator('[data-listen10-persistent-dock=true]').innerText(),/Pure Form/);
  results.push('Native route plays a study using the shared provider');
  await page.locator('[data-sound-atlas]').getByRole('button',{name:'Stop',exact:true}).click();
  await page.getByRole('navigation',{name:'Sound Studio sections'}).getByRole('button',{name:'Now'}).click();
  assert.equal(await page.locator('[data-studio-view=now]').count(),1);
  results.push('Returning to Now preserves the existing navigation');
  assert.deepEqual(errors,[]);
  results.push('No native-route JavaScript errors');
  for(const r of results)console.log('PASS',r);
  console.log('SOUND ATLAS ROUTE',results.length+'/'+results.length,'PASS');
 }finally{await browser.close()}
})().catch(e=>{console.error('ROUTE WITNESS FAILED',e);process.exitCode=1});
