# Derived Defaults — gaps filled from the ratified lattice

Owner directive (2026-07-11): "figure out what the numbers should be
according to the other numbers we use… fill in the gaps for now so we
can fully test." Every number below is DERIVED from ratified anchors —
never invented free-hand — and remains a rail: poll-adjustable, and all
of it expires at the Phase 9 real-money re-review like the rest of the
v0 test schedule.

## Strike penalties (Gratium)

The ratified symmetry principle (DISCUSSIONS §7) prices BOTH sides of
bad faith: a bad-faith flagger forfeits the **5u** flag deposit. So:

- **Strike 1 = 5 uG** — rule-breaking stings exactly as much as
  flagging-as-censorship does; the two halves of the symmetry carry the
  same weight. It also more than funds the routine case that judged it
  (1 moderator × 3 uG), so penalties finance their own adjudication.
- **Strike 2 = 15 uG** — the ratified "serious consequence" magnitude
  (= the paid-permanence fee; a 3× lattice step, matching the
  schedule's tier jumps). It covers a heavy 3-moderator case
  (3 × 3 uG) with margin to the treasury.

## Light Score deductions (points, × severity tier)

Anchored to the v2 engine this platform ports at Phase 7 (declared
reuse — `lib/score.ts` weights): a substantive answer = **5 points**;
the per-discussion participation cap = **10 points**.

- **Strike 1 = 5 × tier** — one substantive contribution's worth of
  standing, erased.
- **Strike 2 = 10 × tier** — a full discussion's maximum credit.

Deductions decay on the strike clock (6 months, ratified) — one
redemption curve for both.

## Sentinel brigade threshold

**5 distinct flaggers / 24h.** Five flag deposits = 25u of collective
stake = the appeal-deposit magnitude: when the community has staked "an
appeal's worth" against one item inside one platform day-cycle,
Sentinel bundles it to the Tribunal. 24h is the platform's rhythm unit
(accrual day, digest cadence, rate-limit cycle).

## Timing defaults

- **Rate-limit (strike 2): 24h** = one day-cycle, the same unit as the
  accrual ceiling and digest cadence. (Read-only 7d and badge cooldown
  7d were already ratified.)
- **Poll-closing-soon notification: 6h** = ¼ day-cycle — inside a day,
  outside the noise; recipients already voted, so it can never aid
  sniping.
- **Candle window: 20% of duration** — for the default 72h poll that
  is ~14.4h, sitting between the ratified 12h offer window and the 24h
  cycle: long enough that "camp the deadline" is a real gamble, short
  enough that honest early voters are untouched.
- **Face-switch cooldown: NONE (owner-resolved 2026-07-11).** The
  vision is seamless switching; the parking rule (one face per pillar)
  remains the ratified timing mitigation, and timing-pattern risk stays
  honestly disclosed at the Alias ceremony as the soul's own to manage.
  The mechanism survives as a rail (0–15 min) should governance ever
  vote a pause in.

## Circle rails (Phase 6, 2026-07-11 — same derivation discipline)

- **Small-community warning threshold: 25 members** (CIRCLES OQ6). The
  lattice's serious-stake magnitude — Circle fee, appeal deposit, and
  the verification grant are all 25: when the crowd you're anonymous
  within is thinner than "an appeal's worth" of souls, the Alias
  warning speaks. Place-tagged Circles always warn, regardless of size
  (the spec's own OR).
- **Inactivity auto-label: 90 days** (CIRCLES OQ4) — the spec's own
  first suggestion; = 3 tribunal terms. Derived label, auto-lifting;
  never blocks joining.
- **Light Score credits** (LIGHT_SCORE spec leaves amounts to the
  technical pass; recorded now for Phase 7): **author 5 points** = the
  v2 engine's substantive-answer weight — an attested real-world action
  is worth at least a substantive answer; **attestor 1 point** = the
  anchor unit (one reply's worth of standing; smaller than authoring,
  per the spec's shipped default); **per-circle daily cap 10 points** =
  the v2 per-discussion participation cap, with authored credits
  halving within the day (the §5.1 diminishing-returns requirement).
- **Removal bar default 60%** (CIRCLES OQ2 rail) = the platform's
  consensus example; floor 50% = never below simple majority (spec's
  own bound). **Attestation threshold default 2, bounds [2, 8]**
  (CIRCLES OQ1 rail): floor 2 so "attested" always means more than one
  voice; ceiling 4× the default, the standard bounds policy.

## Phase 7 rails (2026-07-11 — same derivation discipline)

- **Light Score engine weights** (declared v2 reuse, now rails):
  answer **5**, debate reply **1**, per-discussion participation cap
  **10** — the v2 constants verbatim.
- **Accepted-repair credit: 5 points** = the substantive-answer weight
  (an accepted repair to a Picture is at least a substantive answer —
  the same anchor as the Circle author credit).
- **Moderation-service credit: 1 point per case resolved** (the anchor
  unit — deliberately small, LIGHT_SCORE §5.3), **daily cap 10** (the
  participation cap), quality-gated by supervision.
- **Repair consensus bar: 60%** (the platform's consensus example;
  floor 50% — never below simple majority) · **repair poll duration:
  72h** (the platform's default deliberation window).
- **Open-lens weights** (FEED §9.1 defers finals to real data):
  unique contributors **×3** = the v2 insightful-vote weight (quality's
  multiplier, and the "weighted highest" the spec requires), unique
  tippers **×1** and sourced posts **×1** (anchor units), **half-life
  72h** (the deliberation window), activity window 4× half-life.
- **Treasury snapshot cadence: 24h** — owner-ratified daily
  (TREASURY §6.2); held as a rail like everything else.

## Already anchored elsewhere (no action)

Consensus threshold default 60% (the spec's own example) · read-only
7d · offer window 12h · term 48h · pool 5–200 · SLA 48h · reward 3 uG ×
≤2 · tribunal 7/30d/100 uG · appeal deposit 25u · strike decay 6mo.
