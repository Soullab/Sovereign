import type { RefusalCheck } from './harness';

/**
 * Refusal 32 — MAIA is never covertly steered toward a developmental level, and an
 * accumulated cognitive heuristic may not replace an ordinary reply.
 *
 * Founder ruling 2026-11-25 ("Yes, draft proposal") on the reconciliation plan
 * docs/programme/CODE_TO_CANON_RECONCILIATION_PLAN_2026-11-25.md §5b. Two limbs:
 *
 *   A. NO COVERT STEERING. The Dialectical Scaffold injected, on FAST, CORE and
 *      DEEP, an instruction to "pull" / "scaffold" the member toward the next Bloom
 *      level, and on FAST/DEEP to hide that it was doing so. That is shaping toward
 *      a destination the member did not choose (Invariant 14; Canon v1.1 :119-125;
 *      non-manipulation). Bloom DETECTION may remain as a private lens; its output
 *      may not reach the prompt as a steering directive.
 *
 *   B. FIELD SAFETY IS SCOPED. enforceFieldSafety may refuse only a turn that
 *      explicitly requests field work. Its input is a keyword heuristic averaged
 *      over 20 turns (R23 records it as WARRANT: NONE FOUND for AUTHORITY/GATE).
 *      On an ordinary turn it stands aside; the router's verdict still travels
 *      downstream so shaping stays conservative.
 *
 * Grade B — source-level. A fork defeats it only by re-adding a steering block,
 * flipping the default, or passing `fieldWorkRequested: true` — all visible diffs.
 *
 * SCOPE: pins code shape only. It asserts nothing about production, and nothing
 * about the cognitive_turn_events writer (whose failure is unattributed and HELD).
 */

const SERVICE = 'lib/sovereign/maiaService.ts';
const VOICE = 'lib/sovereign/maiaVoice.ts';
const GATE = 'lib/field/enforceFieldSafety.ts';
const ROUTES = ['app/api/sovereign/app/maia/route.ts', 'app/api/sovereign/app/maia/list/route.ts'];

// Steering vocabulary that may not appear in any prompt-producing source.
const STEERING_RE = "Pull them toward Level|Do NOT mention Bloom|Scaffold (them )?toward|generateCognitiveScaffoldingGuidance\\(";

function codeLines(src: string): string[] {
  return src.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l));
}

export const check: RefusalCheck = {
  id: 'R32',
  refusal:
    'No prompt carries a directive to move the member toward a developmental level (and none conceals one); the Field Safety gate may replace a reply only on an explicit field-work request.',
  grade: 'B',
  enforcedBy:
    'lib/sovereign/maiaService.ts (FAST/DEEP scaffold constants are empty); lib/sovereign/maiaVoice.ts (CORE scaffold generator removed); lib/field/enforceFieldSafety.ts (fieldWorkRequested defaults false, out-of-scope early return before any boundary message).',
  evidence: [
    `${SERVICE}: \`const cognitiveScaffolding = ''\` and \`const cognitiveScaffoldingNote = ''\``,
    `${VOICE}: no scaffold generator or injection`,
    `lib/ + app/: no steering vocabulary in code lines`,
    `${GATE}: \`fieldWorkRequested = false\` default; \`if (!fieldWorkRequested)\` returns allowed before getFieldSafetyCopy`,
    `${ROUTES.join(', ')}: downstream fieldWorkSafe reads fieldRouting, not the gate's pass`,
  ].join(' | '),
  violationAttempted: [
    '(1) has a steering block been re-added on FAST or DEEP?',
    '(2) has the CORE scaffold generator returned?',
    '(3) does any lib/app code line carry the steering vocabulary?',
    '(4) has the gate default flipped, or the out-of-scope return moved after the boundary message?',
    '(5) does any caller now request field work (a deliberate act that needs its own ruling)?',
    '(6) do the routes again report the gate pass as "fieldWorkSafe"?',
  ].join('; '),
  passingAuthorizes:
    'the claim that, in source, no tier injects developmental steering and the Field Safety gate cannot replace an ordinary reply.',
  passingDoesNotAuthorize:
    'that production runs this code (needs a deployed SHA); that Bloom detection itself is warranted; that the cognitive_turn_events writer is repaired; that any surface may now request field work.',
  hostileForkMustChange:
    're-add a scaffold string or generator (visible), set a scaffold constant non-empty (visible), change `fieldWorkRequested = false` or move the early return (visible), or pass `fieldWorkRequested: true` at a call site (visible).',

  run(io) {
    const service = io.read(SERVICE);
    const voice = io.read(VOICE);
    const gate = io.read(GATE);

    // ── A1: FAST/DEEP scaffold constants are empty ──
    const fastEmpty = /const cognitiveScaffolding = '';/.test(service);
    const deepEmpty = /const cognitiveScaffoldingNote = '';/.test(service);
    const reassigned = codeLines(service).filter(l => /\bcognitiveScaffolding(Note)?\s*(\+?=)(?!=)/.test(l) && !/const /.test(l));
    if (fastEmpty && deepEmpty && reassigned.length === 0) {
      io.pass('FAST and DEEP inject no scaffold', 'both scaffold values are empty constants and never reassigned');
    } else {
      io.fail('a FAST/DEEP scaffold can reach the prompt', `fastEmpty=${fastEmpty} deepEmpty=${deepEmpty} reassigned=${reassigned.length}`);
    }

    // ── A2: CORE generator gone ──
    if (!/function generateCognitiveScaffoldingGuidance/.test(voice) && !codeLines(voice).some(l => /cognitiveGuidance/.test(l))) {
      io.pass('CORE injects no scaffold', 'maiaVoice has no scaffold generator and no injection site');
    } else {
      io.fail('CORE scaffold generator or injection present', VOICE);
    }

    // ── A3: steering vocabulary absent from code lines ──
    const hits = io
      .grep(STEERING_RE, ['lib', 'app'])
      .filter(h => {
        const text = h.split(':').slice(2).join(':');
        return !/^\s*(\/\/|\*|\/\*)/.test(text) && !/bloomCognitionDemo\.ts/.test(h);
      });
    if (hits.length === 0) {
      io.pass('no steering vocabulary in prompt-producing code', 'lib/ and app/ code lines carry no "pull/scaffold toward" directive');
    } else {
      io.fail('steering vocabulary present', hits.slice(0, 3).map(h => h.slice(0, 120)).join(' // '));
    }

    // ── B1: gate default and ordering ──
    const def = /fieldWorkRequested = false/.test(gate);
    const earlyIdx = gate.indexOf('if (!fieldWorkRequested)');
    const copyIdx = gate.indexOf('getFieldSafetyCopy({');
    if (def && earlyIdx > 0 && copyIdx > earlyIdx) {
      io.pass('the gate stands aside on ordinary turns', 'fieldWorkRequested defaults false and the out-of-scope return precedes any boundary message');
    } else {
      io.fail('the gate can replace an ordinary reply', `default=${def} earlyIdx=${earlyIdx} copyIdx=${copyIdx}`);
    }

    // ── B2: no caller requests field work (a deliberate act needing its own ruling) ──
    const requesters = io
      .grep('fieldWorkRequested:\\s*true', ['lib', 'app'])
      .filter(h => !/__tests__/.test(h))
      .filter(h => !/^\s*(\/\/|\*|\/\*)/.test(h.split(':').slice(2).join(':')));
    if (requesters.length === 0) {
      io.pass('no surface requests field work', 'the gate therefore substitutes no reply anywhere in source');
    } else {
      io.warn('a surface now requests field work', `${requesters.length} site(s) — confirm a founder ruling covers it: ${requesters[0].slice(0, 120)}`);
    }

    // ── B3: routes report the router's verdict, not the gate's pass ──
    const stale = ROUTES.filter(r => /fieldWorkSafe:\s*fieldSafety\?\.allowed/.test(io.read(r)));
    if (stale.length === 0) {
      io.pass('downstream fieldWorkSafe is the router verdict', 'an out-of-scope pass is never reported as "safe"');
    } else {
      io.fail('a route reports the gate pass as fieldWorkSafe', stale.join(', '));
    }
  },
};
