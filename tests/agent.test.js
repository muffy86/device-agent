import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRegistry, validate, safeJoin, ToolError } from '../packages/core/src/tools.js';
import { runAgent } from '../packages/core/src/agent.js';
import { createProvider, priceOf } from '../packages/core/src/providers.js';
import { openLedger } from '../packages/core/src/ledger.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'da-'));

test('the sandbox refuses to climb out of the root', () => {
  const root = tmp();
  assert.throws(() => safeJoin(root, '../../etc/passwd'), ToolError);
  assert.throws(() => safeJoin(root, '/etc/shadow'), ToolError);
  assert.ok(safeJoin(root, 'notes/today.md').startsWith(fs.realpathSync(root)));
});

test('argument validation catches the shapes models actually get wrong', () => {
  const schema = { required: ['path'], properties: { path: { type: 'string', maxLength: 10 }, limit: { type: 'number' }, mode: { enum: ['r', 'w'] } } };
  assert.throws(() => validate({}, schema), /missing required/);
  assert.throws(() => validate({ path: 'x'.repeat(11) }, schema), /maxLength/);
  assert.throws(() => validate({ path: 'ok', limit: 'four' }, schema), /must be number/);
  assert.throws(() => validate({ path: 'ok', mode: 'x' }, schema), /must be one of/);
  assert.deepEqual(validate({ path: 'ok' }, schema), { path: 'ok' });
});

test('mutating tools are denied unless someone approves them, and the denial is logged', async () => {
  const dir = tmp();
  const root = path.join(dir, 'ws');
  const ledger = openLedger({ dir: path.join(dir, 'ledger') });
  const reg = createRegistry({ root, approve: async () => ({ approved: false, how: 'human' }) });

  await assert.rejects(() => reg.call('fs.write', { path: 'a.txt', content: 'x' }, { ledger }), /approval withheld/);
  assert.equal(fs.existsSync(path.join(root, 'a.txt')), false);
  const kinds = fs.readFileSync(ledger.eventsPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l).kind);
  assert.ok(kinds.includes('tool_denied'));
});

test('shell is off by default, and egress needs an allowlist', async () => {
  const root = tmp();
  const reg = createRegistry({ root, approve: async () => ({ approved: true, how: 'test' }) });
  await assert.rejects(() => reg.call('shell.exec', { cmd: 'ls' }), /shell execution is disabled/);
  await assert.rejects(() => reg.call('http.get', { url: 'https://example.com' }), /not allowlisted/);
});

test('a full run reads real bytes, writes to the ledger, and respects the cap', async () => {
  const dir = tmp();
  const root = path.join(dir, 'ws');
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'README.md'), '# my device\nnothing else yet\n');

  const ledger = openLedger({ dir: path.join(dir, 'ledger') });
  const reg = createRegistry({ root, approve: async () => ({ approved: true, how: 'test' }) });
  const provider = createProvider({ DEVICE_AGENT_PROVIDER: 'mock' });

  const events = [];
  const summary = await runAgent({
    task: 'what is in this repo?', provider, registry: reg, ledger, onEvent: (e) => events.push(e), budgetUsd: 5,
  });

  assert.match(summary.text, /nothing else yet/, 'final answer must quote the file it read');
  assert.ok(events.some((e) => e.type === 'tool_ok' && e.name === 'fs.list'));
  assert.ok(summary.steps >= 2);
  assert.equal(ledger.verify().ok, true);
  const kinds = fs.readFileSync(ledger.eventsPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l).kind);
  assert.ok(kinds.includes('cost'));
  assert.ok(kinds.includes('run_end'));

  // Zero cap: the loop must refuse to spend rather than run up a bill.
  const capped = await runAgent({ task: 'again', provider, registry: reg, ledger, budgetUsd: 0, onEvent: () => {} });
  assert.equal(capped.code, 'budget_exceeded');
});

test('prices are pure arithmetic, so a bill can be recomputed by the customer', () => {
  assert.equal(priceOf('gpt-4.1-mini', { in: 1_000_000, out: 0 }), 0.4);
  assert.equal(+priceOf('claude-sonnet-4-5', { in: 0, out: 1_000_000 }).toFixed(2), 15);
  assert.equal(priceOf('not-a-real-model', { in: 1e6, out: 1e6 }), 0);
});
