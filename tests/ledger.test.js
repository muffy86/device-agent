import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openLedger, PROVENANCE, BudgetExceeded } from '../packages/core/src/ledger.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'da-ledger-'));

test('chain verifies, and any edit to history is detectable', () => {
  const dir = tmp();
  const l = openLedger({ dir });
  l.append('run_start', { task: 'a' });
  l.recordCost({ usd: 0.002 });
  l.append('run_end', { code: null });

  const v = l.verify();
  assert.equal(v.ok, true);
  assert.equal(v.count, 3);

  // Rewrite the cost line the way a dishonest product would.
  const p = path.join(dir, 'events.jsonl');
  const lines = fs.readFileSync(p, 'utf8').trim().split('\n');
  const row = JSON.parse(lines[1]);
  row.payload.usd = 0.0;
  lines[1] = JSON.stringify(row);
  fs.writeFileSync(p, lines.join('\n') + '\n');

  const broken = openLedger({ dir }).verify();
  assert.equal(broken.ok, false);
  assert.equal(broken.brokenAt, 1);
});

test('spend is per principal and the cap blocks before the call', () => {
  const l = openLedger({ dir: tmp() });
  l.recordCost({ principal: 'alice', usd: 0.3 });
  l.recordCost({ principal: 'bob', usd: 0.1 });
  assert.equal(+l.spent('alice').toFixed(2), 0.3);
  assert.equal(+l.spent('bob').toFixed(2), 0.1);
  assert.equal(+l.spent().toFixed(2), 0.4);

  l.recordCost({ principal: 'alice', usd: 0.25 });
  assert.throws(() => l.assertWithinBudget({ principal: 'alice', cap: 0.5 }), BudgetExceeded);
  assert.doesNotThrow(() => l.assertWithinBudget({ principal: 'bob', cap: 0.5 }));
});

test('memory requires provenance, and [V] requires a source', () => {
  const l = openLedger({ dir: tmp() });
  assert.throws(() => l.remember({ key: 'k', value: 'v' }), /provenance required/);
  assert.throws(() => l.remember({ key: 'k', value: 'v', provenance: PROVENANCE.VERIFIED }), /needs a source/);

  l.remember({ key: 'plan', value: 'free tier first', provenance: PROVENANCE.REPORTED, source: 'vault.yaml' });
  assert.equal(l.recall('plan').value, 'free tier first');
});

test('corrections supersede without deleting history', () => {
  const l = openLedger({ dir: tmp() });
  const first = l.remember({ key: 'venue', value: 'Coinbase', provenance: PROVENANCE.REPORTED, source: 'screenshot' });
  l.remember({ key: 'venue', value: 'Kraken', provenance: PROVENANCE.VERIFIED, source: 'statement 2026-11-21', supersedes: first.seq });
  assert.equal(l.recall('venue').value, 'Kraken');
  assert.equal(l.all().length, 1);              // one live fact
  assert.equal(l.all().length, 1);
  const raw = fs.readFileSync(l.memoryPath, 'utf8').trim().split('\n').length;
  assert.equal(raw, 2);                          // two events, nothing deleted
});
