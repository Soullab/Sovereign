/**
 * SOULLAB CAPTURE → SOUND STUDIO (J4b-1) — what a Soullab Capture take says
 * about itself, read from inside the file the member chose.
 *
 * A Capture take is a Broadcast WAV (packages/soullab-capture, WAVLayout.swift):
 * a `bext` chunk whose originator is "Soullab Capture" and whose description is
 * "Soullab Capture take <id>" (with " [recovered]" when the take was finished by
 * crash recovery), plus one `cue ` point per discontinuity the helper marked.
 *
 * This is the FILE'S OWN CLAIM. It is copied into the derived take's provenance
 * so the lineage travels with the new file, and it is labelled `asserted:
 * 'by-file'`: nothing here checks it against the take's `.provenance.json`,
 * and anyone can write these bytes. The original's SHA-256 (already in the
 * source record) is the anchor that lets the two be reconciled later.
 *
 * Nothing is fetched, uploaded or looked up. The member still chooses the file
 * themselves (acceptMemberFile); this only reads bytes they handed over.
 */
import { findChunk } from './wav';

export const CAPTURE_ORIGINATOR = 'Soullab Capture';
const DESCRIPTION_PREFIX = 'Soullab Capture take ';
const RECOVERED_SUFFIX = ' [recovered]';

/** BWF v2 `bext` fixed layout (EBU Tech 3285), offsets within the chunk body. */
const BEXT = { description: [0, 256], originator: [256, 32], originatorReference: [288, 32], date: [320, 10], time: [330, 8], fixed: 602 } as const;
const MAX_HISTORY = 512;

export type CaptureOrigin = {
  recorder: 'soullab-capture';
  /** The take id the helper wrote. */
  takeId: string;
  /** True when Capture finished this take by crash recovery rather than a normal stop. */
  recovered: boolean;
  /** Local date and time on the recording Mac, as written in the file ("YYYY-MM-DD HH:MM:SS"). */
  recordedAt: string;
  /** BWF coding history: rate, depth, layout and helper version, as written by Capture. */
  codingHistory: string;
  /** Discontinuities Capture marked in the file (cue points). 0 when none were marked. */
  markedGaps: number;
  /** This is what the file says about itself; it was not checked against the take's provenance.json. */
  asserted: 'by-file';
};

/** Printable ASCII only, NULs and padding trimmed, bounded. Anything else in these fields is dropped. */
function text(bytes: Uint8Array, start: number, length: number): string {
  let out = '';
  for (let i = start; i < start + length && i < bytes.length; i++) {
    const c = bytes[i];
    if (c === 0) break;
    if (c >= 0x20 && c < 0x7f) out += String.fromCharCode(c);
  }
  return out.trim();
}

function history(bytes: Uint8Array, start: number, end: number): string {
  let out = '';
  for (let i = start; i < end && out.length < MAX_HISTORY; i++) {
    const c = bytes[i];
    if (c === 0) break;
    if (c === 0x0d || c === 0x0a) { if (!out.endsWith('; ')) out += '; '; continue; }
    if (c >= 0x20 && c < 0x7f) out += String.fromCharCode(c);
  }
  return out.replace(/(; )+$/, '').trim();
}

/** The Capture origin of a WAV, or null when it is not a Soullab Capture take (or says nothing readable). */
export function readCaptureOrigin(wav: ArrayBuffer): CaptureOrigin | null {
  let bext: { offset: number; size: number } | null;
  try { bext = findChunk(wav, 'bext'); } catch { return null; }
  if (!bext || bext.size < BEXT.fixed) return null;
  const body = new Uint8Array(wav, bext.offset, bext.size);
  if (text(body, ...BEXT.originator) !== CAPTURE_ORIGINATOR) return null;
  const description = text(body, ...BEXT.description);
  if (!description.startsWith(DESCRIPTION_PREFIX)) return null;
  const recovered = description.endsWith(RECOVERED_SUFFIX);
  const takeId = description.slice(DESCRIPTION_PREFIX.length, recovered ? -RECOVERED_SUFFIX.length : undefined).trim().slice(0, 64);
  if (!takeId) return null;
  const date = text(body, ...BEXT.date), time = text(body, ...BEXT.time).replace(/[-.]/g, ':');
  const recordedAt = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}:\d{2}$/.test(time) ? `${date} ${time}` : '';

  let markedGaps = 0;
  const cue = findChunk(wav, 'cue ');
  if (cue && cue.size >= 4) markedGaps = new DataView(wav, cue.offset, 4).getUint32(0, true);

  return {
    recorder: 'soullab-capture',
    takeId,
    recovered,
    recordedAt,
    codingHistory: history(body, BEXT.fixed, body.length),
    markedGaps,
    asserted: 'by-file',
  };
}

/** One plain sentence for the desk. It says what the file says, not more. */
export function describeCaptureOrigin(o: CaptureOrigin): string {
  const when = o.recordedAt ? ` on ${o.recordedAt.slice(0, 16)}` : '';
  const gaps = o.markedGaps === 0 ? '' : ` · ${o.markedGaps} gap${o.markedGaps === 1 ? '' : 's'} marked by Capture`;
  return `A Soullab Capture take, recorded${when}${o.recovered ? ' (recovered after an interruption)' : ''}${gaps}.`;
}
