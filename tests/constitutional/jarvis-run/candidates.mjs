/**
 * JARVIS-RUN — defeat candidates.
 *
 * Eight deliberately WRONG entry points. Each is the smallest competent
 * embodiment of one constitutional error, varying ONE decision clause on an
 * otherwise identical substrate. A combined mutant would mask clause-level
 * defects — the G2 defect class this project has already repaired once.
 *
 * Each names the falsifier it must die on. Collateral kills are declared, with
 * a reason why narrowing further would stop the candidate embodying its error.
 */
import { REFUSAL, DECISION, admitCapability } from '../../../scripts/builder/jarvis-run.mjs';

const frozen = (o) => Object.freeze(o);
const base = { REFUSAL, DECISION, admitCapability };

/** The reference: the shipped decision, re-expressed. All laws must pass. */
function conforming(capabilityPlan, { executeRequested } = {}) {
  const refuse = (reason) => frozen({ decision: DECISION.REFUSED, reason });
  if (!capabilityPlan || typeof capabilityPlan !== 'object') return refuse(REFUSAL.NO_PLAN);
  if (capabilityPlan.outcome !== 'DETERMINISTIC') return refuse(REFUSAL.NOT_DETERMINISTIC);
  const g = capabilityPlan.granted_authorities;
  if (!Array.isArray(g) || g.length !== 0) return refuse(REFUSAL.PLAN_CLAIMS_AUTHORITY);
  if (capabilityPlan.execution_authorized !== false) return refuse(REFUSAL.PLAN_CLAIMS_EXECUTION);
  if (executeRequested !== true) return refuse(REFUSAL.EXECUTION_NOT_REQUESTED);
  return frozen({ decision: DECISION.EXECUTE, reason: null });
}

export const REFERENCE = frozen({ ...base, decideExecution: conforming });

export const CANDIDATES = frozen([
  {
    id: 'D1-routed-local-executes',
    error: 'treats the local model lane as executable here',
    dies_on: 'L2-only-deterministic-executes',
    collateral: [],
    impl: frozen({
      ...base,
      decideExecution(p, o = {}) {
        if (p && typeof p === 'object' && p.outcome === 'ROUTED_LOCAL') {
          return frozen({ decision: DECISION.EXECUTE, reason: null });
        }
        return conforming(p, o);
      },
    }),
  },
  {
    id: 'D2-any-outcome-executes',
    error: 'never checks the outcome at all',
    dies_on: 'L2-only-deterministic-executes',
    collateral: [],
    impl: frozen({
      ...base,
      decideExecution(p, o = {}) {
        const refuse = (r) => frozen({ decision: DECISION.REFUSED, reason: r });
        if (!p || typeof p !== 'object') return refuse(REFUSAL.NO_PLAN);
        const g = p.granted_authorities;
        if (!Array.isArray(g) || g.length !== 0) return refuse(REFUSAL.PLAN_CLAIMS_AUTHORITY);
        if (p.execution_authorized !== false) return refuse(REFUSAL.PLAN_CLAIMS_EXECUTION);
        if (o.executeRequested !== true) return refuse(REFUSAL.EXECUTION_NOT_REQUESTED);
        return frozen({ decision: DECISION.EXECUTE, reason: null });
      },
    }),
  },
  {
    id: 'D3-honours-claimed-authority',
    error: 'accepts a plan that carries granted authorities',
    dies_on: 'L3-plan-claiming-authority-refused',
    collateral: [],
    impl: frozen({
      ...base,
      decideExecution(p, o = {}) {
        const refuse = (r) => frozen({ decision: DECISION.REFUSED, reason: r });
        if (!p || typeof p !== 'object') return refuse(REFUSAL.NO_PLAN);
        if (p.outcome !== 'DETERMINISTIC') return refuse(REFUSAL.NOT_DETERMINISTIC);
        if (p.execution_authorized !== false) return refuse(REFUSAL.PLAN_CLAIMS_EXECUTION);
        if (o.executeRequested !== true) return refuse(REFUSAL.EXECUTION_NOT_REQUESTED);
        return frozen({ decision: DECISION.EXECUTE, reason: null });
      },
    }),
  },
  {
    id: 'D4-truthy-authority-check',
    error: 'checks granted_authorities for truthiness, so [] and a non-array both pass',
    dies_on: 'L3-plan-claiming-authority-refused',
    collateral: [],
    impl: frozen({
      ...base,
      decideExecution(p, o = {}) {
        const refuse = (r) => frozen({ decision: DECISION.REFUSED, reason: r });
        if (!p || typeof p !== 'object') return refuse(REFUSAL.NO_PLAN);
        if (p.outcome !== 'DETERMINISTIC') return refuse(REFUSAL.NOT_DETERMINISTIC);
        if (p.granted_authorities && p.granted_authorities.length > 0) {
          return refuse(REFUSAL.PLAN_CLAIMS_AUTHORITY);
        }
        if (p.execution_authorized !== false) return refuse(REFUSAL.PLAN_CLAIMS_EXECUTION);
        if (o.executeRequested !== true) return refuse(REFUSAL.EXECUTION_NOT_REQUESTED);
        return frozen({ decision: DECISION.EXECUTE, reason: null });
      },
    }),
  },
  {
    id: 'D5-obeys-claimed-execution',
    error: 'reads execution_authorized as permission rather than as a contract check',
    dies_on: 'L4-plan-claiming-execution-refused',
    collateral: [],
    impl: frozen({
      ...base,
      decideExecution(p, o = {}) {
        const refuse = (r) => frozen({ decision: DECISION.REFUSED, reason: r });
        if (!p || typeof p !== 'object') return refuse(REFUSAL.NO_PLAN);
        if (p.outcome !== 'DETERMINISTIC') return refuse(REFUSAL.NOT_DETERMINISTIC);
        const g = p.granted_authorities;
        if (!Array.isArray(g) || g.length !== 0) return refuse(REFUSAL.PLAN_CLAIMS_AUTHORITY);
        if (p.execution_authorized === true) return frozen({ decision: DECISION.EXECUTE, reason: null });
        if (o.executeRequested !== true) return refuse(REFUSAL.EXECUTION_NOT_REQUESTED);
        return frozen({ decision: DECISION.EXECUTE, reason: null });
      },
    }),
  },
  {
    id: 'D6-execute-by-default',
    error: 'makes execution the default instead of opt-in',
    dies_on: 'L5-execution-is-opt-in',
    collateral: [],
    impl: frozen({
      ...base,
      decideExecution(p, o = {}) {
        const refuse = (r) => frozen({ decision: DECISION.REFUSED, reason: r });
        if (!p || typeof p !== 'object') return refuse(REFUSAL.NO_PLAN);
        if (p.outcome !== 'DETERMINISTIC') return refuse(REFUSAL.NOT_DETERMINISTIC);
        const g = p.granted_authorities;
        if (!Array.isArray(g) || g.length !== 0) return refuse(REFUSAL.PLAN_CLAIMS_AUTHORITY);
        if (p.execution_authorized !== false) return refuse(REFUSAL.PLAN_CLAIMS_EXECUTION);
        if (o.executeRequested === false) return refuse(REFUSAL.EXECUTION_NOT_REQUESTED);
        return frozen({ decision: DECISION.EXECUTE, reason: null });
      },
    }),
  },
  {
    id: 'D7-capability-by-prototype-lookup',
    error: 'uses `in` / property access, so inherited names pass as capabilities',
    dies_on: 'L7-unknown-capability-refused',
    collateral: [],
    impl: frozen({
      ...base,
      decideExecution: conforming,
      admitCapability(DET, name, args) {
        if (!(name in DET.CAPABILITIES)) {
          return frozen({ admitted: false, reason: REFUSAL.CAPABILITY_UNKNOWN });
        }
        const schema = DET.validateSchema(name, args);
        if (schema && schema.ok === false) {
          return frozen({ admitted: false, reason: REFUSAL.SCHEMA_REFUSED, schema });
        }
        return frozen({ admitted: true, reason: null });
      },
    }),
  },
  {
    id: 'D8-skips-schema-validation',
    error: 'admits a declared capability without honouring the host schema refusal',
    dies_on: 'L8-schema-refusal-honoured',
    collateral: [],
    impl: frozen({
      ...base,
      decideExecution: conforming,
      admitCapability(DET, name) {
        if (!Object.prototype.hasOwnProperty.call(DET.CAPABILITIES, name)) {
          return frozen({ admitted: false, reason: REFUSAL.CAPABILITY_UNKNOWN });
        }
        return frozen({ admitted: true, reason: null });
      },
    }),
  },
]);
