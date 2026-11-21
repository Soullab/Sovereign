/**
 * SOULLAB TRANSFORM T2 (R2, step A) — the Drone desk's logic around the verbatim engine.
 * Owner LISTEN-01 #1979. Founder approval 2026-11-21: "Approve T2 R2".
 *
 * The member's OWN recording (accepted only through T1's acceptMemberFile) becomes a
 * sustained drone, on their device, through the Voice to Drone Lab v0.3.4 engine whose
 * sound the founder accepted. Saved as a NEW file with provenance; the original is never
 * modified and nothing is uploaded.
 */
import * as engine from './engine.js';
import * as engine3 from './engine3.js';
import type { Ambience, DroneSettings, DroneSource, PresetId, RenderResult } from './engine';
import { completeDetail, isNeutralDetail } from './detail';
import type { Audio } from '../transform/audio';
import type { SideInfo } from '../transform/provenance';

export const DRONE_ENGINE = {
  name: 'Soullab Voice to Drone Lab v0.3.4',
  revision: 2,
  labSha256: '8407c45e8a6b6be17db3072cf1391451d3e28067266e690b6d471b42617e5d83',
} as const;
export const DRONE_PROVENANCE_SCHEMA = 'soullab.drone.provenance.v1';
/** The lab's own range for a drone's length. Well inside Transform's 20-minute cap. */
export const DRONE_SECONDS = { min: 10, max: 120 } as const;
/** The lab refuses sources shorter than this. */
export const MIN_SOURCE_SECONDS = 0.35;

/**
 * The engine works on one channel. Same downmix as the lab's importFile: each channel
 * divided by the channel count, summed in channel order.
 */
export function droneSource(audio: Audio, name: string): DroneSource {
  const n = audio.channels.length, len = audio.channels[0]?.length ?? 0;
  const data = new Float32Array(len);
  for (let ch = 0; ch < n; ch++) { const src = audio.channels[ch]; for (let i = 0; i < len; i++) data[i] += src[i] / n; }
  if (len / audio.sampleRate < MIN_SOURCE_SECONDS) throw new Error('The recording is too short: please use at least 0.35 seconds.');
  return { data, rate: audio.sampleRate, name, synthetic: false };
}

export function droneAmbience(audio: Audio, name: string): Ambience {
  const s = droneSource(audio, name);
  return { data: s.data, rate: s.rate, name, seconds: s.data.length / s.rate };
}

/**
 * Soullab's standard tuning reference for the Drone desk (founder, 2026-11-21: "432 should be standard").
 * The reference only names notes and sets where Snap tunes to; with fine tune at 0 the sound is unchanged.
 * An aesthetic standard, not a claim about what 432 Hz does to a person. A=440 stays one choice away.
 */
export const STANDARD_A_REF = 432 as const;

/** The lab's opening settings (index.html defaults) for a preset, with Soullab's A=432 tuning reference. */
export function defaultSettings(preset: PresetId = 'living'): DroneSettings {
  const d = engine.presets[preset].defaults;
  return {
    preset, duration: 30, stillness: d.stillness, grainMs: d.grain * 10, pitch: d.pitch, movement: d.movement, space: d.space,
    anchor: 35, loop: true, layerMix: engine.defaultLayerMix(preset), soloLayer: null, region: null,
    field: engine.defaultField(), clean: engine.completeClean(null), level: engine.completeLevel(null),
    tune: { ...engine.completeTune(null), aRef: STANDARD_A_REF },
  };
}

/** Switching preset keeps the passage, field, clean, level and tune, like the lab. */
export function withPreset(s: DroneSettings, preset: PresetId): DroneSettings {
  const d = engine.presets[preset].defaults;
  return { ...s, preset, stillness: d.stillness, grainMs: d.grain * 10, pitch: d.pitch, movement: d.movement, space: d.space, layerMix: engine.defaultLayerMix(preset), soloLayer: null };
}

/** What the engine would refuse, said before rendering; null when it can render. */
export function settingsProblem(s: DroneSettings, sourceSeconds: number): string | null {
  if (!(s.duration >= DRONE_SECONDS.min && s.duration <= DRONE_SECONDS.max)) return `A drone is ${DRONE_SECONDS.min}–${DRONE_SECONDS.max} seconds long.`;
  if (s.region) {
    const a = Math.min(s.region.startSeconds, s.region.endSeconds), b = Math.max(s.region.startSeconds, s.region.endSeconds);
    if (a < 0 || b > sourceSeconds + 1e-6) return 'The passage must lie inside the recording.';
    if (b - a < engine.MIN_REGION_SECONDS) return `Mark a passage of at least ${engine.MIN_REGION_SECONDS} seconds.`;
  }
  return null;
}

/** Applies solo exactly as the lab's effectiveMix does: the soloed layer sounds, and only it. */
export function effectiveSettings(s: DroneSettings): DroneSettings {
  const mix = engine.completeMix(s.preset, s.layerMix);
  return { ...s, layerMix: s.soloLayer === null ? mix : mix.map((m, i) => ({ ...m, enabled: i === s.soloLayer })) };
}

export async function renderDrone(src: DroneSource, s: DroneSettings, ambience: Ambience | null, onProgress?: (f: number, label: string) => void): Promise<RenderResult> {
  const problem = settingsProblem(s, src.data.length / src.rate);
  if (problem) throw new Error(problem);
  const { detail, ...rest } = effectiveSettings(s);
  // Step B: with every detail control where v0.3.4 has it, the ACCEPTED engine renders, unchanged, and the
  // recipe carries no detail block. Otherwise engine3 (derived by counted patches) renders with the detail.
  if (isNeutralDetail(detail)) return engine.render(src, rest, onProgress, { ambience });
  return engine3.render(src, { ...rest, detail: completeDetail(detail) }, onProgress, { ambience });
}

/** Which engine a setting renders through, for provenance. */
export const engineFor = (s: DroneSettings) => (isNeutralDetail(s.detail) ? 'v0.3.4 revision 2 (accepted, verbatim)' : 'v0.3.4 revision 2 + Resonance & Detail (engine3, derived)');

/**
 * A recipe the member saved earlier (from this desk or the lab). Only Voice to Drone recipes
 * are read; everything in them is re-clamped by the engine's own complete* functions.
 */
export function parseDroneRecipe(text: string): { ok: true; settings: DroneSettings } | { ok: false; reason: string } {
  let r: unknown;
  try { r = JSON.parse(text); } catch { return { ok: false, reason: 'This is not a recipe file.' }; }
  const fmt = (r as { format?: unknown })?.format;
  if (typeof fmt !== 'string' || !fmt.startsWith('SOULLAB_VOICE_TO_DRONE')) return { ok: false, reason: 'This is not a Voice to Drone recipe.' };
  const p = (r as { processing?: { preset?: unknown } }).processing;
  if (!p || !Object.prototype.hasOwnProperty.call(engine.presets, String(p.preset))) return { ok: false, reason: 'This recipe names a preset this desk does not have.' };
  const s = engine.recipeToSettings(r);
  const detail = (p as { detail?: unknown }).detail;
  return {
    ok: true,
    settings: {
      ...s, field: engine.completeField(s.field), clean: engine.completeClean(s.clean), level: engine.completeLevel(s.level), tune: engine.completeTune(s.tune),
      duration: Math.min(DRONE_SECONDS.max, Math.max(DRONE_SECONDS.min, Number(s.duration) || 30)),
      detail: detail == null ? null : completeDetail(detail),
    },
  };
}

/** The lab's recipe for this render, stating that rights are the member's own claim, not a clearance. */
export function droneRecipe(r: RenderResult, src: DroneSource, ambience: Ambience | null) {
  const amb = ambience ? { name: ambience.name, credit: '', rights: 'member-owned', rate: ambience.rate, seconds: ambience.seconds } : null;
  return engine.buildRecipe(r, src, null, 'member-owned', amb);
}

export function buildDroneProvenance(p: {
  source: SideInfo; ambience?: SideInfo; recipe: Record<string, unknown>;
  output: { name: string; audioSha256: string; sha256?: string; sampleRate: number; frames: number; channels: number };
  createdAt: string;
}) {
  return {
    schema: DRONE_PROVENANCE_SCHEMA,
    derived: true,
    createdAt: p.createdAt,
    onDevice: true,
    engine: {
      ...DRONE_ENGINE,
      // Step B: present only when a Resonance & Detail control moved; the render then came from engine3 (derived).
      ...((p.recipe as { processing?: { detail?: unknown } }).processing?.detail ? { resonanceAndDetail: 'engine3: engine.js + counted patches (scripts/listening/vendor_drone_engine.mjs)' } : {}),
    },
    source: p.source,
    ...(p.ambience ? { ambience: p.ambience } : {}),
    recipe: p.recipe,
    output: p.output,
    rights: 'Made from the member\'s own recording on their device. Not a rights clearance; the original is unchanged.',
  };
}
