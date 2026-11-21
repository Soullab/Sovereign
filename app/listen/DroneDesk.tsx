'use client';
/**
 * SOULLAB TRANSFORM T2 (R2, step A) — the Drone desk, in Sound Studio → Lab beside Tone Lab.
 * Owner LISTEN-01 #1979. Founder approval 2026-11-21 ("Approve T2 R2").
 *
 * The member's OWN recording becomes a sustained drone through the Voice to Drone Lab v0.3.4
 * engine (copied verbatim; the founder accepted its sound). Heard through the one persistent
 * player, saved as a NEW file with provenance. The original is never modified, nothing is
 * uploaded, and Soullab/catalogue works cannot be opened here (acceptMemberFile).
 * Every control is one the lab already had; Resonance & Detail (step B) is not here yet.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePersistentListening } from '@/components/listening/PersistentListeningProvider';
import { frameCount, type Audio } from '@/lib/listening/transform/audio';
import { readWav, wavAudioBytes, withProvenance } from '@/lib/listening/transform/wav';
import { acceptMemberFile, sha256Hex, type SideInfo } from '@/lib/listening/transform/provenance';
import { validateLocalAudio } from '@/lib/listening/localAudio';
import { checkCaptureSidecar, describeCaptureOrigin, describeCaptureSidecar, readCaptureOrigin, type CaptureOrigin } from '@/lib/listening/transform/captureTake';
import * as engine from '@/lib/listening/drone/engine.js';
import type { Ambience, DroneSettings, FieldElement, FieldPath, LayerMix, PresetId, RenderResult } from '@/lib/listening/drone/engine';
import {
  DRONE_SECONDS, buildDroneProvenance, defaultSettings, droneAmbience, droneRecipe, droneSource,
  parseDroneRecipe, renderDrone, settingsProblem, withPreset,
} from '@/lib/listening/drone/drone';
import {
  ANSWER_SAYS, NEUTRAL_DETAIL, SPECTRUM_RANGE, analyseDetail, answerReading, bandOnly, completeDetail, excerptLoop,
  harmonics, isNeutralDetail, matchLoudness, spectrum, toWavBlob, type Answer, type Detail,
} from '@/lib/listening/drone/detail';
import styles from './listen.module.css';

type Loaded = { file: File; audio: Audio; info: SideInfo };
const MAX_SECONDS = 20 * 60;

async function load(file: File): Promise<Loaded> {
  const bytes = await file.arrayBuffer();
  const sha = await sha256Hex(bytes);
  let audio: Audio; let decodedBy: SideInfo['decodedBy'] = 'soullab-wav';
  // J4b-2: a Soullab Capture take's own claim travels into the drone's provenance, as in Transform.
  let capture: CaptureOrigin | null = null;
  if (/\.wav$/i.test(file.name)) { audio = readWav(bytes); capture = readCaptureOrigin(bytes); }
  else {
    decodedBy = 'browser';
    const ctx = new OfflineAudioContext(2, 1, 48000);
    const d = await ctx.decodeAudioData(bytes.slice(0));
    audio = { sampleRate: d.sampleRate, channels: Array.from({ length: Math.min(2, d.numberOfChannels) }, (_, i) => d.getChannelData(i).slice()) };
  }
  if (frameCount(audio) / audio.sampleRate > MAX_SECONDS) throw new Error('This recording is longer than 20 minutes.');
  return { file, audio, info: { name: file.name, sha256: sha, sampleRate: audio.sampleRate, frames: frameCount(audio), channels: audio.channels.length, decodedBy, ...(capture ? { capture } : {}) } };
}

const clock = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
const PRESETS: PresetId[] = ['living', 'earth', 'aether'];

function Slider({ label, value, min, max, step, onChange, show, hint }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; show?: (v: number) => string; hint?: string;
}) {
  return <label className={styles.transformField} data-drone-control={label}>
    <span>{label} <strong>{show ? show(value) : value}</strong></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.currentTarget.value))} />
    {hint && <span className={styles.muted}>{hint}</span>}
  </label>;
}

/**
 * A waveform with the chosen passage. Click and drag to mark a passage. `view` zooms to a stretch of time
 * (step B: "enter the sound"); `marks` are moments the Detail meter found.
 */
function Wave({ audio, region, playhead, onRegion, view, marks }: {
  audio: Audio; region: [number, number] | null; playhead?: number; onRegion?: (a: number, b: number) => void;
  view?: [number, number] | null; marks?: { at: number; kind: 'click' | 'flutter' }[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const start = useRef<number | null>(null);
  const total = frameCount(audio) / audio.sampleRate;
  const v0 = view ? Math.max(0, view[0]) : 0, v1 = view ? Math.min(total, view[1]) : total, span = Math.max(1e-3, v1 - v0);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1; const w = c.width = Math.max(1, Math.round(c.clientWidth * dpr)); const h = c.height = Math.round(80 * dpr);
    const g = c.getContext('2d'); if (!g) return;
    const n = frameCount(audio), sr = audio.sampleRate, peaks = new Float32Array(w); let top = 0;
    for (let x = 0; x < w; x++) {
      let m = 0; const a = Math.floor((v0 + (x / w) * span) * sr), b = Math.max(a + 1, Math.floor((v0 + ((x + 1) / w) * span) * sr));
      for (const ch of audio.channels) for (let i = a; i < Math.min(n, b); i++) { const v = Math.abs(ch[i]); if (v > m) m = v; }
      peaks[x] = m; if (m > top) top = m;
    }
    const scale = top > 0 ? 0.92 / top : 1; g.clearRect(0, 0, w, h);
    const X = (t: number) => Math.round(((t - v0) / span) * w);
    for (let x = 0; x < w; x++) {
      const t = v0 + (x / w) * span; const on = !region || (t >= region[0] && t <= region[1]);
      g.fillStyle = on ? 'rgba(212, 175, 55, 0.9)' : 'rgba(212, 175, 55, 0.22)';
      const bar = Math.max(1, peaks[x] * scale * h); g.fillRect(x, (h - bar) / 2, 1, bar);
    }
    for (const mk of marks ?? []) if (mk.at >= v0 && mk.at <= v1) { g.fillStyle = mk.kind === 'click' ? 'rgba(233, 140, 120, 0.95)' : 'rgba(170, 160, 230, 0.9)'; g.fillRect(X(mk.at) - dpr, 0, 2 * dpr, 10 * dpr); }
    if (playhead !== undefined && playhead >= v0 && playhead <= v1) { g.fillStyle = 'rgba(127, 209, 200, 0.95)'; g.fillRect(X(playhead) - dpr, 0, 2 * dpr, h); }
  }, [audio, v0, span, v1, region, playhead, marks]);
  const at = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return Math.round(Math.min(total, Math.max(0, v0 + ((e.clientX - r.left) / r.width) * span)) * 100) / 100; };
  return <canvas ref={ref} className={styles.transformWave} aria-hidden="true" data-drone-wave="true"
    style={{ touchAction: onRegion ? 'none' : 'auto', cursor: onRegion ? 'crosshair' : 'default' }}
    onPointerDown={(e) => { if (!onRegion) return; start.current = at(e); e.currentTarget.setPointerCapture(e.pointerId); }}
    onPointerMove={(e) => { if (onRegion && start.current !== null) { const t = at(e); onRegion(Math.min(start.current, t), Math.max(start.current, t)); } }}
    onPointerUp={() => { start.current = null; }} onPointerCancel={() => { start.current = null; }} />;
}

/** The drone's average spectrum on a log-frequency axis, its harmonics marked; a click places the resonance band. */
function Spectrum({ spec, harmonicsHz, band, onPick }: { spec: { hz: number[]; db: number[] }; harmonicsHz: number[]; band: { on: boolean; hz: number; q: number }; onPick: (hz: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { lo, hi } = SPECTRUM_RANGE; const fx = (hz: number) => Math.log(hz / lo) / Math.log(hi / lo);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1; const w = c.width = Math.max(1, Math.round(c.clientWidth * dpr)); const h = c.height = Math.round(110 * dpr);
    const g = c.getContext('2d'); if (!g) return; g.clearRect(0, 0, w, h);
    if (band.on) { const half = 1 / (2 * band.q); g.fillStyle = 'rgba(127, 209, 200, 0.16)'; const a = fx(band.hz * 2 ** -half) * w, b = fx(band.hz * 2 ** half) * w; g.fillRect(a, 0, Math.max(2, b - a), h); }
    g.fillStyle = 'rgba(241, 239, 231, 0.28)';
    for (const f of harmonicsHz) g.fillRect(fx(f) * w - dpr / 2, 0, dpr, h);
    const top = Math.max(...spec.db), floor = top - 60;
    g.strokeStyle = 'rgba(212, 175, 55, 0.95)'; g.lineWidth = 1.5 * dpr; g.beginPath();
    spec.hz.forEach((f, i) => { const x = fx(f) * w, y = h - Math.max(0, (spec.db[i] - floor) / 60) * (h - 4); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.stroke();
  }, [spec, harmonicsHz, band.on, band.hz, band.q]);
  return <canvas ref={ref} className={styles.transformWave} data-drone-spectrum="true" role="img" aria-label="Spectrum of the drone; click to place the resonance band" style={{ height: 110, cursor: 'crosshair' }}
    onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const t = (e.clientX - r.left) / r.width; onPick(Math.round(lo * Math.pow(hi / lo, Math.min(1, Math.max(0, t))))); }} />;
}

export default function DroneDesk() {
  const player = usePersistentListening();
  const playerRef = useRef(player); playerRef.current = player;
  const [source, setSource] = useState<Loaded | null>(null);
  const [amb, setAmb] = useState<{ loaded: Loaded; ambience: Ambience } | null>(null);
  const [s, setS] = useState<DroneSettings>(() => defaultSettings('living'));
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [status, setStatus] = useState('');
  const [made, setMade] = useState<{ r: RenderResult; key: string } | null>(null);
  const [handed, setHanded] = useState<{ which: 'original' | 'drone' | 'detail'; title: string } | null>(null);
  const [noteHz, setNoteHz] = useState<number | null>(null);
  const [zoom, setZoom] = useState(false);
  const [kept, setKept] = useState<Record<string, true>>({});
  const [baseline, setBaseline] = useState<{ key: string; r: RenderResult } | null>(null);
  const [pos, setPos] = useState<{ seconds: number; playing: boolean } | null>(null);
  const [saved, setSaved] = useState<{ wav: string; json: string; original: string } | null>(null);
  const [pitchRead, setPitchRead] = useState<string | null>(null);

  useEffect(() => {
    if (!handed) { setPos(null); return; }
    let raf = 0;
    const tick = () => {
      const p = playerRef.current?.localFilePosition?.() ?? null;
      const next = p && p.title === handed.title ? { seconds: p.seconds, playing: p.playing } : null;
      setPos((o) => (o?.seconds === next?.seconds && o?.playing === next?.playing ? o : next));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [handed]);

  const key = JSON.stringify([s, source?.info.sha256, amb?.loaded.info.sha256]);
  const current = made && made.key === key ? made.r : null;
  /** The last drone made stays on screen while settings move, marked out of date until it is made again. */
  const shown = made?.r ?? null, stale = !!made && made.key !== key;
  const len = source ? frameCount(source.audio) / source.audio.sampleRate : 0;
  const problem = source ? settingsProblem(s, len) : null;
  const needsAmb = !!s.field?.[3]?.enabled && !amb;
  const titleOf = (f: File) => { const v = validateLocalAudio(f); return v.allowed ? v.name : f.name; };
  const set = (patch: Partial<DroneSettings>) => { setS((o) => ({ ...o, ...patch })); setSaved(null); };
  const setLayer = (i: number, patch: Partial<LayerMix>) => set({ layerMix: s.layerMix.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const field = s.field ?? engine.defaultField();
  const setField = (i: number, patch: Partial<FieldElement>) => set({ field: field.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
  const clean = engine.completeClean(s.clean), level = engine.completeLevel(s.level), tune = engine.completeTune(s.tune);
  const base = source ? source.file.name.replace(/\.[^.]+$/, '') : 'recording';
  const P = engine.presets[s.preset];

  const choose = async (input: File | null | undefined, which: 'source' | 'ambience') => {
    if (!input) return;
    const ok = acceptMemberFile(input);
    if (ok.ok === false) { setStatus(ok.reason); return; }
    setBusy(true); setStatus('Reading your recording on this device…');
    try {
      const loaded = await load(ok.file);
      if (which === 'source') {
        droneSource(loaded.audio, loaded.file.name); // refuses a recording shorter than the engine needs
        const t = frameCount(loaded.audio) / loaded.audio.sampleRate;
        setSource(loaded); setMade(null); setSaved(null); setHanded(null); setPitchRead(null);
        set({ region: { startSeconds: 0, endSeconds: Math.round(Math.min(t, 3) * 100) / 100 } });
        setStatus(`${loaded.file.name}: ${clock(t)}. Mark a steady passage on the waveform, then make a drone.`);
      } else {
        setAmb({ loaded, ambience: droneAmbience(loaded.audio, loaded.file.name) });
        setField(3, { enabled: true });
        setStatus(`Ambience: ${loaded.file.name}. It plays as its own element in the field.`);
      }
    } catch (e) { setStatus(e instanceof Error ? e.message : 'This file could not be read.'); } finally { setBusy(false); }
  };

  // J4b-2: the member may also hand over the take's .provenance.json; it is compared, never fetched.
  const chooseSidecar = async (input: File | null | undefined) => {
    if (!input || !source?.info.capture) return;
    try {
      const capture = checkCaptureSidecar(source.info.capture, source.info.sha256, await input.text());
      setSource({ ...source, info: { ...source.info, capture } }); setSaved(null);
      setStatus(describeCaptureSidecar(capture));
    } catch (e) { setStatus(e instanceof Error ? e.message : 'This file could not be read.'); }
  };

  const make = async (): Promise<RenderResult> => {
    if (!source) throw new Error('Choose a recording first.');
    if (current) return current;
    const r = await renderDrone(droneSource(source.audio, source.file.name), s, amb?.ambience ?? null, (_f, label) => setProgress(label));
    setMade({ r, key }); setProgress('');
    return r;
  };

  const preview = async () => {
    if (!player) return;
    setBusy(true); setStatus('Making the drone on this device…');
    try {
      const r = await make();
      const file = new File([r.blob], `${base} (drone preview).wav`, { type: 'audio/wav' });
      const picked = player.selectLocalFile(file);
      if (!picked.accepted) { setStatus(picked.message); return; }
      setHanded({ which: 'drone', title: titleOf(file) });
      await player.playLocalFile();
      setStatus('Playing the drone in the player. Nothing has been saved yet.');
    } catch (e) { setStatus(e instanceof Error ? e.message : 'The drone could not be made.'); } finally { setBusy(false); setProgress(''); }
  };

  const originalPlaying = handed?.which === 'original' && !!pos?.playing;
  const playOriginal = async () => {
    if (!player || !source) return;
    if (originalPlaying) { player.pause(); return; }
    if (!(handed?.which === 'original' && pos)) {
      const picked = player.selectLocalFile(source.file);
      if (!picked.accepted) { setStatus(picked.message); return; }
      setHanded({ which: 'original', title: titleOf(source.file) });
    }
    if (await player.playLocalFile()) setStatus('Playing your original in the player.');
  };

  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const save = async () => {
    if (!source) return;
    setBusy(true); setStatus('Making a new file on this device…');
    try {
      const r = await make();
      const src = droneSource(source.audio, source.file.name);
      const wav = await r.blob.arrayBuffer();
      const name = `${base} (drone).wav`, json = `${base} (drone).provenance.json`;
      const audioSha256 = await sha256Hex(wavAudioBytes(wav));
      const createdAt = new Date().toISOString();
      const recipe = JSON.parse(JSON.stringify(droneRecipe(r, src, amb?.ambience ?? null)));
      const record = (fileSha?: string) => buildDroneProvenance({
        source: source.info, ambience: amb?.loaded.info, recipe,
        output: { name, audioSha256, ...(fileSha ? { sha256: fileSha } : {}), sampleRate: r.rate, frames: r.frames, channels: 2 }, createdAt,
      });
      const finished = withProvenance(wav, JSON.stringify(record()));
      download(new Blob([finished], { type: 'audio/wav' }), name);
      download(new Blob([JSON.stringify(record(await sha256Hex(finished)), null, 2)], { type: 'application/json' }), json);
      const again = await sha256Hex(await source.file.arrayBuffer());
      setSaved({ wav: name, json, original: again === source.info.sha256 ? 'unchanged' : 'CHANGED' });
      setStatus('Saved as a new file in your downloads. Its recipe and provenance are inside the file and beside it.');
    } catch (e) { setStatus(e instanceof Error ? e.message : 'This could not be saved.'); } finally { setBusy(false); setProgress(''); }
  };

  const saveRecipe = async () => {
    if (!source) return;
    try {
      const r = await make();
      const recipe = droneRecipe(r, droneSource(source.audio, source.file.name), amb?.ambience ?? null);
      download(new Blob([JSON.stringify(recipe, null, 2)], { type: 'application/json' }), `${base} (drone recipe).json`);
      setStatus('Recipe saved. Load it later, with this or another recording, to make the same drone again.');
    } catch (e) { setStatus(e instanceof Error ? e.message : 'The recipe could not be saved.'); }
  };

  const loadRecipe = async (f: File | null | undefined) => {
    if (!f) return;
    const parsed = parseDroneRecipe(await f.text());
    if (parsed.ok === false) { setStatus(parsed.reason); return; }
    setS(parsed.settings); setSaved(null);
    setStatus(`Recipe loaded: ${engine.presets[parsed.settings.preset].label}.${parsed.settings.region ? ' Its passage times are kept; check they fit this recording.' : ''}`);
  };

  const readPitch = () => {
    if (!source) return;
    const src = droneSource(source.audio, source.file.name);
    const r = s.region; const a = r ? Math.round(Math.min(r.startSeconds, r.endSeconds) * src.rate) : 0, b = r ? Math.round(Math.max(r.startSeconds, r.endSeconds) * src.rate) : src.data.length;
    const p = engine.detectPitch(src.data.subarray(a, b), src.rate);
    if (!p.hz || p.confidence < 0.5) { setPitchRead('No steady note found in this passage.'); setNoteHz(null); return; }
    setNoteHz(p.hz);
    const ni = engine.noteInfo(p.hz * 2 ** (s.pitch / 12), tune.aRef);
    setPitchRead(`${p.hz.toFixed(1)} Hz in the passage → ${ni.name} ${ni.cents >= 0 ? '+' : '−'}${Math.abs(ni.cents)} ¢ after pitch, at A=${tune.aRef}`);
    return p.hz;
  };
  const snap = () => { const hz = readPitch(); if (hz) set({ tune: { ...tune, cents: engine.snapCents(hz, s.pitch, tune.aRef) } }); };

  // ---------- Step B: Resonance & Detail ----------
  const dv = completeDetail(s.detail);
  const setDetail = (patch: Partial<Detail>) => set({ detail: { ...dv, ...patch } });
  const setBand = (patch: Partial<Detail['band']>) => setDetail({ band: { ...dv.band, ...patch } });
  const neutral = isNeutralDetail(s.detail);
  const report = useMemo(() => (shown ? analyseDetail(shown.left, shown.right, shown.rate, s.loop) : null), [shown, s.loop]);
  const spec = useMemo(() => (shown ? spectrum(shown.left, shown.right, shown.rate) : null), [shown]);
  const harmHz = useMemo(() => (noteHz ? harmonics(noteHz * 2 ** ((s.pitch + tune.cents / 100) / 12)) : []), [noteHz, s.pitch, tune.cents]);

  /** Any listening buffer goes to the ONE player as a WAV, like every preview. */
  const playBuffer = async (L: Float32Array, R: Float32Array, sr: number, label: string, says: string) => {
    if (!player) return;
    const file = new File([toWavBlob(L, R, sr)], `${base} (${label}).wav`, { type: 'audio/wav' });
    const picked = player.selectLocalFile(file);
    if (!picked.accepted) { setStatus(picked.message); return; }
    setHanded({ which: 'detail', title: titleOf(file) });
    await player.playLocalFile(); setStatus(says);
  };
  const listenAt = async (at: number) => {
    if (!shown) return;
    const ex = excerptLoop(shown.left, shown.right, shown.rate, at);
    await playBuffer(ex.left, ex.right, shown.rate, `drone at ${clock(at)}`, `Playing two seconds around ${clock(at)}, three times. Listen, then choose.`);
  };
  const hearBand = async () => {
    if (!shown) return;
    const b = bandOnly(shown.left, shown.right, shown.rate, dv.band.hz, dv.band.q);
    await playBuffer(b.left, b.right, shown.rate, `band ${dv.band.hz} Hz`, `Playing only the band around ${dv.band.hz} Hz, so you can hear what it carries. This is never saved.`);
  };
  const compare = async (which: 'original' | 'accepted' | 'yours') => {
    if (!source) return;
    setBusy(true);
    try {
      const r = await make(); const target = r.loudnessLufs ?? -14;
      if (which === 'yours') { const m = matchLoudness(r.left, r.right, r.rate, target); await playBuffer(m.left, m.right, r.rate, 'compare · your settings', `Your settings, at ${target.toFixed(1)} LUFS.`); return; }
      if (which === 'accepted') {
        const k = JSON.stringify([{ ...s, detail: null }, source.info.sha256, amb?.loaded.info.sha256]);
        let b = baseline && baseline.key === k ? baseline.r : null;
        if (!b) { setStatus('Making the v0.3.4 version for comparison…'); b = neutral ? r : await renderDrone(droneSource(source.audio, source.file.name), { ...s, detail: null }, amb?.ambience ?? null); setBaseline({ key: k, r: b }); }
        const m = matchLoudness(b.left, b.right, b.rate, target);
        await playBuffer(m.left, m.right, b.rate, 'compare · v0.3.4', `The accepted v0.3.4 sound with your other settings, matched to ${target.toFixed(1)} LUFS.`); return;
      }
      const src = droneSource(source.audio, source.file.name), sr = src.rate, n = src.data.length;
      const take = s.region ? [Math.round(Math.min(s.region.startSeconds, s.region.endSeconds) * sr), Math.round(Math.max(s.region.startSeconds, s.region.endSeconds) * sr)]
        : (() => { const t = Math.min(n, Math.floor(sr * 9)), a = Math.floor((n - t) * (s.anchor / 100)); return [a, a + t]; })();
      const seg = src.data.slice(take[0], take[1]); const m = matchLoudness(seg, seg, sr, target);
      await playBuffer(m.left, m.right, sr, 'compare · original passage', `Your original passage, matched to ${target.toFixed(1)} LUFS.`);
    } catch (e) { setStatus(e instanceof Error ? e.message : 'The comparison could not be made.'); } finally { setBusy(false); }
  };
  const answer = (kind: 'click' | 'flutter' | 'beat', id: string, a: Answer) => {
    if (a === 'keep') { setKept((k) => ({ ...k, [id]: true })); setStatus('Kept as it is. Nothing changed.'); return; }
    set(answerReading(kind, a, { stillness: s.stillness, movement: s.movement, clean }) as Partial<DroneSettings>);
    setStatus(`${ANSWER_SAYS[kind][a]}. Make the drone again to hear it.`);
  };

  return <section className={styles.panel} aria-labelledby="drone-title" data-drone-desk="true">
    <span className={styles.smallcaps}>LAB · DRONE · YOUR OWN RECORDINGS · ON THIS DEVICE</span>
    <h2 id="drone-title">Make a drone</h2>
    <p className={styles.muted}>Open a recording of your own — a voice, an instrument, a place. Mark a steady passage and it becomes a sustained, living drone, with three voices you can tune, place and bring in slowly. You hear it in the player and it is saved as a new file. Your original is never changed and nothing is uploaded. Soullab and catalogue recordings cannot be opened here.</p>

    <label className={styles.fileLabel} htmlFor="drone-file">Choose a recording
      <input id="drone-file" type="file" accept=".wav,.flac,.mp3,.m4a,.aac,.ogg,.opus,audio/*" disabled={busy}
        onChange={(e) => { void choose(e.currentTarget.files?.[0], 'source'); e.currentTarget.value = ''; }} />
    </label>
    <label className={styles.fileLabel} htmlFor="drone-recipe">Load a recipe
      <input id="drone-recipe" type="file" accept=".json,application/json" disabled={busy}
        onChange={(e) => { void loadRecipe(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} />
    </label>

    {source && <>
      <div className={styles.localAudioCard}>
        <strong>{source.file.name}</strong>
        <p className={styles.muted}>{clock(len)} · {source.info.sampleRate / 1000} kHz · {source.info.channels === 2 ? 'stereo, folded to one voice for the drone' : 'mono'}</p>
        {source.info.capture && <>
          <p className={styles.muted} data-capture-origin>{describeCaptureOrigin(source.info.capture)} A drone you save records where it came from.</p>
          {source.info.capture.asserted === 'by-file'
            ? <label className={styles.fileLabel} htmlFor="drone-capture-sidecar">Check it against its Capture provenance file (optional)
                <input id="drone-capture-sidecar" type="file" accept=".json,application/json" disabled={busy}
                  onChange={(e) => { void chooseSidecar(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} />
              </label>
            : <p className={styles.muted} data-capture-sidecar={source.info.capture.asserted}>{describeCaptureSidecar(source.info.capture)}</p>}
        </>}
        <Wave audio={source.audio} region={s.region ? [s.region.startSeconds, s.region.endSeconds] : null}
          playhead={handed?.which === 'original' && pos ? pos.seconds : undefined}
          view={zoom && s.region ? [Math.min(s.region.startSeconds, s.region.endSeconds) - 0.5, Math.max(s.region.startSeconds, s.region.endSeconds) + 0.5] : null}
          onRegion={(a, b) => set({ region: { startSeconds: a, endSeconds: b } })} />
        {s.region && <button type="button" className={styles.ghost} aria-pressed={zoom} data-drone-zoom="true" onClick={() => setZoom((z) => !z)}>{zoom ? 'Show the whole recording' : 'Zoom into the passage'}</button>}
        <div className={styles.transformFields}>
          {s.region ? <>
            <Slider label="Passage starts" value={s.region.startSeconds} min={0} max={len} step={0.01} show={clock} onChange={(v) => set({ region: { startSeconds: v, endSeconds: Math.max(v, s.region!.endSeconds) } })} />
            <Slider label="Passage ends" value={s.region.endSeconds} min={0} max={len} step={0.01} show={clock} onChange={(v) => set({ region: { startSeconds: Math.min(v, s.region!.startSeconds), endSeconds: v } })} />
            <button type="button" className={styles.ghost} onClick={() => set({ region: null })}>Use a 9-second window instead</button>
          </> : <>
            <Slider label="Window position" value={s.anchor} min={0} max={100} step={1} show={(v) => `${v}%`} onChange={(v) => set({ anchor: v })} hint="Where in the recording the 9-second window sits." />
            <button type="button" className={styles.ghost} onClick={() => set({ region: { startSeconds: 0, endSeconds: Math.round(Math.min(len, 3) * 100) / 100 } })}>Mark a passage instead</button>
          </>}
        </div>
        <div className={styles.transformActions}>
          <button type="button" className={styles.ghost} onClick={() => void playOriginal()} disabled={busy || !player}>{originalPlaying ? 'Pause the original' : 'Play the original'}</button>
        </div>
      </div>

      <h3 className={styles.toneHeading}>Character</h3>
      <div className={styles.transformActions} role="group" aria-label="Preset">
        {PRESETS.map((p) => <button key={p} type="button" className={s.preset === p ? styles.play : styles.ghost} aria-pressed={s.preset === p}
          onClick={() => setS((o) => withPreset(o, p))}>{engine.presets[p].label}</button>)}
      </div>
      <div className={styles.transformFields}>
        <Slider label="Length" value={s.duration} min={DRONE_SECONDS.min} max={DRONE_SECONDS.max} step={5} show={(v) => `${v} s`} onChange={(v) => set({ duration: v })} />
        <Slider label="Stillness" value={s.stillness} min={0} max={100} step={1} onChange={(v) => set({ stillness: v })} hint="Higher holds closer to one moment of the passage." />
        <Slider label="Grain" value={s.grainMs} min={150} max={900} step={10} show={(v) => `${v} ms`} onChange={(v) => set({ grainMs: v })} />
        <Slider label="Pitch" value={s.pitch} min={-12} max={12} step={1} show={(v) => `${signed(v)} st`} onChange={(v) => set({ pitch: v })} />
        <Slider label="Movement" value={s.movement} min={0} max={100} step={1} onChange={(v) => set({ movement: v })} />
        <Slider label="Space" value={s.space} min={0} max={100} step={1} onChange={(v) => set({ space: v })} />
        <label className={styles.transformField}><span>Seamless loop</span>
          <input type="checkbox" style={{ width: 18, height: 18 }} checked={s.loop} onChange={(e) => set({ loop: e.currentTarget.checked })} /></label>
      </div>

      <h3 className={styles.toneHeading}>Voices</h3>
      {s.layerMix.map((m, i) => <div key={i} className={styles.localAudioCard} data-drone-layer={i}>
        <div className={styles.transformStepHead}><strong>{P.layerNames[i]}</strong>
          <span>
            <label><input type="checkbox" checked={m.enabled} onChange={(e) => setLayer(i, { enabled: e.currentTarget.checked })} /> On</label>{' '}
            <button type="button" className={s.soloLayer === i ? styles.play : styles.ghost} aria-pressed={s.soloLayer === i} onClick={() => set({ soloLayer: s.soloLayer === i ? null : i })}>Solo</button>
          </span></div>
        <div className={styles.transformFields}>
          <Slider label="Level" value={m.level} min={0} max={150} step={1} show={(v) => `${v}%`} onChange={(v) => setLayer(i, { level: v })} />
          <Slider label="Pan" value={m.pan} min={-100} max={100} step={1} show={(v) => (v === 0 ? 'centre' : v < 0 ? `${-v} L` : `${v} R`)} onChange={(v) => setLayer(i, { pan: v })} />
          <Slider label="Interval" value={m.interval} min={engine.INTERVAL_RANGE[0]} max={engine.INTERVAL_RANGE[1]} step={1} show={(v) => `${signed(v)} st`} onChange={(v) => setLayer(i, { interval: v })} />
          <Slider label="Enters at" value={m.entersAt} min={0} max={90} step={1} show={(v) => `${v} s`} onChange={(v) => setLayer(i, { entersAt: v })} />
          <Slider label="Bloom" value={m.bloomSeconds} min={0} max={60} step={1} show={(v) => `${v} s`} onChange={(v) => setLayer(i, { bloomSeconds: v })} />
        </div>
      </div>)}

      <h3 className={styles.toneHeading}>Surround field <span className={styles.muted}>· for headphones</span></h3>
      {field.map((e, i) => { const d = engine.FIELD_ELEMENTS[i]; return <div key={d.key} className={styles.localAudioCard} data-drone-field={d.key}>
        <div className={styles.transformStepHead}><strong>{d.name}</strong>
          <label><input type="checkbox" checked={e.enabled} onChange={(ev) => setField(i, { enabled: ev.currentTarget.checked })} /> On</label></div>
        <p className={styles.muted}>{d.desc}</p>
        {d.from === 'file' && <label className={styles.fileLabel} htmlFor="drone-ambience">{amb ? `Ambience: ${amb.loaded.file.name}` : 'Choose an ambience recording of your own'}
          <input id="drone-ambience" type="file" accept=".wav,.flac,.mp3,.m4a,.aac,.ogg,.opus,audio/*" disabled={busy}
            onChange={(ev) => { void choose(ev.currentTarget.files?.[0], 'ambience'); ev.currentTarget.value = ''; }} /></label>}
        {e.enabled && <div className={styles.transformFields}>
          <Slider label="Level" value={e.level} min={0} max={150} step={1} show={(v) => `${v}%`} onChange={(v) => setField(i, { level: v })} />
          <Slider label="Distance" value={e.distance} min={0} max={100} step={1} onChange={(v) => setField(i, { distance: v })} />
          <Slider label="Height" value={e.height} min={-40} max={80} step={1} show={(v) => `${v}°`} onChange={(v) => setField(i, { height: v })} />
          <Slider label="Angle" value={e.angle} min={-180} max={180} step={5} show={(v) => (v === 0 ? 'front' : Math.abs(v) === 180 ? 'behind' : v > 0 ? `${v}° right` : `${-v}° left`)} onChange={(v) => setField(i, { angle: v })} />
          <label className={styles.transformField}>Path
            <select value={e.path} onChange={(ev) => setField(i, { path: ev.currentTarget.value as FieldPath })}>
              {Object.entries(engine.FIELD_PATHS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
          {e.path !== 'still' && <>
            <Slider label="Speed" value={e.speed} min={0.25} max={6} step={0.25} show={(v) => `${v} per min`} onChange={(v) => setField(i, { speed: v })} />
            <label className={styles.transformField}><span>Reverse direction</span>
              <input type="checkbox" style={{ width: 18, height: 18 }} checked={e.direction === -1} onChange={(ev) => setField(i, { direction: ev.currentTarget.checked ? -1 : 1 })} /></label>
          </>}
        </div>}
      </div>; })}

      <h3 className={styles.toneHeading}>Clean, level and tune</h3>
      <div className={styles.transformFields}>
        <label className={styles.transformField}><span>Repair clipped peaks</span>
          <input type="checkbox" style={{ width: 18, height: 18 }} checked={clean.repairClips} onChange={(e) => set({ clean: { ...clean, repairClips: e.currentTarget.checked } })} /></label>
        <Slider label="Low cut" value={clean.lowCutHz} min={0} max={300} step={5} show={(v) => (v ? `${v} Hz` : 'off')} onChange={(v) => set({ clean: { ...clean, lowCutHz: v } })} />
        <Slider label="Soften" value={clean.soften} min={0} max={100} step={1} onChange={(v) => set({ clean: { ...clean, soften: v } })} />
        <Slider label="Align grains" value={clean.smooth} min={0} max={100} step={1} onChange={(v) => set({ clean: { ...clean, smooth: v } })} hint="Experimental. Can steady a smooth tone; can make vibrato flutter more." />
        <Slider label="Output peak" value={level.outputPeakDb} min={-12} max={-1} step={0.1} show={(v) => `${v.toFixed(1)} dBFS`} onChange={(v) => set({ level: { ...level, outputPeakDb: v } })} />
        <Slider label="Loudness push" value={level.pushDb} min={0} max={9} step={0.5} show={(v) => `${v} dB`} onChange={(v) => set({ level: { ...level, pushDb: v } })} />
        <Slider label="Fine tune" value={tune.cents} min={-100} max={100} step={1} show={(v) => `${signed(v)} ¢`} onChange={(v) => set({ tune: { ...tune, cents: v } })} />
        <label className={styles.transformField}>Tuning reference
          <select value={tune.aRef} onChange={(e) => set({ tune: { ...tune, aRef: Number(e.currentTarget.value) === 432 ? 432 : 440 } })}>
            <option value={440}>A = 440 Hz</option><option value={432}>A = 432 Hz</option>
          </select></label>
      </div>
      <div className={styles.transformActions}>
        <button type="button" className={styles.ghost} onClick={() => void readPitch()} disabled={busy}>Read the note</button>
        <button type="button" className={styles.ghost} onClick={snap} disabled={busy}>Snap to the nearest note</button>
      </div>
      {pitchRead && <p className={styles.muted} data-drone-pitch="true">{pitchRead}</p>}

      <h3 className={styles.toneHeading} id="drone-detail-title">Resonance &amp; Detail</h3>
      <div data-drone-detail="true" aria-labelledby="drone-detail-title">
        <p className={styles.muted}>Dial into the drone&apos;s space and its notes. Every control starts where v0.3.4 has it; while they all stay there, the drone is exactly the sound you accepted. {neutral ? <strong data-drone-neutral="true">Now: the accepted v0.3.4 sound.</strong> : <strong data-drone-neutral="false">Now: your Resonance &amp; Detail.</strong>}</p>
        <div className={styles.transformFields}>
          <Slider label="Decay" value={dv.decay} min={0} max={0.8} step={0.01} show={(v) => (v === 0.48 ? '0.48 (v0.3.4)' : v.toFixed(2))} onChange={(v) => setDetail({ decay: v })} hint="How long the space keeps ringing." />
          <Slider label="Size" value={dv.size} min={0.5} max={2.5} step={0.05} show={(v) => `×${v.toFixed(2)}`} onChange={(v) => setDetail({ size: v })} hint="How large the space feels." />
          <Slider label="Wet" value={dv.wet} min={0} max={3} step={0.05} show={(v) => `×${v.toFixed(2)}`} onChange={(v) => setDetail({ wet: v })} hint="How much of the space you hear." />
          <Slider label="Dry" value={dv.dry} min={0} max={1.5} step={0.05} show={(v) => `×${v.toFixed(2)}`} onChange={(v) => setDetail({ dry: v })} hint="How much of the direct sound." />
          <Slider label="Tone" value={dv.toneHz ?? P.cutoff} min={800} max={14000} step={50} show={(v) => (dv.toneHz === null ? `${v} Hz (preset)` : `${v} Hz`)} onChange={(v) => setDetail({ toneHz: v })} hint="The drone's brightness." />
        </div>
        <div className={styles.localAudioCard} data-drone-band="true">
          <div className={styles.transformStepHead}><strong>Resonance band</strong>
            <label><input type="checkbox" checked={dv.band.on} onChange={(e) => setBand({ on: e.currentTarget.checked })} /> On</label></div>
          <p className={styles.muted}>Lift or lower one region — a note, a harmonic, a vowel&apos;s colour. Place it on the spectrum below after you make the drone.</p>
          {dv.band.on && <div className={styles.transformFields}>
            <Slider label="Centre" value={dv.band.hz} min={40} max={12000} step={1} show={(v) => `${v} Hz`} onChange={(v) => setBand({ hz: v })} />
            <Slider label="Width" value={dv.band.q} min={0.3} max={12} step={0.1} show={(v) => `Q ${v.toFixed(1)}`} onChange={(v) => setBand({ q: v })} hint="Higher is narrower." />
            <Slider label="Lift" value={dv.band.db} min={-18} max={18} step={0.5} show={(v) => `${v > 0 ? '+' : ''}${v} dB`} onChange={(v) => setBand({ db: v })} />
          </div>}
        </div>
        <div className={styles.transformActions}>
          <button type="button" className={styles.ghost} disabled={neutral} onClick={() => set({ detail: NEUTRAL_DETAIL })} data-drone-reset-detail="true">Back to the v0.3.4 sound</button>
        </div>
      </div>

      {problem && <p className={styles.focusStatus} role="alert">{problem}</p>}
      {needsAmb && <p className={styles.focusStatus} role="alert">The ambience element is on: choose an ambience recording, or turn it off.</p>}
      {shown && <div className={styles.localAudioCard} data-drone-result="true">
        <strong>The drone · what the player plays</strong>
        {stale && <p className={styles.focusStatus} data-drone-stale="true">Settings changed since this drone was made. Make the drone again to hear them; the meter and spectrum below describe this one.</p>}
        <p className={styles.muted}>{clock(shown.frames / shown.rate)} · peak {(20 * Math.log10(shown.peak)).toFixed(1)} dBFS{shown.loudnessLufs != null ? ` · ${shown.loudnessLufs.toFixed(1)} LUFS` : ''}{s.loop ? ' · loops seamlessly' : ''}</p>
        <Wave audio={{ sampleRate: shown.rate, channels: [shown.left as Float32Array<ArrayBuffer>, shown.right as Float32Array<ArrayBuffer>] }} region={null}
          playhead={handed?.which === 'drone' && pos ? pos.seconds : undefined}
          marks={report ? [...report.clicks, ...report.flutter].filter((r) => !kept[`${r.kind}@${r.at.toFixed(2)}`]) : []} />

        {spec && <div data-drone-spectrum-card="true">
          <p className={styles.muted}>Spectrum{noteHz ? ' · lines mark the harmonics of the note you read' : ' · press “Read the note” to mark its harmonics'}. Click to place the resonance band there.</p>
          <Spectrum spec={spec} harmonicsHz={harmHz} band={dv.band} onPick={(hz) => setBand({ on: true, hz })} />
          <div className={styles.transformActions}>
            <button type="button" className={styles.ghost} disabled={busy || !player || !dv.band.on} onClick={() => void hearBand()} data-drone-hear-band="true">Hear only the band · {dv.band.hz} Hz</button>
          </div>
        </div>}

        {report && <div data-drone-meter="true">
          <strong>Detail</strong>
          <p className={styles.muted}>What the meter finds is not a defect by default. Listen, then reduce it, keep it, or bring it forward.</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0', display: 'grid', gap: 6 }}>
            <li data-drone-reading="ripple">Level movement (flutter): <strong style={{ display: "inline" }}>{report.ripplePct}%</strong></li>
            {report.seam && <li data-drone-reading="seam">Loop seam: <strong style={{ display: "inline" }}>{report.seam.smooth ? 'smooth' : 'a step you may hear'}</strong></li>}
            {report.beat ? <li data-drone-reading="beat">Beating: <strong style={{ display: "inline" }}>{report.beat.hz} Hz</strong>, {report.beat.depthPct}% deep
              {!kept.beat && <span> · {(['reduce', 'keep', 'emphasise'] as Answer[]).map((a) => <button key={a} type="button" className={styles.ghost} title={a === 'keep' ? 'Change nothing' : ANSWER_SAYS.beat[a]} onClick={() => answer('beat', 'beat', a)}>{a === 'emphasise' ? 'Bring forward' : a === 'reduce' ? 'Reduce' : 'Keep'}</button>)}</span>}</li>
              : <li data-drone-reading="beat">Beating: <strong style={{ display: "inline" }}>none found</strong></li>}
            {[...report.clicks, ...report.flutter].sort((a, b) => a.at - b.at).map((r) => { const id = `${r.kind}@${r.at.toFixed(2)}`; return <li key={id} data-drone-reading={r.kind} data-at={r.at.toFixed(2)}>
              {r.kind === 'click' ? 'Click' : 'Flutter'} at <strong style={{ display: "inline" }}>{clock(r.at)}</strong>{kept[id] ? ' · kept' : ''}
              {' · '}<button type="button" className={styles.ghost} disabled={busy || !player} onClick={() => void listenAt(r.at)}>Listen</button>
              {!kept[id] && (['reduce', 'keep', 'emphasise'] as Answer[]).map((a) => <button key={a} type="button" className={styles.ghost} title={a === 'keep' ? 'Change nothing' : ANSWER_SAYS[r.kind][a]} onClick={() => answer(r.kind, id, a)}>{a === 'emphasise' ? 'Bring forward' : a === 'reduce' ? 'Reduce' : 'Keep'}</button>)}
            </li>; })}
            {report.clicks.length + report.flutter.length === 0 && <li data-drone-reading="none">No clicks or flutter moments stand out.</li>}
          </ul>
        </div>}

        <div data-drone-compare="true">
          <strong style={{ display: "inline" }}>Compare</strong> <span className={styles.muted}>· each matched to the same loudness</span>
          <div className={styles.transformActions}>
            <button type="button" className={styles.ghost} disabled={busy || !player} onClick={() => void compare('original')}>Original passage</button>
            <button type="button" className={styles.ghost} disabled={busy || !player} onClick={() => void compare('accepted')}>v0.3.4 sound</button>
            <button type="button" className={styles.ghost} disabled={busy || !player} onClick={() => void compare('yours')}>Your settings</button>
          </div>
        </div>
      </div>}
      <div className={styles.transformActions}>
        <button type="button" className={styles.play} onClick={() => void preview()} disabled={busy || !!problem || needsAmb || !player}>Make the drone and play it</button>
        <button type="button" className={styles.ghost} onClick={() => void save()} disabled={busy || !!problem || needsAmb}>Save as new</button>
        <button type="button" className={styles.ghost} onClick={() => void saveRecipe()} disabled={busy || !!problem || needsAmb}>Save the recipe</button>
      </div>
      {progress && <p className={styles.muted} aria-live="polite">{progress}</p>}
      {saved && <p className={styles.toneProvenance} data-drone-saved="true">
        Saved <strong>{saved.wav}</strong> and <strong>{saved.json}</strong>. The same record is also inside the WAV. Your original was re-read after saving: <strong>{saved.original}</strong>.
      </p>}
    </>}
    {status && <p className={styles.focusStatus} role="status" aria-live="polite">{status}</p>}
  </section>;
}
