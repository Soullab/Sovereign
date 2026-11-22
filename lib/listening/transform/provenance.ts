/**
 * SOULLAB TRANSFORM T1 — what a transformed file says about itself, and the
 * rule about what may be transformed at all.
 *
 * Only a File the member chose from their own device is accepted. A URL, a
 * path, a Blob without a name, or anything served by the Sound Studio media
 * gate is refused: catalogue, Soullab and provider works stay
 * un-transformable until an independent rights authority exists
 * (lib/listening/rightsPolicy.ts is unchanged). Founder ruling 2026-11-17.
 */
import { validateLocalAudio } from '../localAudio';
import { TRANSFORM_VERSION, type TransformStep } from './recipe';
import type { CaptureOrigin } from './captureTake';
import { MASTERING_VERSION } from './mastering';

export type MemberFile = File & { readonly __memberChosen: true };

/** Accepts only a File object the member picked; never a location. */
export function acceptMemberFile(input: unknown): { ok: true; file: MemberFile } | { ok: false; reason: string } {
  if (typeof input === 'string' || input instanceof URL) {
    return { ok: false, reason: 'Transform works only on a file you choose from this device, never on a link.' };
  }
  if (typeof File === 'undefined' || !(input instanceof File)) {
    return { ok: false, reason: 'Transform works only on a file you choose from this device.' };
  }
  if (/^(https?:|blob:|\/media\/|\/api\/)/i.test(input.name) || input.name.includes('sound-studio/')) {
    return { ok: false, reason: 'Soullab and catalogue recordings cannot be transformed.' };
  }
  const v = validateLocalAudio(input);
  if (v.allowed === false) return { ok: false, reason: v.reason };
  return { ok: true, file: input as MemberFile };
}

export async function sha256Hex(bytes: BufferSource): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type SideInfo = {
  name: string; sha256: string; sampleRate: number; frames: number; channels: number; decodedBy: 'soullab-wav' | 'browser';
  /** Present when the file is a Soullab Capture take (J4b-1): the take's own claim, carried into the derived take. */
  capture?: CaptureOrigin;
};

export function buildProvenance(p: {
  source: SideInfo; second?: SideInfo; steps: readonly TransformStep[];
  /**
   * audioSha256 covers the samples alone. sha256 covers the whole saved file, so
   * only the provenance file beside the WAV can state it: a record embedded in
   * the WAV cannot contain a hash of the file that contains it.
   */
  output: { name: string; audioSha256: string; sha256?: string; sampleRate: number; frames: number; channels: number };
  createdAt: string;
}) {
  const masteringStages = p.steps.filter((s): s is Extract<TransformStep, { kind: 'voiceMaster' }> => s.kind === 'voiceMaster');
  return {
    schema: 'soullab.transform.provenance.v1',
    derived: true,
    transformVersion: TRANSFORM_VERSION,
    createdAt: p.createdAt,
    onDevice: true,
    source: p.source,
    ...(p.second ? { joined: p.second } : {}),
    recipe: p.steps,
    ...(masteringStages.length ? { voiceMastering: { version: MASTERING_VERSION, stages: masteringStages.map((s) => ({ profile: s.profile, intensity: s.intensity, outputTrimDb: s.outputTrimDb })) } } : {}),
    output: { ...p.output, format: { container: 'wav', encoding: 'pcm_s24le', bitsPerSample: 24 } },
    note: 'Made on the member\'s device from their own recording. The original file was not modified.',
  };
}
