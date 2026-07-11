# Checkpoint Record

Per the owner-amended methodology (2026-07-11): Claude's verification
gates phase advancement — tests, `db:verify`, the phase demo, a browser
walkthrough, and a spec-conformance pass, all green — and every
checkpoint is recorded here. The owner reviews at his leisure; anything
needing his judgment specifically is flagged to him directly
(blocking) or queued in `DECISIONS_PENDING.md` (non-blocking).

Each entry: what shipped · the evidence · what the owner would judge
if he chose to look.

---

## Phase 0 — Foundation ✅ OWNER-RATIFIED (2026-07-10)

Ledger (append-only, hash-chained, pseudonym-only) · gate
(pending→proof→cleared, Phase A HMAC, per-profile + per-human scopes) ·
canon seed (7×7=49). Evidence: `demo:phase0`, `demo:tamper`, 21 tests.

## Phase 1 — Discussions Core ✅ OWNER-RATIFIED (2026-07-10)

49 canonical permanent threads · gated posting · grace-window edit +
lock (hash-committed; silent edits caught) · labeled sort menu · flag
capture (queue-only, private). Evidence: `demo:phase1`, 32 tests.

## Phase 2 — Dual Identity Complete ✅ OWNER-RATIFIED (2026-07-10)

Onboarding Stages 1–6 · Alias ceremony with every timing mitigation ·
NO stored link between faces (Alias has no humanId) · parking rule ·
Phase A disclosures verbatim · two-layer naming amendment (display
name + eternal @handle, tombstoned never recycled). Evidence:
`demo:phase2` (the linkage audit: 0 co-occurrence rows), 48 tests.

## Phase 3 — Polls & Governance Rooms ✅ OWNER-RATIFIED (2026-07-10)

Poll primitive (single/multi/consensus, Public/Pseudonymous, sealed
default) · governance rooms, always-sealed + candle close (committed
pre-vote, revealed verifiably) · records that re-derive. Evidence:
`demo:phase3`, 55 tests, live browser run.

## Phase 4 — The Internal Economy ✅ SELF-VERIFIED (2026-07-11)

**Shipped:** per-profile PC/G balances (faces never bridge) · treasury ·
double-entry money ledger · every ratified fee wired (reply, vote,
poll, discussion, paid permanence, flag deposit — never blocking at
zero) · Welcome Grant (verification/seed/orientation/first-action/
hatch) · tips (5% cut; breadth public, names never) · attestation
rails (human-made mark, source objects, vouched sharing) · sort menu
gained tippers + sourced · Participation Accrual v0 (owner-delegated
into this phase: ceilings 10/day + 50/week as rails, capped streak,
private weights) · `/treasury` raw inspection page.

**Evidence:** 68 tests across 8 files; `db:verify` 18 checks including
economy conservation (every balance re-derives from entries; inflating
a balance out of thin air fails loudly — demonstrated in
`demo:phase4`); browser walkthrough of balances, fee labels, tipping,
upgrade flow, and `/treasury` (screenshots in session record);
spec-conformance pass against TOKENOMICS_SPEC + ECONOMIC_STARTING_
DEFAULTS + DISCUSSIONS §4/§6/§8/§10.

**If you choose to look (15 min):** sign in → header shows your
balances → post (fee −1, accrual +1: net-free while genuine) → tip a
post (breadth shown, no names) → `/treasury` (aggregates only). Judge:
is this the economy of assent you ratified?

## Phase 5 — Moderation Live (+ Notifications) ✅ SELF-VERIFIED (2026-07-11)

**Shipped:** the full judicial branch — badge lifecycle (sortition
offers, equip/pass, 48h hard cutoff, 7d cooldown, pool scaling),
minimal case files (triangle of blindness — verified no-leak in tests
AND live UI), cite-a-rule rulings, auto-applied strike ladder (Gratium
penalty clamped at zero, pillar-scoped LS deductions recorded for the
Phase 7 engine, rate-limit at 2, read-only + Tribunal review at 3),
blur-don't-erase + expedited full-hide (R3.1/R3.3 only), heavy-tier
3-ruling majorities, supervision with taper + Moderation Rating v0
(public inputs, secret weights, self-visible only), per-case-resolved
treasury rewards × rating multiplier (≤2×), deposit refund on upheld
AND good-faith declined / forfeit on bad-faith, one appeal to fresh
eyes (original rulers excluded) or the Tribunal, consequence reversal
+ deposit refund on successful appeal, the restorative option
(correction appended + hash-committed, strike reduced), interim
Tribunal from badge-completers (30d staggered, treasury stipends,
majority-of-seats), Sentinel v1 brigade bundling. Notifications: two
tiers, per-persona, aggregated; badge offers / rulings-to-both-parties
(anonymity-respecting) / poll-closing time-sensitive; tips + poll
results quiet.

**Evidence:** 79 tests across 9 files; db:verify grew to 20 checks
(moderation integrity: no moderator identity anywhere on the ledger,
every resolution on-ledger, tombstones cite real rules, no content
actioned without a case — off-process removal fails loudly, under
test); `demo:phase5` walks the checkpoint end to end; workbench +
inbox verified live in the browser (case file leaked no handles).

**Interim rules set at build time (flagged):** supervision cold-start
(when no qualified second moderator exists anywhere, rulings take
effect directly — mirrors BUILD_ORDER's interim-tribunal rule); strike
penalty amounts (2/5 uG) and LS deductions (5/10 × tier) are
build-time rails; Sentinel brigade threshold 5 flags/24h.

**If you choose to look (15 min):** get flagged content ruled — post
with one face, flag with another, `/moderation` with a third (or run
`npm run demo:phase5`), watch the blur, the ruling, the tombstone
citing the rule, and both inboxes learning their outcomes without
learning any names.

## Phase 6 — Circles ⏳ NOT STARTED
