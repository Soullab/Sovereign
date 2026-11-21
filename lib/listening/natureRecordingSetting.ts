/**
 * The member's "Nature recordings" amount (N1, #1979, founder go-ahead 2026-11-21: "Yes, start N1").
 * How loud the real recorded layers of the Nature world are, from 0% (synthesis alone, for comparison) to 100%
 * (the mix the Nature world already chooses from need, stimulation and task). Remembered on this device only.
 */
export const NATURE_RECORDING_STORAGE_KEY = 'soullab.listen.nature-recordings.v1';
export const DEFAULT_NATURE_RECORDING_AMOUNT = 100;

export function normalizeNatureRecordingAmount(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

type AmountStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function readStoredNatureRecordingAmount(storage: AmountStorage | null | undefined): number {
  try {
    return normalizeNatureRecordingAmount(storage?.getItem(NATURE_RECORDING_STORAGE_KEY) ?? null) ?? DEFAULT_NATURE_RECORDING_AMOUNT;
  } catch {
    return DEFAULT_NATURE_RECORDING_AMOUNT;
  }
}

export function writeStoredNatureRecordingAmount(storage: AmountStorage | null | undefined, amount: number): void {
  const next = normalizeNatureRecordingAmount(amount);
  if (next === null) return;
  try { storage?.setItem(NATURE_RECORDING_STORAGE_KEY, String(next)); } catch { /* private window or blocked storage */ }
}

/** The recordings bus gain for an amount: linear, 0 to 1. */
export function natureRecordingGain(amount: number): number {
  return (normalizeNatureRecordingAmount(amount) ?? DEFAULT_NATURE_RECORDING_AMOUNT) / 100;
}

/** The engine's seven layer slots, in the order the picker lists them. */
export const NATURE_LAYER_LABELS: Readonly<Record<string, string>> = Object.freeze({
  night: 'night', forest: 'forest', wind: 'wind', waves: 'waves', rain: 'rain', birds: 'birds', trees: 'trees',
});
