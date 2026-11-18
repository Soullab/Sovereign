/**
 * SOULLAB TRANSFORM T1 — exact sample arithmetic for the edit steps.
 *
 * Pure functions on plain Float32Array channels. Every function returns NEW
 * arrays and never touches its input, so the member's decoded original stays
 * exactly what was read from their file.
 */
import { MAX_TRANSFORM_SECONDS } from './recipe';

/** Samples on a plain (never shared) ArrayBuffer, as Web Audio requires. */
export type Samples = Float32Array<ArrayBuffer>;
export type Audio = { sampleRate: number; channels: Samples[] };

export const frameCount = (a: Audio): number => a.channels[0]?.length ?? 0;
export const seconds = (a: Audio): number => frameCount(a) / a.sampleRate;

function assertLength(frames: number, sampleRate: number): void {
  if (frames > MAX_TRANSFORM_SECONDS * sampleRate) {
    throw new Error('The result would be longer than 20 minutes.');
  }
}

export function trim(a: Audio, startSec: number, endSec: number): Audio {
  const n = frameCount(a);
  const s = Math.max(0, Math.min(n, Math.round(startSec * a.sampleRate)));
  const e = Math.max(s, Math.min(n, Math.round(endSec * a.sampleRate)));
  if (e - s < 1) throw new Error('The trimmed part is empty.');
  return { sampleRate: a.sampleRate, channels: a.channels.map((c) => c.slice(s, e)) };
}

/** Raised-cosine gain from 0 to 1 over `len` samples; monotonic, smooth at both ends. */
const rise = (i: number, len: number): number => 0.5 - 0.5 * Math.cos((Math.PI * i) / len);

export function fade(a: Audio, inSec: number, outSec: number): Audio {
  const n = frameCount(a);
  const fi = Math.min(n, Math.round(inSec * a.sampleRate));
  const fo = Math.min(n, Math.round(outSec * a.sampleRate));
  return {
    sampleRate: a.sampleRate,
    channels: a.channels.map((c) => {
      const out = c.slice();
      for (let i = 0; i < fi; i++) out[i] *= rise(i, fi);
      for (let i = 0; i < fo; i++) out[n - 1 - i] *= rise(i, fo);
      return out;
    }),
  };
}

export function peak(a: Audio): number {
  let p = 0;
  for (const c of a.channels) for (let i = 0; i < c.length; i++) { const v = Math.abs(c[i]); if (v > p) p = v; }
  return p;
}

/** Scales so the highest sample sits exactly at `peakDbfs`. Silence stays silence. */
export function normalize(a: Audio, peakDbfs: number): Audio {
  const p = peak(a);
  if (p === 0) return { sampleRate: a.sampleRate, channels: a.channels.map((c) => c.slice()) };
  const k = 10 ** (peakDbfs / 20) / p;
  return { sampleRate: a.sampleRate, channels: a.channels.map((c) => c.map((v) => v * k)) };
}

export function reverse(a: Audio): Audio {
  return { sampleRate: a.sampleRate, channels: a.channels.map((c) => c.slice().reverse()) };
}

export function gain(a: Audio, db: number): Audio {
  const k = 10 ** (db / 20);
  return { sampleRate: a.sampleRate, channels: a.channels.map((c) => c.map((v) => v * k)) };
}

/** Appends `b` to `a`, overlapping `xf` samples with an equal-power crossfade. */
function splice(a: Samples, b: Samples, xf: number): Samples {
  const overlap = Math.min(xf, a.length, b.length);
  const out = new Float32Array(a.length + b.length - overlap);
  out.set(a.subarray(0, a.length - overlap), 0);
  for (let i = 0; i < overlap; i++) {
    const t = (i + 0.5) / overlap;
    out[a.length - overlap + i] = a[a.length - overlap + i] * Math.cos((t * Math.PI) / 2) + b[i] * Math.sin((t * Math.PI) / 2);
  }
  out.set(b.subarray(overlap), a.length);
  return out;
}

export function loop(a: Audio, times: number, crossfadeMs: number): Audio {
  const xf = Math.round((crossfadeMs / 1000) * a.sampleRate);
  const n = frameCount(a);
  const overlap = Math.min(xf, n);
  assertLength(n * times - overlap * (times - 1), a.sampleRate);
  return {
    sampleRate: a.sampleRate,
    channels: a.channels.map((c) => {
      let out = c.slice();
      for (let k = 1; k < times; k++) out = splice(out, c, overlap);
      return out;
    }),
  };
}

/** Mono becomes two identical channels; stereo is unchanged. */
function asChannels(a: Audio, count: number): Samples[] {
  if (a.channels.length === count) return a.channels;
  if (a.channels.length === 1 && count === 2) return [a.channels[0], a.channels[0]];
  throw new Error('Only mono and stereo recordings can be joined.');
}

export function join(a: Audio, b: Audio, crossfadeMs: number): Audio {
  if (a.sampleRate !== b.sampleRate) {
    throw new Error(`These recordings have different sample rates (${a.sampleRate} Hz and ${b.sampleRate} Hz), so they are not joined. Nothing is resampled silently.`);
  }
  const count = Math.max(a.channels.length, b.channels.length);
  const ac = asChannels(a, count), bc = asChannels(b, count);
  const xf = Math.round((crossfadeMs / 1000) * a.sampleRate);
  assertLength(frameCount(a) + frameCount(b) - Math.min(xf, frameCount(a), frameCount(b)), a.sampleRate);
  return { sampleRate: a.sampleRate, channels: ac.map((c, i) => splice(c, bc[i], xf)) };
}
