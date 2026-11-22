/**
 * SOULLAB TRANSFORM T1 — apply a recipe to a member's own recording.
 *
 * Edit steps are exact sample arithmetic (audio.ts); consecutive shaping steps
 * are rendered together by Web Audio offline (nodes.ts). The input is never
 * modified. The result is a new Audio, and the provenance (provenance.ts)
 * records the recipe that made it.
 */
import { fade, gain, join, loop, normalize, reverse, seconds, trim, type Audio } from './audio';
import { renderNodeSteps } from './nodes';
import { masterVoice } from './mastering';
import { MAX_TRANSFORM_SECONDS, NODE_STEPS, recipeProblem, type TransformStep } from './recipe';

type OfflineCtor = new (channels: number, length: number, sampleRate: number) => OfflineAudioContext;

export type RenderOptions = {
  /** The second member recording, required only by a `join` step. */
  second?: Audio;
  /** The browser's OfflineAudioContext; required only by shaping steps. */
  Offline?: OfflineCtor;
};

export async function renderRecipe(source: Audio, steps: readonly TransformStep[], opts: RenderOptions = {}): Promise<Audio> {
  const problem = recipeProblem(steps, source.sampleRate / 2);
  if (problem) throw new Error(problem);
  if (seconds(source) > MAX_TRANSFORM_SECONDS) throw new Error('This recording is longer than 20 minutes.');
  let a = source;
  for (let i = 0; i < steps.length;) {
    const step = steps[i];
    if (NODE_STEPS.has(step.kind)) {
      let j = i;
      while (j < steps.length && NODE_STEPS.has(steps[j].kind)) j++;
      if (!opts.Offline) throw new Error('This browser cannot render EQ, filters or reverb.');
      a = await renderNodeSteps(a, steps.slice(i, j), opts.Offline);
      i = j;
      continue;
    }
    switch (step.kind) {
      case 'trim': a = trim(a, step.startSec, step.endSec); break;
      case 'fade': a = fade(a, step.inSec, step.outSec); break;
      case 'normalize': a = normalize(a, step.peakDbfs); break;
      case 'reverse': a = reverse(a); break;
      case 'loop': a = loop(a, step.times, step.crossfadeMs); break;
      case 'gain': a = gain(a, step.db); break;
      case 'voiceMaster': a = masterVoice(a, { profile: step.profile, intensity: step.intensity, outputTrimDb: step.outputTrimDb }).audio; break;
      case 'join':
        if (!opts.second) throw new Error('Choose the recording to join.');
        a = join(a, opts.second, step.crossfadeMs);
        break;
      default: throw new Error('Unknown step.');
    }
    i++;
  }
  if (a === source) a = { sampleRate: source.sampleRate, channels: source.channels.map((c) => c.slice()) };
  if (seconds(a) > MAX_TRANSFORM_SECONDS) throw new Error('The result would be longer than 20 minutes.');
  return a;
}
