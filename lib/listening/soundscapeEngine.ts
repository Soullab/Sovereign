// FOCUS-SOUNDSCAPE-01 · Web Audio engine for a SoundscapeSpec. Pure synthesis: no files, no network, no
// microphone. It builds into any BaseAudioContext, so the same graph renders live (the one persistent player)
// and offline (for measurement). Nothing starts a context; the caller does, after the member's own Play.
import { soundscapeNeedsRebuild } from './focusSoundscape';
import { GENERATED_OUTPUT_SCALE, ORIGINAL_OUTPUT_SCALE, TONE_OUTPUT_SCALE } from './listeningLevel';
import { TONE_FADE_IN_SEC, TONE_FADE_OUT_SEC, TONE_VOICE_GAIN, toneEffectiveLevel } from './toneLab';
import type { ToneSpec } from './toneLab';
import type { RecordedLayerId, SoundscapeSpec, TickSpec, WeaveMomentId } from './focusSoundscape';

/** Loads one recorded loop. Returns null when it is unavailable; the soundscape then plays without it. */
export type RecordedLoader = (id: RecordedLayerId | WeaveMomentId) => Promise<AudioBuffer | null>;

export type SoundscapeHandle = {
  context: BaseAudioContext;
  master: GainNode;
  oscillators: OscillatorNode[];
  voices: GainNode[];
  filter: BiquadFilterNode;
  movement: OscillatorNode;
  movementDepth: GainNode;
  spec: SoundscapeSpec;
  /** Smoothly apply a changed spec. Returns false when the palette differs and a new sound is needed. */
  update(next: SoundscapeSpec): boolean;
  /** Schedule events (clicks, plucks) between two context times. Live use calls this on a timer. */
  scheduleTicks(from: number, to: number): void;
  /** The member's Overtones setting, as a bus gain (overtoneSetting.ts); 0 silences them. No effect on Tone Lab. */
  setOvertoneBusGain(gain: number): void;
  /** The member's Nature recordings amount (0–1) for every recorded layer; 0 is synthesis alone. */
  setRecordedAmount(amount: number): void;
  /** The member's tone-layer amount (0–1); 1 is as loud as Tone Lab itself at the same Level, never louder. */
  setToneLayerAmount(amount: number): void;
  /** Tell the engine the member's Level (0–1) so the tone layer keeps to Tone Lab's cap. */
  setLevel(level: number): void;
  /** The tone layer's current bus gain (0 when there is none), for tests and the picker. */
  toneLayerGain(): number;
  /** The member's Weave amount (0–1): how present the woven moments are; 0 weaves nothing. */
  setWeaveAmount(amount: number): void;
  /** Which weave moments are real recordings this sound can draw on. */
  weaveMoments(): WeaveMomentId[];
  /** Which recorded layers this sound asked for, and whether each is a real recording, loading or missing. */
  recordedLayers(): Partial<Record<RecordedLayerId, RecordedLayerState>>;
  onRecordedLayers(listener: (state: Partial<Record<RecordedLayerId, RecordedLayerState>>) => void): () => void;
  dispose(): void;
};

export type RecordedLayerState = 'loading' | 'recorded' | 'missing';

/** Longest crossfade between two recorded segments, in seconds (a sixth of a short clip at most). */
export const RECORDED_SEGMENT_FADE_MAX_SEC = 3;
const PHI = 0.6180339887498949;
const frac = (x: number) => x - Math.floor(x);

/** The k-th segment a recorded layer plays (founder, 2026-11-21: the gull in a short loop was "a bit too regular which
 * makes it sound more like a loop"; then "more immersive and longer flows"). Instead of one loop repeating on a fixed
 * cycle, a layer plays overlapping segments from changing points of the recording, of changing lengths (40–85% of
 * it), each crossfaded (equal power) into the next. The sequence is a golden-ratio walk: irregular, never random, so
 * the same choices always give the same sound. */
export function recordedSegment(k: number, lengthSec: number): { offset: number; duration: number; fade: number } {
  const fade = Math.min(RECORDED_SEGMENT_FADE_MAX_SEC, lengthSec / 6);
  const duration = Math.min(lengthSec, Math.max(2 * fade + 0.5, lengthSec * (0.4 + 0.45 * frac((k + 1) * PHI * PHI))));
  const offset = frac((k + 1) * PHI) * Math.max(0, lengthSec - duration);
  return { offset, duration, fade };
}

/** The k-th woven moment (see SoundscapeSpec.weave). Gaps of 20–60 s follow a golden-ratio walk, so the timing feels
 * related but the ear cannot settle on a pattern, and it never locks to the music's pulse. The same choices always
 * give the same weave. Fades take 35% of the moment each way; it plays slightly slowed (0.88–1.0) and placed at a
 * changing point in the stereo field, sent mostly into a soft distance, like something half-remembered. */
export const WEAVE_FIRST_SEC = 24;
export const WEAVE_PEAK = 0.3; // at Weave 100%: about 10 dB under a recorded layer at its usual mix (0.4–0.8); 50% is the default
export function weaveMoment(k: number, count: number, previous = -1): { gapSec: number; index: number; rate: number; pan: number } {
  const gapSec = k === 0 ? WEAVE_FIRST_SEC : 20 + 40 * frac((k + 1) * PHI * PHI);
  let index = Math.floor(frac((k + 1) * PHI * 3) * count);
  if (count > 1 && index === previous) index = (index + 1) % count; // never the same moment twice running
  return { gapSec, index, rate: 0.88 + 0.12 * frac((k + 1) * PHI * 5), pan: -0.6 + 1.2 * frac((k + 1) * PHI * 7) };
}

const CURVE_POINTS = 64;
const FADE_IN_CURVE = Float32Array.from({ length: CURVE_POINTS }, (_, i) => Math.sin((i / (CURVE_POINTS - 1)) * Math.PI / 2));
const FADE_OUT_CURVE = Float32Array.from({ length: CURVE_POINTS }, (_, i) => Math.cos((i / (CURVE_POINTS - 1)) * Math.PI / 2));

const SCALE = GENERATED_OUTPUT_SCALE; // same output scale as the original studies; the member's volume multiplies it
const PLUCK_RATIOS = [1, 1.125, 1.5, 1.6667, 2, 1.5, 1.125, 1];
// Warm overtones (founder listening A/B, #1979, 2026-11-21: "D is really helpful. I like the tone by itself but the
// warm overtone makes it received better", at the Amount heard, 50%). Each voice carries quiet sine copies at 2×, 3×
// and 4× its own pitch (1/n², detune-locked), rounded off by a soft 900 Hz low-pass. They add no note and do not
// change the pitch; they let laptop and phone speakers, which barely play the low notes, carry the sound. They
// follow each voice's level and the slow pulse, and pass through the one master, so the Level governs them.
// Focus soundscapes only: a Tone Lab sound stays a pure tone.
export const SOUNDSCAPE_OVERTONE_PARTIALS = [2, 3, 4] as const;
export const SOUNDSCAPE_OVERTONE_SOFT_HZ = 900; // on the default choices; each choice sets its own (spec.overtoneSoftHz)
export const SOUNDSCAPE_OVERTONE_BUS_GAIN = 3.0; // 50% of the Shelf's 6.0: the default; the member's Overtones setting sets it
const SOUNDSCAPE_OVERTONE_HIGHEST_HZ = 4000;
const overtoneGain = (n: number, hz: number) => (hz > SOUNDSCAPE_OVERTONE_HIGHEST_HZ ? 0 : 1 / (n * n));

/**
 * A piece of ONE long timeline (the audio-file export, #1979; founder 2026-11-21: "Yes, options 1+2"). A long file is
 * rendered in pieces; each piece is built as if the sound had been playing since global time 0 and this context's
 * time 0 is global time `origin`. Every oscillator starts at the phase it would have there, the noise and every
 * recorded segment and weave moment are where the one continuous walk puts them, and a later piece starts already
 * settled (no fade-in). So two pieces that overlap produce the same sound, and the joins cannot be heard.
 * `horizonSec`: how far ahead to schedule recorded segments and weave moments (the whole piece). Live play never
 * passes a timeline and is unchanged.
 */
export type SoundscapeTimeline = { origin: number; horizonSec: number };

/** Phase, in cycles (0–1), that a wave of `hz` started at global 0 has reached at global time `origin`. */
export function phaseAt(hz: number, origin: number): number {
  return hz > 0 && origin > 0 ? frac(hz * origin) : 0;
}

/** Envelope for one recorded segment or weave moment that started at context time `at`, which may be before `from`
 * (a piece of the timeline that begins mid-segment): fade in, hold, fade out (equal power), each scaled by `peak`. */
function scheduleEnvelope(param: AudioParam, at: number, from: number, duration: number, fade: number, peak: number): void {
  const e = Math.max(0, from - at);
  const curve = (shape: (x: number) => number, x0: number) =>
    Float32Array.from({ length: CURVE_POINTS }, (_, i) => peak * shape(x0 + (1 - x0) * (i / (CURVE_POINTS - 1))));
  const rise = (x: number) => Math.sin(x * Math.PI / 2);
  const fall = (x: number) => Math.cos(x * Math.PI / 2);
  const outStart = duration - fade;
  if (e < fade - 1e-4) param.setValueCurveAtTime(curve(rise, e / fade), at + e, fade - e);
  else if (e < outStart) param.setValueAtTime(peak, at + e);
  if (e <= outStart) param.setValueCurveAtTime(curve(fall, 0), at + outStart, fade);
  else if (duration - e > 1e-4) param.setValueCurveAtTime(curve(fall, (e - outStart) / fade), at + e, duration - e);
}

function noiseBuffer(context: BaseAudioContext, seconds = 2): AudioBuffer {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 0x9e3779b9; // deterministic noise: the same choices give the same sound
  for (let i = 0; i < length; i++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    data[i] = ((seed >>> 0) / 0xffffffff) * 2 - 1;
  }
  return buffer;
}

export function buildSoundscape(
  context: BaseAudioContext, destination: AudioNode, initial: SoundscapeSpec, level: number, loadRecorded?: RecordedLoader,
  overtoneBusGain: number = SOUNDSCAPE_OVERTONE_BUS_GAIN, recordedAmount = 1, weaveAmount = 0.5, toneLayerAmount = 0.5,
  timeline?: SoundscapeTimeline,
): SoundscapeHandle {
  let spec = initial;
  const t0 = context.currentTime;
  // A later piece of an exported timeline starts settled and in phase (see SoundscapeTimeline). Live: origin 0.
  const origin = timeline ? Math.max(0, timeline.origin) : 0;
  const settled = origin > 0;
  // Start an oscillator at the phase the one continuous timeline gives it. On a timeline every wave is built from the
  // Web Audio standard's own series for its type, shifted to that phase (sin(n(ωt + φ)) per partial), so a piece's
  // sound is the continuous sound sample for sample. Live play keeps the built-in waves, started at t0.
  const startInPhase = (osc: OscillatorNode, hz: number) => {
    if (!timeline || typeof context.createPeriodicWave !== 'function' || osc.type === 'custom') { osc.start(t0); return; }
    // The frequency the oscillator really runs at is the 32-bit value its parameter holds: carry the detune in it and
    // take the phase from that exact value, so the phase stays right hours into the timeline.
    if (hz > 0) { osc.frequency.value = hz; osc.detune.value = 0; }
    const p = 2 * Math.PI * phaseAt(Math.fround(hz), origin);
    const type = osc.type;
    const count = type === 'sine' ? 2 : 2048;
    const real = new Float32Array(count); const imag = new Float32Array(count);
    for (let n = 1; n < count; n++) {
      const b = type === 'sine' ? (n === 1 ? 1 : 0)
        : type === 'square' ? (2 / (n * Math.PI)) * (1 - (-1) ** n)
        : type === 'sawtooth' ? ((-1) ** (n + 1)) * 2 / (n * Math.PI)
        : 8 * Math.sin(n * Math.PI / 2) / (Math.PI * n) ** 2; // triangle
      real[n] = b * Math.sin(n * p); imag[n] = b * Math.cos(n * p);
    }
    osc.setPeriodicWave(context.createPeriodicWave(real, imag, { disableNormalization: type === 'sine' }));
    osc.start(t0);
  };
  const master = context.createGain();
  // Tone Lab plays at the shared level but never above its cap, so a turned-up level cannot make a pure tone loud.
  const playLevel = (value: number) => (spec.tone ? toneEffectiveLevel(value * 100) / 100 : value);
  // Tone Lab keeps its original absolute scale (founder ruling 2026-11-19): only non-tone sound was raised.
  const masterTarget = Math.max(0.0001, playLevel(level) * (spec.tone ? TONE_OUTPUT_SCALE : SCALE));
  if (settled) master.gain.setValueAtTime(masterTarget, t0);
  else {
    master.gain.setValueAtTime(0.0001, t0);
    master.gain.exponentialRampToValueAtTime(masterTarget, t0 + Math.max(1, spec.fadeInSec));
  }
  master.connect(destination);

  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = spec.lowpassHz;
  const pulseGain = context.createGain();
  pulseGain.gain.value = 1;
  const bus = context.createGain();
  bus.connect(pulseGain); pulseGain.connect(filter); filter.connect(master);

  const oscillators: OscillatorNode[] = [];
  const voices: GainNode[] = [];
  const panners: StereoPannerNode[] = [];
  spec.voices.forEach(voice => {
    const osc = context.createOscillator();
    osc.type = voice.type;
    osc.frequency.value = spec.root * voice.ratio;
    osc.detune.value = voice.detuneCents;
    const gain = context.createGain();
    gain.gain.value = voice.gain;
    osc.connect(gain);
    if (typeof context.createStereoPanner === 'function') {
      const pan = context.createStereoPanner();
      pan.pan.value = voice.pan;
      gain.connect(pan); pan.connect(bus); panners.push(pan);
    } else gain.connect(bus);
    startInPhase(osc, spec.root * voice.ratio * 2 ** (voice.detuneCents / 1200));
    oscillators.push(osc); voices.push(gain);
  });

  // Pulse: a slow amplitude movement. Its rate is capped well below any flicker rate by the spec.
  const movement = context.createOscillator();
  movement.type = 'sine';
  movement.frequency.value = Math.max(0.0001, spec.pulseHz);
  const movementDepth = context.createGain();
  movementDepth.gain.value = spec.pulseHz > 0 ? spec.pulseDepth : 0;
  movement.connect(movementDepth); movementDepth.connect(pulseGain.gain);
  startInPhase(movement, spec.pulseHz > 0 ? spec.pulseHz : 0);

  // Warm overtones (see SOUNDSCAPE_OVERTONE_PARTIALS). Not for a Tone Lab sound.
  const overtoneOscillators: OscillatorNode[] = [];
  const overtoneVoices: { follower: GainNode; partials: { osc: OscillatorNode; gain: GainNode; n: number }[] }[] = [];
  let overtoneSoft: BiquadFilterNode | null = null;
  let overtoneBus: GainNode | null = null;
  if (!spec.tone) {
    const soft = context.createBiquadFilter(); overtoneSoft = soft;
    soft.type = 'lowpass'; soft.frequency.value = spec.overtoneSoftHz ?? SOUNDSCAPE_OVERTONE_SOFT_HZ; soft.Q.value = 0.5;
    const swell = context.createGain(); swell.gain.value = 1;
    movementDepth.connect(swell.gain); // the same slow pulse as the voices
    const otBus = context.createGain(); overtoneBus = otBus; otBus.gain.value = Math.max(0, overtoneBusGain);
    soft.connect(swell); swell.connect(otBus); otBus.connect(master);
    spec.voices.forEach(voice => {
      const follower = context.createGain(); follower.gain.value = voice.gain; follower.connect(soft);
      const partials = SOUNDSCAPE_OVERTONE_PARTIALS.map(n => {
        const hz = spec.root * voice.ratio * n;
        const osc = context.createOscillator(); osc.type = 'sine'; osc.frequency.value = hz; osc.detune.value = voice.detuneCents;
        const gain = context.createGain(); gain.gain.value = overtoneGain(n, hz);
        osc.connect(gain); gain.connect(follower); startInPhase(osc, hz * 2 ** (voice.detuneCents / 1200)); overtoneOscillators.push(osc);
        return { osc, gain, n };
      });
      overtoneVoices.push({ follower, partials });
    });
  }

  // Drift: a very slow movement of the tone's brightness, so it never sits perfectly still.
  const drift = context.createOscillator();
  drift.type = 'sine'; drift.frequency.value = 0.043;
  const driftGain = context.createGain();
  driftGain.gain.value = spec.lowpassHz * 0.22 * spec.driftDepth;
  drift.connect(driftGain); driftGain.connect(filter.frequency);
  startInPhase(drift, 0.043);

  const extras: AudioScheduledSourceNode[] = [];
  let noiseGain: GainNode | null = null;
  let noiseBand: BiquadFilterNode | null = null;
  let sweepDepth: GainNode | null = null;
  if (spec.noise) {
    const source = context.createBufferSource();
    source.buffer = noiseBuffer(context); source.loop = true;
    noiseBand = context.createBiquadFilter();
    noiseBand.type = 'bandpass'; noiseBand.frequency.value = spec.noise.bandHz; noiseBand.Q.value = spec.noise.q;
    noiseGain = context.createGain(); noiseGain.gain.value = spec.noise.gain;
    const sweep = context.createOscillator();
    sweep.type = 'sine'; sweep.frequency.value = Math.max(0.0001, spec.noise.sweepHz);
    sweepDepth = context.createGain(); sweepDepth.gain.value = spec.noise.bandHz * 0.4;
    sweep.connect(sweepDepth); sweepDepth.connect(noiseBand.frequency);
    source.connect(noiseBand); noiseBand.connect(noiseGain); noiseGain.connect(master);
    source.start(t0, origin % (source.buffer?.duration || 2)); startInPhase(sweep, spec.noise.sweepHz > 0 ? spec.noise.sweepHz : 0);
    extras.push(source, sweep);
  }

  // Tone Lab: one pure tone, with an optional slow pulse. Sound only: nothing here can flicker anything on screen.
  // It joins the master directly (not the soft lowpass), so the pitch the member chose is the pitch they hear.
  // ONE builder serves both Tone Lab (spec.tone) and a soundscape's tone layer (spec.toneLayer): no second engine.
  type ToneGraph = { base: OscillatorNode; second: OscillatorNode | null; lfo: OscillatorNode | null; mode: ToneSpec['pulseMode'] };
  const buildToneGraph = (into: AudioNode, tone: ToneSpec, at: number): ToneGraph => {
    const { hz, pulseMode, pulseHz } = tone;
    const sine = (freq: number) => { const o = context.createOscillator(); o.type = 'sine'; o.frequency.value = freq; return o; };
    const base = sine(hz);
    let second: OscillatorNode | null = null;
    let lfo: OscillatorNode | null = null;
    if (pulseMode === 'binaural' && typeof context.createStereoPanner === 'function') {
      second = sine(hz + pulseHz);
      const left = context.createStereoPanner(); left.pan.value = -1;
      const right = context.createStereoPanner(); right.pan.value = 1;
      base.connect(left); left.connect(into);
      second.connect(right); right.connect(into);
    } else if (pulseMode === 'binaural' || pulseMode === 'monaural') {
      second = sine(hz + pulseHz);
      const a = context.createGain(); a.gain.value = 0.5;
      const b = context.createGain(); b.gain.value = 0.5;
      base.connect(a); a.connect(into); second.connect(b); b.connect(into);
    } else if (pulseMode === 'isochronic') {
      // A smooth swell between silence and full, never an on/off edge.
      const swell = context.createGain(); swell.gain.value = 0.5;
      lfo = sine(Math.max(0.0001, pulseHz));
      const depth = context.createGain(); depth.gain.value = 0.5;
      lfo.connect(depth); depth.connect(swell.gain);
      base.connect(swell); swell.connect(into);
    } else {
      base.connect(into);
    }
    for (const node of [base, second, lfo]) if (node) { if (at === t0) startInPhase(node, node.frequency.value); else node.start(at); extras.push(node); }
    return { base, second, lfo, mode: pulseMode };
  };
  const retuneToneGraph = (graph: ToneGraph, tone: ToneSpec) => {
    gently(graph.base.frequency, tone.hz);
    if (graph.second) gently(graph.second.frequency, tone.hz + tone.pulseHz);
    if (graph.lfo) gently(graph.lfo.frequency, Math.max(0.0001, tone.pulseHz));
  };
  let toneGraph: ToneGraph | null = null;
  if (spec.tone) {
    const toneBus = context.createGain();
    toneBus.gain.value = TONE_VOICE_GAIN;
    toneBus.connect(master);
    toneGraph = buildToneGraph(toneBus, spec.tone, t0);
  }

  // A soundscape's TONE LAYER (N2, #1979; founder 2026-11-21: "Yes, build N2"). The member's tone and pulse sit
  // inside the soundscape on their own bus, while the soundscape keeps its own rules (overtones, Level scale). The
  // layer can never be louder than Tone Lab itself allows: its bus is scaled so that, at any Level, the tone reaches
  // the speaker at most as Tone Lab would at that Level (capped at TONE_LEVEL_CAP on the original scale).
  // toneLab.ts stays the one owner of that cap. No overtones are ever added to the tone.
  let currentLevel = level;
  let layerAmount = Math.max(0, Math.min(1, toneLayerAmount));
  let layer: { bus: GainNode; graph: ToneGraph } | null = null;
  const layerGain = () => {
    const L = Math.max(0, Math.min(1, currentLevel)) * 100;
    if (L <= 0) return 0;
    return layerAmount * TONE_VOICE_GAIN * (toneEffectiveLevel(L) / L) * (TONE_OUTPUT_SCALE / SCALE);
  };
  const retireLayer = (old: { bus: GainNode; graph: ToneGraph }) => {
    const now = context.currentTime;
    old.bus.gain.cancelScheduledValues(now); old.bus.gain.setTargetAtTime(0, now, TONE_FADE_OUT_SEC / 3);
    for (const node of [old.graph.base, old.graph.second, old.graph.lfo]) if (node) { try { node.stop(now + TONE_FADE_OUT_SEC * 2); } catch { /* stopped */ } }
  };
  const applyToneLayer = (next: ToneSpec | null | undefined) => {
    if (spec.tone) return; // a Tone Lab sound is already a tone; it never carries a second one
    if (!next) { if (layer) { retireLayer(layer); layer = null; } return; }
    if (layer && layer.graph.mode === next.pulseMode) { retuneToneGraph(layer.graph, next); return; }
    if (layer) retireLayer(layer);
    const bus = context.createGain(); const now = context.currentTime;
    if (settled && now === t0) bus.gain.setValueAtTime(layerGain(), now);
    else { bus.gain.setValueAtTime(0.0001, now); bus.gain.exponentialRampToValueAtTime(Math.max(0.0001, layerGain()), now + TONE_FADE_IN_SEC); }
    bus.connect(master);
    layer = { bus, graph: buildToneGraph(bus, next, now) };
  };
  applyToneLayer(spec.toneLayer);

  // Recorded nature layers: looped real recordings that follow the spec's mix. Everything goes through the master,
  // so the member's volume and the fade-in apply to them exactly as to the synthesized sound.
  const layers = new Map<string, { gain: GainNode; source: boolean; loading: boolean; player?: (to: number) => void }>();
  const playing = new Set<AudioBufferSourceNode>();
  // How far ahead recorded segments are scheduled: a few seconds live (the timer tops it up), two minutes offline.
  const isOffline = typeof OfflineAudioContext !== 'undefined' && context instanceof OfflineAudioContext;
  const recordedHorizon = timeline ? Math.max(0, timeline.horizonSec) : isOffline ? 120 : 8;
  // The member's "Nature recordings" amount (N1, #1979): one bus for every recorded layer, so 0 is synthesis alone.
  const recordingsBus = context.createGain(); recordingsBus.gain.value = Math.max(0, recordedAmount); recordingsBus.connect(master);
  const recordedState: Partial<Record<RecordedLayerId, RecordedLayerState>> = {};
  const recordedListeners = new Set<(state: Partial<Record<RecordedLayerId, RecordedLayerState>>) => void>();
  // Only the layers the CURRENT mix plays: a layer faded out by a live change is no longer reported.
  const currentRecorded = (): Partial<Record<RecordedLayerId, RecordedLayerState>> => {
    const now: Partial<Record<RecordedLayerId, RecordedLayerState>> = {};
    for (const [id, state] of Object.entries(recordedState) as [RecordedLayerId, RecordedLayerState][]) {
      if (((spec.recorded ?? {})[id] ?? 0) > 0) now[id] = state;
    }
    return now;
  };
  const emitRecorded = () => { for (const listener of recordedListeners) listener(currentRecorded()); };
  const setRecordedState = (id: RecordedLayerId, state: RecordedLayerState) => { recordedState[id] = state; emitRecorded(); };
  let disposed = false;
  const applyRecorded = (mix: SoundscapeSpec['recorded']) => {
    if (!loadRecorded) return;
    const wanted = mix ?? {};
    for (const id of Object.keys(wanted) as RecordedLayerId[]) {
      if (!layers.has(id)) {
        const gain = context.createGain(); gain.gain.value = 0; gain.connect(recordingsBus);
        layers.set(id, { gain, source: false, loading: false });
      }
    }
    layers.forEach((layer, id) => {
      // Mixed against the original scale, so recorded layers rise with the 2026-11-19 raise and keep their balance.
      const target = ((wanted as Record<string, number | undefined>)[id] ?? 0) / ORIGINAL_OUTPUT_SCALE;
      if (settled && context.currentTime === t0) layer.gain.gain.setValueAtTime(target, t0);
      else layer.gain.gain.setTargetAtTime(target, context.currentTime, 2.5);
      if (target > 0 && !layer.source && !layer.loading) {
        layer.loading = true;
        setRecordedState(id as RecordedLayerId, 'loading');
        void loadRecorded(id as RecordedLayerId).then(buffer => {
          if (disposed) return;
          if (!buffer) { setRecordedState(id as RecordedLayerId, 'missing'); return; }
          if (timeline) {
            // A piece of one long timeline: the same walk from global 0, scheduled where it falls in this piece,
            // including a segment already under way at the piece's start.
            let k = 0; let g = 0;
            const end = origin + recordedHorizon;
            while (g < end) {
              const seg = recordedSegment(k++, buffer.duration);
              if (g + seg.duration > origin) {
                const at = t0 + (g - origin); const e = Math.max(0, -(g - origin));
                const source = context.createBufferSource(); source.buffer = buffer;
                const envelope = context.createGain();
                scheduleEnvelope(envelope.gain, at, t0, seg.duration, seg.fade, 1);
                source.connect(envelope); envelope.connect(layer.gain);
                source.start(at + e, seg.offset + e, seg.duration - e);
                playing.add(source);
              }
              g += seg.duration - seg.fade;
            }
            layer.source = true;
            setRecordedState(id as RecordedLayerId, 'recorded');
            return;
          }
          // Overlapping, changing segments instead of one fixed loop (see recordedSegment).
          let k = 0; let next = context.currentTime;
          const player = (to: number) => {
            while (next < to) {
              const seg = recordedSegment(k++, buffer.duration);
              const source = context.createBufferSource(); source.buffer = buffer;
              const envelope = context.createGain();
              envelope.gain.setValueCurveAtTime(FADE_IN_CURVE, next, seg.fade);
              envelope.gain.setValueCurveAtTime(FADE_OUT_CURVE, next + seg.duration - seg.fade, seg.fade);
              source.connect(envelope); envelope.connect(layer.gain);
              source.start(next, seg.offset, seg.duration);
              playing.add(source);
              source.onended = () => { playing.delete(source); try { source.disconnect(); envelope.disconnect(); } catch { /* gone */ } };
              next += seg.duration - seg.fade;
            }
          };
          layer.player = player;
          player(context.currentTime + recordedHorizon);
          layer.source = true;
          setRecordedState(id as RecordedLayerId, 'recorded');
        }).catch(() => { if (!disposed) setRecordedState(id as RecordedLayerId, 'missing'); }); // the rest plays unchanged
      }
    });
  };
  applyRecorded(spec.recorded);

  // Weave moments: a sparse layer at the edge of hearing (see weaveMoment). Its own bus, so the member's Weave amount
  // sets how present it is; it still ends in the one master, so the Level governs it.
  const weaveBus = context.createGain(); weaveBus.gain.value = Math.max(0, weaveAmount); weaveBus.connect(master);
  const weaveBuffers = new Map<WeaveMomentId, AudioBuffer>();
  let weavePlayer: ((to: number) => void) | null = null;
  if (loadRecorded && spec.weave && spec.weave.length > 0) {
    // A soft, generated distance: decaying deterministic noise as a 3.5 s impulse response.
    const distance = typeof context.createConvolver === 'function' ? context.createConvolver() : null;
    if (distance) {
      const len = Math.floor(context.sampleRate * 3.5); const ir = context.createBuffer(2, len, context.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c); let seed = 0x2545f491 + c;
        for (let i = 0; i < len; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; d[i] = (((seed >>> 0) / 0xffffffff) * 2 - 1) * Math.exp(-i / (context.sampleRate * 0.9)); }
      }
      distance.buffer = ir; distance.connect(weaveBus);
    }
    const ids = [...spec.weave];
    void Promise.all(ids.map(id => loadRecorded(id).then(b => { if (b) weaveBuffers.set(id, b); }).catch(() => undefined))).then(() => {
      if (disposed) return;
      emitRecorded(); // listeners learn which weave moments are real recordings
      if (weaveBuffers.size === 0) return;
      const present = ids.filter(id => weaveBuffers.has(id));
      if (timeline) {
        // A piece of one long timeline: the same weave from global 0, including a moment already under way.
        let k = 0; let g = 0; let previous = -1;
        const end = origin + recordedHorizon;
        for (;;) {
          const m = weaveMoment(k++, present.length, previous); g += m.gapSec; previous = m.index;
          if (g >= end) break;
          const buffer = weaveBuffers.get(present[m.index])!; const length = buffer.duration / m.rate;
          if (g + length <= origin) continue;
          const at = t0 + (g - origin); const e = Math.max(0, origin - g);
          const source = context.createBufferSource(); source.buffer = buffer; source.playbackRate.value = m.rate;
          const envelope = context.createGain();
          scheduleEnvelope(envelope.gain, at, t0, length, length * 0.35, WEAVE_PEAK / ORIGINAL_OUTPUT_SCALE);
          const place = typeof context.createStereoPanner === 'function' ? context.createStereoPanner() : null;
          source.connect(envelope);
          const after: AudioNode = place ? (envelope.connect(place), place.pan.value = m.pan, place) : envelope;
          const dry = context.createGain(); dry.gain.value = 0.6; after.connect(dry); dry.connect(weaveBus);
          if (distance) after.connect(distance);
          source.start(at + e, e * m.rate); playing.add(source);
        }
        return;
      }
      let k = 0; let next = context.currentTime; let previous = -1;
      weavePlayer = (to: number) => {
        while (next + weaveMoment(k, present.length, previous).gapSec < to) {
          const m = weaveMoment(k++, present.length, previous); next += m.gapSec; previous = m.index;
          const buffer = weaveBuffers.get(present[m.index])!; const length = buffer.duration / m.rate; const fade = length * 0.35;
          const source = context.createBufferSource(); source.buffer = buffer; source.playbackRate.value = m.rate;
          const envelope = context.createGain();
          envelope.gain.setValueCurveAtTime(FADE_IN_CURVE.map(v => v * WEAVE_PEAK / ORIGINAL_OUTPUT_SCALE), next, fade);
          envelope.gain.setValueCurveAtTime(FADE_OUT_CURVE.map(v => v * WEAVE_PEAK / ORIGINAL_OUTPUT_SCALE), next + length - fade, fade);
          const place = typeof context.createStereoPanner === 'function' ? context.createStereoPanner() : null;
          source.connect(envelope);
          const after: AudioNode = place ? (envelope.connect(place), place.pan.value = m.pan, place) : envelope;
          const dry = context.createGain(); dry.gain.value = 0.6; after.connect(dry); dry.connect(weaveBus);
          if (distance) after.connect(distance);
          source.start(next); playing.add(source);
          source.onended = () => { playing.delete(source); try { source.disconnect(); envelope.disconnect(); place?.disconnect(); dry.disconnect(); } catch { /* gone */ } };
        }
      };
      weavePlayer(context.currentTime + recordedHorizon);
    });
  }

  // Events (clicks, plucks, soft blips) are deterministic: a fixed pattern, never random.
  let nextTick = t0 + 1.5;
  let tickIndex = 0;
  if (settled && spec.tick) {
    // A piece of one long timeline: the events stay on the one grid that began at global 1.5 s.
    const period = 60 / spec.tick.bpm;
    tickIndex = Math.max(0, Math.ceil((origin - 1.5) / period));
    nextTick = t0 + 1.5 + tickIndex * period - origin;
  }
  const burst = noiseBuffer(context, 0.05);
  const playTick = (at: number, tick: TickSpec) => {
    const out = context.createGain();
    out.connect(master);
    if (tick.kind === 'click') {
      const source = context.createBufferSource(); source.buffer = burst;
      const high = context.createBiquadFilter(); high.type = 'highpass'; high.frequency.value = 2200;
      source.connect(high); high.connect(out);
      out.gain.setValueAtTime(tick.gain * 1.4, at); out.gain.exponentialRampToValueAtTime(0.0001, at + 0.04);
      source.start(at); source.stop(at + 0.05);
      const thump = context.createOscillator(); thump.type = 'sine'; thump.frequency.value = Math.max(spec.root, 110); // audible on a phone speaker
      const thumpGain = context.createGain(); thumpGain.gain.setValueAtTime(tick.gain, at);
      thumpGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      thump.connect(thumpGain); thumpGain.connect(master); thump.start(at); thump.stop(at + 0.25);
    } else {
      const ratio = tick.kind === 'pluck' ? (PLUCK_RATIOS[tickIndex % PLUCK_RATIOS.length] ?? 1) * 2 : 2;
      const osc = context.createOscillator(); osc.type = tick.kind === 'pluck' ? 'triangle' : 'sine';
      osc.frequency.value = spec.root * ratio;
      const lp = context.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = tick.kind === 'pluck' ? 2600 : 1200;
      osc.connect(lp); lp.connect(out);
      const decay = tick.kind === 'pluck' ? 0.9 : 0.5;
      out.gain.setValueAtTime(tick.gain, at); out.gain.exponentialRampToValueAtTime(0.0001, at + decay);
      osc.start(at); osc.stop(at + decay + 0.05);
    }
    tickIndex += 1;
  };
  const scheduleTicks = (from: number, to: number) => {
    const tick = spec.tick;
    if (!tick) { nextTick = Math.max(nextTick, to); return; }
    const period = 60 / tick.bpm;
    if (nextTick < from) nextTick = from;
    while (nextTick < to) { playTick(nextTick, tick); nextTick += period; }
  };
  let timer: ReturnType<typeof setInterval> | null = null;
  if (typeof OfflineAudioContext === 'undefined' || !(context instanceof OfflineAudioContext)) {
    timer = setInterval(() => {
      scheduleTicks(context.currentTime, context.currentTime + 1.2);
      layers.forEach(layer => layer.player?.(context.currentTime + recordedHorizon));
      weavePlayer?.(context.currentTime + recordedHorizon);
    }, 400);
  }

  const gently = (param: AudioParam, value: number) => param.setTargetAtTime(value, context.currentTime, 0.4);
  const handle: SoundscapeHandle = {
    context, master, oscillators, voices, filter, movement, movementDepth,
    get spec() { return spec; },
    update(next) {
      if (soundscapeNeedsRebuild(spec, next)) return false;
      spec = next;
      next.voices.forEach((voice, index) => {
        const osc = oscillators[index]; const gain = voices[index]; const pan = panners[index];
        if (osc) { gently(osc.frequency, next.root * voice.ratio); gently(osc.detune, voice.detuneCents); }
        if (gain) gently(gain.gain, voice.gain);
        if (pan) gently(pan.pan, voice.pan);
        const overtones = overtoneVoices[index];
        if (overtones) {
          gently(overtones.follower.gain, voice.gain);
          for (const p of overtones.partials) {
            const hz = next.root * voice.ratio * p.n;
            gently(p.osc.frequency, hz); gently(p.osc.detune, voice.detuneCents); gently(p.gain.gain, overtoneGain(p.n, hz));
          }
        }
      });
      gently(filter.frequency, next.lowpassHz);
      if (overtoneSoft) gently(overtoneSoft.frequency, next.overtoneSoftHz ?? SOUNDSCAPE_OVERTONE_SOFT_HZ);
      gently(movement.frequency, Math.max(0.0001, next.pulseHz));
      gently(movementDepth.gain, next.pulseHz > 0 ? next.pulseDepth : 0);
      gently(driftGain.gain, next.lowpassHz * 0.22 * next.driftDepth);
      if (next.noise && noiseGain && noiseBand && sweepDepth) {
        gently(noiseGain.gain, next.noise.gain); gently(noiseBand.frequency, next.noise.bandHz);
        gently(noiseBand.Q, next.noise.q); gently(sweepDepth.gain, next.noise.bandHz * 0.4);
      }
      if (next.tone && toneGraph) retuneToneGraph(toneGraph, next.tone);
      applyToneLayer(next.toneLayer);
      applyRecorded(next.recorded);
      emitRecorded();
      return true;
    },
    scheduleTicks,
    setOvertoneBusGain(gain) {
      if (overtoneBus) overtoneBus.gain.setTargetAtTime(Math.max(0, gain), context.currentTime, 0.06);
    },
    setRecordedAmount(amount) {
      recordingsBus.gain.setTargetAtTime(Math.max(0, amount), context.currentTime, 0.12);
    },
    recordedLayers() { return currentRecorded(); },
    setToneLayerAmount(amount) {
      layerAmount = Math.max(0, Math.min(1, amount));
      if (layer) { layer.bus.gain.cancelScheduledValues(context.currentTime); layer.bus.gain.setTargetAtTime(layerGain(), context.currentTime, 0.12); }
    },
    setLevel(value) {
      currentLevel = value;
      if (layer) { layer.bus.gain.cancelScheduledValues(context.currentTime); layer.bus.gain.setTargetAtTime(layerGain(), context.currentTime, 0.06); }
    },
    toneLayerGain() { return layer ? layerGain() : 0; },
    setWeaveAmount(amount) { weaveBus.gain.setTargetAtTime(Math.max(0, amount), context.currentTime, 0.12); },
    weaveMoments() { return [...weaveBuffers.keys()]; },
    onRecordedLayers(listener) {
      recordedListeners.add(listener);
      return () => { recordedListeners.delete(listener); };
    },
    dispose() {
      disposed = true;
      recordedListeners.clear();
      if (timer !== null) clearInterval(timer);
      for (const node of [...oscillators, ...overtoneOscillators, movement, drift, ...extras, ...playing]) { try { node.stop(); } catch { /* already stopped */ } }
    },
  };
  return handle;
}
