# Architecture — what to reuse instead of rebuild

You already own most of this. The shortest path to a shippable asset is not a rewrite; it
is publishing the pieces on this device under one name, with one ledger, and one story.

## Reuse map

| New repo module | Existing asset on disk | Work |
|---|---|---|
| `packages/core` (loop, ledger) | `aether/core` (router, budgets, memory, tools, audit) | Port the ledger's hash chain + provenance tags into the Aether core, or publish the zero-dep version here as the public reference implementation. |
| `android/` device tools | `sovereign-workspace/android-agent-controller` | Wrap its accessibility bindings behind the `android.*` tool namespace with `mutating: true` + approval. |
| tool bus | `sovereign-workspace/mcp-orchestrator` | Already an MCP surface; make it the `v0.5` MCP client/server. |
| audit | `sovereign-workspace/audit-bus` | Merge into `ledger.js` — one chain, one verifier, one CLI (`--verify`). |
| policy / approvals | `wealthos-guardrails` (`approval_os`, `mcp_server`) | This is the grants + decision-record layer the roadmap calls for. It is already the differentiator: `principal → scope → limit → expiry → role`. |
| APK pipeline | `aether/.github/workflows/build-apk.yml` | Reuse the runner recipe (JDK 21, SDK 36, keystore secrets, `assembleRelease`). It is already proven on your own fork. |

**The honest read:** you are ~70% of the way to a publishable asset and 0% of the way to a
published one. The missing 30% is not code — it is a name, a README with a demo row, a
licence, and a release.

## Target topology

```
┌───────────────────────────── phone ─────────────────────────────┐
│  Kotlin shell (WebView UI)                                      │
│     │ loopback ws                                               │
│     ├── core (JS): providers → agent loop → tools               │
│     │        │                                                  │
│     │        ├── android.* tools  (accessibility, notif, cal)   │
│     │        ├── fs.* / shell.*   (confined root, argv only)    │
│     │        └── mcp.*            (stdio → external servers)    │
│     │                                                           │
│     └── ledger: events.jsonl + memory.jsonl (hash-chained)      │
│              └── export → any device, any machine, verifiable    │
└─────────────────────────────────────────────────────────────────┘
              │ optional: hosted tier speaks the same SSE API
              ▼
     server (node) → same core → metered credit → receipt per run
```

Design rules that make the rest of the plan work:

1. **The core must run with zero native code.** If it only runs inside the APK, the web
   tier and the CLI rot, and you lose the "runs anywhere" demo that gets stars.
2. **One ledger, two writers max.** Append-only, one process. Everything else reads.
3. **Tools declare contracts; the policy layer decides.** Adding a tool must never require
   touching the loop. This is what lets MCP servers drop in later.
4. **The receipt is a UI element, not a log line.** Show tokens, cost, tool calls, and the
   chain head after every run. It is the trust story *and* the retention story.
5. **Refusal is a feature.** `tool_denied` in the ledger, rendered as a card, is why a user
   will let this thing near their calendar. A product that never says no is a product
   nobody leaves running.

## Failure modes to design against now

| Failure | Symptom | Fix in this design |
|---|---|---|
| Prompt injection via tool output | agent "decides" to POST your files to an attacker | egress allowlist + mutating-tool approval + no shell strings |
| Silent cost blowup | one loop, $40 bill | cap checked before every provider call; `budget_exceeded` is a normal exit |
| Memory poisoning | one wrong conclusion becomes permanent | `[V]` requires a source; corrections supersede; nothing deletes |
| Context stuffing | every turn re-reads 200KB | `fs.search` returns file:line hits, not whole files; truncation is explicit |
| Approval fatigue | user taps "yes" 40 times, stops reading | batch approvals per run with a diff, cap the number of mutations per task |