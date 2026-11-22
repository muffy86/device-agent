// Tool registry. Every tool declares a JSON-schema-ish contract, a mutation
// flag, and is executed through one choke point so the policy layer has a
// single place to say no.
//
// Default posture: read freely inside the root, write only with approval,
// no network unless a host is allowlisted, no shell unless explicitly enabled.
// The agent cannot reach around this by asking nicely in prose.

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

export class ToolError extends Error {
  constructor(msg, code = 'tool_error') { super(msg); this.code = code; }
}

// ────────────────────────────────────────────────────── schema validation
// Deliberately small: required, type, enum, maxLength, pattern. Big enough for
// real tool contracts, small enough to audit in one sitting.

export function validate(args, schema = {}) {
  const errors = [];
  const a = args && typeof args === 'object' ? args : {};
  for (const key of schema.required ?? []) {
    if (a[key] === undefined || a[key] === null || a[key] === '') errors.push(`missing required "${key}"`);
  }
  for (const [key, spec] of Object.entries(schema.properties ?? {})) {
    if (a[key] === undefined) continue;
    const v = a[key];
    const t = spec.type ?? 'string';
    const ok =
      t === 'string' ? typeof v === 'string'
      : t === 'number' || t === 'integer' ? typeof v === 'number' && Number.isFinite(v)
      : t === 'boolean' ? typeof v === 'boolean'
      : t === 'array' ? Array.isArray(v)
      : t === 'object' ? typeof v === 'object' && !Array.isArray(v)
      : true;
    if (!ok) errors.push(`"${key}" must be ${t}`);
    if (t === 'string' && spec.maxLength && typeof v === 'string' && v.length > spec.maxLength)
      errors.push(`"${key}" exceeds maxLength ${spec.maxLength}`);
    if (spec.enum && !spec.enum.includes(v)) errors.push(`"${key}" must be one of ${spec.enum.join(', ')}`);
    if (spec.pattern && typeof v === 'string' && !new RegExp(spec.pattern).test(v))
      errors.push(`"${key}" does not match ${spec.pattern}`);
  }
  if (errors.length) throw new ToolError(`invalid arguments: ${errors.join('; ')}`, 'invalid_args');
  return a;
}

// ────────────────────────────────────────────────────────────── sandboxing

/** Resolve inside root or refuse. Symlink-safe: realpath the parent first. */
export function safeJoin(root, rel) {
  fs.mkdirSync(root, { recursive: true });
  const absRoot = fs.realpathSync(root);
  const target = path.resolve(absRoot, String(rel || '.'));
  // Resolve the deepest existing ancestor so symlinks cannot be used to climb out.
  let probe = target;
  while (!fs.existsSync(probe)) probe = path.dirname(probe);
  const realProbe = fs.realpathSync(probe);
  if (realProbe !== absRoot && !realProbe.startsWith(absRoot + path.sep))
    throw new ToolError(`path escapes the workspace root: ${rel}`, 'path_escape');
  return target;
}

const truncate = (s, n) => (s.length > n ? s.slice(0, n) + `\n…[truncated ${s.length - n} chars]` : s);

// ────────────────────────────────────────────────────────────── registry

export function createRegistry({
  root = process.env.DEVICE_AGENT_ROOT || './.data/workspace',
  allowShell = process.env.DEVICE_AGENT_ALLOW_SHELL === 'true',
  httpAllow = (process.env.DEVICE_AGENT_HTTP_ALLOW || '').split(',').map((s) => s.trim()).filter(Boolean),
  autoApprove = process.env.DEVICE_AGENT_AUTOAPPROVE === 'true',
  maxBytes = 200_000,
  approve = async () => false,   // called for every mutating tool; default deny
  fetchImpl = fetch,
} = {}) {
  fs.mkdirSync(root, { recursive: true });
  const tools = new Map();

  const define = (t) => { tools.set(t.name, { mutating: false, ...t }); return t; };

  // ── read ────────────────────────────────────────────────────────────────
  define({
    name: 'fs.list',
    description: 'List a directory inside the workspace. Use before assuming a file exists.',
    parameters: { type: 'object', required: ['path'], properties: { path: { type: 'string', maxLength: 500 } } },
    handler: async ({ path: p }) => {
      const abs = safeJoin(root, p);
      const entries = fs.readdirSync(abs, { withFileTypes: true }).slice(0, 500);
      return entries.map((e) => `${e.isDirectory() ? 'd' : '-'} ${e.name}${e.isFile() ? ` (${fs.statSync(path.join(abs, e.name)).size}b)` : ''}`).join('\n') || '(empty)';
    },
  });

  define({
    name: 'fs.read',
    description: 'Read a UTF-8 text file inside the workspace. Returns raw bytes, not a summary.',
    parameters: { type: 'object', required: ['path'], properties: { path: { type: 'string', maxLength: 500 }, maxBytes: { type: 'number' } } },
    handler: async ({ path: p, maxBytes: mb = maxBytes }) => {
      const abs = safeJoin(root, p);
      if (!fs.existsSync(abs)) throw new ToolError(`no such file: ${p}`, 'not_found');
      const st = fs.statSync(abs);
      if (st.isDirectory()) throw new ToolError(`${p} is a directory; use fs.list`, 'is_dir');
      if (st.size > 5_000_000) throw new ToolError(`file too large: ${st.size}b`, 'too_large');
      return truncate(fs.readFileSync(abs, 'utf8'), Math.min(mb, maxBytes));
    },
  });

  define({
    name: 'fs.search',
    description: 'Case-insensitive substring search across workspace text files. Returns file:line hits.',
    parameters: { type: 'object', required: ['query'], properties: { query: { type: 'string', maxLength: 200 }, glob: { type: 'string', maxLength: 200 } } },
    handler: async ({ query, glob: g = '' }) => {
      const hits = [];
      const walk = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          if (e.name.startsWith('.') || e.name === 'node_modules') continue;
          const full = path.join(dir, e.name);
          if (e.isDirectory()) walk(full);
          else if (e.isFile() && (!g || full.includes(g)) && fs.statSync(full).size < 1_000_000) {
            fs.readFileSync(full, 'utf8').split('\n').forEach((line, i) => {
              if (hits.length < 100 && line.toLowerCase().includes(String(query).toLowerCase()))
                hits.push(`${path.relative(root, full)}:${i + 1}: ${line.trim().slice(0, 200)}`);
            });
          }
        }
      };
      walk(root);
      return hits.join('\n') || 'no matches';
    },
  });

  // ── write (mutating) ────────────────────────────────────────────────────
  define({
    name: 'fs.write',
    mutating: true,
    description: 'Create or overwrite a text file inside the workspace. Requires human approval.',
    parameters: { type: 'object', required: ['path', 'content'], properties: { path: { type: 'string', maxLength: 500 }, content: { type: 'string', maxLength: 200000 } } },
    handler: async ({ path: p, content }) => {
      const abs = safeJoin(root, p);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      const existed = fs.existsSync(abs);
      fs.writeFileSync(abs, content);
      return `${existed ? 'overwrote' : 'created'} ${p} (${Buffer.byteLength(content)} bytes)`;
    },
  });

  // ── network (allowlisted) ───────────────────────────────────────────────
  define({
    name: 'http.get',
    description: 'GET a URL and return the body as text. Host must be on the allowlist.',
    parameters: { type: 'object', required: ['url'], properties: { url: { type: 'string', maxLength: 2000, pattern: '^https?://' } } },
    handler: async ({ url }) => {
      const host = new URL(url).hostname;
      if (!httpAllow.includes(host)) throw new ToolError(`host not allowlisted: ${host} (set DEVICE_AGENT_HTTP_ALLOW)`, 'egress_denied');
      const res = await fetchImpl(url, { redirect: 'follow', headers: { 'user-agent': 'device-agent/0.1' } });
      return `HTTP ${res.status}\n${truncate(await res.text(), maxBytes)}`;
    },
  });

  // ── shell (off by default, argv only, never a shell string) ─────────────
  define({
    name: 'shell.exec',
    mutating: true,
    description: 'Run a program with an argv array. No shell interpolation. Disabled unless DEVICE_AGENT_ALLOW_SHELL=true.',
    parameters: { type: 'object', required: ['cmd'], properties: { cmd: { type: 'string', maxLength: 200 }, args: { type: 'array' }, cwd: { type: 'string', maxLength: 500 } } },
    handler: async ({ cmd, args = [], cwd = '.' }) => {
      if (!allowShell) throw new ToolError('shell execution is disabled (DEVICE_AGENT_ALLOW_SHELL=false)', 'shell_disabled');
      if (!/^[a-z0-9_.+-]+$/i.test(cmd)) throw new ToolError(`refusing to run ${cmd}`, 'bad_command');
      const abs = safeJoin(root, cwd);
      return await new Promise((resolve, reject) => {
        execFile(cmd, args.map(String), { cwd: abs, timeout: 30_000, maxBuffer: 1_000_000 }, (err, stdout, stderr) => {
          if (err && !stdout && !stderr) return reject(new ToolError(String(err.message), 'exec_failed'));
          resolve(`${stdout}${stderr ? `\n[stderr]\n${stderr}` : ''}`.slice(0, maxBytes) || '(no output)');
        });
      });
    },
  });

  // ── clock ───────────────────────────────────────────────────────────────
  define({
    name: 'time.now',
    description: 'Current local ISO time and timezone. Cheapest way to stop the model guessing dates.',
    parameters: { type: 'object', properties: {} },
    handler: async () => new Date().toISOString(),
  });

  return {
    root,
    list: () => [...tools.values()].map(({ name, description, parameters }) => ({ name, description, parameters })),
    get: (name) => tools.get(name),

    /** The only execution path. Validate → policy → run → audit. */
    async call(name, rawArgs, { principal = 'local', ledger = null, step = 0 } = {}) {
      const tool = tools.get(name);
      if (!tool) {
        ledger?.append('tool_denied', { name, reason: 'unknown tool' }, { principal });
        throw new ToolError(`unknown tool: ${name}`, 'unknown_tool');
      }
      let args;
      try { args = validate(rawArgs, tool.parameters); }
      catch (e) { ledger?.append('tool_denied', { name, reason: e.message }, { principal }); throw e; }

      const decision = autoApprove || !tool.mutating ? { approved: true, how: autoApprove ? 'auto' : 'read-only' } : await approve({ name, args });
      if (!decision?.approved) {
        ledger?.append('tool_denied', { name, args, reason: 'approval withheld' }, { principal });
        throw new ToolError(`approval withheld for ${name}`, 'not_approved');
      }
      ledger?.append('tool_call', { name, args, step, approvedBy: decision.how ?? 'human' }, { principal });
      const t0 = Date.now();
      try {
        const out = await tool.handler(args);
        ledger?.append('tool_result', { name, step, ms: Date.now() - t0, ok: true }, { principal });
        return out;
      } catch (e) {
        ledger?.append('tool_result', { name, step, ms: Date.now() - t0, ok: false, error: e.message }, { principal });
        throw e;
      }
    },
  };
}
