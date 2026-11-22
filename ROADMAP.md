# Roadmap — with gates, not vibes

Solo-dev estimates at ~10 focused hours/week. Multiply by 0.6 for two people. Each phase
has an exit gate that is a *test you can run*, not a feeling.

---

## v0.1 — runnable core ✅ (this repo)

Loop, ledger, tools, CLI, SSE API, web client, 10 tests, CI green.

**Gate:** `npm test` passes on a clean clone with no network and no install step.

## v0.2 — the phone (3–4 weeks)

The reason this project exists. Two tracks, pick one:

**A. WebView shell + local server (2 weeks).** Capacitor wraps `apps/web`; the Node core
runs under Termux, or is rewritten as a foregound service using `nodejs-mobile`. Fastest
path to a working APK. Downside: two processes, battery, and the user must install Termux.

**B. Native shell, JS core in a WebView (3–4 weeks).** Kotlin app hosts the UI, calls the
core over a loopback socket, implements:
- `android.*` tool namespace: `notifications.list`, `calendar.read`, `screen.dump`,
  `tap(x,y)`, `type(text)`, `open_app(pkg)` — all behind the same approval gate
- Accessibility service with an explicit "agent is acting" overlay
- Keystore-backed ledger (hash chain survives app reinstall via export)

**Gate:** install the APK on a phone you didn't build it on, ask "what's on my calendar
tomorrow", get an answer whose ledger entry shows exactly which calendar rows were read.

## v0.3 — distribution before features (2 weeks)

- F-Droid inclusion (no Play billing, no tracking; this is the credibility channel for
  exactly this audience) — requires fully reproducible build + no proprietary deps
- A 60-second screen recording where the *visible* thing is the receipt, not the prose
- `brew install` / `curl | sh` one-liner for the desktop path

**Gate:** 100 installs from a channel you don't control, and ≥10 issues filed by strangers.

## v0.4 — hosted convenience tier (2 weeks)

Same code, multi-tenant. Metered credit, receipt per run, cap per principal, no auto-renew.

**Gate:** one customer pays once, uses it for a week, and does not ask for a refund.

## v0.5 — MCP client (1–2 weeks)

Tool surface becomes other people's MCP servers. This is what turns a personal agent into
a platform — and it is where the tool-approval design pays off, because every third-party
tool inherits the same deny-by-default gate.

**Gate:** a tool you did not write runs, is approved by the user, and appears in the ledger.

## v1.0 — hardening (4 weeks)

- SQLite ledger with the same hash chain; migration tool
- Per-tenant process isolation (nsjail / bubblewrap) — required before any multi-user SaaS
- Eval harness: 50 canned tasks, pass/fail, cost per pass. This is the only defence against
  silent regressions when you change the system prompt.
- Prompt-injection test suite (tool output containing instructions, redirect attempts)

**Gate:** eval suite ≥ 90% pass, cost per pass documented, injection suite green.

---

## Deliberately out of scope

- A chat UI that competes with ChatGPT. You will lose; don't.
- Fine-tuning. Marginal for this use case; expensive to maintain.
- Agent-to-agent marketplaces. No paying demand yet.
- Anything that requires the user to trust a vendor with their screen recording.