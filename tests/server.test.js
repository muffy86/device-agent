// End-to-end tests against the real server, on a random port.
//
// These exist because of a specific failure: the server called createHash()
// without importing it, and the authenticated path was never exercised locally —
// only CORS and /healthz were. CI caught it on the first push. This file makes
// that class of bug impossible to ship again.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'da-server-'));
const PORT = 8798;
const TOKEN = 'test-token';

process.env.DEVICE_AGENT_TOKEN = TOKEN;
process.env.DEVICE_AGENT_PROVIDER = 'mock';
process.env.DEVICE_AGENT_DATA = DIR;
process.env.DEVICE_AGENT_ROOT = path.join(DIR, 'workspace');
process.env.DEVICE_AGENT_BUDGET_USD = '5';

let server;
const base = `http://127.0.0.1:${PORT}`;
const call = (p, init = {}) => fetch(base + p, init);
const authed = (p, init = {}) =>
  fetch(base + p, { ...init, headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', ...(init.headers || {}) } });

before(async () => {
  fs.mkdirSync(path.join(DIR, 'workspace'), { recursive: true });
  fs.writeFileSync(path.join(DIR, 'workspace', 'notes.md'), '# notes\nserver test fixture\n');
  const mod = await import('../apps/server/index.js');
  ({ server } = mod.startServer({ port: PORT }));
  await new Promise((r) => setTimeout(r, 250));
});

after(() => server?.close());

test('healthz is public and reports the chain state', async () => {
  const r = await call('/healthz');
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.equal(j.chain.ok, true);
});

test('an unauthenticated request is refused', async () => {
  const r = await call('/v1/chat', { method: 'POST', body: JSON.stringify({ task: 'hi' }) });
  assert.equal(r.status, 401);
});

test('the authenticated path works — this is the one that was broken', async () => {
  const r = await authed('/v1/usage');
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.match(j.principal, /^p_[a-f0-9]{12}$/, 'principal must be a hash, never the token');
  assert.ok(!JSON.stringify(j).includes(TOKEN), 'the token must never appear in a response or the ledger');
});

test('a full run streams deltas, tool events and a receipt', async () => {
  const r = await authed('/v1/chat', { method: 'POST', body: JSON.stringify({ task: 'what is in this workspace' }) });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type') ?? '', /text\/event-stream/);
  const body = await r.text();
  assert.match(body, /"type":"tool_ok"/);
  assert.match(body, /"type":"receipt"/);
  assert.match(body, /notes\.md/);
});

test('CORS is present for the file:// Android shell', async () => {
  const r = await call('/v1/chat', { method: 'OPTIONS' });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
});

test('memory refuses a write without provenance, over HTTP', async () => {
  const bad = await authed('/v1/memory', { method: 'POST', body: JSON.stringify({ key: 'k', value: 'v' }) });
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).error, /provenance required/);

  const good = await authed('/v1/memory', {
    method: 'POST',
    body: JSON.stringify({ key: 'plan', value: 'free tier first', provenance: '[R]', source: 'note' }),
  });
  assert.equal(good.status, 201);

  const listed = await (await authed('/v1/memory')).json();
  assert.equal(listed.items.length, 1);
});

test('the ledger on disk verifies after all of that', async () => {
  const { openLedger } = await import('../packages/core/src/ledger.js');
  const v = openLedger({ dir: DIR }).verify();
  assert.equal(v.ok, true, 'the chain must still be intact');
  assert.ok(v.count > 5);
});
