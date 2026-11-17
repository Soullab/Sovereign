#!/usr/bin/env node
/**
 * JARVIS RUN — the governed invocation path for the O-series operator chain.
 *
 * WHY THIS EXISTS
 *   O0–O5 built intent compilation, work-graph decomposition, authority planning,
 *   capability routing and an execution plane, each with its own falsifier suite
 *   and freeze. Nothing could call them. Every npm target was `matrix:`, `verify:`
 *   or `test:`; there was no entry point a human or an agent could invoke. The
 *   apparatus was reachable only from its own tests.
 *
 *   This module is that entry point and nothing more. It composes canonical
 *   modules. It introduces no routing law, no authority, no vocabulary.
 *
 * WHAT IT IS NOT
 *   - It does NOT grant authority. O0 remains the authority boundary.
 *   - It does NOT execute providers, models, or ROUTED_LOCAL work. The only lane
 *     it will execute is O4's DETERMINISTIC outcome, whose capabilities are
 *     read-only repository inspections that need no grant.
 *   - It does NOT treat an O4 capability plan as execution authority. O4 sets
 *     `execution_authorized: false` on every plan it emits; a plan that claims
 *     otherwise is not the O4 contract and is REFUSED rather than honoured.
 *   - It does NOT merge, deploy, write to the repository, or touch production.
 *   - It does NOT decide capacity. A ROUTED_LOCAL unit is refused here on
 *     outcome alone, before E1LC is ever consulted.
 *
 * THE UPSTREAM CONTRACT, recorded because each clause cost a failed run and is
 * documented nowhere else:
 *   1. O1.compileIntent takes `{ utterance }`, NOT a bare string. A string
 *      yields `raw_utterance: ""` and `standing: INVALID` — it fails quietly.
 *   2. An intent level is a LEADING VERB, not a label. "Inspect the repo" is
 *      CLEAR; "UNDERSTAND: inspect the repo" is AMBIGUOUS.
 *   3. O3.planAuthority accepts ONLY canonical serialized JSON text. A live
 *      object is refused `SERIALIZED_AUTHORITY_REQUEST_REQUIRED`, so a plan
 *      cannot depend on object identity or hidden state.
 *   4. O3's authority input key is `heldAuthorities` (camelCase), while the
 *      envelope around it is snake_case.
 *   And O4's `evidence_class` / `task_shape` take J6 vocabularies
 *   (E1_REPOSITORY_LOCAL / CODE_GROUNDED), which are easy to transpose.
 *
 * EXITS  0 ok · 1 refused · 2 upstream stop · 4 usage
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_DEFAULT = path.resolve(HERE, '..', '..');

export const VERSION = 'jarvis-run.v1';

/** Every reason this entry point can refuse to execute. Closed set. */
export const REFUSAL = Object.freeze({
  NO_PLAN: 'NO_PLAN',
  NOT_DETERMINISTIC: 'NOT_DETERMINISTIC',
  PLAN_CLAIMS_AUTHORITY: 'PLAN_CLAIMS_AUTHORITY',
  PLAN_CLAIMS_EXECUTION: 'PLAN_CLAIMS_EXECUTION',
  EXECUTION_NOT_REQUESTED: 'EXECUTION_NOT_REQUESTED',
  CAPABILITY_UNKNOWN: 'CAPABILITY_UNKNOWN',
  SCHEMA_REFUSED: 'SCHEMA_REFUSED',
});

export const DECISION = Object.freeze({ EXECUTE: 'EXECUTE', REFUSED: 'REFUSED' });

/**
 * THE DECISION SEAM.
 *
 * Pure. No I/O. This is the single place that decides whether an O4 capability
 * plan may be executed by this entry point, and it is deliberately a decision
 * rather than a configurable policy: there is no branch here for any weaker
 * rule, and the CLI cannot pass one.
 *
 * `execution_authorized` must be exactly false. That reads backwards until you
 * see why: O4 confers no execution authority on anything, so `false` is the
 * conforming value. A plan presenting `true` did not come from the O4 contract,
 * and is refused rather than obeyed.
 */
export function decideExecution(capabilityPlan, { executeRequested } = {}) {
  const refuse = (reason) => Object.freeze({ decision: DECISION.REFUSED, reason });

  if (!capabilityPlan || typeof capabilityPlan !== 'object') return refuse(REFUSAL.NO_PLAN);
  if (capabilityPlan.outcome !== 'DETERMINISTIC') return refuse(REFUSAL.NOT_DETERMINISTIC);

  const granted = capabilityPlan.granted_authorities;
  if (!Array.isArray(granted) || granted.length !== 0) return refuse(REFUSAL.PLAN_CLAIMS_AUTHORITY);

  if (capabilityPlan.execution_authorized !== false) return refuse(REFUSAL.PLAN_CLAIMS_EXECUTION);

  if (executeRequested !== true) return refuse(REFUSAL.EXECUTION_NOT_REQUESTED);

  return Object.freeze({ decision: DECISION.EXECUTE, reason: null });
}

/**
 * Gate one deterministic capability invocation. Pure except for the schema
 * check it delegates to the canonical host. Never runs anything itself.
 */
export function admitCapability(DET, name, args) {
  if (!Object.prototype.hasOwnProperty.call(DET.CAPABILITIES, name)) {
    return Object.freeze({ admitted: false, reason: REFUSAL.CAPABILITY_UNKNOWN });
  }
  const schema = DET.validateSchema(name, args);
  if (schema && schema.ok === false) {
    return Object.freeze({ admitted: false, reason: REFUSAL.SCHEMA_REFUSED, schema });
  }
  return Object.freeze({ admitted: true, reason: null });
}

/** Load the canonical chain from a repository root. */
export async function loadChain(repo) {
  const require = createRequire(path.join(repo, 'package.json'));
  return {
    O1: require(path.join(repo, 'jarvis-desktop/src/operator-intent-contract.js')),
    O2: require(path.join(repo, 'jarvis-desktop/src/operator-work-graph.js')),
    O3: require(path.join(repo, 'jarvis-desktop/src/operator-authority-planner.js')),
    O4: await import(path.join(repo, 'jarvis-desktop/src/operator-capability-router.mjs')),
    DET: await import(path.join(repo, 'scripts/builder/deterministic.mjs')),
  };
}

/**
 * Plan a run. Read-only: compiles intent, decomposes, plans authority, routes
 * capability. Executes nothing — execution is a separate, opt-in step.
 */
export async function planRun({ repo, utterance, heldAuthorities, capability, chain }) {
  const { O1, O2, O3, O4 } = chain || (await loadChain(repo));

  const intent = O1.compileIntent({ utterance });                       // contract fact 1
  if (intent.standing !== 'CLEAR') {
    return { ok: false, stage: 'O1', intent, stop: `intent standing ${intent.standing}` };
  }

  const graphOut = O2.compileWorkGraph(intent);
  if (!graphOut.ok) return { ok: false, stage: 'O2', intent, graphOut, stop: 'work graph refused' };

  const authOut = O3.planAuthority(JSON.stringify({                     // contract fact 3
    version: O3.REQUEST_VERSION,
    graph: graphOut.graph,
    authority_input: { heldAuthorities },                               // contract fact 4
  }));
  if (!authOut.ok) return { ok: false, stage: 'O3', intent, graphOut, authOut, stop: 'authority refused' };

  const routed = [];
  for (const entry of authOut.authority_plan.entries) {
    const res = O4.planCapability({
      version: O4.REQUEST_VERSION,
      o3_entry: entry,
      routing_request: {
        capability: capability ?? null,
        evidence_class: 'E1_REPOSITORY_LOCAL',
        task_shape: 'CODE_GROUNDED',
        requested_external_family: null,
        requested_transport: null,
        permission_envelope: {
          external_network: false,
          external_repo_disclosure: false,
          provider_spend: false,
        },
        provider_availability: {},
      },
    });
    routed.push({ entry, result: res });
  }

  return { ok: true, stage: 'O4', intent, graphOut, authOut, routed };
}

export default { VERSION, REFUSAL, DECISION, decideExecution, admitCapability, loadChain, planRun };

// ── CLI ───────────────────────────────────────────────────────────────────────
// Guarded so importing this module for the constitutional suite runs nothing.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const argv = process.argv.slice(2);
  const flag = (name) => (argv.find((a) => a.startsWith(`--${name}=`)) || '').slice(name.length + 3);
  const utterance = argv.find((a) => !a.startsWith('--'));
  const repo = flag('repo') || process.env.JARVIS_RUN_REPO || REPO_DEFAULT;
  const capability = flag('capability') || null;
  const held = (flag('held') || 'repo.read').split(',').map((s) => s.trim()).filter(Boolean);
  const execute = argv.includes('--execute');

  if (!utterance) {
    console.error('usage: jarvis-run.mjs "<intent>" [--held=a,b] [--capability=<name>] [--repo=<path>] [--execute]');
    console.error('  intent must LEAD with a level verb: inspect | investigate | review | check | plan | fix | ship');
    process.exit(4);
  }

  const out = (s = '') => console.log(s);
  const hdr = (s) => { out(); out(`── ${s} ${'─'.repeat(Math.max(0, 62 - s.length))}`); };

  const chain = await loadChain(repo);
  out(`JARVIS RUN  ${VERSION}`);
  out(`repo        ${repo}`);
  out(`intent      ${JSON.stringify(utterance)}`);
  out(`held        [${held.join(', ')}]`);
  out(`capability  ${capability ?? '(unconstrained — O4 will choose the lane)'}`);
  out(`execute     ${execute ? 'requested (DETERMINISTIC lane only)' : 'no — plan only'}`);

  const run = await planRun({ repo, utterance, heldAuthorities: held, capability, chain });

  if (!run.ok) {
    hdr(`STOP at ${run.stage}`);
    out(run.stop);
    const b = run.authOut?.blockers || run.graphOut?.blockers || run.intent?.ambiguities;
    if (b?.length) out(JSON.stringify(b, null, 2));
    process.exit(2);
  }

  hdr('O1 → O2 → O3');
  out(`intent standing   ${run.intent.standing}`);
  out(`work units        ${run.graphOut.graph.work_units.length}`);
  for (const u of run.graphOut.graph.work_units) out(`  · ${u.kind}`);
  out(`authority entries ${run.authOut.authority_plan.entries.length}`);
  for (const e of run.authOut.authority_plan.entries) {
    out(`  · ${String(e.kind).padEnd(18)} ${e.decision}  operator_required=${e.operator_required}`);
    if (e.missing_authorities?.length) out(`      MISSING: ${e.missing_authorities.join(', ')}`);
  }

  hdr('O4 CAPABILITY PLAN');
  const decisions = [];
  for (const { entry, result } of run.routed) {
    const p = result.capability_plan;
    const d = decideExecution(p, { executeRequested: execute });
    decisions.push({ entry, plan: p, d });
    out(`  · ${String(entry.kind).padEnd(18)} outcome=${p?.outcome ?? '(none)'}  →  ${d.decision}${d.reason ? ` (${d.reason})` : ''}`);
    out(`      granted_authorities=${JSON.stringify(p?.granted_authorities ?? null)} execution_authorized=${p?.execution_authorized} consequence_effect=${p?.consequence_effect}`);
    if (result.blockers?.length) out(`      blockers: ${result.blockers.join(', ')}`);
  }

  const admitted = decisions.filter((x) => x.d.decision === DECISION.EXECUTE);
  hdr('O5 DETERMINISTIC EXECUTION');
  out(`units admitted for execution: ${admitted.length} of ${decisions.length}`);
  if (!admitted.length) {
    out();
    out(execute
      ? 'nothing admitted — see the refusal reason above. This entry point executes the DETERMINISTIC lane only.'
      : 'plan-only run; pass --execute to run the deterministic lane.');
    process.exit(admitted.length === 0 && execute ? 1 : 0);
  }

  const probes = capability
    ? [[capability, {}]]
    : [['git.rev_parse', { ref: 'HEAD' }]];
  let refused = 0;
  for (const [name, args] of probes) {
    const gate = admitCapability(chain.DET, name, args);
    out();
    out(`  capability  ${name}`);
    if (!gate.admitted) { refused += 1; out(`  REFUSED     ${gate.reason}`); continue; }
    out(`  described   ${JSON.stringify(chain.DET.describeInvocation(name, args))}`);
    try {
      const res = chain.DET.runCapability(name, args, repo);
      const text = typeof res === 'string' ? res : JSON.stringify(res);
      out(`  result      ${text.length > 500 ? `${text.slice(0, 500)} …[truncated]` : text}`);
    } catch (err) {
      refused += 1;
      out(`  THREW       ${err.message}`);
    }
  }
  out();
  out('run complete — DETERMINISTIC lane only. No provider, no model, no capacity gate, no authority granted.');
  process.exit(refused ? 1 : 0);
}
