/** Review-only offline DSP evidence, not source-owner/production acceptance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { masterVoice, VOICE_PROFILES, MASTERING_VERSION } from '../../lib/listening/transform/mastering.ts';

const tone = (hz, amp=0.25, seconds=0.4, rate=48000, channels=1) => ({
  sampleRate: rate,
  channels: Array.from({length: channels}, () => Float32Array.from({length: Math.round(rate*seconds)}, (_,i)=> amp * Math.sin(2*Math.PI*hz*i/rate)))
});
const measure = a => Math.sqrt(a.channels[0].reduce((sum,v)=>sum+v*v,0) / a.channels[0].length);
const isIdentical = (a,b) => a.channels.every((ch,c)=>ch.every((x,i)=>Object.is(x,b.channels[c][i])));

for (const [id,p] of Object.entries(VOICE_PROFILES)) {
  test(`${id}: preserves rate, channels, length and original, with peak ceiling`, ()=>{
    const source = tone(217,1.2,.22,44100,2);
    const before = source.channels.map(x=>x.slice());
    const {audio,meters,applied} = masterVoice(source,{profile:id,intensity:1});
    assert.equal(audio.sampleRate,44100); assert.equal(audio.channels.length,2);
    assert.equal(audio.channels[0].length,source.channels[0].length);
    assert.equal(applied.version,MASTERING_VERSION);
    assert.deepEqual(source.channels,before);
    assert.ok(meters.outputSamplePeakDbfs <= p.ceilingDbfs + 0.0001, JSON.stringify(meters));
    assert.ok(audio.channels.every(c=>c.every(Number.isFinite)));
    assert.ok(meters.staticCeilingAttenuationDb <= 0);
  });
}
test('bypass is sample-exact, including a too-hot input (no silent processing)',()=>{
  const a=tone(311,1.3,.2);
  const b=masterVoice(a,{profile:'natural',intensity:0});
  assert.ok(isIdentical(a,b.audio)); assert.notEqual(a.channels[0],b.audio.channels[0]);
  assert.ok(b.meters.outputSamplePeakDbfs>0); assert.equal(b.meters.staticCeilingAttenuationDb,0);
});
test('zero is silent and does not create a buzz or divide-by-zero',()=>{
  const a={sampleRate:44100,channels:[new Float32Array(10000)]};
  const b=masterVoice(a,{profile:'broadcast',intensity:1});
  assert.equal(measure(b.audio),0); assert.equal(b.meters.outputRmsDbfs,-Infinity);
});
test('stereo identical sources stay aligned and channels are not coupled by sample mutation',()=>{
  const a=tone(450,.3,.15,48000,2);
  const b=masterVoice(a,{profile:'audiobook',intensity:.7});
  assert.ok(b.audio.channels[0].every((x,i)=>x===b.audio.channels[1][i]));
  assert.ok(isIdentical(a,tone(450,.3,.15,48000,2)));
});
test('sacred voice attenuates low-frequency rumble more than vocal fundamentals',()=>{
  const low=masterVoice(tone(22,.2,.5),{profile:'sacred',intensity:1}).audio;
  const voice=masterVoice(tone(220,.2,.5),{profile:'sacred',intensity:1}).audio;
  assert.ok(measure(low)<measure(voice)*.5, `${measure(low)} vs ${measure(voice)}`);
});
test('compressor reduces loud-to-quiet contrast',()=>{
  const rate=48000, n=rate;
  const ch=Float32Array.from({length:n},(_,i)=>Math.sin(2*Math.PI*300*i/rate)*(i<n/2?.08:.65));
  const a={sampleRate:rate,channels:[ch]};
  const b=masterVoice(a,{profile:'broadcast',intensity:1}).audio.channels[0];
  const rms=(x,start,len)=>Math.sqrt(x.slice(start,start+len).reduce((s,v)=>s+v*v,0)/len);
  const quietS=Math.round(rate*.35), loudS=Math.round(rate*.80), length=Math.round(rate*.1);
  const inRatio=rms(ch,loudS,length)/rms(ch,quietS,length);
  const outRatio=rms(b,loudS,length)/rms(b,quietS,length);
  assert.ok(outRatio<inRatio*.85,`${outRatio} not compressed vs ${inRatio}`);
});
test('invalid profile, intensity, channel and samples fail closed',()=>{
  const a=tone(500);
  for(const opts of [{profile:'fake',intensity:1},{profile:'natural',intensity:-1},{profile:'natural',intensity:NaN},{profile:'natural',intensity:1,outputTrimDb:25}]){
    assert.throws(()=>masterVoice(a,opts),/valid voice profile/);
  }
  assert.throws(()=>masterVoice({sampleRate:48000,channels:[new Float32Array([NaN])]}, {profile:'sacred',intensity:1}),/invalid audio samples/);
  assert.throws(()=>masterVoice({sampleRate:0,channels:[new Float32Array(4)]}, {profile:'sacred',intensity:1}),/mono or stereo/);
});
test('low sample rate avoids invalid DSP coefficients',()=>{
  const a=tone(1000,.2,.1,8000);
  const b=masterVoice(a,{profile:'natural',intensity:1});
  assert.ok(b.audio.channels[0].every(Number.isFinite));
});
