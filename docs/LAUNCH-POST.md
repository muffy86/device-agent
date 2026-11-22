# Launch copy — paste-ready

Everything below is written to be copied, not adapted. Replace nothing except the repo URL.

---

## Repo metadata

**Name:** `device-agent`
**Description (120 char max):**
```
The agent that runs on your own hardware. Hash-chained receipts for every step, hard budget caps, deny-by-default tools.
```
**Topics:**
```
ai-agent  android  on-device  self-hosted  llm  mcp  privacy  accessibility  local-first  agents
```

---

## Show HN

**Title:**
```
Show HN: An open-source agent that runs on your phone and logs every step
```

**Body (first comment, posted by you immediately):**

```
Author here. Three things I got tired of, and what this does about them.

1. Chat wrappers that call themselves agents do not tell you what they read or
   what they spent. So you cannot tell whether the answer came from your files
   or from the model's priors. Here every run writes an append-only, hash-chained
   ledger: run_start, tool_call, tool_result, cost, run_end. `--verify` recomputes
   the chain and tells you which line was edited if anything was.

2. Cost arrives after the fact. Here the budget cap is checked *before* every
   provider call. At the cap the agent exits. It does not ask you for more.

3. Tools that can change your filesystem default to denied. The approval prompt
   shows the literal JSON arguments, and a refusal is recorded as `tool_denied`
   rather than silently swallowed.

It is ~1,250 lines of zero-dependency JS. The loop itself is ~200 lines — that is
the whole "agent" everyone is selling; the interesting part is the ledger, the
sandbox, and the Android shell (accessibility tools, opt-in mutations, files in
the repo, builds in CI).

Try it with no key and no network:

    git clone <url> && cd device-agent
    npm test        # 10 tests, no install step
    npm run demo    # full loop against an offline mock provider

Honest limitations, because you will find them otherwise: tool-call streaming is
implemented for the OpenAI-compatible path only; the ledger is JSONL and wants
SQLite past ~1M events; there is no multi-tenant isolation yet, so do not run
this as a shared SaaS; prompt injection is mitigated (no shell strings, egress
allowlist, deny-by-default mutations) not solved. The Android Kotlin is written
but has not been compiled on a physical device — CI is the first compiler.

Happy to answer anything about the chain format or the sandbox.
```

---

## Reddit — r/selfhosted

**Title:**
```
I built a self-hosted agent with a tamper-evident ledger (every tool call, cost, and refusal is recorded)
```

**Body:**
```
Most "agent" projects are a chat box plus tools. I wanted the opposite: something
that can be audited *after* it acts.

- append-only hash-chained log: events.jsonl, one line per step
- `--verify` recomputes the chain; forge a cost figure and it tells you which line
- hard USD cap checked before inference, not reported after
- deny-by-default mutations; the approval prompt shows the literal arguments
- memory writes require provenance ([V]/[R]/[U]); [V] requires a source
- runs offline with a bundled mock provider, so it evaluates in 60 seconds
- Docker compose, zero-dependency Node, Apache-2.0

The part I'd most like feedback on is the sandbox: argv-only shell that is off by
default, egress allowlist, symlink-safe path confinement. If you can get out of
`DEVICE_AGENT_ROOT`, that's a bug and I want it filed.

[repo link]
```

---

## X / Bluesky (single post, no thread)

```
Your agent should leave a receipt.

device-agent: runs on your own hardware, writes every tool call, token and
refusal to a hash-chained log, and stops at the budget cap instead of asking
for more.

1,250 lines. Zero dependencies. Apache-2.0.

[repo link]
[attach docs/demo.gif]
```

---

## dev.to / blog post (the week-3 follow-up)

Title: **What I learned making an agent's actions provable instead of plausible**

Structure that works:

1. The bug that taught me the most: I hashed the top-level record with a key-sorted
   serializer, which silently dropped nested payload keys — so tampering with a cost figure
   was undetectable. Fix: sort keys at every depth. (Real, from this repo; the test that
   forges a cost line is `tests/ledger.test.js`.)
2. Why a refusal is a product feature: `tool_denied` in the ledger is why a user will let an
   agent near their calendar.
3. Why `[V]` memory requires a source: unchecked memory turns one bad conclusion into a
   permanent premise.
4. What the receipt costs: ~40 lines. What it buys: the ability to prove you did the thing.
5. The limits: JSONL vs SQLite, single-tenant, injection.

---

## Launch-day checklist

- [ ] Repo public, description and topics set, social preview image = `docs/demo.png`
- [ ] `docs/demo.gif` embedded in README above the fold
- [ ] `good first issue` labels on the ten items in `docs/GOOD-FIRST-ISSUES.md`
- [ ] Issue templates present so bug reports arrive structured
- [ ] Post Show HN 13:00–15:00 UTC, Tuesday–Thursday
- [ ] First comment posted within 60 seconds of the submission
- [ ] Every reply answered inside 2 hours for the first 48
- [ ] Tag `v0.1.0` and attach the CLI-only tarball (no APK yet — don't over-promise)