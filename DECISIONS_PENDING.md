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
   expire at the Phase 9 re-review. Face-switch cooldown
   RESOLVED by owner (2026-07-11): none — seamless switching is the
   vision; mechanism retained as a 0–15 min rail. Supervision
   cold-start interim unchanged (a rule, not a number).

6. **Notification categories awaiting host features:** replies-on-join
   (needs join=follow), governance-poll-opened (needs pillar follow),
   DMs (Phase 6.5). The exhaustive-list law is honored; these activate
   with their features.

7. **Phase 6 flags (non-blocking, 2026-07-11):**
   - **Domain-level Circle tags** (CIRCLES §2.1 "optionally a specific
     domain within it"): pillar-breakdown domains aren't data until
     Phase 7's dashboards; Circles tag at pillar level for now. Wire the
     domain option when domains become rows. Gates: nothing — Phase 7
     consumes.
   - **Browse-by-size filter** (CIRCLES §4): member counts are displayed
     and recency-of-attested-action orders the browse; an explicit size
     filter is a five-line addition when wanted.
   - **Circle-activity notification scope:** the quiet "Circle activity
     (your Circles)" category fires on member-joined / action-logged /
     entry-attested / internal-poll-opened, aggregated per Circle.
     Room REPLIES deliberately don't notify — NOTIFICATIONS §5 gives
     ambient followed-thing activity to the feed (Phase 7). Confirm the
     event set feels right in use.
   - **Untagged Circles' rooms/polls are homed in the meta pillar** (a
     Discussion/Poll needs a pillar row; access is unaffected — Circle
     scoping overrides pillar surfaces everywhere). Cosmetic only.

8. **DM encryption stack — RESOLVED at phase start (Phase 6.5,
   2026-07-11, per OPEN_ITEMS Track 5 #29 "build-time technical"):**
   the spec's "simpler asymmetric scheme for v1" — X25519 key agreement
   → HKDF per-thread key → AES-256-GCM per message (Signal-family
   primitives, all industry standard). Per-profile keypairs; in Phase A
   the private keys are held encrypted under an operator secret
   (`DM_MASTER_SECRET`) — the exact trust posture as the gate, disclosed
   verbatim in the DM UI: encrypted at rest, operator-escrowed keys,
   the client-side rail (soul's wallet holds the key; platform
   structurally cannot read) cuts over at Phase 9 with Lace. Why not a
   double ratchet now: with a server-rendered app and no client key
   store, ratchet keys would live server-side anyway — cryptographic
   theater. This choice is honest about what Phase A is, and the §9.1
   multi-device/key-backup concerns dissolve into the Phase 9 wallet
   story. Recipient-side excerpt reporting works cleanly under escrow.
   **Re-review mandatory at Phase 9** alongside the gate cutover.

9. **Phase 6.5 derived rules (non-blocking, 2026-07-11):**
   - ~~**Releasing a bond**~~ — **OWNER-RATIFIED (2026-07-11, "this
     sounds right"):** either side may withdraw quietly (no
     notification — the blocking discipline applied). A bond is
     ongoing mutual consent, not a contract.
   - **DM-conduct strikes land in the meta pillar.** Moderation is
     pillar-scoped by ratified design; DMs have no pillar. A violation
     in a private thread is read as conduct against the commons itself.
     Alternative would be a per-human "conduct" bucket — which the
     no-universal-score invariant forbids. Interim until reviewed.
   - **§3's Circle/Chamber invites** await invite mechanics on those
     surfaces (Circles are open-join in v1; Chambers arrive 7.5).
     Fellow-souls feed source + search scope land with Phase 7 hosts.

10. **Phase 7 flags (non-blocking, 2026-07-11):**
   - **The 16 drafted Opening Questions (Compassion + Hope).** Those two
     breakdowns predate the per-domain Opening Question template the
     other five carry; their questions were DRAFTED in the ratified
     style (marked `derived-draft` in data, noted on their domain
     pages). Ratify or edit at leisure — wording changes are
     ledger-evented amendments, per canon law. Gates: nothing; the
     16 threads are live.
   - **The Agora dashboard is INCLUDED.** The dashboard spec (§8)
     deferred the Agora's own dashboard until its content existed; the
     ratified capstone (2026-07-10) provides the full canon template
     including per-domain "In service of the pillars" blocks, so the
     Agora renders with the identical pillar anatomy. Confirm this
     reading — trivially revertible to a bare hub view.
   - **Repair acceptance = system-opened governance poll** in the
     domain's pillar (consensus at the platform bar, sealed + candle,
     auto-executed at close). The dashboard spec makes the Picture a
     living object and names Polls the resolution mechanism (§6.3) but
     doesn't specify the flow; this is the least-inventive assembly of
     ratified machinery. **Repair submission is FREE** (the fee lattice
     read strictly); one open repair per soul per domain is the
     structural anti-spam. Both are rails-adjacent decisions to bless.
   - **Repair-outcome notifications deferred:** the NOTIFICATIONS
     category list is exhaustive by design; a "repair decided" category
     awaits your say. Voters learn results via poll-results; authors
     check the domain page.
   - **Open-lens weights shipped as derived rails, flagged** (FEED §9.1
     defers exact weights + anti-gaming review to real usage data):
     contributors ×3 (the v2 insightful weight — quality's multiplier),
     tippers ×1, sourced ×1, half-life 72h (the default deliberation
     window), activity window 4× half-life. The formula page renders
     live from the rails and is versioned (v1 — 2026-07-11).
   - **Minimal poll cards in the feed** (status changes only — never a
     sealed tally): §2.1 makes followed polls a launch SOURCE, so
     ignoring them silently seemed worse; §9.3 (card rollout order
     beyond Discussions) remains yours.
   - **"system" is tombstoned in the handle namespace** — system-opened
     polls speak as "system" and that attribution must never be
     claimable. Consider also reserving "agoranet"/"treasury".
   - **Treasury per-category trend charts** are v1-thin (running totals
     + balance history; per-day category deltas derivable from stored
     snapshots when wanted). Cosmetic.

11. **Build-time rail defaults set by Claude, owner-adjustable:**
   face-switch cooldown 5 min · pillar session timeout 30 min · alias
   activation 24–72h/daily cohorts (spec-indicative) · candle window
   20% of poll duration · display-name cooldown 7 days · handle charset
   3–30 `[a-z0-9_-]` · consensus threshold = leading option's share of
   counted ballots.

12. **Phase 7.5 flags (non-blocking, 2026-07-11):**
   - **"Carrying both tokens" = a nonzero balance in each** (the OQ5
     resolution named "the identity gate + carrying both tokens" as the
     complete public-chamber prerequisite; participation inside charges
     both, so entry asks for a working stock of both — any amount).
     The refusal message points at the earnable paths. Confirm the
     reading, or set a floor rail if "carrying" should mean more.
   - **Chamber membership is enclosed-space information.** The spec's
     storefront publishes member COUNT and activity level, never the
     list (contrast CIRCLES, whose spec makes joins public record) — so
     entry, invites, and workshop posting clear the gate in PRIVATE
     recording, and handles are visible only inside the workshop.
     chamber.created remains public civic record.
   - **Private-chamber storefront = name + private marker** (§4.3's
     "may be minimal"; §10.6 lifecycle remains open — no
     public/private conversion, no abandonment states built).
   - **Invites surface on /pollinator, not as notifications** — the
     NOTIFICATIONS category list is exhaustive by design; a
     chamber-invite category awaits your say (the same discipline as
     Phase 7's repair-outcome deferral). Private-chamber invites are
     creator-only per §4.2; FELLOW_SOULS §3's "invite each other"
     resolves to sharing the storefront for public chambers.
   - **Workshop permanence upgrades blocked** (the members'-room
     precedent applied: a public hash-commit of an enclosed draft would
     leak who works inside; the Arena is where a chamber's case goes on
     the permanent record, post-launch).
   - **Workshop posts don't feed Light Score** — the room-is-not-the-
     record principle: a public number never derives from enclosed
     activity.
   - **Transparency mapping:** fee.chamber → "Creation fees",
     fee.chamber-post → "Reply & vote micro-fees" (the dual-token story
     shows in each category's PC/G columns). A dedicated "Pollinator"
     category is a two-line change if you want the signature itemized.
   - **chamber-activity event set:** soul-entered + scaffold-sharpened
     notify (quiet, aggregated, space-name-only); workshop REPLIES
     deliberately don't — NOTIFICATIONS §5 gives ambient activity on
     followed things to the feed (the entered-chambers source).
