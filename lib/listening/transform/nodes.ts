/**
 * SOULLAB TRANSFORM T1 — the shaping steps (EQ, filters, reverb), rendered by
 * the browser's own Web Audio nodes in an OfflineAudioContext.
 *
 * Offline: nothing is heard and no output device is touched, so this never
 * competes with the one persistent player or its output lock. The context runs
 * at the recording's own sample rate, so nothing is resampled.
 */
import type { Audio } from './audio';
import type { TransformStep } from './recipe';
import { impulseResponse } from './impulses';

type OfflineCtor = new (channels: number, length: number, sampleRate: number) => OfflineAudioContext;

/** EQ band corner frequencies (fixed; documented in provenance by the version). */
export const EQ_LOW_SHELF_HZ = 200;
export const EQ_HIGH_SHELF_HZ = 4000;
export const EQ_MID_Q = 1;
export const FILTER_Q = Math.SQRT1_2;

export async function renderNodeSteps(a: Audio, steps: readonly TransformStep[], Offline: OfflineCtor): Promise<Audio> {
  const channels = a.channels.length;
  const frames = a.channels[0].length;
  const reverbs = steps.filter((s): s is Extract<TransformStep, { kind: 'reverb' }> => s.kind === 'reverb');
  const tail = reverbs.reduce((n, s) => n + impulseResponse(s.space, a.sampleRate)[0].length, 0);
  const outChannels = reverbs.length ? 2 : channels;
  const ctx = new Offline(outChannels, frames + tail, a.sampleRate);

  const buffer = ctx.createBuffer(channels, frames, a.sampleRate);
  a.channels.forEach((c, i) => buffer.copyToChannel(c, i));
  const src = ctx.createBufferSource();
  src.buffer = buffer;

  let node: AudioNode = src;
  const biquad = (type: BiquadFilterType, frequency: number, gainDb = 0, q = FILTER_Q) => {
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = frequency; f.gain.value = gainDb; f.Q.value = q;
    node.connect(f); node = f;
  };
  for (const step of steps) {
    if (step.kind === 'eq') {
      biquad('lowshelf', EQ_LOW_SHELF_HZ, step.lowDb);
      biquad('peaking', step.midHz, step.midDb, EQ_MID_Q);
      biquad('highshelf', EQ_HIGH_SHELF_HZ, step.highDb);
    } else if (step.kind === 'filter') {
      if (step.highpassHz !== null) biquad('highpass', step.highpassHz);
      if (step.lowpassHz !== null) biquad('lowpass', step.lowpassHz);
    } else if (step.kind === 'reverb') {
      const [l, r] = impulseResponse(step.space, a.sampleRate);
      const ir = ctx.createBuffer(2, l.length, a.sampleRate);
      ir.copyToChannel(l, 0); ir.copyToChannel(r, 1);
      const conv = ctx.createConvolver();
      conv.normalize = false; // the impulse is already energy-normalized
      conv.buffer = ir;
      const dry = ctx.createGain(), wet = ctx.createGain(), sum = ctx.createGain();
      dry.gain.value = 1 - step.mix; wet.gain.value = step.mix;
      node.connect(dry); node.connect(conv); conv.connect(wet);
      dry.connect(sum); wet.connect(sum);
      node = sum;
    } else {
      throw new Error(`${step.kind} is not a shaping step.`);
    }
  }
  node.connect(ctx.destination);
  src.start(0);
  const rendered = await ctx.startRendering();
  return {
    sampleRate: a.sampleRate,
    channels: Array.from({ length: rendered.numberOfChannels }, (_, i) => rendered.getChannelData(i).slice()),
  };
}
