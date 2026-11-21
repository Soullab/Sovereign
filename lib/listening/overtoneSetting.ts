/**
 * The member's Overtones setting (founder, #1979, 2026-11-21: "we need to have the option to have the overtones on or
 * off and even what level of overtone. Right now, it is too obvious, even with it on low level").
 * One setting for every generated sound that has overtones: Your soundscape, Deep focus and Creative flow.
 * Tone Lab never has them. Remembered on this device only, like Level.
 *
 * The Amount scales the overtone bus linearly. 100% is the "Amount 100%" of both listening tests (bus gain 6.0);
 * 50% is option D, the amount the founder chose for Your soundscape on 2026-11-21 (bus gain 3.0). The default is 20%.
 */
export const OVERTONE_SETTING_STORAGE_KEY = 'soullab.listen.overtones.v1';
export const OVERTONE_FULL_BUS_GAIN = 6.0;

export type OvertoneSetting = { on: boolean; amount: number };

/** 20% for every sound (founder ruling 2026-11-21, #1979: "Yes, make it 20%", after hearing Deep focus at 20%: "This is
 * a great fix"). Before this setting, Deep focus and Creative flow played at 100% and Your soundscape at 50% (option D). */
export const DEFAULT_OVERTONE_SETTING: OvertoneSetting = Object.freeze({ on: true, amount: 20 });

export function normalizeOvertoneSetting(value: unknown): OvertoneSetting | null {
  if (!value || typeof value !== 'object') return null;
  const { on, amount } = value as Record<string, unknown>;
  if (typeof on !== 'boolean' || typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  return { on, amount: Math.max(0, Math.min(100, Math.round(amount))) };
}

type SettingStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function readStoredOvertoneSetting(storage: SettingStorage | null | undefined): OvertoneSetting {
  try {
    const raw = storage?.getItem(OVERTONE_SETTING_STORAGE_KEY);
    return (raw ? normalizeOvertoneSetting(JSON.parse(raw)) : null) ?? { ...DEFAULT_OVERTONE_SETTING };
  } catch {
    return { ...DEFAULT_OVERTONE_SETTING };
  }
}

export function writeStoredOvertoneSetting(storage: SettingStorage | null | undefined, setting: OvertoneSetting): void {
  const next = normalizeOvertoneSetting(setting);
  if (!next) return;
  try { storage?.setItem(OVERTONE_SETTING_STORAGE_KEY, JSON.stringify(next)); } catch { /* private window or blocked storage */ }
}

/** The overtone bus gain for this setting: 0 when off, so the overtones are silent but the tone plays on unchanged. */
export function overtoneBusGain(setting: OvertoneSetting): number {
  const next = normalizeOvertoneSetting(setting);
  return next && next.on ? (next.amount * OVERTONE_FULL_BUS_GAIN) / 100 : 0;
}
