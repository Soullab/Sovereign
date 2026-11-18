#!/usr/bin/env node
/**
 * JARVIS LAB — the conversational layer.
 *
 * Not a dashboard, not a work-unit console. A colleague you talk to.
 *
 * WHAT THIS IS AND IS NOT
 *   The bounded coding worker stays toolless and governed — this does not touch
 *   it. This layer coordinates the tools, evidence and memory AROUND it, which
 *   is the distinction the founder drew on 2026-11-18.
 *
 *   Tools here are the canonical deterministic capabilities: read-only
 *   repository inspection, already governed, `granted_authorities: []`. JARVIS
 *   never gets a shell. It names a capability; this layer validates and runs it
 *   and hands back the result. Nothing here can write, merge, deploy, spend, or
 *   reach the network beyond the loopback model host.
 *
 * WHY A TEXT PROTOCOL AND NOT FUNCTION-CALLING
 *   Local models vary in tool-call support and a silent parse failure would
 *   look like "JARVIS didn't bother to check". One line, one shape, parsed
 *   strictly, and a malformed call is reported back to the model as a visible
 *   error rather than swallowed.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as DET from './deterministic.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_DEFAULT = path.resolve(HERE, '..', '..');

const HOME = () => process.env.AIN_DELEGATION_HOME || path.join(os.homedir(), '.claude', 'ain-delegation');
const LAB_DIR = () => path.join(HOME(), 'jarvis-lab');
const LOG = () => path.join(LAB_DIR(), 'conversation.jsonl');

/** Capabilities JARVIS may reach for. Read-only inspection, nothing else. */
export const LAB_TOOLS = Object.freeze([
  'repo.grep', 'repo.find_file', 'repo.locate_symbol',
  'git.log', 'git.file_history', 'git.show_stat', 'git.diff_stat', 'git.rev_parse',
  'verify.file_exists', 'verify.count_matches',
  'inventory.migrations', 'inventory.routes',
]);

/**
 * The persona.
 *
 * Deliberately does NOT instruct wit. "Have a personality, not perform a
 * personality" — a model told to be funny produces catchphrases. What makes a
 * colleague compelling is that they know the work, remember it, and say what
 * they actually think. Brevity and candour are specified; humour is left alone
 * to emerge or not.
 */
export function systemPrompt({ toolLines, memoryDigest }) {
  return [
    "You are JARVIS. You work with Kelly in the Soullab lab — on MAIA, Writer's Studio,",
    "Sound Studio, Elemental Alchemy, and whatever is being made next.",
    "",
    "You are not an assistant and this is not a support session. You are the colleague",
    "who knows this codebase and this body of work, picking up where you left off.",
    "",
    "HOW YOU TALK",
    "- Short. A couple of sentences unless Kelly asks you to go deeper.",
    "- Plainly. No headers, no bullet lists, no preamble, no restating the question.",
    "- Never explain what you are about to do before doing it. Do it, then say what you found.",
    "- Never pad with 'great question', 'let me break this down', or numbered methodology.",
    "- If you disagree, say so and say why. Being agreeable is not being useful.",
    "- If you don't know, say that, and say what would settle it.",
    "",
    "HOW YOU WORK",
    "You can look things up in the repository. To do that, reply with EXACTLY one line:",
    "",
    "TOOL <capability> <json-args>",
    "",
    "for example:",
    '  TOOL repo.grep {"pattern":"maiaPatterns"}',
    '  TOOL repo.find_file {"pattern":"ContinuousConversation"}',
    '  TOOL verify.count_matches {"file":"lib/voice/echoGuard.ts","pattern":"decideEcho"}',
    "",
    "Nothing else in that reply — no explanation around it. The result comes back and",
    "you continue. Look things up before forming a view; a guess dressed as an answer",
    "is worse than a question. When you actually know, answer normally and cite the",
    "file and line you saw it in.",
    "",
    // The pattern language is pinned to POSIX BRE by the capability contract
    // (deterministic.mjs, --basic-regexp). A model reaching for \d+ or (a|b)
    // gets a literal match and reads the empty result as "not in the codebase",
    // which is the worst possible failure: a confident false negative.
    "repo.grep matches POSIX basic regular expressions, so \\d, +, ? and (a|b) do NOT",
    "mean what they do elsewhere. Search for plain literal text — a function name, a",
    "distinctive string, part of a comment. If a search comes back empty, that usually",
    "means your pattern was wrong, not that the thing is absent. Try a shorter, plainer",
    "fragment before concluding anything.",
    "",
    "Available capabilities:",
    toolLines,
    "",
    memoryDigest ? "WHAT WE HAVE BEEN WORKING ON\n" + memoryDigest : "",
  ].filter(Boolean).join("\n");
}

/**
 * The capability list, with each argument's real name, type and whether it is
 * required, derived from the contract rather than written out by hand — a
 * hand-written list drifts, and every drift shows up as the model guessing an
 * argument name and getting "Unexpected argument".
 */
export function toolLines() {
  return LAB_TOOLS.map((name) => {
    const spec = DET.CAPABILITIES[name] || {};
    const args = Object.entries(spec.args || {}).map(([arg, s]) => {
      let t = s.type === 'enum' ? (s.enum || []).join('|') : s.type;
      if (s.type === 'number' && (s.min !== undefined || s.max !== undefined)) t += ` ${s.min ?? ''}..${s.max ?? ''}`;
      return `${arg}${s.required ? '' : '?'}:${t}`;
    });
    return `  ${name} {${args.join(', ')}}`;
  }).join('\n');
}

// ── memory ───────────────────────────────────────────────────────────────────

export function loadHistory(limit = 40) {
  try {
    const lines = fs.readFileSync(LOG(), 'utf8').trim().split('\n').filter(Boolean);
    return lines.slice(-limit).map((l) => JSON.parse(l));
  } catch { return []; }
}

export function appendHistory(entry) {
  try {
    fs.mkdirSync(LAB_DIR(), { recursive: true });
    fs.appendFileSync(LOG(), JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');
  } catch { /* memory is best-effort; a failure to remember must not break the turn */ }
}

/**
 * What JARVIS carries between sessions. Not a transcript dump — the model has
 * limited context, and a wall of old turns crowds out the current one. Recent
 * exchanges verbatim, older ones as the findings they produced.
 */
export function memoryDigest(history, { recent = 8 } = {}) {
  if (!history.length) return '';
  const older = history.slice(0, -recent);
  const lines = [];
  if (older.length) {
    const findings = older.filter((h) => h.role === 'jarvis' && h.finding).map((h) => '- ' + h.finding);
    if (findings.length) lines.push('Earlier, established:', ...findings.slice(-10));
  }
  return lines.join('\n');
}

// ── the loop ─────────────────────────────────────────────────────────────────

const TOOL_RE = /^\s*TOOL\s+([a-z_]+\.[a-z_]+)\s+(\{[\s\S]*\})\s*$/im;

export function parseToolCall(text) {
  const m = String(text ?? '').match(TOOL_RE);
  if (!m) return null;
  let args;
  try { args = JSON.parse(m[2]); }
  catch (e) { return { name: m[1], args: null, parseError: e.message }; }
  return { name: m[1], args };
}

/**
 * Run one capability.
 *
 * `runCapability` THROWS on a schema violation (it calls `validateSchema`
 * itself) and returns `{exit_code, stdout}` on success — so there is one
 * try/catch and no second validation pass. A throw becomes a message the model
 * reads and can correct from, never a silent empty result.
 */
export function runTool(repo, name, args) {
  if (!LAB_TOOLS.includes(name)) {
    return { ok: false, error: `${name} is not available. Use one of: ${LAB_TOOLS.join(', ')}` };
  }
  try {
    const out = DET.runCapability(name, args ?? {}, repo);
    const text = typeof out === 'string' ? out : (out?.stdout ?? JSON.stringify(out));
    const s = String(text);
    // An empty stdout is a real answer — "nothing matched" — and must not look
    // like a broken tool, or the model re-runs the same search.
    return { ok: true, output: s.trim() === '' ? '(no matches)' : s };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

const clip = (s, n) => (s.length > n ? s.slice(0, n) + `\n…[${s.length - n} more characters]` : s);

/**
 * One turn. Loops model → tool → model until JARVIS answers rather than
 * reaching for another tool, or the step budget runs out.
 *
 * `callModel({prompt})` is injected so the loop is testable without a model.
 */
export async function converse({ repo = REPO_DEFAULT, message, history = [], callModel, maxSteps = 8, onStep }) {
  const sys = systemPrompt({ toolLines: toolLines(), memoryDigest: memoryDigest(history) });
  const recent = history.slice(-8)
    .map((h) => (h.role === 'kelly' ? `Kelly: ${h.text}` : `JARVIS: ${h.text}`)).join('\n');

  let scratch = '';
  const steps = [];

  for (let step = 0; step < maxSteps; step++) {
    const prompt = [
      sys, '',
      recent ? 'CONVERSATION SO FAR\n' + recent + '\n' : '',
      `Kelly: ${message}`, '',
      scratch ? 'WHAT YOU HAVE LOOKED UP THIS TURN\n' + scratch + '\n' : '',
      'JARVIS:',
    ].filter(Boolean).join('\n');

    const res = await callModel({ prompt });
    if (!res?.ok) return { ok: false, error: res?.error ?? 'model unavailable', failure_class: res?.failure_class, steps };

    const text = String(res.output ?? '').trim();
    const call = parseToolCall(text);

    if (!call) {
      steps.push({ kind: 'reply' });
      return { ok: true, reply: text, steps };
    }

    onStep?.({ tool: call.name, args: call.args });
    const result = call.parseError
      ? { ok: false, error: `could not parse the arguments: ${call.parseError}` }
      : runTool(repo, call.name, call.args);

    steps.push({ kind: 'tool', name: call.name, args: call.args, ok: result.ok });
    scratch += `\nTOOL ${call.name} ${JSON.stringify(call.args ?? {})}\n`
      + (result.ok ? clip(result.output, 4000) : `ERROR: ${result.error}`) + '\n';
  }

  return {
    ok: true,
    reply: "I kept looking and didn't land it within the steps I had. Here's where I got to — want me to keep going?",
    steps,
    exhausted: true,
  };
}
