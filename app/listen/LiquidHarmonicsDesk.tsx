'use client';

import { useEffect, useRef, useState } from 'react';
import { usePersistentListening } from '@/components/listening/PersistentListeningProvider';
import {
  BREAKTHROUGHS, CONTROLS, DEFAULT_PARAMS, LIQUID_NOTES, LIQUID_STUDY_TITLE, cleanParams, cleanScore, formatValue, fromSlider,
  liquidHarmonicsStudy, scoreSeconds, starterScore, stepSeconds, toSlider, TOUCH_ZONES,
} from '@/lib/listening/liquidHarmonics';
import type { Control, LiquidEngine, LiquidView, Params, Score, Step } from '@/lib/listening/liquidHarmonics';
import styles from './listen.module.css';

// LISTEN-01 · Liquid Harmonics (sketch 09), founder go-ahead 2026-11-21: review-only, inside the gated /listen Lab.
// It starts nothing by itself: Begin is the member's own act, and the sound goes through the one persistent player
// (its Level, Pause, Stop and single-source rules). Kept settings and the journey stay in this browser only.
// Copy is scanned by tests/listening/liquid_harmonics.test.mjs.

type Kept = { name: string; at: string; params: Params };
const KEYS = { last: 'soullab-liquid-harmonics-last-v1', kept: 'soullab-liquid-harmonics-kept-v1', score: 'soullab-liquid-harmonics-score-v1' };
const load = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : d; } catch { return d; } };
const store = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: still works, not remembered */ } };

// The engine keeps running in the player when the member moves to another view, so the desk re-attaches to it.
const shared: { engine: LiquidEngine | null; params: Params; loaded: boolean } = { engine: null, params: { ...DEFAULT_PARAMS }, loaded: false };

const GROUPS = ['Atmosphere', 'Music', 'Touch', 'Voice', 'Oscillation', 'Frequency shifts', 'Pressure', 'Space', 'Rise'] as const;
const mmss = (x: number) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`;
const stepLabel = (st: Step) => st.type === 'morph' ? st.name : st.type === 'end' ? 'End' : st.type[0].toUpperCase() + st.type.slice(1);

// How long each step of the running journey actually took (Hold pauses a step, Extend lengthens it, Next shortens it),
// so the timeline stretches or shrinks to what really happened rather than only what the score planned.
type Track = { i: number; last: number; done: number[] };
const newTrack = (): Track => ({ i: -1, last: 0, done: [] });

function JourneyTimeline({ score, J, phase, track }: { score: Score; J: LiquidView['journey']; phase: string; track: Track }) {
  const widths = score.steps.map((st, i) => {
    const planned = stepSeconds(st);
    if (!J || i > J.i) return planned;
    if (i < J.i) return track.done[i] ?? planned;
    return Math.max(planned, J.stepElapsed);
  });
  const total = widths.reduce((a, x) => a + x, 0) || 1;
  const at = J ? widths.slice(0, J.i).reduce((a, x) => a + x, 0) + Math.min(widths[J.i] ?? 0, J.stepElapsed) : 0;
  const cur = J ? score.steps[J.i] : null;
  const state = J ? (J.held ? ' · held' : phase === 'rising' ? ' · rising' : J.ending ? ' · fading' : '') : '';
  return (
    <div className={styles.liquidTimelineWrap} data-liquid-timeline="true">
      <div className={styles.liquidTimeline} role="img"
        aria-label={`Journey timeline: ${score.steps.map(stepLabel).join(', ')}`}>
        {score.steps.map((st, i) => (
          <span key={i} className={`${styles.liquidSeg} ${styles[`liquidSeg_${st.type}`] ?? ''} ${J && i === J.i ? styles.liquidSegNow : ''} ${J && i < J.i ? styles.liquidSegDone : ''}`}
            style={{ flexGrow: widths[i] }} title={`${stepLabel(st)} · ${mmss(widths[i])}`} data-liquid-seg={st.type}>
            <span>{stepLabel(st)}</span>
          </span>
        ))}
        {J && <span className={styles.liquidPlayhead} style={{ left: `${(at / total) * 100}%` }} data-liquid-playhead={(at / total).toFixed(4)} />}
      </div>
      <p className={styles.muted} data-liquid-timeline-note="true">
        {J && cur ? `Step ${J.i + 1} of ${J.n} · ${stepLabel(cur)} · ${mmss(at)} / ${mmss(total)}${state}`
          : `Journey: ${score.title} · ${score.steps.length} steps · ${mmss(total)}. Play journey (below) to follow it here.`}
      </p>
    </div>
  );
}

function download(name: string, data: unknown) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function drawSpectrum(canvas: HTMLCanvasElement, engine: LiquidEngine | null, bins: { b: Uint8Array<ArrayBuffer> | null }) {
  const g = canvas.getContext('2d'); if (!g) return;
  const W = canvas.width, H = canvas.height;
  g.fillStyle = '#03080b'; g.fillRect(0, 0, W, H);
  if (!engine) { bins.b = null; return; }
  const an = engine.analyser;
  if (!bins.b || bins.b.length !== an.frequencyBinCount) bins.b = new Uint8Array(an.frequencyBinCount);
  an.getByteFrequencyData(bins.b);
  const ny = an.context.sampleRate / 2; g.fillStyle = 'rgba(217,184,120,.85)';
  for (let x = 0; x < W; x += 2) {
    const f = 40 * Math.pow(16000 / 40, x / W), i = Math.min(bins.b.length - 1, Math.round(f / ny * bins.b.length)), v = bins.b[i] / 255;
    g.fillRect(x, H - v * H, 2, v * H);
  }
}

export default function LiquidHarmonicsDesk() {
  const transport = usePersistentListening();
  const [, setTick] = useState(0);
  const [view, setView] = useState<LiquidView | null>(null);
  const [kept, setKept] = useState<Kept[]>([]);
  const [score, setScoreState] = useState<Score | null>(null);
  const [keepName, setKeepName] = useState('');
  const [message, setMessage] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const track = useRef<Track>(newTrack());
  const meters = useRef<(HTMLSpanElement | null)[]>([]);
  const live = transport?.snapshot.kind === 'sketch' && transport.snapshot.title === LIQUID_STUDY_TITLE &&
    transport.snapshot.playback === 'playing';
  const P = shared.params;

  // Restore this browser's own settings once, after mount (no storage during server render).
  useEffect(() => {
    if (!shared.loaded) { Object.assign(shared.params, cleanParams(load(KEYS.last, {}), true)); shared.loaded = true; }
    const k = load<Kept[]>(KEYS.kept, []).filter(x => x && typeof x.name === 'string').map(x => ({ name: x.name.slice(0, 80), at: String(x.at), params: cleanParams(x.params, true) }));
    setKept(k);
    const s = load<unknown>(KEYS.score, null);
    setScoreState(s ? cleanScore(s) : starterScore(k.length ? k[k.length - 1].name : 'the current sound', k.length ? k[k.length - 1].params : shared.params));
    setTick(n => n + 1);
  }, []);

  useEffect(() => {
    let raf = 0, last = '', lastSync = 0; const bins: { b: Uint8Array<ArrayBuffer> | null } = { b: null };
    const frame = (now: number) => {
      const e = shared.engine;
      if (canvas.current) drawSpectrum(canvas.current, e, bins);
      // Touch preview meters: written straight to the DOM each frame (no re-render).
      const tm = e ? e.touch() : { rms: [0, 0, 0, 0], above150: 0 }, tr = tm.rms;
      meters.current.forEach((m, i) => { if (m) { const v = Math.min(1, tr[i] / 0.35); m.style.width = `${(v * 100).toFixed(1)}%`; m.dataset.rms = tr[i].toFixed(4); m.dataset.above150 = tm.above150.toFixed(4); } });
      const v = e?.view() ?? null;
      const t = track.current, jv = v?.journey;
      if (!jv) { if (t.i !== -1) track.current = newTrack(); }
      else { if (jv.i !== t.i) { if (t.i >= 0) t.done[t.i] = t.last; t.i = jv.i; } t.last = jv.stepElapsed; }
      const key = v ? `${v.phase}|${v.note}|${v.centreNote}|${v.journey ? `${v.journey.i}|${Math.floor(v.journey.elapsed)}|${v.journey.held}` : ''}|${v.music.on}|${v.music.key}` : '';
      if (key !== last) { last = key; setView(v); }
      // While a tween moves the sliders, redraw them a few times a second.
      if (e && v && v.phase !== 'free' && now - lastSync > 250) { lastSync = now; setTick(n => n + 1); store(KEYS.last, shared.params); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const setScore = (s: Score) => { const c = cleanScore(s); setScoreState(c); store(KEYS.score, c); };
  const setKeptList = (k: Kept[]) => { setKept(k); store(KEYS.kept, k); };
  const change = (c: Control, raw: string) => {
    P[c.k] = c.options ? raw : fromSlider(c, Number(raw));
    shared.engine?.apply(); store(KEYS.last, P); setTick(n => n + 1);
  };

  const begin = async () => {
    if (!transport) return false;
    const started = await transport.playStudy(liquidHarmonicsStudy(shared.params, e => { shared.engine = e; }));
    setMessage(started
      ? 'Playing. Level, Pause and Stop are in the player bar.'
      : 'Sound did not start. Another Soullab sound may be active, or MAIA may be speaking.');
    return started;
  };
  const playJourney = async () => {
    if (!score) return;
    if (!live && !(await begin())) return;
    if (!shared.engine?.playJourney(score)) setMessage('The journey can start once the current rise or return has finished.');
  };

  const phase = view?.phase ?? 'free', J = view?.journey ?? null;
  const free = live && phase === 'free' && !J;
  const journeyLocked = !live || !J || phase === 'rising' || J.ending;

  const slider = (c: Control) => (
    <label className={styles.orbitCtl} key={c.k} title={c.hint}>
      <span>{c.label}</span>
      {c.options
        ? <select value={String(P[c.k])} onChange={e => change(c, e.target.value)} data-liquid-param={c.k}>{c.options.map(o => <option key={o}>{o}</option>)}</select>
        : <input type="range" min={0} max={1} step={0.001} value={toSlider(c, Number(P[c.k]))} onChange={e => change(c, e.target.value)} data-liquid-param={c.k} />}
      <span className={styles.muted}>{formatValue(c, P[c.k])}</span>
    </label>
  );

  // The same four journey controls appear under the timeline (top) and in the Journey panel (bottom).
  // Distinct data attributes per place, so each can be checked on its own.
  const journeyButtons = (at: '' | 'top-') => <>
    <button type="button" className={`${styles.play} ${styles.liquidPlay}`} {...{ [`data-liquid-${at}journey-play`]: 'true' }} disabled={!transport || Boolean(J) || !score?.steps.length} onClick={() => void playJourney()}>{J ? '▶  Journey playing' : '▶  Play journey'}</button>
    <button type="button" className={styles.focusChoice} {...{ [`data-liquid-${at}hold`]: 'true' }} disabled={journeyLocked} onClick={() => shared.engine?.hold()}>{J?.held ? 'Continue' : 'Hold here'}</button>
    <button type="button" className={styles.focusChoice} {...{ [`data-liquid-${at}extend`]: 'true' }} disabled={journeyLocked} onClick={() => shared.engine?.extend()}>Extend +30 s</button>
    <button type="button" className={styles.focusChoice} {...{ [`data-liquid-${at}next`]: 'true' }} disabled={journeyLocked} onClick={() => shared.engine?.next()}>Next step</button>
  </>;

  const editStep = (i: number, patch: Partial<Step> & Record<string, unknown>) => {
    if (!score) return; const steps = score.steps.slice(); steps[i] = { ...steps[i], ...patch } as Step; setScore({ ...score, steps });
  };
  const moveStep = (i: number, d: number) => {
    if (!score) return; const steps = score.steps.slice(), j = i + d; if (j < 0 || j >= steps.length) return;
    [steps[i], steps[j]] = [steps[j], steps[i]]; setScore({ ...score, steps });
  };
  const addStep = (type: Step['type']) => {
    if (!score) return; const k = kept[kept.length - 1];
    const st = type === 'morph' ? { type, name: k ? k.name : 'the current sound', params: cleanParams(k ? k.params : P), seconds: 20, hold: 60 } : { type };
    setScore({ ...score, steps: [...score.steps, st as Step] });
  };
  const num = (i: number, f: string, v: number, label: string, min: number, max: number, step = 1) => (
    <label key={f}>{label}
      <input type="number" min={min} max={max} step={step} value={step < 1 ? v.toFixed(1) : Math.round(v)} style={{ width: 76 }}
        onChange={e => editStep(i, { [f]: Number(e.target.value) })} data-liquid-step-field={f} />
    </label>
  );
  const stepBody = (st: Step, i: number) => {
    if (st.type === 'morph') return <>
      <span>Morph to <b>{st.name}</b></span>
      {kept.length > 0 && <label>Change to
        <select value="" onChange={e => { const k = kept[Number(e.target.value)]; if (k) editStep(i, { name: k.name, params: cleanParams(k.params) }); }}>
          <option value="">…</option>{kept.map((k, j) => <option key={j} value={j}>{k.name}</option>)}
        </select></label>}
      {num(i, 'seconds', st.seconds, 'over (s)', 5, 1800)}{num(i, 'hold', st.hold, 'then hold (s)', 0, 1800)}
    </>;
    if (st.type === 'gather' || st.type === 'release') return <>
      <span>{st.type === 'gather' ? 'Gather to centre' : 'Release to periphery'}</span>
      {num(i, 'seconds', st.seconds, 'over (s)', 5, 600)}{num(i, 'hold', st.hold, 'then hold (s)', 0, 1800)}
    </>;
    if (st.type === 'rise') return <>
      <span>Rise</span>
      {num(i, 'peak', st.peak, 'peak (/s)', 5, 60)}{num(i, 'length', st.length, 'length (s)', 30, 600)}
      <label>Breakthrough<select value={st.brk} onChange={e => editStep(i, { brk: e.target.value as typeof st.brk })}>{BREAKTHROUGHS.map(b => <option key={b}>{b}</option>)}</select></label>
      <label>Centre<select value={st.gather} onChange={e => editStep(i, { gather: e.target.value === 'no' ? 'no' : 'yes' })}><option value="yes">gathering</option><option value="no">not gathering</option></select></label>
      {num(i, 'hold', st.hold, 'then hold (s)', 0, 1800)}
      {num(i, 'pitch', st.pitch, 'pitch climb (semitones)', 0, 24)}
      {num(i, 'emerge', st.emerge, 'harmonics emerge 0–1', 0, 1, 0.1)}{num(i, 'transform', st.transform, 'voice → digital 0–1', 0, 1, 0.1)}
      {num(i, 'throbAccel', st.throbAccel, 'throb accel 1–5', 1, 5, 0.1)}{num(i, 'pitchAccel', st.pitchAccel, 'pitch accel 1–5', 1, 5, 0.1)}{num(i, 'harmAccel', st.harmAccel, 'harmonics accel 1–5', 1, 5, 0.1)}
    </>;
    return <><span>End: fade out</span>{num(i, 'seconds', st.seconds, 'over (s)', 3, 120)}</>;
  };

  return (
    <section className={styles.toneLab} aria-labelledby="liquid-title" data-liquid-harmonics="true">
      <span className={styles.smallcaps}>LIQUID HARMONICS · SKETCH 09 · FOUNDER REVIEW</span>
      <h2 id="liquid-title">A living sound field you steer, and journeys you write.</h2>
      <p className={styles.muted}>
        A voiced tone with a singing overtone, throbbing and wobbling, folded through frequency-shifted echoes, an endless
        spiral and glass shimmer, with sub-bass pressure for speakers. Gather it to the centre, release it to the edges,
        or begin a rise: it speeds, brightens and fills until it breaks into stillness or silence.
      </p>
      <p className={styles.muted} data-liquid-claim="true">{LIQUID_NOTES.claim}</p>

      <div className={styles.orbitRow}>
        <button type="button" className={styles.play} data-liquid-play="true" onClick={() => void begin()} disabled={!transport || live}>
          {live ? '▶  Playing' : '▶  Begin'}
        </button>
        {transport && live && <button type="button" className={styles.ghost} data-liquid-stop="true" onClick={() => transport.stopMusic()}>Stop</button>}
        <button type="button" className={styles.focusChoice} data-liquid-gather="true" disabled={!free} onClick={() => shared.engine?.gather()}>Gather to centre (10 s)</button>
        <button type="button" className={styles.focusChoice} data-liquid-release="true" disabled={!free} onClick={() => shared.engine?.release()}>Release to periphery</button>
        <button type="button" className={styles.focusChoice} data-liquid-nudge="true" disabled={!free} onClick={() => { shared.engine?.nudge(); setTick(n => n + 1); }}>Nudge</button>
      </div>
      <div className={styles.orbitRow}>
        <button type="button" className={styles.focusChoice} data-liquid-rise="true" disabled={!free} onClick={() => shared.engine?.rise()}>Begin the rise</button>
        <button type="button" className={styles.focusChoice} data-liquid-return="true" disabled={!live || phase !== 'after' || Boolean(J)} onClick={() => shared.engine?.returnFromRise()}>Return</button>
        <span className={styles.muted} data-liquid-note="true" aria-live="polite">{[view?.centreNote, view?.note].filter(Boolean).join(' · ')}</span>
      </div>

      {score && score.steps.length > 0 && <>
        <JourneyTimeline score={score} J={J} phase={phase} track={track.current} />
        <div className={styles.orbitRow} data-liquid-top-journey="true">{journeyButtons('top-')}</div>
      </>}

      <canvas ref={canvas} width={720} height={110} className={styles.liquidSpectrum} aria-label="Spectrum of the sound, low to high" />

      {GROUPS.map(g => (
        <details className={styles.orbitDetails} key={g} open={g === 'Voice' || g === 'Music' || g === 'Atmosphere'} data-liquid-group={g}>
          <summary>{g === 'Music' ? 'Music layer' : g}</summary>
          {g === 'Touch' && <>
            <p className={styles.muted} data-liquid-touch-note="true">
              Phase 1 preview. Touch is worked out from the field (the pressure below, the throb and its left-right movement above)
              and measured here. It is not sent to any device yet. The music layer never reaches touch; every touch channel stays
              between 20 and 150 Hz, pulses no faster than 20 per second, and goes silent with the sound.
            </p>
            <div className={styles.liquidTouch} aria-label="Touch preview, four zones">
              {TOUCH_ZONES.map((z, i) => (
                <div key={z} className={styles.liquidTouchRow}>
                  <span>{z}</span>
                  <span className={styles.liquidTouchTrack}><span ref={el => { meters.current[i] = el; }} className={styles.liquidTouchBar} data-liquid-touch-meter={i} /></span>
                </div>
              ))}
            </div>
          </>}
          {g === 'Music' && <p className={styles.muted} data-liquid-music-note="true">
            A melody above the field, in its key{view?.music.on ? ` (now ${view.music.key})` : ''}. It follows the journey: sparse and low in heavier
            settings, flowing where the field moves, quiet during a rise. The balance is yours; journeys never change it.
          </p>}
          {CONTROLS.filter(c => c.g === g).map(slider)}
        </details>
      ))}

      <details className={styles.orbitDetails} data-liquid-kept="true">
        <summary>Kept settings ({kept.length})</summary>
        <div className={styles.orbitRow}>
          <label>Name<input value={keepName} maxLength={80} onChange={e => setKeepName(e.target.value)} placeholder="e.g. getting closer" /></label>
          <button type="button" className={styles.focusChoice} data-liquid-keep="true"
            onClick={() => { setKeptList([...kept, { name: keepName.trim() || `Kept ${kept.length + 1}`, at: new Date().toISOString(), params: { ...P } }]); setKeepName(''); }}>Keep this sound</button>
          <button type="button" className={styles.ghost} onClick={() => download(`liquid-harmonics-kept-${new Date().toISOString().slice(0, 10)}.json`, { sketch: 'liquid-harmonics-sketch-09', saved: new Date().toISOString(), kept })}>Save as a file</button>
        </div>
        <ul className={styles.liquidList}>
          {kept.length === 0 && <li className={styles.muted}>Nothing kept yet.</li>}
          {kept.map((k, i) => (
            <li key={`${k.at}-${i}`}>{k.name}
              <button type="button" className={styles.ghost} onClick={() => { Object.assign(P, k.params); shared.engine?.apply(); store(KEYS.last, P); setTick(n => n + 1); }} disabled={live && !free}>Load</button>
              <button type="button" className={styles.ghost} onClick={() => setKeptList(kept.filter((_, j) => j !== i))}>Remove</button>
            </li>
          ))}
        </ul>
      </details>

      <details className={styles.orbitDetails} data-liquid-journey="true" open>
        <summary>Journey</summary>
        <p className={styles.toneProvenance}>{LIQUID_NOTES.score}</p>
        {score && <>
          <div className={styles.orbitRow}>
            <label>Title<input value={score.title} maxLength={120} onChange={e => setScore({ ...score, title: e.target.value || 'Untitled journey' })} /></label>
            <span className={styles.muted} data-liquid-journey-note="true">
              {J ? `Step ${J.i + 1} of ${J.n}: ${J.type} · ${mmss(J.elapsed)} / ${mmss(J.total)}${J.held ? ' · held' : ''}`
                : `${score.steps.length} steps · ${mmss(scoreSeconds(score))} · by ${score.author}`}
            </span>
          </div>
          <ol className={styles.liquidList}>
            {score.steps.length === 0 && <li className={styles.muted}>No steps yet.</li>}
            {score.steps.map((st, i) => (
              <li key={i} className={styles.orbitRow} data-liquid-step={st.type}>
                {stepBody(st, i)}
                <span className={styles.muted}>{mmss(stepSeconds(st))}</span>
                <button type="button" className={styles.ghost} aria-label="Move up" onClick={() => moveStep(i, -1)} disabled={Boolean(J)}>↑</button>
                <button type="button" className={styles.ghost} aria-label="Move down" onClick={() => moveStep(i, 1)} disabled={Boolean(J)}>↓</button>
                <button type="button" className={styles.ghost} aria-label="Remove" onClick={() => setScore({ ...score, steps: score.steps.filter((_, j) => j !== i) })} disabled={Boolean(J)}>×</button>
              </li>
            ))}
          </ol>
          <div className={styles.orbitRow}>
            {(['morph', 'gather', 'release', 'rise', 'end'] as const).map(t => (
              <button key={t} type="button" className={styles.ghost} disabled={Boolean(J)} onClick={() => addStep(t)}>+ {t === 'morph' ? 'Morph to kept' : t[0].toUpperCase() + t.slice(1)}</button>
            ))}
          </div>
          <div className={styles.orbitRow}>
            {journeyButtons('')}
          </div>
          <div className={styles.orbitRow}>
            <button type="button" className={styles.ghost} disabled={Boolean(J)} onClick={() => setScore(starterScore(kept.length ? kept[kept.length - 1].name : 'the current sound', kept.length ? kept[kept.length - 1].params : P))}>Write a first score</button>
            <button type="button" className={styles.ghost} onClick={() => download(`liquid-harmonics-score-${new Date().toISOString().slice(0, 10)}.json`, { ...score, saved: new Date().toISOString() })}>Save score as a file</button>
            <button type="button" className={styles.ghost} disabled={Boolean(J)} onClick={() => fileInput.current?.click()}>Load a score file</button>
            <input ref={fileInput} type="file" accept="application/json,.json" hidden data-liquid-load="true" onChange={e => {
              const f = e.target.files?.[0]; if (!f) return;
              f.text().then(t => { setScore(cleanScore(JSON.parse(t))); setMessage('Score loaded and checked.'); })
                .catch(() => setMessage('That file is not a score this player can read.'))
                .finally(() => { if (fileInput.current) fileInput.current.value = ''; });
            }} />
          </div>
        </>}
      </details>

      {message && <p className={styles.focusStatus} role="status" aria-live="polite">{message}</p>}
      <p className={styles.toneProvenance} data-liquid-safety="true">{LIQUID_NOTES.safety} {LIQUID_NOTES.local}</p>
    </section>
  );
}
