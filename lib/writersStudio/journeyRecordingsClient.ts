import { apiFetch } from '@/lib/http/apiBase';
import { declaredSanctuaryPosture } from '@/lib/sanctuary/currentClientPosture';
import type { RecordingKind } from './journeyRecordings';
import type { FounderRecording, OwnRecording } from './journeyRecordingsServer';

const BASE = '/api/sovereign/writers-studio/journey/recordings';

export async function listMyRecordings(): Promise<OwnRecording[]> {
  try {
    const r = await apiFetch(BASE);
    const body = await r.json().catch(() => ({}));
    return r.ok && Array.isArray(body?.recordings) ? body.recordings : [];
  } catch { return []; }
}

export async function listAllRecordings(): Promise<FounderRecording[] | null> {
  try {
    const r = await apiFetch(`${BASE}?scope=all`);
    if (!r.ok) return null;
    const body = await r.json().catch(() => ({}));
    return Array.isArray(body?.recordings) ? body.recordings : [];
  } catch { return null; }
}

/** An object URL for playing one recording; the caller revokes it. Loaded only when someone presses Play. */
export async function recordingUrl(id: string): Promise<string | null> {
  try {
    const r = await apiFetch(`${BASE}?media=${encodeURIComponent(id)}`);
    return r.ok ? URL.createObjectURL(await r.blob()) : null;
  } catch { return null; }
}

/** Only ever called from the writer's click on "Send this recording", after they have played it back. */
export async function sendMyRecording(input: { promptKey: string; kind: RecordingKind; blob: Blob }): Promise<{ ok: true; recording: OwnRecording } | { ok: false; refusal: string }> {
  const form = new FormData();
  form.append('promptKey', input.promptKey);
  form.append('kind', input.kind);
  const posture = declaredSanctuaryPosture();
  if ('sanctuary' in posture) form.append('sanctuary', String(posture.sanctuary));
  form.append('file', input.blob, input.kind === 'video' ? 'answer-video' : 'answer-audio');
  try {
    const r = await apiFetch(BASE, { method: 'POST', body: form });
    const body = await r.json().catch(() => ({}));
    return r.ok && body?.recording ? { ok: true, recording: body.recording } : { ok: false, refusal: String(body?.refusal ?? `http_${r.status}`) };
  } catch { return { ok: false, refusal: 'unreachable' }; }
}

export async function withdrawMyRecording(id: string): Promise<boolean> {
  try { return (await apiFetch(`${BASE}?id=${encodeURIComponent(id)}`, { method: 'DELETE' })).ok; } catch { return false; }
}
