#!/usr/bin/env node
// CLI entry point. `node apps/cli/index.js "do the thing"`
//
// One binary, no build step, no dependencies, works on a phone under Termux and
// on a laptop. Every run prints what it cost and the hash of the ledger tail, so
// "did it actually do anything" is answerable from the terminal.

import readline from 'node:readline/promises';
import path from 'node:path';
import fs from 'node:fs';
import { runAgent, DEFAULT_SYSTEM } from '../../packages/core/src/agent.js';
import { createProvider } from '../../packages/core/src/providers.js';
import { createRegistry } from '../../packages/core/src/tools.js';
import { openLedger } from '../../packages/core/src/ledger.js';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, dflt = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
};

if (flag('help') || (!argv.length && process.stdin.isTTY)) {
  console.log(`device-agent — the agent that runs on your own hardware

  device-agent "task"                run one task
  device-agent --yes "task"          auto-approve file writes (dev only)
  device-agent --mock "task"         run fully offline against the mock provider
  device-agent --provider openai --model gpt-4.1-mini "task"
  device-agent --data ./state        where the ledger lives
  device-agent --root ./sandbox      filesystem the agent is confined to
  device-agent --budget 0.25         hard USD cap for this run
  device-agent --json                machine-readable event stream

The ledger is append-only. Try: node apps/cli/index.js --verify`);
  process.exit(0);
}

if (flag('verify')) {
  const data = opt('data', process.env.DEVICE_AGENT_DATA || './.data');
  const ledger = openLedger({ dir: data });
  const v = ledger.verify();
  console.log(v.ok ? `chain intact — ${v.count} events, head ${v.head.slice(0, 16)}…` : `CHAIN BROKEN at seq ${v.brokenAt}: ${v.reason}`);
  process.exit(v.ok ? 0 : 1);
}

const task = argv.filter((a) => !a.startsWith('--')).filter((a) => {
  const prev = argv[argv.indexOf(a) - 1];
  return !['--model', '--provider', '--data', '--root', '--budget', '--system', '--max-steps'].includes(prev);
}).join(' ') || 'List the workspace and tell me what is here.';

const dataDir = opt('data', process.env.DEVICE_AGENT_DATA || './.data');
const root = opt('root', process.env.DEVICE_AGENT_ROOT || path.join(dataDir, 'workspace'));
const budgetUsd = Number(opt('budget', process.env.DEVICE_AGENT_BUDGET_USD || 1));
const asJson = flag('json');
const autoYes = flag('yes') || process.env.DEVICE_AGENT_AUTOAPPROVE === 'true';

fs.mkdirSync(root, { recursive: true });
const ledger = openLedger({ dir: dataDir });

// Interactive approval. Reads the real arguments the model produced, so saying
// yes is an informed yes rather than a blanket permission.
let rl = null;
const approve = async ({ name, args }) => {
  if (autoYes) return { approved: true, how: 'flag' };
  if (!process.stdin.isTTY || asJson) return { approved: false, how: 'non-interactive' };
  rl ??= readline.createInterface({ input: process.stdin, output: process.stderr });
  const ans = await rl.question(`\n  approve ${name}? ${JSON.stringify(args).slice(0, 300)}\n  [y/N] `);
  return { approved: /^y(es)?$/i.test(ans.trim()), how: 'human' };
};

const registry = createRegistry({ root, approve });
const provider = flag('mock')
  ? (await import('../../packages/core/src/providers.js')).createProvider({ DEVICE_AGENT_PROVIDER: 'mock' })
  : createProvider(process.env);

const say = (o) => {
  if (asJson) return void console.log(JSON.stringify(o));
  switch (o.type) {
    case 'start': console.error(`provider=${o.provider} model=${o.model} cap=$${o.budgetUsd}`); break;
    case 'delta': process.stdout.write(o.text); break;
    case 'step': if (!o.toolCalls.length) process.stdout.write('\n'); break;
    case 'tool_ok': console.error(`  ✓ ${o.name} → ${String(o.result).split('\n')[0].slice(0, 120)}`); break;
    case 'tool_error': case 'tool_denied': console.error(`  ✗ ${o.name}: ${o.message || o.reason}`); break;
    case 'budget_exceeded': console.error(`\nbudget cap hit ($${o.spent.toFixed(4)} of $${o.cap.toFixed(4)}) — stopping`); break;
    case 'error': console.error(`\nerror: ${o.message}`); break;
  }
};

const ac = new AbortController();
process.on('SIGINT', () => ac.abort());

const summary = await runAgent({
  task, provider, registry, ledger, budgetUsd, onEvent: say, signal: ac.signal,
  system: opt('system') ? fs.readFileSync(opt('system'), 'utf8') : DEFAULT_SYSTEM,
  maxSteps: Number(opt('max-steps', 8)),
});
rl?.close();

if (!asJson) {
  console.error(`\n— ${summary.steps} step(s), ${summary.tokens.in}+${summary.tokens.out} tokens, $${summary.usd.toFixed(4)}, ${(summary.ms / 1000).toFixed(1)}s`);
  console.error(`  ledger: ${ledger.eventsPath}  head ${ledger.verify().head.slice(0, 12)}…  (verify: --verify)`);
}
process.exit(summary.error ? 1 : 0);
