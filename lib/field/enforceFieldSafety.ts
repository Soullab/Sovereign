// backend — lib/field/enforceFieldSafety.ts

import { routePanconsciousField } from './panconsciousFieldRouter';
import { getFieldSafetyCopy } from './fieldSafetyCopy';
import type { CognitiveProfile } from '../consciousness/cognitiveProfileService';
import type { FieldRoutingDecision } from './panconsciousFieldRouter';

export type FieldSafetyDecision = {
  allowed: boolean;
  message?: string;
  elementalNote?: string;
  fieldRouting: FieldRoutingDecision;
  /**
   * True when the router judged field work unsafe but the turn did not request
   * field work, so the gate stood aside. `fieldRouting.fieldWorkSafe` stays the
   * router's real answer; downstream shaping must read that, never `allowed`.
   */
  outOfScope?: boolean;
};

export type FieldSafetyContext = 'maia' | 'oracle' | 'field' | 'between' | 'unknown';

/**
 * Enforce Field Safety
 *
 * Reusable guard function for checking if a user is safe for field/symbolic work.
 * Call this at the top of API routes, services, and agents before proceeding.
 *
 * ⛔ SCOPE (2026-11-25, founder ruling "Yes, draft proposal"; reconciliation plan
 * docs/programme/CODE_TO_CANON_RECONCILIATION_PLAN_2026-11-25.md §5b):
 * this gate may refuse ONLY a turn that explicitly requests field work
 * (`fieldWorkRequested: true`). On an ordinary turn it never replaces MAIA's
 * reply, whatever the accumulated cognitive average says. Its input is a keyword
 * heuristic averaged over 20 turns; it has no standing to end a conversation the
 * member did not open as field work. No surface sets the flag today, so the gate
 * substitutes no reply anywhere until one is deliberately wired.
 *
 * @returns { allowed: true } if safe to proceed or out of scope,
 *          { allowed: false, message } only for a refused field-work request
 */
export function enforceFieldSafety(args: {
  cognitiveProfile: CognitiveProfile | null | undefined;
  element?: string | null;
  userName?: string | null;
  facet?: string | null;
  archetype?: string | null;
  bloomLevel?: number | null;
  context?: FieldSafetyContext;
  /** The turn explicitly asks for field/symbolic work. Defaults to false. */
  fieldWorkRequested?: boolean;
}): FieldSafetyDecision {
  const {
    cognitiveProfile,
    element,
    userName,
    facet,
    archetype,
    bloomLevel,
    context = 'unknown',
    fieldWorkRequested = false,
  } = args;

  // Route field work based on cognitive capacity
  const fieldRouting = routePanconsciousField({
    cognitiveProfile,
    element,
    facet,
    archetype,
    bloomLevel,
  });

  // If field work is safe, allow
  if (fieldRouting.fieldWorkSafe) {
    return { allowed: true, fieldRouting };
  }

  // Not a field-work request: the gate stands aside. The routing decision is
  // returned unchanged so downstream shaping stays conservative.
  if (!fieldWorkRequested) {
    return { allowed: true, outOfScope: true, fieldRouting };
  }

  // Otherwise, get mythic boundary message
  const copy = getFieldSafetyCopy({
    fieldRouting,
    element,
    userName,
  });

  console.log(
    `🛡️  [Field Safety Guard] Blocked ${context} request - ` +
      `fieldWorkSafe=false, realm=${fieldRouting.realm}, ` +
      `user=${userName || 'unknown'}`,
  );

  return {
    allowed: false,
    message: copy.message,
    elementalNote: copy.elementalNote,
    fieldRouting,
  };
}

/**
 * Quick check: is field work safe?
 * Use when you just need a boolean, not the full message.
 */
export function isFieldWorkSafe(
  cognitiveProfile: CognitiveProfile | null | undefined,
): boolean {
  if (!cognitiveProfile) return false;

  const fieldRouting = routePanconsciousField({ cognitiveProfile });
  return fieldRouting.fieldWorkSafe;
}

/**
 * Quick check: is deep symbolic work recommended?
 * Use when you need to know if upperworld access is granted.
 */
export function isDeepWorkRecommended(
  cognitiveProfile: CognitiveProfile | null | undefined,
): boolean {
  if (!cognitiveProfile) return false;

  const fieldRouting = routePanconsciousField({ cognitiveProfile });
  return fieldRouting.deepWorkRecommended;
}
