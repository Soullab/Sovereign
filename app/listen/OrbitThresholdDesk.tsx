'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { usePersistentListening } from '@/components/listening/PersistentListeningProvider';
import {
  AUTO_CHOICES, BREATH_CHOICES, DEFAULT_ORBIT_SETTINGS, INSTANT_CHOICES, ORBIT_NOTES, ORBIT_STUDY_TITLE, RETURN_CHOICES,
  ROUTES, THIRD_EYE, orbitThresholdStudy,
} from '@/lib/listening/orbitThreshold';
import type { OrbitEngine, OrbitSettings, OrbitView } from '@/lib/listening/orbitThreshold';
import styles from './listen.module.css';

// LISTEN-01 · Orbit & Threshold (sketch 06), founder ruling 2026-11-17: review-only, inside the gated /listen Lab.
// It starts nothing by itself: Begin is the member's own act, and the sound goes through the one persistent player
// (its Level, Pause, Stop and single-source rules). Copy is scanned by tests/listening/orbit_threshold.test.mjs.

// The engine keeps running in the player when the member moves to another view, so the desk re-attaches to it.
const shared: { engine: OrbitEngine | null; settings: OrbitSettings } = {
  engine: null, settings: { ...DEFAULT_ORBIT_SETTINGS },
};

const COLORS = { fire: '#ff8a4c', water: '#5cb3ff', turn: '#e8d2af', threshold: '#c9b2ff', quiet: '#b3b3ac', line: 'rgba(241,225,193,.22)' };

function mix(a: string, b: string, m: number): string {
  const pa = a.slice(1).match(/\w\w/g)!.map(h => parseInt(h, 16)), pb = b.slice(1).match(/\w\w/g)!.map(h => parseInt(h, 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * m)).join(',')})`;
}

function draw(canvas: HTMLCanvasElement, v: OrbitView | null, settings: OrbitSettings) {
  const g = canvas.getContext('2d'); if (!g) return;
  const W = canvas.width, H = canvas.height;
  const X = (z: number) => W / 2 + z * 235, Y = (y: number) => 34 + (0.78 - y) * 265;
  g.clearRect(0, 0, W, H);
  if (v && (v.phase === 'silence' || v.phase === 'done')) return; // the silence is drawn as nothing
  g.strokeStyle = COLORS.line; g.lineWidth = 3;
  g.beginPath(); g.ellipse(X(0), Y(0.14), 88, 104, 0, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(X(-0.18), Y(-0.25)); g.lineTo(X(-0.46), Y(-0.5)); g.lineTo(X(-0.46), Y(-1.1));
  g.lineTo(X(0.5), Y(-1.1)); g.lineTo(X(0.5), Y(-0.45)); g.lineTo(X(0.2), Y(-0.25)); g.stroke();
  g.fillStyle = COLORS.quiet; g.font = '20px Inter, system-ui, sans-serif'; g.fillText('front', 12, H - 14); g.fillText('back', W - 58, H - 14);
  if (v?.phase === 'threshold') {
    g.fillStyle = COLORS.threshold; g.globalAlpha = 0.75;
    v.field.forEach(f => { g.beginPath(); g.arc(X(f.z), Y(f.y), Math.max(3, 8 + f.x * 4), 0, Math.PI * 2); g.fill(); });
    g.globalAlpha = 1; g.beginPath(); g.arc(X(THIRD_EYE[2]), Y(THIRD_EYE[1]), 7, 0, Math.PI * 2); g.fill();
    return;
  }
  const route = ROUTES[v?.route ?? settings.route];
  const line = (path: typeof route.up, col: string) => {
    g.strokeStyle = col; g.globalAlpha = 0.4; g.lineWidth = 4; g.beginPath();
    path.forEach(([, q], i) => (i ? g.lineTo(X(q[2]), Y(q[1])) : g.moveTo(X(q[2]), Y(q[1]))));
    g.stroke(); g.globalAlpha = 1;
  };
  line(route.up, COLORS.fire); line(route.down, COLORS.water);
  if (v?.armed) {
    g.strokeStyle = COLORS.turn; g.lineWidth = 2; g.setLineDash([6, 6]);
    g.beginPath(); g.arc(X(THIRD_EYE[2]), Y(THIRD_EYE[1]), 30, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  }
  const b = v?.ball; if (!b) return;
  const col = mix(COLORS.fire, COLORS.water, b.mix), cx = X(b.z), cy = Y(b.y), rp = Math.min(125, b.R * 235);
  g.fillStyle = col; g.globalAlpha = 0.18; g.beginPath(); g.arc(cx, cy, rp, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 0.9; g.strokeStyle = col; g.lineWidth = 5;
  for (let i = 0; i < 3; i++) {
    const a = b.spin + i * Math.PI * 2 / 3;
    g.beginPath(); g.ellipse(cx, cy, rp, rp * Math.abs(Math.cos(a)) + 2, Math.PI / 2, 0, Math.PI * 2); g.stroke();
  }
  g.globalAlpha = 1; g.beginPath(); g.arc(cx, cy, 6, 0, Math.PI * 2); g.fillStyle = col; g.fill();
}

export default function OrbitThresholdDesk() {
  const transport = usePersistentListening();
  const [settings, setSettings] = useState<OrbitSettings>(() => ({ ...shared.settings }));
  const [view, setView] = useState<OrbitView | null>(null);
  const [held, setHeldState] = useState(false);
  const [message, setMessage] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = transport?.snapshot.kind === 'sketch' && transport.snapshot.title === ORBIT_STUDY_TITLE &&
    transport.snapshot.playback === 'playing';
  const liveRef = useRef(live);
  useEffect(() => { liveRef.current = live; }, [live]);

  // Settings are one object shared with the running engine, so a change is heard at the next breath.
  const change = (next: Partial<OrbitSettings>) => {
    Object.assign(shared.settings, next);
    if ('route' in next || 'breaths' in next) shared.engine?.applyRoute();
    setSettings({ ...shared.settings });
  };
  const hold = (v: boolean) => { shared.engine?.setHeld(v); setHeldState(v); };

  useEffect(() => {
    let raf = 0, last = '';
    const frame = () => {
      const v = shared.engine?.view() ?? null;
      if (canvas.current) draw(canvas.current, v, shared.settings);
      const key = v ? `${v.phase}|${v.guide}|${v.point}|${v.orbits}|${v.armed}|${v.tone}` : '';
      if (key !== last) { last = key; setView(v); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Space as the breath key, only while this study is playing in "Follow my breath" and not while typing.
  useEffect(() => {
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName);
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !liveRef.current || shared.settings.pacing !== 'follow' || typing(e.target)) return;
      e.preventDefault(); if (!e.repeat) hold(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      // A release always counts, even while paused, so Resume never waits on a breath that already ended.
      hold(false);
      if (liveRef.current && shared.settings.pacing === 'follow' && !typing(e.target)) e.preventDefault();
    };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const begin = async () => {
    if (!transport) return;
    const started = await transport.playStudy(orbitThresholdStudy(shared.settings, e => { shared.engine = e; }));
    setMessage(started
      ? 'Playing. Level, Pause and Stop are in the player bar.'
      : 'Sound did not start. Another Soullab sound may be active, or MAIA may be speaking.');
  };
  const ended = view?.phase === 'done';
  const follow = settings.pacing === 'follow';
  const select = <K extends keyof OrbitSettings>(key: K, parse: (s: string) => OrbitSettings[K]) =>
    (e: ChangeEvent<HTMLSelectElement>) => change({ [key]: parse(e.target.value) } as Partial<OrbitSettings>);
  const slider = (key: keyof OrbitSettings, label: string, min: number, max: number, step: number, unit = '') => (
    <label className={styles.orbitCtl} key={key}>
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={settings[key] as number}
        onChange={e => change({ [key]: Number(e.target.value) } as Partial<OrbitSettings>)} />
      <span className={styles.muted}>{unit === '%' ? `${Math.round((settings[key] as number) * 100)}%` : unit ? `${settings[key]} ${unit}` : ''}</span>
    </label>
  );

  return (
    <section className={styles.toneLab} aria-labelledby="orbit-title" data-orbit-threshold="true">
      <span className={styles.smallcaps}>ORBIT &amp; THRESHOLD · SKETCH 06 · FOUNDER REVIEW</span>
      <h2 id="orbit-title">Circulate the orbit. Open the threshold when you choose.</h2>
      <p className={styles.muted}>
        A ball of fire rises up the back with each in-breath and turns to water at the third eye, flowing down the front.
        When you arm it, the next arrival at the third eye opens into a full field that gathers, narrows to a line,
        locks, and gives way to silence.
      </p>
      <p className={styles.muted} data-orbit-claim="true">{ORBIT_NOTES.claim}</p>

      <div className={styles.orbitRow}>
        <button type="button" className={styles.play} data-orbit-play="true" onClick={() => void begin()} disabled={!transport}>
          {live ? '▶  Playing' : ended ? '▶  Begin again' : '▶  Begin'}
        </button>
        {transport && live && <button type="button" className={styles.ghost} data-orbit-stop="true" onClick={() => transport.stopMusic()}>Stop</button>}
        <label>Pacing
          <select value={settings.pacing} onChange={select('pacing', s => (s === 'guided' ? 'guided' : 'follow'))}>
            <option value="follow">Follow my breath</option><option value="guided">Guided</option>
          </select>
        </label>
        <label>Rhythm
          <select value={settings.rhythm} onChange={select('rhythm', s => (s === 'channel' ? 'channel' : 'point'))}>
            <option value="point">One breath per point</option><option value="channel">One breath per channel</option>
          </select>
        </label>
      </div>
      <div className={styles.orbitRow}>
        <label>Breaths at each point
          <select value={settings.breaths} onChange={select('breaths', Number)}>
            {BREATH_CHOICES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label>Route
          <select value={settings.route} onChange={select('route', s => (s === 'lineage' ? 'lineage' : 'founder'))}>
            <option value="founder">Founder’s route (perineum → third eye → front)</option>
            <option value="lineage">Lineage reference (15 stops)</option>
          </select>
        </label>
      </div>
      <p className={styles.toneProvenance}>{ORBIT_NOTES.breath} {settings.route === 'lineage' ? ORBIT_NOTES.lineage : ''}</p>

      <div className={styles.orbitRow}>
        {follow && (
          <button type="button" data-orbit-breath="true" aria-pressed={held}
            className={held ? styles.orbitBreathHeld : styles.orbitBreath} disabled={!live}
            onPointerDown={e => { e.preventDefault(); hold(true); }}
            onPointerUp={() => hold(false)} onPointerLeave={() => hold(false)} onPointerCancel={() => hold(false)}>
            Hold while breathing in (or hold Space)
          </button>
        )}
        <button type="button" data-orbit-arm="true" aria-pressed={Boolean(view?.armed)} disabled={!live || view?.phase !== 'orbit'}
          className={view?.armed ? styles.focusChoiceActive : styles.focusChoice}
          onClick={() => shared.engine?.setArmed(!view?.armed)}>
          {view?.armed ? 'Armed: opens at the next third eye (tap to cancel)' : 'Open the threshold at the next third eye'}
        </button>
      </div>
      <div className={styles.orbitRow}>
        <label>Or open automatically after
          <select value={settings.autoOrbits} onChange={select('autoOrbits', Number)}>
            {AUTO_CHOICES.map(n => <option key={n} value={n}>{n ? `${n} orbits` : 'only by hand'}</option>)}
          </select>
        </label>
        <label>After the silence
          <select value={settings.returnAfterSec} onChange={select('returnAfterSec', Number)}>
            {RETURN_CHOICES.map(n => <option key={n} value={n}>{n ? `return to the orbit after ${n} s` : 'end in silence'}</option>)}
          </select>
        </label>
        <span className={styles.muted} data-orbit-count="true">Orbits: {view?.orbits ?? 0}</span>
      </div>

      <details className={styles.orbitDetails}>
        <summary>Orbit settings</summary>
        {!follow && slider('inhaleSec', 'Inhale (fire rising)', 3, 12, 0.5, 's')}
        {!follow && slider('exhaleSec', 'Exhale (water falling)', 3, 14, 0.5, 's')}
        {!follow && slider('holdSec', 'Space between elements', 0.5, 6, 0.25, 's')}
        {settings.rhythm === 'channel' && slider('dwell', 'Moment at each point', 0, 0.7, 0.01, '%')}
        {slider('expansion', 'Expansion at the turn', 0, 1, 0.01, '%')}
        {slider('rebound', 'Elastic rebound', 0, 1, 0.01, '%')}
      </details>
      <details className={styles.orbitDetails}>
        <summary>Threshold settings</summary>
        <div className={styles.orbitRow}>
          <label>Instant
            <select value={String(settings.instant)} onChange={select('instant', s => (s === 'random' ? 'random' : Number(s)))}>
              {INSTANT_CHOICES.map(n => <option key={n} value={n}>{n === 'random' ? 'random 4–7 s' : `${n} s`}</option>)}
            </select>
          </label>
          <label><input type="checkbox" checked={settings.handshake} onChange={e => change({ handshake: e.target.checked })} /> Handshake</label>
        </div>
        {slider('brightness', 'Harmonic brightness', 0, 1, 0.01, '%')}
        {slider('density', 'Vibrational density', 0, 1, 0.01, '%')}
        {slider('narrowness', 'How narrow the line gets', 0, 1, 0.01, '%')}
      </details>

      <div className={styles.orbitStage}>
        <p className={styles.orbitGuide} aria-live="polite" style={{ color: COLORS[view?.tone ?? 'quiet'] }}>{view?.guide || ' '}</p>
        <p className={styles.orbitPoint}>{view?.point || ' '}</p>
        <canvas ref={canvas} width={510} height={680} className={styles.orbitCanvas}
          aria-label="Side view of the body: the orbit, then the threshold field" />
      </div>
      {message && <p className={styles.focusStatus} role="status" aria-live="polite">{message}</p>}
      <p className={styles.toneProvenance} data-orbit-safety="true">{ORBIT_NOTES.safety} {ORBIT_NOTES.silence}</p>
    </section>
  );
}
