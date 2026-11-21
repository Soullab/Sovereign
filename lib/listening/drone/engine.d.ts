// Types for engine.js, the verbatim Voice to Drone Lab v0.3.4 (revision 2) engine.
// Only the surface Sound Studio uses is typed; the engine itself is not edited.

export type PresetId = 'living' | 'earth' | 'aether';
export type LayerMix = { enabled: boolean; level: number; pan: number; interval: number; entersAt: number; bloomSeconds: number };
export type FieldPath = 'still' | 'orbit' | 'drift' | 'rise' | 'passby';
export type FieldElement = { enabled: boolean; level: number; distance: number; height: number; angle: number; path: FieldPath; speed: number; direction: 1 | -1 };
export type Clean = { repairClips: boolean; lowCutHz: number; soften: number; smooth: number };
export type Level = { outputPeakDb: number; pushDb: number };
export type Tune = { cents: number; aRef: 432 | 440 };
export type Region = { startSeconds: number; endSeconds: number };

export type DroneSettings = {
  preset: PresetId; duration: number; stillness: number; grainMs: number; pitch: number; movement: number; space: number;
  anchor: number; loop: boolean; layerMix: LayerMix[]; soloLayer: number | null; region: Region | null;
  field: FieldElement[] | null; clean: Clean | null; level: Level | null; tune: Tune | null; engineRevision?: 1 | 2;
};
export type DroneSource = { data: Float32Array; rate: number; name: string; synthetic: boolean };
export type Ambience = { data: Float32Array; rate: number; name: string; seconds: number };
export type RenderResult = {
  blob: Blob; left: Float32Array; right: Float32Array; rate: number; frames: number; peak: number; rms: number;
  selectionStart: number; selectionSeconds: number; settings: DroneSettings & { layerMix: LayerMix[] };
  loudnessLufs: number | null; limiterReductionDb?: number; [k: string]: unknown;
};
export type Preset = { label: string; layerNames: string[]; layers: [number, number, number][]; defaults: { stillness: number; grain: number; movement: number; space: number; pitch: number }; cutoff: number };

export const presets: Record<PresetId, Preset>;
export const MIN_REGION_SECONDS: number;
export const INTERVAL_RANGE: [number, number];
export const FIELD_MODEL: string;
export const FIELD_PATHS: Record<FieldPath, string>;
export const FIELD_ELEMENTS: { key: 'shimmer' | 'breath' | 'murmur' | 'ambience'; name: string; from: 'voice' | 'file'; color: string; desc: string; defaults: FieldElement }[];
export function defaultLayerMix(preset: PresetId): LayerMix[];
export function completeMix(preset: PresetId, mix: Partial<LayerMix>[]): LayerMix[];
export function defaultField(): FieldElement[];
export function completeField(f: unknown): FieldElement[];
export function completeClean(c: unknown): Clean;
export function completeLevel(l: unknown): Level;
export function completeTune(t: unknown): Tune;
export function detectPitch(x: Float32Array, sr: number): { hz: number | null; confidence: number; frames: number };
export function noteInfo(hz: number, aRef: number): { name: string; cents: number };
export function snapCents(hz: number, pitchSt: number, aRef: number): number;
export function measureLufs(left: Float32Array, right: Float32Array, sr: number): number | null;
export function render(src: DroneSource, opts: DroneSettings, onProgress?: (fraction: number, label: string) => void, assets?: { ambience?: Ambience | null }): Promise<RenderResult>;
export function buildRecipe(r: RenderResult, source: DroneSource, credit: string | null, rights: string, ambienceMeta?: { name: string; credit: string; rights: string; rate: number; seconds: number } | null): Record<string, unknown> & { format: string };
export function recipeToSettings(recipe: unknown): DroneSettings;
export function wav24(left: Float32Array, right: Float32Array, rate: number): Blob;
