// TONE-LAB-01 · an instrument for listening to a pure tone and, if you choose, a slow pulse. Pure and deterministic.
//
// Honest framing (docs/canon/MARKETING_CLAIM_DISCIPLINE.md; docs/research/sound/SOUND_AND_CONSCIOUSNESS_RESEARCH_2026-11-09.md):
// rhythmic sound produces a measurable sensory response; that a pitch or pulse changes a person's state is NOT
// established. So every preset carries where it comes from and what is and is not known, and none carries an
// outcome. Nothing here plays sound: the one persistent player does, after the member's own Play.
import { focusSoundscapeSpec } from './focusSoundscape';
import type { SoundscapeSpec } from './focusSoundscape';

export const TONE_MIN_HZ = 40;
export const TONE_MAX_HZ = 1000;
export const PULSE_MIN_HZ = 0.5;
export const PULSE_MAX_HZ = 40;
/** The shared level (0–100) is capped at this for any Tone Lab sound. One control, one cap: the player bar's level. */
export const TONE_LEVEL_CAP = 40;
/** Tone Lab always opens this slowly, and closes this quickly, so it never starts or ends with a jolt. */
export const TONE_FADE_IN_SEC = 6;
export const TONE_FADE_OUT_SEC = 0.6;
export const TONE_VOICE_GAIN = 0.6;
export const TONE_BED_GAIN_SCALE = 0.45;

export type PulseMode = 'none' | 'binaural' | 'monaural' | 'isochronic';
export type ToneBed = 'none' | 'soft-tones' | 'night-recording';
export type ToneSpec = { hz: number; pulseMode: PulseMode; pulseHz: number };
export type ToneDial = { hz: number; pulseMode: PulseMode; pulseHz: number; bed: ToneBed };

export const DEFAULT_TONE_DIAL: ToneDial = { hz: 220, pulseMode: 'none', pulseHz: 10, bed: 'none' };

export const PULSE_MODES: ReadonlyArray<{ id: PulseMode; label: string; line: string }> = [
  { id: 'none', label: 'Tone only', line: 'A single steady tone.' },
  { id: 'binaural', label: 'Binaural', line: 'Two slightly different tones, one in each ear. Headphones only.' },
  { id: 'monaural', label: 'Monaural', line: 'Two close tones mixed together, so the sound itself slowly swells and softens. Works on speakers.' },
  { id: 'isochronic', label: 'Isochronic', line: 'One tone that gently swells and softens at the pulse rate. Works on speakers.' },
];
export const TONE_BEDS: ReadonlyArray<{ id: ToneBed; label: string }> = [
  { id: 'none', label: 'Nothing underneath' },
  { id: 'soft-tones', label: 'Soft generated tones' },
  { id: 'night-recording', label: 'Night recording' },
];

export const HEADPHONES_NOTE = 'Binaural needs headphones: each ear must hear its own tone. On speakers the two tones blend and you will hear only a steady tone.';
export const DRIVING_NOTE = 'Please do not use Tone Lab while driving or operating machinery.';
export const LEVEL_NOTE = `Tone Lab starts quiet and never plays above ${TONE_LEVEL_CAP} on the player bar's level, so a turned-up level cannot make it louder than that. It fades in slowly and out gently.`;
export const NO_CLAIM_NOTE = 'This is an instrument for listening and exploring. It makes no claim that any tone or pulse changes how you feel or what your body does. Stop whenever you like.';
export const NO_FLICKER_NOTE = 'Sound only. Nothing on screen flashes or pulses.';

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/** Any input becomes a safe pitch: a finite number inside 40–1000 Hz, to two decimals. */
export function clampToneHz(value: unknown): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return DEFAULT_TONE_DIAL.hz;
  return round(clamp(n, TONE_MIN_HZ, TONE_MAX_HZ));
}
/** Any input becomes a safe pulse rate: a finite number inside 0.5–40 Hz, to two decimals. */
export function clampPulseHz(value: unknown): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return DEFAULT_TONE_DIAL.pulseHz;
  return round(clamp(n, PULSE_MIN_HZ, PULSE_MAX_HZ));
}
export function normalizeToneDial(input: Partial<ToneDial> | null | undefined): ToneDial {
  const mode = PULSE_MODES.some(m => m.id === input?.pulseMode) ? input!.pulseMode! : 'none';
  const bed = TONE_BEDS.some(b => b.id === input?.bed) ? input!.bed! : 'none';
  return { hz: clampToneHz(input?.hz), pulseMode: mode, pulseHz: clampPulseHz(input?.pulseHz), bed };
}

/** The level a Tone Lab sound actually plays at: the shared level, never above the cap. */
export function toneEffectiveLevel(level: number): number {
  return clamp(Number.isFinite(level) ? level : 0, 0, TONE_LEVEL_CAP);
}

/** Binaural beats need two ears. The note is shown whenever binaural is chosen. */
export function toneNeedsHeadphones(mode: PulseMode): boolean { return mode === 'binaural'; }
export function toneNotes(dial: ToneDial): string[] {
  const notes = [DRIVING_NOTE, LEVEL_NOTE, NO_FLICKER_NOTE];
  if (toneNeedsHeadphones(dial.pulseMode)) notes.unshift(HEADPHONES_NOTE);
  return notes;
}

/** The dial as a SoundscapeSpec for the one persistent player: same engine, same player, same level control. */
export function toneSoundscapeSpec(input: Partial<ToneDial>): SoundscapeSpec {
  const dial = normalizeToneDial(input);
  const bedSpec = focusSoundscapeSpec({ need: 'deep', stimulation: 'low', world: dial.bed === 'night-recording' ? 'nature' : 'ambient', task: 'thinking' });
  const withBed = dial.bed !== 'none';
  const recordedBed = dial.bed === 'night-recording' ? { night: 0.5, rain: 0.35 } : null;
  return {
    ...bedSpec,
    // A bed is ambient texture only: no events, no pulse of its own, quieter than the tone.
    voices: withBed && dial.bed === 'soft-tones'
      ? bedSpec.voices.map(voice => ({ ...voice, gain: round(voice.gain * TONE_BED_GAIN_SCALE, 4) }))
      : [],
    recorded: recordedBed,
    noise: null,
    tick: null,
    pulseHz: 0,
    pulseDepth: 0,
    fadeInSec: TONE_FADE_IN_SEC,
    tone: { hz: dial.hz, pulseMode: dial.pulseMode, pulseHz: dial.pulseMode === 'none' ? 0 : dial.pulseHz },
  };
}

export type TonePreset = {
  id: string;
  group: 'Solfeggio tradition' | 'Reference pitch' | 'Rhythm rates' | 'Earth resonance';
  label: string;
  dial: Pick<ToneDial, 'hz' | 'pulseMode' | 'pulseHz'>;
  /** Where it comes from and what is and is not known. Never an outcome. */
  provenance: string;
};

const SOLFEGGIO_NOTE = 'from the Solfeggio tradition (Joseph Puleo, 1970s, derived by numerology). Many people find it meaningful; there is no evidence of a physical effect.';
const solfeggio = (hz: number, extra = ''): TonePreset => ({
  id: `solfeggio-${hz}`, group: 'Solfeggio tradition', label: `${hz} Hz`,
  dial: { hz, pulseMode: 'none', pulseHz: 10 },
  provenance: `${hz} Hz: ${SOLFEGGIO_NOTE}${extra}`,
});
const rhythm = (id: string, label: string, hz: number, text: string): TonePreset => ({
  id, group: 'Rhythm rates', label, dial: { hz: 200, pulseMode: 'isochronic', pulseHz: hz }, provenance: text,
});

export const TONE_PRESETS: ReadonlyArray<TonePreset> = [
  solfeggio(174), solfeggio(285), solfeggio(396), solfeggio(417),
  solfeggio(528, ' A few very small studies compared it with 440 Hz; none is conclusive.'),
  solfeggio(639), solfeggio(741), solfeggio(852), solfeggio(963),
  { id: 'reference-432', group: 'Reference pitch', label: '432 Hz reference', dial: { hz: 432, pulseMode: 'none', pulseHz: 10 },
    provenance: '432 Hz reference: an alternative tuning for A. Claims about it are not supported; the difference from 440 Hz is about a third of a semitone.' },
  { id: 'reference-440', group: 'Reference pitch', label: '440 Hz reference', dial: { hz: 440, pulseMode: 'none', pulseHz: 10 },
    provenance: '440 Hz reference: the common concert tuning for A, set by convention in 1939 as a compromise between many pitches then in use.' },
  { id: 'schumann-7-83', group: 'Earth resonance', label: 'Schumann 7.83 Hz pulse', dial: { hz: 200, pulseMode: 'isochronic', pulseHz: 7.83 },
    provenance: '7.83 Hz pulse: the Earth–ionosphere cavity resonance is real geophysics. Health claims linking it to the body have no support; this is a rhythm to listen to, nothing more.' },
  rhythm('rhythm-theta-6', 'Theta-rate 6 Hz pulse', 6, '6 Hz pulse: a theta-rate rhythm, named for a brainwave band. It produces a measurable sensory response; it is not proven to change your state.'),
  rhythm('rhythm-alpha-10', 'Alpha-rate 10 Hz pulse', 10, '10 Hz pulse: an alpha-rate rhythm. It produces a measurable sensory response; it is not proven to change your state.'),
  rhythm('rhythm-beta-16', 'Beta-rate 16 Hz pulse', 16, '16 Hz pulse: a beta-rate rhythm, studied in research on listening and attention. It produces a measurable sensory response; no outcome is claimed here.'),
  rhythm('rhythm-gamma-40', 'Gamma-rate 40 Hz pulse', 40, '40 Hz pulse: studied in research; the results are unsettled and no outcome is claimed here.'),
];

export function applyPreset(preset: TonePreset, bed: ToneBed = 'none'): ToneDial {
  return normalizeToneDial({ ...preset.dial, bed });
}

/** Every word Tone Lab never uses, in any copy, string or doc. The scan is a test, not a courtesy. */
export const BANNED_TONE_WORDS: ReadonlyArray<string> = [
  'healing', 'heals', 'unlock', 'activate', 'entrain', 'frequency medicine', 'cure', 'therapy', 'therapeutic',
  'treat', 'detox', 'miracle', 'boost', 'rewire', 'raise your vibration', 'higher consciousness', 'clinically',
];
