/**
 * SOULLAB TRANSFORM T1 — WAV in and out, at the recording's own sample rate.
 *
 * Reading a WAV here (instead of through the browser's decoder) keeps a Soullab
 * Capture take at exactly its own rate and samples — browser decoding resamples
 * to the context rate. Other formats are decoded by the browser and their
 * provenance says so.
 *
 * Writing: 24-bit PCM. The existing Writer's Studio encoder
 * (lib/writersStudio/listen/wavExport.ts) caps output at 180 MB (~11 minutes of
 * stereo), short of T1's approved 20 minutes, and T1 may not change it; this is
 * the same format with the 20-minute bound instead.
 */
import type { Audio } from './audio';
import { MAX_TRANSFORM_SECONDS } from './recipe';

const PCM = 1, FLOAT = 3, EXTENSIBLE = 0xfffe;

export function readWav(bytes: ArrayBuffer): Audio {
  const v = new DataView(bytes);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (bytes.byteLength < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('This is not a WAV file.');
  let fmt: { format: number; channels: number; rate: number; bits: number } | null = null;
  let data: { offset: number; size: number } | null = null;
  for (let p = 12; p + 8 <= bytes.byteLength;) {
    const id = tag(p), size = v.getUint32(p + 4, true);
    if (id === 'fmt ') {
      let format = v.getUint16(p + 8, true);
      if (format === EXTENSIBLE && size >= 40) format = v.getUint16(p + 8 + 24, true);
      fmt = { format, channels: v.getUint16(p + 10, true), rate: v.getUint32(p + 12, true), bits: v.getUint16(p + 22, true) };
    } else if (id === 'data') {
      data = { offset: p + 8, size: Math.min(size, bytes.byteLength - p - 8) };
    }
    p += 8 + size + (size & 1);
  }
  if (!fmt || !data) throw new Error('This WAV file has no audio in a form Soullab can read.');
  const { format, channels, rate, bits } = fmt;
  const ok = (format === PCM && (bits === 16 || bits === 24 || bits === 32)) || (format === FLOAT && bits === 32);
  if (!ok || channels < 1 || channels > 2 || rate < 8000 || rate > 192_000) {
    throw new Error('Soullab reads mono or stereo WAV at 16, 24 or 32 bits.');
  }
  const width = bits / 8;
  const frames = Math.floor(data.size / (width * channels));
  if (frames < 1) throw new Error('This recording is empty.');
  if (frames > MAX_TRANSFORM_SECONDS * rate) throw new Error('This recording is longer than 20 minutes.');
  const out = Array.from({ length: channels }, () => new Float32Array(frames));
  let o = data.offset;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      let s: number;
      if (format === FLOAT) s = v.getFloat32(o, true);
      else if (bits === 16) s = v.getInt16(o, true) / 32768;
      else if (bits === 24) s = ((v.getUint8(o) | (v.getUint8(o + 1) << 8) | (v.getInt8(o + 2) << 16))) / 8388608;
      else s = v.getInt32(o, true) / 2147483648;
      out[c][i] = s;
      o += width;
    }
  }
  return { sampleRate: rate, channels: out };
}

/** 24-bit PCM WAV. Samples are clipped to full scale; the same scaling as readWav, so a 24-bit take round-trips exactly. */
export function writeWav24(a: Audio): ArrayBuffer {
  const channels = a.channels.length;
  const frames = a.channels[0]?.length ?? 0;
  if (channels < 1 || channels > 2 || frames < 1) throw new Error('Nothing to save.');
  if (frames > MAX_TRANSFORM_SECONDS * a.sampleRate) throw new Error('The result is longer than 20 minutes.');
  const dataBytes = frames * channels * 3;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const ascii = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ascii(0, 'RIFF'); v.setUint32(4, 36 + dataBytes, true); ascii(8, 'WAVE');
  ascii(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, PCM, true); v.setUint16(22, channels, true);
  v.setUint32(24, a.sampleRate, true); v.setUint32(28, a.sampleRate * channels * 3, true);
  v.setUint16(32, channels * 3, true); v.setUint16(34, 24, true);
  ascii(36, 'data'); v.setUint32(40, dataBytes, true);
  const bytes = new Uint8Array(buf);
  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const raw = a.channels[c][i];
      const s = Number.isFinite(raw) ? raw : 0;
      const q = Math.max(-8388608, Math.min(8388607, Math.round(s * 8388608)));
      bytes[o++] = q & 255; bytes[o++] = (q >> 8) & 255; bytes[o++] = (q >> 16) & 255;
    }
  }
  return buf;
}
