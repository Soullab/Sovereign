/**
 * JARVIS-RUN — constitutional falsifiers.
 *
 * These laws govern the ONE thing the entry point decides: whether an O4
 * capability plan may be executed here. They are written against the decision
 * seam, not the CLI, so a candidate must change a decision to defeat one.
 *
 * Each law takes an implementation `{ decideExecution, admitCapability, REFUSAL,
 * DECISION }` and throws on violation. A law that passes against every candidate
 * is not lethal and is a defect in THIS FILE, never licence for the candidate.
 */
import assert from 'node:assert/strict';

/** A conforming O4 DETERMINISTIC plan, as the real router emits one. */
export const CONFORMING_PLAN = Object.freeze({
  outcome: 'DETERMINISTIC',
  granted_authorities: Object.freeze([]),
  execution_authorized: false,
  consequence_effect: 'NONE',
});

const plan = (over = {}) => ({ ...CONFORMING_PLAN, ...over });

export const LAWS = Object.freeze({
  /** L1 — the conforming case must actually execute, or every other law is vacuous. */
  'L1-conforming-deterministic-executes': (I) => {
    const d = I.decideExecution(plan(), { executeRequested: true });
    assert.equal(d.decision, I.DECISION.EXECUTE, 'a conforming DETERMINISTIC plan must execute');
    assert.equal(d.reason, null);
  },

  /** L2 — only DETERMINISTIC executes. ROUTED_LOCAL is the model lane; it is refused
   *  on outcome alone, upstream of any capacity question. */
  'L2-only-deterministic-executes': (I) => {
    for (const outcome of ['ROUTED_LOCAL', 'EXTERNAL_REVIEW_READY', 'HELD_FOR_AUTHORITY', 'HOLD']) {
      const d = I.decideExecution(plan({ outcome }), { executeRequested: true });
      assert.equal(d.decision, I.DECISION.REFUSED, `${outcome} must not execute`);
      assert.equal(d.reason, I.REFUSAL.NOT_DETERMINISTIC, `${outcome} must refuse on outcome`);
    }
  },

  /** L3 — a plan claiming granted authority is not the O4 contract and is refused,
   *  never honoured. This is the field through which authority would arrive. */
  'L3-plan-claiming-authority-refused': (I) => {
    for (const granted of [['repo.read'], ['merge'], ['deploy'], 'repo.read', null, undefined]) {
      const d = I.decideExecution(plan({ granted_authorities: granted }), { executeRequested: true });
      assert.equal(d.decision, I.DECISION.REFUSED, `granted_authorities=${JSON.stringify(granted)} must refuse`);
      assert.equal(d.reason, I.REFUSAL.PLAN_CLAIMS_AUTHORITY);
    }
  },

  /** L4 — `execution_authorized` must be exactly false. O4 authorizes nothing, so
   *  false is the conforming value; true means the plan is a forgery. */
  'L4-plan-claiming-execution-refused': (I) => {
    for (const claim of [true, 'false', 1, null, undefined]) {
      const d = I.decideExecution(plan({ execution_authorized: claim }), { executeRequested: true });
      assert.equal(d.decision, I.DECISION.REFUSED, `execution_authorized=${JSON.stringify(claim)} must refuse`);
      assert.equal(d.reason, I.REFUSAL.PLAN_CLAIMS_EXECUTION);
    }
  },

  /** L5 — execution is opt-in. Absent an explicit request, nothing runs. */
  'L5-execution-is-opt-in': (I) => {
    for (const req of [false, undefined, null, 'true', 1]) {
      const d = I.decideExecution(plan(), { executeRequested: req });
      assert.equal(d.decision, I.DECISION.REFUSED, `executeRequested=${JSON.stringify(req)} must refuse`);
      assert.equal(d.reason, I.REFUSAL.EXECUTION_NOT_REQUESTED);
    }
  },

  /** L6 — a non-plan is refused rather than coerced. */
  'L6-absent-plan-refused': (I) => {
    for (const p of [null, undefined, 'DETERMINISTIC', 0, []]) {
      const d = I.decideExecution(p, { executeRequested: true });
      assert.equal(d.decision, I.DECISION.REFUSED, `plan=${JSON.stringify(p)} must refuse`);
    }
  },

  /** L7 — only capabilities the canonical host declares may be admitted. The
   *  entry point can never reach an arbitrary command. */
  'L7-unknown-capability-refused': (I) => {
    const DET = {
      CAPABILITIES: { 'git.rev_parse': {} },
      validateSchema: () => ({ ok: true }),
    };
    const ok = I.admitCapability(DET, 'git.rev_parse', {});
    assert.equal(ok.admitted, true, 'a declared capability must be admitted');
    for (const name of ['sh', 'rm -rf /', 'git.push', '__proto__', 'constructor', 'toString']) {
      const bad = I.admitCapability(DET, name, {});
      assert.equal(bad.admitted, false, `${name} must not be admitted`);
      assert.equal(bad.reason, I.REFUSAL.CAPABILITY_UNKNOWN);
    }
  },

  /** L8 — the host's own schema refusal is honoured, not bypassed. */
  'L8-schema-refusal-honoured': (I) => {
    const DET = {
      CAPABILITIES: { 'git.rev_parse': {} },
      validateSchema: () => ({ ok: false, detail: 'bad ref' }),
    };
    const d = I.admitCapability(DET, 'git.rev_parse', { ref: '../../etc' });
    assert.equal(d.admitted, false, 'a schema refusal must not be admitted');
    assert.equal(d.reason, I.REFUSAL.SCHEMA_REFUSED);
  },
});

export const LAW_IDS = Object.freeze(Object.keys(LAWS));
