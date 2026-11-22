# Research — the landscape, the prices, and what this actually takes

Verified 2026-11-22. Prices and policies move; re-check anything you bill against.

## 1. Who already occupies this space

| Project | Shape | Licence | What it proves | What it leaves open |
|---|---|---|---|---|
| **Agenticos** | self-hosted platform for company AI teammates: shared chat, RAG, skills, real browser, 4,700+ MCP servers, budgets, approvals, audit trail [cite:746b3b] | Apache-2.0 (Pydantic AI) | approvals + budgets + audit is now table stakes, not a differentiator | server-first; no device execution |
| **swarmclaw** | self-hosted multi-agent runtime: durable memory, MCP tools, schedules, delegation, 23+ providers [cite:fc7c9d] | open source | multi-provider routing is solved | no receipt trail; no phone |
| **Trinity** | self-hosted agents for "AI native companies": Claude Code / Codex / Gemini / OpenCode runners, human gates [cite:6bc991] | Apache-2.0 | human gates are a product feature | laptop/server assumption |
| **OpenBot** (CopilotKit) | self-hostable alternative to closed AI bots, any agent/model/tool [cite:d95851] | open | distribution via an existing ecosystem | no ledger, no device |
| **agent-foundation** | library + platform: managed agents, memory, sandboxes, computer use, durable execution [cite:2327ac] | commercial-friendly | durable execution is hard and worth buying | heavy stack |
| **OpenAI Agents SDK / LangGraph / Pydantic AI / CrewAI / n8n** | libraries and graphs [cite:1e6af4][cite:9ec6be] | MIT-ish | you should not write your own router | they are not products |

**The gap:** every one of these assumes a server or a company laptop. The phone — with the
camera, the notifications, the calendar, and an accessibility tree that can drive every
other app — is occupied mostly by closed products that read your screen and send it to
someone else's inference bill. That is the honest, defensible wedge.

**The uncomfortable part:** the loop is ~200 lines, and it is in all of them. Your
differentiation must be the *ledger*, the *device surface*, and the *distribution* — not the
agent loop. Anyone who tells you the loop is the moat is selling you a course.

## 2. Prices (per 1M tokens, USD)

| Tier | Model | In | Out |
|---|---|---|---|
| Cheapest usable | Llama 3.1 8B (Groq) | $0.05 | $0.08 |
| Cheap | Mistral Small 3 | $0.08 | $0.24 |
| Mid | GPT-4.1 Mini | $0.40 | $1.60 |
| Mid | Gemini 2.5 Flash | $0.30 | $2.50 |
| Frontier | Claude Sonnet-class | $3.00 | $15.00 |
| Frontier | GPT-4.1 | $2.00 | $8.00 |
| Reasoning | DeepSeek-class | $0.14 | $0.28 |

Sources: live comparison tables [cite:1aa969][cite:3f0ea3][cite:4eb9e7]; batch pricing roughly
halves input cost on the major labs, which matters if you can defer work [cite:5391ac].

**Implication for your product:** a device agent that runs 30 turns a day on a mid model
costs ~$0.17/user/day at 8k/1.5k per turn. At 2.5× markup, $13/mo. That is a real business
at 50 users and an unworkable one at 5.

## 3. The legal frame (short, and it matters)

- FTC "click-to-cancel" rule: **vacated** in its entirety by the Eighth Circuit, 8 July 2025
  [cite:311a0c]. Compliance deadline had been 14 July 2025 [cite:2d98ac].
- But **ROSCA still applies** to online subscriptions: clear disclosure of recurring charges,
  express informed consent, simple cancellation [cite:b2d3d3][cite:6db1d0]. The FTC has
  signalled continued enforcement under ROSCA and the FTC Act [cite:f2f8b4].
- **Google Play** prohibits apps that subject users to deceptive or manipulative purchase
  experiences, and specifically prohibits requiring an auto-renewing subscription to deliver
  a one-time benefit [cite:cae8fe][cite:2d7da1][cite:e8c6bf].

Practical translation: dark patterns are not a grey area you can arbitrage. They are a
platform-removal risk and an enforcement risk, against a product that has no moat once copied.

## 4. What it honestly takes

| Milestone | Solo effort | Hard part (not the part you'd guess) |
|---|---|---|
| Working loop + CLI | 2–3 days | nothing — it's ~200 lines |
| Ledger with tamper evidence | 2 days | canonical serialisation (the bug I hit: nested payloads must be hashed) |
| Sandbox that survives review | 1 week | symlink escapes, argv vs shell strings, egress |
| Web client that streams well | 3–4 days | SSE edge cases, mobile viewport, approval UX |
| Android shell + accessibility tools | 3–4 weeks | Play policy, overlay UX, battery, foreground service |
| Signed APK pipeline | 2–3 days | keystore discipline, reproducible builds for F-Droid |
| Billing that isn't deceptive | 1 week | capping before inference, receipts, webhook idempotency |
| First 100 real users | 4–8 weeks | distribution, not code |
| **Total to a defensible v1** | **~3–4 months part-time** | |

**The one thing that cannot be compressed:** the first ten strangers who install it and file
bugs. Everything before that is preparation.

## 5. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| accessibility service abused → store removal | medium | explicit consent flow, visible indicator, kill switch, F-Droid first |
| LLM provider raises prices / changes terms | medium | multi-provider router (already in `providers.js`), local-model path |
| a big lab ships the same thing | high | they will not ship a self-hosted, receipt-first, phone-native build; stay on that axis |
| prompt injection via tool output | high | egress allowlist, deny-by-default mutations, no shell strings, injection test suite |
| solo maintainer burnout | high | cap the scope at v1.0; refuse feature requests that aren't in ROADMAP |
| "stars ≠ users" | certain | instrument installs, not stars |

## 6. Reading list

- `Agenta-AI/awesome-ai-agent-platforms` — the honest index of what exists [cite:1e6af4]
- `llm-prices.com`, `llmbenchmark.ai/pricing`, `martllm.com/llm-api-pricing` — live prices
- `modelcontextprotocol.io` — the tool protocol your v0.5 will speak
- F-Droid inclusion policy — read it before you write another feature
- `docs/BUSINESS.md` here — the numbers that decide whether this is a business or a hobby