// LISTEN-01 · Orbit & Threshold — sketch 06 as a Sound Studio procedural study (founder ruling 2026-11-17).
//
// REVIEW-ONLY. Founder-directed artistic sketch, generated in the browser with no recorded media. It plays only
// through the persistent player (see proceduralStudy.ts). Nothing here measures the body: "Follow my breath" knows
// only when the listener presses and releases. The lineage route is a reference synthesized from contemporary
// manuals, not a single prescribed Taoist sequence. No state, effect or health outcome is claimed.
//
// Sources: founder observations 9–14 (Threshold & Return addendum, 16 Nov 2026) and the Orbit & Threshold spec
// v0.7 draft. The engine follows sketch 06 closely so that what the founder heard locally is what plays here.

import type { ProceduralStudy, ProceduralStudyAPI, ProceduralStudyHandle } from './proceduralStudy';

export type Vec3 = readonly [number, number, number];
export type Station = readonly [name: string, at: Vec3];
export type RouteId = 'founder' | 'lineage';
export type Breath = 'in' | 'out';

export type OrbitSettings = {
  pacing: 'follow' | 'guided';
  rhythm: 'point' | 'channel';
  breaths: number;            // 1 · 3 · 5 · 7 · 9
  route: RouteId;
  inhaleSec: number;          // guided pacing
  exhaleSec: number;
  holdSec: number;            // space between elements, channel rhythm
  dwell: number;              // moment at each point, channel rhythm (0..0.7)
  expansion: number;          // 0..1
  rebound: number;            // 0..1
  autoOrbits: number;         // 0 = only by hand
  returnAfterSec: number;     // 0 = end in silence
  instant: number | 'random'; // seconds, 4..7
  handshake: boolean;
  brightness: number;         // 0..1
  density: number;            // 0..1
  narrowness: number;         // 0..1
};

export const BREATH_CHOICES = [1, 3, 5, 7, 9] as const;
export const AUTO_CHOICES = [0, 3, 5, 7, 9] as const;
export const RETURN_CHOICES = [0, 30, 60] as const;
export const INSTANT_CHOICES = [4, 5, 6, 7, 'random'] as const;

export const DEFAULT_ORBIT_SETTINGS: OrbitSettings = Object.freeze({
  pacing: 'follow', rhythm: 'point', breaths: 1, route: 'founder',
  inhaleSec: 6, exhaleSec: 8, holdSec: 2.5, dwell: 0.4, expansion: 0.6, rebound: 0.6,
  autoOrbits: 0, returnAfterSec: 0, instant: 5, handshake: true,
  brightness: 0.6, density: 0.7, narrowness: 0.7,
});

export const ORBIT_STUDY_ID = 'orbit-threshold-sketch-06';
export const ORBIT_STUDY_TITLE = 'Orbit & Threshold';

export const ORBIT_NOTES = Object.freeze({
  breath: '"Follow my breath" only knows when you press and release. Nothing measures your breathing.',
  lineage: 'The lineage route is a reference synthesized from contemporary manuals, not a single prescribed Taoist sequence.',
  safety: 'Headphones are recommended. Start at a low level, because the threshold arrives suddenly. Breathe naturally, with no breath holds. If you feel dizzy or tingling, return to ordinary breathing or stop.',
  claim: 'An artistic sketch for review. It is not instruction in a Qigong lineage, does not reproduce or induce any state, and makes no health claim.',
  silence: 'After the lock, every sound stops and the silence is real.',
});

export const BALL = 0.17; // ≈ 7-inch ball
export const THIRD_EYE: Vec3 = [0, 0.18, -0.38];
const PERINEUM: Vec3 = [0, -1.15, 0];

export const ROUTES: Readonly<Record<RouteId, { up: readonly Station[]; down: readonly Station[] }>> = Object.freeze({
  founder: {
    up: [['Perineum', PERINEUM], ['Sacrum', [0, -0.95, 0.42]], ['Kidneys', [0, -0.62, 0.48]], ['Heart (back)', [0, -0.32, 0.48]],
      ['Base of neck', [0, -0.05, 0.40]], ['Base of skull', [0, 0.16, 0.34]], ['Crown', [0, 0.55, 0.02]], ['Third eye', THIRD_EYE]],
    down: [['Third eye', THIRD_EYE], ['Face', [0, 0, -0.40]], ['Throat', [0, -0.16, -0.32]], ['Heart (front)', [0, -0.36, -0.42]],
      ['Navel / dantian', [0, -0.72, -0.44]], ['Perineum', PERINEUM]],
  },
  lineage: {
    up: [['Lower dantian', [0, -0.75, -0.12]], ['Huiyin (perineum)', PERINEUM], ['Weilü (tailbone)', [0, -1.0, 0.40]],
      ['Mingmen (lumbar)', [0, -0.70, 0.48]], ['T11 (mid-back)', [0, -0.50, 0.50]], ['Shendao (rear heart)', [0, -0.30, 0.48]],
      ['Dazhui (base of neck)', [0, -0.05, 0.40]], ['Jade Pillow (base of skull)', [0, 0.16, 0.34]], ['Baihui (crown)', [0, 0.55, 0.02]],
      ['Yintang (third eye)', THIRD_EYE]],
    down: [['Yintang (third eye)', THIRD_EYE], ['Tongue–palate bridge', [0, -0.02, -0.30]], ['Tiantu (throat)', [0, -0.18, -0.32]],
      ['Danzhong (heart center)', [0, -0.38, -0.42]], ['Zhongwan (solar plexus)', [0, -0.58, -0.44]], ['Lower dantian', [0, -0.75, -0.12]]],
  },
});

// ── Pure sequencing (tested) ─────────────────────────────────────────────────────────────────────────
export type Step = {
  br: Breath;
  act: 'move' | 'rest' | 'turn';
  leg: 'up' | 'down';
  from?: number;
  to?: number;
  at?: number;
  el: 0 | 1;        // 0 fire, 1 water
  third?: boolean;  // the turn at the third eye: where the threshold may open
};

export function normalizeBreaths(n: unknown): number {
  const v = Number(n);
  return (BREATH_CHOICES as readonly number[]).includes(v) ? v : 1;
}

/** One breath per point. Up the back, the in-breath carries the ball to the next point and the out-breath rests
 * there; down the front, the out-breath carries and the in-breath rests. The third eye and the base each take a
 * full breath to turn. N = breaths at each point: the arrival breath plus (N−1) further full breaths of rest. */
export function buildSequence(route: RouteId, breaths: number): Step[] {
  const { up, down } = ROUTES[route] ?? ROUTES.founder;
  const N = normalizeBreaths(breaths);
  const s: Step[] = [];
  const extra = (leg: 'up' | 'down', at: number, el: 0 | 1, first: Breath) => {
    for (let k = 1; k < N; k++) {
      s.push({ br: first, act: 'rest', leg, at, el });
      s.push({ br: first === 'in' ? 'out' : 'in', act: 'rest', leg, at, el });
    }
  };
  for (let i = 1; i < up.length; i++) {
    s.push({ br: 'in', act: 'move', leg: 'up', from: i - 1, to: i, el: 0 });
    if (i < up.length - 1) { s.push({ br: 'out', act: 'rest', leg: 'up', at: i, el: 0 }); extra('up', i, 0, 'in'); }
  }
  const te = up.length - 1;
  s.push({ br: 'out', act: 'turn', leg: 'up', at: te, el: 1, third: true });
  s.push({ br: 'in', act: 'rest', leg: 'up', at: te, el: 1 }); extra('up', te, 1, 'out');
  for (let j = 1; j < down.length; j++) {
    s.push({ br: 'out', act: 'move', leg: 'down', from: j - 1, to: j, el: 1 });
    if (j < down.length - 1) { s.push({ br: 'in', act: 'rest', leg: 'down', at: j, el: 1 }); extra('down', j, 1, 'out'); }
  }
  const bt = down.length - 1;
  s.push({ br: 'in', act: 'turn', leg: 'down', at: bt, el: 0 });
  s.push({ br: 'out', act: 'rest', leg: 'down', at: bt, el: 0 }); extra('down', bt, 0, 'in');
  return s;
}

/** Fire climbs two octaves from 110 Hz at the base to 440 Hz at the third eye; water falls back again. */
export function elementPitches(isFireLeg: boolean, progress: number): { fire: number; water: number } {
  const u = Math.min(1, Math.max(0, progress));
  return { fire: isFireLeg ? 110 * 2 ** (2 * u) : 110, water: isFireLeg ? 440 : 440 * 2 ** (-2 * u) };
}

export function instantSeconds(choice: OrbitSettings['instant'], random = Math.random): number {
  if (choice === 'random') return 4 + random() * 3;
  const v = Number(choice);
  return Number.isFinite(v) ? Math.min(7, Math.max(4, v)) : 5;
}

const travel = (s: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, s)), 2.2);
const smooth = (a: number, b: number, x: number) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
function along(path: readonly Station[], u: number): { p: number[]; name: string } {
  u = Math.min(1, Math.max(0, u));
  const n = path.length - 1, f = u * n, i = Math.min(n - 1, Math.floor(f)), k = f - i, e = k * k * (3 - 2 * k);
  const a = path[i][1], b = path[i + 1][1];
  return { p: a.map((v, j) => v + (b[j] - v) * e), name: path[k < 0.5 ? i : i + 1][0] };
}
function stations(path: readonly Station[], s: number, dwell: number) {
  s = Math.min(1, Math.max(0, s));
  const n = path.length - 1, f = s * n, i = Math.min(n - 1, Math.floor(f)), k = f - i;
  const move = dwell > 0 ? Math.min(1, k / (1 - dwell)) : k;
  const rest = dwell > 0 && k > 1 - dwell ? (k - (1 - dwell)) / dwell : 0;
  const r = along(path, (i + move) / n) as { p: number[]; name: string; rest?: number };
  if (move >= 1) r.name = path[i + 1][0];
  r.rest = rest;
  return r;
}

// ── What the desk draws ───────────────────────────────────────────────────────────────────────────────
export type OrbitView = {
  phase: 'orbit' | 'threshold' | 'silence' | 'done';
  guide: string;
  point: string;
  tone: 'fire' | 'water' | 'turn' | 'threshold' | 'quiet';
  orbits: number;
  armed: boolean;
  ball: { y: number; z: number; R: number; mix: number; spin: number } | null;
  field: { x: number; y: number; z: number }[];
  route: RouteId;
};

export type OrbitEngine = ProceduralStudyHandle & {
  settings: OrbitSettings;
  setHeld: (held: boolean) => void;
  setArmed: (armed: boolean) => void;
  /** Call after changing route or breaths: rebuilds the sequence and restarts the circuit from the base. */
  applyRoute: () => void;
  view: () => OrbitView;
};

// The study's own output trim, before the player's shared level. The player's level scale is calibrated for
// quiet generated sound; this keeps sketch 06's internal balance and lets the shared level do the rest.
export const ORBIT_OUTPUT_TRIM = 0.5;
const TICK_MS = 25;
const K = 8, FB = 40, FIELD_END = 0.55, NARROW_END = 0.85;

type Panner = PannerNode;
type Src = AudioScheduledSourceNode;

export function createOrbitEngine(
  ctx: AudioContext, destination: AudioNode, settings: OrbitSettings, api: ProceduralStudyAPI,
): OrbitEngine {
  const master = ctx.createGain(); master.gain.value = ORBIT_OUTPUT_TRIM;
  const cap = ctx.createBiquadFilter(); cap.type = 'lowpass'; cap.frequency.value = 10000;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.25;
  master.connect(cap); cap.connect(comp); comp.connect(destination);

  let noise: AudioBuffer | null = null;
  const noiseBuf = () => {
    if (!noise) {
      noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noise;
  };
  const kit = (list: AudioNode[]) => {
    const keep = <T extends AudioNode>(n: T): T => (list.push(n), n);
    return {
      keep,
      G: (v: number) => { const g = keep(ctx.createGain()); g.gain.value = v; return g; },
      O: (f: number, t: OscillatorType = 'sine') => { const o = keep(ctx.createOscillator()); o.type = t; o.frequency.value = f; return o; },
      F: (t: BiquadFilterType, f: number, q = 0.707) => { const b = keep(ctx.createBiquadFilter()); b.type = t; b.frequency.value = f; b.Q.value = q; return b; },
      N: () => { const n = keep(ctx.createBufferSource()); n.buffer = noiseBuf(); n.loop = true; return n; },
      P: (roll = 0.2) => { const p = keep(ctx.createPanner()); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 1; p.rolloffFactor = roll; return p; },
    };
  };
  const setPos = (p: Panner, x: number, y: number, z: number, t: number, tc = 0.01) => {
    if (p.positionX) { p.positionX.setTargetAtTime(x, t, tc); p.positionY.setTargetAtTime(y, t, tc); p.positionZ.setTargetAtTime(z, t, tc); }
    else (p as unknown as { setPosition: (x: number, y: number, z: number) => void }).setPosition(x, y, z);
  };
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
  const kill = (list: AudioNode[], after = 0) => {
    const old = list.splice(0);
    const go = () => old.forEach(n => { try { (n as Src).stop?.(); } catch { /* not started */ } try { n.disconnect(); } catch { /* gone */ } });
    if (after > 0) later(go, after); else go();
  };

  let UP = ROUTES[settings.route].up, DOWN = ROUTES[settings.route].down;
  let SEQ = buildSequence(settings.route, settings.breaths);
  let held = false, armed = false, orbits = 0, disposed = false;
  let phase: OrbitView['phase'] = 'orbit';
  let guide = '', point = '', tone: OrbitView['tone'] = 'fire';
  let silenceAt = 0;

  // ── orbit ──
  type Voice = { o1: OscillatorNode; o2: OscillatorNode; o3?: OscillatorNode; g: GainNode };
  const OR = {
    nodes: [] as AudioNode[], on: false,
    fade: null as GainNode | null, pan: null as Panner | null, lp: null as BiquadFilterNode | null,
    fire: null as Voice | null, water: null as Voice | null,
    scrub: null as { n: AudioBufferSourceNode; f: BiquadFilterNode; g: GainNode; am: GainNode } | null,
    st: 'leg' as 'leg' | 'turn', leg: 'up' as 'up' | 'down', t0: 0, lastSwitch: 0, lastNow: 0, mix: 0, turnR: 0,
    rebound: { t: -99, r: 0 }, spin: 0, tor: 0, k: undefined as number | undefined, extra: 0, restT0: 0,
    expIn: 6, expEx: 8, p: [...PERINEUM] as number[], R: BALL,
  };
  function orbitStart(fadeIn = 2) {
    const k = kit(OR.nodes), t = ctx.currentTime + 0.05;
    const fade = OR.fade = k.G(0); fade.connect(master);
    fade.gain.setValueAtTime(0, t); fade.gain.linearRampToValueAtTime(1, t + fadeIn);
    [55, 82.5, 110].forEach((f, i) => { const o = k.O(f, 'triangle'), g = k.G([0.12, 0.06, 0.05][i]); o.connect(g); g.connect(fade); o.start(t); });
    OR.pan = k.P(); OR.lp = k.F('lowpass', 2000, 0.8);
    const bus = k.G(1); bus.connect(OR.lp); OR.lp.connect(OR.pan); OR.pan.connect(fade);
    const fire: Voice = { g: k.G(0), o1: k.O(110, 'sawtooth'), o2: k.O(110 * 1.006, 'sawtooth'), o3: k.O(220, 'square') };
    fire.g.connect(bus);
    const fb = k.F('bandpass', 900, 0.9), o3g = k.G(0.15);
    fire.o1.connect(fb); fire.o2.connect(fb); fire.o3!.connect(o3g); o3g.connect(fb);
    const flick = k.O(9), fd = k.G(0.25), fg2 = k.G(0.6); flick.connect(fd); fd.connect(fg2.gain); fb.connect(fg2); fg2.connect(fire.g);
    const cb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), cd = cb.getChannelData(0);
    for (let i = 0; i < cd.length; i++) cd[i] = Math.random() < 0.0012 ? (Math.random() * 2 - 1) : 0;
    const cr = k.keep(ctx.createBufferSource()); cr.buffer = cb; cr.loop = true;
    const crf = k.F('bandpass', 3000, 0.8), crg = k.G(0.5); cr.connect(crf); crf.connect(crg); crg.connect(fire.g);
    [fire.o1, fire.o2, fire.o3!, flick, cr].forEach(n => n.start(t));
    const water: Voice = { g: k.G(0), o1: k.O(440), o2: k.O(660, 'triangle') };
    water.g.connect(bus);
    const w2g = k.G(0.25); water.o1.connect(water.g); water.o2.connect(w2g); w2g.connect(water.g);
    const wn = k.N(), wf = k.F('bandpass', 700, 3), wng = k.G(0.35), gu = k.O(0.7), gd = k.G(400);
    gu.connect(gd); gd.connect(wf.frequency); wn.connect(wf); wf.connect(wng); wng.connect(water.g);
    [water.o1, water.o2, wn, gu].forEach(n => n.start(t));
    const scrub = { n: k.N(), f: k.F('bandpass', 1400, 1.4), g: k.G(0), am: k.G(0) };
    scrub.n.connect(scrub.f); scrub.f.connect(scrub.am); scrub.am.connect(scrub.g); scrub.g.connect(bus); scrub.n.start(t);
    const now = ctx.currentTime;
    Object.assign(OR, { fire, water, scrub, on: true, st: 'leg', leg: 'up', t0: now, lastSwitch: now, lastNow: now, mix: 0,
      turnR: 0, rebound: { t: -99, r: 0 }, spin: 0, tor: 0, k: undefined, extra: 0, p: [...UP[0][1]], R: BALL });
    phase = 'orbit';
  }
  function orbitStop(fade = 0.4) {
    if (!OR.on) return; OR.on = false;
    const now = ctx.currentTime;
    OR.fade?.gain.cancelScheduledValues(now); OR.fade?.gain.setTargetAtTime(0, now, fade / 3);
    kill(OR.nodes, fade * 1000 + 300);
  }
  const durOf = (leg: 'up' | 'down') => settings.pacing === 'guided'
    ? (leg === 'up' ? settings.inhaleSec : settings.exhaleSec) : (leg === 'up' ? OR.expIn : OR.expEx);
  const pathOf = (leg: 'up' | 'down') => (leg === 'up' ? UP : DOWN);
  const arrivedAtThirdEye = (now: number) => {
    orbits++;
    if (settings.autoOrbits && orbits >= settings.autoOrbits) armed = true;
    if (armed) { openThreshold(now); return true; }
    return false;
  };
  function startTurn(now: number) {
    if (OR.leg === 'up' && arrivedAtThirdEye(now)) return;
    OR.st = 'turn'; OR.t0 = now; OR.turnR = 0;
  }
  function startLeg(now: number, next: 'up' | 'down') {
    if (settings.pacing === 'follow') {
      const d = now - OR.lastSwitch;
      if (d > 1.2 && d < 25) { if (next === 'down') OR.expIn = OR.expIn * 0.6 + d * 0.4; else OR.expEx = OR.expEx * 0.6 + d * 0.4; }
      OR.lastSwitch = now;
    }
    OR.rebound = { t: now, r: OR.turnR }; OR.st = 'leg'; OR.leg = next; OR.t0 = now;
  }
  function channelUpdate(now: number, dt: number) {
    const follow = settings.pacing === 'follow', next = OR.leg === 'up' ? 'down' : 'up';
    if (OR.st === 'leg') {
      const s = (now - OR.t0) / durOf(OR.leg);
      if (s >= 1) startTurn(now);
      else if (follow && ((OR.leg === 'up' && !held && now - OR.t0 > 0.15) || (OR.leg === 'down' && held))) { startTurn(now); if (OR.on) OR.t0 = now - 0.9; }
    } else {
      const tt = now - OR.t0;
      if (!follow && tt >= settings.holdSec) startLeg(now, next);
      if (follow && ((next === 'up' && held) || (next === 'down' && !held)) && tt > 0.9) startLeg(now, next);
    }
    if (!OR.on) return;
    const turning = OR.st === 'turn', path = pathOf(OR.leg), dwell = settings.dwell;
    const sRaw = turning ? 1 : (now - OR.t0) / durOf(OR.leg);
    const u = turning ? 1 : (dwell > 0 ? sRaw : travel(sRaw));
    const r = turning ? { ...along(path, 1), rest: 0 } : stations(path, u, dwell);
    const atPoint = (r.rest ?? 0) > 0 ? Math.sin(Math.PI * (r.rest ?? 0)) : 0;
    const isFireLeg = OR.leg === 'up', nx = isFireLeg ? 'down' : 'up';
    const targetMix = turning ? (nx === 'down' ? 1 : 0) : (isFireLeg ? 0 : 1);
    const tc = turning ? (follow ? 0.8 : Math.max(0.3, settings.holdSec / 3)) : 0.15;
    let R = BALL;
    if (turning) { OR.turnR = BALL * 1.8 * settings.expansion * (1 - Math.exp(-(now - OR.t0) / 0.9)); R = BALL + OR.turnR; }
    else {
      const tr = now - OR.rebound.t, sp = settings.rebound;
      R = BALL + OR.rebound.r * Math.exp(-tr / (0.25 + 0.5 * sp)) * Math.cos(2 * Math.PI * tr * (1.2 + sp)) + BALL * 0.6 * settings.expansion * atPoint;
    }
    render(now, dt, r.p, R, turning, atPoint, isFireLeg, u, targetMix, tc,
      turning ? (nx === 'down' ? 'Holding at the third eye: fire becoming water' : 'Holding at the perineum: water becoming fire')
        : (isFireLeg ? 'Breathe in: up the back channel' : 'Breathe out: down the front channel'), r.name);
  }
  function pointAdvance(now: number) {
    const cur = SEQ[OR.k!];
    if (settings.pacing === 'follow') {
      const d = now - OR.t0;
      if (d > 1.2 && d < 25) { if (cur.br === 'in') OR.expIn = OR.expIn * 0.6 + d * 0.4; else OR.expEx = OR.expEx * 0.6 + d * 0.4; }
    }
    OR.k = (OR.k! + 1) % SEQ.length; OR.t0 = now;
    const nxt = SEQ[OR.k];
    if (nxt.act === 'move' && cur.act !== 'move') OR.rebound = { t: now, r: OR.extra || 0 };
    if (cur.act === 'move' && nxt.act !== 'move') OR.restT0 = now;
    if (nxt.third) arrivedAtThirdEye(now);
  }
  function pointUpdate(now: number, dt: number) {
    if (OR.k === undefined || OR.k >= SEQ.length) { OR.k = SEQ.length - 1; OR.t0 = now; OR.restT0 = now; }
    let cur = SEQ[OR.k];
    const guided = settings.pacing === 'guided';
    const exp = cur.br === 'in' ? (guided ? settings.inhaleSec : OR.expIn) : (guided ? settings.exhaleSec : OR.expEx);
    const t = now - OR.t0;
    if (guided ? t >= exp : ((cur.br === 'in' && !held) || (cur.br === 'out' && held)) && t > 0.3) {
      pointAdvance(now); if (!OR.on) return; cur = SEQ[OR.k!];
    }
    const path = pathOf(cur.leg), tt = now - OR.t0, n = path.length - 1, sp = settings.rebound;
    let p: number[], name: string, prog: number, atPoint = 0, R = BALL;
    const turning = cur.act === 'turn';
    if (cur.act === 'move') {
      const e = travel(tt / exp), a = path[cur.from!][1], b = path[cur.to!][1];
      p = a.map((v, j) => v + (b[j] - v) * e); name = path[cur.to!][0]; prog = (cur.from! + e) / n;
      const tr = now - OR.rebound.t;
      R = BALL + OR.rebound.r * Math.exp(-tr / (0.25 + 0.5 * sp)) * Math.cos(2 * Math.PI * tr * (1.2 + sp));
      OR.extra = 0;
    } else {
      p = [...path[cur.at!][1]]; name = path[cur.at!][0]; prog = cur.at! / n;
      atPoint = 1 - Math.exp(-(now - OR.restT0) / 0.8);
      const target = BALL * (turning ? 1.8 : 0.6) * settings.expansion * atPoint;
      OR.extra += (target - OR.extra) * (1 - Math.exp(-dt / 0.6)); R = BALL + OR.extra;
    }
    const isFireLeg = cur.leg === 'up';
    const L = settings.route === 'founder' ? name.toLowerCase() : name, b = cur.br === 'in' ? 'Breathe in' : 'Breathe out';
    const g = cur.act === 'move' ? `${b}: ${isFireLeg ? 'rising' : 'flowing down'} to the ${L}`
      : turning ? `${b}: holding at the ${L}, ${isFireLeg ? 'fire becoming water' : 'water becoming fire'}`
        : `${b}: resting at the ${L}`;
    render(now, dt, p, R, turning, turning ? 0 : atPoint, isFireLeg, prog, cur.el, turning ? Math.max(0.3, exp / 3) : 0.15, g, name);
  }
  function render(now: number, dt: number, p: number[], R: number, turning: boolean, atPoint: number, isFireLeg: boolean,
    u: number, targetMix: number, tc: number, g: string, name: string) {
    const { fire, water, scrub, pan, lp } = OR;
    if (!fire || !water || !scrub || !pan || !lp) return;
    OR.mix += (targetMix - OR.mix) * (1 - Math.exp(-dt / tc));
    const spinRate = turning ? 1.4 : (OR.mix < 0.5 ? 4.5 : 1.6) * (1 - 0.55 * atPoint);
    OR.spin += dt * spinRate * 2 * Math.PI; OR.tor += dt * 0.35 * 2 * Math.PI;
    const minor = R * 0.5, major = R * 0.6;
    setPos(pan, p[0] + (major + minor * Math.cos(OR.spin)) * Math.sin(OR.tor), p[1] + minor * Math.sin(OR.spin),
      p[2] + (major + minor * Math.cos(OR.spin)) * Math.cos(OR.tor) * 0.6, now);
    const h = (p[1] + 1.15) / 1.7;
    lp.frequency.setTargetAtTime(500 * Math.pow(12, h) * (1 + (R - BALL) * 2.5), now, 0.05);
    const bend = 1 + (R - BALL) * 0.25 * settings.rebound;
    const pitch = elementPitches(isFireLeg, u), ff = pitch.fire * bend, wf = pitch.water * bend;
    fire.o1.frequency.setTargetAtTime(ff, now, 0.05); fire.o2.frequency.setTargetAtTime(ff * 1.006, now, 0.05); fire.o3?.frequency.setTargetAtTime(ff * 2, now, 0.05);
    water.o1.frequency.setTargetAtTime(wf, now, 0.05); water.o2.frequency.setTargetAtTime(wf * 1.5, now, 0.05);
    const swell = turning ? 1 + 0.25 * settings.expansion : 1 + 0.15 * atPoint;
    fire.g.gain.setTargetAtTime((1 - OR.mix) * 0.55 * swell, now, 0.08);
    water.g.gain.setTargetAtTime(OR.mix * 0.6 * swell, now, 0.08);
    scrub.am.gain.setTargetAtTime(Math.pow(0.5 + 0.5 * Math.sin(OR.spin), 3), now, 0.01);
    scrub.g.gain.setTargetAtTime(turning ? 0.04 : (OR.mix < 0.5 ? 0.22 : 0.12), now, 0.1);
    scrub.f.frequency.setTargetAtTime(OR.mix < 0.5 ? 1800 : 700, now, 0.2);
    OR.p = p; OR.R = R;
    guide = g; tone = turning ? 'turn' : (OR.mix < 0.5 ? 'fire' : 'water');
    point = name + (armed && isFireLeg ? ': the threshold will open at the third eye' : '');
  }

  // ── threshold ──
  type FieldVoice = { p: Panner; th: number; ph: number; wth: number; wph: number; x: number; y: number; z: number };
  const TH = {
    nodes: [] as AudioNode[], on: false, T0: 0, L: 5, brk: 0, glide: 0, lastT: 0,
    voices: [] as FieldVoice[], shep: [] as { o: OscillatorNode; g: GainNode; k: number }[],
    buzz: [] as { ng: GainNode; am: OscillatorNode; amd: GainNode }[],
    scene: null as GainNode | null, shelf: null as BiquadFilterNode | null, hp: null as BiquadFilterNode | null,
    lp: null as BiquadFilterNode | null, shepBus: null as GainNode | null,
  };
  function openThreshold(now: number) {
    armed = false;
    orbitStop(0.35); // the ball dissolves into the field
    const k = kit(TH.nodes), on = now + 0.05, L = instantSeconds(settings.instant), brk = on + L, swell = Math.max(0.25, L * 0.1);
    const hsOn = settings.handshake, hsStart = on + L * NARROW_END;
    Object.assign(TH, { on: true, T0: on, L, brk, glide: 0, lastT: on, voices: [], shep: [], buzz: [] });
    phase = 'threshold';
    TH.shelf = k.F('highshelf', 1800); TH.hp = k.F('highpass', 20, 0.9); TH.lp = k.F('lowpass', 10000, 0.9);
    const scene = TH.scene = k.G(0); scene.connect(TH.shelf); TH.shelf.connect(TH.hp); TH.hp.connect(TH.lp); TH.lp.connect(master);
    scene.gain.setValueAtTime(0, on); scene.gain.linearRampToValueAtTime(1, on + swell);
    // The lock: an 8 ms raised-cosine fade to digital zero, never a click.
    const curve = new Float32Array(32); for (let i = 0; i < 32; i++) curve[i] = 0.5 + 0.5 * Math.cos(Math.PI * i / 31);
    scene.gain.setValueAtTime(1, brk - 0.009); scene.gain.setValueCurveAtTime(curve, brk - 0.008, 0.008);
    const roots = [98, 147, 196, 294, 392, 588, 784, 1176];
    const formants = [[300, 870, 2240], [530, 1840, 2480], [700, 1220, 2600], [400, 2000, 2550]];
    roots.forEach((f, i) => {
      const p = k.P(0.25); p.connect(scene); const vg = k.G(i < 2 ? 0.5 : 0.35); vg.connect(p);
      if (hsOn) { vg.gain.setValueAtTime(vg.gain.value, hsStart); vg.gain.linearRampToValueAtTime(vg.gain.value * 0.25, brk - 0.05); }
      const o = k.O(f * (1 + (Math.random() - 0.5) * 0.006), 'sawtooth'), vib = k.O(4.5 + Math.random()), vd = k.G(f * 0.004);
      vib.connect(vd); vd.connect(o.frequency);
      formants[i % 4].forEach((ff, j) => { const b = k.F('bandpass', ff, 9), bg = k.G([0.5, 0.3, 0.15][j]); o.connect(b); b.connect(bg); bg.connect(vg); });
      const n = k.N(), nb = k.F('bandpass', 2500 + i * 500, 5), ng = k.G(0), am = k.O(30), amd = k.G(0);
      am.connect(amd); amd.connect(ng.gain); n.connect(nb); nb.connect(ng); ng.connect(vg);
      TH.buzz.push({ ng, am, amd }); [o, vib, n, am].forEach(s => s.start(on));
      TH.voices.push({ p, th: (i / 8) * Math.PI * 2, ph: Math.random() * 6.28, wth: (0.9 + Math.random() * 0.5) * (i % 2 ? 1 : -1), wph: 1.6 + Math.random(), x: 0, y: 0, z: 0 });
    });
    const sp = k.P(0); setPos(sp, THIRD_EYE[0], THIRD_EYE[1], THIRD_EYE[2], on); sp.connect(scene);
    const sg = k.G(0); sg.connect(sp); TH.shepBus = sg;
    for (let i = 0; i < K; i++) { const o = k.O(FB * 2 ** i), g = k.G(0); o.connect(g); g.connect(sg); o.start(on); TH.shep.push({ o, g, k: i }); }
    if (hsOn) {
      const H = brk - hsStart, hp = k.P(0); setPos(hp, THIRD_EYE[0], THIRD_EYE[1], THIRD_EYE[2], on); hp.connect(scene);
      const hb = k.G(0); hb.connect(hp); hb.gain.setValueAtTime(0, hsStart); hb.gain.linearRampToValueAtTime(0.5, hsStart + 0.03);
      const a = k.O(2100), ag = k.G(0); a.connect(ag); ag.connect(hb);
      ag.gain.setValueAtTime(0, hsStart); ag.gain.linearRampToValueAtTime(0.35, hsStart + 0.02);
      ag.gain.setValueAtTime(0.35, hsStart + H * 0.22); ag.gain.linearRampToValueAtTime(0, hsStart + H * 0.25); a.start(hsStart);
      for (let s = 0; s < 3; s++) {
        const st = hsStart + H * (0.25 + s * 0.08), c = k.O(600, 'triangle'), cg = k.G(0);
        c.frequency.setValueAtTime(600, st); c.frequency.exponentialRampToValueAtTime(3000, st + H * 0.07);
        cg.gain.setValueAtTime(0, st); cg.gain.linearRampToValueAtTime(0.3, st + 0.01); cg.gain.linearRampToValueAtTime(0, st + H * 0.07);
        c.connect(cg); cg.connect(hb); c.start(st);
      }
      const w1 = k.O(1180, 'square'), w2 = k.O(1850, 'square'), wl = k.F('lowpass', 3200), wg = k.G(0);
      w1.connect(wl); w2.connect(wl); wl.connect(wg); wg.connect(hb);
      const ws = hsStart + H * 0.5; wg.gain.setValueAtTime(0, ws); wg.gain.linearRampToValueAtTime(0.12, ws + 0.02);
      for (let x = ws; x < brk - 0.02; x += 0.018 + Math.random() * 0.03) {
        const settle = (x - ws) / (brk - ws);
        if (Math.random() < 1 - settle * 0.8) { w1.frequency.setValueAtTime(Math.random() < 0.5 ? 980 : 1180, x); w2.frequency.setValueAtTime(Math.random() < 0.5 ? 1650 : 1850, x); }
      }
      w1.start(ws); w2.start(ws);
      const sn = k.N(), sb = k.F('bandpass', 1800, 1.2), sgn = k.G(0), gate = k.O(40, 'square'), gd = k.G(0.12);
      gate.frequency.setValueAtTime(40, ws); gate.frequency.exponentialRampToValueAtTime(240, brk);
      sgn.gain.setValueAtTime(0, ws); sgn.gain.linearRampToValueAtTime(0.25, brk - 0.05);
      gate.connect(gd); gd.connect(sgn.gain); sn.connect(sb); sb.connect(sgn); sgn.connect(hb); sn.start(ws); gate.start(ws);
    }
    guide = 'Threshold'; point = 'Third eye'; tone = 'threshold';
  }
  function thresholdUpdate(now: number) {
    // The lock is decided on the audio clock, so a Pause during the instant holds it rather than cutting early.
    if (now >= TH.brk + 0.1) { TH.on = false; kill(TH.nodes); silenceBegins(now); return; }
    const dt = now - TH.lastT; TH.lastT = now;
    const u = Math.min(1, Math.max(0, (now - TH.T0) / TH.L)), ce = smooth(0, FIELD_END + 0.1, u);
    const nz = smooth(FIELD_END, NARROW_END, u) * settings.narrowness;
    const { shelf, hp, lp, shepBus } = TH;
    if (!shelf || !hp || !lp || !shepBus) return;
    shelf.gain.setTargetAtTime(-12 + 20 * settings.brightness, now, 0.05);
    hp.frequency.setTargetAtTime(20 * Math.pow(30, nz), now, 0.03); lp.frequency.setTargetAtTime(10000 * Math.pow(0.26, nz), now, 0.03);
    hp.Q.setTargetAtTime(0.9 + 3 * nz, now, 0.03); lp.Q.setTargetAtTime(0.9 + 3 * nz, now, 0.03);
    const R = 1.3, r = 0.7, speed = 1 + 2 * ce, el = now - TH.T0;
    TH.voices.forEach(v => {
      const th = v.th + el * v.wth * speed, ph = v.ph + el * v.wph * speed;
      const x = (R + r * Math.cos(ph)) * Math.cos(th), z = (R + r * Math.cos(ph)) * Math.sin(th), y = r * Math.sin(ph);
      v.x = x * (1 - ce) + THIRD_EYE[0] * ce; v.y = y * (1 - ce) + THIRD_EYE[1] * ce; v.z = z * (1 - ce) + THIRD_EYE[2] * ce;
      setPos(v.p, v.x, v.y, v.z, now, 0.02);
    });
    const dens = settings.density;
    TH.buzz.forEach(b => { b.ng.gain.setTargetAtTime(0.05 + 0.25 * dens, now, 0.05); b.amd.gain.setTargetAtTime(0.05 + 0.25 * dens, now, 0.05); b.am.frequency.setTargetAtTime(20 + (30 + 60 * dens) * ce, now, 0.05); });
    TH.glide += dt * (0.4 + 1.6 * ce); shepBus.gain.setTargetAtTime(0.12 + 0.18 * ce, now, 0.05);
    TH.shep.forEach(s => {
      const pos = (s.k + TH.glide) % K, f = FB * 2 ** pos;
      s.o.frequency.setTargetAtTime(f, now, pos < 0.05 ? 0 : 0.015);
      s.g.gain.setTargetAtTime(f > 9000 ? 0 : Math.sin(Math.PI * pos / K) ** 2 * 0.25, now, 0.015);
    });
    guide = u < NARROW_END ? 'Threshold' : 'The line'; point = 'Third eye'; tone = 'threshold';
  }

  // ── silence & return ──
  function silenceBegins(now: number) {
    phase = 'silence'; silenceAt = now; guide = 'Silence'; point = ''; tone = 'quiet';
  }
  function silenceUpdate(now: number) {
    const ret = settings.returnAfterSec;
    if (ret > 0 && now - silenceAt >= ret) { orbitStart(8); return; }
    if (ret <= 0 && now - silenceAt >= 12) {
      phase = 'done'; guide = 'End'; tone = 'quiet';
      api.ended(`${ORBIT_STUDY_TITLE} ended in silence. It will not restart automatically.`);
    }
  }

  // ── clock ──
  const interval = setInterval(() => {
    if (disposed || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (OR.on) {
      const dt = Math.min(0.1, Math.max(0, now - OR.lastNow)); OR.lastNow = now;
      if (settings.rhythm === 'point') pointUpdate(now, dt); else channelUpdate(now, dt);
    }
    if (TH.on) thresholdUpdate(now);
    else if (phase === 'silence') silenceUpdate(now);
  }, TICK_MS);

  orbitStart(2);

  return {
    settings,
    setHeld: v => { held = Boolean(v); },
    setArmed: v => { armed = Boolean(v) && phase === 'orbit'; },
    applyRoute: () => {
      UP = ROUTES[settings.route].up; DOWN = ROUTES[settings.route].down;
      SEQ = buildSequence(settings.route, settings.breaths);
      if (OR.on) { OR.k = undefined; OR.st = 'leg'; OR.leg = 'up'; OR.t0 = ctx.currentTime; }
    },
    view: () => ({
      phase, guide, point, tone, orbits, armed, route: settings.route,
      ball: OR.on ? { y: OR.p[1], z: OR.p[2], R: OR.R, mix: OR.mix, spin: OR.spin } : null,
      field: TH.on ? TH.voices.map(v => ({ x: v.x, y: v.y, z: v.z })) : [],
    }),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      clearInterval(interval);
      timers.forEach(t => clearTimeout(t)); timers.clear();
      OR.on = false; TH.on = false;
      kill(OR.nodes); kill(TH.nodes);
      for (const n of [master, cap, comp]) { try { n.disconnect(); } catch { /* gone */ } }
    },
  };
}

/** The study the persistent player plays. `onEngine` lets the desk read the running engine to draw and steer it. */
export function orbitThresholdStudy(settings: OrbitSettings, onEngine: (engine: OrbitEngine | null) => void): ProceduralStudy {
  return {
    id: ORBIT_STUDY_ID,
    title: ORBIT_STUDY_TITLE,
    subtitle: 'Sketch 06 · founder review',
    message: 'Original sound generated in your browser · review sketch · no state or effect is claimed.',
    build: (context, destination, api) => {
      const engine = createOrbitEngine(context, destination, settings, api);
      onEngine(engine);
      return { dispose: () => { engine.dispose(); onEngine(null); } };
    },
  };
}
