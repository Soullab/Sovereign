/**
 * SOULLAB TRANSFORM T2 step B — Resonance & Detail. Owner LISTEN-01 #1979.
 * Founder REFINE (2026-11-21): "we need to be able to dial into the sound field or note so that the reverb or
 * anomalies can be dialed in." Founder go-ahead: "Yes, start step B".
 *
 * Measuring, isolating and comparing the drone the member made. Nothing here changes a sound by itself: the
 * meter only reports; every change is one the member chooses. An anomaly is not a defect by default.
 */
import * as engine from './engine.js';
import * as engine3 from './engine3.js';

export type Band = { on: boolean; hz: number; q: number; db: number };
export type Detail = { toneHz: number | null; size: number; decay: number; wet: number; dry: number; band: Band };

export const NEUTRAL_DETAIL: Detail = { toneHz: null, size: 1, decay: 0.48, wet: 1, dry: 1, band: { on: false, hz: 1000, q: 2, db: 0 } };
export const completeDetail = (d: unknown): Detail => engine3.completeDetail(d) as Detail;

/** True when the controls are where v0.3.4 has them: the accepted engine is then used, unchanged. */
export function isNeutralDetail(d: unknown): boolean {
  const c = completeDetail(d);
  return c.toneHz === null && c.size === 1 && c.decay === 0.48 && c.wet === 1 && c.dry === 1 && (!c.band.on || c.band.db === 0);
}

// ---------- Detail meter ----------
export type Reading = { kind: 'click' | 'flutter'; at: number; amount: number };
export type DetailReport = {
  ripplePct: number; clicks: Reading[]; flutter: Reading[];
  seam: { step: number; typical: number; smooth: boolean } | null;
  beat: { hz: number; depthPct: number } | null;
};

function biquad(x: Float32Array | Float64Array, [b0, b1, b2, a1, a2]: number[]): Float64Array {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0; const y = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}
function hp(f: number, sr: number) { const w = 2 * Math.PI * f / sr, c = Math.cos(w), al = Math.sin(w) / (2 * Math.SQRT1_2), a0 = 1 + al; return [(1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, -2 * c / a0, (1 - al) / a0]; }
function bp(f: number, q: number, sr: number) { const w = 2 * Math.PI * Math.min(f, sr * 0.45) / sr, al = Math.sin(w) / (2 * q), c = Math.cos(w), a0 = 1 + al; return [al / a0, 0, -al / a0, -2 * c / a0, (1 - al) / a0]; }
const mono = (L: Float32Array, R: Float32Array) => { const m = new Float32Array(L.length); for (let i = 0; i < L.length; i++) m[i] = (L[i] + R[i]) / 2; return m; };

/** The same measures that qualified the accepted series: level ripple, click bursts above 6 kHz, loop seam, beating. */
export function analyseDetail(L: Float32Array, R: Float32Array, sr: number, loop: boolean): DetailReport {
  const m = mono(L, R);
  // Clicks: 1 ms windows of the 6 kHz high band, more than 6× its own RMS. Nearby windows merge.
  const h = biquad(biquad(m, hp(6000, sr)), hp(6000, sr));
  let tot = 0; for (const v of h) tot += v * v; const hrms = Math.sqrt(tot / h.length) + 1e-12;
  const W = Math.max(1, Math.round(sr / 1000)); const clicks: Reading[] = [];
  for (let i = 0; i + W <= h.length; i += W) {
    let s = 0; for (let j = i; j < i + W; j++) s += h[j] * h[j];
    const r = Math.sqrt(s / W) / hrms;
    if (r > 6) { const at = i / sr; const last = clicks.at(-1); if (last && at - last.at < 0.05) last.amount = Math.max(last.amount, r); else clicks.push({ kind: 'click', at, amount: r }); }
  }
  // Ripple and flutter: 20 ms level windows; flutter = windows far from the running level.
  const F = Math.round(sr / 50), lv: number[] = [];
  for (let i = 0; i + F <= m.length; i += F) { let s = 0; for (let j = i; j < i + F; j++) s += m[j] * m[j]; lv.push(Math.sqrt(s / F)); }
  const mean = lv.reduce((a, b) => a + b, 0) / Math.max(1, lv.length);
  const sd = Math.sqrt(lv.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, lv.length));
  const ripplePct = mean > 0 ? (100 * sd) / mean : 0;
  const flutter: Reading[] = [];
  lv.forEach((v, k) => { const z = sd > 0 ? Math.abs(v - mean) / sd : 0; if (z > 2.5) { const at = (k * F) / sr; const last = flutter.at(-1); if (last && at - last.at < 0.25) last.amount = Math.max(last.amount, z); else flutter.push({ kind: 'flutter', at, amount: z }); } });
  // Beating: the strongest slow periodic swell of the level, 0.3–8 Hz.
  let beat: DetailReport['beat'] = null;
  if (lv.length > 100 && mean > 0) {
    let best = 0, bestHz = 0;
    for (let hz = 0.3; hz <= 8; hz += 0.05) {
      let re = 0, im = 0; for (let k = 0; k < lv.length; k++) { const ph = 2 * Math.PI * hz * k / 50; re += (lv[k] - mean) * Math.cos(ph); im += (lv[k] - mean) * Math.sin(ph); }
      const a = (2 * Math.hypot(re, im)) / lv.length; if (a > best) { best = a; bestHz = hz; }
    }
    const depthPct = (100 * best) / mean;
    if (depthPct >= 3) beat = { hz: Math.round(bestHz * 100) / 100, depthPct: Math.round(depthPct * 10) / 10 };
  }
  // Seam: the jump from the last sample to the first, against ordinary sample-to-sample movement.
  let seam: DetailReport['seam'] = null;
  if (loop && m.length > 8) {
    const ds: number[] = []; for (let i = 1; i < m.length; i += 7) ds.push(Math.abs(m[i] - m[i - 1])); ds.sort((a, b) => a - b);
    const typical = ds[Math.floor(ds.length * 0.99)]; const step = Math.abs(m[0] - m[m.length - 1]);
    seam = { step, typical, smooth: step <= 2 * typical };
  }
  return { ripplePct: Math.round(ripplePct * 10) / 10, clicks: clicks.sort((a, b) => b.amount - a.amount).slice(0, 12).sort((a, b) => a.at - b.at), flutter: flutter.sort((a, b) => b.amount - a.amount).slice(0, 12).sort((a, b) => a.at - b.at), seam, beat };
}

/** The member's three answers to a reading. Keep changes nothing. */
export type Answer = 'reduce' | 'keep' | 'emphasise';
export type Patchable = { stillness: number; movement: number; clean: { repairClips: boolean; lowCutHz: number; soften: number; smooth: number } };
export function answerReading(kind: Reading['kind'] | 'beat', answer: Answer, s: Patchable): Partial<Patchable> {
  const c = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  if (answer === 'keep') return {};
  const up = answer === 'emphasise' ? -1 : 1;
  if (kind === 'click') return { clean: { ...s.clean, soften: c(s.clean.soften + 15 * up, 0, 100), repairClips: answer === 'reduce' ? true : s.clean.repairClips } };
  if (kind === 'flutter') return { stillness: c(s.stillness + 5 * up, 0, 100), movement: c(s.movement - 10 * up, 0, 100) };
  return { movement: c(s.movement - 10 * up, 0, 100) };
}
export const ANSWER_SAYS: Record<Reading['kind'] | 'beat', Record<Exclude<Answer, 'keep'>, string>> = {
  click: { reduce: 'Soften +15 and repair clipped peaks', emphasise: 'Soften −15' },
  flutter: { reduce: 'Stillness +5, Movement −10', emphasise: 'Stillness −5, Movement +10' },
  beat: { reduce: 'Movement −10', emphasise: 'Movement +10' },
};

// ---------- Listening to parts of the sound ----------
/** A short excerpt around a moment, repeated with soft joins, for listening closely in the one player. */
export function excerptLoop(L: Float32Array, R: Float32Array, sr: number, at: number, seconds = 2, repeats = 3) {
  const n = Math.min(L.length, Math.round(seconds * sr)); const a = Math.max(0, Math.min(L.length - n, Math.round((at - seconds / 2) * sr)));
  const f = Math.min(Math.round(0.02 * sr), Math.floor(n / 4)); const oL = new Float32Array(n * repeats), oR = new Float32Array(n * repeats);
  for (let r = 0; r < repeats; r++) for (let i = 0; i < n; i++) { const g = i < f ? i / f : i >= n - f ? (n - 1 - i) / f : 1; oL[r * n + i] = L[a + i] * g; oR[r * n + i] = R[a + i] * g; }
  return { left: oL, right: oR, startSec: a / sr };
}

/** Only one band of the drone, for hearing what a frequency region carries. Preview only, never saved. */
export function bandOnly(L: Float32Array, R: Float32Array, sr: number, hz: number, q: number) {
  const k = bp(hz, Math.max(0.3, q), sr); const l = biquad(L, k), r = biquad(R, k);
  let pk = 0; for (let i = 0; i < l.length; i++) pk = Math.max(pk, Math.abs(l[i]), Math.abs(r[i]));
  const g = pk > 0 ? Math.min(8, 0.6 / pk) : 1;
  return { left: Float32Array.from(l, (v) => v * g), right: Float32Array.from(r, (v) => v * g) };
}

/** Scale to a loudness (BS.1770, the engine's own meter), never past −1 dBFS: for a fair A/B. */
export function matchLoudness(L: Float32Array, R: Float32Array, sr: number, targetLufs: number) {
  const now = engine.measureLufs(L, R, sr);
  let g = now == null ? 1 : Math.pow(10, (targetLufs - now) / 20);
  let pk = 0; for (let i = 0; i < L.length; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
  if (pk * g > 0.891) g = 0.891 / pk;
  return { left: Float32Array.from(L, (v) => v * g), right: Float32Array.from(R, (v) => v * g), gainDb: 20 * Math.log10(g) };
}

export const toWavBlob = (L: Float32Array, R: Float32Array, sr: number): Blob => engine.wav24(L, R, sr);

// ---------- Spectrum ----------
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) {
      const ar = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, ai = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
      re[i + k + len / 2] = re[i + k] - ar; im[i + k + len / 2] = im[i + k] - ai; re[i + k] += ar; im[i + k] += ai;
      const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } }
  }
}
export const SPECTRUM_RANGE = { lo: 40, hi: 12000 } as const;
/** Average spectrum (dB) of up to 8 s of the drone, on a log-frequency axis of `bins` points. */
export function spectrum(L: Float32Array, R: Float32Array, sr: number, bins = 240): { hz: number[]; db: number[] } {
  const N = 16384, m = mono(L, R), win = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  const acc = new Float64Array(N / 2); let frames = 0;
  for (let s = 0; s + N <= Math.min(m.length, sr * 8); s += N / 2) {
    const re = new Float64Array(N), im = new Float64Array(N); for (let i = 0; i < N; i++) re[i] = m[s + i] * win[i];
    fft(re, im); for (let k = 0; k < N / 2; k++) acc[k] += re[k] * re[k] + im[k] * im[k]; frames++;
  }
  const hz: number[] = [], db: number[] = [], { lo, hi } = SPECTRUM_RANGE;
  for (let b = 0; b < bins; b++) {
    const f0 = lo * Math.pow(hi / lo, b / bins), f1 = lo * Math.pow(hi / lo, (b + 1) / bins);
    const k0 = Math.max(1, Math.floor((f0 * N) / sr)), k1 = Math.max(k0 + 1, Math.ceil((f1 * N) / sr));
    let p = 0; for (let k = k0; k < Math.min(k1, N / 2); k++) p = Math.max(p, acc[k]);
    hz.push(Math.sqrt(f0 * f1)); db.push(10 * Math.log10(p / Math.max(1, frames) + 1e-20));
  }
  return { hz, db };
}
export const harmonics = (f0: number, max = SPECTRUM_RANGE.hi) => { const out: number[] = []; for (let k = 1; k * f0 <= max && k <= 24; k++) out.push(k * f0); return out; };
