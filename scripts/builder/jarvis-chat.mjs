#!/usr/bin/env node
/**
 * jarvis — talk to JARVIS.
 *
 *   npm run jarvis
 *
 * One command, no arguments, no work-unit ids, no JSON. You type; it answers;
 * it looks things up when it needs to; it remembers across sessions.
 *
 * Runs entirely on the local model via the loopback-only transport in
 * jarvis-local-worker.mjs. Nothing here can write to the repository, commit,
 * merge, deploy or reach the network beyond 127.0.0.1 — the capabilities it
 * can reach are read-only inspection, enumerated in jarvis-lab.mjs.
 */
import readline from 'node:readline';
import process from 'node:process';
import { converse, loadHistory, appendHistory, REPO_DEFAULT } from './jarvis-lab.mjs';
import { run as runModel, health } from './jarvis-local-worker.mjs';

const MODEL = process.env.JARVIS_MODEL || 'gpt-oss:20b';
const REPO = process.env.JARVIS_REPO_ROOT || REPO_DEFAULT;
// Not 0: a conversational partner at temperature 0 reads as a vending machine.
// Not 0.8: the tool-call line has to come back in exactly one shape.
const TEMP = Number(process.env.JARVIS_TEMP ?? 0.4);

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

const callModel = ({ prompt }) => runModel({ prompt, model: MODEL, temperature: TEMP, timeoutMs: 180_000 });

async function main() {
  const h = await health();
  if (!h.ok) {
    console.error(`\nJARVIS can't reach the local model.\n  ${h.error ?? h.failure_class}\n`);
    console.error(`Start it with:  ollama serve\nThen check:     ollama list\n`);
    process.exit(3);
  }
  if (!(h.models || []).some((m) => m === MODEL || m.startsWith(MODEL.split(':')[0]))) {
    console.error(`\n${MODEL} isn't loaded. Available: ${(h.models || []).join(', ') || '(none)'}`);
    console.error(`Pull it with:  ollama pull ${MODEL}\nOr pick another: JARVIS_MODEL=<name> npm run jarvis\n`);
    process.exit(3);
  }

  let history = loadHistory();
  console.log(`\n${bold('JARVIS')} ${dim(`· ${MODEL} · ${history.length ? `${history.length} remembered turns` : 'first conversation'}`)}`);
  console.log(dim(`${REPO}\n`));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '› ' });
  rl.prompt();

  for await (const line of rl) {
    const message = line.trim();
    if (!message) { rl.prompt(); continue; }
    if (message === '/exit' || message === '/quit') break;

    appendHistory({ role: 'kelly', text: message });
    history.push({ role: 'kelly', text: message });

    const res = await converse({
      repo: REPO, message, history, callModel,
      // Shown as it happens, so a long pause is legible as work rather than a hang.
      onStep: ({ tool, args }) => process.stdout.write(dim(`  · ${tool} ${JSON.stringify(args ?? {})}\n`)),
    });

    if (!res.ok) {
      console.log(`\n  ${dim(`model unavailable: ${res.error}`)}\n`);
      rl.prompt();
      continue;
    }

    console.log(`\n${res.reply}\n`);
    appendHistory({ role: 'jarvis', text: res.reply, tools: res.steps.filter((s) => s.kind === 'tool').map((s) => s.name) });
    history.push({ role: 'jarvis', text: res.reply });
    rl.prompt();
  }

  console.log(dim('\n(remembered)\n'));
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
