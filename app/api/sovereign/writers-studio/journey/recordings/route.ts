import { NextRequest, NextResponse } from 'next/server';
import { getMemberIdFromRequest } from '@/lib/auth/getMemberFromRequest';
import { keepRefusal } from '@/lib/sanctuary/studioPosture';
import { writersStudioStanding } from '@/lib/writersStudio/betaAccessServer';
import { isFounder } from '@/lib/writersStudio/journeyServer';
import { JOURNEY_PROMPTS } from '@/lib/writersStudio/journey';
import {
  RECORDING_MAX_BYTES, acceptedMime, isRecordingKind, postureFromFormField, recordingsEnabledFromEnv,
} from '@/lib/writersStudio/journeyRecordings';
import {
  listOwnRecordings, listRecordingsForFounder, readRecordingMedia, saveRecording, withdrawRecording,
} from '@/lib/writersStudio/journeyRecordingsServer';

/**
 * Recorded Beta-journey answers (Studio Academy slice 5; founder rulings 2026-11-19). BUILT DARK.
 *
 *   GET               the writer's own recordings (with their written copies)
 *   GET ?media=<id>   the recording itself, for its writer or the founder
 *   GET ?scope=all    the founder's view of every current recording (founder only)
 *   POST (multipart)  promptKey, kind (audio|video), file, sanctuary — one recording, refused in Sanctuary
 *   DELETE ?id=<id>   withdraw: destroys the recording and its written copy
 *
 * ⛔ With WS_JOURNEY_RECORDINGS_ENABLED off, GET and POST answer 404. ⭐ DELETE always works.
 */
export const dynamic = 'force-dynamic';
const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, x-session-token' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROMPT_KEYS = new Set(JOURNEY_PROMPTS.map((p) => p.key));
const ENVELOPE = 1024 * 1024; // room for the multipart headers around the largest file

const off = () => NextResponse.json({ error: 'not_found' }, { status: 404, headers: privateHeaders });
const refuse = (status: number, refusal: string) => NextResponse.json({ refusal }, { status, headers: privateHeaders });
const notReady = (error: unknown) => (error as { code?: string })?.code === '42P01' ? refuse(503, 'recordings_not_ready') : null;

export async function GET(req: NextRequest) {
  if (!recordingsEnabledFromEnv(process.env)) return off();
  const memberId = await getMemberIdFromRequest(req);
  if (!memberId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: privateHeaders });
  try {
    const media = req.nextUrl.searchParams.get('media');
    if (media !== null) {
      if (!UUID.test(media)) return refuse(400, 'malformed');
      const found = await readRecordingMedia(memberId, media, await isFounder(memberId));
      if (!found) return refuse(404, 'not_found');
      return new NextResponse(new Uint8Array(found.bytes), { headers: { ...privateHeaders, 'Content-Type': found.mime, 'Content-Length': String(found.bytes.length) } });
    }
    if (req.nextUrl.searchParams.get('scope') === 'all') {
      if (!(await isFounder(memberId))) return refuse(403, 'founder_only');
      return NextResponse.json({ recordings: await listRecordingsForFounder() }, { headers: privateHeaders });
    }
    return NextResponse.json({ recordings: await listOwnRecordings(memberId) }, { headers: privateHeaders });
  } catch (error) {
    const r = notReady(error); if (r) return r; throw error;
  }
}

export async function POST(req: NextRequest) {
  if (!recordingsEnabledFromEnv(process.env)) return off();
  const memberId = await getMemberIdFromRequest(req);
  if (!memberId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: privateHeaders });
  /* A declared body larger than the largest recording is refused before it is read; the file's own size is checked again below. */
  const declared = Number(req.headers.get('content-length') ?? NaN);
  if (Number.isFinite(declared) && declared > RECORDING_MAX_BYTES.video + ENVELOPE) return refuse(413, 'too_large');
  const access = await writersStudioStanding(memberId);
  if (!access.admitted) return refuse(403, 'not_in_beta_pilot');
  const form = await req.formData().catch(() => null);
  if (!form) return refuse(400, 'malformed');
  /* Never in Sanctuary (founder ruling 2026-11-19): a recording is kept, so it needs a declared ordinary posture. */
  const refused = await keepRefusal(memberId, { sanctuary: postureFromFormField(form.get('sanctuary')) });
  if (refused) return NextResponse.json({ ...refused.body, persisted: false }, { status: refused.status, headers: privateHeaders });
  const allowed = new Set(['promptKey', 'kind', 'file', 'sanctuary']);
  for (const key of form.keys()) if (!allowed.has(key)) return refuse(400, 'malformed');
  const promptKey = form.get('promptKey');
  const kind = form.get('kind');
  const file = form.get('file');
  if (typeof promptKey !== 'string' || !PROMPT_KEYS.has(promptKey) || !isRecordingKind(kind) || !(file instanceof Blob)) return refuse(400, 'malformed');
  const mime = acceptedMime(kind, file.type);
  if (!mime) return refuse(415, 'unsupported_recording');
  if (file.size < 1 || file.size > RECORDING_MAX_BYTES[kind]) return refuse(413, 'too_large');
  try {
    const outcome = await saveRecording({
      memberId, promptKey, kind, mime, bytes: Buffer.from(await file.arrayBuffer()), betaEnd: process.env.WS_BETA_END_DATE ?? null,
    });
    if (!outcome.ok) return refuse(outcome.status, outcome.refusal);
    return NextResponse.json({ recording: outcome.recording }, { headers: privateHeaders });
  } catch (error) {
    const r = notReady(error); if (r) return r; throw error;
  }
}

export async function DELETE(req: NextRequest) {
  const memberId = await getMemberIdFromRequest(req);
  if (!memberId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: privateHeaders });
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!UUID.test(id)) return refuse(400, 'malformed');
  try {
    return (await withdrawRecording(memberId, id))
      ? NextResponse.json({ withdrawn: true }, { headers: privateHeaders })
      : refuse(404, 'not_found');
  } catch (error) {
    const r = notReady(error); if (r) return r;
    console.error('[journey-recordings] withdrawal could not destroy the recording yet', { id });
    return refuse(500, 'not_withdrawn_try_again');
  }
}
