/**
 * SOULLAB TRANSFORM T1 — Soullab-made reverb spaces.
 *
 * Convolution reverb needs an impulse response. Using recorded spaces would
 * bring third-party rights into a member's file, so T1 generates its own from
 * documented parameters: exponentially decaying noise with a short pre-delay,
 * independent per channel for width, from a fixed seed so the same space is
 * the same space every time (and the recipe in provenance is reproducible).
 */
import type { ReverbSpace } from './recipe';

export const SPACES: Readonly<Record<ReverbSpace, { rt60: number; preDelayMs: number; label: string }>> = Object.freeze({
  room: { rt60: 0.5, preDelayMs: 8, label: 'Room' },
  chamber: { rt60: 1.2, preDelayMs: 15, label: 'Chamber' },
  hall: { rt60: 2.4, preDelayMs: 24, label: 'Hall' },
});

/** xorshift32 — tiny, deterministic, good enough for diffuse noise. */
function noise(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    return x / 0x100000000 * 2 - 1;
  };
}

/** Stereo impulse response for `space` at `sampleRate`, energy-normalized. */
export function impulseResponse(space: ReverbSpace, sampleRate: number): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  const { rt60, preDelayMs } = SPACES[space];
  const pre = Math.round((preDelayMs / 1000) * sampleRate);
  const len = pre + Math.round(rt60 * sampleRate);
  // −60 dB at rt60: amplitude decays as 10^(−3·t/rt60).
  const k = -3 * Math.LN10 / (rt60 * sampleRate);
  const make = (seed: number) => {
    const rnd = noise(seed);
    const ir = new Float32Array(len);
    let energy = 0;
    for (let i = pre; i < len; i++) { ir[i] = rnd() * Math.exp(k * (i - pre)); energy += ir[i] * ir[i]; }
    const scale = 1 / Math.sqrt(energy || 1);
    for (let i = pre; i < len; i++) ir[i] *= scale;
    return ir;
  };
  return [make(0x5011ab01), make(0x5011ab02)];
}
