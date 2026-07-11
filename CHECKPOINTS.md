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

## Phase 6 — Circles ✅ SELF-VERIFIED (2026-07-11)

**Shipped:** the action layer, spec-complete against `Circles/CIRCLES_SPEC.md` —
formation (25u rail, gate-cleared, live immediately, no approval queue) ·
thin founders (purpose/tags only, versioned — a Circle can't quietly
rewrite what it claimed to be) · browse/filter discovery + the
transparent values-alignment signal with its why in plain language
("Shown because you answered the X values question…" — no black-box
ranking, per the product-identity commitment) · join gate with the
DUAL_IDENTITY §7.1 small-community warning VERBATIM for Alias faces
(small OR place-tagged; informed choice with required acknowledgment,
never a wall) · members' room = Discussion primitive Circle-scoped
(members-only including reads, deletable class, never ledger-committed,
permanence upgrades blocked — the room is not the record) · resource
board (non-custodial listings; snapshot becomes permanent record only
when a logged action references it) · Circle-restricted Polls (Phase 3
machinery: member-only ballots, poll.created hash-commits the question
— tamper-evidence without disclosure; the §7 sharp rule holds — always
per-profile) · binding stewardship polls (remove-member at the Circle's
bar ≥ simple majority, close-circle, appoint-founder, attestation-dial
within rail bounds — consensus Adopt/Decline, auto-executed at close) ·
THE ACTION LOG: logged → attested (threshold rail, default 2, floor 2)
→ public civic ledger; append-only, no edit no delete, corrections by
reference; the honest claim fixed in the UI ("N verified humans put
their names to this claim — not that the platform verified it") ·
Light Score credits recorded for the Phase 7 engine (author 5 >
attestor 1, attested entries only, per-circle daily cap 10 +
diminishing returns — LIGHT_SCORE §5.1 guardrails as rails) · lifecycle
(inactive = derived honest label off the 90d rail, auto-lifting; closed
by poll only; failed Circles stay visible forever) · pillar pages
surface Circles by attested recency + the viewer's membership count ·
"circle-activity" quiet notifications (space name + event type only,
aggregated — NOTIFICATIONS §6 enclosed-space rule).

**Evidence:** 109 tests across 10 files (30 new in
`tests/circles.test.ts`); `db:verify` grew to 22 checks — Circle
integrity (formation fee + ledger evidence, membership rows ↔ public
events, action log re-hashes against its commitments, attestations
member-only/never-author/never-doubled, attested ⇒ ≥2 floor) and
members'-room privacy (room posts never on the ledger in any form,
offer ids never leak, circle-poll contentHash re-derives with no
question text, every circle-poll voter was a member, LS daily cap
holds) — both demonstrated FAILING LOUDLY under test (silent log edit,
smuggled self-attestation). `demo:phase6` walks the checkpoint end to
end. Live browser walkthrough (screenshots in session record): formed a
Circle through the UI (fee visibly charged), Alias saw the verbatim
warning at a place-tagged join and had to acknowledge it, action logged
under the permanence badge, attested by two co-signers with the state
flipping live to ✓ ATTESTED, the full chain on /ledger pseudonym-only,
the room refused to a signed-out guest. One real bug found by the
browser pass and fixed (form-in-`<p>` hydration remount swallowing
submits). Spec-conformance pass: every CIRCLES_SPEC section built or
explicitly flagged (domain-level pillar tags await Phase 7's domain
data; size filter in browse is display-only v1 — noted in
DECISIONS_PENDING).

**Derived/build-time rails set this phase (all flagged in
DERIVED_DEFAULTS.md):** small-community warning threshold 25 members ·
inactivity label 90 days · LS credits 5/1/cap 10 · removal bar default
60%, floor 50% · attestation threshold default 2, bounds [2, 8].

**If you choose to look (15 min):** `/circles` → form one (watch the
fee) → join it with your Alias somewhere place-tagged (read the warning
— that's DUAL_IDENTITY vector 5, said at the exact right moment) → log
an action → have another face attest → watch the badge flip and find
the whole story on `/ledger`. Judge: does the action layer make the
mission literal — is this where "we talked about it" becomes "here's
proof we did it"?

## Phase 6.5 — Fellow Souls & Direct Messages ⏳ NOT STARTED
