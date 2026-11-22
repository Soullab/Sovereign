// LISTEN-01 · Liquid Harmonics — sketch 09 as a Sound Studio procedural study (founder go-ahead 2026-11-21:
// "Yes, review branch").
//
// REVIEW-ONLY. A founder-steered instrument, generated in the browser with no recorded media. It plays only
// through the persistent player (see proceduralStudy.ts): the player owns the context, the output lease, the level,
// Pause and Stop. The engine follows liquid-harmonics-sketch-09.html closely, so that what the founder heard locally
// is what plays here. No state, effect or health outcome is claimed, and no AI composes anything: a journey is a
// score the listener writes, and every score is checked here, whoever wrote it.

import type { ProceduralStudy, ProceduralStudyAPI, ProceduralStudyHandle } from './proceduralStudy';

// ── Controls ──────────────────────────────────────────────────────────────────────────────────────────
export type Group = 'Voice' | 'Oscillation' | 'Frequency shifts' | 'Rise' | 'Pressure' | 'Space' | 'Atmosphere' | 'Music' | 'Touch';
export type Control = {
  g: Group; k: string; label: string; v: number | string;
  min?: number; max?: number; step?: number; log?: boolean; unit?: string; hint?: string;
  options?: readonly string[]; format?: 'vowel' | 'int' | 'ratio';
};

export const VOWELS: readonly (readonly number[])[] = [[300, 870, 2240], [500, 700, 2400], [730, 1090, 2440], [530, 1840, 2480], [270, 2290, 3010]]; // u o a e i
export const BREAKTHROUGHS = ['open into stillness', 'silence', 'pop, then stillness'] as const;

// Defaults are the founder's settings from 21 Nov 2026 (addendum obs 27, sawtooth throb).
export const CONTROLS: readonly Control[] = Object.freeze([
  { g: 'Voice', k: 'f0', label: 'Fundamental', min: 55, max: 440, v: 209, log: true, unit: 'Hz', hint: 'The low tone everything grows from.' },
  { g: 'Voice', k: 'vowel', label: 'Vowel inside the tone', min: 0, max: 4, v: 4, step: 0.01, format: 'vowel', hint: 'oo → oh → ah → eh → ee' },
  { g: 'Voice', k: 'vowelMove', label: 'Vowel drift', min: 0, max: 1, v: 0.94, hint: 'The vowel wanders by itself: liquid movement inside one pitch.' },
  { g: 'Voice', k: 'overtone', label: 'Singing overtone', min: 0, max: 1, v: 0.94, hint: 'A whistle-like harmonic emerging above the tone.' },
  { g: 'Voice', k: 'otMove', label: 'Overtone movement', min: 0, max: 8, v: 2.99, unit: '/s', hint: 'How often the overtone steps to a new harmonic.' },
  { g: 'Voice', k: 'sub', label: 'Subharmonic', min: 0, max: 1, v: 0.96, hint: 'A rough octave below.' },
  { g: 'Voice', k: 'voices', label: 'Voices (multitonal)', min: 1, max: 8, v: 6, step: 1, format: 'int', hint: 'Stacks extra tones over the fundamental.' },
  { g: 'Voice', k: 'body', label: 'Body (bold, visceral)', min: 0, max: 1, v: 0.4, hint: 'Drive and weight. Pushes the sound forward.' },
  { g: 'Voice', k: 'second', label: 'Second tone', min: 0, max: 1, v: 0.43 },
  { g: 'Voice', k: 'ratio', label: 'Second tone interval', min: 1, max: 2, v: 1.959, step: 0.001, format: 'ratio' },
  { g: 'Voice', k: 'beat', label: 'Beating', min: 0, max: 20, v: 8, unit: 'Hz', hint: 'Slight detuning that throbs against itself.' },
  { g: 'Oscillation', k: 'rate', label: 'Throb rate', min: 0.5, max: 60, v: 3.46, log: true, unit: '/s' },
  { g: 'Oscillation', k: 'depth', label: 'Throb depth', min: 0, max: 1, v: 0.72 },
  { g: 'Oscillation', k: 'shape', label: 'Throb shape', options: ['sine', 'triangle', 'square', 'sawtooth'], v: 'sawtooth' },
  { g: 'Oscillation', k: 'wobble', label: 'Pitch wobble', min: 0, max: 400, v: 150, unit: 'cents', hint: 'The pitch bends at the throb rate.' },
  { g: 'Oscillation', k: 'binaural', label: 'Inside the head (binaural)', min: 0, max: 1.5, v: 1, hint: 'Headphones only. Two steady tones, one per ear, differing by the throb rate.' },
  { g: 'Frequency shifts', k: 'spiral', label: 'Endless spiral', min: 0, max: 1.5, v: 1, hint: 'Many tones a full octave apart, gliding forever.' },
  { g: 'Frequency shifts', k: 'spiralSpeed', label: 'Spiral speed', min: -5, max: 5, v: 2, step: 0.01, unit: 'oct / 10 s', hint: 'Positive rises forever, negative falls forever.' },
  { g: 'Frequency shifts', k: 'shift', label: 'Shift per echo', min: -200, max: 200, v: 80, step: 0.5, unit: 'Hz', hint: 'Each echo moves every partial by this many Hz.' },
  { g: 'Frequency shifts', k: 'fb', label: 'Echo feedback', min: 0, max: 0.9, v: 0.88 },
  { g: 'Frequency shifts', k: 'time', label: 'Echo time', min: 0.04, max: 0.8, v: 0.25, log: true, unit: 's' },
  { g: 'Frequency shifts', k: 'wet', label: 'Shifted echoes mix', min: 0, max: 1, v: 1 },
  { g: 'Rise', k: 'peakRate', label: 'Peak throb rate', min: 5, max: 60, v: 40, log: true, unit: '/s', hint: 'Where the throb rate arrives at the crescendo.' },
  { g: 'Rise', k: 'riseTime', label: 'Length of the rise (s)', options: ['30', '60', '120', '300'], v: '60' },
  { g: 'Rise', k: 'brk', label: 'Breakthrough', options: BREAKTHROUGHS, v: 'open into stillness' },
  { g: 'Rise', k: 'riseGather', label: 'Gather to centre while rising', options: ['yes', 'no'], v: 'yes' },
  { g: 'Pressure', k: 'press', label: 'Sub-bass pressure', min: 0, max: 1.3, v: 1, hint: 'For speakers with a subwoofer. Headphones carry little of it. Raise slowly, and keep the room level sensible.' },
  { g: 'Pressure', k: 'pressF', label: 'Pressure pitch', min: 25, max: 80, v: 73, log: true, unit: 'Hz' },
  { g: 'Pressure', k: 'pressRate', label: 'Pressure pulse', min: 0.1, max: 12, v: 9.09, log: true, unit: '/s', hint: 'How fast the pressure swells and draws back.' },
  { g: 'Pressure', k: 'pressLink', label: 'Follow the throb', min: 0, max: 1, v: 1, hint: '1: the pressure pulses at the throb rate instead.' },
  { g: 'Space', k: 'swirl', label: 'Swirl', min: 0, max: 1, v: 1, hint: 'A flanging, liquid wash.' },
  { g: 'Space', k: 'swirlRate', label: 'Swirl speed', min: 0.03, max: 8, v: 3, log: true, unit: 'Hz' },
  { g: 'Space', k: 'rotate', label: 'Rotation around you', min: 0, max: 1.5, v: 0.26, unit: 'Hz' },
  { g: 'Space', k: 'verb', label: 'Space', min: 0, max: 1.3, v: 0.94 },
  { g: 'Space', k: 'center', label: 'Periphery → centre', min: 0, max: 1, v: 0.34, hint: '0: all around you. 1: gathered to one point. Or use Gather / Release.' },
  { g: 'Atmosphere', k: 'air', label: 'Air and distance', min: 0, max: 1, v: 0, hint: 'A soft, slowly moving wash of air far around you, like wind or distant surf.' },
  { g: 'Atmosphere', k: 'swell', label: 'Cinematic swell', min: 0, max: 1, v: 0, hint: 'A warm low chord on the field’s own tone that slowly opens and breathes.' },
  { g: 'Atmosphere', k: 'breath', label: 'Breathing of the atmosphere', min: 0.02, max: 0.3, v: 0.06, log: true, unit: 'Hz', hint: 'How slowly the air and the swell rise and fall (0.06 Hz is about one swell every 17 seconds).' },
  { g: 'Music', k: 'music', label: 'Field ↔ music', min: 0, max: 1, v: 0, hint: '0: the field alone. 0.5: both in full. 1: the music alone. The music stays in the key of the field and follows the journey; this balance is yours and journeys never change it.' },
  { g: 'Music', k: 'musicMove', label: 'Music movement', min: 0, max: 1, v: 0.5, hint: 'Sparse single notes ↔ flowing phrases.' },
  { g: 'Touch', k: 'touch', label: 'Touch level (preview)', min: 0, max: 1, v: 0, hint: 'Phase 1: touch is computed and measured here, not sent to any device. Starts at 0, fades in over about 3 seconds, and journeys never change it.' },
  { g: 'Space', k: 'glass', label: 'Glass shimmer', min: 0, max: 1.5, v: 0.96, hint: 'High crystalline partials.' },
] as Control[]);

export type Params = Record<string, number | string>;
export const DEFAULT_PARAMS: Readonly<Params> = Object.freeze(Object.fromEntries(CONTROLS.map(c => [c.k, c.v])));

export const LIQUID_STUDY_ID = 'liquid-harmonics-sketch-09';
export const LIQUID_STUDY_TITLE = 'Liquid Harmonics';
export const LIQUID_NOTES = Object.freeze({
  claim: 'An artistic sound study for review, shaped by the founder’s listening. It does not reproduce or induce any state and makes no health claim.',
  safety: 'Start at a low level. A rise gets faster, brighter and fuller until it breaks, and the breakthrough can be sudden silence. Sub-bass pressure is felt more than heard on speakers: raise it slowly. Stop always works.',
  score: 'A journey is a score you write. The player checks every score itself: values stay in safe ranges, changes stay gradual, anything unknown is ignored.',
  local: 'Kept settings and your journey are saved only in this browser on this device.',
});

// ── Pure helpers (tested) ─────────────────────────────────────────────────────────────────────────────
const byKey = new Map(CONTROLS.map(c => [c.k, c]));
export const control = (k: string) => byKey.get(k);
export function toSlider(c: Control, v: number): number {
  const lo = c.min!, hi = c.max!;
  return c.log ? Math.log(v / lo) / Math.log(hi / lo) : (v - lo) / (hi - lo);
}
export function fromSlider(c: Control, x: number): number {
  const lo = c.min!, hi = c.max!;
  return c.log ? lo * Math.pow(hi / lo, x) : lo + x * (hi - lo);
}
export function formatValue(c: Control, v: number | string): string {
  if (c.options) return String(v);
  const n = Number(v);
  if (c.format === 'vowel') return 'u o a e i'.split(' ')[Math.round(n)];
  if (c.format === 'int') return String(Math.round(n));
  if (c.format === 'ratio') return n.toFixed(3) + '×';
  return (Math.abs(n) >= 10 ? n.toFixed(0) : n.toFixed(2)) + (c.unit ? ' ' + c.unit : '');
}
export function vowelAt(x: number): number[] {
  const i = Math.min(3, Math.max(0, Math.floor(x))), f = Math.min(1, Math.max(0, x - i));
  return VOWELS[i].map((v, j) => v + (VOWELS[i + 1][j] - v) * f);
}
const clampN = (v: unknown, lo: number, hi: number, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

/** Every known control, clamped to its range; unknown keys dropped. `withRise` keeps the free-rise and the listener's own
 * music-balance controls; without it (a journey morph) those are dropped, so a score never moves the listener's balance. */
export function cleanParams(src: unknown, withRise = false): Params {
  const s = (src && typeof src === 'object' ? src : {}) as Record<string, unknown>, out: Params = {};
  for (const c of CONTROLS) {
    if ((!withRise && (c.g === 'Rise' || c.g === 'Music' || c.g === 'Touch')) || !(c.k in s)) continue;
    if (c.options) { if (c.options.includes(String(s[c.k]))) out[c.k] = String(s[c.k]); }
    else out[c.k] = clampN(s[c.k], c.min!, c.max!, c.v as number);
  }
  return out;
}

// ── Music layer (pure, tested): a melody in the key of the field ──
// The root is the field's fundamental snapped to the nearest semitone and placed in 220–440 Hz; the melody uses the
// major pentatonic on that root, so every note is consonant with the drone beneath it.
export const PENTATONIC = Object.freeze([0, 2, 4, 7, 9]);
const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export function musicRoot(f0: number): number {
  const m = Math.round(69 + 12 * Math.log2(Math.max(20, f0) / 440));
  let r = 440 * Math.pow(2, (m - 69) / 12);
  while (r < 220 - 1e-9) r *= 2; while (r >= 440 - 1e-9) r /= 2;
  return r;
}
export const musicKeyName = (f0: number) => NOTE_NAMES[((Math.round(69 + 12 * Math.log2(Math.max(20, f0) / 440)) % 12) + 12) % 12];
/** Scale degree → Hz. Degree 0 is the root; 5 is an octave up; −1 is the sixth below. */
export function musicNote(root: number, degree: number): number {
  const o = Math.floor(degree / 5), i = degree - o * 5;
  return root * Math.pow(2, o + PENTATONIC[i] / 12);
}
export const MUSIC_DEGREES = Object.freeze({ lo: -2, hi: 9 });
/** The next degree: steps when the music is calm, leaps when it moves, drawn back toward a centre set by brightness. */
export function nextDegree(prev: number, move: number, centre: number, rnd: () => number): number {
  const maxStep = 1 + Math.round(Math.min(1, Math.max(0, move)) * 2);
  const size = 1 + Math.floor(rnd() * maxStep);
  const up = rnd() < 0.5 + Math.max(-0.35, Math.min(0.35, (centre - prev) * 0.12));
  const step = rnd() < 0.15 ? 0 : up ? size : -size;
  return Math.max(MUSIC_DEGREES.lo, Math.min(MUSIC_DEGREES.hi, prev + step));
}
/** Notes per second: the listener's movement setting, the field's own motion, and the journey phase (quiet in a rise). */
export function musicDensity(P: Params, phase: string): number {
  const n = (k: string) => Number(P[k]);
  const motion = Math.min(1, n('vowelMove') * 0.6 + n('rotate') * 2 + n('swirl') * 0.2);
  const base = (0.25 + 1.25 * n('musicMove')) * (0.6 + 0.6 * motion);
  return base * (phase === 'rising' ? 0.35 : phase === 'after' ? 0.5 : 1);
}

// ── Atmosphere (pure, tested): a pink-noise air bed and a breathing chord ──
/** Pink-ish noise (Paul Kellet's economy filter), scaled to stay within ±1. Deterministic for a given seed. */
export function pinkNoise(n: number, seed = 1): Float32Array<ArrayBuffer> {
  const out = new Float32Array(n); let s = seed >>> 0 || 1, b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0; const w = s / 4294967296 * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
    out[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + w * 0.1848) * 0.2));
  }
  return out;
}
/** The swell's chord on the field's fundamental: root an octave down, fifth, root, and the fifth above. */
export const swellChord = (f0: number) => [f0 / 2, f0 * 0.75, f0, f0 * 1.5];

// ── Touch (pure, tested): four tactile channels derived from the field, never from the music ──
// Design brief 2026-11-22 (founder: "Yes, start Phase 1"). Phase 1 computes and measures touch only; no device output.
export const TOUCH_LIMITS = Object.freeze({ lowHz: 20, highHz: 150, maxRate: 20, ceiling: 0.5, fadeTau: 1 });
export const TOUCH_ZONES = Object.freeze(['Lower left', 'Lower right', 'Upper left', 'Upper right']);
/** The felt carrier: the field's fundamental folded by octaves into 40–120 Hz. */
export function touchCarrier(f0: number): number { let f = Math.max(1, f0); while (f > 120) f /= 2; while (f < 40) f *= 2; return f; }
/** The felt pulse follows the throb but never faster than the cap. */
export const touchRate = (rate: number) => Math.max(0.1, Math.min(TOUCH_LIMITS.maxRate, rate));
/** Soft ceiling: no output sample can exceed TOUCH_LIMITS.ceiling, however hot the input. */
export function touchCurve(n = 1024): Float32Array<ArrayBuffer> {
  const c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = TOUCH_LIMITS.ceiling * Math.tanh(2 * x); } return c;
}

export type MorphStep = { type: 'morph'; name: string; params: Params; seconds: number; hold: number };
export type CentreStep = { type: 'gather' | 'release'; seconds: number; hold: number };
export type RiseStep = {
  type: 'rise'; peak: number; length: number; brk: typeof BREAKTHROUGHS[number]; gather: 'yes' | 'no'; hold: number;
  pitch: number; emerge: number; transform: number; throbAccel: number; pitchAccel: number; harmAccel: number;
};
export type EndStep = { type: 'end'; seconds: number };
export type Step = MorphStep | CentreStep | RiseStep | EndStep;
export type Score = { format: 'liquid-harmonics-score/1'; title: string; author: string; steps: Step[] };

export const SCORE_LIMITS = Object.freeze({ steps: 40, totalSeconds: 7200 });

export function cleanStep(x: unknown): Step | null {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>, t = o.type;
  if (t === 'morph') return { type: t, name: String(o.name || 'setting').slice(0, 80), params: cleanParams(o.params), seconds: clampN(o.seconds, 5, 1800, 20), hold: clampN(o.hold, 0, 1800, 30) };
  if (t === 'gather' || t === 'release') return { type: t, seconds: clampN(o.seconds, 5, 600, 10), hold: clampN(o.hold, 0, 1800, 20) };
  if (t === 'rise') return {
    type: t, peak: clampN(o.peak, 5, 60, 40), length: clampN(o.length, 30, 600, 120),
    brk: (BREAKTHROUGHS as readonly string[]).includes(String(o.brk)) ? o.brk as RiseStep['brk'] : BREAKTHROUGHS[0],
    gather: o.gather === 'no' ? 'no' : 'yes', hold: clampN(o.hold, 0, 1800, 30),
    pitch: clampN(o.pitch, 0, 24, 12), emerge: clampN(o.emerge, 0, 1, 0.7), transform: clampN(o.transform, 0, 1, 0.5),
    throbAccel: clampN(o.throbAccel, 1, 5, 1.6), pitchAccel: clampN(o.pitchAccel, 1, 5, 3), harmAccel: clampN(o.harmAccel, 1, 5, 3),
  };
  if (t === 'end') return { type: t, seconds: clampN(o.seconds, 3, 120, 15) };
  return null;
}
export const stepSeconds = (st: Step) => st.type === 'rise' ? st.length + st.hold : st.type === 'end' ? st.seconds : st.seconds + st.hold;
export function cleanScore(x: unknown): Score {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const steps = (Array.isArray(o.steps) ? o.steps : []).slice(0, SCORE_LIMITS.steps).map(cleanStep).filter((s): s is Step => Boolean(s));
  let total = 0; const kept: Step[] = [];
  for (const st of steps) { const d = stepSeconds(st); if (total + d > SCORE_LIMITS.totalSeconds) break; total += d; kept.push(st); }
  return { format: 'liquid-harmonics-score/1', title: String(o.title || 'Untitled journey').slice(0, 120), author: String(o.author || 'founder').slice(0, 80), steps: kept };
}
export const scoreSeconds = (s: Score) => s.steps.reduce((a, st) => a + stepSeconds(st), 0);

/** A starter score to edit. Labelled as a template, never as the founder's composition. */
export function starterScore(name: string, params: Params): Score {
  const p = cleanParams(params);
  return cleanScore({ title: 'First journey (starter template)', author: 'starter template by Claude: edit freely', steps: [
    { type: 'morph', name, params: p, seconds: 20, hold: 60 },
    { type: 'gather', seconds: 10, hold: 30 },
    { type: 'rise', peak: 40, length: 120, brk: 'open into stillness', gather: 'yes', hold: 40 },
    { type: 'release', seconds: 20, hold: 20 },
    { type: 'morph', name, params: p, seconds: 30, hold: 30 },
    { type: 'end', seconds: 15 },
  ] });
}

/** Where a journey rise arrives: the takeoff targets. Pure, so the shape of the ascent is testable. */
export function riseTargets(P: Params, st: RiseStep): Record<string, number> {
  const n = (k: string) => Number(P[k]);
  const E = st.emerge, X = st.transform, sgn = n('shift') >= 0 ? 1 : -1;
  const to: Record<string, number> = {
    rate: Math.max(st.peak, n('rate')), depth: 1, body: Math.min(1, n('body') + 0.35),
    f0: Math.min(440, n('f0') * Math.pow(2, st.pitch / 12)),
    voices: Math.max(n('voices'), 6 + 2 * E), overtone: Math.max(n('overtone'), E), otMove: n('otMove') + (8 - n('otMove')) * E,
    glass: n('glass') + (1.5 - n('glass')) * E * 0.6,
    shift: n('shift') + (sgn * 200 - n('shift')) * X, spiralSpeed: n('spiralSpeed') + (5 - n('spiralSpeed')) * X, vowel: n('vowel') + (4 - n('vowel')) * X,
  };
  if (st.gather === 'yes') to.center = 1;
  return to;
}
/** Interpolate one key: rate and pitch move on a log scale, everything else linearly. */
export function lerpKey(k: string, a: number, b: number, e: number): number {
  return ((k === 'rate' || k === 'f0') && a > 0 && b > 0) ? a * Math.pow(b / a, e) : a + (b - a) * e;
}
export const accel = (p: number) => (f: number) => Math.pow(f, p);
const smooth = (f: number) => f * f * (3 - 2 * f);

// ── Engine ────────────────────────────────────────────────────────────────────────────────────────────
export type Phase = 'free' | 'journey' | 'rising' | 'after' | 'returning';
export type LiquidView = {
  phase: Phase; note: string; centreNote: string;
  journey: { i: number; n: number; type: string; elapsed: number; stepElapsed: number; total: number; held: boolean; ending: boolean } | null;
  music: { on: boolean; key: string; notes: number; last: number };
};
export type LiquidEngine = ProceduralStudyHandle & {
  params: Params;
  /** Call after changing `params` directly. */
  apply: () => void;
  gather: () => void; release: () => void; rise: () => void; returnFromRise: () => void; nudge: () => void;
  playJourney: (score: Score) => boolean;
  hold: () => void; extend: () => void; next: () => void;
  view: () => LiquidView;
  energy: () => number;
  analyser: AnalyserNode;
  /** RMS of each touch channel (T1–T4: lower L/R, upper L/R), and the share of touch energy above 150 Hz. Phase 1 preview. */
  touch: () => { rms: number[]; above150: number };
};

// The study's own output trim, before the player's shared level (as for Orbit & Threshold).
export const LIQUID_OUTPUT_TRIM = 0.5;
// The music bus at full balance, under the same presence, limiter and trim as the field.
export const MUSIC_LEVEL = 0.9;
// Make-up gain for the sparse notes (measured 22 Nov: without it the music alone sat ~25 dB under the field).
const MUSIC_GAIN = 7;
const STACK = [1.189, 1.5, 1.782, 2.245, 2.997, 3.564, 4.49];
const HA = [0.6923878, 0.9360654322959, 0.9882295226860, 0.9987488452737], HB = [0.4021921162426, 0.8561710882420, 0.9722909545651, 0.9952884791278];
const RETURN_KEYS = ['rate', 'depth', 'body', 'voices', 'center', 'wobble', 'spiralSpeed', 'shift', 'verb', 'rotate', 'f0', 'overtone', 'otMove', 'glass', 'vowel'];

type Tween = { t0: number; dur: number; from: Record<string, number>; to: Record<string, number>; ease: (f: number) => number;
  easeFor?: Record<string, (f: number) => number>; done?: () => void };
type Journey = { steps: Step[]; i: number; t0: number; s0: number; lastT: number | null; waitUntil: number | null; next: number | 'stop'; ending: boolean; held: boolean };

export function createLiquidEngine(ctx: AudioContext, destination: AudioNode, params: Params, api: ProceduralStudyAPI): LiquidEngine {
  const P = params;
  const num = (k: string) => Number(P[k]);
  const srcs: OscillatorNode[] = [], nodes: AudioNode[] = [];
  const keep = <T extends AudioNode>(n: T): T => (nodes.push(n), n);
  const osc = (f: number, type: OscillatorType = 'sine') => { const o = keep(ctx.createOscillator()); o.type = type; o.frequency.value = f; srcs.push(o); return o; };
  const gain = (v = 1) => { const g = keep(ctx.createGain()); g.gain.value = v; return g; };
  const biquad = (type: BiquadFilterType, f: number, q?: number) => { const b = keep(ctx.createBiquadFilter()); b.type = type; b.frequency.value = f; if (q !== undefined) b.Q.value = q; return b; };

  // Presence: the study's own fades (silence, return, end) under the player's level.
  const presence = gain(0);
  const out = gain(LIQUID_OUTPUT_TRIM);
  const lim = keep(ctx.createDynamicsCompressor()); lim.threshold.value = -14; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.25;
  presence.connect(lim); lim.connect(out); out.connect(destination);
  const analyser = keep(ctx.createAnalyser()); analyser.fftSize = 4096; analyser.smoothingTimeConstant = 0.8; lim.connect(analyser);

  // Single-sideband frequency shifter (Niemitalo's Hilbert pair as IIR allpass chains): plain Web Audio nodes, no worklet.
  const freqShifter = () => {
    const input = gain(), output = gain();
    const chain = (co: number[], from: AudioNode) => co.reduce<AudioNode>((n, a) => { const f = keep(ctx.createIIRFilter([a * a, 0, -1], [1, 0, -a * a])); n.connect(f); return f; }, from);
    const one = keep(ctx.createDelay(0.01)); one.delayTime.value = 1 / ctx.sampleRate; input.connect(one);
    const I = chain(HA, one), Q = chain(HB, input);
    const cos = osc(0); cos.setPeriodicWave(ctx.createPeriodicWave(new Float32Array([0, 1]), new Float32Array([0, 0]), { disableNormalization: true }));
    const sin = osc(0), mI = gain(0), mQ = gain(0), sign = gain(1);
    cos.connect(mI.gain); sin.connect(mQ.gain); I.connect(mI); Q.connect(mQ); mI.connect(output); mQ.connect(sign); sign.connect(output);
    return { input, output, set(hz: number, k: number) {
      const t = ctx.currentTime, a = Math.max(Math.abs(hz), 0.001);
      cos.frequency.setTargetAtTime(a, t, k); sin.frequency.setTargetAtTime(a, t, k); sign.gain.setValueAtTime(hz >= 0 ? 1 : -1, t);
    } };
  };

  // Voice
  const f0 = num('f0');
  const voice = gain(1);
  const saw = osc(f0, 'sawtooth'), sawG = gain(0.4); saw.connect(sawG);
  const form = VOWELS[0].map((_, j) => { const b = biquad('bandpass', 500, 6), g = gain([0.6, 0.4, 0.2][j]); sawG.connect(b); b.connect(g); g.connect(voice); return b; });
  const ot = biquad('bandpass', f0 * 8, 45), otG = gain(0); sawG.connect(ot); ot.connect(otG); otG.connect(voice); let otN = 8;
  const subO = osc(f0 / 2, 'sawtooth'), subG = gain(0), subLp = biquad('lowpass', 600); subO.connect(subLp); subLp.connect(subG); subG.connect(voice);
  const sec = osc(f0 * num('ratio'), 'sawtooth'), secG = gain(0), secF = biquad('bandpass', 1200, 1.2); sec.connect(secF); secF.connect(secG); secG.connect(voice);
  const stack = STACK.map(r => { const o = osc(f0 * r, 'sawtooth'), g = gain(0); o.connect(g); g.connect(sawG); return { o, g, r }; });
  const beatO = osc(f0, 'sawtooth'), beatG = gain(0.25); beatO.connect(beatG); beatG.connect(sawG);

  // Oscillation: throb (amplitude) and wobble (pitch), one LFO
  const lfo = osc(num('rate'), P.shape as OscillatorType), am = gain(1), amDepth = gain(0); lfo.connect(amDepth); amDepth.connect(am.gain);
  const wob = gain(0); lfo.connect(wob); [saw, subO, sec, beatO, ...stack.map(x => x.o)].forEach(o => wob.connect(o.detune));
  const drive = gain(1), ws = keep(ctx.createWaveShaper()), driveOut = gain(1);
  const wc = new Float32Array(2048); for (let i = 0; i < 2048; i++) { const x = i / 1023.5 - 1; wc[i] = Math.tanh(1.5 * x); }
  ws.curve = wc; ws.oversample = '2x';
  voice.connect(drive); drive.connect(ws); ws.connect(driveOut); driveOut.connect(am);
  // Endless spiral (Shepard–Risset): 8 tones an octave apart, gain shaped by position, wrapping while silent.
  const spG = gain(0), sp = Array.from({ length: 8 }, () => { const o = osc(100), g = gain(0); o.connect(g); g.connect(spG); return { o, g }; }); let spPos = 0; spG.connect(am);
  // Glass shimmer
  const glassG = gain(0);
  for (let i = 0; i < 14; i++) {
    const o = osc(2000 * Math.pow(4, (i + Math.random()) / 14)), g = gain(0.01), p = keep(ctx.createStereoPanner()); p.pan.value = Math.random() * 2 - 1;
    const l = osc(0.05 + Math.random() * 0.2), lg = gain(0.008); l.connect(lg); lg.connect(g.gain); o.connect(g); g.connect(p); p.connect(glassG);
  }
  glassG.connect(am);
  // Frequency-shift echo loop
  const mix = gain(1), dry = gain(1); am.connect(dry); dry.connect(mix);
  const sum = gain(1); am.connect(sum); const dl = keep(ctx.createDelay(1)); sum.connect(dl);
  const fs = freqShifter(); dl.connect(fs.input);
  const lp = biquad('lowpass', 7000), hp = biquad('highpass', 60);
  fs.output.connect(lp); lp.connect(hp); const fb = gain(0); hp.connect(fb); fb.connect(sum); const wet = gain(0); hp.connect(wet); wet.connect(mix);
  // Swirl (flanger)
  const post = gain(1); mix.connect(post);
  const fl = keep(ctx.createDelay(0.05)); fl.delayTime.value = 0.004; const flLfo = osc(num('swirlRate')), flDepth = gain(0.0035); flLfo.connect(flDepth); flDepth.connect(fl.delayTime);
  const flFb = gain(0); mix.connect(fl); fl.connect(flFb); flFb.connect(fl); const flWet = gain(0); fl.connect(flWet); flWet.connect(post);
  // Rotation around the listener, then space
  const pan = keep(ctx.createStereoPanner()), rot = osc(num('rotate')), rotD = gain(0.85); rot.connect(rotD); rotD.connect(pan.pan); post.connect(pan);
  // The field and the music each have a bus into presence, so silence, fades and the limiter govern both.
  const fieldBus = gain(1), musicBus = gain(0), musicDuck = gain(1), musicIn = gain(MUSIC_GAIN);
  fieldBus.connect(presence); musicIn.connect(musicDuck); musicDuck.connect(musicBus); musicBus.connect(presence);
  pan.connect(fieldBus);
  // Sub-bass pressure: mono, centred, straight to presence (the limiter still guards it).
  const pO = osc(num('pressF')), pAm = gain(0.5), pL = osc(num('pressRate')), pLd = gain(0.5); pL.connect(pLd); pLd.connect(pAm.gain);
  const pG = gain(0), pHp = biquad('highpass', 20); pO.connect(pAm); pAm.connect(pHp); pHp.connect(pG); pG.connect(fieldBus);
  // ── Touch bus (Phase 1: measured, not sent anywhere). Sources are the pressure and a felt throb only; the music
  // layer has no path here. Every channel: 20 Hz high-pass, 150 Hz low-pass, a soft ceiling, a second 150 Hz low-pass, then presence.
  const tPresence = gain(0), tLevel = gain(0), tMerge = keep(ctx.createChannelMerger(4)), tSplit = keep(ctx.createChannelSplitter(4));
  const tSrcLow = gain(0); pAm.connect(tSrcLow);                                   // pressure → lower zones
  const tCar = osc(touchCarrier(f0)), tLfo = osc(touchRate(num('rate'))), tAm = gain(1), tDepth = gain(0);
  tLfo.connect(tDepth); tDepth.connect(tAm.gain); tCar.connect(tAm);                // felt throb → upper zones (sine, so no steps)
  const tSrcHigh = gain(0); tAm.connect(tSrcHigh);
  // Left-right movement follows the field's rotation; gathered (centre 1) holds both sides equal.
  const tPan = gain(0); rot.connect(tPan);
  const tNeg = gain(-1); tPan.connect(tNeg);
  const zone = (src: AudioNode, side: -1 | 1, ch: number) => {
    const g = gain(0.5); src.connect(g); (side < 0 ? tNeg : tPan).connect(g.gain);
    const hp = biquad('highpass', TOUCH_LIMITS.lowHz), lp1 = biquad('lowpass', TOUCH_LIMITS.highHz, 0.7), lp2 = biquad('lowpass', TOUCH_LIMITS.highHz, 0.7);
    const ws = keep(ctx.createWaveShaper()); ws.curve = touchCurve(); ws.oversample = '2x';
    g.connect(hp); hp.connect(lp1); lp1.connect(ws); ws.connect(lp2); lp2.connect(tMerge, 0, ch); // filter, ceiling, filter again: the ceiling's own harmonics are removed too
  };
  zone(tSrcLow, -1, 0); zone(tSrcLow, 1, 1); zone(tSrcHigh, -1, 2); zone(tSrcHigh, 1, 3);
  tMerge.connect(tLevel); tLevel.connect(tPresence); tPresence.connect(tSplit);
  const tAn = [0, 1, 2, 3].map(i => { const a = keep(ctx.createAnalyser()); a.fftSize = 2048; a.smoothingTimeConstant = 0; tSplit.connect(a, i); return a; });
  // Binaural core goes straight to presence so it stays centred.
  const binL = osc(f0 * 2), binR = osc(f0 * 2 + 7), mg = keep(ctx.createChannelMerger(2)); binL.connect(mg, 0, 0); binR.connect(mg, 0, 1);
  const binG = gain(0); mg.connect(binG); binG.connect(fieldBus);
  const sr = ctx.sampleRate, len = Math.floor(sr * 3.2), ir = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5) * 0.5; }
  const cv = keep(ctx.createConvolver()); cv.buffer = ir; const verb = gain(0); pan.connect(verb); verb.connect(cv); cv.connect(fieldBus);
  // The music's own space: a soft echo and the same hall, so it sits in the room with the field.
  const mDl = keep(ctx.createDelay(1)); mDl.delayTime.value = 0.37; const mFb = gain(0.32), mLp = biquad('lowpass', 2600), mEcho = gain(0.35);
  musicIn.connect(mDl); mDl.connect(mLp); mLp.connect(mFb); mFb.connect(mDl); mLp.connect(mEcho); mEcho.connect(musicDuck);
  const mCv = keep(ctx.createConvolver()); mCv.buffer = ir; const mVerb = gain(0.45); musicIn.connect(mVerb); mVerb.connect(mCv); mCv.connect(musicDuck);
  // ── Atmosphere: part of the field (journeys can shape it), never part of touch. It sits outside the throb, so it
  // stays still and wide while the voice pulses; most of it goes to the hall for distance.
  const nb = ctx.createBuffer(2, Math.floor(sr * 8), sr); nb.copyToChannel(pinkNoise(nb.length, 7), 0); nb.copyToChannel(pinkNoise(nb.length, 11), 1);
  const airSrc = ctx.createBufferSource(); airSrc.buffer = nb; airSrc.loop = true;
  const airSplit = keep(ctx.createChannelSplitter(2)), airMerge = keep(ctx.createChannelMerger(2)), airG = gain(0), airBr = gain(0.5);
  airSrc.connect(airSplit);
  const breath = osc(num('breath')), breathD = gain(0.35); breath.connect(breathD); breathD.connect(airBr.gain);
  const airBands = [0, 1].map(ch => {
    const bp = biquad('bandpass', 700, 0.9), lp = biquad('lowpass', 4500), sweep = osc(num('breath') * (ch ? 0.83 : 1.21)), sweepD = gain(450);
    sweep.connect(sweepD); sweepD.connect(bp.frequency); airSplit.connect(bp, ch); bp.connect(lp); lp.connect(airMerge, 0, ch); return { sweep };
  });
  airMerge.connect(airBr); airBr.connect(airG); airG.connect(fieldBus); const airVerb = gain(0); airG.connect(airVerb); airVerb.connect(cv);
  const swellG = gain(0), swellLp = biquad('lowpass', 700, 0.8), swellBr = gain(0.5), swellOsc = swellChord(f0).map((f, i) => {
    const o = osc(f, i % 2 ? 'triangle' : 'sawtooth'), g = gain(i === 0 ? 0.32 : 0.2); o.detune.value = (i - 1.5) * 4; o.connect(g); g.connect(swellLp); return o;
  });
  const swellLfo = osc(num('breath') * 0.7), swellCut = gain(500), swellAmp = gain(0.4);
  swellLfo.connect(swellCut); swellCut.connect(swellLp.frequency); swellLfo.connect(swellAmp); swellAmp.connect(swellBr.gain);
  swellLp.connect(swellBr); swellBr.connect(swellG); swellG.connect(fieldBus); const swellVerb = gain(0); swellG.connect(swellVerb); swellVerb.connect(cv);

  const apply = (now = false) => {
    const t = ctx.currentTime, k = now ? 0.01 : 0.08, set = (param: AudioParam, v: number) => param.setTargetAtTime(v, t, k);
    const F = num('f0'), rate = num('rate'), center = num('center'), rotate = num('rotate');
    set(saw.frequency, F); set(subO.frequency, F / 2); set(sec.frequency, F * num('ratio')); set(beatO.frequency, F + num('beat'));
    set(otG.gain, num('overtone') * 2.2); set(subG.gain, num('sub') * 0.5); set(secG.gain, num('second') * 0.35); set(beatG.gain, num('beat') > 0.05 ? 0.25 : 0);
    set(ot.frequency, F * otN);
    lfo.type = P.shape as OscillatorType; set(lfo.frequency, rate);
    set(am.gain, 1 - num('depth') / 2); set(amDepth.gain, num('depth') / 2); set(wob.gain, num('wobble'));
    fs.set(num('shift'), k); set(dl.delayTime, num('time')); set(fb.gain, num('fb')); set(wet.gain, num('wet')); set(dry.gain, 1 - num('wet') * 0.4);
    set(flWet.gain, num('swirl') * 0.8); set(flFb.gain, num('swirl') * 0.7); set(flLfo.frequency, num('swirlRate')); set(post.gain, 1 - num('swirl') * 0.3);
    set(rot.frequency, Math.max(rotate, 0.0001));
    set(verb.gain, num('verb') * 0.8 * (1 - 0.7 * center)); set(glassG.gain, num('glass') * (1 - 0.5 * center));
    set(rotD.gain, rotate > 0.001 ? 0.85 * (1 - center) : 0);
    stack.forEach((x, i) => { set(x.g.gain, i < Math.round(num('voices')) - 1 ? 0.22 : 0); set(x.o.frequency, F * x.r); });
    set(drive.gain, 1 + num('body') * 5); set(driveOut.gain, 1 / (1 + num('body') * 1.6));
    set(binL.frequency, F * 2); set(binR.frequency, F * 2 + Math.min(45, rate)); set(binG.gain, num('binaural') * 0.12 * (0.6 + 0.4 * center));
    set(spG.gain, num('spiral'));
    const air = num('air'), sw = num('swell'), br = num('breath');
    set(airG.gain, air * 0.55); set(airVerb.gain, air * 0.9); set(breath.frequency, br);
    airBands.forEach((b, ch) => set(b.sweep.frequency, br * (ch ? 0.83 : 1.21)));
    set(swellG.gain, sw * 0.35); set(swellVerb.gain, sw * 0.7); set(swellLfo.frequency, br * 0.7);
    swellChord(F).forEach((f, i) => set(swellOsc[i].frequency, f));
    set(pO.frequency, num('pressF')); set(pL.frequency, num('pressRate') + (rate - num('pressRate')) * num('pressLink')); set(pG.gain, num('press') * 0.6);
    const T = TOUCH_LIMITS.fadeTau;
    tLevel.gain.setTargetAtTime(num('touch'), t, T);
    tSrcLow.gain.setTargetAtTime(Math.min(1, num('press')) * 0.9, t, T); tSrcHigh.gain.setTargetAtTime(0.8, t, T);
    tCar.frequency.setTargetAtTime(touchCarrier(F), t, 0.2); tLfo.frequency.setTargetAtTime(touchRate(rate), t, 0.2);
    tAm.gain.setTargetAtTime(1 - num('depth') / 2, t, 0.2); tDepth.gain.setTargetAtTime(num('depth') / 2, t, 0.2);
    tPan.gain.setTargetAtTime(rotate > 0.001 ? 0.5 * (1 - center) : 0, t, 0.2);
    const bal = num('music'); set(fieldBus.gain, Math.min(1, 2 * (1 - bal))); set(musicBus.gain, Math.min(1, 2 * bal) * MUSIC_LEVEL);
    if (now) form.forEach((b, j) => b.frequency.setValueAtTime(vowelAt(num('vowel'))[j], t));
  };

  // ── State ──
  let phase: Phase = 'free', note = '', centreNote = '', silenced = false, disposed = false;
  let tween: Tween | null = null, preRise: Params | null = null, J: Journey | null = null;
  let gatherTo: number | null = null, gatherFrom = 0, gatherT0 = 0, vowelPos: number | null = null, lastStep = 0;

  // Sound and touch share one presence: silence, fades and the end apply to both together.
  const fadePresence = (to: number, seconds: number, from?: number) => {
    const t = ctx.currentTime;
    for (const g of [presence.gain, tPresence.gain]) { g.cancelScheduledValues(t); g.setValueAtTime(from ?? g.value, t); g.linearRampToValueAtTime(to, t + seconds); }
  };
  const startTween = (to: Record<string, number>, dur: number, ease: (f: number) => number, done?: () => void) => {
    tween = { t0: ctx.currentTime, dur, from: Object.fromEntries(Object.keys(to).map(k => [k, num(k)])), to, ease, done };
    return tween;
  };
  const stepTween = (t: number) => {
    if (!tween) return;
    const f = Math.min(1, (t - tween.t0) / tween.dur), e = tween.ease(f);
    for (const k in tween.to) P[k] = lerpKey(k, tween.from[k], tween.to[k], tween.easeFor?.[k] ? tween.easeFor[k](f) : e);
    apply();
    if (phase === 'rising') note = `Rising… ${Math.round(f * 100)}%`;
    if (phase === 'returning') note = `Returning… ${Math.round(f * 100)}%`;
    if (f >= 1) { const d = tween.done; tween = null; d?.(); }
  };
  const pop = () => {
    const t = ctx.currentTime, n = Math.floor(ctx.sampleRate * 0.06), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n / 6));
    const s = ctx.createBufferSource(); s.buffer = b; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3000; const g = ctx.createGain(); g.gain.value = 0.5;
    s.connect(f); f.connect(g); g.connect(presence); s.start(t);
    const o = ctx.createOscillator(), og = ctx.createGain(); og.gain.value = 0;
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.08);
    og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.4, t + 0.003); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(og); og.connect(presence); o.start(t); o.stop(t + 0.12);
  };
  const stillness = () => { Object.assign(P, { depth: 0, wobble: 0, spiralSpeed: 0, shift: 0, center: 0, verb: 0.85, rotate: 0.03 }); apply(true); };
  const breakthrough = () => {
    phase = 'after';
    const next = J ? 'The journey continues.' : 'Press Return when you are ready, or Stop.';
    if (P.brk === 'silence') { silenced = true; fadePresence(0, 0.008); note = `Silence. ${next}`; }
    else { if (P.brk === 'pop, then stillness') pop(); stillness(); note = `Stillness. ${next}`; }
  };

  const finishJourney = () => { J = null; phase = 'free'; note = 'Journey complete.'; };
  const runStep = (i: number) => {
    if (!J) return;
    J.i = i; J.s0 = ctx.currentTime; const st = J.steps[i];
    const wait = (h: number) => () => { if (J) { J.waitUntil = ctx.currentTime + h; J.next = i + 1; } };
    if (!st) { finishJourney(); return; }
    if (silenced) { silenced = false; fadePresence(1, 8, 0); }
    phase = 'journey'; note = '';
    if (st.type === 'morph') {
      const to: Record<string, number> = {};
      for (const k in st.params) { const c = control(k); if (c?.options) P[k] = st.params[k]; else to[k] = Number(st.params[k]); }
      startTween(to, st.seconds, smooth, wait(st.hold));
    } else if (st.type === 'gather' || st.type === 'release') {
      startTween({ center: st.type === 'gather' ? 1 : 0 }, st.seconds, f => f, wait(st.hold));
    } else if (st.type === 'rise') {
      preRise = { ...P }; P.brk = st.brk; phase = 'rising';
      const tw = startTween(riseTargets(P, st), st.length, accel(st.throbAccel), () => { breakthrough(); wait(st.hold)(); });
      const pi = accel(st.pitchAccel), ha = accel(st.harmAccel);
      tw.easeFor = { f0: pi, voices: ha, overtone: ha, otMove: ha, glass: ha, shift: ha, spiralSpeed: ha, vowel: ha };
    } else {
      J.ending = true; fadePresence(0, st.seconds); J.waitUntil = ctx.currentTime + st.seconds; J.next = 'stop';
    }
  };

  // ── Music layer: soft bell-like notes scheduled a little ahead, in the key of the field ──
  let mNext = 0, mDeg = 2, mLeft = 0, mSide = 1, mNotes = 0, mLast = 0;
  const playNote = (hz: number, when: number, dur: number, vel: number, panv: number, bright: number) => {
    const g = ctx.createGain(), p = ctx.createStereoPanner(), a = ctx.createOscillator(), b = ctx.createOscillator(), bg = ctx.createGain();
    a.type = 'sine'; b.type = 'triangle'; a.frequency.value = hz; b.frequency.value = hz * 2; bg.gain.value = 0.12 + 0.35 * bright;
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(vel, when + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    p.pan.value = panv; a.connect(g); b.connect(bg); bg.connect(g); g.connect(p); p.connect(musicIn);
    a.start(when); b.start(when); a.stop(when + dur + 0.05); b.stop(when + dur + 0.05);
    b.onended = () => { try { p.disconnect(); } catch { /* gone */ } };
  };
  const musicTick = (t: number) => {
    musicDuck.gain.setTargetAtTime(phase === 'rising' ? 0.35 : 1, t, 1.5);
    if (num('music') < 0.01 || silenced) { mNext = 0; return; }
    if (mNext < t) mNext = t + 0.2;
    while (mNext < t + 0.3) {
      const d = musicDensity(P, phase), root = musicRoot(num('f0'));
      if (mLeft <= 0) { mLeft = 3 + Math.floor(Math.random() * 5); mNext += mNotes ? 0.8 + Math.random() * 2.2 / Math.max(0.3, d) : 0; mDeg = Math.max(0, Math.min(4, mDeg)); }
      const centre = 2 + Math.round(num('glass') * 2) - Math.round(num('sub') * 2);
      mDeg = nextDegree(mDeg, Math.min(1, num('vowelMove') * 0.5 + num('musicMove') * 0.7), centre, Math.random);
      const low = num('sub') > 0.5 && mLeft === 1 && Math.random() < 0.35;
      const hz = low ? root / 2 : musicNote(root, mDeg);
      const dur = Math.min(5, Math.max(1.2, 2.2 / d));
      const spread = Math.min(0.8, 0.15 + num('rotate') * 3); mSide = -mSide;
      playNote(hz, mNext, dur, low ? 0.22 : 0.16 + Math.random() * 0.06, mSide * spread * (0.5 + Math.random() * 0.5), Math.min(1, num('glass') / 1.5));
      mNotes++; mLast = hz; mLeft--;
      mNext += (1 / d) * (0.75 + Math.random() * 0.5);
    }
  };

  const TICK_MS = 100;
  const interval = setInterval(() => {
    if (disposed || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    if (J) {
      const dt = t - (J.lastT ?? t); J.lastT = t;
      if (J.held) { if (tween) tween.t0 += dt; if (J.waitUntil !== null) J.waitUntil += dt; J.t0 += dt; J.s0 += dt; }
    }
    stepTween(t);
    musicTick(t);
    if (J && !J.held && J.waitUntil !== null && t >= J.waitUntil) {
      J.waitUntil = null;
      if (J.next === 'stop') { J = null; phase = 'free'; note = 'Journey complete.'; api.ended('Liquid Harmonics: journey complete.'); return; }
      runStep(J.next);
    }
    spPos = (spPos + num('spiralSpeed') / 10 * 0.1 + 8) % 8;
    sp.forEach((x, k) => {
      const pos = (k + spPos) % 8;
      x.o.frequency.setTargetAtTime(40 * Math.pow(2, pos), t, 0.03);
      x.g.gain.setTargetAtTime(0.06 * Math.pow(Math.sin(Math.PI * pos / 8), 2), t, 0.03);
    });
    if (gatherTo !== null) {
      const f = Math.min(1, (t - gatherT0) / 10); P.center = gatherFrom + (gatherTo - gatherFrom) * f; apply();
      centreNote = (gatherTo ? 'Gathering… ' : 'Releasing… ') + Math.round(f * 100) + '%';
      if (f >= 1) { gatherTo = null; centreNote = ''; }
    }
    if (vowelPos === null) vowelPos = num('vowel');
    const v = num('vowel'), vm = num('vowelMove'), span = vm * 2;
    vowelPos += (Math.random() - 0.5) * 0.08 * vm; vowelPos += (v - vowelPos) * 0.02;
    vowelPos = Math.max(Math.max(0, v - span), Math.min(Math.min(4, v + span), vowelPos));
    vowelAt(vowelPos).forEach((f, j) => form[j].frequency.setTargetAtTime(f, t, 0.12));
    const om = num('otMove');
    if (om > 0.01 && t - lastStep > 1 / om) {
      lastStep = t; otN = Math.max(5, Math.min(16, otN + [-2, -1, 1, 2][Math.floor(Math.random() * 4)]));
      ot.frequency.setTargetAtTime(num('f0') * otN, t, 0.06);
    }
  }, TICK_MS);

  srcs.forEach(o => o.start()); airSrc.start();
  apply(true);
  fadePresence(1, 2);

  const free = () => phase === 'free' && !J;
  return {
    params: P, analyser,
    apply: () => apply(),
    gather: () => { if (!free()) return; gatherFrom = num('center'); gatherTo = 1; gatherT0 = ctx.currentTime; },
    release: () => { if (!free()) return; gatherFrom = num('center'); gatherTo = 0; gatherT0 = ctx.currentTime; },
    nudge: () => {
      if (!free()) return;
      for (const c of CONTROLS) { if (c.options || c.g === 'Rise') continue; P[c.k] = fromSlider(c, Math.min(1, Math.max(0, toSlider(c, num(c.k)) + (Math.random() - 0.5) * 0.16))); }
      apply();
    },
    // A rise always goes through: once begun, only Stop ends it.
    rise: () => {
      if (!free()) return;
      preRise = { ...P }; phase = 'rising'; gatherTo = null; centreNote = '';
      const to: Record<string, number> = { rate: Math.max(num('peakRate'), num('rate')), depth: 1, body: Math.min(1, num('body') + 0.35), voices: Math.max(6, num('voices')) };
      if (P.riseGather === 'yes') to.center = 1;
      startTween(to, Number(P.riseTime), accel(1.6), breakthrough);
    },
    returnFromRise: () => {
      if (phase !== 'after' || J || !preRise) return;
      phase = 'returning'; silenced = false; fadePresence(1, 8);
      const back = preRise;
      startTween(Object.fromEntries(RETURN_KEYS.map(k => [k, Number(back[k])])), 30, smooth, () => { phase = 'free'; note = 'Back where you began.'; });
    },
    playJourney: (score: Score) => {
      const s = cleanScore(score);
      if (J || !s.steps.length || !(phase === 'free' || phase === 'after')) return false;
      if (silenced) { silenced = false; fadePresence(1, 8); }
      gatherTo = null; centreNote = ''; tween = null;
      J = { steps: s.steps, i: 0, t0: ctx.currentTime, s0: ctx.currentTime, lastT: null, waitUntil: null, next: 0, ending: false, held: false };
      runStep(0);
      return true;
    },
    hold: () => { if (J && phase !== 'rising' && !J.ending) J.held = !J.held; },
    extend: () => { if (!J || phase === 'rising' || J.ending) return; if (J.waitUntil !== null) J.waitUntil += 30; else if (tween) tween.dur += 30; },
    next: () => {
      if (!J || phase === 'rising' || J.ending) return;
      J.held = false;
      if (tween) { const d = tween.done, tw = tween; tw.dur = Math.max(0.1, ctx.currentTime - tw.t0 + 3); tw.done = () => { d?.(); if (J) J.waitUntil = ctx.currentTime; }; }
      else if (J.waitUntil !== null) J.waitUntil = ctx.currentTime;
    },
    view: () => {
      let journey: LiquidView['journey'] = null;
      if (J) {
        const total = J.steps.reduce((a, st) => a + stepSeconds(st), 0);
        journey = { i: J.i, n: J.steps.length, type: J.steps[J.i]?.type ?? '', elapsed: Math.min(total, Math.max(0, ctx.currentTime - J.t0)), stepElapsed: Math.max(0, ctx.currentTime - J.s0), total, held: J.held, ending: J.ending };
      }
      return { phase, note, centreNote, journey, music: { on: num('music') >= 0.01, key: musicKeyName(num('f0')), notes: mNotes, last: mLast } };
    },
    touch: () => {
      const buf = new Float32Array(2048), fb = new Float32Array(tAn[0].frequencyBinCount);
      let hi = 0, all = 0;
      const rms = tAn.map(a => {
        a.getFloatTimeDomainData(buf); let s2 = 0; for (const x of buf) s2 += x * x;
        a.getFloatFrequencyData(fb); const bin = a.context.sampleRate / a.fftSize;
        fb.forEach((db, i) => { const p = Math.pow(10, db / 10); all += p; if (i * bin > 150) hi += p; });
        return Math.sqrt(s2 / buf.length);
      });
      return { rms, above150: all > 0 ? hi / all : 0 };
    },
    energy: () => { const b = new Uint8Array(analyser.frequencyBinCount); analyser.getByteFrequencyData(b); return b.reduce((a, x) => a + x, 0); },
    dispose: () => {
      if (disposed) return;
      disposed = true; clearInterval(interval); J = null; tween = null;
      for (const o of [...srcs, airSrc]) { try { o.stop(); } catch { /* already stopped */ } }
      try { airSrc.disconnect(); } catch { /* gone */ }
      for (const n of nodes) { try { n.disconnect(); } catch { /* gone */ } }
    },
  };
}

/** The study the persistent player plays. `onEngine` lets the desk read and steer the running engine. */
export function liquidHarmonicsStudy(params: Params, onEngine: (engine: LiquidEngine | null) => void): ProceduralStudy {
  return {
    id: LIQUID_STUDY_ID,
    title: LIQUID_STUDY_TITLE,
    subtitle: 'Sketch 09 · founder review',
    message: 'Original sound generated in your browser · review sketch · no state or effect is claimed.',
    build: (context, destination, api) => {
      const engine = createLiquidEngine(context, destination, params, api);
      onEngine(engine);
      return { dispose: () => { engine.dispose(); onEngine(null); } };
    },
  };
}
