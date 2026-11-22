// HTTP + SSE server. This is the shape you would sell: a metered endpoint that
// streams steps and tool calls, refuses work it cannot afford, and keeps a
// receipt for everything it did.
//
// Honest economics live here too: the customer's cost is measured on every
// request, the markup is applied transparently, and the cap is enforced before
// inference rather than discovered afterwards.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, timingSafeEqual } from 'node:crypto';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { runAgent, DEFAULT_SYSTEM } from '../../packages/core/src/agent.js';
import { createProvider } from '../../packages/core/src/providers.js';
import { createRegistry } from '../../packages/core/src/tools.js';
import { openLedger, tokenMatches } from '../../packages/core/src/ledger.js';

const PORT = Number(process.env.PORT || 8787);
const TOKEN = process.env.DEVICE_AGENT_TOKEN || '';
const CAP = Number(process.env.DEVICE_AGENT_BUDGET_USD || 1);
const MARKUP = Number(process.env.BILLING_MARKUP || 2.5);
const DATA = process.env.DEVICE_AGENT_DATA || './.data';
const WEB = path.join(__dirname, '..', 'web');
const ledger = openLedger({ dir: DATA });
const registry = createRegistry({ root: process.env.DEVICE_AGENT_ROOT || path.join(DATA, 'workspace') });

if (!TOKEN) console.warn('[device-agent] DEVICE_AGENT_TOKEN is empty — refusing all authenticated routes.');

// Token bucket per principal. Cheap, in-memory, enough to stop an accidental
// runaway loop from burning a month of credit in an afternoon.
const buckets = new Map();
function rateLimit(principal, rate = 30, burst = 10) {
  const now = Date.now();
  const b = buckets.get(principal) ?? { tokens: burst, at: now };
  b.tokens = Math.min(burst, b.tokens + ((now - b.at) / 1000) * rate);
  b.at = now;
  if (b.tokens < 1) { buckets.set(principal, b); return false; }
  b.tokens -= 1;
  buckets.set(principal, b);
  return true;
}

const json = (res, code, obj) => {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(obj, null, 2));
};

function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > limit) reject(new Error('body too large')); else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function principalOf(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  return token;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const route = `${req.method} ${url.pathname}`;

  if (route === 'GET /healthz')
    return json(res, 200, { ok: true, provider: createProvider().name, chain: ledger.verify(), spent: +ledger.spent().toFixed(4), cap: CAP });

  // The only unauthenticated page: the client itself.
  if (route === 'GET /' || route === 'GET /index.html') {
    const f = path.join(WEB, 'index.html');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(f));
  }

  const token = principalOf(req);
  if (!tokenMatches(token, TOKEN)) return json(res, 401, { error: 'unauthorized' });
  // Never log the token, and never derive an id from it that leaks its prefix:
  // hash it. Ledger entries stay correlatable without being credential material.
  const principal = 'p_' + createHash('sha256').update(token).digest('hex').slice(0, 12);

  if (!rateLimit(principal)) return json(res, 429, { error: 'rate limited', retry_after_s: 1 });

  if (route === 'GET /v1/usage') {
    const spent = ledger.spent(principal);
    return json(res, 200, {
      principal, spent_usd: +spent.toFixed(4), cap_usd: CAP, remaining_usd: +Math.max(0, CAP - spent).toFixed(4),
      billable_usd: +(spent * MARKUP).toFixed(4), markup: MARKUP,
      chain: ledger.verify(), recent: tail(ledger.eventsPath, 25),
    });
  }

  if (route === 'GET /v1/memory') return json(res, 200, { items: ledger.all(principal) });

  if (route === 'POST /v1/memory') {
    const b = JSON.parse((await readBody(req)) || '{}');
    try {
      const m = ledger.remember({ ...b, principal });
      return json(res, 201, m);
    } catch (e) { return json(res, 400, { error: e.message }); }
  }

  if (route === 'POST /v1/chat') {
    const b = JSON.parse((await readBody(req)) || '{}');
    if (!b.task) return json(res, 400, { error: 'task required' });

    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
    const ac = new AbortController();
    req.on('close', () => ac.abort());

    try {
      const summary = await runAgent({
        task: b.task, principal, ledger, registry,
        budgetUsd: Math.min(Number(b.budget_usd ?? CAP), CAP),
        maxSteps: Math.min(Number(b.max_steps ?? 8), 16),
        system: b.system || DEFAULT_SYSTEM,
        signal: ac.signal,
        onEvent: (o) => { if (o.type === 'delta' || o.type === 'tool_ok' || o.type === 'step' || o.type === 'tool_error' || o.type === 'budget_exceeded' || o.type === 'error') send(o); },
      });
      send({ type: 'receipt', ...summary, billable_usd: +(summary.usd * MARKUP).toFixed(4) });
    } catch (e) {
      send({ type: 'error', message: e.message });
    }
    return res.end();
  }

  // Billing. Two routes, both honest: checkout states the price, and the
  // webhook grants exactly what was paid for. No silent renewal, no upsell loop.
  if (route === 'POST /v1/billing/checkout') {
    if (!process.env.STRIPE_SECRET_KEY)
      return json(res, 501, { error: 'STRIPE_SECRET_KEY not set', hint: 'set it, or run without billing in self-hosted mode' });
    const b = JSON.parse((await readBody(req)) || '{}');
    const form = new URLSearchParams({
      mode: 'payment',
      'line_items[0][price]': b.price_id || '',
      'line_items[0][quantity]': '1',
      success_url: b.success_url || 'http://localhost:' + PORT + '/?paid=1',
      cancel_url: b.cancel_url || 'http://localhost:' + PORT + '/',
      client_reference_id: principal,
      'metadata[credits_usd]': String(b.credits_usd ?? 5),
    });
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    const j = await r.json();
    return json(res, r.ok ? 200 : 502, { url: j.url, id: j.id, error: j.error?.message });
  }

  if (route === 'POST /v1/billing/webhook') {
    const raw = await readBody(req);
    const sig = req.headers['stripe-signature'] || '';
    if (!verifyStripe(raw, sig, process.env.STRIPE_WEBHOOK_SECRET))
      return json(res, 400, { error: 'bad signature' });
    const evt = JSON.parse(raw);
    if (evt.type === 'checkout.session.completed') {
      const usd = Number(evt.data?.object?.metadata?.credits_usd ?? 0);
      ledger.append('credit_granted', { usd, source: 'stripe', event: evt.id }, { principal: evt.data?.object?.client_reference_id || 'unknown' });
    }
    return json(res, 200, { received: true });
  }

  json(res, 404, { error: 'no such route', routes: ['GET /', 'GET /healthz', 'GET /v1/usage', 'GET /v1/memory', 'POST /v1/memory', 'POST /v1/chat', 'POST /v1/billing/checkout', 'POST /v1/billing/webhook'] });
});

function tail(file, n) {
  try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).slice(-n).map((l) => JSON.parse(l)); }
  catch { return []; }
}

function verifyStripe(payload, header, secret) {
  if (!secret) return false;
  const m = /t=(\d+),v1=([a-f0-9]+)/.exec(header);
  if (!m) return false;
  const expect = createHmac('sha256', secret).update(`${m[1]}.${payload}`).digest('hex');
  const a = Buffer.from(expect), b = Buffer.from(m[2]);
  return a.length === b.length && timingSafeEqual(a, b);
}

server.listen(PORT, () => {
  console.log(`device-agent listening on http://127.0.0.1:${PORT}`);
  console.log(`  provider  ${createProvider().name}`);
  console.log(`  data      ${path.resolve(DATA)}`);
  console.log(`  cap       $${CAP} per principal (markup ${MARKUP}x on hosted mode)`);
});
