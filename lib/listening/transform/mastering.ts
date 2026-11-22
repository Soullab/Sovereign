/**
 * Soullab Voice Mastering — review-only offline DSP core, v0.1.
 * Owner: LISTEN-01 SoullabTech/Sovereign#1979. For source-owner admission only.
 * No changes to Capture C1. No network, filesystem, recording, or player access.
 *
 * This processor is NOT an ACX/audiobook compliance certifier, broadband denoiser,
 * loudness/true-peak meter, or live conversation effects chain.
 * Source audio remains unchanged; a new Float32Array is returned per channel.
 */

/** Structurally compatible with lib/listening/transform/audio.ts Audio. */
export type MasteringAudio = {
  sampleRate: number;
  channels: Float32Array<ArrayBuffer>[];
};
export type VoiceProfile = 'natural' | 'audiobook' | 'broadcast' | 'sacred' | 'restoration';
export type MasteringOptions = {
  profile: VoiceProfile;
  /** 0 is sample-exact bypass; 1 is the chosen mastering chain. */
  intensity: number;
  /** Trim of the processed branch, before the peak ceiling. */
  outputTrimDb?: number;
};
export type MasteringMeters = {
  inputSamplePeakDbfs: number;
  outputSamplePeakDbfs: number;
  inputRmsDbfs: number;
  outputRmsDbfs: number;
  peakCeilingDbfs: number;
  staticCeilingAttenuationDb: number;
  /** These are sample-peak and RMS figures, not true-peak or integrated LUFS. */
  method: 'sample-peak-and-rms';
};

export const MASTERING_VERSION = 'soullab.voice-mastering.review/0.1';

export const VOICE_PROFILES: Record<VoiceProfile, {
  label: string;
  explanation: string;
  highpassHz: number;
  warmthDb: number;
  presenceDb: number;
  airDb: number;
  thresholdDbfs: number;
  ratio: number;
  attackMs: number;
  releaseMs: number;
  deEssAmount: number;
  makeupDb: number;
  ceilingDbfs: number;
}> = {
  natural: {
    label: 'Natural Voice', explanation: 'Gentle intelligibility without sacrificing breath or character.',
    highpassHz: 55, warmthDb: 0.4, presenceDb: 0.7, airDb: 0.2,
    thresholdDbfs: -22, ratio: 1.55, attackMs: 24, releaseMs: 165,
    deEssAmount: 0.15, makeupDb: 0.8, ceilingDbfs: -1.2,
  },
  audiobook: {
    label: 'Audiobook Preparation', explanation: 'Controlled narration, not a publishing-compliance certificate.',
    highpassHz: 70, warmthDb: -0.4, presenceDb: 1.3, airDb: 0.3,
    thresholdDbfs: -24, ratio: 2.0, attackMs: 16, releaseMs: 185,
    deEssAmount: 0.4, makeupDb: 1.1, ceilingDbfs: -3.5,
  },
  broadcast: {
    label: 'Broadcast & Teaching', explanation: 'More assertive dynamics and clarity for teaching and spoken media.',
    highpassHz: 75, warmthDb: 0.5, presenceDb: 1.7, airDb: 0.8,
    thresholdDbfs: -25, ratio: 2.7, attackMs: 10, releaseMs: 140,
    deEssAmount: 0.6, makeupDb: 2.0, ceilingDbfs: -1.0,
  },
  sacred: {
    label: 'Sacred Voice', explanation: 'Preserves chant, vowels, natural overtones, and expressive dynamics.',
    highpassHz: 30, warmthDb: 0, presenceDb: 0, airDb: 0,
    thresholdDbfs: -50, ratio: 1, attackMs: 30, releaseMs: 200,
    deEssAmount: 0, makeupDb: 0, ceilingDbfs: -1.5,
  },
  restoration: {
    label: 'Restoration Preparation', explanation: 'Conservative rumble and harshness reduction; not broadband noise removal.',
    highpassHz: 90, warmthDb: -1.0, presenceDb: 0.6, airDb: -0.8,
    thresholdDbfs: -22, ratio: 1.4, attackMs: 28, releaseMs: 190,
    deEssAmount: 0.35, makeupDb: 0, ceilingDbfs: -2.0,
  },
};

const dbToLinear = (db: number): number => Math.pow(10, db / 20);
const linearToDb = (v: number): number => v <= 0 ? -Infinity : 20 * Math.log10(v);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

type Coefficients = [number, number, number, number, number];
class Biquad {
  private z1 = 0;
  private z2 = 0;
  private readonly coeffs: Coefficients;
  constructor(coeffs: Coefficients) { this.coeffs = coeffs; }
  next(x: number): number {
    // Transposed direct form II; coefficients have normalized denominator.
    const [b0, b1, b2, a1, a2] = this.coeffs;
    const y = b0 * x + this.z1;
    this.z1 = b1 * x - a1 * y + this.z2;
    this.z2 = b2 * x - a2 * y;
    return y;
  }
}
function biquad(b0: number, b1: number, b2: number, a0: number, a1: number, a2: number): Coefficients {
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
function highpass(rate: number, hz: number): Biquad {
  const w = 2 * Math.PI * Math.min(hz, rate * .45) / rate;
  const c = Math.cos(w), alpha = Math.sin(w) / (2 * Math.SQRT1_2);
  return new Biquad(biquad((1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + alpha, -2 * c, 1 - alpha));
}
function bell(rate: number, hz: number, gainDb: number, q = 0.85): Biquad {
  const w = 2 * Math.PI * Math.min(hz, rate * .45) / rate;
  const c = Math.cos(w), alpha = Math.sin(w) / (2 * q), A = Math.pow(10, gainDb / 40);
  return new Biquad(biquad(1 + alpha * A, -2 * c, 1 - alpha * A, 1 + alpha / A, -2 * c, 1 - alpha / A));
}
function coefficient(ms: number, rate: number): number { return Math.exp(-1 / (rate * ms * 0.001)); }
function measurements(a: MasteringAudio) {
  let top = 0, squares = 0, count = 0;
  for (const channel of a.channels) for (let i = 0; i < channel.length; i++) {
    const v = channel[i]; top = Math.max(top, Math.abs(v)); squares += v * v; count++;
  }
  return { peak: linearToDb(top), rms: linearToDb(Math.sqrt(squares / count)) };
}
/** An honest, inexpensive playback meter. Not LUFS, not oversampled true peak. */
export function measureVoiceLevels(a: MasteringAudio): { samplePeakDbfs: number; rmsDbfs: number } {
  const m = measurements(a);
  return { samplePeakDbfs: m.peak, rmsDbfs: m.rms };
}

function validate(a: MasteringAudio, options: MasteringOptions): void {
  if (!a || !Number.isInteger(a.sampleRate) || a.sampleRate < 8000 || a.sampleRate > 192000 ||
      !Array.isArray(a.channels) || a.channels.length < 1 || a.channels.length > 2 ||
      !a.channels[0] || a.channels[0].length < 1 || a.channels[0].length > a.sampleRate * 1200 ||
      a.channels.some(ch => !(ch instanceof Float32Array) || ch.length !== a.channels[0].length)) {
    throw new Error('Voice mastering requires one mono or stereo recording, at most 20 minutes.');
  }
  for (const ch of a.channels) for (const s of ch) {
    if (!Number.isFinite(s)) throw new Error('This recording contains invalid audio samples.');
  }
  if (!options || !Object.hasOwn(VOICE_PROFILES, options.profile) ||
      !Number.isFinite(options.intensity) || options.intensity < 0 || options.intensity > 1 ||
      !Number.isFinite(options.outputTrimDb ?? 0) || Math.abs(options.outputTrimDb ?? 0) > 12) {
    throw new Error('Choose a valid voice profile, intensity (0–1) and trim (±12 dB).');
  }
}

export function masterVoice(source: MasteringAudio, options: MasteringOptions): {
  audio: MasteringAudio;
  meters: MasteringMeters;
  applied: { version: string; profile: VoiceProfile; intensity: number; outputTrimDb: number };
} {
  validate(source, options);
  const p = VOICE_PROFILES[options.profile];
  const rate = source.sampleRate, n = source.channels[0].length, chs = source.channels.length;
  const out: MasteringAudio = { sampleRate: rate, channels: source.channels.map(ch => ch.slice()) };
  const before = measurements(source);
  // A zero-intensity choice must not silently reshape or limit the original.
  let appliedCeilingAttenuationDb = 0;
  if (options.intensity > 0) {
    const eq = Array.from({ length: chs }, () => [
      highpass(rate, p.highpassHz),
      bell(rate, 210, p.warmthDb),
      bell(rate, 2900, p.presenceDb),
      bell(rate, 7200, p.airDb),
    ]);
    const essBand = Array.from({ length: chs }, () => highpass(rate, 4600));
    const wet = Array.from({ length: chs }, () => new Float32Array(n));
    const attack = coefficient(p.attackMs, rate), release = coefficient(p.releaseMs, rate);
    const essAttack = coefficient(4, rate), essRelease = coefficient(80, rate);
    let env = 0, essEnv = 0;
    const trim = dbToLinear(p.makeupDb + (options.outputTrimDb ?? 0));
    // Reuse small working buffers across frames: avoid per-sample allocations on long takes.
    const frame = new Float64Array(chs), bands = new Float64Array(chs);
    for (let i = 0; i < n; i++) {
      let detector = 0, sibilantDetector = 0;
      for (let c = 0; c < chs; c++) {
        let x = source.channels[c][i];
        for (const filter of eq[c]) x = filter.next(x);
        frame[c] = x;
        bands[c] = essBand[c].next(x);
        detector = Math.max(detector, Math.abs(x));
        sibilantDetector = Math.max(sibilantDetector, Math.abs(bands[c]));
      }
      const a = detector > env ? attack : release;
      env = a * env + (1 - a) * detector;
      const above = Math.max(0, linearToDb(env) - p.thresholdDbfs);
      const reductionDb = p.ratio <= 1 ? 0 : above * (1 - 1 / p.ratio);
      const gain = dbToLinear(-reductionDb);
      const ea = sibilantDetector > essEnv ? essAttack : essRelease;
      essEnv = ea * essEnv + (1 - ea) * sibilantDetector;
      const essOverDb = Math.max(0, linearToDb(essEnv) - (-28));
      const essReduced = clamp(essOverDb * 0.012 * p.deEssAmount, 0, .38);
      for (let c = 0; c < chs; c++) {
        // Sibilance-dependent, frequency-selective reduction; not broadband denoising.
        const shaped = (frame[c] - bands[c] * essReduced) * gain * trim;
        wet[c][i] = source.channels[c][i] * (1 - options.intensity) + shaped * options.intensity;
      }
    }
    out.channels = wet;
    // A conservative *static* sample-peak ceiling. No lookahead limiter and no
    // unsupported true-peak claim. Whole-file attenuation never adds clipping.
    const after = measurements(out);
    const drop = Math.min(0, p.ceilingDbfs - after.peak);
    appliedCeilingAttenuationDb = drop;
    if (drop < 0) {
      const g = dbToLinear(drop);
      for (const ch of out.channels) for (let i = 0; i < ch.length; i++) ch[i] *= g;
    }
  }
  const after = measurements(out);
  const applied = { version: MASTERING_VERSION, profile: options.profile, intensity: options.intensity, outputTrimDb: options.outputTrimDb ?? 0 };
  return { audio: out, applied, meters: {
    inputSamplePeakDbfs: before.peak, outputSamplePeakDbfs: after.peak,
    inputRmsDbfs: before.rms, outputRmsDbfs: after.rms,
    peakCeilingDbfs: p.ceilingDbfs,
    staticCeilingAttenuationDb: appliedCeilingAttenuationDb,
    method: 'sample-peak-and-rms',
  } };
}
