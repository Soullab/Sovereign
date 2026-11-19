// FOCUS-SOUNDSCAPE-01 · Web Audio engine for a SoundscapeSpec. Pure synthesis: no files, no network, no
// microphone. It builds into any BaseAudioContext, so the same graph renders live (the one persistent player)
// and offline (for measurement). Nothing starts a context; the caller does, after the member's own Play.
import { soundscapeNeedsRebuild } from './focusSoundscape';
import { GENERATED_OUTPUT_SCALE, ORIGINAL_OUTPUT_SCALE, TONE_OUTPUT_SCALE } from './listeningLevel';
import { TONE_VOICE_GAIN, toneEffectiveLevel } from './toneLab';
import type { RecordedLayerId, SoundscapeSpec, TickSpec } from './focusSoundscape';

/** Loads one recorded loop. Returns null when it is unavailable; the soundscape then plays without it. */
export type RecordedLoader = (id: RecordedLayerId) => Promise<AudioBuffer | null>;

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
  dispose(): void;
};

const SCALE = GENERATED_OUTPUT_SCALE; // same output scale as the original studies; the member's volume multiplies it
const PLUCK_RATIOS = [1, 1.125, 1.5, 1.6667, 2, 1.5, 1.125, 1];

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
): SoundscapeHandle {
  let spec = initial;
  const t0 = context.currentTime;
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, t0);
  // Tone Lab plays at the shared level but never above its cap, so a turned-up level cannot make a pure tone loud.
  const playLevel = (value: number) => (spec.tone ? toneEffectiveLevel(value * 100) / 100 : value);
  // Tone Lab keeps its original absolute scale (founder ruling 2026-11-19): only non-tone sound was raised.
  master.gain.exponentialRampToValueAtTime(Math.max(0.0001, playLevel(level) * (spec.tone ? TONE_OUTPUT_SCALE : SCALE)), t0 + Math.max(1, spec.fadeInSec));
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
    osc.start(t0);
    oscillators.push(osc); voices.push(gain);
  });

  // Pulse: a slow amplitude movement. Its rate is capped well below any flicker rate by the spec.
  const movement = context.createOscillator();
  movement.type = 'sine';
  movement.frequency.value = Math.max(0.0001, spec.pulseHz);
  const movementDepth = context.createGain();
  movementDepth.gain.value = spec.pulseHz > 0 ? spec.pulseDepth : 0;
  movement.connect(movementDepth); movementDepth.connect(pulseGain.gain);
  movement.start(t0);

  // Drift: a very slow movement of the tone's brightness, so it never sits perfectly still.
  const drift = context.createOscillator();
  drift.type = 'sine'; drift.frequency.value = 0.043;
  const driftGain = context.createGain();
  driftGain.gain.value = spec.lowpassHz * 0.22 * spec.driftDepth;
  drift.connect(driftGain); driftGain.connect(filter.frequency);
  drift.start(t0);

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
    source.start(t0); sweep.start(t0);
    extras.push(source, sweep);
  }

  // Tone Lab: one pure tone, with an optional slow pulse. Sound only: nothing here can flicker anything on screen.
  // It joins the master directly (not the soft lowpass), so the pitch the member chose is the pitch they hear.
  type ToneGraph = { base: OscillatorNode; second: OscillatorNode | null; lfo: OscillatorNode | null };
  let toneGraph: ToneGraph | null = null;
  if (spec.tone) {
    const { hz, pulseMode, pulseHz } = spec.tone;
    const toneBus = context.createGain();
    toneBus.gain.value = TONE_VOICE_GAIN;
    toneBus.connect(master);
    const sine = (freq: number) => { const o = context.createOscillator(); o.type = 'sine'; o.frequency.value = freq; return o; };
    const base = sine(hz);
    let second: OscillatorNode | null = null;
    let lfo: OscillatorNode | null = null;
    if (pulseMode === 'binaural' && typeof context.createStereoPanner === 'function') {
      second = sine(hz + pulseHz);
      const left = context.createStereoPanner(); left.pan.value = -1;
      const right = context.createStereoPanner(); right.pan.value = 1;
      base.connect(left); left.connect(toneBus);
      second.connect(right); right.connect(toneBus);
    } else if (pulseMode === 'binaural' || pulseMode === 'monaural') {
      second = sine(hz + pulseHz);
      const a = context.createGain(); a.gain.value = 0.5;
      const b = context.createGain(); b.gain.value = 0.5;
      base.connect(a); a.connect(toneBus); second.connect(b); b.connect(toneBus);
    } else if (pulseMode === 'isochronic') {
      // A smooth swell between silence and full, never an on/off edge.
      const swell = context.createGain(); swell.gain.value = 0.5;
      lfo = sine(Math.max(0.0001, pulseHz));
      const depth = context.createGain(); depth.gain.value = 0.5;
      lfo.connect(depth); depth.connect(swell.gain);
      base.connect(swell); swell.connect(toneBus);
    } else {
      base.connect(toneBus);
    }
    for (const node of [base, second, lfo]) if (node) { node.start(t0); extras.push(node); }
    toneGraph = { base, second, lfo };
  }

  // Recorded nature layers: looped real recordings that follow the spec's mix. Everything goes through the master,
  // so the member's volume and the fade-in apply to them exactly as to the synthesized sound.
  const layers = new Map<string, { gain: GainNode; source: AudioBufferSourceNode | null; loading: boolean }>();
  let disposed = false;
  const applyRecorded = (mix: SoundscapeSpec['recorded']) => {
    if (!loadRecorded) return;
    const wanted = mix ?? {};
    for (const id of Object.keys(wanted) as RecordedLayerId[]) {
      if (!layers.has(id)) {
        const gain = context.createGain(); gain.gain.value = 0; gain.connect(master);
        layers.set(id, { gain, source: null, loading: false });
      }
    }
    layers.forEach((layer, id) => {
      // Mixed against the original scale, so recorded layers rise with the 2026-11-19 raise and keep their balance.
      const target = ((wanted as Record<string, number | undefined>)[id] ?? 0) / ORIGINAL_OUTPUT_SCALE;
      layer.gain.gain.setTargetAtTime(target, context.currentTime, 2.5);
      if (target > 0 && !layer.source && !layer.loading) {
        layer.loading = true;
        void loadRecorded(id as RecordedLayerId).then(buffer => {
          if (!buffer || disposed) return;
          const source = context.createBufferSource();
          source.buffer = buffer; source.loop = true;
          source.connect(layer.gain); source.start(context.currentTime);
          layer.source = source; extras.push(source);
        }).catch(() => { /* a missing recording leaves the rest of the sound unchanged */ });
      }
    });
  };
  applyRecorded(spec.recorded);

  // Events (clicks, plucks, soft blips) are deterministic: a fixed pattern, never random.
  let nextTick = t0 + 1.5;
  let tickIndex = 0;
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
    timer = setInterval(() => scheduleTicks(context.currentTime, context.currentTime + 1.2), 400);
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
      });
      gently(filter.frequency, next.lowpassHz);
      gently(movement.frequency, Math.max(0.0001, next.pulseHz));
      gently(movementDepth.gain, next.pulseHz > 0 ? next.pulseDepth : 0);
      gently(driftGain.gain, next.lowpassHz * 0.22 * next.driftDepth);
      if (next.noise && noiseGain && noiseBand && sweepDepth) {
        gently(noiseGain.gain, next.noise.gain); gently(noiseBand.frequency, next.noise.bandHz);
        gently(noiseBand.Q, next.noise.q); gently(sweepDepth.gain, next.noise.bandHz * 0.4);
      }
      if (next.tone && toneGraph) {
        gently(toneGraph.base.frequency, next.tone.hz);
        if (toneGraph.second) gently(toneGraph.second.frequency, next.tone.hz + next.tone.pulseHz);
        if (toneGraph.lfo) gently(toneGraph.lfo.frequency, Math.max(0.0001, next.tone.pulseHz));
      }
      applyRecorded(next.recorded);
      return true;
    },
    scheduleTicks,
    dispose() {
      disposed = true;
      if (timer !== null) clearInterval(timer);
      for (const node of [...oscillators, movement, drift, ...extras]) { try { node.stop(); } catch { /* already stopped */ } }
    },
  };
  return handle;
}
