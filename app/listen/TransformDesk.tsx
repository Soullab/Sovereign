'use client';
/**
 * SOULLAB TRANSFORM T1 — the Transform desk. Owner LISTEN-01 #1979; founder
 * ruling 2026-11-17 and T1 approval (comments 6963607549, 6964484327).
 *
 * The member's OWN recording, shaped on their device, heard through the one
 * persistent player, and saved as a NEW file with provenance. The original is
 * never modified, nothing is uploaded, and Soullab/catalogue works cannot be
 * opened here (acceptMemberFile).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePersistentListening } from '@/components/listening/PersistentListeningProvider';
import { frameCount, peak, type Audio } from '@/lib/listening/transform/audio';
import { readWav, wavAudioBytes, withProvenance, writeWav24 } from '@/lib/listening/transform/wav';
import { renderRecipe } from '@/lib/listening/transform/render';
import { acceptMemberFile, buildProvenance, sha256Hex, type SideInfo } from '@/lib/listening/transform/provenance';
import { MAX_TRANSFORM_SECONDS, recipeProblem, type TransformStep } from '@/lib/listening/transform/recipe';
import { SPACES } from '@/lib/listening/transform/impulses';
import styles from './listen.module.css';

type Loaded = { file: File; audio: Audio; info: SideInfo };

const LABELS: Record<TransformStep['kind'], string> = {
  trim: 'Trim', fade: 'Fade in / out', normalize: 'Normalize', reverse: 'Reverse', loop: 'Loop',
  join: 'Join another recording', gain: 'Gain', eq: 'EQ', filter: 'High / low-pass', reverb: 'Reverb',
};

function defaults(kind: TransformStep['kind'], len: number): TransformStep {
  switch (kind) {
    case 'trim': return { kind, startSec: 0, endSec: Math.round(len * 100) / 100 };
    case 'fade': return { kind, inSec: 1, outSec: 2 };
    case 'normalize': return { kind, peakDbfs: -1 };
    case 'reverse': return { kind };
    case 'loop': return { kind, times: 2, crossfadeMs: 50 };
    case 'join': return { kind, crossfadeMs: 500 };
    case 'gain': return { kind, db: 0 };
    case 'eq': return { kind, lowDb: 0, midDb: 0, midHz: 1000, highDb: 0 };
    case 'filter': return { kind, highpassHz: 40, lowpassHz: null };
    case 'reverb': return { kind, space: 'room', mix: 0.25 };
  }
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

async function load(file: File): Promise<Loaded> {
  const bytes = await file.arrayBuffer();
  const sha = await sha256Hex(bytes);
  let audio: Audio;
  let decodedBy: SideInfo['decodedBy'] = 'soullab-wav';
  if (/\.wav$/i.test(file.name)) {
    audio = readWav(bytes);
  } else {
    // Other formats: the browser decodes (at 48 kHz); the provenance says so.
    decodedBy = 'browser';
    const ctx = new OfflineAudioContext(2, 1, 48000);
    const decoded = await ctx.decodeAudioData(bytes.slice(0));
    if (decoded.duration > MAX_TRANSFORM_SECONDS) throw new Error('This recording is longer than 20 minutes.');
    audio = { sampleRate: decoded.sampleRate, channels: Array.from({ length: Math.min(2, decoded.numberOfChannels) }, (_, i) => decoded.getChannelData(i).slice()) };
  }
  return { file, audio, info: { name: file.name, sha256: sha, sampleRate: audio.sampleRate, frames: frameCount(audio), channels: audio.channels.length, decodedBy } };
}

function Waveform({ audio }: { audio: Audio }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const w = canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
    const h = canvas.height = 96 * (window.devicePixelRatio || 1);
    const g = canvas.getContext('2d'); if (!g) return;
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(212, 175, 55, 0.85)';
    const c = audio.channels[0]; const per = Math.max(1, Math.floor(c.length / w));
    for (let x = 0; x < w; x++) {
      let m = 0; for (let i = x * per; i < Math.min(c.length, (x + 1) * per); i++) m = Math.max(m, Math.abs(c[i]));
      const bar = Math.max(1, m * h); g.fillRect(x, (h - bar) / 2, 1, bar);
    }
  }, [audio]);
  return <canvas ref={ref} className={styles.transformWave} aria-hidden="true" />;
}

function Num({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number }) {
  return <label className={styles.transformField}>{label}
    <input type="number" inputMode="decimal" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(Number(e.currentTarget.value))} /></label>;
}

export default function TransformDesk() {
  const player = usePersistentListening();
  const [source, setSource] = useState<Loaded | null>(null);
  const [second, setSecond] = useState<Loaded | null>(null);
  const [steps, setSteps] = useState<TransformStep[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [saved, setSaved] = useState<{ wav: string; json: string; original: string } | null>(null);
  const len = source ? frameCount(source.audio) / source.audio.sampleRate : 0;
  const problem = useMemo(() => (source ? recipeProblem(steps, source.audio.sampleRate / 2) : null), [steps, source]);
  const needsSecond = steps.some((s) => s.kind === 'join');

  const choose = async (input: File | null | undefined, which: 'source' | 'second') => {
    if (!input) return;
    const accepted = acceptMemberFile(input);
    if (accepted.ok === false) { setStatus(accepted.reason); return; }
    setBusy(true); setStatus('Reading your recording on this device…'); setSaved(null);
    try {
      const loaded = await load(accepted.file);
      if (which === 'source') { setSource(loaded); setSteps([]); setSecond(null); } else setSecond(loaded);
      setStatus(`${loaded.file.name}: ${clock(loaded.info.frames / loaded.info.sampleRate)} · ${loaded.info.sampleRate / 1000} kHz · ${loaded.info.channels === 2 ? 'stereo' : 'mono'}${loaded.info.decodedBy === 'browser' ? ' · decoded by your browser at 48 kHz' : ''}.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'This file could not be read.');
    } finally { setBusy(false); }
  };

  const update = (i: number, patch: Partial<TransformStep>) => setSteps((all) => all.map((s, j) => (j === i ? ({ ...s, ...patch } as TransformStep) : s)));
  const move = (i: number, d: -1 | 1) => setSteps((all) => { const a = all.slice(); const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });

  const make = async () => {
    if (!source) throw new Error('Choose a recording first.');
    if (needsSecond && !second) throw new Error('Choose the recording to join.');
    const out = await renderRecipe(source.audio, steps, { second: second?.audio, Offline: typeof OfflineAudioContext === 'undefined' ? undefined : OfflineAudioContext });
    if (peak(out) > 1) setStatus('Some samples went past full scale and were clipped. Lower the gain or add Normalize.');
    return { out, wav: writeWav24(out) };
  };
  const base = source ? source.file.name.replace(/\.[^.]+$/, '') : 'recording';

  const preview = async () => {
    if (!player) return;
    setBusy(true); setStatus('Shaping on this device…');
    try {
      const { wav } = await make();
      const result = player.selectLocalFile(new File([wav], `${base} (transformed preview).wav`, { type: 'audio/wav' }));
      if (!result.accepted) { setStatus(result.message); return; }
      await player.playLocalFile();
      setStatus('Playing the transformed version in the player. Nothing has been saved yet.');
    } catch (e) { setStatus(e instanceof Error ? e.message : 'This could not be rendered.'); } finally { setBusy(false); }
  };

  const save = async () => {
    if (!source) return;
    setBusy(true); setStatus('Making a new file on this device…');
    try {
      const { out, wav } = await make();
      const name = `${base} (transformed).wav`;
      const audioSha256 = await sha256Hex(wavAudioBytes(wav));
      const createdAt = new Date().toISOString();
      const record = (fileSha?: string) => buildProvenance({
        source: source.info, second: second?.info, steps,
        output: { name, audioSha256, ...(fileSha ? { sha256: fileSha } : {}), sampleRate: out.sampleRate, frames: frameCount(out), channels: out.channels.length },
        createdAt,
      });
      // The record travels inside the WAV, so it survives if the second download is blocked.
      const finished = withProvenance(wav, JSON.stringify(record()));
      const provenance = record(await sha256Hex(finished));
      const download = (blob: Blob, fileName: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      };
      download(new Blob([finished], { type: 'audio/wav' }), name);
      download(new Blob([JSON.stringify(provenance, null, 2)], { type: 'application/json' }), `${base} (transformed).provenance.json`);
      // Re-read the original and prove it is unchanged.
      const again = await sha256Hex(await source.file.arrayBuffer());
      setSaved({ wav: name, json: `${base} (transformed).provenance.json`, original: again === source.info.sha256 ? 'unchanged' : 'CHANGED' });
      setStatus('Saved as a new file in your downloads. Its provenance is inside the file and beside it.');
    } catch (e) { setStatus(e instanceof Error ? e.message : 'This could not be saved.'); } finally { setBusy(false); }
  };

  return <section className={styles.panel} aria-labelledby="transform-title" data-transform-desk="true">
    <span className={styles.smallcaps}>TRANSFORM · YOUR OWN RECORDINGS · ON THIS DEVICE</span>
    <h2 id="transform-title">Shape a recording</h2>
    <p className={styles.muted}>Open a recording of your own — a Soullab Capture take or a file you have. Trim it, fade it, shape its tone, add a space. You hear it in the player, and it is saved as a new file. Your original is never changed and nothing is uploaded. Soullab and catalogue recordings cannot be opened here.</p>

    <label className={styles.fileLabel} htmlFor="transform-file">Choose a recording
      <input id="transform-file" type="file" accept=".wav,.flac,.mp3,.m4a,.aac,.ogg,.opus,audio/*" disabled={busy}
        onChange={(e) => { void choose(e.currentTarget.files?.[0], 'source'); e.currentTarget.value = ''; }} />
    </label>

    {source && <>
      <div className={styles.localAudioCard}>
        <strong>{source.file.name}</strong>
        <p className={styles.muted}>{clock(len)} · {source.info.sampleRate / 1000} kHz · {source.info.channels === 2 ? 'stereo' : 'mono'} · up to 20 minutes</p>
        <Waveform audio={source.audio} />
      </div>

      <h3 className={styles.toneHeading}>Steps, in order</h3>
      {steps.length === 0 && <p className={styles.muted}>Add a step below. Steps run top to bottom.</p>}
      <ol className={styles.transformSteps}>
        {steps.map((s, i) => <li key={i} data-transform-step={s.kind}>
          <div className={styles.transformStepHead}><strong>{LABELS[s.kind]}</strong>
            <span>
              <button type="button" className={styles.ghost} aria-label={`Move ${LABELS[s.kind]} up`} onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" className={styles.ghost} aria-label={`Move ${LABELS[s.kind]} down`} onClick={() => move(i, 1)} disabled={i === steps.length - 1}>↓</button>
              <button type="button" className={styles.ghost} aria-label={`Remove ${LABELS[s.kind]}`} onClick={() => setSteps((a) => a.filter((_, j) => j !== i))}>Remove</button>
            </span>
          </div>
          <div className={styles.transformFields}>
            {s.kind === 'trim' && <><Num label="Start (s)" value={s.startSec} min={0} max={len} step={0.01} onChange={(v) => update(i, { startSec: v })} />
              <Num label="End (s)" value={s.endSec} min={0} max={len} step={0.01} onChange={(v) => update(i, { endSec: v })} /></>}
            {s.kind === 'fade' && <><Num label="Fade in (s)" value={s.inSec} min={0} max={60} step={0.1} onChange={(v) => update(i, { inSec: v })} />
              <Num label="Fade out (s)" value={s.outSec} min={0} max={60} step={0.1} onChange={(v) => update(i, { outSec: v })} /></>}
            {s.kind === 'normalize' && <Num label="Peak (dBFS, at most −1)" value={s.peakDbfs} min={-30} max={-1} step={0.5} onChange={(v) => update(i, { peakDbfs: v })} />}
            {s.kind === 'loop' && <><Num label="Times" value={s.times} min={2} max={64} step={1} onChange={(v) => update(i, { times: v })} />
              <Num label="Crossfade (ms)" value={s.crossfadeMs} min={0} max={2000} step={10} onChange={(v) => update(i, { crossfadeMs: v })} /></>}
            {s.kind === 'join' && <><Num label="Crossfade (ms)" value={s.crossfadeMs} min={0} max={5000} step={50} onChange={(v) => update(i, { crossfadeMs: v })} />
              <label className={styles.fileLabel} htmlFor="transform-second">{second ? `Joining ${second.file.name}` : 'Choose the recording to join'}
                <input id="transform-second" type="file" accept=".wav,.flac,.mp3,.m4a,.aac,.ogg,.opus,audio/*" disabled={busy}
                  onChange={(e) => { void choose(e.currentTarget.files?.[0], 'second'); e.currentTarget.value = ''; }} /></label></>}
            {s.kind === 'gain' && <Num label="Gain (dB)" value={s.db} min={-40} max={24} step={0.5} onChange={(v) => update(i, { db: v })} />}
            {s.kind === 'eq' && <><Num label="Low (dB)" value={s.lowDb} min={-18} max={18} step={0.5} onChange={(v) => update(i, { lowDb: v })} />
              <Num label="Middle (dB)" value={s.midDb} min={-18} max={18} step={0.5} onChange={(v) => update(i, { midDb: v })} />
              <Num label="Middle at (Hz)" value={s.midHz} min={100} max={10000} step={10} onChange={(v) => update(i, { midHz: v })} />
              <Num label="High (dB)" value={s.highDb} min={-18} max={18} step={0.5} onChange={(v) => update(i, { highDb: v })} /></>}
            {s.kind === 'filter' && <><Num label="High-pass (Hz, 0 = off)" value={s.highpassHz ?? 0} min={0} max={20000} step={10} onChange={(v) => update(i, { highpassHz: v > 0 ? v : null })} />
              <Num label="Low-pass (Hz, 0 = off)" value={s.lowpassHz ?? 0} min={0} max={20000} step={10} onChange={(v) => update(i, { lowpassHz: v > 0 ? v : null })} /></>}
            {s.kind === 'reverb' && <><label className={styles.transformField}>Space
                <select value={s.space} onChange={(e) => update(i, { space: e.currentTarget.value as 'room' | 'chamber' | 'hall' })}>
                  {Object.entries(SPACES).map(([id, sp]) => <option key={id} value={id}>{sp.label} ({sp.rt60} s)</option>)}
                </select></label>
              <Num label="Mix (0–1)" value={s.mix} min={0} max={1} step={0.05} onChange={(v) => update(i, { mix: v })} /></>}
            {s.kind === 'reverse' && <span className={styles.muted}>Plays the recording backwards.</span>}
          </div>
        </li>)}
      </ol>

      <label className={styles.transformField}>Add a step
        <select value="" onChange={(e) => { const k = e.currentTarget.value as TransformStep['kind']; if (k) setSteps((a) => [...a, defaults(k, len)]); }}>
          <option value="">Choose…</option>
          {(Object.keys(LABELS) as TransformStep['kind'][]).map((k) => <option key={k} value={k}>{LABELS[k]}</option>)}
        </select>
      </label>
      {problem && steps.length > 0 && <p className={styles.focusStatus} role="alert">{problem}</p>}

      <div className={styles.transformActions}>
        <button type="button" className={styles.play} onClick={() => void preview()} disabled={busy || !!problem || !player || (needsSecond && !second)}>Preview in the player</button>
        <button type="button" className={styles.ghost} onClick={() => void save()} disabled={busy || !!problem || (needsSecond && !second)}>Save as new</button>
      </div>
      {saved && <p className={styles.toneProvenance} data-transform-saved="true">
        Saved <strong>{saved.wav}</strong> and <strong>{saved.json}</strong>. The same record is also inside the WAV. Your original was re-read after saving: <strong>{saved.original}</strong>.
      </p>}
    </>}
    {status && <p className={styles.focusStatus} role="status" aria-live="polite">{status}</p>}
  </section>;
}
