// Types for engine3.js: engine.js plus the step B detail controls (Resonance & Detail), derived by counted patches.
export * from './engine';
import type { Ambience, DroneSettings, DroneSource, RenderResult } from './engine';
export type DetailInput = {
  toneHz?: number | null; size?: number; decay?: number; wet?: number; dry?: number;
  band?: { on?: boolean; hz?: number; q?: number; db?: number };
};
export const DETAIL_DEFAULTS: { toneHz: null; size: 1; decay: number; wet: 1; dry: 1; band: { on: false; hz: number; q: number; db: 0 } };
export function completeDetail(d: unknown): { toneHz: number | null; size: number; decay: number; wet: number; dry: number; band: { on: boolean; hz: number; q: number; db: number } };
export function render(src: DroneSource, opts: DroneSettings & { detail?: DetailInput | null }, onProgress?: (fraction: number, label: string) => void, assets?: { ambience?: Ambience | null }): Promise<RenderResult>;
