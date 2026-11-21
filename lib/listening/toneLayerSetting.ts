/**
 * The member's TONE LAYER inside a soundscape (N2, #1979; founder 2026-11-21: "Yes, design it", "Yes, build N2").
 * A tone of their choosing (40–1000 Hz) with an optional pulse (binaural, monaural or isochronic, 0.5–40 Hz), sitting
 * inside the soundscape at an amount they set. Limits come from Tone Lab (toneLab.ts), the one owner of tone safety.
 *
 * POSITIONING (founder ruling 2026-11-21, #1979 comment 7064027756: "This would be enough for me"): every label
 * names what the sound IS (frequency, pulse mode, rate) and never what it does. EFFECT_WORDS is enforced by a test.
 * Remembered on this device only, like Level.
 */
import { PULSE_MODES, clampPulseHz, clampToneHz, type PulseMode, type ToneSpec } from './toneLab';

export const TONE_LAYER_STORAGE_KEY = 'soullab.listen.tone-layer.v1';
export type ToneLayerSetting = { on: boolean; hz: number; pulseMode: PulseMode; pulseHz: number; amount: number };

/** Off by default: a soundscape carries a tone only when the member adds one. 50% is half of Tone Lab's own level. */
export const DEFAULT_TONE_LAYER: ToneLayerSetting = Object.freeze({ on: false, hz: 432, pulseMode: 'none', pulseHz: 6, amount: 50 });

/** Quick picks, named only by what they are. */
export const TONE_LAYER_PICKS: ReadonlyArray<{ id: string; label: string; set: Pick<ToneLayerSetting, 'hz' | 'pulseMode' | 'pulseHz'> }> = [
  { id: '432', label: '432 Hz', set: { hz: 432, pulseMode: 'none', pulseHz: 6 } },
  { id: '528', label: '528 Hz', set: { hz: 528, pulseMode: 'none', pulseHz: 6 } },
  { id: 'iso-6', label: '6 Hz isochronic', set: { hz: 432, pulseMode: 'isochronic', pulseHz: 6 } },
  { id: 'bin-10', label: '10 Hz binaural (headphones)', set: { hz: 220, pulseMode: 'binaural', pulseHz: 10 } },
];

/** Words that name an effect on a person. None may appear in any member-facing text of the tone, weave or nature controls. */
export const EFFECT_WORDS: readonly string[] = [
  'heal', 'healing', 'cure', 'therapy', 'therapeutic', 'dna', 'repair', 'manifest', 'manifestation', 'chakra',
  'entrain', 'entrainment', 'brainwave', 'brain wave', 'deep sleep', 'insomnia', 'anxiety', 'stress relief', 'detox',
  'immune', 'pain', 'miracle', 'activate your', 'unlock your', 'raise your vibration', 'guaranteed', 'clinically',
];

export function normalizeToneLayer(value: unknown): ToneLayerSetting | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.on !== 'boolean') return null;
  const mode = PULSE_MODES.some(m => m.id === v.pulseMode) ? (v.pulseMode as PulseMode) : 'none';
  const amount = typeof v.amount === 'number' && Number.isFinite(v.amount) ? Math.max(0, Math.min(100, Math.round(v.amount))) : DEFAULT_TONE_LAYER.amount;
  return { on: v.on, hz: clampToneHz(v.hz), pulseMode: mode, pulseHz: clampPulseHz(v.pulseHz), amount };
}

type LayerStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function readStoredToneLayer(storage: LayerStorage | null | undefined): ToneLayerSetting {
  try {
    const raw = storage?.getItem(TONE_LAYER_STORAGE_KEY);
    return (raw ? normalizeToneLayer(JSON.parse(raw)) : null) ?? { ...DEFAULT_TONE_LAYER };
  } catch {
    return { ...DEFAULT_TONE_LAYER };
  }
}

export function writeStoredToneLayer(storage: LayerStorage | null | undefined, setting: ToneLayerSetting): void {
  const next = normalizeToneLayer(setting);
  if (!next) return;
  try { storage?.setItem(TONE_LAYER_STORAGE_KEY, JSON.stringify(next)); } catch { /* private window or blocked storage */ }
}

/** The tone the engine should carry, or null when the layer is off. */
export function toneLayerSpec(setting: ToneLayerSetting): ToneSpec | null {
  const s = normalizeToneLayer(setting);
  if (!s || !s.on) return null;
  return { hz: s.hz, pulseMode: s.pulseMode, pulseHz: s.pulseMode === 'none' ? 0 : s.pulseHz };
}

/** The layer's amount as the engine's 0–1 (1 = as loud as Tone Lab itself at the same Level, never louder). */
export function toneLayerAmountGain(setting: ToneLayerSetting): number {
  return (normalizeToneLayer(setting)?.amount ?? DEFAULT_TONE_LAYER.amount) / 100;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
/** A factual label: what the sound is, nothing about what it does. */
export function toneLayerLabel(setting: ToneLayerSetting): string {
  const s = normalizeToneLayer(setting) ?? { ...DEFAULT_TONE_LAYER };
  if (!s.on) return 'No tone';
  const tone = `${fmt(s.hz)} Hz tone`;
  if (s.pulseMode === 'none') return tone;
  return `${tone} · ${fmt(s.pulseHz)} Hz ${s.pulseMode} pulse${s.pulseMode === 'binaural' ? ' (headphones)' : ''}`;
}

/**
 * A design's tone layer, kept BESIDE the Focus design on this device (N2-c), like the design's sound
 * (focusDesignSounds.ts). The LISTEN-48 design record itself is unchanged. Recalling a design selects its tone layer
 * and never starts sound: Play stays a separate member action.
 */
export const DESIGN_TONES_STORAGE_KEY = 'soullab.listen.focus.design-tones.v1';
export const DESIGN_TONES_MAX = 24; // the same as the designs it sits beside
export type DesignTones = Readonly<Record<string, ToneLayerSetting>>;

export function readDesignTones(storage: LayerStorage | null | undefined): DesignTones {
  try {
    const raw = storage?.getItem(DESIGN_TONES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return Object.freeze({});
    const out: Record<string, ToneLayerSetting> = {};
    for (const [id, value] of Object.entries(parsed).slice(0, DESIGN_TONES_MAX)) {
      const n = typeof id === 'string' && id.length <= 128 ? normalizeToneLayer(value) : null;
      if (n) out[id] = n;
    }
    return Object.freeze(out);
  } catch {
    return Object.freeze({});
  }
}

export function writeDesignTones(storage: LayerStorage | null | undefined, tones: DesignTones): boolean {
  try { storage?.setItem(DESIGN_TONES_STORAGE_KEY, JSON.stringify(tones)); return true; } catch { return false; }
}

export function withDesignTone(tones: DesignTones, designId: string, setting: ToneLayerSetting): DesignTones {
  const n = normalizeToneLayer(setting);
  if (!n || typeof designId !== 'string' || designId.length === 0 || designId.length > 128) return tones;
  const next: Record<string, ToneLayerSetting> = { ...tones, [designId]: n };
  const ids = Object.keys(next);
  for (const id of ids.slice(0, Math.max(0, ids.length - DESIGN_TONES_MAX))) delete next[id];
  return Object.freeze(next);
}

export function keepDesignTones(tones: DesignTones, designIds: readonly string[]): DesignTones {
  const keep = new Set(designIds);
  return Object.freeze(Object.fromEntries(Object.entries(tones).filter(([id]) => keep.has(id))));
}
