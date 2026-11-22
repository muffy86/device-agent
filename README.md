<div align="center">

# device-agent

**The agent that runs on your own hardware, keeps a receipt, and cannot bill you for work it did not do.**

`0 dependencies` · `~1,200 lines` · `runs on a phone` · `Apache-2.0`

</div>

---

Most agents are a text box with a model behind it. You cannot see what it read, what it
spent, or whether the answer came from your files or from the model's imagination. So you
try again. And again.

This is the other shape: **a loop, a ledger, and a set of tools that are allowed to say no.**

```console
$ node apps/cli/index.js "what is in this repo"
provider=mock model=mock cap=$1
Let me look before I answer.
  ✓ fs.list → - package.json (782b)
Reading package.json for the actual contents.
  ✓ fs.read → { "name": "device-agent" ... }
Here is what is actually on disk: …

— 3 step(s), 1081+213 tokens, $0.0000, 0.0s
  ledger: ./.data/events.jsonl  head 5dd4725f3206…  (verify: --verify)
```

Three properties, and they are the whole product:

| | |
|---|---|
| **It runs where your data is** | Filesystem, shell, HTTP and (via the Android bridge) screen and taps. No upload of your working set to a vendor to be re-sold as "context". |
| **Every step is on a hash chain** | Read the run back line by line. Edit one byte of history and `--verify` tells you which line and why. |
| **Cost is metered before it is spent** | A hard USD cap per principal. The agent stops at the cap. It does not ask for more. |

## Quickstart — 30 seconds, no key, no account

```bash
git clone <this repo> device-agent && cd device-agent
npm test                 # 10 tests, no install step, no network
npm run demo             # full agent loop against the offline mock provider
npm run serve            # http://127.0.0.1:8787 with the web client
```

Real models:

```bash
cp .env.example .env
# then either: DEVICE_AGENT_PROVIDER=mock      (offline, free)
#              DEVICE_AGENT_PROVIDER=openai    + OPENAI_API_KEY + DEVICE_AGENT_MODEL
#              DEVICE_AGENT_PROVIDER=anthropic + ANTHROPIC_API_KEY
#              DEVICE_AGENT_PROVIDER=google    + GOOGLE_API_KEY
# or free/local: OPENAI_BASE_URL=http://127.0.0.1:11434/v1   (Ollama, no key)
```

Any OpenAI-compatible endpoint works: OpenAI, Groq, OpenRouter, DeepSeek, Together,
Cerebras, llama.cpp, vLLM, LM Studio. The router normalises five wire formats into one
interface, so switching cost is an env var.

## What it actually is, in seven files

```
packages/core/src/providers.js   5 wire formats → {text, toolCalls, usage}. Streaming SSE parser.
packages/core/src/tools.js       sandbox, argv-not-string shell, egress allowlist, approval gate
packages/core/src/ledger.js      hash-chained events + provenance-tagged memory + USD cap
packages/core/src/agent.js       the loop (≈200 lines) — tool use, budget check before every call
apps/cli/index.js                terminal client with interactive approval
apps/server/index.js             SSE API, bearer auth, rate limit, usage endpoint, Stripe webhook
apps/web/index.html              single-file client, streams deltas and tool cards live
```

That is the entire agent. Everything else in this category is these seven files plus
distribution, a database, and a billing page.

### The ledger is the part competitors cannot copy without changing their story

```
seq 0  run_start     {task, provider, model, budgetUsd}
seq 1  tool_call     {name:"fs.read", args:{path:"README.md"}, approvedBy:"human"}
seq 2  tool_result   {name:"fs.read", ok:true, ms:3}
seq 3  cost          {usd:0.00041, tokens:{in:1081,out:213}, model:"gpt-4.1-mini"}
seq 4  run_end       {steps:3, usd:0.00041, ms:812}
       hash = sha256(prev_hash + canonical(record))
```

Audit it, export it, sell against it, hand it to a compliance reviewer. An agent that
reports what it spent and what it read can be trusted with more; one that only reports
prose cannot be trusted with anything. That is the compounding advantage, and it is
honest.

### Memory refuses to lie

```js
ledger.remember({ key:'venue', value:'Kraken', provenance:PROVENANCE.VERIFIED, source:'statement 2026-11-21' })
// throws without a source — "[V] memory needs a source"
```

`[V]` verified / `[R]` reported / `[U]` unverified inference. Corrections are new events
that supersede old ones; history is never rewritten. An agent with unchecked memory is a
machine for making one bad conclusion permanent.

## Safety posture (this drives an actual filesystem)

- **Root confinement.** `safeJoin()` resolves the deepest existing ancestor, so symlinks
  cannot climb out. Tested in CI against `../../etc/passwd`.
- **Mutating tools require a human.** `fs.write` and `shell.exec` default to *denied*.
  The user sees the exact arguments before approving; refusals are logged as `tool_denied`.
- **No shell strings.** `shell.exec` takes an argv array, is off unless
  `DEVICE_AGENT_ALLOW_SHELL=true`, and never interpolates.
- **No egress without an allowlist.** `http.get` refuses any host not named in
  `DEVICE_AGENT_HTTP_ALLOW`.
- **Auth on every route.** Bearer token compared in constant time; the principal id is a
  hash of the token, so ledger entries never contain credential material.
- **Per-principal token bucket** so one runaway loop cannot spend a month in an afternoon.

## Honest limitations

Say these out loud before anyone stars it:

- Tool-call streaming is implemented for the OpenAI-compatible path; Anthropic and Google
  return whole blocks. Deltas for those are a weekend of work, not a shipped feature.
- No database. The ledger is append-only JSONL, which is fine to ~10⁶ events and wrong
  beyond that. SQLite is the next step, not a rewrite.
- No multi-tenant isolation beyond `principal` string partitioning. **Do not** run this as
  a shared SaaS for strangers without process/jail isolation per tenant.
- Android screen control is not in this repo yet. It is the `android/` module in
  [`docs/ANDROID.md`](docs/ANDROID.md) — accessibility service, approval prompt, and the
  same ledger underneath.
- Prompt injection is mitigated (no shell, egress allowlist, approval gate), not solved.
  Treat any tool output as adversarial input.

## Where this goes next

`ROADMAP.md` has the phase gates and the week counts. Short version:

1. **v0.1** — this repo. Loop + ledger + CLI + API. Done.
2. **v0.2** — Android shell (accessibility tools, on-device approval), F-Droid release.
3. **v0.3** — hosted convenience tier: same code, `$5` of metered credit, receipt per run.
4. **v0.4** — MCP client so the tool surface is other people's servers, not yours.

## Why this shape and not another

The 2026 open-source agent field already has excellent *server-side* platforms —
self-hosted workspaces (Agenticos, Trinity, OpenBot), multi-agent runtimes (swarmclaw),
and library-level foundations (OpenAI Agents SDK, Pydantic AI, LangGraph) [cite:746b3b][cite:d95851][cite:6bc991][cite:fc7c9d][cite:1e6af4]. Almost all of them assume a
server or a company laptop. The phone — the one computer people actually carry, with the
camera, the notifications, the calendar, and the accessibility tree — is still mostly
occupied by closed apps that read your screen and post to somebody's inference bill.

That gap is the reason to build this one. Not because the loop is hard (it isn't, it's
200 lines) but because **on-device execution plus a verifiable receipt is a genuinely
different product**, and it is the only version of this category that can be trusted with
the device.

## Licence

Apache-2.0. Fork it, rebrand it, sell it. The name and logo are not included — ship under
your own.