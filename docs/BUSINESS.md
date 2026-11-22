# Business — the real unit economics, and the version that gets shut down

Written plainly, because the honest numbers are more useful to you than the pitch deck.

## 1. Why "one more iteration" feels like progress

Not a conspiracy. Four mechanical causes:

1. **Every generation is a sample.** Same prompt, different output. If 1 in 5 attempts is
   good, the loop feels like convergence because you remember the hits. Same reinforcement
   schedule as a slot machine, produced by sampling temperature rather than intent.
2. **Fluency is decoupled from correctness.** The model sounds equally certain when it is
   right and when it is inventing. So the failure is invisible until you test — and testing
   is the part you were hoping to skip.
3. **Each retry is cheap in effort.** No setup cost per attempt means the sunk cost never
   becomes visible, so stopping always feels premature.
4. **Memory resets.** If the agent doesn't carry state, the progress you thought you banked
   was never banked. That alone manufactures "we're almost there" indefinitely.

The product implication is not "make it more addictive." It is: **if you fix 2 and 4, people
stay for a reason that survives their own scrutiny.** That's the retention that doesn't
collapse when a cheaper competitor appears.

## 2. Why the manipulation playbook is a bad trade in 2026

Not a moral argument — a risk-adjusted return argument.

- **Regulatory.** The FTC's "click-to-cancel" rule was vacated by the Eighth Circuit in July
  2025, but ROSCA still requires clear disclosure of recurring charges and express informed
  consent, and it still applies to online subscriptions [cite:311c0c][cite:b2d3d3]. The FTC
  continues enforcement under ROSCA and the FTC Act [cite:f2f8b4]. "Hard to cancel, easy to
  buy, opaque usage" is the exact fact pattern that gets action.
- **Platform.** Google Play explicitly disallows apps that "subject users to deceptive or
  manipulative purchase experiences (including in-app purchases or subscriptions)" and bans
  requiring an auto-renewing subscription to deliver a one-time benefit [cite:cae8fe][cite:2d7da1].
  One policy strike takes the distribution channel, which is the actual asset.
- **Retention math.** Deception-based retention has a churn cliff, not a curve. Cohort
  revenue decays faster the moment the user reads their statement. Value-based retention
  decays slower because the switching cost is a real asset (their ledger, their memory,
  their integrations) rather than a sunk cost they resent.
- **Defensibility.** A dark pattern is copyable in a week and has no moat. A verifiable
  receipt trail plus a device-resident tool surface takes months and compounds.

You said you want to "profit off it." The shortest route to profit is the boring one:
charge for something the customer can point at.

## 3. The actual cost structure

Published rates, per 1M tokens, as of late 2025 — verify before billing against them:

| Tier | Example | Input | Output |
|---|---|---|---|
| Cheap/fast | Llama 3.1 8B on Groq | $0.05 | $0.08 |
| Mid | GPT-4.1 Mini | $0.40 | $1.60 |
| Frontier | Claude Sonnet-class | $3.00 | $15.00 |

Sources: live price tables [cite:1aa969][cite:3f0ea3][cite:4eb9e7].

A realistic agent turn — 8k input (system prompt + tool schemas + two tool results),
1.5k output:

| Model tier | Cost per turn | Turns per $20 of gross revenue at 2.5× markup |
|---|---|---|
| Cheap | ~$0.0005 | ~16,000 |
| Mid | ~$0.0056 | ~1,400 |
| Frontier | ~$0.0465 | ~170 |

**This is why subscriptions feel thin to heavy users and generous to light ones.** A flat
$20 plan is a bet that most users are light. When one heavy user costs $30 in tokens, the
light users subsidise them. That is not theft — it's a badly-hedged flat fee. The fix is
metered credit with a visible receipt, which is what this repo does.

**Do not** build a flat-fee plan around a frontier model and a power-user audience. That is
the specific mistake that produces the "never enough, always another payment" experience
you described.

## 4. Three viable models for this repo

| Model | Price | Who pays | Why it works | Risk |
|---|---|---|---|---|
| **Free core + paid convenience host** | $0 self-host; $5–15/mo hosted | people who don't want to run Node | the code is the marketing; hosting is the product | you must actually operate infra |
| **Metered credit** | $10 = $10 of tokens at 2.5× (~$4 of inference) | everyone, honestly | receipt per run justifies the markup | low ARPU; needs volume |
| **Device licence / one-time** | $19 one-time per platform | privacy-motivated users | no recurring billing to defend; fits F-Droid ethos | no recurring revenue |

Recommended: **free core + metered hosted credit**. It makes the receipt the sales pitch,
and it means your revenue is proportional to the value you actually delivered.

## 5. What to measure (and what to refuse to measure)

Measure: cost per completed task, tasks per active day, 30-day retention of users who
completed ≥3 real tasks in week 1, refund rate, issue response time.

Refuse to measure: session length, prompts per day, "engagement". Those are the metrics
that reward the loop you complained about. If your dashboard can only go up when your users
get less, you've built the thing you're trying to escape.

## 6. Cost of running the business, roughly

| Item | Monthly |
|---|---|
| Hosted inference for 50 active users (~$3 each) | ~$150 |
| VPS / Fly.io for the API + Postgres | $20–60 |
| Domain + email | $5 |
| Apple Developer (if iOS) | $8.25 |
| Play Console (one-time $25) | ~$0 |
| **Total** | **~$180–250** |

Break-even at $10/mo metered credit: ~20–25 paying users. That is an achievable number for
a solo developer with a real artifact, and it is unreachable for a product whose value
users only believe in until they check their card statement.