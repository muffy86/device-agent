// Provider router. One interface, five wire formats, zero dependencies.
// Everything normalises to: { text, toolCalls:[{id,name,args}], usage:{in,out} }
//
// Prices below are USD per 1M tokens and are *your* configuration, not truth.
// Verify against a live price table before you bill anyone against them.

export const PRICES = {
  // model                        in      out
  'gpt-4.1-mini':              [0.40,  1.60],
  'gpt-4.1':                   [2.00,  8.00],
  'gemini-2.5-flash':          [0.30,  2.50],
  'gemini-2.5-pro':            [1.25, 10.00],
  'claude-sonnet-4-5':         [3.00, 15.00],
  'claude-haiku-4-5':          [1.00,  5.00],
  'deepseek-chat':             [0.14,  0.28],
  'llama-3.3-70b-versatile':   [0.59,  0.79],
  'mock':                      [0.00,  0.00],
};

export function priceOf(model, usage) {
  const [inp, out] = PRICES[model] || PRICES[String(model).split('/').pop()] || [0, 0];
  return (usage.in / 1e6) * inp + (usage.out / 1e6) * out;
}

const approx = (s) => Math.ceil(String(s || '').length / 4);

// ─────────────────────────────────────────────────────────────── mock (offline)

function mockProvider({ model = 'mock' } = {}) {
  return {
    name: 'mock',
    model,
    supportsTools: true,
    async chat({ messages, tools = [], onDelta }) {
      const last = [...messages].reverse().find((m) => m.role === 'user');
      const toolMsgs = messages.filter((m) => m.role === 'tool');
      const done = messages.filter((m) => m.role === 'assistant').flatMap((m) => m.toolCalls ?? []).map((c) => c.name);
      const prompt = String(last?.content ?? '');
      const wantsLook = /list|what.*(in|repo|folder|here|content)|summar|read|open|show/i.test(prompt);
      const tool = (name) => tools.find((t) => t.name === name);
      const emit = (text) => { if (onDelta) for (const w of text.split(' ')) onDelta(w + ' '); };
      const reply = (text, toolCalls = []) => ({
        text, toolCalls, usage: { in: approx(JSON.stringify(messages)), out: approx(text) },
        stopReason: toolCalls.length ? 'tool_use' : 'end',
      });

      // Step 1: look at the directory rather than guessing what is in it.
      if (wantsLook && tool('fs.list') && !done.includes('fs.list')) {
        const t = 'Let me look before I answer.';
        emit(t);
        return reply(t, [{ id: 'mock_1', name: 'fs.list', args: { path: '.' } }]);
      }

      // Step 2: read one real file out of the listing.
      if (wantsLook && tool('fs.read') && !done.includes('fs.read')) {
        const listing = toolMsgs.filter((m) => m.toolName === 'fs.list').pop()?.content ?? '';
        const firstFile = /^-\s+(\S+)\s+\(\d+b\)$/m.exec(listing)?.[1];
        if (firstFile) {
          const t = `Reading ${firstFile} for the actual contents.`;
          emit(t);
          return reply(t, [{ id: 'mock_2', name: 'fs.read', args: { path: firstFile } }]);
        }
      }

      // Step 3: answer from the bytes that came back, or say what is missing.
      const seen = toolMsgs.map((m) => String(m.content).slice(0, 600)).join('\n');
      const text = seen
        ? `Here is what is actually on disk:\n\n${seen}\n\nThat is read from your workspace, not described.`
        : `Mock provider. Task received: "${prompt.slice(0, 200)}". Set DEVICE_AGENT_PROVIDER and a key to talk to a real model.`;
      emit(text);
      return reply(text);
    },
  };
}

// ─────────────────────────────────────────────────── openai-compatible (stream)

function openaiProvider({ baseUrl, apiKey, model, extraHeaders = {} }) {
  const url = baseUrl.replace(/\/$/, '') + '/chat/completions';

  const wireTools = (tools) =>
    tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));

  return {
    name: 'openai',
    model,
    supportsTools: true,
    async chat({ messages, tools = [], onDelta }) {
      const body = {
        model,
        messages: toOpenAIMessages(messages),
        stream: Boolean(onDelta),
      };
      if (tools.length) {
        body.tools = wireTools(tools);
        body.tool_choice = 'auto';
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}), ...extraHeaders },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${res.status} from provider: ${(await res.text()).slice(0, 500)}`);

      if (!onDelta) {
        const j = await res.json();
        const m = j.choices?.[0]?.message ?? {};
        return {
          text: m.content ?? '',
          toolCalls: (m.tool_calls ?? []).map((c) => ({
            id: c.id,
            name: c.function?.name,
            args: safeJSON(c.function?.arguments),
          })),
          usage: { in: j.usage?.prompt_tokens ?? 0, out: j.usage?.completion_tokens ?? 0 },
          stopReason: j.choices?.[0]?.finish_reason ?? 'end',
        };
      }

      // SSE accumulation. Text deltas go straight out; tool calls arrive in
      // fragments keyed by index and must be stitched back together.
      let text = '';
      const calls = new Map();
      let usage = { in: 0, out: 0 };
      let stopReason = 'end';
      for await (const evt of sse(res.body)) {
        if (evt === '[DONE]') break;
        let j;
        try { j = JSON.parse(evt); } catch { continue; }
        if (j.usage) usage = { in: j.usage.prompt_tokens ?? 0, out: j.usage.completion_tokens ?? 0 };
        const d = j.choices?.[0];
        if (!d) continue;
        stopReason = d.finish_reason ?? stopReason;
        const delta = d.delta ?? {};
        if (delta.content) { text += delta.content; onDelta(delta.content); }
        for (const tc of delta.tool_calls ?? []) {
          const slot = calls.get(tc.index ?? 0) ?? { id: '', name: '', args: '' };
          if (tc.id) slot.id = tc.id;
          if (tc.function?.name) slot.name = tc.function.name;
          if (tc.function?.arguments) slot.args += tc.function.arguments;
          calls.set(tc.index ?? 0, slot);
        }
      }
      if (!usage.in && !usage.out) usage = { in: approx(JSON.stringify(messages)), out: approx(text) };
      return {
        text,
        toolCalls: [...calls.values()].filter((c) => c.name).map((c) => ({ id: c.id || c.name, name: c.name, args: safeJSON(c.args) })),
        usage,
        stopReason,
      };
    },
  };
}

// ──────────────────────────────────────────────────────────────── anthropic

function anthropicProvider({ apiKey, model, baseUrl = 'https://api.anthropic.com/v1' }) {
  return {
    name: 'anthropic',
    model,
    supportsTools: true,
    async chat({ messages, tools = [] }) {
      const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
      const body = {
        model,
        max_tokens: 4096,
        messages: toAnthropicMessages(messages),
        ...(system ? { system } : {}),
        ...(tools.length
          ? { tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })) }
          : {}),
      };
      const res = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${res.status} from anthropic: ${(await res.text()).slice(0, 500)}`);
      const j = await res.json();
      const blocks = j.content ?? [];
      return {
        text: blocks.filter((b) => b.type === 'text').map((b) => b.text).join(''),
        toolCalls: blocks.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, name: b.name, args: b.input ?? {} })),
        usage: { in: j.usage?.input_tokens ?? 0, out: j.usage?.output_tokens ?? 0 },
        stopReason: j.stop_reason ?? 'end',
      };
    },
  };
}

// ────────────────────────────────────────────────────────────────── google

function googleProvider({ apiKey, model, baseUrl = 'https://generativelanguage.googleapis.com/v1beta' }) {
  return {
    name: 'google',
    model,
    supportsTools: true,
    async chat({ messages, tools = [] }) {
      const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
      const body = {
        contents: toGoogleContents(messages),
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        ...(tools.length
          ? { tools: [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }] }
          : {}),
      };
      const res = await fetch(`${baseUrl}/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${res.status} from google: ${(await res.text()).slice(0, 500)}`);
      const j = await res.json();
      const parts = j.candidates?.[0]?.content?.parts ?? [];
      return {
        text: parts.filter((p) => p.text).map((p) => p.text).join(''),
        toolCalls: parts
          .filter((p) => p.functionCall)
          .map((p, i) => ({ id: `g_${i}_${p.functionCall.name}`, name: p.functionCall.name, args: p.functionCall.args ?? {} })),
        usage: { in: j.usageMetadata?.promptTokenCount ?? 0, out: j.usageMetadata?.candidatesTokenCount ?? 0 },
        stopReason: 'end',
      };
    },
  };
}

// ─────────────────────────────────────────────────────────────── factory

export function createProvider(env = process.env) {
  const want = (env.DEVICE_AGENT_PROVIDER || '').toLowerCase();
  const has = (...k) => k.some((x) => env[x]);

  if (want === 'anthropic' || (!want && has('ANTHROPIC_API_KEY') && !has('OPENAI_API_KEY', 'GOOGLE_API_KEY')))
    return anthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.DEVICE_AGENT_MODEL || 'claude-haiku-4-5' });
  if (want === 'google' || (!want && has('GOOGLE_API_KEY')))
    return googleProvider({ apiKey: env.GOOGLE_API_KEY, model: env.DEVICE_AGENT_MODEL || 'gemini-2.5-flash' });
  if (want === 'openai' || (has('OPENAI_API_KEY') && has('DEVICE_AGENT_MODEL')))
    return openaiProvider({
      baseUrl: env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      apiKey: env.OPENAI_API_KEY,
      model: env.DEVICE_AGENT_MODEL || 'gpt-4.1-mini',
    });
  // Free/local path: point OPENAI_BASE_URL at Ollama and leave the key blank.
  if (!want && env.OPENAI_BASE_URL && /localhost|127\.0\.0\.1/.test(env.OPENAI_BASE_URL))
    return openaiProvider({ baseUrl: env.OPENAI_BASE_URL, apiKey: '', model: env.DEVICE_AGENT_MODEL || 'llama3.1' });
  return mockProvider({ model: env.DEVICE_AGENT_MODEL || 'mock' });
}

// ─────────────────────────────────────────────────────────── wire helpers

function safeJSON(s) {
  if (s == null || s === '') return {};
  if (typeof s === 'object') return s;
  try { return JSON.parse(s); } catch { return { _raw: String(s).slice(0, 2000) }; }
}

function toOpenAIMessages(messages) {
  return messages.map((m) =>
    m.role === 'tool'
      ? { role: 'tool', tool_call_id: m.toolCallId, content: m.content }
      : m.role === 'assistant' && m.toolCalls?.length
        ? { role: 'assistant', content: m.content || null, tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args ?? {}) } })) }
        : { role: m.role, content: m.content });
}

function toAnthropicMessages(messages) {
  const out = [];
  for (const m of messages) {
    if (m.role === 'system') continue;
    if (m.role === 'tool') {
      out.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: m.toolCallId, content: String(m.content).slice(0, 100000) }] });
    } else if (m.role === 'assistant' && m.toolCalls?.length) {
      out.push({
        role: 'assistant',
        content: [
          ...(m.content ? [{ type: 'text', text: m.content }] : []),
          ...m.toolCalls.map((c) => ({ type: 'tool_use', id: c.id, name: c.name, input: c.args ?? {} })),
        ],
      });
    } else {
      out.push({ role: m.role, content: m.content });
    }
  }
  return out;
}

function toGoogleContents(messages) {
  const out = [];
  for (const m of messages) {
    if (m.role === 'system') continue;
    if (m.role === 'tool') {
      out.push({ role: 'user', parts: [{ functionResponse: { name: m.toolName || 'tool', response: { result: String(m.content).slice(0, 100000) } } }] });
    } else if (m.role === 'assistant' && m.toolCalls?.length) {
      out.push({
        role: 'model',
        parts: [
          ...(m.content ? [{ text: m.content }] : []),
          ...m.toolCalls.map((c) => ({ functionCall: { name: c.name, args: c.args ?? {} } })),
        ],
      });
    } else {
      out.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content) }] });
    }
  }
  return out;
}

export async function* sse(body) {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line || line.startsWith(':')) continue;
      if (line.startsWith('data:')) yield line.slice(5).trim();
    }
  }
  if (buf.trim().startsWith('data:')) yield buf.trim().slice(5).trim();
}
