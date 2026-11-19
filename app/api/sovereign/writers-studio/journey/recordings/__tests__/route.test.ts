/** @jest-environment node */
/**
 * Recorded Beta-journey answers (Studio Academy slice 5, founder rulings 2026-11-19). Hermetic: stubbed database, auth, pilot
 * standing, an in-memory vault and a stubbed speech service; REAL encryption, so the vault is proven to hold only ciphertext.
 */
const query = jest.fn();
jest.mock('@/lib/db/postgres', () => ({ query: (...a: unknown[]) => query(...a) }));
const member = jest.fn();
jest.mock('@/lib/auth/getMemberFromRequest', () => ({ getMemberIdFromRequest: (...a: unknown[]) => member(...a) }));
const standing = jest.fn();
jest.mock('@/lib/writersStudio/betaAccessServer', () => ({ writersStudioStanding: (...a: unknown[]) => standing(...a) }));
const vault = new Map<string, Buffer>();
const events: string[] = [];
const destroy = jest.fn(async (p: string) => { events.push(`destroy:${p}`); vault.delete(p); });
jest.mock('@/lib/storage/fileVault', () => ({
  writeDurableVaultBytes: async (ns: string, id: string, ext: string, b: Buffer) => { const p = `${ns}/${id}.${ext}`; vault.set(p, b); return p; },
  readVaultBytes: async (p: string) => vault.get(p)!,
  destroyVaultBytes: (p: string) => destroy(p),
}));
import { NextRequest } from 'next/server';
import { generateKey, clearKeyCache } from '@/lib/security/phiEncryption';
import { decryptRecordingMedia, decryptTranscript } from '@/lib/security/phiAccessors/journeyRecordings';
import { transcribeLocally } from '@/lib/writersStudio/journeyRecordingsServer';
import { DELETE, GET, POST } from '../route';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '99999999-9999-4999-8999-999999999999';
const REC = 'c0000000-0000-4000-8000-00000000000c';
const URL_ = 'https://soullab.life/api/sovereign/writers-studio/journey/recordings';
const AUDIO = Buffer.from('RIFF-pretend-opus-audio-bytes-that-must-never-sit-in-the-clear');
function upload(fields: Record<string, string | Blob | undefined>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) form.append(k, v as string | Blob);
  return new NextRequest(URL_, { method: 'POST', body: form } as never);
}
const ordinary = () => ({ promptKey: 'edit_felt_like_mine', kind: 'audio', sanctuary: 'false', file: new Blob([AUDIO], { type: 'audio/webm;codecs=opus' }) });
const inserts = () => query.mock.calls.filter(([sql]) => /INSERT INTO writer_studio_journey_recordings/.test(String(sql)));

function db(opts: { owner?: boolean; founder?: boolean; expired?: { id: string; storage_path: string }[] } = {}) {
  const { owner = true, founder = false, expired = [] } = opts;
  query.mockImplementation(async (sql: string) => {
    if (sql.startsWith('SELECT id, storage_path FROM writer_studio_journey_recordings WHERE expires_at')) return { rows: expired };
    if (sql.startsWith('DELETE FROM writer_studio_journey_recordings WHERE id = $1 AND member_id')) { events.push('delete-row'); return { rows: [], rowCount: owner ? 1 : 0 }; }
    if (sql.startsWith('DELETE FROM writer_studio_journey_recordings WHERE id = $1')) { events.push('purge-row'); return { rows: [], rowCount: 1 }; }
    if (sql.startsWith('SELECT storage_path FROM writer_studio_journey_recordings')) return { rows: owner ? [{ storage_path: `journey-recordings/${REC}.enc` }] : [] };
    if (sql.includes("admin_role = 'founder'")) return { rows: [{ founder }] };
    if (sql.includes('FROM writer_studio_journey_recordings r')) { events.push('read'); return { rows: [] }; }
    return { rows: [], rowCount: 1 };
  });
}

const fetchMock = jest.fn();
const ORIGINAL = { key: process.env.PHI_ENCRYPTION_KEY, flag: process.env.WS_JOURNEY_RECORDINGS_ENABLED, whisper: process.env.WHISPER_LOCAL_URL, fetch: global.fetch };
beforeAll(() => { process.env.PHI_ENCRYPTION_KEY = generateKey(); clearKeyCache(); });
afterAll(() => {
  for (const [k, v] of [['PHI_ENCRYPTION_KEY', ORIGINAL.key], ['WS_JOURNEY_RECORDINGS_ENABLED', ORIGINAL.flag], ['WHISPER_LOCAL_URL', ORIGINAL.whisper]] as const) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  global.fetch = ORIGINAL.fetch; clearKeyCache();
});
beforeEach(() => {
  jest.clearAllMocks(); vault.clear(); events.length = 0;
  member.mockResolvedValue(ME); standing.mockResolvedValue({ admitted: true });
  process.env.WS_JOURNEY_RECORDINGS_ENABLED = '1'; delete process.env.WHISPER_LOCAL_URL;
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ text: 'It felt like mine.' }), { status: 200 }));
  global.fetch = fetchMock as never;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('dark: with the switch off, listing, playing and sending answer 404 and touch nothing', async () => {
  process.env.WS_JOURNEY_RECORDINGS_ENABLED = 'true';
  db();
  expect((await POST(upload(ordinary()))).status).toBe(404);
  expect((await GET(new NextRequest(URL_))).status).toBe(404);
  expect((await GET(new NextRequest(`${URL_}?media=${REC}`))).status).toBe(404);
  expect(query).not.toHaveBeenCalled();
  expect(vault.size).toBe(0);
});

it('withdrawal works with the switch off: the recording is destroyed first, then its row, and only the writer’s own', async () => {
  delete process.env.WS_JOURNEY_RECORDINGS_ENABLED;
  db();
  expect((await DELETE(new NextRequest(`${URL_}?id=${REC}`, { method: 'DELETE' } as never))).status).toBe(200);
  expect(events).toEqual([`destroy:journey-recordings/${REC}.enc`, 'delete-row']);
  const lookup = query.mock.calls.find(([s]) => String(s).startsWith('SELECT storage_path'))!;
  expect(lookup[1]).toEqual([REC, ME]);
  db({ owner: false }); events.length = 0;
  expect((await DELETE(new NextRequest(`${URL_}?id=${REC}`, { method: 'DELETE' } as never))).status).toBe(404);
  expect(destroy).toHaveBeenCalledTimes(1);
});

it('if the recording cannot be destroyed, the row stays so withdrawal can be retried', async () => {
  db();
  destroy.mockRejectedValueOnce(new Error('disk'));
  expect((await DELETE(new NextRequest(`${URL_}?id=${REC}`, { method: 'DELETE' } as never))).status).toBe(500);
  expect(events).not.toContain('delete-row');
});

it('Sanctuary, or no declared setting: refused, nothing stored, nothing transcribed', async () => {
  db();
  for (const sanctuary of ['true', undefined, 'garbage']) {
    expect((await POST(upload({ ...ordinary(), sanctuary }))).status).toBe(409);
  }
  expect(vault.size).toBe(0);
  expect(inserts()).toHaveLength(0);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('outside the beta pilot, an unknown question, a wrong kind or format, an extra field, or too large: refused, nothing stored', async () => {
  db();
  standing.mockResolvedValueOnce({ admitted: false });
  expect((await POST(upload(ordinary()))).status).toBe(403);
  expect((await POST(upload({ ...ordinary(), promptKey: 'how_old_are_you' }))).status).toBe(400);
  expect((await POST(upload({ ...ordinary(), kind: 'screen' }))).status).toBe(400);
  expect((await POST(upload({ ...ordinary(), file: new Blob([AUDIO], { type: 'application/pdf' }) }))).status).toBe(415);
  expect((await POST(upload({ ...ordinary(), note: 'extra' }))).status).toBe(400);
  expect((await POST(upload({ ...ordinary(), file: new Blob([Buffer.alloc(10 * 1024 * 1024 + 1)], { type: 'audio/webm' }) }))).status).toBe(413);
  expect(vault.size).toBe(0);
  expect(inserts()).toHaveLength(0);
});

it('a sent recording is ciphertext in the vault, its written copy is encrypted, and both are bound to the row and the writer', async () => {
  db();
  const res = await POST(upload(ordinary()));
  expect(res.status).toBe(200);
  const [, params] = inserts()[0]!;
  const [id, memberId, promptKey, kind, mime, size, storagePath, mediaMeta, transcriptEnc, transcriptMeta, createdAt, expiresAt] = params as string[];
  expect([memberId, promptKey, kind, mime, size]).toEqual([ME, 'edit_felt_like_mine', 'audio', 'audio/webm', AUDIO.length]);
  const file = vault.get(storagePath)!;
  expect(file.includes(AUDIO)).toBe(false);
  expect(file.toString('utf8')).not.toContain(AUDIO.toString('base64'));
  expect(decryptRecordingMedia(file, mediaMeta, { rowId: id, memberId: ME }).equals(AUDIO)).toBe(true);
  expect(() => decryptRecordingMedia(file, mediaMeta, { rowId: id, memberId: OTHER })).toThrow();
  expect(transcriptEnc).not.toContain('mine');
  expect(decryptTranscript(transcriptEnc, transcriptMeta, { rowId: id, memberId: ME })).toBe('It felt like mine.');
  expect(String(fetchMock.mock.calls[0]![0])).toBe('http://whisper:8000/v1/audio/transcriptions');
  const days = (Date.parse(expiresAt) - Date.parse(createdAt)) / 86_400_000;
  expect(days).toBeLessThanOrEqual(365);
});

it('a recording is never sent to a speech service outside Soullab’s own', async () => {
  expect(await transcribeLocally(AUDIO, 'audio/webm', { WHISPER_LOCAL_URL: 'https://api.example-transcribe.com' })).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
  db();
  process.env.WHISPER_LOCAL_URL = 'https://api.example-transcribe.com';
  expect((await POST(upload(ordinary()))).status).toBe(200);
  expect(fetchMock).not.toHaveBeenCalled();
  expect((inserts()[0]![1] as unknown[])[8]).toBeNull();
});

it('playing a recording: only its writer, or the founder; everyone else gets nothing', async () => {
  db({ founder: false });
  expect((await GET(new NextRequest(`${URL_}?media=${REC}`))).status).toBe(404);
  const read = query.mock.calls.find(([s]) => String(s).includes('WHERE r.id = $1'))!;
  expect(String(read[0])).toContain('($3::boolean OR r.member_id = $2)');
  expect(read[1]).toEqual([REC, ME, false]);
});

it('only the founder sees everyone’s recordings, and expired ones are destroyed before any read', async () => {
  db({ founder: false });
  expect((await GET(new NextRequest(`${URL_}?scope=all`))).status).toBe(403);
  db({ founder: true, expired: [{ id: 'old', storage_path: 'journey-recordings/old.enc' }] }); events.length = 0;
  expect((await GET(new NextRequest(`${URL_}?scope=all`))).status).toBe(200);
  expect(events).toEqual(['destroy:journey-recordings/old.enc', 'purge-row', 'read']);
  const list = query.mock.calls.find(([s]) => String(s).includes('JOIN members m'))!;
  expect(String(list[0])).toContain('r.expires_at > now()');
});
