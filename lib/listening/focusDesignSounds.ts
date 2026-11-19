// The sound saved BESIDE a Focus design (founder ruling 2026-11-19, #1979 comment 7021457262).
//
// The design itself stays the LISTEN-48 combination record (focusDesigns.ts), which holds no sound and no
// track ID. This separate on-device list, owned by the sound side (the one persistent player), pairs a design's
// opaque id with the session sound picker's own choice name, and nothing else: no file, URL, provider or rights
// data. Recalling a pairing selects that choice in the picker; it never plays. Open Ground's Play still passes
// the media gate. FOCUS_SESSION_MEDIA_AUTHORITY stays `none`. The encrypted designs file does not carry it.
import { FOCUS_SOUND_IDS, type FocusSoundId } from './focusSoundChoices';

export const FOCUS_DESIGN_SOUNDS_STORAGE_KEY = 'soullab.listen.focus.design-sounds.v1';
export const FOCUS_DESIGN_SOUNDS_FORMAT = 'SOULLAB_FOCUS_DESIGN_SOUNDS_V1';
export const FOCUS_DESIGN_SOUNDS_MAX = 24; // the same as the designs it sits beside
const DESIGN_ID = /^[a-z0-9][a-z0-9_-]{7,63}$/; // the design's own opaque id rule

export type FocusDesignSounds = Readonly<Record<string, FocusSoundId>>;
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function isFocusSoundId(value: unknown): value is FocusSoundId {
  return typeof value === 'string' && (FOCUS_SOUND_IDS as readonly string[]).includes(value);
}

function validate(input: unknown): FocusDesignSounds {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Not a list of design sounds.');
  const v = input as { format?: unknown; sounds?: unknown };
  if (v.format !== FOCUS_DESIGN_SOUNDS_FORMAT || Object.keys(v).length !== 2) throw new Error('Not a list of design sounds.');
  if (!v.sounds || typeof v.sounds !== 'object' || Array.isArray(v.sounds)) throw new Error('Not a list of design sounds.');
  const entries = Object.entries(v.sounds as Record<string, unknown>);
  if (entries.length > FOCUS_DESIGN_SOUNDS_MAX) throw new Error('Too many design sounds.');
  const out: Record<string, FocusSoundId> = {};
  for (const [id, sound] of entries) {
    if (!DESIGN_ID.test(id) || !isFocusSoundId(sound)) throw new Error('A design sound is not one of the picker’s choices.');
    out[id] = sound;
  }
  return Object.freeze(out);
}

/** Pairs a design with a sound choice. Refuses anything that is not a design id and one of the picker's choices. */
export function withDesignSound(sounds: FocusDesignSounds, designId: string, sound: FocusSoundId): FocusDesignSounds {
  return validate({ format: FOCUS_DESIGN_SOUNDS_FORMAT, sounds: { ...sounds, [designId]: sound } });
}

/** Keeps only the pairings whose design still exists (after Remove, Forget all, or restoring a file). */
export function keepDesignSounds(sounds: FocusDesignSounds, designIds: readonly string[]): FocusDesignSounds {
  const keep = new Set(designIds);
  return Object.freeze(Object.fromEntries(Object.entries(sounds).filter(([id]) => keep.has(id))));
}

/** Reads this browser's pairings. A damaged or foreign list is reported, never trusted, and left untouched. */
export function readDesignSounds(storage: Store | null | undefined): { sounds: FocusDesignSounds; available: boolean; problem: string | null } {
  const empty: FocusDesignSounds = Object.freeze({});
  if (!storage) return { sounds: empty, available: false, problem: null };
  let raw: string | null;
  try { raw = storage.getItem(FOCUS_DESIGN_SOUNDS_STORAGE_KEY); } catch { return { sounds: empty, available: false, problem: null }; }
  if (raw === null) return { sounds: empty, available: true, problem: null };
  try { return { sounds: validate(JSON.parse(raw)), available: true, problem: null }; }
  catch { return { sounds: empty, available: true, problem: 'The sounds saved with your designs could not be read.' }; }
}

/** Writes the pairings; an empty list removes the key. Returns false when this browser is not keeping them. */
export function writeDesignSounds(storage: Store | null | undefined, sounds: FocusDesignSounds): boolean {
  if (!storage) return false;
  try {
    const valid = validate({ format: FOCUS_DESIGN_SOUNDS_FORMAT, sounds });
    if (Object.keys(valid).length === 0) storage.removeItem(FOCUS_DESIGN_SOUNDS_STORAGE_KEY);
    else storage.setItem(FOCUS_DESIGN_SOUNDS_STORAGE_KEY, JSON.stringify({ format: FOCUS_DESIGN_SOUNDS_FORMAT, sounds: valid }));
    return true;
  } catch { return false; }
}
