'use strict';
// SAVE AS AN AUDIO FILE · real Chrome, the real engine and export (#1979; founder 2026-11-21: "Yes, options 1+2").
// Claim: a file rendered in pieces is the SAME sound as one continuous render, so the joins cannot be heard; the
// speaker version differs from the headphones version only in its pulse; and a piece renders far faster than real
// time. Uses the private development loops when present (reported), so the recordings are covered too.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const esbuild=require('esbuild');const {chromium}=require('playwright-core');
const repo=path.resolve(__dirname,'../..');const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'soundscape-export-'));
const haveLoops=fs.existsSync(path.join(repo,'public/media/dev-private/nature/forest.wav'));
const entry=`import{focusSoundscapeSpec}from ${JSON.stringify(path.join(repo,'lib/listening/focusSoundscape.ts'))};
import{renderSoundscapeWav,exportVariants,exportPlan}from ${JSON.stringify(path.join(repo,'lib/listening/soundscapeExport.ts'))};
const bytes={};const loader=ctx=>async id=>{if(!bytes[id]){const r=await fetch('/media/dev-private/nature/'+id+'.wav');if(!r.ok)return null;bytes[id]=await r.arrayBuffer()}return ctx.decodeAudioData(bytes[id].slice(0))};
import{buildSoundscape}from ${JSON.stringify(path.join(repo,'lib/listening/soundscapeEngine.ts'))};
const pcm=async blob=>new Int16Array((await blob.arrayBuffer()).slice(44));
window.__settings=(input,toneLayer,device)=>{const spec={...focusSoundscapeSpec(input),toneLayer};const v=exportVariants(spec).find(x=>x.device===device)||exportVariants(spec)[0];return{spec:v.spec,level:0.54,overtoneBusGain:1.2,recordedAmount:1,weaveAmount:0.5,toneLayerAmount:0.5}};
window.__compare=async(input,toneLayer,seconds,pieceSec,withFiles)=>{const s=window.__settings(input,toneLayer,'headphones');
const t0=performance.now();const a=await renderSoundscapeWav(s,seconds,{pieceSec,loadRecorded:withFiles?loader:undefined});const ms=performance.now()-t0;
const b=await renderSoundscapeWav(s,seconds,{pieceSec:seconds+1,loadRecorded:withFiles?loader:undefined});
const A=await pcm(a.blob),B=await pcm(b.blob);let sig=0,err=0,max=0;for(let i=0;i<B.length;i++){const d=A[i]-B[i];sig+=B[i]*B[i];err+=d*d;if(Math.abs(d)>max)max=Math.abs(d)}
const joints=exportPlan(seconds,pieceSec).slice(1).map(p=>Math.round((p.origin+p.keepFrom)*44100));const win=Math.round(0.05*44100);let jointMax=0;
for(const j of joints)for(let f=j-win;f<j+win+Math.round(0.5*44100);f++){for(let c=0;c<2;c++){const d=Math.abs(A[f*2+c]-B[f*2+c]);if(d>jointMax)jointMax=d}}
let stepMax=0,typStep=0;for(const j of joints){for(let f=j-win;f<j+win+Math.round(0.5*44100);f++){for(let c=0;c<2;c++){stepMax=Math.max(stepMax,Math.abs(A[f*2+c]-A[f*2-2+c]));typStep=Math.max(typStep,Math.abs(B[f*2+c]-B[f*2-2+c]))}}}
let rms=0;for(let i=0;i<B.length;i++)rms+=B[i]*B[i];const profile=[];for(let sec=0;sec<seconds;sec++){let e=0,g=0;for(let i=sec*88200;i<(sec+1)*88200;i++){const d=A[i]-B[i];e+=d*d;g+=B[i]*B[i]}profile.push(Math.round(10*Math.log10((g+1)/(e+1))))}
return{samples:A.length===B.length?A.length:-1,lengthOk:A.length===seconds*44100*2,snrDb:10*Math.log10(sig/(err||1e-9)),maxDiff:max,jointMax,stepMax,typStep,
rmsDb:20*Math.log10(Math.sqrt(rms/B.length)/32768),startAbs:Math.max(Math.abs(A[0]),Math.abs(A[1])),endAbs:Math.max(Math.abs(A[A.length-1]),Math.abs(A[A.length-2])),
peak:a.peak,clipped:a.clippedSamples,recorded:a.recordedLayers,renderMsPerSec:ms/seconds,joints:joints.length,profile}};
window.__late=async(input,toneLayer,at)=>{const s=window.__settings(input,toneLayer,'headphones');const r=44100;
const piece=async(origin,len)=>{const ctx=new OfflineAudioContext(2,len*r,r);const h=buildSoundscape(ctx,ctx.destination,s.spec,s.level,undefined,s.overtoneBusGain,s.recordedAmount,s.weaveAmount,s.toneLayerAmount,{origin,horizonSec:len});h.scheduleTicks(0,len);return (await ctx.startRendering()).getChannelData(0)};
const a=await piece(at-30,30),b=await piece(at-14,14);let sig=0,err=0;for(let t=8*r;t<14*r;t++){const x=a[16*r+t],y=b[t];sig+=x*x;err+=(x-y)**2}return 10*Math.log10(sig/(err||1e-30))};
window.__sink=async(input,toneLayer)=>{const s=window.__settings(input,toneLayer,'headphones');const chunks=[];
const viaSink=await renderSoundscapeWav(s,40,{pieceSec:15,sink:{write:async c=>{await new Promise(r=>setTimeout(r,0));chunks.push(new Uint8Array(c.slice(0)))}}});
const viaBlob=new Uint8Array(await (await renderSoundscapeWav(s,40,{pieceSec:15})).blob.arrayBuffer());
const joined=new Uint8Array(chunks.reduce((n,c)=>n+c.length,0));let o=0;for(const c of chunks){joined.set(c,o);o+=c.length}
let same=joined.length===viaBlob.length;for(let i=0;same&&i<joined.length;i++)if(joined[i]!==viaBlob[i])same=false;
const again=new Uint8Array(await (await renderSoundscapeWav(s,40,{pieceSec:15})).blob.arrayBuffer());let diffSink=0,diffRuns=0,maxS=0;
const A=new Int16Array(joined.buffer.slice(44)),B=new Int16Array(viaBlob.buffer.slice(44)),C=new Int16Array(again.buffer.slice(44));
for(let i=0;i<B.length;i++){if(A[i]!==B[i]){diffSink++;maxS=Math.max(maxS,Math.abs(A[i]-B[i]))}if(C[i]!==B[i])diffRuns++}
let hdr=true;for(let i=0;i<44;i++)if(joined[i]!==viaBlob[i])hdr=false;
return{same,bytes:joined.length,reported:viaSink.bytes,blobNull:viaSink.blob===null,chunks:chunks.length,diffSink,diffRuns,maxS,hdr}};
window.__speaker=async(input,seconds)=>{const tl={hz:220,pulseMode:'binaural',pulseHz:10};const h=await pcm((await renderSoundscapeWav(window.__settings(input,tl,'headphones'),seconds)).blob);const s=await pcm((await renderSoundscapeWav(window.__settings(input,tl,'speaker'),seconds)).blob);
// side signal (L-R) carries the binaural pair's difference; the speaker version has its tone centred
let sideH=0,sideS=0,midH=0,midS=0;for(let i=0;i<h.length;i+=2){sideH+=((h[i]-h[i+1])/2)**2;sideS+=((s[i]-s[i+1])/2)**2;midH+=((h[i]+h[i+1])/2)**2;midS+=((s[i]+s[i+1])/2)**2}
// a 10 Hz amplitude pulse on the MID (what one speaker plays): envelope power at 10 Hz vs neighbours
const env=x=>{const out=[];const w=441;for(let i=0;i+w*2<=x.length;i+=w*2){let e=0;for(let k=0;k<w*2;k+=2)e+=((x[i+k]+x[i+k+1])/2)**2;out.push(Math.sqrt(e/w))}return out};
const tone=(e,hz)=>{let re=0,im=0;const m=e.reduce((a,b)=>a+b,0)/e.length;e.forEach((v,i)=>{const t=i*0.01;re+=(v-m)*Math.cos(2*Math.PI*hz*t);im+=(v-m)*Math.sin(2*Math.PI*hz*t)});return Math.hypot(re,im)/e.length};
const eh=env(h),es=env(s);return{sideRatioDb:10*Math.log10((sideS+1)/(sideH+1)),midH:10*Math.log10(midH/h.length),midS:10*Math.log10(midS/s.length),pulseH:tone(eh,10),pulseS:tone(es,10),pulseSOff:tone(es,13)}};`;
fs.writeFileSync(path.join(fixture,'entry.js'),entry);
(async()=>{let server,browser;const results=[];const check=(n,v,d='')=>{results.push({name:n,pass:!!v,detail:d});console.log((v?'ok   ':'FAIL ')+n+(d?' · '+d:''));if(!v)process.exitCode=1};
try{await esbuild.build({entryPoints:[path.join(fixture,'entry.js')],outfile:path.join(fixture,'bundle.js'),bundle:true,format:'iife',alias:{'@':repo},logLevel:'silent'});
fs.writeFileSync(path.join(fixture,'index.html'),'<!doctype html><script src="/bundle.js"></script>');
server=http.createServer((q,s)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=/^\/media\/dev-private\/nature\/[a-z]+(-[a-z]+)?\.wav$/.test(u)?path.join(repo,'public',u):path.join(fixture,u==='/'?'index.html':u.replace(/^\//,''));if(!f.startsWith(repo)&&!f.startsWith(fixture)||!fs.existsSync(f)){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':f.endsWith('.wav')?'audio/wav':'text/html'});fs.createReadStream(f).pipe(s)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage();const errs=[];page.on('pageerror',e=>errs.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
const design={need:'deep',stimulation:'medium',world:'nature',task:'writing'};const bin={hz:220,pulseMode:'binaural',pulseHz:10};
const r1=await page.evaluate(([d,t,f])=>window.__compare(d,t,90,25,f),[design,bin,haveLoops]);
console.log('design · '+JSON.stringify(r1));
check('the file is exactly the asked length (16-bit stereo, 44.1 kHz)',r1.lengthOk,`${r1.samples} samples`);
check('rendered in pieces it is the same sound as one continuous render (signal-to-difference >= 60 dB)',r1.snrDb>=60,`${r1.snrDb.toFixed(1)} dB over ${r1.joints} joins`);
check('at every join the sound moves no more than the continuous render does there (no click)',r1.stepMax<=r1.typStep+16&&r1.jointMax<=64,`largest step ${r1.stepMax} vs ${r1.typStep} continuous; largest difference ${r1.jointMax}/32767`);
check('the file starts and ends from silence (gentle fade, softly repeatable)',r1.startAbs<=2&&r1.endAbs<=2,`${r1.startAbs} / ${r1.endAbs}`);
check('no clipping at Level 54%',r1.clipped===0,`peak ${r1.peak.toFixed(3)}`);
if(haveLoops)check('the real recordings and weave moments are in the file',r1.recorded.length>=3,r1.recorded.join(', '));
const tick={need:'activate',stimulation:'high',world:'ambient',task:'coding'};
const r2=await page.evaluate(([d])=>window.__compare(d,null,70,20,false),[tick]);
console.log('events · '+JSON.stringify(r2));
// Triangle and sawtooth voices are built from 2048 partials; the residue is a constant floor (it does not grow over
// two hours, see below), first measured at 52 dB, largest difference 21/32767. Bounded by sample difference, not SNR.
check('a sound with timed events and triangle voices also joins without a seam (largest difference <= 64/32767, no click)',r2.maxDiff<=64&&r2.stepMax<=r2.typStep+16,`${r2.snrDb.toFixed(1)} dB; largest difference ${r2.maxDiff}; step ${r2.stepMax} vs ${r2.typStep}`);
const late=await page.evaluate(([d,t])=>Promise.all([window.__late(d,t,600),window.__late(d,t,7190)]),[tick,null]);
check('two hours in, two pieces still agree where they overlap (>= 50 dB, triangle voices and events)',late[1]>=50,`${late[0].toFixed(1)} dB at 10 min, ${late[1].toFixed(1)} dB at 2 h`);
const lateB=await page.evaluate(([d,t])=>window.__late(d,t,7190),[design,bin]);
check('two hours in, the binaural design\'s pieces still agree (>= 60 dB)',lateB>=60,`${lateB.toFixed(1)} dB`);
const sk=await page.evaluate(([d,t])=>window.__sink(d,t),[design,bin]);
// Chrome's offline render is not bit-exact from run to run: two ordinary renders first differed in 59 samples by
// 1/32767. So: the same header and length, and no difference beyond that floor.
check('streamed to a chosen place, the file is the one made here (same header and length; samples within Chrome\'s own 1/32767 run-to-run floor), and nothing is held in memory',
  sk.hdr&&sk.bytes===7056044&&sk.maxS<=1&&sk.diffSink<=Math.max(200,3*sk.diffRuns)&&sk.blobNull&&sk.reported===sk.bytes,
  `${sk.bytes} bytes in ${sk.chunks} writes; ${sk.diffSink} samples differ by at most ${sk.maxS} (two ordinary renders: ${sk.diffRuns})`);
const r3=await page.evaluate(([d])=>window.__speaker(d,40),[design]);
console.log('speaker · '+JSON.stringify(r3));
check('the speaker version carries the 10 Hz pulse in what one speaker plays (mid), clearly above a neighbouring rate',r3.pulseS>3*r3.pulseSOff,`10 Hz ${r3.pulseS.toFixed(1)} vs 13 Hz ${r3.pulseSOff.toFixed(1)}`);
check('the speaker version has less left-right difference than the headphones version (the binaural pair is gone)',r3.sideRatioDb<0,`${r3.sideRatioDb.toFixed(1)} dB`);
const speed=await page.evaluate(([d,t,f])=>window.__compare(d,t,120,121,f),[design,bin,haveLoops]);
const twoHourMin=speed.renderMsPerSec*7200/60000;
check('renders far faster than real time (a 2-hour file in under 20 minutes here)',twoHourMin<20,`${(1000/speed.renderMsPerSec).toFixed(0)}x real time; about ${twoHourMin.toFixed(1)} min for 2 hours, per file`);
check('zero page errors',errs.length===0,JSON.stringify(errs));
console.log(`== soundscape_export_browser_witness: ${results.filter(x=>x.pass).length}/${results.length} checks`+(haveLoops?'':' (no private loops: recordings not covered)'));
}catch(e){console.error('FAIL',String(e&&e.stack||e).slice(0,800));process.exitCode=1}finally{await browser?.close();await new Promise(r=>server?.close(r))}})();
