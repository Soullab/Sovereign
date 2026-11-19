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

/** m:ss.cc — a time on the recording, never a bare number of seconds. */
export function formatTime(sec: number): string {
  const c = Math.round(Math.max(0, sec) * 100);
  const m = Math.floor(c / 6000);
  return `${m}:${((c % 6000) / 100).toFixed(2).padStart(5, '0')}`;
}

/** Reads "1:02.5", "0:01.20", "75" or "1.2" as seconds; null if it is not a time. */
export function parseTime(text: string): number | null {
  const m = /^(?:(\d+):)?(\d+(?:\.\d*)?|\.\d+)$/.exec(text.trim().replace(',', '.'));
  if (!m || (m[1] !== undefined && Number(m[2]) >= 60)) return null;
  const v = (m[1] ? Number(m[1]) * 60 : 0) + Number(m[2]);
  return Number.isFinite(v) ? v : null;
}

/** Ruler spacing: about eight labelled ticks across the recording, on round times. */
export function rulerStep(total: number): { major: number; minor: number } {
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
  const major = steps.find((x) => total / x <= 8) ?? 300;
  const minor = major / ([0.2, 2, 20, 120].includes(major) ? 4 : major === 15 ? 3 : 5);
  return { major, minor };
}

/**
 * Where a Trim or Fade step sits on the source waveform: the stretch of the
 * original it works on. Earlier trims narrow it; level and tone steps leave
 * it alone. After reverse, loop, join or reverb the step works on a
 * different timeline, so it is not marked on this waveform (null).
 */
export function stepView(steps: readonly TransformStep[], index: number, total: number): { off: number; len: number } | null {
  let off = 0, len = total;
  for (let j = 0; j < index; j++) {
    const s = steps[j];
    if (s.kind === 'trim') {
      const a = Math.min(Math.max(0, s.startSec), len), b = Math.min(Math.max(a, s.endSec), len);
      off += a; len = b - a;
    } else if (s.kind === 'reverse' || s.kind === 'loop' || s.kind === 'join' || s.kind === 'reverb') return null;
  }
  return { off, len };
}

type MarkKey = 'start' | 'end' | 'fadeIn' | 'fadeOut';
type Mark = { key: MarkKey; at: number };

function Waveform({ audio, keep, marks, fade, onMove }: {
  audio: Audio; keep: [number, number]; marks: Mark[];
  fade: { a: number; inEnd: number; outStart: number; b: number } | null;
  onMove: (key: MarkKey, at: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cache = useRef<{ audio: Audio; w: number; peaks: Float32Array; top: number } | null>(null);
  const drag = useRef<MarkKey | null>(null);
  const total = frameCount(audio) / audio.sampleRate;
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = canvas.height = Math.round(96 * dpr);
    const g = canvas.getContext('2d'); if (!g) return;
    if (!cache.current || cache.current.audio !== audio || cache.current.w !== w) {
      const peaks = new Float32Array(w); const n = frameCount(audio); let top = 0;
      for (let x = 0; x < w; x++) {
        let m = 0; const from = Math.floor((x * n) / w), to = Math.max(from + 1, Math.floor(((x + 1) * n) / w));
        for (const c of audio.channels) for (let i = from; i < Math.min(n, to); i++) { const v = Math.abs(c[i]); if (v > m) m = v; }
        peaks[x] = m; if (m > top) top = m;
      }
      cache.current = { audio, w, peaks, top };
    }
    const { peaks, top } = cache.current;
    const X = (t: number) => (t / total) * w;
    g.clearRect(0, 0, w, h);
    // Drawn to the recording's own loudest point, so a quiet take is still readable. Display only.
    const scale = top > 0 ? 0.92 / top : 1;
    for (let x = 0; x < w; x++) {
      const t = (x / w) * total;
      g.fillStyle = t >= keep[0] && t <= keep[1] ? 'rgba(212, 175, 55, 0.9)' : 'rgba(212, 175, 55, 0.22)';
      const bar = Math.max(1, peaks[x] * scale * h); g.fillRect(x, (h - bar) / 2, 1, bar);
    }
    if (fade) {
      g.fillStyle = 'rgba(7, 18, 23, 0.55)';
      g.beginPath(); g.moveTo(X(fade.a), 0); g.lineTo(X(fade.inEnd), 0); g.lineTo(X(fade.a), h); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(X(fade.outStart), 0); g.lineTo(X(fade.b), 0); g.lineTo(X(fade.b), h); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(241, 239, 231, 0.75)'; g.lineWidth = 1.5 * dpr;
      g.beginPath(); g.moveTo(X(fade.a), h); g.lineTo(X(fade.inEnd), 0); g.moveTo(X(fade.outStart), 0); g.lineTo(X(fade.b), h); g.stroke();
    }
    for (const m of marks) {
      const x = Math.round(X(m.at));
      g.fillStyle = '#f1efe7'; g.fillRect(x - dpr, 0, 2 * dpr, h);
      g.fillRect(x - 5 * dpr, 0, 10 * dpr, 8 * dpr); g.fillRect(x - 5 * dpr, h - 8 * dpr, 10 * dpr, 8 * dpr);
    }
  }, [audio, total, keep, marks, fade]);

  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.min(total, Math.max(0, ((e.clientX - r.left) / r.width) * total));
  };
  const { major, minor } = rulerStep(total);
  const ticks: { t: number; major: boolean }[] = [];
  for (let k = 0; k * minor <= total + 1e-9; k++) ticks.push({ t: k * minor, major: Math.abs((k * minor) / major - Math.round((k * minor) / major)) < 1e-6 });
  return <div className={styles.transformWaveWrap}>
    <canvas ref={ref} className={styles.transformWave} aria-hidden="true" data-transform-wave="true"
      style={{ touchAction: marks.length ? 'none' : 'auto', cursor: marks.length ? 'ew-resize' : 'default' }}
      onPointerDown={(e) => {
        if (!marks.length) return;
        const t = at(e); const px = e.currentTarget.getBoundingClientRect().width / total;
        const near = marks.reduce((b, m) => (Math.abs(m.at - t) * px < Math.abs(b.at - t) * px ? m : b));
        drag.current = near.key; e.currentTarget.setPointerCapture(e.pointerId); onMove(near.key, t);
      }}
      onPointerMove={(e) => { if (drag.current) onMove(drag.current, at(e)); }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} />
    <div className={styles.transformRuler} aria-hidden="true" data-transform-ruler="true">
      {ticks.map(({ t, major: big }) => <span key={t} className={big ? styles.transformTickMajor : styles.transformTick} style={{ left: `${(t / total) * 100}%` }}>
        {big && <em>{formatTime(t).replace(/\.00$/, '')}</em>}
      </span>)}
    </div>
  </div>;
}

function TimeField({ label, value, onChange, name }: { label: string; value: number; onChange: (v: number) => void; name: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const v = parseTime(draft);
    if (v !== null) onChange(Math.round(v * 100) / 100);
    setDraft(null);
  };
  return <label className={styles.transformField}>{label}
    <input type="text" inputMode="decimal" spellCheck={false} data-time-field={name} value={draft ?? formatTime(value)}
      onChange={(e) => setDraft(e.currentTarget.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} /></label>;
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
  const [selected, setSelected] = useState<number | null>(null);
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
      if (which === 'source') { setSource(loaded); setSteps([]); setSecond(null); setSelected(null); } else setSecond(loaded);
      setStatus(`${loaded.file.name}: ${clock(loaded.info.frames / loaded.info.sampleRate)} · ${loaded.info.sampleRate / 1000} kHz · ${loaded.info.channels === 2 ? 'stereo' : 'mono'}${loaded.info.decodedBy === 'browser' ? ' · decoded by your browser at 48 kHz' : ''}.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'This file could not be read.');
    } finally { setBusy(false); }
  };

  const update = (i: number, patch: Partial<TransformStep>) => setSteps((all) => all.map((s, j) => (j === i ? ({ ...s, ...patch } as TransformStep) : s)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d; if (j < 0 || j >= steps.length) return;
    const a = steps.slice(); [a[i], a[j]] = [a[j], a[i]]; setSteps(a);
    setSelected((k) => (k === i ? j : k === j ? i : k));
  };
  const remove = (i: number) => { setSteps((a) => a.filter((_, j) => j !== i)); setSelected((k) => (k === null || k === i ? null : k > i ? k - 1 : k)); };

  // A Trim or Fade mark moved on the waveform or typed as a time, in the original's time.
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const setMark = (i: number, key: MarkKey, t: number) => {
    const s = steps[i]; const v = stepView(steps, i, len); if (!v) return;
    const local = Math.min(v.len, Math.max(0, t - v.off));
    if (s.kind === 'trim' && key === 'start') update(i, { startSec: r2(Math.min(local, s.endSec - 0.01)) });
    if (s.kind === 'trim' && key === 'end') update(i, { endSec: r2(Math.max(local, s.startSec + 0.01)) });
    if (s.kind === 'fade' && key === 'fadeIn') update(i, { inSec: r2(Math.min(local, 60, v.len - s.outSec)) });
    if (s.kind === 'fade' && key === 'fadeOut') update(i, { outSec: r2(Math.min(v.len - local, 60, v.len - s.inSec)) });
  };
  const sel = selected !== null ? steps[selected] : undefined;
  const view = selected !== null && sel && (sel.kind === 'trim' || sel.kind === 'fade') ? stepView(steps, selected, len) : null;
  const marked = useMemo(() => {
    if (!sel || !view) return { keep: [0, len] as [number, number], marks: [] as Mark[], fade: null };
    if (sel.kind === 'trim') {
      const a = view.off + Math.min(sel.startSec, view.len), b = view.off + Math.min(sel.endSec, view.len);
      return { keep: [a, b] as [number, number], marks: [{ key: 'start', at: a }, { key: 'end', at: b }] as Mark[], fade: null };
    }
    if (sel.kind === 'fade') {
      const a = view.off, b = view.off + view.len;
      const inEnd = a + Math.min(sel.inSec, view.len), outStart = b - Math.min(sel.outSec, view.len);
      return { keep: [a, b] as [number, number], marks: [{ key: 'fadeIn', at: inEnd }, { key: 'fadeOut', at: outStart }] as Mark[], fade: { a, inEnd, outStart, b } };
    }
    return { keep: [0, len] as [number, number], marks: [] as Mark[], fade: null };
  }, [sel, view?.off, view?.len, len]);

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
        <Waveform audio={source.audio} keep={marked.keep} marks={marked.marks} fade={marked.fade}
          onMove={(key, t) => { if (selected !== null) setMark(selected, key, t); }} />
        <p className={styles.muted} data-transform-wave-hint="true">{
          sel && view ? (sel.kind === 'trim' ? 'Drag the start and end handles on the waveform, or type a time.' : 'Drag where the fade in ends and the fade out begins, or type a time.')
            : sel && (sel.kind === 'trim' || sel.kind === 'fade') ? 'This step comes after a step that changes the recording\'s length or direction, so its times are not marked on this waveform.'
              : 'Select a Trim or Fade step to mark it on the waveform.'}</p>
      </div>

      <h3 className={styles.toneHeading}>Steps, in order</h3>
      {steps.length === 0 && <p className={styles.muted}>Add a step below. Steps run top to bottom.</p>}
      <ol className={styles.transformSteps}>
        {steps.map((s, i) => { const v = s.kind === 'trim' || s.kind === 'fade' ? stepView(steps, i, len) : null; return <li key={i} data-transform-step={s.kind}
          data-selected={selected === i ? 'true' : undefined} className={selected === i ? styles.transformStepSelected : undefined}
          onClickCapture={() => setSelected(i)} onFocusCapture={() => setSelected(i)}>
          <div className={styles.transformStepHead}><strong>{LABELS[s.kind]}</strong>
            <span>
              <button type="button" className={styles.ghost} aria-label={`Move ${LABELS[s.kind]} up`} onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" className={styles.ghost} aria-label={`Move ${LABELS[s.kind]} down`} onClick={() => move(i, 1)} disabled={i === steps.length - 1}>↓</button>
              <button type="button" className={styles.ghost} aria-label={`Remove ${LABELS[s.kind]}`} onClick={(e) => { e.stopPropagation(); remove(i); }}>Remove</button>
            </span>
          </div>
          <div className={styles.transformFields}>
            {s.kind === 'trim' && (v ? <><TimeField name="trim-start" label="Starts at" value={v.off + s.startSec} onChange={(t) => setMark(i, 'start', t)} />
              <TimeField name="trim-end" label="Ends at" value={v.off + s.endSec} onChange={(t) => setMark(i, 'end', t)} /></>
              : <><TimeField name="trim-start" label="Starts at (in the changed recording)" value={s.startSec} onChange={(t) => update(i, { startSec: t })} />
                <TimeField name="trim-end" label="Ends at (in the changed recording)" value={s.endSec} onChange={(t) => update(i, { endSec: t })} /></>)}
            {s.kind === 'fade' && (v ? <><TimeField name="fade-in" label="Fade in until" value={v.off + Math.min(s.inSec, v.len)} onChange={(t) => setMark(i, 'fadeIn', t)} />
              <TimeField name="fade-out" label="Fade out from" value={v.off + v.len - Math.min(s.outSec, v.len)} onChange={(t) => setMark(i, 'fadeOut', t)} />
              <span className={styles.muted}>{s.inSec.toFixed(2)} s in · {s.outSec.toFixed(2)} s out</span></>
              : <><TimeField name="fade-in" label="Fade in lasts" value={s.inSec} onChange={(t) => update(i, { inSec: Math.min(60, t) })} />
                <TimeField name="fade-out" label="Fade out lasts" value={s.outSec} onChange={(t) => update(i, { outSec: Math.min(60, t) })} /></>)}
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
        </li>; })}
      </ol>

      <label className={styles.transformField}>Add a step
        <select value="" onChange={(e) => { const k = e.currentTarget.value as TransformStep['kind']; if (k) { setSelected(steps.length); setSteps([...steps, defaults(k, len)]); } }}>
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
