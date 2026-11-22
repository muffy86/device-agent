// The ledger is the whole trick, and it is not a trick.
//
// Three things live here, all append-only, all hash-chained, all on your disk:
//   1. events   — every step the agent took, in order, tamper-evident
//   2. cost     — tokens and dollars per step, per principal, against a hard cap
//   3. memory   — facts the agent is allowed to carry forward, each one tagged
//                 with provenance and a source, or it does not get written
//
// Nothing is deleted. Corrections are new events that supersede old ones. This
// is what makes an agent's output auditable instead of merely plausible, and it
// is the one feature that makes switching away from the product expensive for a
// legitimate reason.

import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const PROVENANCE = {
  VERIFIED: '[V]',    // observed directly, reproducible
  REPORTED: '[R]',    // a source said so; source recorded
  UNVERIFIED: '[U]',  // model inference; may never be quoted as fact
};

const GENESIS = '0'.repeat(64);

// Deterministic serialisation: keys sorted at every depth, arrays kept in order.
// Without this the payload itself would not be covered by the hash and the
// chain would only be protecting the timestamps.
function sortDeep(v) {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => ((o[k] = sortDeep(v[k])), o), {});
  return v;
}
const canonical = (o) => JSON.stringify(sortDeep(o));

export class BudgetExceeded extends Error {
  constructor(spent, cap) {
    super(`budget cap reached: $${spent.toFixed(4)} of $${cap.toFixed(4)}`);
    this.name = 'BudgetExceeded';
    this.spent = spent;
    this.cap = cap;
  }
}

export function openLedger({ dir = process.env.DEVICE_AGENT_DATA || './.data' } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const eventsPath = path.join(dir, 'events.jsonl');
  const memoryPath = path.join(dir, 'memory.jsonl');
  if (!fs.existsSync(eventsPath)) fs.writeFileSync(eventsPath, '');
  if (!fs.existsSync(memoryPath)) fs.writeFileSync(memoryPath, '');

  const read = (p) =>
    fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return { _corrupt: l }; } });

  const head = () => {
    const rows = read(eventsPath);
    return rows.length ? rows[rows.length - 1].hash : GENESIS;
  };

  // One writer, two chains: events and memory are separate files so memory can
  // be read cheaply on every turn without scanning the full run history.
  function writeTo(file, kind, payload = {}, principal = 'local') {
    const rows = read(file);
    const prev = rows.length ? rows[rows.length - 1].hash : GENESIS;
    const core = { seq: rows.length, ts: new Date().toISOString(), kind, principal, payload };
    const hash = createHash('sha256').update(prev + canonical(core)).digest('hex');
    const row = { ...core, prev, hash };
    fs.appendFileSync(file, JSON.stringify(row) + '\n');
    return row;
  }

  const append = (kind, payload = {}, { principal = 'local' } = {}) => writeTo(eventsPath, kind, payload, principal);

  return {
    dir,
    eventsPath,
    memoryPath,
    append,

    /** Recompute the whole chain. Any edit to any line shows up here. */
    verify(file = eventsPath) {
      let prev = GENESIS;
      const rows = read(file);
      for (const r of rows) {
        const { prev: p, hash, _corrupt, ...core } = r;
        if (_corrupt) return { ok: false, brokenAt: r.seq ?? -1, reason: 'unparseable line' };
        if (p !== prev) return { ok: false, brokenAt: r.seq, reason: 'chain link mismatch' };
        const expect = createHash('sha256').update(prev + canonical(core)).digest('hex');
        if (expect !== hash) return { ok: false, brokenAt: r.seq, reason: 'content hash mismatch' };
        prev = hash;
      }
      return { ok: true, count: rows.length, head: prev };
    },

    /** Spend so far for one principal, read back off the chain. */
    spent(principal = null) {
      return read(eventsPath)
        .filter((r) => r.kind === 'cost' && (principal == null || r.principal === principal))
        .reduce((a, r) => a + (r.payload.usd || 0), 0);
    },

    recordCost({ principal = 'local', usd, tokens, model, step }) {
      return append('cost', { usd: Number(usd) || 0, tokens, model, step }, { principal });
    },

    /** Throws before the call, never after. The cap is a promise, not a report. */
    assertWithinBudget({ principal = 'local', cap }) {
      const s = this.spent(principal);
      if (s >= cap) throw new BudgetExceeded(s, cap);
      return s;
    },

    /**
     * Memory writes require provenance. [V] additionally requires a source,
     * because "verified" with nothing behind it is how one bad conclusion
     * becomes permanent.
     */
    remember({ key, value, provenance, source = null, principal = 'local', supersedes = null }) {
      if (!Object.values(PROVENANCE).includes(provenance)) throw new Error(`provenance required (${Object.values(PROVENANCE).join(' ')})`);
      if (provenance === PROVENANCE.VERIFIED && !source) throw new Error('[V] memory needs a source: file, url, or command that produced it');
      writeTo(memoryPath, 'memory', { key, value: String(value).slice(0, 8000), provenance, source, supersedes }, principal);
      return this.recall(key, principal);
    },

    /** Latest non-superseded value for a key. Corrections win; history stays. */
    recall(key, principal = 'local') {
      const rows = read(memoryPath);
      const superseded = new Set(rows.map((r) => r.payload?.supersedes).filter((x) => x !== null && x !== undefined));
      const hits = rows
        .map((r) => ({ seq: r.seq, ...r.payload }))
        .filter((m) => m.key === key && m.provenance && !superseded.has(m.seq));
      return hits[hits.length - 1] ?? null;
    },

    all(principal = 'local') {
      const superseded = new Set(read(memoryPath).map((r) => r.payload?.supersedes).filter((x) => x !== null && x !== undefined));
      return read(memoryPath).map((r) => ({ seq: r.seq, ...r.payload })).filter((m) => m.provenance && !superseded.has(m.seq));
    },
  };
}

/** Constant-time bearer check. An agent server on a phone is still a server. */
export function tokenMatches(presented, expected) {
  if (!expected) return false;
  const a = Buffer.from(String(presented || ''));
  const b = Buffer.from(String(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

export const newId = () => randomUUID();
