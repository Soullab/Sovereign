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
import { useEffect, useRef, useState } from 'react';
import { usePersistentListening } from '@/components/listening/PersistentListeningProvider';
import { frameCount, type Audio } from '@/lib/listening/transform/audio';
import { readWav, wavAudioBytes, withProvenance } from '@/lib/listening/transform/wav';
import { acceptMemberFile, sha256Hex, type SideInfo } from '@/lib/listening/transform/provenance';
import { validateLocalAudio } from '@/lib/listening/localAudio';
import * as engine from '@/lib/listening/drone/engine.js';
import type { Ambience, DroneSettings, FieldElement, FieldPath, LayerMix, PresetId, RenderResult } from '@/lib/listening/drone/engine';
import {
  DRONE_SECONDS, buildDroneProvenance, defaultSettings, droneAmbience, droneRecipe, droneSource,
  parseDroneRecipe, renderDrone, settingsProblem, withPreset,
} from '@/lib/listening/drone/drone';
import styles from './listen.module.css';

type Loaded = { file: File; audio: Audio; info: SideInfo };
const MAX_SECONDS = 20 * 60;

async function load(file: File): Promise<Loaded> {
  const bytes = await file.arrayBuffer();
  const sha = await sha256Hex(bytes);
  let audio: Audio; let decodedBy: SideInfo['decodedBy'] = 'soullab-wav';
  if (/\.wav$/i.test(file.name)) audio = readWav(bytes);
  else {
    decodedBy = 'browser';
    const ctx = new OfflineAudioContext(2, 1, 48000);
    const d = await ctx.decodeAudioData(bytes.slice(0));
    audio = { sampleRate: d.sampleRate, channels: Array.from({ length: Math.min(2, d.numberOfChannels) }, (_, i) => d.getChannelData(i).slice()) };
  }
  if (frameCount(audio) / audio.sampleRate > MAX_SECONDS) throw new Error('This recording is longer than 20 minutes.');
  return { file, audio, info: { name: file.name, sha256: sha, sampleRate: audio.sampleRate, frames: frameCount(audio), channels: audio.channels.length, decodedBy } };
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

/** The source waveform with the chosen passage. Click and drag to mark a passage. Display only otherwise. */
function Wave({ audio, region, playhead, onRegion }: { audio: Audio; region: [number, number] | null; playhead?: number; onRegion?: (a: number, b: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const start = useRef<number | null>(null);
  const total = frameCount(audio) / audio.sampleRate;
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1; const w = c.width = Math.max(1, Math.round(c.clientWidth * dpr)); const h = c.height = Math.round(80 * dpr);
    const g = c.getContext('2d'); if (!g) return;
    const n = frameCount(audio); const peaks = new Float32Array(w); let top = 0;
    for (let x = 0; x < w; x++) {
      let m = 0; const a = Math.floor((x * n) / w), b = Math.max(a + 1, Math.floor(((x + 1) * n) / w));
      for (const ch of audio.channels) for (let i = a; i < Math.min(n, b); i++) { const v = Math.abs(ch[i]); if (v > m) m = v; }
      peaks[x] = m; if (m > top) top = m;
    }
    const scale = top > 0 ? 0.92 / top : 1; g.clearRect(0, 0, w, h);
    for (let x = 0; x < w; x++) {
      const t = (x / w) * total; const on = !region || (t >= region[0] && t <= region[1]);
      g.fillStyle = on ? 'rgba(212, 175, 55, 0.9)' : 'rgba(212, 175, 55, 0.22)';
      const bar = Math.max(1, peaks[x] * scale * h); g.fillRect(x, (h - bar) / 2, 1, bar);
    }
    if (playhead !== undefined) { g.fillStyle = 'rgba(127, 209, 200, 0.95)'; g.fillRect(Math.round((Math.min(total, playhead) / total) * w) - dpr, 0, 2 * dpr, h); }
  }, [audio, total, region, playhead]);
  const at = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return Math.round(Math.min(total, Math.max(0, ((e.clientX - r.left) / r.width) * total)) * 100) / 100; };
  return <canvas ref={ref} className={styles.transformWave} aria-hidden="true" data-drone-wave="true"
    style={{ touchAction: onRegion ? 'none' : 'auto', cursor: onRegion ? 'crosshair' : 'default' }}
    onPointerDown={(e) => { if (!onRegion) return; start.current = at(e); e.currentTarget.setPointerCapture(e.pointerId); }}
    onPointerMove={(e) => { if (onRegion && start.current !== null) { const t = at(e); onRegion(Math.min(start.current, t), Math.max(start.current, t)); } }}
    onPointerUp={() => { start.current = null; }} onPointerCancel={() => { start.current = null; }} />;
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
  const [handed, setHanded] = useState<{ which: 'original' | 'drone'; title: string } | null>(null);
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
    if (!p.hz || p.confidence < 0.5) { setPitchRead('No steady note found in this passage.'); return; }
    const ni = engine.noteInfo(p.hz * 2 ** (s.pitch / 12), tune.aRef);
    setPitchRead(`${p.hz.toFixed(1)} Hz in the passage → ${ni.name} ${ni.cents >= 0 ? '+' : '−'}${Math.abs(ni.cents)} ¢ after pitch, at A=${tune.aRef}`);
    return p.hz;
  };
  const snap = () => { const hz = readPitch(); if (hz) set({ tune: { ...tune, cents: engine.snapCents(hz, s.pitch, tune.aRef) } }); };

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
        <Wave audio={source.audio} region={s.region ? [s.region.startSeconds, s.region.endSeconds] : null}
          playhead={handed?.which === 'original' && pos ? pos.seconds : undefined}
          onRegion={(a, b) => set({ region: { startSeconds: a, endSeconds: b } })} />
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

      {problem && <p className={styles.focusStatus} role="alert">{problem}</p>}
      {needsAmb && <p className={styles.focusStatus} role="alert">The ambience element is on: choose an ambience recording, or turn it off.</p>}
      {current && <div className={styles.localAudioCard} data-drone-result="true">
        <strong>The drone · what the player plays</strong>
        <p className={styles.muted}>{clock(current.frames / current.rate)} · peak {(20 * Math.log10(current.peak)).toFixed(1)} dBFS{current.loudnessLufs != null ? ` · ${current.loudnessLufs.toFixed(1)} LUFS` : ''}{s.loop ? ' · loops seamlessly' : ''}</p>
        <Wave audio={{ sampleRate: current.rate, channels: [current.left as Float32Array<ArrayBuffer>, current.right as Float32Array<ArrayBuffer>] }} region={null}
          playhead={handed?.which === 'drone' && pos ? pos.seconds : undefined} />
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
