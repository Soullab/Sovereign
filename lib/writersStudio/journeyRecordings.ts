/**
 * Recorded answers in the Beta journey (Studio Academy slice 5). Founder rulings 2026-11-19: writers may answer by audio or video;
 * "Approve defaults": founder-only reader, kept 12 months or until the beta ends, withdrawal deletes everywhere, encrypted,
 * transcribed only by Soullab's own speech service (maia-whisper), never in Sanctuary.
 *
 * ⛔ BUILT DARK. Server flag WS_JOURNEY_RECORDINGS_ENABLED === '1', read once on the server page; the route refuses (404) when off,
 *    except withdrawal, which always works. Merge waits for R20 consent review (#1793).
 * ⛔ One recording at a time, sent only after the writer has played it back and clicked "Send this recording".
 * ⛔ Never MAIA's context, never training, never adaptation (Invariant 15).
 */
export const RECORDINGS_FLAG = 'WS_JOURNEY_RECORDINGS_ENABLED';
export function recordingsEnabledFromEnv(env: Record<string, string | undefined>): boolean {
  return env[RECORDINGS_FLAG] === '1';
}

export type RecordingKind = 'audio' | 'video';
export const RECORDING_MIME: Record<RecordingKind, readonly string[]> = {
  audio: ['audio/webm', 'audio/ogg', 'audio/mp4'],
  video: ['video/webm', 'video/mp4'],
};
/** Bytes, before encryption. About five minutes of speech, or about two minutes of small video. */
export const RECORDING_MAX_BYTES: Record<RecordingKind, number> = { audio: 10 * 1024 * 1024, video: 40 * 1024 * 1024 };
export const RECORDING_MAX_SECONDS: Record<RecordingKind, number> = { audio: 300, video: 120 };

/** The base MIME type the browser reported, without codec parameters, if it is one we accept for this kind. */
export function acceptedMime(kind: RecordingKind, mime: string): string | null {
  const base = String(mime || '').split(';')[0]!.trim().toLowerCase();
  return RECORDING_MIME[kind].includes(base) ? base : null;
}
export function isRecordingKind(v: unknown): v is RecordingKind { return v === 'audio' || v === 'video'; }

/** A posture declared in a form field: 'false' → ordinary, 'true' → Sanctuary, 'no_live_settings' as is; anything else undeclared. */
export function postureFromFormField(v: FormDataEntryValue | null): boolean | 'no_live_settings' | undefined {
  if (v === 'false') return false;
  if (v === 'true') return true;
  if (v === 'no_live_settings') return 'no_live_settings';
  return undefined;
}

/** The only speech service a recording may be sent to: Soullab's own, inside its own network. */
export const ALLOWED_TRANSCRIBE_HOSTS = ['whisper', 'maia-whisper', 'faster-whisper', 'localhost', '127.0.0.1'] as const;
export function transcribeUrlAllowed(url: string): boolean {
  try { return (ALLOWED_TRANSCRIBE_HOSTS as readonly string[]).includes(new URL(url).hostname); } catch { return false; }
}

export const RECORDING_EXPLAINER = [
  'Only Kelly at Soullab listens to or watches it, to learn how the Studio can help writers better. MAIA never hears it.',
  'Soullab’s own speech service makes a written copy, on Soullab’s server. Nothing goes to an outside company.',
  'It is kept encrypted, for 12 months or until the beta ends, whichever comes first, then deleted.',
  'You can withdraw it at any time. Withdrawing deletes the recording and its written copy completely.',
] as const;
