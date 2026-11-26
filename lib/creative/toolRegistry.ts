/**
 * Creative Field: registry of the creative tools available to the internal team.
 *
 * Owner record: Soullab/Sovereign#2417. Stage 1 is READ-ONLY: this registry
 * describes tools; nothing here runs, queues or pays for a generation.
 *
 * Served ONLY through the admin-guarded route `app/api/admin/creative-field`.
 * Client code may import types from this file, never the values.
 *
 * Every tool states its license and the obligations that travel with its
 * output, so an asset never leaves the field without them. Measurements are
 * local smoke-test evidence from the founder's Mac Studio (M4 Max, 48 GB),
 * dated; they are not performance claims.
 */
import type { AdminRole } from '@/lib/admin/adminAuth';

/** Internal team only (founder ruling 2026-11-26). Practitioners are a later stage. */
export const CREATIVE_FIELD_ROLES: AdminRole[] = ['founder', 'cto', 'operations'];

export type ToolKind = 'image' | 'video' | 'assembly';
export type ToolEngine = 'local' | 'fal';
export type CostClass = 'free' | 'paid';
export type ToolStatus = 'verified-locally' | 'disabled';

export type Obligation =
  | 'disclose-machine-generated'
  | 'revenue-threshold-10m'
  | 'no-competing-product'
  | 'no-safety-bypass'
  | 'cost-approval-required'
  | 'check-provider-terms';

export interface ToolLicense {
  name: string;
  /** SPDX id when one exists. */
  spdx?: string;
  url: string;
  commercialUse: 'yes' | 'conditional' | 'per-provider';
}

export interface ToolMeasurement {
  date: string;
  setting: string;
  result: string;
}

export interface CreativeTool {
  id: string;
  label: string;
  kind: ToolKind;
  engine: ToolEngine;
  model: string;
  runtime: string;
  license: ToolLicense;
  obligations: Obligation[];
  costClass: CostClass;
  status: ToolStatus;
  allowedRoles: AdminRole[];
  measured: ToolMeasurement[];
  notes: string;
}

export const OBLIGATION_TEXT: Record<Obligation, string> = {
  'disclose-machine-generated': 'Published output must be clearly disclosed as machine-generated.',
  'revenue-threshold-10m': 'Free only while the entity, with affiliates, has under $10M annual revenue.',
  'no-competing-product': 'Not for use in a product that competes with the licensor.',
  'no-safety-bypass': 'Safety features and content filters may not be circumvented.',
  'cost-approval-required': 'Every job needs an explicit, recorded cost approval within the caps.',
  'check-provider-terms': "Output rights follow the chosen provider model's own terms.",
};

export const CREATIVE_TOOLS: CreativeTool[] = [
  {
    id: 'image.flux2-klein-4b',
    label: 'Still images',
    kind: 'image',
    engine: 'local',
    model: 'FLUX.2 [klein] 4B (distilled)',
    runtime: 'ComfyUI 0.46.3 or mflux 0.24.0 (MLX)',
    license: {
      name: 'Apache License 2.0',
      spdx: 'Apache-2.0',
      url: 'https://huggingface.co/black-forest-labs/FLUX.2-klein-4B',
      commercialUse: 'yes',
    },
    obligations: [],
    costClass: 'free',
    status: 'verified-locally',
    allowedRoles: CREATIVE_FIELD_ROLES,
    measured: [
      { date: '2026-11-26', setting: '1024×1024, 4 steps, mflux', result: '15–18 s per image incl. model load' },
      { date: '2026-11-26', setting: '1024×1024, 4 steps, ComfyUI', result: '52 s cold, 19 s warm' },
    ],
    notes: 'Strong on photographic scenes; object structure can fail on ambiguous prompts.',
  },
  {
    id: 'video.wan22-ti2v-5b',
    label: 'Video (Wan)',
    kind: 'video',
    engine: 'local',
    model: 'Wan 2.2 TI2V-5B (fp16)',
    runtime: 'ComfyUI 0.46.3',
    license: {
      name: 'Apache License 2.0',
      spdx: 'Apache-2.0',
      url: 'https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged',
      commercialUse: 'yes',
    },
    obligations: [],
    costClass: 'free',
    status: 'verified-locally',
    allowedRoles: CREATIVE_FIELD_ROLES,
    measured: [{ date: '2026-11-26', setting: '832×480, 3 s, 20 steps', result: '8.7 min per clip' }],
    notes: 'Coherent scenes; requested camera motion is often rendered nearly static.',
  },
  {
    id: 'video.ltx23-distilled',
    label: 'Video with sound (LTX)',
    kind: 'video',
    engine: 'local',
    model: 'LTX-2.3 22B distilled 1.1 (int8 MLX)',
    runtime: 'ltx-2-mlx v0.18.0',
    license: {
      name: 'LTX-2 Community License (2026-01-05)',
      url: 'https://github.com/Lightricks/LTX-2/blob/main/LICENSE-2',
      commercialUse: 'conditional',
    },
    obligations: ['disclose-machine-generated', 'revenue-threshold-10m', 'no-competing-product', 'no-safety-bypass'],
    costClass: 'free',
    status: 'verified-locally',
    allowedRoles: CREATIVE_FIELD_ROLES,
    measured: [{ date: '2026-11-26', setting: '768×512, 4 s, distilled', result: '137 s per clip, peak 25.5 GB' }],
    notes: 'Real camera motion and a stereo soundtrack; the soundtrack has not been reviewed by ear.',
  },
  {
    id: 'assembly.ffmpeg',
    label: 'Assembly',
    kind: 'assembly',
    engine: 'local',
    model: 'FFmpeg 8.0',
    runtime: 'assemble.py (edit list → ProRes master + HEVC delivery)',
    license: {
      name: 'FFmpeg (LGPL/GPL build)',
      url: 'https://ffmpeg.org/legal.html',
      commercialUse: 'yes',
    },
    obligations: [],
    costClass: 'free',
    status: 'verified-locally',
    allowedRoles: CREATIVE_FIELD_ROLES,
    measured: [{ date: '2026-11-26', setting: '14 s reel, 5 segments, music bed', result: '12 s, −13.7 LUFS' }],
    notes: 'Titles, stills with slow zoom, clips, crossfades and a loudness-normalised music bed.',
  },
  {
    id: 'paid.fal',
    label: 'Paid generation (fal.ai)',
    kind: 'video',
    engine: 'fal',
    model: 'Per endpoint, chosen at job time',
    runtime: 'fal_gate.py (fal-client 1.0.3)',
    license: {
      name: 'Per provider model',
      url: 'https://fal.ai/models',
      commercialUse: 'per-provider',
    },
    obligations: ['cost-approval-required', 'check-provider-terms'],
    costClass: 'paid',
    status: 'disabled',
    allowedRoles: CREATIVE_FIELD_ROLES,
    measured: [],
    notes: 'Disabled: no key has been added. Caps $2 per job and $25 per month once enabled.',
  },
];

export const CREATIVE_FIELD_STANDING = {
  stage: 1 as const,
  mode: 'read-only' as const,
  ownerIssue: 'Soullab/Sovereign#2417',
  notice:
    'Stage 1 lists the tools and what their licenses require. Nothing on this page generates, queues or spends. ' +
    'Generation arrives in stage 2 through a worker on the Mac Studio; the local stack is never exposed to the network.',
  worker: { connected: false as const, note: 'No worker yet: generation is stage 2.' },
};

export type CreativeFieldPayload = {
  standing: typeof CREATIVE_FIELD_STANDING;
  tools: CreativeTool[];
  obligationText: Record<Obligation, string>;
};
