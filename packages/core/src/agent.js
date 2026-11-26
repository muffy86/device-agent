// The loop. This is about 200 lines, and it is the whole product category.
//
// Every commercial "agent" you have used is, structurally, this file plus a
// prompt, plus a UI that makes the sampling feel like progress, plus billing.
// The loop is not the moat. The ledger, the tools, and the distribution are.

import fs from 'node:fs';
import { createProvider, priceOf } from './providers.js';
import { createRegistry, ToolError } from './tools.js';
import { openLedger } from './ledger.js';

export const DEFAULT_SYSTEM = `You are a device agent running on the user's own hardware.

Rules that override style:
- Use a tool before asserting a fact about the user's files, device, or accounts.
  If you did not read it, say you did not read it.
- Never claim a task is complete in the same message where you have not checked.
- Prefer the smallest action that resolves the request. Do not chain tools for show.
- If you cannot do something, say so in one sentence and stop. Do not offer a
  fourth alternative approach that will also fail.
- Distinguish what you verified from what you are inferring.`;

export async function runAgent({
  task,
  provider = createProvider(),
  registry = createRegistry(),
  ledger = openLedger(),
  principal = 'local',
  system = DEFAULT_SYSTEM,
  history = [],
  maxSteps = 8,
  budgetUsd = Number(process.env.DEVICE_AGENT_BUDGET_USD || 1),
  onEvent = () => {},
  signal = null,
}) {
  const t0 = Date.now();
  const messages = [{ role: 'system', content: system }, ...history, { role: 'user', content: task }];
  const usageTotal = { in: 0, out: 0 };
  let cost = 0;
  let steps = 0;

  ledger.append('run_start', { task: String(task).slice(0, 2000), provider: provider.name, model: provider.model, budgetUsd }, { principal });
  onEvent({ type: 'start', provider: provider.name, model: provider.model, budgetUsd });

  while (steps < maxSteps) {
    if (signal?.aborted) { onEvent({ type: 'aborted' }); break; }

    // Budget is checked before the call, so a user can never be surprised by a
    // bill for work the cap said no to.
    try { ledger.assertWithinBudget({ principal, cap: budgetUsd }); }
    catch (e) { onEvent({ type: 'budget_exceeded', spent: e.spent, cap: e.cap }); return finish({ error: e.message, code: 'budget_exceeded' }); }

    steps += 1;
    let res;
    try {
      res = await provider.chat({
        messages,
        tools: registry.list(),
        onDelta: (d) => onEvent({ type: 'delta', text: d }),
      });
    } catch (e) {
      ledger.append('provider_error', { message: String(e.message).slice(0, 1000) }, { principal });
      onEvent({ type: 'error', message: e.message });
      return finish({ error: e.message, code: 'provider_error' });
    }

    usageTotal.in += res.usage?.in ?? 0;
    usageTotal.out += res.usage?.out ?? 0;
    const stepCost = priceOf(provider.model, { in: res.usage?.in ?? 0, out: res.usage?.out ?? 0 });
    cost += stepCost;
    ledger.recordCost({ principal, usd: stepCost, tokens: res.usage, model: provider.model, step: steps });
    onEvent({ type: 'step', n: steps, text: res.text, toolCalls: res.toolCalls ?? [], usd: stepCost, cumulativeUsd: cost });

    messages.push({ role: 'assistant', content: res.text, toolCalls: res.toolCalls ?? [] });

    if (!res.toolCalls?.length) return finish({ text: res.text });

    for (const call of res.toolCalls) {
      // A model that hallucinates a tool name gets a message back, not a crash.
      try {
        const out = await registry.call(call.name, call.args, { principal, ledger, step: steps });
        onEvent({ type: 'tool_ok', name: call.name, args: call.args, result: String(out).slice(0, 4000) });
        messages.push({ role: 'tool', toolCallId: call.id, toolName: call.name, content: String(out).slice(0, 100_000) });
      } catch (e) {
        const msg = e instanceof ToolError ? `Tool refused: ${e.message}` : `Tool failed: ${e.message}`;
        onEvent({ type: 'tool_error', name: call.name, message: msg });
        messages.push({ role: 'tool', toolCallId: call.id, toolName: call.name, content: msg });
      }
    }
  }

  onEvent({ type: 'step_limit', maxSteps });
  return finish({ text: `Stopped after ${maxSteps} steps without a final answer.`, code: 'step_limit' });

  function finish({ text = null, error = null, code = null }) {
    const summary = { task, text, error, code, steps, tokens: usageTotal, usd: cost, ms: Date.now() - t0 };
    ledger.append('run_end', { code, steps, tokens: usageTotal, usd: Number(cost.toFixed(6)), ms: summary.ms }, { principal });
    onEvent({ type: 'done', ...summary, head: ledger.verify().head });
    return summary;
  }
}

/** Loads .env by hand so there is no dotenv dependency. */
export function loadEnv(file = '.env') {
  try {
    for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!m || process.env[m[1]]) continue;
      let value = m[2].trim();
      const quote = value[0];
      if ((quote === '"' || quote === "'") && value.at(-1) === quote) {
        value = value.slice(1, -1); // keep '#' inside quoted values
      } else {
        const comment = value.indexOf(' #');
        if (comment !== -1) value = value.slice(0, comment).trim();
      }
      process.env[m[1]] = value;
    }
  } catch { /* no .env is fine */ }
}
