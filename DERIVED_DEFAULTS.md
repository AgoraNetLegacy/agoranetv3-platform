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
- **Face-switch cooldown: 5 min (test default).** Derived as
  timeout ÷ 6 (pillar session timeout 30 min). The privacy-grade
  setting would be **15 min** — the grace window, the platform's
  ratified "moment of reconsideration" unit — and should be considered
  at the Phase 8 hardening pass; the shorter default keeps dual-face
  testing humane until then.

## Already anchored elsewhere (no action)

Consensus threshold default 60% (the spec's own example) · read-only
7d · offer window 12h · term 48h · pool 5–200 · SLA 48h · reward 3 uG ×
≤2 · tribunal 7/30d/100 uG · appeal deposit 25u · strike decay 6mo.
