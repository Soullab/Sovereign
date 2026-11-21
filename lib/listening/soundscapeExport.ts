/**
 * Save a soundscape as an audio file (#1979; founder 2026-11-21: "how do I transform this to a recorded loop that
 * plays for 2 hours on the external sound players on the micro memory card?", then "Yes, options 1+2").
 *
 * The SAME engine renders the sound offline, faster than real time, in pieces of one continuous timeline
 * (SoundscapeTimeline): each piece starts in phase and settled, so the joins are the sound itself, not a seam. A
 * 2-hour file never needs 2 hours of audio in memory at once.
 *
 * Device versions (options 1 and 2): a binaural pulse needs headphones. "For a speaker" swaps it for an isochronic
 * pulse at the same rate, which carries on any speaker. A sound without a binaural pulse needs only one file.
 * Every name says what the file IS (frequency, pulse, length), never what it does.
 *
 * Rights: the file holds whatever recordings were loaded. They are CANDIDATE media under the media-rights hold, so
 * the file is for the member's own listening; the credits travel with it, and nothing here shares or uploads it.
 */
import { buildSoundscape, type RecordedLoader } from './soundscapeEngine';
import type { SoundscapeSpec } from './focusSoundscape';
import type { ToneSpec } from './toneLab';

export const EXPORT_SAMPLE_RATE = 44100;
export const EXPORT_CHANNELS = 2;
export const EXPORT_MINUTES = [30, 60, 90, 120] as const;
export type ExportMinutes = (typeof EXPORT_MINUTES)[number];
export const EXPORT_MAX_SEC = 120 * 60;
/** Each piece renders this much new sound; small enough for a phone's memory (about 105 MB of samples). */
export const EXPORT_PIECE_SEC = 300;
/** Each later piece starts this early and the start is discarded, so filters and the soft distance have settled. */
export const EXPORT_PREROLL_SEC = 6;
/** Pieces overlap by this much and are crossfaded (they are the same sound there, so this is only a safeguard). */
export const EXPORT_JOIN_SEC = 0.5;
/** The file fades in and out this gently, so it never starts with a jolt and repeats softly on a player. */
export const EXPORT_FILE_FADE_SEC = 5;

export type ExportDevice = 'headphones' | 'speaker' | 'any';
export type ExportVariant = { device: ExportDevice; spec: SoundscapeSpec; label: string };

const pulseOf = (spec: SoundscapeSpec): ToneSpec | null => spec.tone ?? spec.toneLayer ?? null;
export function hasBinaural(spec: SoundscapeSpec): boolean { return pulseOf(spec)?.pulseMode === 'binaural'; }

/** The speaker version: a binaural pulse becomes an isochronic pulse at the same rate. Nothing else changes. */
export function speakerSpec(spec: SoundscapeSpec): SoundscapeSpec {
  const swap = (tone: ToneSpec | null | undefined) => (tone && tone.pulseMode === 'binaural' ? { ...tone, pulseMode: 'isochronic' as const } : tone);
  const next = { ...spec };
  if (spec.tone) next.tone = swap(spec.tone)!;
  if (spec.toneLayer) next.toneLayer = swap(spec.toneLayer)!;
  return next;
}

/** Which files a member can save: one for any device, or (with a binaural pulse) one for headphones and one for a speaker. */
export function exportVariants(spec: SoundscapeSpec): ExportVariant[] {
  if (!hasBinaural(spec)) return [{ device: 'any', spec, label: 'Any device' }];
  return [
    { device: 'headphones', spec, label: 'For headphones (binaural pulse)' },
    { device: 'speaker', spec: speakerSpec(spec), label: 'For a speaker (isochronic pulse at the same rate)' },
  ];
}

export type ExportPiece = { origin: number; renderSec: number; keepFrom: number; keepSec: number };
/** How a file of `durationSec` is rendered: pieces of one timeline. A later piece starts EXPORT_PREROLL_SEC +
 * EXPORT_JOIN_SEC early; its preroll is discarded and its first EXPORT_JOIN_SEC is crossfaded with the end of the last. */
export function exportPlan(durationSec: number, pieceSec = EXPORT_PIECE_SEC, prerollSec = EXPORT_PREROLL_SEC, joinSec = EXPORT_JOIN_SEC): ExportPiece[] {
  const total = Math.max(1, Math.min(EXPORT_MAX_SEC, Math.round(durationSec)));
  const pieces: ExportPiece[] = [];
  for (let start = 0; start < total; start += pieceSec) {
    const keepSec = Math.min(pieceSec, total - start);
    if (start === 0) pieces.push({ origin: 0, renderSec: keepSec, keepFrom: 0, keepSec });
    else pieces.push({ origin: start - prerollSec - joinSec, renderSec: prerollSec + joinSec + keepSec, keepFrom: prerollSec, keepSec: joinSec + keepSec });
  }
  return pieces;
}

/** A 44-byte WAV header for 16-bit PCM. A 2-hour stereo file is about 1.27 GB, well inside the format's 4 GB. */
export function wavHeader(frames: number, sampleRate = EXPORT_SAMPLE_RATE, channels = EXPORT_CHANNELS): ArrayBuffer {
  const bytes = frames * channels * 2;
  const view = new DataView(new ArrayBuffer(44));
  const text = (at: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i)); };
  text(0, 'RIFF'); view.setUint32(4, 36 + bytes, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, bytes, true);
  return view.buffer;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
/** A factual file name: the design, the length, the pulse, the device. Never an effect. */
export function exportFileName(name: string, minutes: number, variant: Pick<ExportVariant, 'device' | 'spec'>): string {
  const safe = (name.trim() || 'Soundscape').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  const tone = pulseOf(variant.spec);
  const pulse = tone && tone.pulseMode !== 'none' ? ` · ${fmt(tone.hz)} Hz ${fmt(tone.pulseHz)} Hz ${tone.pulseMode}` : tone ? ` · ${fmt(tone.hz)} Hz` : '';
  const device = variant.device === 'any' ? '' : variant.device === 'headphones' ? ' (headphones)' : ' (speaker)';
  return `${safe} · ${minutes} min${pulse}${device}.wav`;
}

export type ExportSettings = {
  spec: SoundscapeSpec; level: number; overtoneBusGain: number; recordedAmount: number; weaveAmount: number; toneLayerAmount: number;
};
export type ExportProgress = { done: number; total: number };
export type ExportResult = { blob: Blob; seconds: number; peak: number; clippedSamples: number; recordedLayers: string[] };

/**
 * Render `seconds` of the soundscape to a 16-bit stereo WAV, piece by piece (see exportPlan). `loadRecorded` gives a
 * loader for a context; each recording is fetched and decoded once for the whole file. Cancel with `signal`.
 */
export async function renderSoundscapeWav(
  settings: ExportSettings, seconds: number,
  options: { loadRecorded?: (ctx: BaseAudioContext) => RecordedLoader; onProgress?: (p: ExportProgress) => void; signal?: AbortSignal; pieceSec?: number } = {},
): Promise<ExportResult> {
  const total = Math.max(1, Math.min(EXPORT_MAX_SEC, Math.round(seconds)));
  const plan = exportPlan(total, options.pieceSec);
  const rate = EXPORT_SAMPLE_RATE;
  const frames = total * rate;
  const fadeFrames = Math.min(Math.floor(frames / 4), EXPORT_FILE_FADE_SEC * rate);
  const joinFrames = Math.round(EXPORT_JOIN_SEC * rate);
  const parts: BlobPart[] = [wavHeader(frames)];
  const cache = new Map<string, Promise<AudioBuffer | null>>();
  let written = 0; let peak = 0; let clipped = 0;
  let held: [Float32Array, Float32Array] | null = null;
  const recorded = new Set<string>();
  // Fade the file's ends, measure, and convert to 16-bit.
  const emit = (left: Float32Array, right: Float32Array) => {
    const out = new Int16Array(left.length * 2);
    for (let i = 0; i < left.length; i++) {
      const frame = written + i;
      let g = 1;
      if (frame < fadeFrames) g *= Math.sin(((frame + 0.5) / fadeFrames) * Math.PI / 2);
      if (frame >= frames - fadeFrames) g *= Math.sin(((frames - frame - 0.5) / fadeFrames) * Math.PI / 2);
      for (let c = 0; c < 2; c++) {
        const x = (c === 0 ? left[i] : right[i]) * g; const a = Math.abs(x);
        if (a > peak) peak = a;
        if (a > 1) clipped++;
        out[i * 2 + c] = Math.max(-32768, Math.min(32767, Math.round(x * 32767)));
      }
    }
    written += left.length;
    parts.push(new Blob([out.buffer]));
  };
  options.onProgress?.({ done: 0, total: plan.length });
  for (let index = 0; index < plan.length; index++) {
    if (options.signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
    const piece = plan[index]; const last = index === plan.length - 1;
    const ctx = new OfflineAudioContext(EXPORT_CHANNELS, Math.round(piece.renderSec * rate), rate);
    const inner = options.loadRecorded?.(ctx);
    const loader: RecordedLoader | undefined = inner
      ? id => { let p = cache.get(id); if (!p) { p = inner(id).catch(() => null); cache.set(id, p); } return p; } : undefined;
    const handle = buildSoundscape(ctx, ctx.destination, settings.spec, settings.level, loader, settings.overtoneBusGain,
      settings.recordedAmount, settings.weaveAmount, settings.toneLayerAmount, { origin: piece.origin, horizonSec: piece.renderSec });
    handle.scheduleTicks(0, piece.renderSec);
    // Recordings and weave moments are scheduled once their buffers resolve; wait for every load to settle.
    await Promise.all([...cache.values()]);
    for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0));
    for (const [id, state] of Object.entries(handle.recordedLayers())) if (state === 'recorded') recorded.add(id);
    for (const id of handle.weaveMoments()) recorded.add(id);
    const rendered = await ctx.startRendering();
    handle.dispose();
    const from = Math.round(piece.keepFrom * rate);
    const n = index === 0 ? Math.round(piece.keepSec * rate) : Math.min(Math.round(piece.keepSec * rate), frames - written + joinFrames);
    const L = rendered.getChannelData(0).subarray(from, from + n);
    const R = rendered.getChannelData(EXPORT_CHANNELS > 1 ? 1 : 0).subarray(from, from + n);
    let start = 0;
    if (held) {
      // The pieces are the same sound here; the short crossfade only guards against rounding.
      const mixL = new Float32Array(joinFrames); const mixR = new Float32Array(joinFrames);
      for (let i = 0; i < joinFrames; i++) {
        const w = (i + 0.5) / joinFrames;
        mixL[i] = held[0][i] * (1 - w) + L[i] * w; mixR[i] = held[1][i] * (1 - w) + R[i] * w;
      }
      emit(mixL, mixR); start = joinFrames;
    }
    const end = last ? n : n - joinFrames;
    emit(L.subarray(start, end), R.subarray(start, end));
    held = last ? null : [L.slice(end, n), R.slice(end, n)];
    options.onProgress?.({ done: index + 1, total: plan.length });
  }
  return { blob: new Blob(parts, { type: 'audio/wav' }), seconds: total, peak, clippedSamples: clipped, recordedLayers: [...recorded] };
}
