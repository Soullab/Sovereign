/**
 * Field Safety gate — scope (2026-11-25, founder ruling "Yes, draft proposal").
 *
 * Behavioural claim under test: the gate may replace MAIA's reply ONLY on a turn
 * that explicitly requests field work. On an ordinary turn it stands aside, while
 * the router's own verdict travels downstream unchanged so shaping stays
 * conservative. Reconciliation plan §5b,
 * docs/programme/CODE_TO_CANON_RECONCILIATION_PLAN_2026-11-25.md.
 */
import { enforceFieldSafety } from '../enforceFieldSafety';
import type { CognitiveProfile } from '../../consciousness/cognitiveProfileService';

function profile(rollingAverage: number): CognitiveProfile {
  return {
    userId: 'test-member',
    currentLevel: Math.round(rollingAverage),
    currentLabel: 'UNDERSTAND',
    currentScore: 0.5,
    lastUpdated: new Date(0),
    rollingAverage,
    stability: 'stable',
    bypassingFrequency: { spiritual: 0, intellectual: 0 },
    communityCommonsEligible: false,
    deepWorkRecommended: false,
    fieldWorkSafe: rollingAverage >= 2.5,
    window: 20,
    totalTurns: 20,
    turnsWithCognitiveTracking: 20,
  };
}

describe('enforceFieldSafety — scoped to requested field work', () => {
  let logSpy: jest.SpyInstance;
  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => logSpy.mockRestore());

  it('does not replace an ordinary turn for a member the router judges unsafe', () => {
    const d = enforceFieldSafety({ cognitiveProfile: profile(1.2), context: 'maia' });
    expect(d.allowed).toBe(true);
    expect(d.outOfScope).toBe(true);
    expect(d.message).toBeUndefined();
    expect(d.elementalNote).toBeUndefined();
  });

  it('keeps the router verdict truthful when it stands aside', () => {
    const d = enforceFieldSafety({ cognitiveProfile: profile(1.2) });
    expect(d.fieldRouting.fieldWorkSafe).toBe(false);
    expect(d.fieldRouting.maxSymbolicIntensity).toBe('low');
  });

  it('defaults to "not requested" — every existing caller is ordinary conversation', () => {
    const omitted = enforceFieldSafety({ cognitiveProfile: profile(0.5) });
    const explicitFalse = enforceFieldSafety({ cognitiveProfile: profile(0.5), fieldWorkRequested: false });
    expect(omitted.allowed).toBe(true);
    expect(explicitFalse.allowed).toBe(true);
  });

  it('still refuses an explicit field-work request the router judges unsafe', () => {
    const d = enforceFieldSafety({ cognitiveProfile: profile(1.2), fieldWorkRequested: true });
    expect(d.allowed).toBe(false);
    expect(d.outOfScope).toBeFalsy();
    expect(typeof d.message).toBe('string');
    expect(d.message!.length).toBeGreaterThan(0);
  });

  it('allows a requested field-work turn the router judges safe, without marking it out of scope', () => {
    const d = enforceFieldSafety({ cognitiveProfile: profile(3.0), fieldWorkRequested: true });
    expect(d.allowed).toBe(true);
    expect(d.outOfScope).toBeFalsy();
    expect(d.fieldRouting.fieldWorkSafe).toBe(true);
  });
});
