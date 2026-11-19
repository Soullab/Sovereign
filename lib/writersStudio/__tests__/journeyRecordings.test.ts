/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import {
  RECORDING_EXPLAINER, acceptedMime, postureFromFormField, recordingsEnabledFromEnv, transcribeUrlAllowed,
} from '../journeyRecordings';

const ROOT = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const MIGRATION = read('database/migrations/20261119000002_writer_studio_journey_recordings.sql');

describe('Recorded journey answers: rules that hold whatever the code around them does', () => {
  test('dark unless the server flag is exactly "1"', () => {
    expect(recordingsEnabledFromEnv({ WS_JOURNEY_RECORDINGS_ENABLED: '1' })).toBe(true);
    for (const v of [undefined, '', '0', 'true']) expect(recordingsEnabledFromEnv({ WS_JOURNEY_RECORDINGS_ENABLED: v })).toBe(false);
    expect(read('lib/writersStudio/JourneyRecordingsContext.tsx')).toMatch(/createContext\(false\)/);
    expect(read('app/dev/writers-studio-p4r1/P4R1StudioHost.tsx')).toMatch(/recordingsEnabled = false,/);
    expect(read('app/writers-studio/page.tsx')).toMatch(/recordingsEnabled=\{recordingsEnabledFromEnv\(process\.env\)\}/);
  });

  test('only Soullab’s own speech service may transcribe', () => {
    for (const ok of ['http://whisper:8000', 'http://maia-whisper:8000', 'http://localhost:8000']) expect(transcribeUrlAllowed(ok)).toBe(true);
    for (const no of ['https://transcribe.example.com', 'https://whisper.example.com', 'not a url', 'http://whisper.evil.com']) expect(transcribeUrlAllowed(no)).toBe(false);
  });

  test('a posture is declared only by an explicit value', () => {
    expect(postureFromFormField('false')).toBe(false);
    expect(postureFromFormField('true')).toBe(true);
    expect(postureFromFormField('no_live_settings')).toBe('no_live_settings');
    for (const v of [null, '', 'undefined', 'no']) expect(postureFromFormField(v)).toBeUndefined();
  });

  test('only audio and video formats are taken, by kind', () => {
    expect(acceptedMime('audio', 'audio/webm;codecs=opus')).toBe('audio/webm');
    expect(acceptedMime('audio', 'video/webm')).toBeNull();
    expect(acceptedMime('video', 'video/mp4')).toBe('video/mp4');
    expect(acceptedMime('video', 'text/html')).toBeNull();
  });

  test('the table holds no plaintext, has no soft delete, and expires within 12 months', () => {
    expect(MIGRATION).not.toMatch(/\b(transcript|body|answer|withdrawn_at|deleted_at)\b\s+TEXT/i);
    expect(MIGRATION).toMatch(/transcript_enc TEXT/);
    expect(MIGRATION).toMatch(/media_enc_meta TEXT NOT NULL/);
    expect(MIGRATION).toMatch(/CHECK \(expires_at <= created_at \+ INTERVAL '12 months'\)/);
    expect(MIGRATION).toMatch(/SET LOCAL lock_timeout = '5s'/);
  });

  test('nothing but the recordings store reads the table: never MAIA’s context, never training', () => {
    const hits = execSync(`git grep --untracked -l "writer_studio_journey_recordings" -- lib app components scripts`, { cwd: ROOT, encoding: 'utf8' })
      .trim().split('\n').filter((f) => !f.includes('__tests__'));
    expect(hits.sort()).toEqual(['lib/security/phiAccessors/journeyRecordings.ts', 'lib/writersStudio/journeyRecordingsServer.ts']);
  });

  test('the recorder sends only from "Send this recording", after playback, and says what happens', () => {
    const ui = read('app/dev/writers-studio-p4r1/JourneyRecorder.tsx');
    expect(ui.match(/sendMyRecording\(/g)).toHaveLength(1);
    const send = ui.slice(ui.indexOf('const send = async'), ui.indexOf('const play = async'));
    expect(send).toMatch(/if \(!take \|\| !kind\) return;/);
    expect(ui).toMatch(/onClick=\{\(\) => void send\(\)\}>\s*\{phase === 'sending' \? 'Sending…' : 'Send this recording'\}/);
    expect(ui).toMatch(/Play it back first\. Nothing has been sent\./);
    const text = RECORDING_EXPLAINER.join(' ');
    expect(text).toMatch(/Only Kelly/);
    expect(text).toMatch(/MAIA never hears it/);
    expect(text).toMatch(/Nothing goes to an outside company/);
    expect(text).toMatch(/12 months or until the beta ends/);
    expect(text).toMatch(/deletes the recording and its written copy completely/);
  });
});
