# Launch — what actually gets a repo starred

GitHub Trending is an engagement-rate signal over roughly a 24–48 hour window, weighted
toward stars-per-hour for repos that are new to the viewer. It rewards one thing: a large
number of people deciding in under 10 seconds that this repo is *about them*.

That decision is made from four pixels of information: **name, one-line description, first
image, first code block.** Not from your architecture.

## The launch asset checklist

- [ ] **A name that is a sentence.** `device-agent` works ("the agent that runs on your
      phone" is implied). `aether-core-framework` does not.
- [ ] **A one-liner under 120 chars** that names the incumbent and the difference:
      *"The open-source agent that runs on your phone. Your keys, your memory, a receipt
      for every step."*
- [ ] **A demo that runs in 60 seconds with no API key.** You have this — `npm run demo`
      is fully offline. This is the single biggest conversion factor: people will not get a
      key to evaluate a repo.
- [ ] **A GIF above the fold**, 8–12 seconds, showing the *receipt* appearing, not the prose
      streaming. The receipt is the differentiator; prose is a commodity.
- [ ] **A comparison table** with the 3–4 projects people already know. Table format,
      honest, and link to them. Do not disparage; differentiate on one axis.
- [ ] **Limitations section.** Counter-intuitively this increases stars: it tells
      experienced engineers that you're not overclaiming, and they are the ones who star.
- [ ] **A licence file that isn't a surprise.** Apache-2.0 or MIT. AGPL kills the corporate
      star and the corporate contribution simultaneously.

## Launch-day choreography

Do it once, do it well, do not relaunch weekly (that burns goodwill you can't get back).

| Time (UTC) | Action |
|---|---|
| T-7 days | Repo public with README *unfinished*. Silence. This gives the algo a baseline and lets you fix the obvious issues before eyes arrive. |
| T-2 days | Post in one small community (r/selfhosted or r/LocalLLaMA) asking for feedback, not stars. Fix what breaks. |
| T-0, 13:00–15:00 UTC | Show HN: `Show HN: An open-source agent that runs on your phone and logs every step`. Tuesday–Thursday. First comment is yours, and it contains the honest limitations + the 60-second demo. |
| T-0 +30 min | Post the same demo GIF to X/Bluesky with the comparison table as an image. Link, don't thread. |
| T-0 +2 h | r/selfhosted + one Discord you're actually in. Never the same text twice; never a bot. |
| T-0 → T+48 h | **Reply to every issue and comment within 2 hours.** Comment velocity is a ranking input on HN, and issue response rate is what converts a visitor into a stargazer. |
| T+3 days | Publish the "what I got wrong in the first 48 hours" post. Second wave, and it converts the people who were on the fence. |

## Realistic outcome distribution

Be honest with yourself about the base rate. For a repo with no prior audience:

- **Median outcome:** 20–80 stars. That is not failure, it is the base rate.
- **Good outcome:** 300–800 stars from one channel picking it up.
- **"Trending" outcome:** 2k+ in a month — requires either an existing audience of ~10k
  (X, newsletter, or a prior popular repo) or a genuinely novel hook plus one lucky
  amplification.
- **"Most starred of the month"** is typically 5k–20k stars and is won by repos that hit a
  nerve: a *category* that didn't exist, a price that collapses, or a hot runtime. Your
  nerve is **"the agent runs on the hardware you already own"** — that is a real one, and it
  is the only framing worth spending the launch on.

Strategy implication: **stars are a distribution artifact, not a code-quality signal.** The
way to get them is to make one true claim land, not to add features. If the first launch
gets 40 stars, the correct response is to fix the README and the demo, not the code.

## The 90-day ladder after launch

1. **Week 1** — merge every contributor PR that is not wrong. Add them to README
   contributors by hand. The first 10 outside contributors decide whether this is a
   project or a repo.
2. **Week 2** — ship the thing the issues are asking for, in public, with the issue number
   in the commit. This builds the "they actually listen" reputation that compounds.
3. **Week 4** — publish a `good first issue` set of 8–10 items, each with a file path and
   an acceptance test. This is the single highest-leverage act for star-to-contributor
   conversion.
4. **Week 6** — write the post that compares your approach to the three incumbents, with
   benchmarks you ran yourself. This is what gets linked months later.
5. **Week 12** — release v0.2 with the APK. "Install it from F-Droid" is a distribution
   event that no README can produce.

## What will not work

- Paid star campaigns, star-exchange Discords, "please star my repo" in unrelated threads.
  Detectable, and it poisons the only signal that matters.
- Launching the same repo repeatedly. The second attempt reliably underperforms the first.
- Claiming "production-ready" before anyone has installed it. The issues that follow are
  worse than the stars you didn't get.