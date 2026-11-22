// LISTEN-01 · Nature & voices layer (review only), 2026-11-22. Founder: "Yes, build it" (a shared layer the Sound
// departments can weave together). Everything here is synthesized in the browser: no field recordings, no samples,
// no recorded or AI voices, no imitation of any particular species or singer, and no claim about what it does.
// The layer is host-agnostic: a host gives it an AudioContext, an output node and (optionally) a hall send, calls
// `set()` when its parameters change and `tick()` from its own timer. Liquid Harmonics hosts it today; any other
// department's engine can host it the same way.

export type NatureVoiceParams = {
  rain: number; stream: number; wind: number; fire: number; birds: number; choir: number;
  /** The host's fundamental (Hz): the choir sings in its key. */
  f0: number;
  /** Three formant centre frequencies for the choir's vowel (from the host's vowel control). */
  formants: number[];
};
export type NatureVoiceLayer = {
  set: (p: NatureVoiceParams, timeConstant?: number) => void;
  tick: (t: number) => void;
  dispose: () => void;
};

/** The choir's chord: root, fifth, octave, major tenth and twelfth on the host's fundamental, placed at least an
 * octave above it. Every note is a degree of the major pentatonic on the root, so it sits in key with the field. */
export function choirChord(f0: number): number[] {
  let r = Math.max(20, f0); while (r < 110) r *= 2;
  return [r, r * 1.5, r * 2, r * 2.5, r * 3];
}

/** Deterministic noise for the layer's buffers. kind 'white' | 'pink' | 'brown'. */
export function layerNoise(n: number, kind: 'white' | 'pink' | 'brown', seed = 1): Float32Array<ArrayBuffer> {
  const out = new Float32Array(n); let s = seed >>> 0 || 1, b0 = 0, b1 = 0, b2 = 0, br = 0;
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0; const w = s / 4294967296 * 2 - 1;
    let v = w;
    if (kind === 'pink') { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; v = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
    if (kind === 'brown') { br = (br + 0.02 * w) / 1.02; v = br * 3.5; }
    out[i] = Math.max(-1, Math.min(1, v));
  }
  return out;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, Number(x) || 0));

export function createNatureVoiceLayer(ctx: BaseAudioContext, out: AudioNode, hall?: AudioNode): NatureVoiceLayer {
  const nodes: AudioNode[] = [], srcs: (OscillatorNode | AudioBufferSourceNode)[] = [];
  const keep = <T extends AudioNode>(n: T): T => (nodes.push(n), n);
  const gain = (v = 1) => { const g = keep(ctx.createGain()); g.gain.value = v; return g; };
  const filt = (type: BiquadFilterType, f: number, q = 0.7) => { const b = keep(ctx.createBiquadFilter()); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const osc = (f: number, type: OscillatorType = 'sine') => { const o = keep(ctx.createOscillator()); o.type = type; o.frequency.value = f; srcs.push(o); return o; };
  const sr = ctx.sampleRate;
  const loop = (kind: 'white' | 'pink' | 'brown', seed: number) => {
    const b = ctx.createBuffer(2, Math.floor(sr * 6), sr); b.copyToChannel(layerNoise(b.length, kind, seed), 0); b.copyToChannel(layerNoise(b.length, kind, seed + 101), 1);
    const s = keep(ctx.createBufferSource()); s.buffer = b; s.loop = true; srcs.push(s); return s;
  };
  const bus = gain(1); bus.connect(out);
  const send = gain(1); bus.connect(send); if (hall) send.connect(hall);
  const P: NatureVoiceParams = { rain: 0, stream: 0, wind: 0, fire: 0, birds: 0, choir: 0, f0: 110, formants: [500, 1500, 2500] };

  // Rain: a soft hiss plus individual droplets scheduled in tick().
  const rainG = gain(0), rainHiss = loop('white', 3), rainHp = filt('highpass', 900), rainLp = filt('lowpass', 7000), rainHissG = gain(0.07);
  rainHiss.connect(rainHp); rainHp.connect(rainLp); rainLp.connect(rainHissG); rainHissG.connect(rainG); rainG.connect(bus);
  // Stream: brown noise through two bands whose centres jitter quickly (babbling).
  const streamG = gain(0), streamSrc = loop('brown', 5);
  const streamBands = [430, 780].map(f => { const b = filt('bandpass', f, 4); streamSrc.connect(b); const g = gain(0.9); b.connect(g); g.connect(streamG); return { b, f }; });
  const streamLp = filt('lowpass', 2400); streamG.connect(streamLp); const streamOut = gain(1); streamLp.connect(streamOut); streamOut.connect(bus);
  // Wind: pink noise through a resonant band that gusts and sweeps slowly.
  const windG = gain(0), windSrc = loop('pink', 9), windBp = filt('bandpass', 420, 3), windGust = gain(0.55);
  const gustLfo = osc(0.09), gustD = gain(0.4), sweepLfo = osc(0.047), sweepD = gain(220);
  gustLfo.connect(gustD); gustD.connect(windGust.gain); sweepLfo.connect(sweepD); sweepD.connect(windBp.frequency);
  windSrc.connect(windBp); windBp.connect(windGust); windGust.connect(windG); windG.connect(bus);
  // Fire: a low roar plus crackles scheduled in tick().
  const fireG = gain(0), roarSrc = loop('brown', 13), roarLp = filt('lowpass', 260), roarG = gain(0.5);
  roarSrc.connect(roarLp); roarLp.connect(roarG); roarG.connect(fireG); fireG.connect(bus);
  // Birds: sparse, distant invented calls (fast sine glides), scheduled in tick(); mostly sent to the hall.
  const birdG = gain(0), birdLp = filt('lowpass', 6000); birdG.connect(birdLp); birdLp.connect(bus);
  // Choir: five wordless voices on the host's key, each with three formant bands, slow vibrato and ensemble detune.
  const choirG = gain(0), choirSum = gain(1), choirForm = [0, 1, 2].map(j => { const b = filt('bandpass', 500, 7), g = gain([1, 0.55, 0.3][j]); choirSum.connect(b); b.connect(g); g.connect(choirG); return b; });
  const choirBreath = osc(0.05), choirBreathD = gain(0.25), choirLevel = gain(0.75); choirBreath.connect(choirBreathD); choirBreathD.connect(choirLevel.gain);
  choirG.connect(choirLevel); choirLevel.connect(bus);
  const voices = choirChord(P.f0).map((f, i) => {
    const o = osc(f, 'sawtooth'), g = gain(i === 0 ? 0.16 : 0.11), v = osc(4.6 + i * 0.37), vd = gain(9);
    o.detune.value = (i - 2) * 5; v.connect(vd); vd.connect(o.detune); o.connect(g); g.connect(choirSum); return o;
  });

  // One-shot events (droplets, crackles, calls): short-lived nodes into their own buses.
  const ping = (dest: AudioNode, when: number, f0: number, f1: number, dur: number, vel: number, pan: number, type: OscillatorType = 'sine') => {
    const o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner();
    o.type = type; o.frequency.setValueAtTime(f0, when); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), when + dur * 0.8);
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(vel, when + Math.min(0.01, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    p.pan.value = pan; o.connect(g); g.connect(p); p.connect(dest); o.start(when); o.stop(when + dur + 0.02);
    o.onended = () => { try { p.disconnect(); } catch { /* gone */ } };
  };
  const crackleBuf = ctx.createBuffer(1, Math.floor(sr * 0.012), sr); crackleBuf.copyToChannel(layerNoise(crackleBuf.length, 'white', 17), 0);
  const crackle = (when: number, vel: number, pan: number) => {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
    s.buffer = crackleBuf; f.type = 'bandpass'; f.frequency.value = 1800 + Math.random() * 3500; f.Q.value = 1.5;
    g.gain.setValueAtTime(vel, when); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.012); p.pan.value = pan;
    s.connect(f); f.connect(g); g.connect(p); p.connect(fireG); s.start(when); s.onended = () => { try { p.disconnect(); } catch { /* gone */ } };
  };
  let nextDrop = 0, nextCrackle = 0, nextCall = 0, nextJitter = 0;
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  srcs.forEach(s => s.start()); // silent until set() raises them

  return {
    set: (p, k = 0.4) => {
      Object.assign(P, p);
      const t = ctx.currentTime, set = (a: AudioParam, v: number) => a.setTargetAtTime(v, t, k);
      set(rainG.gain, clamp01(P.rain) * 1.0); set(streamG.gain, clamp01(P.stream) * 0.9); set(windG.gain, clamp01(P.wind) * 0.8);
      set(fireG.gain, clamp01(P.fire) * 0.9); set(birdG.gain, clamp01(P.birds)); set(choirG.gain, clamp01(P.choir) * 0.55);
      choirChord(P.f0).forEach((f, i) => set(voices[i].frequency, f));
      choirForm.forEach((b, j) => set(b.frequency, P.formants[j] ?? 500));
    },
    tick: (t) => {
      // Droplets: density follows the rain level; bright, short, scattered.
      if (P.rain > 0.01) {
        if (nextDrop < t) nextDrop = t + 0.05;
        while (nextDrop < t + 0.25) { ping(rainG, nextDrop, rnd(2200, 5200), rnd(900, 2000), rnd(0.02, 0.06), rnd(0.03, 0.09), rnd(-0.9, 0.9)); nextDrop += rnd(0.3, 1.2) / (1 + 14 * P.rain); }
      }
      // Stream babble: re-centre the two bands every 60–140 ms.
      if (P.stream > 0.01 && t >= nextJitter) {
        nextJitter = t + rnd(0.06, 0.14);
        streamBands.forEach(({ b, f }) => b.frequency.setTargetAtTime(f * rnd(0.7, 1.45), t, 0.03));
      }
      // Crackles: irregular, sometimes in small bursts.
      if (P.fire > 0.01) {
        if (nextCrackle < t) nextCrackle = t + 0.05;
        while (nextCrackle < t + 0.25) {
          const burst = Math.random() < 0.2 ? 3 : 1;
          for (let i = 0; i < burst; i++) crackle(nextCrackle + i * rnd(0.01, 0.04), rnd(0.15, 0.6), rnd(-0.6, 0.6));
          nextCrackle += rnd(0.08, 0.9) / (0.4 + 2.5 * P.fire);
        }
      }
      // Distant calls: short phrases of 2–4 glides, well apart.
      if (P.birds > 0.01) {
        if (nextCall < t) nextCall = t + rnd(1, 3);
        if (nextCall < t + 0.25) {
          const n = 2 + Math.floor(Math.random() * 3), base = rnd(2200, 4200), pan = rnd(-0.85, 0.85);
          for (let i = 0; i < n; i++) ping(birdG, nextCall + i * rnd(0.09, 0.16), base * rnd(0.9, 1.25), base * rnd(0.7, 1.4), rnd(0.07, 0.14), rnd(0.03, 0.06), pan);
          nextCall += rnd(2.5, 9) / (0.5 + P.birds);
        }
      }
    },
    dispose: () => {
      for (const s of srcs) { try { s.stop(); } catch { /* not started or stopped */ } }
      for (const n of nodes) { try { n.disconnect(); } catch { /* gone */ } }
    },
  };
}
