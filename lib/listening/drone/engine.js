// GENERATED — do not edit by hand. Regenerate with scripts/listening/vendor_drone_engine.mjs.
// SOULLAB TRANSFORM T2: the Voice to Drone Lab v0.3.4 engine (revision 2), copied verbatim from
// lab.js sha256 8407c45e8a6b6be17db3072cf1391451d3e28067266e690b6d471b42617e5d83, lines 11-15, 17-23, 33, 41-62, 85, 221-224, 232-235, 321-628, 650-664.
// Founder accepted its sound 2026-11-21; T2 approved 2026-11-21 ("Approve as recommended"), #1979.
// On-device, offline sample arithmetic. No DOM, no network, no storage, no microphone.
/* eslint-disable */

// ---- lab.js 11-15 ----
  const presets = {
    living: { label:'Living Voice', layerNames:['Original human voice','Lower resonance','Upper resonance'], layers:[[0,1,0],[-12,.16,-.35],[7,.13,.35]], defaults:{stillness:75,grain:50,movement:30,space:45,pitch:0}, cutoff:5800 },
    earth: { label:'Deep Earth', layerNames:['Low voice body','Deep sub-octave','Original vocal presence'], layers:[[-12,1,-.1],[-24,.21,-.36],[0,.2,.32]], defaults:{stillness:88,grain:67,movement:18,space:52,pitch:0}, cutoff:3200 },
    aether: { label:'Expansive Aether', layerNames:['Original human voice','High overtone companion','Upper octave shimmer'], layers:[[0,1,-.12],[7,.37,.38],[12,.24,-.31]], defaults:{stillness:80,grain:44,movement:47,space:76,pitch:0}, cutoff:7700 }
  };
// ---- lab.js 17-23 ----
  const MIN_REGION_SECONDS=.25;
  const INTERVAL_RANGE=[-24,12],INTERVAL_CHIPS=[-24,-12,-7,0,7,12];
  const clampNum=(n,lo,hi,fallback)=>{const v=Number(n);return Number.isFinite(v)?Math.max(lo,Math.min(hi,v)):fallback;};
  // Fill v0.3.1 fields on a v0.3 layer-mix entry (older recipes/mixes carry only enabled/level/pan).
  function completeMix(preset,mix){return mix.map((m,i)=>({enabled:m.enabled!==false,level:clampNum(m.level,0,150,100),pan:clampNum(m.pan,-100,100,0),
    interval:Math.round(clampNum(m.interval,INTERVAL_RANGE[0],INTERVAL_RANGE[1],presets[preset].layers[i][0])),entersAt:clampNum(m.entersAt,0,90,0),bloomSeconds:clampNum(m.bloomSeconds,0,60,0)}));}
  const signedSt=n=>(n>0?'+':n<0?'−':'')+Math.abs(n);
// ---- lab.js 33-33 ----
  function safeName(name){return String(name).replace(/\.[^/.]+$/,'').replace(/[^a-z0-9-_]+/gi,'_').replace(/_+/g,'_').slice(0,44)||'Source';}
// ---- lab.js 41-62 ----
  function makeWaveBlob(mono,rate){const frames=mono.length,bytes=new ArrayBuffer(44+frames*2),dv=new DataView(bytes);writeHeader(dv,frames,rate,1,16);let o=44;for(let i=0;i<frames;i++,o+=2)dv.setInt16(o,Math.round(Math.max(-1,Math.min(1,mono[i]))*32767),true);return new Blob([bytes],{type:'audio/wav'});}
  function writeHeader(dv,frames,rate,channels,bits){
    const bytesPerSample=bits/8,block=channels*bytesPerSample,dataBytes=frames*block;
    function str(offset,s){for(let i=0;i<s.length;i++)dv.setUint8(offset+i,s.charCodeAt(i));}
    str(0,'RIFF');dv.setUint32(4,36+dataBytes,true);str(8,'WAVE');str(12,'fmt ');dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,channels,true);dv.setUint32(24,rate,true);dv.setUint32(28,rate*block,true);dv.setUint16(32,block,true);dv.setUint16(34,bits,true);str(36,'data');dv.setUint32(40,dataBytes,true);
  }
  function wav24(left,right,rate){
    const frames=left.length,dv=new DataView(new ArrayBuffer(44+frames*6));writeHeader(dv,frames,rate,2,24);
    let p=44;for(let i=0;i<frames;i++){for(const channel of [left,right]){let n=Math.round(Math.max(-1,Math.min(1,channel[i]))*8388607);if(n<0)n+=16777216;dv.setUint8(p++,n&255);dv.setUint8(p++,(n>>>8)&255);dv.setUint8(p++,(n>>>16)&255);}}return new Blob([dv.buffer],{type:'audio/wav'});
  }
  function syntheticVowel(){
    const rate=48000,seconds=5.5,frames=Math.floor(rate*seconds),a=new Float32Array(frames);
    const harmonics=[];for(let k=1;k<=36;k++){const f=k*108;const env=Math.exp(-.5*((f-730)/190)**2)+.63*Math.exp(-.5*((f-1270)/260)**2)+.36*Math.exp(-.5*((f-2520)/390)**2);harmonics.push(env/Math.pow(k,.86));}
    let phase=0;
    for(let i=0;i<frames;i++){
      const t=i/rate;phase+=(2*Math.PI/rate)*(108+1.4*Math.sin(2*Math.PI*.32*t));
      let v=0;for(let k=0;k<harmonics.length;k++)v+=harmonics[k]*Math.sin((k+1)*phase+.03*k);
      const attack=Math.min(1,t/.32),release=Math.min(1,(seconds-t)/.38),breath=.86+.14*Math.sin(2*Math.PI*.23*t);a[i]=v*.32*Math.max(0,attack)*Math.max(0,release)*breath;
    }
    let peak=0;for(let i=0;i<a.length;i++)peak=Math.max(peak,Math.abs(a[i]));if(peak>0){const g=.68/peak;for(let i=0;i<a.length;i++)a[i]*=g;}
    return {data:a,rate,name:'Synthetic_A_Vowel',synthetic:true};
  }
// ---- lab.js 85-85 ----
  function defaultLayerMix(name){return presets[name].layers.map(layer=>({enabled:true,level:100,pan:Math.round(layer[2]*100),interval:layer[0],entersAt:0,bloomSeconds:0}));}
// ---- lab.js 221-224 ----
  function fieldRecipe(r){const f=completeField(r.settings.field),info=r.fieldInfo||[];
    return {model:FIELD_MODEL,active:fieldActive(f),
      note:'Generic headphone binaural approximation (interaural time and level differences, head shadow, pinna-style height notch, distance). Not a personalised HRTF; not Apple Spatial Audio, Atmos or ambisonics.',
      elements:f.map((e,k)=>{const d=FIELD_ELEMENTS[k],i=info.find(x=>x.element===d.key)||{};return {key:d.key,name:d.name,madeFrom:d.from==='file'?'ambience file':'selected voice section',...e,cyclesInRender:i.cycles??null,skipped:i.skipped||null};})};}
// ---- lab.js 232-235 ----
  const NOTE_NAMES=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
  function noteInfo(hz,aRef){const n=12*Math.log2(hz/aRef),k=Math.round(n),midi=69+k;return {name:NOTE_NAMES[((midi%12)+12)%12]+(Math.floor(midi/12)-1),cents:Math.round((n-k)*100)};}
  function snapCents(hz,pitchSt,aRef){const f=hz*Math.pow(2,pitchSt/12),n=12*Math.log2(f/aRef);return Math.max(-100,Math.min(100,Math.round(-(n-Math.round(n))*100)));}
  const fmtC=c=>(c>0?'+':c<0?'−':'±')+Math.abs(c)+' ¢';
// ---- lab.js 321-628 ----
  function seedRand(seed=239021){let v=seed>>>0;return()=>{v^=v<<13;v^=v>>>17;v^=v<<5;return(v>>>0)/4294967296;};}
  function decibels(x){return x<=0?'-∞':(20*Math.log10(x)).toFixed(1);}
  // ---- v0.3.4 clean, level & tune (engine) ----
  const STANDARD_PEAK=.62,STANDARD_PEAK_DB=-4.2;
  function completeClean(c){c=c||{};return {repairClips:c.repairClips===true,lowCutHz:clampNum(c.lowCutHz,0,300,0),soften:clampNum(c.soften,0,100,0),smooth:clampNum(c.smooth,0,100,0)};}
  function completeLevel(l){l=l||{};return {outputPeakDb:clampNum(l.outputPeakDb,-12,-1,STANDARD_PEAK_DB),pushDb:clampNum(l.pushDb,0,9,0)};}
  function completeTune(t){t=t||{};return {cents:Math.round(clampNum(t.cents,-100,100,0)),aRef:Number(t.aRef)===432?432:440};}
  const ceilingFor=db=>db===STANDARD_PEAK_DB?STANDARD_PEAK:Math.pow(10,db/20);
  // Clipped samples: at full scale, or flat-topped runs at the passage's own peak.
  function findClipRuns(x){const runs=[];let pk=0;for(let i=0;i<x.length;i++)pk=Math.max(pk,Math.abs(x[i]));if(pk<1e-4)return runs;
    const hot=i=>{const v=Math.abs(x[i]);if(v>=.999)return true;if(v<.98*pk)return false;return (i>0&&Math.abs(x[i]-x[i-1])<1e-5)||(i+1<x.length&&Math.abs(x[i+1]-x[i])<1e-5);};
    for(let i=0;i<x.length;i++){if(!hot(i))continue;const r=runs[runs.length-1];if(r&&i-r.end<=1)r.end=i;else runs.push({start:i,end:i});}return runs;}
  // Rebuild each clipped run with a cubic Hermite arc from the slopes on either side. Works on a copy; the source is never changed.
  function repairClipped(x){const out=Float32Array.from(x),runs=findClipRuns(x);let repairs=0;
    for(const r of runs){const a=r.start-1,b=r.end+1;if(a<1||b>x.length-2)continue;
      const p0=out[a],p1=out[b],n=b-a,m0=(out[a]-out[a-1])*n,m1=(out[b+1]-out[b])*n;
      for(let i=a+1;i<b;i++){const t=(i-a)/n,t2=t*t,t3=t2*t;out[i]=(2*t3-3*t2+1)*p0+(t3-2*t2+t)*m0+(-2*t3+3*t2)*p1+(t3-t2)*m1;}repairs++;}
    return {data:out,repairs};}
  function biquadHP(f,sr){const w=2*Math.PI*f/sr,c=Math.cos(w),al=Math.sin(w)/(2*Math.SQRT1_2),a0=1+al;return [(1+c)/2/a0,-(1+c)/a0,(1+c)/2/a0,-2*c/a0,(1-al)/a0];}
  function runBiquad(a,co){const [b0,b1,b2,a1,a2]=co;let x1=0,x2=0,y1=0,y2=0;for(let i=0;i<a.length;i++){const x=a[i],y=b0*x+b1*x1+b2*x2-a1*y1-a2*y2;x2=x1;x1=x;y2=y1;y1=y;a[i]=y;}}
  // Low cut: 24 dB/octave high-pass. Soften: a shelf that lowers everything above ~2.5–3 kHz by up to −18 dB.
  function applyTone(L,R,clean,sr){
    if(clean.lowCutHz>=20){const co=biquadHP(clean.lowCutHz,sr);for(const a of [L,R]){runBiquad(a,co);runBiquad(a,co);}}
    if(clean.soften>0){const w=2*Math.PI*2500/sr,c=Math.cos(w),al=Math.sin(w)/(2*Math.SQRT1_2),a0=1+al,co=[(1-c)/2/a0,(1-c)/a0,(1-c)/2/a0,-2*c/a0,(1-al)/a0],s=.875*clean.soften/100;
      for(const a of [L,R]){const l=Float64Array.from(a);runBiquad(l,co);for(let i=0;i<a.length;i++)a[i]=(1-s)*a[i]+s*l[i];}}
  }
  // Look-ahead peak limiter (5 ms), linked stereo, smooth attack, 80 ms release. Circular when looping, so the gain at the seam matches.
  function limitInPlace(L,R,ceiling,sr,loop){
    const n=L.length,look=Math.max(1,Math.round(sr*.005)),rel=1-Math.exp(-1/(sr*.08)),req=new Float64Array(n);
    for(let i=0;i<n;i++){const p=Math.max(Math.abs(L[i]),Math.abs(R[i]));req[i]=p>ceiling?ceiling/p:1;}
    const at=j=>j<n?req[j]:loop?req[j-n]:1,minA=new Float64Array(n),dq=new Int32Array(n+look+1);let h=0,t=0;
    for(let j=0;j<n+look;j++){const v=at(j);while(t>h&&at(dq[t-1])>=v)t--;dq[t++]=j;const i=j-look;if(i>=0){while(dq[h]<i)h++;minA[i]=at(dq[h]);}}
    const mA=i=>i>=0?minA[i]:loop?minA[i+n]:1,box=new Float64Array(n);let sum=0;
    for(let i=-look;i<n;i++){sum+=mA(i);if(i>=1)sum-=mA(i-look-1);if(i>=0)box[i]=sum/(look+1);}
    const g=new Float64Array(n);let env=1;
    for(let pass=0;pass<(loop?2:1);pass++)for(let i=0;i<n;i++){const b=box[i];env=b<env?b:env+rel*(b-env);g[i]=env;}
    let least=1;for(let i=0;i<n;i++){const k=Math.min(g[i],req[i]);L[i]*=k;R[i]*=k;if(k<least)least=k;}
    return 20*Math.log10(least);
  }
  // Integrated loudness, ITU-R BS.1770-4 (K-weighting, 400 ms blocks, absolute −70 and relative −10 LU gates).
  function measureLufs(L,R,sr){
    let K=Math.tan(Math.PI*1681.974450955533/sr);const Vh=Math.pow(10,3.999843853973347/20),Vb=Math.pow(Vh,.4996667741545416),Q=.7071752369554196;let a0=1+K/Q+K*K;
    const shelf=[(Vh+Vb*K/Q+K*K)/a0,2*(K*K-Vh)/a0,(Vh-Vb*K/Q+K*K)/a0,2*(K*K-1)/a0,(1-K/Q+K*K)/a0];
    K=Math.tan(Math.PI*38.13547087602444/sr);const Q2=.5003270373238773;a0=1+K/Q2+K*K;const hpf=[1,-2,1,2*(K*K-1)/a0,(1-K/Q2+K*K)/a0];
    const w=[L,R].map(c=>{const a=Float64Array.from(c);runBiquad(a,shelf);runBiquad(a,hpf);return a;});
    const block=Math.round(sr*.4),step=Math.round(sr*.1),z=[];
    for(let s=0;s+block<=L.length;s+=step){let e=0;for(const a of w)for(let i=s;i<s+block;i++)e+=a[i]*a[i];z.push(e/block);}
    const lk=e=>-.691+10*Math.log10(e),abs=z.filter(e=>e>0&&lk(e)>-70);if(!abs.length)return null;
    const relGate=lk(abs.reduce((p,q)=>p+q,0)/abs.length)-10,kept=abs.filter(e=>lk(e)>relGate);
    return lk(kept.reduce((p,q)=>p+q,0)/kept.length);
  }
  // Fundamental frequency by YIN over the passage the drone reads; returns the median estimate and how many frames agree.
  function detectPitch(x,sr){
    const W=Math.min(4096,Math.max(1024,Math.round(sr*.045))),minLag=Math.floor(sr/1000),maxLag=Math.min(Math.floor(sr/55),W-2),hop=Math.round(W/2);
    if(x.length<W+maxLag+1)return null;const frames=Math.min(40,Math.floor((x.length-W-maxLag-1)/hop)+1),est=[],d=new Float64Array(maxLag+2);
    for(let f=0;f<frames;f++){const o=f*hop;let e=0;for(let i=0;i<W;i++)e+=x[o+i]*x[o+i];if(e<1e-7*W)continue;
      for(let tau=1;tau<=maxLag+1;tau++){let s=0;for(let i=0;i<W;i++){const df=x[o+i]-x[o+i+tau];s+=df*df;}d[tau]=s;}
      let run=0;for(let tau=1;tau<=maxLag+1;tau++){run+=d[tau];d[tau]=run>0?d[tau]*tau/run:1;}
      let best=-1;for(let tau=minLag;tau<=maxLag;tau++){if(d[tau]<.15){while(tau<maxLag&&d[tau+1]<d[tau])tau++;best=tau;break;}}
      if(best<1)continue;const a=d[best-1],b=d[best],c=d[best+1],den=a-2*b+c,shift=den!==0?.5*(a-c)/den:0;est.push(sr/(best+shift));}
    if(!est.length)return {hz:null,confidence:0,frames};
    const sorted=est.slice().sort((p,q)=>p-q),hz=sorted[Math.floor(sorted.length/2)],agree=est.filter(v=>Math.abs(1200*Math.log2(v/hz))<50).length;
    return {hz,confidence:agree/frames,frames};
  }
  // ---- v0.3.3 surround field: background elements that move around the listener (generic headphone binaural approximation) ----
  const FIELD_MODEL='SOULLAB_BINAURAL_APPROX_1';
  const FIELD_PATHS={still:'Still',orbit:'Orbit',drift:'Drift',rise:'Rise & fall',passby:'Pass-by'};
  const FIELD_ELEMENTS=[
    {key:'shimmer',name:'Shimmer',from:'voice',color:'#e4cb9d',desc:'High and airy · from your voice',defaults:{enabled:false,level:60,distance:40,height:30,angle:0,path:'orbit',speed:1,direction:1}},
    {key:'breath',name:'Breath',from:'voice',color:'#98bdb0',desc:'Close and whispering · from your voice',defaults:{enabled:false,level:45,distance:8,height:0,angle:70,path:'drift',speed:.75,direction:1}},
    {key:'murmur',name:'Murmur',from:'voice',color:'#c99566',desc:'Low and distant · from your voice',defaults:{enabled:false,level:70,distance:75,height:-25,angle:180,path:'still',speed:.5,direction:-1}},
    {key:'ambience',name:'Ambience file',from:'file',color:'#9aa2d6',desc:'Wind, water, birds or a bell · its own recording',defaults:{enabled:false,level:60,distance:60,height:10,angle:-120,path:'drift',speed:.5,direction:1}}];
  function defaultField(){return FIELD_ELEMENTS.map(e=>({...e.defaults}));}
  function completeField(f){const given=Array.isArray(f)?f:(f&&Array.isArray(f.elements)?f.elements:[]);
    return FIELD_ELEMENTS.map((e,k)=>{const d=e.defaults,m={...d,...(given[k]||{})};
      return {enabled:m.enabled===true,level:clampNum(m.level,0,150,d.level),distance:clampNum(m.distance,0,100,d.distance),height:clampNum(m.height,-40,80,d.height),angle:clampNum(m.angle,-180,180,d.angle),
        path:Object.prototype.hasOwnProperty.call(FIELD_PATHS,m.path)?m.path:d.path,speed:clampNum(m.speed,.25,6,d.speed),direction:Number(m.direction)<0?-1:1};});}
  const fieldActive=field=>field.some(e=>e.enabled&&e.level>0);
  // A looping render snaps every moving path to whole cycles, so each element is back where it started at the seam.
  function fieldCycles(el,duration,loop){if(el.path==='still')return 0;const c=el.speed*duration/60;return loop?Math.max(1,Math.round(c)):c;}
  const distanceMeters=el=>1+9*Math.pow(el.distance/100,1.5);
  // phase is in cycles. Returns azimuth (deg, 0 front, +90 right, ±180 behind), elevation (deg) and distance (m).
  function fieldPosition(el,phase){
    const D=distanceMeters(el),tw=2*Math.PI*phase,dir=el.direction;let az=el.angle,ev=el.height,d=D;
    if(el.path==='orbit')az=el.angle+dir*360*phase;
    else if(el.path==='drift'){az=el.angle+dir*(70*Math.sin(tw)+25*Math.sin(2*tw+1));ev=el.height+15*Math.sin(tw+.7);d=D*(1+.25*Math.sin(tw+2));}
    else if(el.path==='rise'){az=el.angle+dir*20*Math.sin(tw);ev=el.height+40*Math.sin(tw);}
    else if(el.path==='passby'){const x=dir*Math.max(.8,D*.4),y=Math.max(1.5,D*1.6)*Math.cos(tw);az=el.angle+Math.atan2(x,y)*180/Math.PI;d=Math.hypot(x,y);}
    az=((az+180)%360+360)%360-180;
    return {az,ev:Math.max(-40,Math.min(85,ev)),d:Math.max(1,Math.min(12,d))};
  }
  function lowpassInPlace(a,f,sr){const k=1-Math.exp(-2*Math.PI*f/sr);let s=0;for(let i=0;i<a.length;i++){s+=k*(a[i]-s);a[i]=s;}}
  function highpassInPlace(a,f,sr){const k=1-Math.exp(-2*Math.PI*f/sr);let s=0;for(let i=0;i<a.length;i++){s+=k*(a[i]-s);a[i]-=s;}}
  // Voice-derived textures use their own seeded generators, so the drone's grain sequence is never disturbed.
  function voiceTexture(kind,segment,sr,totalFrames,seed,tuneRate=1){
    const len=segment.length,rng=seedRand(seed),out=new Float32Array(totalFrames);
    const read=p=>{p%=len;if(p<0)p+=len;const a=Math.floor(p),f=p-a;return segment[a]*(1-f)+segment[(a+1)%len]*f;};
    const S={shimmer:{g:[.14,.22],h:[.05,.09]},breath:{g:[.02,.08],h:[.01,.03]},murmur:{g:[.5,.7],h:[.18,.24]}}[kind];
    let t=0;
    while(t<totalFrames){
      const gl=Math.max(64,Math.floor(sr*(S.g[0]+rng()*(S.g[1]-S.g[0])))),pos=rng()*len;
      const rate=(kind==='shimmer'?(rng()<.6?2:Math.pow(2,19/12)):kind==='murmur'?.5:.9+rng()*.25)*tuneRate;
      const n=Math.min(gl,totalFrames-t);
      for(let j=0;j<n;j++)out[t+j]+=read(pos+j*rate)*(.5-.5*Math.cos(2*Math.PI*j/(gl-1)));
      t+=Math.max(1,Math.floor(sr*(S.h[0]+rng()*(S.h[1]-S.h[0]))));
    }
    if(kind==='shimmer'){highpassInPlace(out,1500,sr);}
    else if(kind==='breath'){highpassInPlace(out,2000,sr);highpassInPlace(out,2000,sr);lowpassInPlace(out,8000,sr);}
    else {lowpassInPlace(out,450,sr);lowpassInPlace(out,450,sr);}
    return out;
  }
  // Ambience file: looped with a 50 ms crossfade at its own wrap point, resampled to the render rate.
  function ambienceTexture(amb,sr,totalFrames){
    const data=amb.data,len=data.length,ratio=amb.rate/sr,xf=Math.max(1,Math.min(Math.floor(amb.rate*.05),Math.floor(len/4))),usable=len-xf,out=new Float32Array(totalFrames);
    const at=p=>{const a=Math.min(len-1,Math.floor(p)),f=p-a,b=Math.min(len-1,a+1);return data[a]*(1-f)+data[b]*f;};
    for(let i=0;i<totalFrames;i++){const p=(i*ratio)%usable;let v=at(p);if(p<xf){const w=p/xf;v=v*w+at(usable+p)*(1-w);}out[i]=v;}
    return out;
  }
  // Binaural placement of one mono element. Woodworth ITD, head shadow on the far ear, pinna-style notch for height,
  // high-frequency dimming behind, distance as level + air absorption + reflection send. Parameters move per 64-sample block, interpolated per sample.
  function binauralPass(mono,el,cycles,sr,totalFrames,targetFrames){
    const L=new Float32Array(totalFrames),R=new Float32Array(totalFrames),SL=new Float32Array(totalFrames),SR=new Float32Array(totalFrames);
    const head=.0875,sound=343,BLOCK=64,size=1024,ring=new Float32Array(size);let wp=0;
    const aShadow=1-Math.exp(-2*Math.PI*1400/sr),aTone=1-Math.exp(-2*Math.PI*3500/sr);
    let lpD=0,lpT=0,shL=0,shR=0,x1=0,x2=0,y1=0,y2=0;
    const P=i=>{const p=fieldPosition(el,cycles*i/targetFrames),az=p.az*Math.PI/180,ev=p.ev*Math.PI/180;
      const lat=Math.asin(Math.max(-1,Math.min(1,Math.sin(az)*Math.cos(ev)))),s=Math.abs(Math.sin(lat));
      const itd=Math.min(size/2,(head/sound)*(s+Math.abs(lat))*sr),near=1+.12*s,far=1-.3*s;
      return [lat>0?itd:0,lat<0?itd:0,lat>0?.85*s:0,lat<0?.85*s:0,lat>0?far:near,lat<0?far:near,
        (p.ev/85)*.3-Math.max(0,-Math.cos(az))*Math.cos(ev)*.45,1/(1+(p.d-1)*.35),(.3+.55*(p.d-1)/11)/Math.sqrt(p.d),
        1-Math.exp(-2*Math.PI*Math.min(sr*.45,16000/(1+.55*(p.d-1)))/sr),6500+3500*((p.ev+40)/125)];};
    const rd=d=>{let pos=wp-d;if(pos<0)pos+=size;if(pos>=size)pos-=size;const a=Math.floor(pos)%size,f=pos-Math.floor(pos);return ring[a]*(1-f)+ring[(a+1)%size]*f;};
    let p0=P(0);const v=new Float64Array(9),dv=new Float64Array(9);
    for(let b=0;b<totalFrames;b+=BLOCK){
      const p1=P(b+BLOCK),n=Math.min(BLOCK,totalFrames-b);
      for(let k=0;k<9;k++){v[k]=p0[k];dv[k]=(p1[k]-p0[k])/BLOCK;}
      const aDist=p0[9],w=2*Math.PI*Math.min(p0[10],sr*.45)/sr,alpha=Math.sin(w)/6,cw=Math.cos(w),a0=1+alpha,b0=1/a0,b1=-2*cw/a0,a2=(1-alpha)/a0;
      for(let j=0;j<n;j++){
        const i=b+j;let x=mono[i];
        lpD+=aDist*(x-lpD);x=lpD;
        const ny=b0*x+b1*x1+b0*x2-b1*y1-a2*y2;x2=x1;x1=x;y2=y1;y1=ny;x=.45*x+.55*ny;
        lpT+=aTone*(x-lpT);x+=v[6]*(x-lpT);
        ring[wp]=x;let l=rd(v[0]),r=rd(v[1]);wp=(wp+1)%size;
        shL+=aShadow*(l-shL);shR+=aShadow*(r-shR);
        l=((1-v[2])*l+v[2]*shL)*v[4];r=((1-v[3])*r+v[3]*shR)*v[5];
        L[i]=l*v[7];R[i]=r*v[7];SL[i]=l*v[8];SR[i]=r*v[8];
        for(let k=0;k<9;k++)v[k]+=dv[k];
      }
      p0=p1;
    }
    return {L,R,SL,SR};
  }
  function renderField(field,ctx){
    const {segment,sr,totalFrames,targetFrames,loop,duration,ambience,droneRms}=ctx;
    const L=new Float32Array(totalFrames),R=new Float32Array(totalFrames),SL=new Float32Array(totalFrames),SR=new Float32Array(totalFrames),info=[];
    FIELD_ELEMENTS.forEach((def,k)=>{
      const el=field[k];if(!el.enabled||el.level<=0)return;
      let mono;
      if(def.from==='file'){if(!ambience||!ambience.data)throw new Error('Load an ambience file, or turn the Ambience element off.');mono=ambienceTexture(ambience,sr,totalFrames);}
      else mono=voiceTexture(def.key,segment,sr,totalFrames,[1001,2002,3003][k],ctx.tuneRate||1);
      let sq=0;for(let i=0;i<targetFrames;i++)sq+=mono[i]*mono[i];const rms=Math.sqrt(sq/targetFrames);
      if(rms<1e-7){info.push({element:def.key,skipped:'silent'});return;}
      // 100 % level = the element sits 6 dB under the drone before distance.
      const g=droneRms*.5*(el.level/100)/rms;for(let i=0;i<totalFrames;i++)mono[i]*=g;
      const cycles=fieldCycles(el,duration,loop),b=binauralPass(mono,el,cycles,sr,totalFrames,targetFrames);
      for(let i=0;i<totalFrames;i++){L[i]+=b.L[i];R[i]+=b.R[i];SL[i]+=b.SL[i];SR[i]+=b.SR[i];}
      info.push({element:def.key,cycles,secondsPerCycle:cycles>0?duration/cycles:null});
    });
    // The field's own reflections (separate from the drone's space), so far elements sit back in a room.
    const lens=[71,103,149,197].map(ms=>Math.max(1,Math.floor(sr*ms/1000))),bl=lens.map(n=>new Float32Array(n)),br=lens.map(n=>new Float32Array(n)),ptr=[0,0,0,0];
    for(let i=0;i<totalFrames;i++){let wl=0,wr=0;for(let z=0;z<4;z++){const p=ptr[z],ol=bl[z][p],orr=br[z][p];bl[z][p]=SL[i]*.4+orr*.5;br[z][p]=SR[i]*.4+ol*.5;wl+=ol;wr+=orr;ptr[z]=(p+1)%lens[z];}L[i]+=wl*.35;R[i]+=wr*.35;}
    return {L,R,info};
  }
  async function render(src, opts, onProgress, assets={}){
    const sr=src.rate; if(!Number.isFinite(sr)||sr<8000||sr>192000)throw new Error('Unsupported sample rate.');
    const targetFrames=Math.floor(opts.duration*sr);const overlapFrames=opts.loop?Math.round(Math.min(1.5,opts.duration*.08)*sr):0;
    const totalFrames=targetFrames+overlapFrames;const left=new Float32Array(totalFrames),right=new Float32Array(totalFrames),weight=new Float32Array(totalFrames);
    // v0.3.2: a committed waveform selection replaces the 9 s Source-position window. Without one, the original window is used unchanged.
    let takeFrames,sourceStart;const reg=opts.region;
    if(reg&&Number.isFinite(reg.startSeconds)&&Number.isFinite(reg.endSeconds)){
      const a=Math.max(0,Math.min(src.data.length,Math.round(reg.startSeconds*sr))),b=Math.max(0,Math.min(src.data.length,Math.round(reg.endSeconds*sr)));
      sourceStart=Math.min(a,b);takeFrames=Math.abs(b-a);
      if(takeFrames<Math.round(sr*MIN_REGION_SECONDS))throw new Error('The selection is too short. Mark at least '+MIN_REGION_SECONDS+' seconds.');
    } else {takeFrames=Math.min(src.data.length,Math.floor(sr*9));sourceStart=Math.floor((src.data.length-takeFrames)*(opts.anchor/100));}
    const rev=opts.engineRevision===1?1:2,clean=completeClean(opts.clean),level=completeLevel(opts.level),tune=completeTune(opts.tune);
    let segment=src.data.subarray(sourceStart,sourceStart+takeFrames),clipRepairs=0;
    if(clean.repairClips){const fixed=repairClipped(segment);segment=fixed.data;clipRepairs=fixed.repairs;}
    const length=segment.length;
    let sourcePeak=0;for(let i=0;i<segment.length;i++)sourcePeak=Math.max(sourcePeak,Math.abs(segment[i]));
    if(sourcePeak<.0001)throw new Error('The selected source is silent. Select a passage with audible sound.');
    const sourceGain=Math.min(8,.72/sourcePeak);
    const grainFrames=Math.max(512,Math.floor(sr*opts.grainMs/1000));const hop=Math.max(1,Math.floor(grainFrames*.34));
    const window=new Float32Array(grainFrames);for(let i=0;i<grainFrames;i++)window[i]=.5-.5*Math.cos(2*Math.PI*i/(grainFrames-1));
    const xfadeFrames=clean.smooth>0?Math.min(Math.floor(sr*(.04+.11*clean.smooth/100)),Math.floor(length/(5-2*clean.smooth/100))):Math.min(Math.floor(sr*.04),Math.floor(length/5));let loopLen=length-xfadeFrames;
    // Align grains (experimental, revision 2; stored as clean.smooth): pick the loop point whose tail best matches the head, then (below) align each grain to the one it overlaps (WSOLA).
    const smoothOn=rev===2&&clean.smooth>0,prevBase=[];
    if(smoothOn&&xfadeFrames>8){const span=Math.min(Math.round(sr*.02),Math.floor(loopLen/4));let best=-Infinity,bestL=loopLen;
      for(let L=loopLen-span;L<=loopLen;L++){let s=0,e1=0,e2=0;for(let k=0;k<xfadeFrames;k+=2){const a=segment[L+k],b=segment[k];s+=a*b;e1+=a*a;e2+=b*b;}const c=s/Math.sqrt(e1*e2+1e-20);if(c>best){best=c;bestL=L;}}
      loopLen=bestL;}
    const travel=.006+.46*((100-opts.stillness)/100)**2;
    const motion=opts.movement/100, space=opts.space/100, rng=seedRand();
    const config=presets[opts.preset],layers=config.layers;
    const layerMix=completeMix(opts.preset,Array.isArray(opts.layerMix)&&opts.layerMix.length===layers.length?opts.layerMix:defaultLayerMix(opts.preset));
    if(!layerMix.some(m=>m.enabled!==false&&Number(m.level)>0))throw new Error('Enable at least one audible layer before rendering.');
    // Entry/bloom envelopes finish before the loop crossfade tail so the seam stays coherent.
    const envLimit=targetFrames-overlapFrames,layerClamps=[];
    const envs=layerMix.map((m,l)=>{
      let start=Math.floor(m.entersAt/100*targetFrames),bloom=Math.floor(m.bloomSeconds*sr);
      if(m.enabled&&m.level>0&&start+bloom>envLimit){const ns=Math.min(start,envLimit),nb=Math.max(0,envLimit-ns);layerClamps.push({layer:l,requestedEndSeconds:(start+bloom)/sr,clampedEndSeconds:(ns+nb)/sr});start=ns;bloom=nb;}
      return {start,bloom,active:start>0||bloom>0};
    });
    const envAt=(e,i)=>i<e.start?0:(e.bloom<=0||i>=e.start+e.bloom)?1:Math.sin(Math.PI*.5*(i-e.start)/e.bloom);
    const grains=Math.ceil(totalFrames/hop);
    const wrapSample=position=>{
      if(rev===2){// v0.3.4: loop over [0, length−crossfade) and fade the tail into the head, so the wrap point is continuous
        let p=position%loopLen;if(p<0)p+=loopLen;const a=Math.floor(p),f=p-a;let v=segment[a]*(1-f)+segment[a+1]*f;
        if(p<xfadeFrames){const w=p/xfadeFrames,q=loopLen+p,qi=Math.floor(q),qf=q-qi;v=v*w+(segment[qi]*(1-qf)+segment[Math.min(length-1,qi+1)]*qf)*(1-w);}
        return v*sourceGain;}
      // engine revision 1 (v0.1–v0.3.3), kept so older recipes re-render exactly
      let p=position%length;if(p<0)p+=length;
      const a=Math.floor(p),fraction=p-a,b=(a+1)%length;
      let v=segment[a]*(1-fraction)+segment[b]*fraction;
      if(p>=length-xfadeFrames){const blend=(p-(length-xfadeFrames))/xfadeFrames;const q=p-(length-xfadeFrames),qi=Math.floor(q),qf=q-qi;const v2=segment[qi]*(1-qf)+segment[(qi+1)%length]*qf;v=v*(1-blend)+v2*blend;}
      return v*sourceGain;
    };
    for(let g=0;g<grains;g++){
      const start=g*hop;if(start>=totalFrames)break;
      const jitter=(rng()-.5)*motion*sr*.14*(1-.9*clean.smooth/100);const drift=g*hop*travel;
      const count=Math.min(grainFrames,totalFrames-start);
      // Normalize for overlapping grains, not across layers: independent level moves must remain meaningful.
      for(let j=0;j<count;j++)weight[start+j]+=window[j];
      for(let l=0;l<layers.length;l++){
        const baseLevel=layers[l][1],ctl=layerMix[l],env=envs[l];
        if(ctl.enabled===false||Number(ctl.level)<=0)continue;
        const level=baseLevel*Math.max(0,Math.min(1.5,Number(ctl.level)/100));
        const rate=Math.pow(2,(ctl.interval+opts.pitch+tune.cents/100)/12);
        const pan=Math.max(-.85,Math.min(.85,Number(ctl.pan)/100+motion*.22*Math.sin(g*.035+l*1.8)));
        const panL=Math.SQRT2*Math.cos((pan+1)*Math.PI/4),panR=Math.SQRT2*Math.sin((pan+1)*Math.PI/4);
        let base=length*.09+(drift*(1+l*.03)+jitter+l*sr*.043);
        if(smoothOn){
          if(prevBase[l]!==undefined){const target=prevBase[l]+hop*rate,K=Math.max(16,Math.min(Math.round(sr*.015),count)),D=Math.round(sr/70),T=new Float64Array(Math.ceil(K/3));
            for(let k=0,t=0;k<K;k+=3,t++)T[t]=wrapSample(target+k*rate);
            const score=d=>{let s=0,e=0;for(let k=0,t=0;k<K;k+=3,t++){const a=wrapSample(base+d+k*rate);s+=a*T[t];e+=a*a;}return s/Math.sqrt(e+1e-20);};
            let best=-Infinity,off=0;for(let d=-D;d<=D;d+=2){const c=score(d);if(c>best){best=c;off=d;}}
            for(const d of [off-1,off+1]){const c=score(d);if(c>best){best=c;off=d;}}
            base+=off;}
          prevBase[l]=base;}
        for(let j=0;j<count;j++){
          const w=window[j]*level,i=start+j;let v=wrapSample(base+j*rate)*w;
          if(env.active)v*=envAt(env,i);
          left[i]+=v*panL;right[i]+=v*panR;
        }
      }
      if(g%12===0){onProgress?.(.66*g/grains,'Sustaining grains…');await new Promise(resolve=>setTimeout(resolve,0));}
    }
    let lpL=0,lpR=0;
    const alpha=1-Math.exp(-2*Math.PI*config.cutoff/sr);
    // Short mutually prime-ish delay times; locally computed, no external impulse response.
    const delayMs=[61,89,131,179],lengths=delayMs.map(ms=>Math.max(1,Math.floor(sr*ms/1000)));
    const delayL=lengths.map(n=>new Float32Array(n)),delayR=lengths.map(n=>new Float32Array(n));
    const pointers=[0,0,0,0];
    let peak=0;
    for(let i=0;i<totalFrames;i++){
      const d=weight[i]>.000001?1/weight[i]:0;
      let x=left[i]*d,y=right[i]*d;
      lpL+=alpha*(x-lpL);lpR+=alpha*(y-lpR);x=lpL;y=lpR;
      if(space>0){let wetL=0,wetR=0;for(let z=0;z<4;z++){
        const p=pointers[z],outL=delayL[z][p],outR=delayR[z][p];
        delayL[z][p]=x*.36+outR*.48;delayR[z][p]=y*.36+outL*.48;
        wetL+=outL;wetR+=outR;pointers[z]=(p+1)%lengths[z];
      }left[i]=x*(1-space*.4)+wetL*space*.21;right[i]=y*(1-space*.4)+wetR*space*.21;
      }else{left[i]=x;right[i]=y;}
      if(i%Math.max(1,Math.floor(sr*3))===0){onProgress?.(.66+.20*i/totalFrames,'Shaping space…');await new Promise(resolve=>setTimeout(resolve,0));}
    }
    // v0.3.3 surround field: added after the drone's own filtering and space, before the loop crossfade. The drone itself is untouched.
    const field=completeField(opts.field);let fieldInfo=[],fieldDebug=null;
    if(fieldActive(field)){
      onProgress?.(.86,'Placing the surround field…');await new Promise(resolve=>setTimeout(resolve,0));
      let sq=0;for(let i=0;i<targetFrames;i++)sq+=left[i]*left[i]+right[i]*right[i];
      const droneRms=Math.max(1e-6,Math.sqrt(sq/(2*targetFrames)));
      const fm=renderField(field,{segment,sr,totalFrames,targetFrames,loop:!!opts.loop&&overlapFrames>0,duration:targetFrames/sr,ambience:assets.ambience||null,droneRms,tuneRate:rev===2?Math.pow(2,(opts.pitch+tune.cents/100)/12):1});
      for(let i=0;i<totalFrames;i++){left[i]+=fm.L[i];right[i]+=fm.R[i];}
      fieldInfo=fm.info;if(opts.__debugField===true)fieldDebug={L:fm.L,R:fm.R};
    }
    applyTone(left,right,clean,sr);
    if(opts.loop&&overlapFrames>0){
      for(let i=0;i<overlapFrames;i++){
        const t=i/overlapFrames;left[i]=left[targetFrames+i]*(1-t)+left[i]*t;right[i]=right[targetFrames+i]*(1-t)+right[i]*t;
      }
    }else{
      const fade=Math.max(1,Math.min(Math.floor(sr*.8),Math.floor(targetFrames*.05)));
      for(let i=0;i<fade;i++){const a=Math.sin(Math.PI*.5*i/fade);const end=targetFrames-i-1;left[i]*=a;right[i]*=a;left[end]*=a;right[end]*=a;}
    }
    onProgress?.(.90,'Finalizing 24-bit stereo…');
    for(let i=0;i<targetFrames;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));
    if(peak<.0001)throw new Error('The source produced no audible drone. Choose another passage.');
    const ceiling=ceilingFor(level.outputPeakDb),gain=Math.min(12,ceiling/peak);const outL=new Float32Array(targetFrames),outR=new Float32Array(targetFrames);
    let square=0,finalPeak=0;
    for(let i=0;i<targetFrames;i++){outL[i]=left[i]*gain;outR[i]=right[i]*gain;finalPeak=Math.max(finalPeak,Math.abs(outL[i]),Math.abs(outR[i]));square+=outL[i]**2+outR[i]**2;}
    let limiterReductionDb=0;
    if(level.pushDb>0){onProgress?.(.93,'Limiting…');const push=Math.pow(10,level.pushDb/20);for(let i=0;i<targetFrames;i++){outL[i]*=push;outR[i]*=push;}
      limiterReductionDb=limitInPlace(outL,outR,ceiling,sr,!!opts.loop&&overlapFrames>0);
      square=0;finalPeak=0;for(let i=0;i<targetFrames;i++){finalPeak=Math.max(finalPeak,Math.abs(outL[i]),Math.abs(outR[i]));square+=outL[i]**2+outR[i]**2;}}
    const loudnessLufs=measureLufs(outL,outR,sr);
    onProgress?.(.96,'Encoding WAV…');await new Promise(resolve=>setTimeout(resolve,0));
    const blob=wav24(outL,outR,sr);onProgress?.(1,'Ready');
    return {blob,left:outL,right:outR,rate:sr,frames:targetFrames,peak:finalPeak,rms:Math.sqrt(square/(2*targetFrames)),selectionStart:sourceStart/sr,selectionSeconds:takeFrames/sr,settings:{...opts,layerMix},layerClamps,fieldInfo,gain,fieldDebug,clipRepairs,limiterReductionDb,loudnessLufs,engineRevision:rev};
  }
// ---- lab.js 650-664 ----
  function buildRecipe(r,source,credit,rights,ambienceMeta=null){
    const fieldRec=fieldRecipe(r),ambOn=fieldRec.active&&fieldRec.elements[3].enabled&&!fieldRec.elements[3].skipped;
    const P=presets[r.settings.preset];
    return {format:'SOULLAB_VOICE_TO_DRONE_CREATIVE_LAB_V0_3_4',createdAt:new Date().toISOString(),status:'LOCAL_CREATIVE_STUDY_NOT_MEDIA_ADMISSION',
      source:{name:source.name,credit:credit||null,selfReportedRights:rights,syntheticDemonstration:!!source.synthetic,selectionMode:r.settings.region?'waveform-selection':'source-position-window',selectedOffsetSeconds:r.selectionStart,selectedDurationSeconds:r.selectionSeconds},
      processing:{engine:'deterministic overlap-add granular sustain; per-layer entry/bloom envelopes; filtered diffusion delays',preset:r.settings.preset,...r.settings,engineRevision:r.engineRevision??2,clean:completeClean(r.settings.clean),level:completeLevel(r.settings.level),tune:{...completeTune(r.settings.tune),detectedSourcePitch:r.detectedPitch||null},
        layers:P.layers.map((p,i)=>{const m=r.settings.layerMix[i];return {name:P.layerNames[i],semitonesRelativeToSource:m.interval,presetSemitones:p[0],presetBaseGain:p[1],enabled:m.enabled,relativeLevelPercent:m.level,positionPercent:m.pan,entersAtPercent:m.entersAt,bloomSeconds:m.bloomSeconds};}),
        layerClamps:r.layerClamps,field:fieldRec},
      sources:[{role:'voice',name:source.name,credit:credit||null,selfReportedRights:rights}].concat(ambOn&&ambienceMeta?[{role:'ambience',name:ambienceMeta.name,credit:ambienceMeta.credit||null,selfReportedRights:ambienceMeta.rights,seconds:ambienceMeta.seconds,sampleRate:ambienceMeta.rate}]:[]),
      output:{channels:2,sampleRate:r.rate,bitsPerSample:24,seconds:r.frames/r.rate,peakDbFS:+decibels(r.peak),rmsDbFS:+decibels(r.rms),loudnessLUFS:r.loudnessLufs==null?null:+r.loudnessLufs.toFixed(1),limiterMaxReductionDb:+(r.limiterReductionDb||0).toFixed(2),clipRepairs:r.clipRepairs||0},
      provenanceNotice:'Private research recipe. Credits and rights are self-reported only, not verified clearance. Source-derived pitch layers are NOT isolated overtone voices. Preserve original master; clear recording, composition, performer, cultural and derivative-use permissions before public distribution. No clinical claims.'};
  }
  // Re-render settings from a recipe. Recipes without layerMix (v0.1/v0.2) resolve to preset defaults; v0.3 mixes gain default interval/entry/bloom.
  function recipeToSettings(recipe){const p=recipe.processing;return {preset:p.preset,duration:p.duration,stillness:p.stillness,grainMs:p.grainMs,pitch:p.pitch,movement:p.movement,space:p.space,anchor:p.anchor,loop:p.loop,
    layerMix:completeMix(p.preset,Array.isArray(p.layerMix)?p.layerMix:defaultLayerMix(p.preset)),soloLayer:p.soloLayer??null,region:p.region??null,field:p.field??null,clean:p.clean??null,level:p.level??null,tune:p.tune??null,engineRevision:p.engineRevision===2?2:1};}

export { presets, MIN_REGION_SECONDS, INTERVAL_RANGE, clampNum, completeMix, defaultLayerMix, safeName, makeWaveBlob, wav24, syntheticVowel, noteInfo, snapCents, seedRand, completeClean, completeLevel, completeTune, findClipRuns, repairClipped, applyTone, limitInPlace, measureLufs, detectPitch, FIELD_MODEL, FIELD_PATHS, FIELD_ELEMENTS, defaultField, completeField, fieldCycles, fieldPosition, binauralPass, voiceTexture, render, buildRecipe, recipeToSettings };
