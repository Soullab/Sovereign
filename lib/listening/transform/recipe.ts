/**
 * SOULLAB TRANSFORM T1 — the recipe: what a member asked to be done to their
 * own recording, in order. Owner LISTEN-01 #1979; founder ruling 2026-11-17
 * (comment 6963607549) and T1 approval (comment 6964484327).
 *
 * A recipe is plain data. It is validated here, applied by render.ts, and
 * written verbatim into the provenance of every file it produces, so a
 * transformed take always says exactly what was done to it.
 */

import { VOICE_PROFILES, type VoiceProfile } from './mastering';

export const TRANSFORM_VERSION = 'soullab-transform-t1/1';
/** T1 decision 2: at most 20 minutes in or out of a transform. */
export const MAX_TRANSFORM_SECONDS = 20 * 60;
/** Normalize never targets above this peak. */
export const NORMALIZE_MAX_DBFS = -1;

export type ReverbSpace = 'room' | 'chamber' | 'hall';

export type TransformStep =
  | { kind: 'trim'; startSec: number; endSec: number }
  | { kind: 'fade'; inSec: number; outSec: number }
  | { kind: 'normalize'; peakDbfs: number }
  | { kind: 'reverse' }
  | { kind: 'loop'; times: number; crossfadeMs: number }
  | { kind: 'join'; crossfadeMs: number }
  | { kind: 'gain'; db: number }
  | { kind: 'voiceMaster'; profile: VoiceProfile; intensity: number; outputTrimDb: number }
  | { kind: 'eq'; lowDb: number; midDb: number; midHz: number; highDb: number }
  | { kind: 'filter'; highpassHz: number | null; lowpassHz: number | null }
  | { kind: 'reverb'; space: ReverbSpace; mix: number };

/** Steps rendered by Web Audio nodes in an OfflineAudioContext; the rest are exact sample arithmetic. */
export const NODE_STEPS = new Set<TransformStep['kind']>(['eq', 'filter', 'reverb']);

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const within = (v: unknown, lo: number, hi: number): v is number => finite(v) && v >= lo && v <= hi;

/** Returns a reason the step is refused, or null when it is valid. */
export function stepProblem(step: TransformStep, nyquist = 22_050): string | null {
  switch (step?.kind) {
    case 'trim':
      return within(step.startSec, 0, MAX_TRANSFORM_SECONDS) && within(step.endSec, 0, MAX_TRANSFORM_SECONDS) && step.endSec > step.startSec
        ? null : 'Trim needs a start before its end.';
    case 'fade':
      return within(step.inSec, 0, 60) && within(step.outSec, 0, 60) ? null : 'Fades are 0 to 60 seconds.';
    case 'normalize':
      return within(step.peakDbfs, -30, NORMALIZE_MAX_DBFS) ? null : `Normalize targets between −30 and ${String(NORMALIZE_MAX_DBFS).replace('-', '−')} dBFS.`;
    case 'reverse':
      return null;
    case 'loop':
      return Number.isInteger(step.times) && step.times >= 2 && step.times <= 64 && within(step.crossfadeMs, 0, 2000)
        ? null : 'Loop repeats 2 to 64 times, with a crossfade of up to 2 seconds.';
    case 'join':
      return within(step.crossfadeMs, 0, 5000) ? null : 'A join crossfade is up to 5 seconds.';
    case 'gain':
      return within(step.db, -40, 24) ? null : 'Gain is −40 to +24 dB.';
    case 'voiceMaster':
      return Object.hasOwn(VOICE_PROFILES, step.profile) && within(step.intensity, 0, 1) && within(step.outputTrimDb, -12, 12)
        ? null : 'Choose a voice profile, intensity from 0 to 1, and output trim within ±12 dB.';
    case 'eq':
      return within(step.lowDb, -18, 18) && within(step.midDb, -18, 18) && within(step.highDb, -18, 18)
        && within(step.midHz, 100, Math.min(10_000, nyquist - 1)) ? null : 'EQ bands are ±18 dB; the middle band sits between 100 Hz and 10 kHz.';
    case 'filter': {
      const hp = step.highpassHz, lp = step.lowpassHz;
      if (hp === null && lp === null) return 'Choose a high-pass, a low-pass, or both.';
      if (hp !== null && !within(hp, 10, nyquist - 1)) return 'High-pass is 10 Hz up to the Nyquist limit.';
      if (lp !== null && !within(lp, 20, nyquist - 1)) return 'Low-pass is 20 Hz up to the Nyquist limit.';
      if (hp !== null && lp !== null && hp >= lp) return 'High-pass must sit below low-pass.';
      return null;
    }
    case 'reverb':
      return (step.space === 'room' || step.space === 'chamber' || step.space === 'hall') && within(step.mix, 0, 1)
        ? null : 'Reverb needs a space and a mix from 0 to 1.';
    default:
      return 'Unknown step.';
  }
}

export function recipeProblem(steps: readonly TransformStep[], nyquist?: number): string | null {
  if (!Array.isArray(steps) || steps.length === 0) return 'Add at least one step.';
  if (steps.length > 32) return 'A recipe has at most 32 steps.';
  if (steps.filter((s) => s?.kind === 'join').length > 1) return 'Join one other recording at most.';
  for (const [i, step] of steps.entries()) {
    const problem = stepProblem(step, nyquist);
    if (problem) return `Step ${i + 1}: ${problem}`;
  }
  return null;
}
