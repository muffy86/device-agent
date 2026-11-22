#!/usr/bin/env node
// Demo: the approval gate, in 20 lines of real output.
//
//   node tools/demo-denial.js
//
// Shows three things a plain chat wrapper cannot show: the model's requested
// mutation with its literal arguments, the refusal, and the tamper-evident
// ledger entry that records the refusal.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRegistry } from '../packages/core/src/tools.js';
import { openLedger } from '../packages/core/src/ledger.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'da-demo-'));
const root = path.join(dir, 'ws');
fs.mkdirSync(root, { recursive: true });
fs.writeFileSync(path.join(root, 'notes.md'), '# notes\nnothing executed.\n');

const ledger = openLedger({ dir: path.join(dir, 'ledger') });

// A human who is not going to approve anything, as the default.
const registry = createRegistry({
  root,
  approve: async () => ({ approved: false, how: 'human' }),
});

const requested = { path: 'notes.md', content: '# notes\nrewritten by the model\n' };
console.log(`agent wants: fs.write ${JSON.stringify(requested).slice(0, 72)}`);

try {
  await registry.call('fs.write', requested, { ledger });
  console.log('that should not have happened');
  process.exit(1);
} catch (e) {
  console.log(`refused: ${e.message}`);
}

console.log(`file unchanged: ${fs.readFileSync(path.join(root, 'notes.md'), 'utf8').trim().endsWith('nothing executed.')}`);
const denial = fs.readFileSync(ledger.eventsPath, 'utf8').trim().split('\n').map(JSON.parse).find((r) => r.kind === 'tool_denied');
console.log(`ledger seq ${denial.seq}: tool_denied  reason="${denial.payload.reason}"  hash ${denial.hash.slice(0, 12)}…`);
console.log(`chain verify: ${ledger.verify().ok ? 'intact' : 'BROKEN'}`);
