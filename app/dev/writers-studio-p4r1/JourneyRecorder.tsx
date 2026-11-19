'use client';
/**
 * Answer a journey question by voice or video (Studio Academy slice 5). BUILT DARK: drawn only when the server flag is on.
 *
 * ⛔ Nothing leaves the device until the writer has played the recording back, read what happens to it, and clicked
 *    "Send this recording". Recording stops by itself at the length limit. The camera and microphone are released as soon as
 *    recording stops.
 */
import { useEffect, useRef, useState } from 'react';
import {
  RECORDING_EXPLAINER, RECORDING_MAX_SECONDS, acceptedMime, type RecordingKind,
} from '@/lib/writersStudio/journeyRecordings';
import { useJourneyRecordingsEnabled } from '@/lib/writersStudio/JourneyRecordingsContext';
import { listMyRecordings, recordingUrl, sendMyRecording, withdrawMyRecording } from '@/lib/writersStudio/journeyRecordingsClient';
import type { OwnRecording } from '@/lib/writersStudio/journeyRecordingsServer';

const REFUSAL: Record<string, string> = {
  sanctuary_not_kept: 'Sanctuary is on, so nothing was sent.',
  posture_undeclared: 'Your Sanctuary setting couldn’t be read on this device, so nothing was sent.',
  beta_ended: 'The beta has ended, so nothing more can be sent.',
  too_large: 'That recording is too long to send. Try a shorter one.',
  unsupported_recording: 'This browser recorded in a format Soullab can’t take yet.',
};

function pickMime(kind: RecordingKind): string | undefined {
  const tries = kind === 'audio' ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'] : ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  if (typeof MediaRecorder === 'undefined') return undefined;
  return tries.find((m) => MediaRecorder.isTypeSupported(m));
}

export default function JourneyRecorder({ promptKey }: { promptKey: string }) {
  const enabled = useJourneyRecordingsEnabled();
  const [mine, setMine] = useState<OwnRecording[]>([]);
  const [kind, setKind] = useState<RecordingKind | null>(null);
  const [phase, setPhase] = useState<'idle' | 'recording' | 'review' | 'sending'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [take, setTake] = useState<{ blob: Blob; url: string } | null>(null);
  const [playing, setPlaying] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  /* Every object URL made here, so all are released when the card goes away. */
  const made = useRef<string[]>([]);
  const keep = (url: string) => { made.current.push(url); return url; };

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void listMyRecordings().then((list) => { if (live) setMine(list.filter((r) => r.promptKey === promptKey)); });
    return () => { live = false; };
  }, [enabled, promptKey]);

  const release = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };
  useEffect(() => () => { release(); made.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  useEffect(() => {
    if (phase !== 'recording' || !kind) return;
    const t = window.setInterval(() => setSeconds((s) => {
      if (s + 1 >= RECORDING_MAX_SECONDS[kind]) recorder.current?.stop();
      return s + 1;
    }), 1000);
    return () => window.clearInterval(t);
  }, [phase, kind]);

  if (!enabled) return null;

  const start = async (k: RecordingKind) => {
    setStatus(null);
    const mime = pickMime(k);
    if (!mime || !navigator.mediaDevices?.getUserMedia) { setStatus('This browser can’t record here. You can still write your answer.'); return; }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia(k === 'video' ? { audio: true, video: { width: 640, height: 480 } } : { audio: true });
    } catch { setStatus('The microphone or camera wasn’t allowed, so nothing was recorded.'); return; }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream.current, { mimeType: mime, ...(k === 'video' ? { videoBitsPerSecond: 1_000_000 } : {}) });
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      release();
      const blob = new Blob(chunks, { type: acceptedMime(k, mime) ?? mime });
      setTake({ blob, url: keep(URL.createObjectURL(blob)) });
      setPhase('review');
    };
    recorder.current = rec;
    setKind(k); setSeconds(0); setPhase('recording');
    rec.start(1000);
  };

  const discard = () => { if (take) URL.revokeObjectURL(take.url); setTake(null); setPhase('idle'); setKind(null); };

  const send = async () => {
    if (!take || !kind) return;
    setPhase('sending');
    const r = await sendMyRecording({ promptKey, kind, blob: take.blob });
    if (r.ok) { setMine((list) => [...list, r.recording]); discard(); setStatus('Sent. Thank you.'); }
    else { setPhase('review'); setStatus(REFUSAL[r.refusal] ?? 'That wasn’t sent. Your recording is still here; try again.'); }
  };

  const play = async (id: string) => {
    if (playing[id]) return;
    const url = await recordingUrl(id);
    if (url) setPlaying((p) => ({ ...p, [id]: keep(url) })); else setStatus('That recording couldn’t be opened.');
  };

  return (
    <div className="p4r1-journey-recorder" data-journey-recorder={promptKey}>
      {mine.map((r) => (
        <div key={r.id} className="p4r1-journey-answer" data-journey-recording={r.id}>
          <small>Your {r.kind === 'video' ? 'video' : 'voice'} answer · {new Date(r.createdAt).toLocaleDateString()}</small>
          {playing[r.id]
            ? (r.kind === 'video' ? <video controls src={playing[r.id]} style={{ maxWidth: '100%' }} /> : <audio controls src={playing[r.id]} />)
            : <button type="button" onClick={() => void play(r.id)}>Play</button>}
          {r.transcript ? <p>Written copy: {r.transcript}</p> : <small>No written copy yet.</small>}
          <div className="p4r1-journey-actions">
            <button type="button" onClick={async () => {
              if (await withdrawMyRecording(r.id)) { setMine((list) => list.filter((x) => x.id !== r.id)); setStatus('Withdrawn. The recording and its written copy are deleted.'); }
              else setStatus('That wasn’t withdrawn. Try again.');
            }}>Withdraw</button>
          </div>
        </div>
      ))}
      {phase === 'idle' ? (
        <div className="p4r1-journey-actions">
          <button type="button" onClick={() => void start('audio')}>Answer by voice</button>
          <button type="button" onClick={() => void start('video')}>Answer by video</button>
        </div>
      ) : null}
      {phase === 'recording' && kind ? (
        <div className="p4r1-journey-actions" role="status" aria-live="polite">
          <span>Recording… {seconds}s of {RECORDING_MAX_SECONDS[kind]}s</span>
          <button type="button" className="p4r1-journey-primary" onClick={() => recorder.current?.stop()}>Stop</button>
        </div>
      ) : null}
      {(phase === 'review' || phase === 'sending') && take && kind ? (
        <div className="p4r1-journey-share" data-journey-recording-review>
          <span>Play it back first. Nothing has been sent.</span>
          {kind === 'video' ? <video controls src={take.url} style={{ maxWidth: '100%' }} /> : <audio controls src={take.url} />}
          <ul>{RECORDING_EXPLAINER.map((line) => <li key={line}>{line}</li>)}</ul>
          <div className="p4r1-journey-actions">
            <button type="button" className="p4r1-journey-primary" disabled={phase === 'sending'} onClick={() => void send()}>
              {phase === 'sending' ? 'Sending…' : 'Send this recording'}
            </button>
            <button type="button" disabled={phase === 'sending'} onClick={() => { discard(); void start(kind); }}>Record again</button>
            <button type="button" disabled={phase === 'sending'} onClick={discard}>Discard</button>
          </div>
        </div>
      ) : null}
      {status ? <p className="p4r1-journey-note" role="status">{status}</p> : null}
    </div>
  );
}
