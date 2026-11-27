/**
 * Pattern recognition (SCE §6a, ratified 2026-11-23) for surfaces beyond the central
 * /maia conversation that already hold this turn's atoms: Between and the What Now?
 * room family. Thin helpers over lib/maia/patternRecognition.ts, kept in their own
 * module so that module stays with its owner.
 */
import type { MemoryAtomSnapshot } from '@/lib/maia/memoryAtomsLoader';
import {
  buildPatternTurnContext,
  loadPatternTurnInputs,
  type PatternOriginSurface,
  type PatternTurnContext,
} from '@/lib/maia/patternRecognition';

/**
 * The client's count of offers already made in this conversation (for Gentle).
 * Untrusted input: anything that is not a non-negative number reads as 0.
 *
 * On surfaces with more than one client (Between, rooms), sending this count
 * is also how a client declares that it renders PatternOfferCard: use
 * clientRendersPatternOffers() to gate. A client that cannot show the card gets the
 * strict no-crossing block, so MAIA never offers what the member cannot keep.
 */
export function clientRendersPatternOffers(v: unknown): boolean {
  return typeof v === 'number' && Number.isFinite(v);
}

/** The Gentle count as a safe non-negative integer. */
export function offersThisConversationFrom(v: unknown): number {
  return Math.max(0, Math.floor(Number(v) || 0));
}

/**
 * One call for a surface that already holds this turn's atoms: reads the member's
 * dial, confirmed patterns and keys, and builds the turn context. Sanctuary → null
 * without touching the database (§6a.0 — absolute). Never throws: any failure
 * returns null, and the caller renders the strict no-crossing block unchanged.
 */
export async function preparePatternTurn(input: {
  memberId: string;
  sanctuary: boolean;
  atoms: readonly MemoryAtomSnapshot[];
  memberMessage: string;
  offersThisConversation: number;
  originSurface: PatternOriginSurface;
}): Promise<PatternTurnContext | null> {
  if (input.sanctuary) return null;
  try {
    const inputs = await loadPatternTurnInputs(input.memberId);
    return buildPatternTurnContext({
      sanctuary: false,
      level: inputs.level,
      atoms: input.atoms,
      patterns: inputs.patterns,
      dismissedKeys: inputs.dismissedKeys,
      confirmedKeys: inputs.confirmedKeys,
      memberMessage: input.memberMessage,
      offersThisConversation: input.offersThisConversation,
      originSurface: input.originSurface,
    });
  } catch (err) {
    console.warn('[patterns] turn preparation failed — strict block kept', (err as Error)?.message);
    return null;
  }
}

