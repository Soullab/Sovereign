// Soullab Sound Studio · Living Library studies (LISTEN-01 review only).
// Uses the existing PersistentListeningProvider single output lease, never its own AudioContext.
// Exact 639-Hz tone and 8:13 rhythmic study are original Web Audio synthesis; all other works
// are authored five-part scores run on the EXISTING Liquid Harmonics engine.
// No samples, field recordings, third-party masters, physiological claims or tactile hardware.
import type { ProceduralStudy } from './proceduralStudy';
import type { AtlasWork } from './soundAtlasCatalog';
import { DEFAULT_PARAMS, cleanParams, cleanScore, createLiquidEngine } from './liquidHarmonics';
import type { Params, Score } from './liquidHarmonics';

export const ATLAS_PHASES = ['Arrival','Turning','Opening','Flowering','Return'] as const;
const limit = (n:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,n));
const stageParams = (w:AtlasWork, i:number):Params => {
 const intensity = [0.45,0.66,0.82,1,0.38][i];
 const f0=limit(w.root * [1,1.008,1.025,1.05,1][i],55,440);
 return cleanParams({
   f0, vowel: [0.5,1.4,2.4,3.2,1.5][i],vowelMove:0.2+w.spiral*0.65,
   voices:3+Math.round(4*w.overtone),body:limit(w.body*intensity,0,1),
   overtone:limit(w.overtone*intensity,0,1),otMove:1.5+3*w.spiral,
   second:0.3,ratio:1.5,beat:1.3,sub:limit(w.body*.55,0,1),
   rate:limit(w.pulse*(0.85+0.4*intensity),.5,60),depth:0.2+w.spiral*.45,
   wobble:5+55*w.spiral,shape:'sine',binaural:0.1,
   spiral:limit(w.spiral*intensity,0,1.5),spiralSpeed:.2+1.2*w.spiral,
   shift:15+25*w.spiral,fb:.2,time:.28,wet:.25,
   press:0,pressF:55,pressRate:1,pressLink:0,
   swirl:.1+w.spiral*.55,swirlRate:.14,rotate:.1+w.spiral*.22,
   verb:.48+w.air*.6,center:0.25+0.25*intensity,glass:limit(w.glass*intensity,0,1.5),
   air:w.air*intensity,swell:.2+w.body*.35,breath:.055,
 });
};
export function atlasScore(w:AtlasWork):Score {
 const fade=15;
 const available=w.duration-fade;
 const fractions=[.15,.21,.24,.23,.17];
 const durations=fractions.map(x=>Math.round(available*x));
 durations[4]=available-durations.slice(0,4).reduce((a,b)=>a+b,0);
 return cleanScore({
   format:'liquid-harmonics-score/1',title:w.title,
   author:'Soullab / Living Library · original procedural studio study',
   steps:[...durations.map((seconds,i)=>({
     type:'morph',name:ATLAS_PHASES[i],params:stageParams(w,i),
     seconds,hold:0,
   })),{type:'end',seconds:fade}],
 });
}
const makeParams = (w:AtlasWork):Params => ({
 ...DEFAULT_PARAMS,...stageParams(w,0),
 music:limit(w.music,0,.4),musicMove:.25+w.spiral*.3,
 touch:0,press:0,brk:'open into stillness',
});

// One exact 639-Hz study plus an eight-versus-thirteen (60 s) LFO interpretation.
// These are artistic compositional choices. An 8:13 orbital ratio cannot imply a sound.
function makeOrbitalStudy(w:AtlasWork):ProceduralStudy {
 return {
   id:'sound-atlas-'+w.id,title:w.title,subtitle:w.subtitle,
   message:'Original browser synthesis · no recording or effect claim · use the shared Stop.',
   build:(ctx,destination,api)=>{
     const nodes:AudioNode[]=[];const oscs:OscillatorNode[]=[];
     const node=<T extends AudioNode>(n:T):T=>{nodes.push(n);return n;};
     const bus=node(ctx.createGain());bus.gain.value=0;
     bus.connect(destination);
     const add=(hz:number,amplitude:number,pan:number,rate:number)=>{
       const osc=node(ctx.createOscillator());osc.type='sine';osc.frequency.value=hz;
       const amp=node(ctx.createGain());amp.gain.value=amplitude;
       const p=node(ctx.createStereoPanner());p.pan.value=pan;
       const lfo=node(ctx.createOscillator());lfo.type='sine';lfo.frequency.value=rate;
       const mod=node(ctx.createGain());mod.gain.value=amplitude*.25;
       lfo.connect(mod);mod.connect(amp.gain);
       osc.connect(amp);amp.connect(p);p.connect(bus);
       osc.start();lfo.start();oscs.push(osc,lfo);
     };
     // Pure Form is an exact fundamental; Orbital Dance has 8 and 13 cycles / minute,
     // with a harmonic family whose 4th partial is 639 Hz (159.75*4).
     if(w.special==='pure639') {
       add(639,.11,0,.06); add(1278,.006,0,.04);add(319.5,.009,0,.04);
     } else {
       add(159.75,.075,-.3,8/60);add(239.625,.035,.25,13/60);
       add(319.5,.027,-.15,13/60);add(639,.019,.34,8/60);
     }
     const t0=ctx.currentTime;
     const vol=()=>{const elapsed=ctx.currentTime-t0;const fadeIn=limit(elapsed/7,0,1);
       const fadeOut=limit((w.duration-elapsed)/12,0,1);
       bus.gain.setTargetAtTime(.56*fadeIn*fadeOut,ctx.currentTime,.3);
       if(elapsed>=w.duration) {clearInterval(ticker);api.ended('Journey complete. Sound stopped.');}
     };
     const ticker=setInterval(vol,250);
     vol();
     return {dispose:()=>{
       clearInterval(ticker);try{bus.gain.setValueAtTime(0,ctx.currentTime);}catch{}
       for(const o of oscs)try{o.stop();}catch{}
       for(const n of nodes)try{n.disconnect();}catch{}
     }};
   },
 };
}
export function atlasProceduralStudy(w:AtlasWork):ProceduralStudy {
 if(w.special==='pure639'||w.special==='orbital813')return makeOrbitalStudy(w);
 return {
   id:'sound-atlas-'+w.id,title:w.title,subtitle:w.subtitle,
   message:'Original browser synthesis · five-part score · use the shared Pause / Stop.',
   build:(ctx,destination,api)=>{
     const engine=createLiquidEngine(ctx,destination,makeParams(w),api);
     const started=engine.playJourney(atlasScore(w));
     if(!started){engine.dispose();throw new Error('Atlas score did not begin');}
     return {dispose:()=>engine.dispose()};
   },
 };
}
