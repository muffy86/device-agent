# Three money routes — platforms, real numbers, and a 14-day plan

Routes are ordered by time-to-first-dollar. All three use what is already on disk.
Where a number comes from a vendor's own marketing, it says so.

---

## Route 1 — Get paid to fix other people's agents (days, not months)

**Platform: [Algora](https://algora.io)** — the largest open-source bounty marketplace.
Contributors keep 100% of the bounty; the funder pays a 9% fee on top [cite:c1a048].
Typical visible bounties in 2026 run **$50–$2,500** per merged PR, and aggregates are much
larger: one company distributed over **$143,000** via the platform [cite:47cd33][cite:fbfb7f].

Also: `Scottcjn/awesome-agent-bounties` curates projects paying for code, docs and security
work, listed from **$50 to $50,000+** [cite:db9e74].

**Why this fits you specifically.** You have actual scar tissue: accessibility services,
Shizuku, MCP orchestration, provider routing, a policy/approval layer. Bounties in AI-agent
repos are overwhelmingly "make the tool-calling path work" or "add an eval" — the exact work
you've been doing for free.

**14-day plan**

| Day | Action | Output |
|---|---|---|
| 1 | Sign up, filter bounties by `agent`, `mcp`, `llm`, `eval` | a shortlist of 5 |
| 1 | For each, write one sentence: what file, what test proves it | triage doc |
| 2–4 | Ship the smallest one. Claim it before you start; post progress in the issue | merged PR, first $ |
| 5–7 | Ship two more. Prefer the same repo — repeat contributors get invited | 2 PRs |
| 8–14 | Ask one maintainer, in the issue thread, what they'd pay for next | a paid scope you defined |

**Reality check:** the money is small and slow at first. The value is the *record*: merged
PRs in other people's agent repos are the portfolio that makes route 3 sellable and makes
your own launch credible.

---

## Route 2 — Publish what you built (a week, then compounding)

`device-agent` is committed and tagged. The missing step is `git push` and a launch.

**Deliverables already in the repo:** `docs/LAUNCH-POST.md` (paste-ready), `docs/demo.gif`
(real transcript, not staged), `docs/icon.png`, `docs/GOOD-FIRST-ISSUES.md`,
`tools/push-to-github.sh`.

**What this pays:** not directly. It pays by making routes 1 and 3 legible — a maintainer
with a public repo gets taken seriously in bounty threads, and a consultant with a public
reference implementation gets replies.

**Honest ceiling:** open-source stars convert to money at roughly the rate of a newsletter
list, and only once you have something to sell. Treat the launch as a prerequisite, not an
income stream.

---

## Route 3 — Sell the part nobody wants to build: guardrails and tool-calling evals

**What you own:** `wealthos-guardrails` — a policy/approval layer with
`principal → scope → limit → expiry → role`, decision records, and a redteam suite. Every
company deploying an agent needs exactly this and almost none of them want to write it.

**Who pays:** small teams who have shipped a demo agent and are now scared of it. They have
budget ($2k–$15k engagements), short decision chains (one CTO), and a deadline (a compliance
question, an incident, a client requirement).

**Packaging (one page, three prices):**

| Offer | What they get | Price |
|---|---|---|
| Audit | 2 days: read their agent, produce a written risk register + injection test results | $1,500 flat |
| Gate | 1–2 weeks: instrument tool calls with deny-by-default approvals, budget caps, hash-chained receipts | $6,000 flat |
| Retainer | monthly: eval suite kept green, new injection tests as models change | $800/mo |

**Why the receipt is the sales tool.** Send a prospect your own `--verify` output. It is a
one-command demonstration that you think about accountability, which is the objection every
one of these buyers has.

---

## Side route — MCP servers as metered products

The protocol now has real billing rails: per-call, per-token, per-byte, per-second, tiered,
and outcome-based pricing are all supported by gateways and settlement layers
[cite:f90679][cite:496490]. Vendor blogs quote figures like "$0.01/call → $85/month at
10,000 calls" [cite:54e56c] and "$375/month across 5 servers" [cite:54e56c] — **treat these
as marketing, not measurement**; none of them are audited.

What is structurally true: the buyer is an *agent*, not a human, so pricing must be
machine-parsable and the failure mode is silent over-billing. Which is precisely the problem
`device-agent`'s ledger already solves for the other side of the transaction — and a good
reason to publish the metering half as a reusable package.

**If you do this:** ship one MCP server that wraps something you already own (the guardrails
policy check is the obvious candidate), price it per call, and meter it with the same
`ledger.js`. Two hours of work, a real receipt, a real product.

---

## What not to do

- **Do not** buy more platforms. You have hundreds of tools and one unfinished repo. The
  binding constraint is publication, not inventory.
- **Do not** start a fourth project. `BACKLOG.md` already carries ~20 open loops.
- **Do not** wait for a launch to be perfect. v0.1.0 with an honest limitations section
  outperforms a polished v1.0 that never ships.

## The one-line version

Route 1 pays this week, route 2 makes route 3 possible, route 3 is the actual income.
Do them in that order and nothing else for 14 days.