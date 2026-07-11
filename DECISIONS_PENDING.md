# Decisions Pending — the owner's queue

Non-blocking items awaiting Shawn's attention, oldest first. Nothing
here stops the build; each names what it gates. Blocking questions
never live here — they interrupt directly.

1. **Legal gate check (BUILD_ORDER Phase 4; external track).**
   Internal-only currencies want review-lite, and the non-withdrawable
   Gratium posture should be confirmed with counsel **before any launch
   marketing mentions tokens**. The compliance memo in the corpus
   `Legal/` folder frames it. Gates: launch comms, Phase 9.

2. **Support staking UI (TOKENOMICS "live at launch").** The poll-page
   "attach a PollCoin support target" surface (POLLS §4.8) isn't built
   yet — auto-return at close is the ratified behavior. Needs a small
   design pass. Gates: launch completeness, not any phase.

3. **AI summaries (DISCUSSIONS §5).** Spec grants them "their own
   mini-review" as the first in-house AI surface. Say when.

4. **Declared interests (ONBOARDING Stage 5.5).** Optional per-persona
   interests + one-time +5 G share bonus — not yet built; the grant
   rail exists. Gates: Phase 7 feed/discovery would consume it.

5. **Gap numbers now DERIVED from the ratified lattice (owner
   directive 2026-07-11, "fill in the gaps according to the other
   numbers") — see `DERIVED_DEFAULTS.md` for every derivation:** strike
   penalties 5/15 uG (= flag deposit / permanence-fee magnitudes; the
   §7 symmetry priced equally on both sides), LS deductions 5/10 ×tier
   (= v2 engine's answer weight / participation cap), Sentinel 5
   flags/24h (= an appeal-deposit's worth of collective stake in one
   day-cycle), poll-closing-soon 6h (¼ day-cycle). Still rails; still
   expire at the Phase 9 re-review. One residual judgment call:
   face-switch cooldown stays at the test-friendly 5 min; the
   privacy-grade value would be 15 min (the grace-window unit) —
   suggested for the Phase 8 hardening pass. Supervision cold-start
   interim unchanged (a rule, not a number).

6. **Notification categories awaiting host features:** replies-on-join
   (needs join=follow), governance-poll-opened (needs pillar follow),
   DMs (Phase 6.5). The exhaustive-list law is honored; these activate
   with their features.

7. **Build-time rail defaults set by Claude, owner-adjustable:**
   face-switch cooldown 5 min · pillar session timeout 30 min · alias
   activation 24–72h/daily cohorts (spec-indicative) · candle window
   20% of poll duration · display-name cooldown 7 days · handle charset
   3–30 `[a-z0-9_-]` · consensus threshold = leading option's share of
   counted ballots.
