#!/usr/bin/env node
/**
 * JARVIS LAB — APPARATUS PROOF.
 *
 * WHAT THIS PROVES AND WHAT IT DOES NOT
 *   Proves: the conversational loop runs a capability the model asks for,
 *   feeds the REAL result back, recovers from a bad pattern, refuses anything
 *   off the allowlist, reports malformed calls visibly, and remembers across
 *   processes.
 *
 *   Does NOT prove: that the local model is a good investigator. The model is
 *   scripted here. Model competence can only be observed by talking to it, and
 *   that runs on the machine with Ollama — never in CI, never from a container
 *   with no model. Conflating the two would be exactly the error this project
 *   keeps finding: an apparatus that reports success without having tested the
 *   thing in question.
 *
 *   Run:  node tests/constitutional/jarvis-lab/apparatus.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { converse, runTool, parseToolCall, toolLines, LAB_TOOLS, REPO_DEFAULT } from '../../../scripts/builder/jarvis-lab.mjs';

// Memory writes must not touch the real lab notebook.
const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-lab-proof-'));
process.env.AIN_DELEGATION_HOME = SANDBOX;

let pass = 0; const failures = [];
/**
 * Awaits `fn` — deliberately. A synchronous version silently passed an async
 * assertion whose promise was never awaited: the check reported ✓ before its
 * body had run, and would have reported ✓ had the body thrown. Same defect
 * class as the hanging O5 fixture and the gate blind to its own sensor: a
 * mechanism whose negative result is silence.
 */
async function check(name, fn) {
  try { await fn(); pass++; console.log(`  ✓ ${name}`); }
  catch (e) { failures.push(`${name}\n      ${e.message}`); console.log(`  ✗ ${name}\n      ${e.message}`); }
}
const eq = (a, b, m) => { if (!Object.is(a, b)) throw new Error(m || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected truthy'); };

/** A model that replays a fixed script of replies, and records what it saw. */
function scriptedModel(replies) {
  const prompts = [];
  let i = 0;
  const call = async ({ prompt }) => {
    prompts.push(prompt);
    const r = replies[Math.min(i, replies.length - 1)];
    i += 1;
    return { ok: true, output: typeof r === 'function' ? r(prompt) : r };
  };
  call.prompts = prompts;
  return call;
}

console.log('\nJARVIS LAB — APPARATUS PROOF\n');

// ── the tool protocol ────────────────────────────────────────────────────────
console.log('tool protocol');

await check('a well-formed call is parsed', () => {
  const c = parseToolCall('TOOL repo.grep {"pattern":"decideEcho"}');
  eq(c.name, 'repo.grep');
  eq(c.args.pattern, 'decideEcho');
});

await check('prose is not mistaken for a call', () => {
  eq(parseToolCall('I think the guard is in echoGuard.ts, around line 89.'), null);
});

await check('malformed arguments surface as a readable error, never silence', () => {
  const c = parseToolCall('TOOL repo.grep {pattern: decideEcho}');
  ok(c && c.parseError, 'a broken call must be reported, not dropped');
});

await check('the capability list is generated from the contract, with real arg names', () => {
  const lines = toolLines();
  ok(lines.includes('repo.grep {pattern:string, max_results?:number 1..200}'),
    `arg signature not derived from the contract:\n${lines}`);
});

// ── the sandbox boundary ─────────────────────────────────────────────────────
console.log('\nboundary');

await check('an unlisted capability is refused', () => {
  const r = runTool(REPO_DEFAULT, 'verify.sha256', { path: 'package.json' });
  eq(r.ok, false);
  ok(r.error.includes('not available'), r.error);
});

await check('an invented capability is refused', () => {
  const r = runTool(REPO_DEFAULT, 'shell.exec', { cmd: 'rm -rf /' });
  eq(r.ok, false);
});

await check('no write, exec, deploy or network capability is reachable', () => {
  const forbidden = LAB_TOOLS.filter((n) => /write|exec|deploy|push|commit|merge|fetch|curl|delete|remove/i.test(n));
  eq(forbidden.length, 0, `reachable: ${forbidden.join(', ')}`);
});

await check('a schema violation becomes a message the model can correct from', () => {
  const r = runTool(REPO_DEFAULT, 'repo.grep', { patern: 'typo' });
  eq(r.ok, false);
  ok(/argument/i.test(r.error), r.error);
});

// ── real evidence, from the real repository ──────────────────────────────────
console.log('\nevidence path');

await check('a literal search returns real file:line from this repository', () => {
  const r = runTool(REPO_DEFAULT, 'repo.grep', { pattern: 'decideEcho' });
  eq(r.ok, true, r.error);
  ok(r.output.includes('lib/voice/echoGuard.ts'), `got:\n${r.output.slice(0, 400)}`);
});

await check('an empty result reads as "no matches", not as a broken tool', () => {
  // BRE-hostile on purpose: the \d+ means a literal d, so this cannot match.
  const r = runTool(REPO_DEFAULT, 'repo.grep', { pattern: 'zzz_no_such_token_\\d+' });
  eq(r.ok, true);
  eq(r.output, '(no matches)');
});

await check('git history is reachable, so a repaired defect is still discoverable', () => {
  const r = runTool(REPO_DEFAULT, 'git.file_history', { file: 'components/voice/ContinuousConversation.tsx' });
  eq(r.ok, true, r.error);
  ok(r.output.length > 0 && r.output !== '(no matches)', 'expected commit history');
});

// ── the loop ─────────────────────────────────────────────────────────────────
console.log('\nconversation loop');

await (async () => {
  const model = scriptedModel([
    'TOOL repo.grep {"pattern":"decideEcho"}',
    (prompt) => {
      // The loop must have fed the REAL tool output back into the next prompt.
      if (!prompt.includes('lib/voice/echoGuard.ts')) return 'I never saw the result.';
      return 'The echo decision lives in lib/voice/echoGuard.ts and is called from ContinuousConversation.tsx:2430.';
    },
  ]);
  const res = await converse({ repo: REPO_DEFAULT, message: 'where does the echo decision happen?', callModel: model });

  await check('a tool result is fed back into the next model turn', () => {
    eq(res.ok, true);
    ok(res.reply.includes('echoGuard.ts'), res.reply);
  });
  await check('the loop stops as soon as JARVIS answers instead of searching', () => {
    eq(res.steps.filter((s) => s.kind === 'tool').length, 1);
    eq(res.steps[res.steps.length - 1].kind, 'reply');
  });
  await check('the model is told the capabilities and the protocol', () => {
    ok(model.prompts[0].includes('TOOL <capability> <json-args>'), 'protocol missing from prompt');
    ok(model.prompts[0].includes('repo.grep {pattern:string'), 'capability list missing from prompt');
  });
})();

await (async () => {
  const model = scriptedModel([
    'TOOL repo.grep {"pattern":"[0-9]\\\\+_no_such"}',   // comes back empty
    'TOOL repo.grep {"pattern":"ECHO_TAIL_WINDOW_MS"}',  // literal retry
    'It is defined in lib/voice/echoGuard.ts.',
  ]);
  const res = await converse({ repo: REPO_DEFAULT, message: 'how long is the echo window?', callModel: model });
  await check('an empty search does not end the investigation — it retries and lands', () => {
    eq(res.ok, true);
    eq(res.steps.filter((s) => s.kind === 'tool').length, 2);
    ok(res.reply.includes('echoGuard.ts'), res.reply);
  });
})();

await (async () => {
  const model = scriptedModel(['TOOL repo.grep {"pattern":"decideEcho"}']); // never stops
  const res = await converse({ repo: REPO_DEFAULT, message: 'loop forever', callModel: model, maxSteps: 3 });
  await check('a model that never stops searching is bounded, and says so honestly', () => {
    eq(res.ok, true);
    eq(res.exhausted, true);
    eq(res.steps.filter((s) => s.kind === 'tool').length, 3);
  });
})();

await (async () => {
  const model = async () => ({ ok: false, error: 'connect ECONNREFUSED 127.0.0.1:11434', failure_class: 'TRANSPORT_UNREACHABLE' });
  const res = await converse({ repo: REPO_DEFAULT, message: 'hello', callModel: model });
  await check('an unreachable model is reported, not dressed up as an answer', () => {
    eq(res.ok, false);
    eq(res.failure_class, 'TRANSPORT_UNREACHABLE');
  });
})();

// ── memory ───────────────────────────────────────────────────────────────────
console.log('\nmemory');

await (async () => {
  const { appendHistory, loadHistory, memoryDigest } = await import('../../../scripts/builder/jarvis-lab.mjs');
  appendHistory({ role: 'kelly', text: 'the voice thing is still happening' });
  appendHistory({ role: 'jarvis', text: 'Found it.', finding: 'the echo guard blocked member speech on a static phrase list' });

  await check('a turn survives being written and read back', () => {
    const h = loadHistory();
    ok(h.length >= 2, `got ${h.length}`);
    eq(h[h.length - 1].finding, 'the echo guard blocked member speech on a static phrase list');
  });

  await check('every remembered turn is timestamped', () => {
    ok(loadHistory().every((t) => typeof t.at === 'string' && t.at.includes('T')));
  });

  await check('older turns carry forward as findings, not as a transcript dump', () => {
    const history = [
      ...Array.from({ length: 12 }, (_, i) => ({ role: 'kelly', text: `old turn ${i}` })),
      { role: 'jarvis', text: 'long explanation', finding: 'the guard used a static phrase list' },
      ...Array.from({ length: 8 }, (_, i) => ({ role: 'kelly', text: `recent ${i}` })),
    ];
    const d = memoryDigest(history);
    ok(d.includes('static phrase list'), `finding not carried:\n${d}`);
    ok(!d.includes('long explanation'), 'carried the whole turn instead of the finding');
  });

  await check('a conversation is carried into the prompt', async () => {
    const model = scriptedModel(['yes, the one from Tuesday.']);
    await converse({
      repo: REPO_DEFAULT, message: 'same thing as before?', callModel: model,
      history: [{ role: 'kelly', text: 'the voice keeps cutting me off' }, { role: 'jarvis', text: 'I saw that.' }],
    });
    ok(model.prompts[0].includes('the voice keeps cutting me off'), 'prior turn missing from prompt');
  });

  await check('a notebook that cannot be written does not break the turn', () => {
    // Unwritable by having a REGULAR FILE where a directory must be, so the
    // failure is an immediate ENOTDIR. An earlier version used a path under
    // /proc, where mkdirSync hangs rather than failing — a test that blocks
    // forever instead of asserting.
    const blocker = path.join(SANDBOX, 'blocker');
    fs.writeFileSync(blocker, 'not a directory');
    const prev = process.env.AIN_DELEGATION_HOME;
    process.env.AIN_DELEGATION_HOME = path.join(blocker, 'nested');
    try { appendHistory({ role: 'kelly', text: 'should not throw' }); }
    finally { process.env.AIN_DELEGATION_HOME = prev; }
  });
})();

fs.rmSync(SANDBOX, { recursive: true, force: true });

console.log(`\npassed ${pass}   failed ${failures.length}`);
if (failures.length) { console.log('\nFAILURES:'); for (const f of failures) console.log('  ✗ ' + f); }
process.exit(failures.length ? 1 : 0);
