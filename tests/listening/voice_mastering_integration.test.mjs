import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
register('./ts_resolution_loader.mjs', import.meta.url);
const root = path.join(import.meta.dirname, '../..');
const mod = p => import(pathToFileURL(path.join(root,p)).href);
const {renderRecipe}=await mod('lib/listening/transform/render.ts');
const {recipeProblem}=await mod('lib/listening/transform/recipe.ts');
const {buildProvenance,sha256Hex}=await mod('lib/listening/transform/provenance.ts');
const {VOICE_PROFILES,MASTERING_VERSION,measureVoiceLevels}=await mod('lib/listening/transform/mastering.ts');
const {writeWav24,readWav,withProvenance,readProvenance,wavAudioBytes}=await mod('lib/listening/transform/wav.ts');
const rate=44100;
const tone=()=>({sampleRate:rate,channels:[Float32Array.from({length:22050},(_,i)=>0.2*Math.sin(2*Math.PI*220*i/rate))]});
const step=(profile='natural',intensity=0.75,outputTrimDb=0)=>({kind:'voiceMaster',profile,intensity,outputTrimDb});
test('profile recipes admit five profiles and reject forged inputs',()=> {
 for(const p of Object.keys(VOICE_PROFILES)) assert.equal(recipeProblem([step(p)]),null);
 for(const v of [step('unapproved'),step('natural',-1),step('natural',1.1),step('natural',0.5,13),step('natural',0.7,NaN)]) assert.match(recipeProblem([v]),/voice profile|intensity|trim/i);
});
test('five profiles pass through the existing renderer without changing source',async()=> {
 const src=tone(),original=src.channels[0].slice();
 for(const p of Object.keys(VOICE_PROFILES)){
  const out=await renderRecipe(src,[step(p)]);
  assert.equal(out.sampleRate,rate);assert.equal(out.channels[0].length,original.length);
  assert.ok(out.channels[0].every(Number.isFinite));
  assert.ok(measureVoiceLevels(out).samplePeakDbfs<=-0.99);
 }
 assert.deepEqual(src.channels[0],original);
});
test('zero intensity gives byte-identical bypass, including WAV quantization',async()=>{
 const src=tone(),out=await renderRecipe(src,[step('broadcast',0,12)]);
 assert.deepEqual(out.channels,src.channels);
 assert.deepEqual(readWav(writeWav24(out)).channels,readWav(writeWav24(src)).channels);
});
test('embedded provenance preserves version, full recipe, all voice stages, audio SHA',async()=>{
 const src=tone(), steps=[{kind:'gain',db:-4},step('natural',0.7,0),step('sacred',0.5,-2)];
 const out=await renderRecipe(src,steps);
 const record=buildProvenance({source:{name:'fixture.wav',sha256:'x',sampleRate:rate,frames:22050,channels:1,decodedBy:'soullab-wav'},steps,output:{name:'derived.wav',audioSha256:'y',sampleRate:rate,frames:22050,channels:1},createdAt:'2026-11-22T12:00:00Z'});
 assert.equal(record.voiceMastering.version,MASTERING_VERSION);
 assert.deepEqual(record.voiceMastering.stages,[{profile:'natural',intensity:0.7,outputTrimDb:0},{profile:'sacred',intensity:0.5,outputTrimDb:-2}]);
 const wav=writeWav24(out),embedded=withProvenance(wav,JSON.stringify(record));
 assert.deepEqual(JSON.parse(readProvenance(embedded)).recipe,steps);
 assert.equal(await sha256Hex(wavAudioBytes(wav)),await sha256Hex(wavAudioBytes(embedded)));
 const legacy=buildProvenance({...{source:{name:'fixture.wav',sha256:'x',sampleRate:rate,frames:22050,channels:1,decodedBy:'soullab-wav'},output:{name:'legacy.wav',audioSha256:'z',sampleRate:rate,frames:22050,channels:1},createdAt:'2026-11-22T12:00:00Z'},steps:[{kind:'gain',db:-4}]});
 assert.equal('voiceMastering' in legacy,false);
});
test('desk remains one player, local recording, explicit save',()=>{
 const ui=fs.readFileSync(path.join(root,'app/listen/TransformDesk.tsx'),'utf8');
 assert.match(ui,/data-voice-mastering-meter="sample-rms"/);
 assert.match(ui,/selectLocalFile\(/);assert.match(ui,/playLocalFile\(/);
 assert.match(ui,/buildProvenance/);
 assert.doesNotMatch(ui,/navigator\.mediaDevices\.getUserMedia/);
 assert.doesNotMatch(ui,/fetch\(/);
});
