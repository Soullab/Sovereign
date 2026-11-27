/** LISTEN-01 Living Library: source-integrity and score witnesses (review only). */
'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),Module=require('node:module');
const esbuild=require('esbuild');
const repo=path.resolve(__dirname,'../..');
const source=path.join(repo,'lib/listening/soundAtlasStudy.ts');
const generated=esbuild.buildSync({entryPoints:[source],bundle:true,write:false,platform:'node',format:'cjs',target:'node22',logLevel:'silent'}).outputFiles[0].text;
const m=new Module(source,module);m.filename=source;m.paths=Module._nodeModulePaths(repo);m._compile(generated,source);
const {atlasScore,atlasProceduralStudy,ATLAS_PHASES}=m.exports;
const cg=esbuild.buildSync({entryPoints:[path.join(repo,'lib/listening/soundAtlasCatalog.ts')],bundle:true,write:false,platform:'node',format:'cjs',target:'node22',logLevel:'silent'}).outputFiles[0].text;
const cm=new Module('catalog',module);cm.filename=path.join(repo,'lib/listening/soundAtlasCatalog.ts');cm.paths=Module._nodeModulePaths(repo);cm._compile(cg,cm.filename);
const {ATLAS_COLLECTIONS,ATLAS_WORKS,ATLAS_INTENTS,ATLAS_PROVENANCE,worksInCollection,worksForIntent,atlasWork}=cm.exports;
let n=0;function pass(label){console.log('PASS',label);n++;}
assert.equal(ATLAS_COLLECTIONS.length,7);
assert.equal(new Set(ATLAS_COLLECTIONS.map(x=>x.id)).size,7);
assert.deepEqual(ATLAS_COLLECTIONS.map(x=>x.id),['celestial','geometry','elements','earth','voice','liquid','becoming']);
pass('seven original editorial collections');
assert.equal(ATLAS_WORKS.length,25);
assert.equal(new Set(ATLAS_WORKS.map(x=>x.id)).size,25);
assert.deepEqual(ATLAS_COLLECTIONS.map(c=>worksInCollection(c.id).length),[4,3,5,3,3,3,4]);
pass('25 unique studies with intentional category distribution');
assert.deepEqual(ATLAS_WORKS.filter(w=>w.id.startsWith('venus-')).map(w=>w.title),['Pure Form','Orbital Dance','Venus in Water','The Living Rose']);
assert.equal(atlasWork('venus-pure').special,'pure639');
assert.equal(atlasWork('venus-orbit').special,'orbital813');
pass('four distinct Venus Rose studies including 639 and 8:13');
for(const work of ATLAS_WORKS){
 assert.ok(ATLAS_COLLECTIONS.some(c=>c.id===work.collection),work.id+' unknown collection');
 assert.ok(work.intents.length>=1&&work.intents.every(i=>ATLAS_INTENTS.includes(i)),work.id+' intents invalid');
 assert.ok(work.duration>=300&&work.duration<=900,work.id+' duration out of bounds');
 for(const prop of ['root','pulse','body','overtone','glass','air','spiral','music'])
  assert.ok(Number.isFinite(work[prop]),work.id+' '+prop+' must be finite');
 assert.ok(work.root>=55&&work.root<=440,work.id+' root out of engine bounds');
 const score=atlasScore(work);
 assert.equal(score.steps.length,6,work.id+' score expected five movements and end');
 assert.equal(score.steps.reduce((a,s)=>a+s.seconds+(s.hold||0),0),work.duration,work.id+' duration mismatch');
 assert.deepEqual(score.steps.slice(0,5).map(s=>s.name),ATLAS_PHASES,work.id+' movement names');
 for(const step of score.steps.slice(0,5)) {
   assert.equal(step.type,'morph');
   assert.ok(Number.isFinite(step.params.f0)&&step.params.f0>=55&&step.params.f0<=440,work.id+' invalid pitch');
   for(const [key,value] of Object.entries(step.params)){
     if(typeof value==='number')assert.ok(Number.isFinite(value),work.id+' non-finite '+key);
   }
 }
 const study=atlasProceduralStudy(work);
 assert.equal(study.id,'sound-atlas-'+work.id);
 assert.equal(typeof study.build,'function');
}
pass('25 validated procedural studies and 150 score movements total');
for(const i of ATLAS_INTENTS)assert.ok(worksForIntent(i).length>0,i+' intent empty');
pass('six meaningful browse-by-intention filters');
assert.equal(ATLAS_PROVENANCE.thirdPartyMedia,false);
assert.equal(ATLAS_PROVENANCE.recordingMasters,'NOT CREATED OR ADMITTED');
assert.match(ATLAS_PROVENANCE.reference,/instagram\.com\/reel\//);
pass('rights fail-closed: original procedural studies, no outside recordings admitted');
console.log('SOUND ATLAS CATALOG',n+'/'+n,'PASS');
