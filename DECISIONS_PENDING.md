# The Owner's Queue

**The short version: nothing needs you right now (hosting closed
2026-07-13) — just a few decisions that only matter when we aim at
the public, and a stack of receipts.**
Most numbered entries below are NOT questions — they are records of
defaults Claude set on your behalf, kept so you can overrule any of
them, anytime, with a sentence. Nothing on this page stops the build;
each entry names what it gates. Blocking questions never live here —
they interrupt directly.

(Numbering is stable — checkpoint records cite these by number — so
items keep their numbers even though they're grouped by what they
need from you.)

---

## A. Needs you now

*(Nothing. #23 parked by owner 2026-07-15 — kept below for the
record.)*

23. ~~**"Face" → "Persona" vocabulary rename**~~ — **PARKED by owner
    (2026-07-15): "it doesn't fix anything and for now we focus on
    what's important."** Raised during his walkthrough, recommendation
    (adopt Persona; specs already say per-persona) stands on file for
    whenever it's revisited. Touches dozens of screens, so it would be
    its own sweep slice. Gates: nothing.

14. ~~**Hosting**~~ — **CLOSED (2026-07-13): Vercel + Railway, the
    owner's existing convention across his other projects. Owner
    confirmed same day that BOTH accounts already exist — nothing
    left on his side; deployment can target them whenever the build
    reaches it.** Render is off
    (cost); the Vercel+Neon+GitHub-Actions+R2 stitch considered
    briefly the same day is ALSO off — Railway makes it unnecessary.
    **The decided split:**
    - **Vercel** hosts the app itself (pages + all its server-side
      logic — this is a single Next.js codebase, not a split
      frontend/backend; "the frontend" in the owner's convention maps
      to "the whole app" here).
    - **Railway** is the backend infra: managed Postgres (the live
      database + a second free database for the restore drill) AND a
      small always-on service running the four ops jobs (backup,
      drill, crush, prune) on schedule, writing backups to a Railway
      volume. Real persistent containers — no GitHub Actions or
      external object storage needed.
    Cost: Railway is usage-based, not free (historically a small
    monthly minimum) — dramatically cheaper than Render's estimate,
    and the owner already has both accounts — confirmed 2026-07-13;
    no signup, no action, nothing left. Gates: nothing. (The Phase 8
    checkpoint's real cohort gets its URL from these rails when
    deployment happens.)

---

## B. Decisions that wait for PUBLIC launch — nothing here matters for the cohort test

24. **Governance poll discovery at scale — NAMED GAP (owner conversation,
    2026-07-15), no mechanism designed yet.** Any verified soul may open
    a governance poll (no badge/role/score gate, just the standard
    creation fee) — fine at today's volume, untested at hundreds or
    thousands. Today's only sort is open-before-closed, then
    newest-first; nothing distinguishes a constitutional-tier vote from
    a routine one. Corpus-checked: genuinely unaddressed anywhere in the
    ratified spec set — the one adjacent item (`NOTIFICATIONS_SPEC.md`
    §8 item 4 / `OPEN_ITEMS_CHECKLIST.md` #54) is about notification
    *loudness* for important polls, not discovery or ranking.
    **Explored and ruled out in that conversation:** staking PollCoin
    to boost a poll's visibility, refundable or not — collides directly
    with `FEED_AND_SEARCH_SPEC.md` §7's "paid visibility is on the
    Tokenomics rejected-on-principle list," and separately with the
    already-ratified "cheap talk" reasoning that killed the original
    poll-staking idea (`TOKENOMICS_SPEC.md` §6): a refundable stake
    still lets capital-holding (not permanent cost) buy attention, and
    costs a bad-faith staker nothing if they're wrong. General PollCoin
    staking for platform-health reasons (supply reduction, commitment
    signaling — the real, ratified rationale behind `CUSTODY_SPEC.md`
    §2's Gratium-only staking design) is a legitimate, SEPARATE idea if
    the owner ever wants to reopen his own 2026-07-07 "we don't need
    this for PollCoin" ruling — but it doesn't solve discovery-at-scale
    either way; coupling any token lock to a *specific* poll's
    visibility reintroduces the same rejected effect regardless of the
    lock's other benefits. **Directions still open, none decided:**
    grouping/filtering by the Constitution's own three amendment
    classes (an existing, structural stakes signal, invented nothing
    new); a flat one-per-profile support signal matching how the
    Neural Pollinator's leaderboard already works (same fee for
    everyone, no stake-weighting); transparent, non-manipulable
    participation counts. Gates: nothing now — today's volume doesn't
    need it. Worth a real pass once poll volume actually grows.

1. **Legal gate check (BUILD_ORDER Phase 4; external track).**
   Internal-only currencies want review-lite, and the non-withdrawable
   Gratium posture should be confirmed with counsel **before any launch
   marketing mentions tokens**. The compliance memo in the corpus
   `Legal/` folder frames it. Gates: launch comms, Phase 9.

15. ~~**Invite mechanics — launch-gating call**~~ — **RATIFIED
    (2026-07-13): open door. No invite-gating gets built.** Worked
    through live: gating exists to slow a flood, and the owner has
    neither an existing following nor one incoming — building a lock
    for a door nobody's rushing solves a problem that doesn't exist.
    **The real problem named instead: finding people who already
    understand why the platform needs to exist**, since the owner's
    own network isn't yet primed to see the problem it solves.
    Resolution: growth is NOT broad public marketing (owner: "I suck
    at marketing," no following) and NOT primarily personal
    network/family (don't yet share the underlying concern) — it's
    targeted outreach to pockets of people who ALREADY feel the
    problem: Cardano/Hoskinson-adjacent governance circles, privacy
    and digital-rights communities, principled X/Facebook leavers,
    civic-tech and deliberative-democracy circles. The referral bonus
    (#19) is the mechanism for this specifically — aligned people
    tend to know other aligned people, which is a better engine here
    than mass marketing or an unprimed personal network. Separately
    noted: "share only when presentable" needs no feature at all —
    the owner simply controls when he posts the link; that's not an
    invite-gating question. Gates: nothing now. Revisit only if
    organic growth ever actually threatens to outpace moderation
    capacity — not expected soon.

19. **The referral bonus — RATIFIED in conversation (2026-07-13),
    queued for a build slice.** Owner-designed, worked through live:
    - **True Self profiles only** may send invites and earn bonuses
      (an Alias never does — keeps the Alias further from the
      real-world social graph an invite inherently creates; §7.1
      vector 5, small-population inference).
    - **Sending an invite is free and unlimited.** Nobody is ever
      blocked from joining because someone "ran out" — the cap limits
      the REWARD, never entry. That distinction is load-bearing: it
      keeps faith with "one verified human is always welcome."
    - **A referral earns its bonus only when the invited human
      completes True Self registration** (verifies AND registers — a
      real account exists, not a spent, unused credential). Closes
      any incentive to farm bare verifications.
    - **Hard cap: 7 confirmed, rewarded referrals per human**
      (enforced naturally per-True-Self-profile, since a human has
      exactly one True Self ever — no cross-face bookkeeping needed).
      The 8th+ referred person is still welcomed; the inviter simply
      isn't paid again. Chose 7 partly for the anti-farming ceiling
      (bounds the "humans for hire" residual risk, W3 in
      ANTI_SYBIL_CONSOLIDATION, the same way other hard ceilings do
      elsewhere) and partly because 7 is already the platform's own
      number (pillars, lenses, Tribunal seats).
    - **Bonus: 5 G per confirmed referral** (a rail, adjustable) —
      DERIVED, not invented: matches the platform's two existing
      "one-time reward for a single discrete good-faith act" anchors
      (the first-action grant +5G, the declared-interests bonus +5G).
      Maximum lifetime payout: 35 G per human — small by the same
      discipline that protects the Welcome Grant from farming
      ("grant &lt;&lt; effort, no loop").
    Needs a build slice when scheduled: an invite/referral tracking
    model, a `grant.referral` economy-entry kind, the
    `referral.bonusG` and `referral.maxRewarded` rails, and gate logic
    tying the bonus to True Self registration completing. Not built
    yet — this entry is the full spec for when it is.

2. ~~**Support staking UI**~~ — **REDESIGNED AND RATIFIED
   (2026-07-13): retired from Polls, rebuilt as Chamber Mission
   Funding, queued for a build slice.** The owner's own critique
   killed the original idea correctly: auto-returned staking is
   "cheap talk" — a signal that costs nothing carries no information,
   since staking any amount is equally free when it's guaranteed back.
   Session amendment, corpus specs updated the same day
   (`Polls/POLLS_SPEC.md` §4.8 struck, `Neural Pollinator/
   NEURAL_POLLINATOR_SPEC.md` §9 extended, `tokenomics/
   TOKENOMICS_SPEC.md` §6 roadmap updated). The new design:
   - **Polls carry NO staking mechanic at all, ever again.** A poll
     that wants to show real backing reuses the EXISTING, already-
     proven tip mechanic: attach a Discussion (already possible on
     any poll) and let people tip its posts — real Gratium, no
     refund, zero new code required. This alone satisfies "polls that
     garner favor can receive Gratium tips."
   - **Real PollCoin donations move to Chambers**, where they belong:
     a Chamber already IS a stated mission/proposal/initiative (the
     pre-convo scaffold, the storefront's "why should people care"),
     unlike a poll's bare yes/no. A donation is a genuine transfer —
     real cost, real signal, no auto-return — fixing the cheap-talk
     problem by construction rather than by tuning a number.
   - **Raised funds accumulate in a per-chamber balance** (same
     architectural shape as the platform-wide TreasuryBalance,
     scoped to one chamber instead of the whole platform).
   - **Release requires either attestation (routine) or a binding
     vote (contested/large)** — reusing machinery already built and
     tested for Circles, not inventing new custody logic: the chamber
     logs "releasing Y PollCoin for Z," members attest it's
     legitimate (default threshold 2, bounds [2,8] — the same
     numbers already ratified for Circle attestation), OR, above a
     size threshold or when contested, a binding stewardship-style
     poll authorizes it (reusing the Circle binding-poll pattern:
     members vote, auto-executes on passage). Proposed size
     threshold: **25 units** — the platform's own established
     "serious-stake magnitude" (matches the Circle formation fee and
     the appeal deposit; DERIVED_DEFAULTS.md's existing anchor,
     reused rather than invented). Both numbers are rails, adjustable
     per chamber within bounds.
   - **The owner's instinct, preserved exactly as given:** the
     *specific* accountability rules (exact thresholds, who may
     propose a release) are ratifiable by each Chamber's own
     contributors, not dictated platform-wide — matching the
     Constitution's "community inherits the platform" ethos and the
     same adjustable-within-bounds pattern already used for Circle
     attestation.
   - **Honest flag, not a blocker:** this is the first fund-custody-
     flavored feature built — the platform holding real (internal)
     money on behalf of a stated cause, released on someone's say-so.
     No legal gate applies (nothing here is real-world money), but it
     deserves the same seriousness as other custody-touching items —
     which is exactly why the owner wants the community, not Claude,
     writing the exact accountability rule.
   Needs a build slice when scheduled: a per-chamber raised-funds
   balance, a `grant`/`fee`-style economy-entry kind for donations
   (transparency-book-categorized, an unmapped flow throws by
   design), the attestation/vote release machinery reusing Circle's
   existing code paths, and the `chamber.releaseAttestationThreshold`
   / `chamber.releaseVoteThreshold` rails. Not built yet — this entry
   is the full spec for when it is.

3. ~~**AI summaries**~~ — **FULLY SPEC'D (2026-07-13), queued for a
   build slice.** Corpus amended same session
   (`Discussion/DISCUSSIONS_SPEC.md` §5, `OPEN_ITEMS_CHECKLIST.md`
   #40 struck). Full design:
   - **What gets summarized:** the external content behind a cited
     source (a study, article, paper someone linked) — NEVER a
     Discussion thread or a soul's own words. Only already-public
     material.
   - **Provider: DeepSeek**, via the owner's own API key (stored
     locally in `.env` as `DEEPSEEK_API_KEY`, gitignored, never
     committed) — cheap, capable, OpenAI-compatible API shape. The
     platform's first outbound call to a third-party AI vendor.
     **Honest data-egress note:** categorically different from
     ANALYTICS_SPEC's "no third-party trackers" law, not an
     exception to it — the request carries only the fetched PUBLIC
     source text and the requested tier, never a soul/profile/human
     id or anything from inside the platform.
   - **Three tiers, renamed for plain language: Basic** (a few
     sentences), **Informative** (structured overview), **Extensive**
     (thorough, section-by-section).
   - **Pipeline:** check cache for (source, tier) → serve free and
     instantly if present → else fetch the source URL's content
     (readability-style extraction for articles, text extraction for
     PDFs) → if fetch fails (paywall, blocked, dead link), fail
     honestly ("couldn't be retrieved — read it directly"), never
     fabricate from a bare URL/title → send extracted text to
     DeepSeek with a tier-specific prompt → cache keyed to
     (sourceId, tier), forever, shared by every reader.
   - **Labeling, non-negotiable, verbatim:** "AI-generated assist. May
     contain errors. Read the source." Never presented as a soul's
     words, never carries standing.
   - **Correction: 2 independent flaggers trigger regeneration**
     (matches the Circle attestation floor) — a badge-holder may
     annotate instead if regeneration would reproduce the same error.
     Deliberately NOT routed through the full Flag→ModCase→Tribunal
     path — nobody's at fault, a machine output was simply wrong.
   - **Free to the soul, rate-limited instead** (already ratified):
     new proposed rail `ratelimit.aiSummaryRequest`, default 5 new
     generations/hour per soul. Reading a cached summary is an
     unlimited free DB read — the wall only guards triggering a fresh,
     real API call.
   Needs a build slice when scheduled: the fetch/extraction step, the
   DeepSeek call wrapper, a `SourceSummary` model (unique on
   sourceId+tier), the rate-limit rail, and the flag/regenerate path.
   Not built yet — this entry is the full spec for when it is.

4. ~~**Declared interests**~~ — **FULLY SPEC'D (2026-07-13), queued
   for a build slice.** Corpus amended same session
   (`Onboarding/ONBOARDING_SPEC.md` Stage 5.5, `Feed and Search/
   FEED_AND_SEARCH_SPEC.md` §2.1). Full design:
   - **Vocabulary: the platform's own 56 domains**, grouped by their 7
     pillars — reused, not invented. The same domain tag Circles and
     Chambers already carry (Phase 7's resolution), so one
     declaration surfaces matching Discussions, Circles, AND Chambers
     — one declaration, three content types, zero new tagging system.
   - **Per-persona, never compared across faces — and a structural
     non-goal stated explicitly: no interest-similarity/"people like
     you" surface is EVER built, for any two profiles**, not just a
     soul's own two faces. Stays single-profile feed tuning, full
     stop.
   - **Private by default**, public display an explicit per-profile
     opt-in — natural home: the per-face profile window
     (Presentation Backlog #7).
   - **Used for exactly one thing — that profile's own feed/
     discovery** (never ads, sale, or marketing — constitutional
     law). Distinct from and never replacing the values-seed Circle-
     matchmaking signal (Stage 5) — interests supplement discovery,
     values alignment stays primary for Circle fit.
   - **Skippable, and editable anytime afterward** — not locked to
     the onboarding moment. Declaring/editing later is free (no
     participation fee) and reuses the existing settings rate-limit
     family — no new mechanism needed.
   - **No hard cap on domains declared** — onboarding UI may suggest
     starting with a few, UX guidance only, never a technical limit.
   - **One-time +5 uG bonus** (already ratified in
     `Economics/ECONOMIC_STARTING_DEFAULTS.md` — not a new number)
     for first declaring at least one interest, **per profile**: a
     True Self and its later Alias each earn this once, independently
     — same scope as the values-seed and first-action grants. Pays
     once per profile, ever; never re-earned by toggling interests.
   Needs a build slice when scheduled: a `DeclaredInterest` model
   (per-profile, domainId, public flag — same shape discipline as
   `ValuesAnswer`), the feed-source matching logic (reusing the
   existing chosen-sources machinery), and the one-time-bonus check
   (reusing the existing `grantAlreadyGiven` pattern already used for
   orientation/first-action grants). Not built yet — this entry is
   the full spec for when it is.

18. ~~**The Testnet Track**~~ — **OWNER-RATIFIED (2026-07-12): "build
    this up as much as possible without mention of production… fully
    build this on testnet, with all our bells and whistles."**
    Scheduled as BUILD_ORDER Phases 8.5 (Presentation Era) + 8.6
    (Testnet Rails) by the same-day amendment. His standing rules,
    on the record: production NEVER proceeds without the lawyer
    conversation first; no production talk in any material until
    then; he learns and teaches the REAL platform, not interim
    scaffolding. The cohort checkpoint moves to the showcase build.
    Each phase gates on his ratification of its spec
    (Presentation/PRESENTATION_SPEC.md ·
    Chain Integration/TESTNET_RAILS_SPEC.md).

17. ~~**Key recovery / Alias succession**~~ — **RESOLVED (2026-07-13):
    split into two genuinely different problems, ratified separately.**

    - **True Self recovery: no mechanism in Phase A — UPGRADED same
      day, buildable at Phase 8.6.** Lose your Humanity Credential or
      access key today (interim HMAC issuer), and that identity is
      gone — no safe alternative exists there, for the reason the
      owner named: "we can never just take someone's word for it,"
      and the interim issuer has no independent way to confirm a
      returning human without either trusting an unverifiable claim
      or storing new identifying data. **But this was reconsidered
      the same day**, prompted by the owner asking whether the
      third-party authenticator (Identus, already part of Phase 8.6)
      could solve it properly — **yes: real recovery is buildable at
      testnet grade**, via the stable subject commitment
      DUAL_IDENTITY §8 already requires (return to the same issuer,
      re-prove who you are, get reissued a credential deriving to the
      SAME identifier — every nullifier re-derives, nothing orphaned).
      This is COOPERATIVE recovery (the soul wants to be recognized),
      which doesn't need real-world uniqueness enforcement — that
      harder, different problem is #20/W5 (reputation escape) and
      stays gated on Phase 9, unaffected by this. Full design:
      `Chain Integration/TESTNET_RAILS_SPEC.md` §1.5. **Until 8.6
      ships, the Phase A stance stands as described above, and the
      credential screen should say so plainly** — "if you lose this,
      we cannot recover it; there is no support process, no
      exception" — updating to name the real recovery path once
      Identus recovery is live.

    - **Alias succession: STILL A REAL, BUILDABLE FEATURE — different
      problem, no wall.** Unlike True Self recovery, this never needs
      to prove "I'm the same human who already lost their proof" — it
      only needs the human to present the SAME Humanity Credential
      they still hold, to revoke an old Alias and hatch its successor
      under the same nullifier stream (DUAL_IDENTITY §8's ratified
      "revocation-then-reissue" design). Concrete build shape:
      - A soul presents their Humanity Credential to a distinct
        "hatch a successor" ceremony; the platform re-derives the
        per-human `alias-registration` nullifier and finds it already
        spent — cryptographic proof this is the same human, no stored
        Human↔Alias link ever needed.
      - The old Alias is revoked and its handle tombstoned (reason
        `"hatched"` — already built); the new Alias links to it via a
        self-referential pointer, reusing the exact pattern already
        built for Circle action corrections (`correctionOfId`/
        `corrections`).
      - **Light Score never needs a "transfer" event** — the scoring
        engine walks the succession chain at computation time, so the
        new Alias's standing naturally includes its predecessor's
        history. Reuses the existing engine, no new mechanism.
      - **Lineage stays visible on purpose** ("successor of
        @old-handle") — DUAL_IDENTITY §8 is explicit that hiding it
        would be false privacy; only Alias↔True-Self unlinkability is
        sacred, never Alias↔Alias succession.
      - **Fee: 50u PC** — already ratified in
        `Economics/ECONOMIC_STARTING_DEFAULTS.md`, not invented here.
      - Theft is covered for free: a stolen Alias key and a lost one
        use the identical ceremony.
      Needs a build slice when scheduled: the succession ceremony
      (distinct from ordinary hatching), the self-referential Alias
      link, and the succession-chain-aware Light Score lookup. Not
      built yet — buildable independent of Phase 8.6, whenever
      scheduled. Gates: nothing structural — recommend scheduling this
      one as its own small slice; it needs nothing else to exist
      first.

20. **Reputation escape via re-verification — NAMED GAP (owner,
    2026-07-13), gates public launch.** Surfaced while reviewing key
    recovery: `Security/ANTI_SYBIL_CONSOLIDATION.md`'s surface #11
    ("Reputation escape") was verdicted "Covered" on the assumption
    that real Proof-of-Humanity prevents a human from holding a
    second True Self. Phase A's interim issuer can't enforce that —
    it issues on request, no real-world uniqueness check behind it —
    so today, a soul can tank their Light Score, re-verify, and walk
    away clean. Owner's words: "we can never just take someone's word
    for it" — same principle, same wall as key recovery (#17): closing
    this requires detecting a repeat verification, which means either
    trusting an unverifiable claim or storing a new identifying
    signal, and the second one breaks the privacy design this
    platform exists to protect. **Not fixable in Phase A. Not fixed
    by Phase 8.6 either** — a self-hosted testnet Identus instance is
    still the platform deciding to issue, same trust model, better
    cryptography underneath. **Closes only at Phase 9**, when a real,
    licensed identity-verification partner sits behind the credential
    — the audit now carries this as watch-item W5, amended the same
    day. **Fine for the cohort test** (a small, personally-recruited
    group — not anonymous strangers at scale). **Gates public
    launch**, alongside #17. One small, cheap build item: the
    interim-issuer disclosure (`lib/disclosures.ts`) should name this
    honestly, alongside the existing unlinkability caveat, whenever a
    copy pass is convenient.

---

## C. The record — defaults already set, yours to overrule (not questions)

Read at leisure, or never. A nod is enough; silence is also fine.
Every rail here is adjustable live, and the derived numbers all expire
at the Phase 9 real-money re-review regardless.

5. **Gap numbers DERIVED from the ratified lattice (your directive,
   2026-07-11, "fill in the gaps according to the other numbers") —
   see `DERIVED_DEFAULTS.md` for every derivation:** strike penalties
   5/15 uG (= flag deposit / permanence-fee magnitudes; the §7
   symmetry priced equally on both sides), LS deductions 5/10 ×tier
   (= v2 engine's answer weight / participation cap), Sentinel 5
   flags/24h (= an appeal-deposit's worth of collective stake in one
   day-cycle), poll-closing-soon 6h (¼ day-cycle). Face-switch
   cooldown RESOLVED by you (2026-07-11): none — seamless switching is
   the vision; mechanism retained as a 0–15 min rail. Supervision
   cold-start interim unchanged (a rule, not a number).

6. **Notification categories awaiting host features:** replies-on-join
   (needs join=follow), governance-poll-opened (needs pillar follow),
   DMs (Phase 6.5 — live). The exhaustive-list law is honored; these
   activate with their features.

7. **Phase 6 flags (2026-07-11):**
   - **Domain-level Circle tags** (CIRCLES §2.1): wired at Phase 7 when
     domains became rows. Resolved by the build.
   - **Browse-by-size filter** (CIRCLES §4): member counts displayed,
     recency-of-attested-action orders the browse; an explicit size
     filter is a five-line addition when wanted.
   - **Circle-activity notification scope:** fires on member-joined /
     action-logged / entry-attested / internal-poll-opened, aggregated
     per Circle. Room REPLIES deliberately don't notify —
     NOTIFICATIONS §5 gives ambient followed-thing activity to the
     feed. Confirm the event set feels right in use.
   - **Untagged Circles' rooms/polls homed in the meta pillar**
     (a Discussion/Poll needs a pillar row; access unaffected).
     Cosmetic only.

8. **DM encryption stack — RESOLVED at Phase 6.5 start (2026-07-11;
   OPEN_ITEMS Track 5 #29 is build-time technical):** X25519 → HKDF
   per-thread key → AES-256-GCM per message (Signal-family primitives,
   all industry standard). Phase A: private keys operator-escrowed
   under `DM_MASTER_SECRET` — the exact trust posture as the gate,
   disclosed verbatim in the thread UI; the wallet-side rail cuts over
   at Phase 9 with Lace. Why not a double ratchet now: with a
   server-rendered app and no client key store, ratchet keys would
   live server-side anyway — cryptographic theater. **Re-review
   mandatory at Phase 9** alongside the gate cutover.

9. **Phase 6.5 derived rules (2026-07-11):**
   - ~~**Releasing a bond**~~ — **YOU RATIFIED (2026-07-11, "this
     sounds right"):** either side may withdraw quietly. A bond is
     ongoing mutual consent, not a contract.
   - **DM-conduct strikes land in the meta pillar.** Moderation is
     pillar-scoped by ratified design; DMs have no pillar. The
     alternative (a per-human "conduct" bucket) is forbidden by the
     no-universal-score invariant. Interim until reviewed.
   - **§3's Circle/Chamber invites** await invite mechanics on those
     surfaces (Circles are open-join in v1).

10. **Phase 7 flags (2026-07-11):**
   - **The 16 drafted Opening Questions (Compassion + Hope).** Drafted
     in the ratified style (marked `derived-draft` in data, noted on
     their pages). Ratify or edit at leisure — wording changes are
     ledger-evented amendments, per canon law. The threads are live.
   - **The Agora dashboard is INCLUDED** (the ratified capstone
     provides its content). Trivially revertible to a bare hub view.
   - **Repair acceptance = system-opened governance poll** (consensus
     at the platform bar, sealed + candle, auto-executed at close) —
     the least-inventive assembly of ratified machinery. **Repair
     submission is FREE** (the fee lattice read strictly); one open
     repair per soul per domain is the structural anti-spam.
   - **Repair-outcome notifications deferred** (the category list is
     exhaustive by design; a "repair decided" category awaits your say).
   - **Open-lens weights shipped as derived rails** (contributors ×3 =
     the v2 insightful weight, tippers ×1, sourced ×1, half-life 72h);
     the formula page renders live from the rails, versioned.
   - **Minimal poll cards in the feed** (status changes only — never a
     sealed tally); card rollout order beyond Discussions remains yours.
   - **"system" is tombstoned in the handle namespace.** Consider also
     reserving "agoranet"/"treasury".
   - **Treasury per-category trend charts are v1-thin.** Cosmetic.

11. **Build-time rail defaults, owner-adjustable:** pillar session
   timeout 30 min · alias activation 24–72h/daily cohorts
   (spec-indicative) · candle window 20% of poll duration ·
   display-name cooldown 7 days · handle charset 3–30 `[a-z0-9_-]` ·
   consensus threshold = leading option's share of counted ballots.

12. **Phase 7.5 flags (2026-07-11):**
   - **"Carrying both tokens" = a nonzero balance in each.** The
     refusal message points at the earnable paths. Set a floor rail if
     "carrying" should mean more.
   - **Chamber membership is enclosed-space information** (count
     public, list never — private gate clearances; contrast CIRCLES,
     whose spec makes joins public). chamber.created stays public.
   - **Private-chamber storefront = name + private marker** (§4.3
     "may be minimal"; §10.6 lifecycle remains open).
   - **Invites surface on /pollinator, not as notifications** (a
     chamber-invite category awaits your say — same discipline as the
     repair-outcome deferral).
   - **Workshop permanence upgrades blocked** (the members'-room
     precedent: a public hash-commit of an enclosed draft would leak
     who works inside).
   - **Workshop posts don't feed Light Score** (the room is not the
     record).
   - **Transparency mapping:** fee.chamber → "Creation fees",
     fee.chamber-post → "Reply & vote micro-fees". A dedicated
     "Pollinator" category is a two-line change if you want it.
   - **chamber-activity event set:** soul-entered + scaffold-sharpened
     notify (quiet, aggregated); workshop replies deliberately don't.

13. **Phase 8 analytics flags (2026-07-11):**
   - **Tool selection (OPEN_ITEMS #30) resolved in-house-minimal:** an
     event is a name + timestamp in our own database, NOT a deployed
     Umami/Plausible instance — the ratified constraints are STRICTER
     than those tools' defaults, and one database keeps analytics
     inside the same backup/verify/access discipline as everything
     else. The measured vocabulary is CLOSED (db:verify fails on any
     unaudited event name). Swappable later if richer tooling is wanted.
   - **State of the Commons placement:** its own page at /commons,
     linked from /transparency. Cosmetic; move at will.
   - **The public stat set:** shipped with the spec's proposed list +
     the onboarding funnel table. Final set is your pass when you look.
   - **Funnel nuance:** Phase A's interim issuer verifies instantly, so
     gate/verified fire together until Phase 9's real issuer.
     funnel.alias is count-only — analytics doesn't get what the hatch
     ceremony withholds.
   - **Admin metrics surface:** aggregates are public on /commons;
     raw-event access is operator database access. An in-app admin
     console was never scheduled by BUILD_ORDER — say if you want it
     post-launch.

22. **Owner homework, low priority — the pre-mint token's facts
    (2026-07-15).** The owner's REAL minted tokens live in a separate
    Eternl wallet (untouched by 8.6, per spec §2.2). Next time he's
    in that wallet anyway: copy the token's POLICY ID (+ supply if
    visible) and paste it to Claude — it gets filed here so Phase 9's
    real-token session (whether real PollCoin = that mint or a fresh
    policy) starts with facts instead of archaeology. Blocks nothing
    until the lawyer conversation concludes.

21. **Phase 8.5 derived rule — the merged dashboard's parking
    threshold (2026-07-14).** The ratified §1.1 merge (the Agora
    dashboard IS the platform dashboard) meets the ratified parking
    rule (§3.3.5: returning to the hub RELEASES locks) at one point
    the specs never had to reconcile before: does landing on the
    platform dashboard park your face in the Agora? **Derived answer:
    NO — the threshold parks nothing.** The alternative would let one
    face's Agora session block the OTHER face from the homepage
    itself, contradicting §3.3.5 and making the front door refusable.
    The Agora's INTERIOR doors (its domain pages, Governance room,
    discussion threads) park exactly as they always did — the
    mechanic is untouched; only the top-of-pillar view moved into
    parking-free hub space. /pillars/agoranet redirects home ("one
    thing"). Overrule with a sentence if you read §1.1 differently.

16. **Early-platform crowd-size honesty (DUAL_IDENTITY §7.2) — built,
    bless the wording:** below 25 active souls (rail), the Alias
    ceremony says plainly that a small crowd thins anonymity, the
    records are still unlinkable, and the note lifts itself as the
    commons grows. §7.2's own directive, surfaced at the exact moment
    it matters. Never blocks hatching.

17. ~~**The freeze has a mechanism but no trigger**~~ — **RESOLVED AND
    BUILT (owner, 2026-07-16): "1. yes. 2. yes. use that."** Payments are
    now reportable (`Flag.releaseId` — the third evidence type, joining a
    post and a DM excerpt), and the freeze rule is **R3.4 Fraud &
    phishing** ("attempts to steal credentials, FUNDS, or identities" —
    the rulebook already had it; nothing was invented).

    **The narrowness is the design, and it's tested both ways.** An
    upheld ruling on a payment freezes the chamber's unpaid money ONLY
    when the cited rule is fraud. Any other upheld rule still carries its
    normal consequences but moves no money — because "any upheld ruling
    freezes" would mean a rude sentence in a payment's stated purpose
    could freeze a mission's whole purse. Over-triggering isn't a smaller
    error than under-triggering; it's a censorship mechanism in an
    anti-fraud costume.

    Also settled while wiring it: the **accused is the PROPOSER** — the
    soul who made the claim about what the money was for. Not the
    recipient (who may be an innocent supplier), and not the co-signers
    (whose accountability runs through their staked reputations). Strikes
    land in the meta pillar, like DM conduct.

    *(Original entry preserved below for the reasoning.)*

17-original. **★ The freeze has a mechanism but no trigger — TWO spec
    silences, flagged not invented (Phase 8.7 Slice 2, 2026-07-16).**
    `FUND_INTEGRITY_SPEC` §3.4 calls the freeze "the module's real
    teeth": an upheld Tribunal ruling of misuse halts every unreleased
    tranche. Built and tested: `escrow.freezeChamberReleases()`, taking
    a `tx` so it can execute inside the ruling's own transaction —
    automatic, never an operator action, per §3.7. **It is deliberately
    NOT wired to `lib/moderation.ts`, because the spec never says how
    the case starts, and two questions are genuinely unanswered:**

    **(a) A release cannot be flagged at all today.** `Flag` accepts
    `postId` XOR `dmExcerptId` — a release is neither. Flagging a
    fraudulent release needs a third evidence type
    (`Flag.releaseId`), which touches the moderation case file, the
    triangle of blindness, and the workbench. Not a line of code — a
    design decision.

    **(b) Which rule is "misuse"?** The spec says "a ruling of misuse"
    and never names a rule. The rulebook's candidates, none exact:
    **R3.4 Fraud & phishing** ("attempts to steal credentials, *funds*,
    or identities") is the closest and probably right; **R2.7
    Attested-action fraud** is the perfect analogue but says "*Circle*
    action" — mission releases reuse that same attestation primitive
    pointed at money, so R2.7 arguably wants widening; **R1.3 Mechanic
    misuse** already names "meaningless attestation marks."

    Wiring the freeze to the wrong rule would either under-trigger
    (fraud walks) or over-trigger (**a rude comment in a chamber's
    workshop freezes its funding** — the failure mode to avoid). And
    the trigger must be narrow *by rule*, since any upheld ruling
    against a chamber member is not misuse of its money.

    **Nothing is blocked:** the escrow works, releases pay
    automatically, and the freeze function is tested directly. This is
    the last wire, and it wants your call — or a spec amendment naming
    the rule.

18. ~~**Two inferences in mission donations**~~ — **RATIFIED AS BUILT
    (owner, 2026-07-16: "go with your picks").** Creator-only declaration
    stands; donating carries no fee. Both are rails/policy, poll-
    adjustable later. *(Original reasoning below.)*

18-original. **Two inferences in mission donations — built the narrow
    way, bless or overrule (Phase 8.7 Slice 3, 2026-07-16).** §9.1 is thin on both;
    neither blocks anything, and both are reversible in a sentence.

    **(a) Only the creator may declare a chamber is raising.** §9.1 says
    "a Chamber may optionally declare it's raising" without naming who.
    The creator is the reading consistent with §4.1 (they author the
    scaffold and the storefront), and it's the narrow choice —
    *widening later is a decision; un-widening is a migration.* If
    members should be able to declare, say so.

    **(b) No fee on donating.** Chamber creation and workshop posts
    carry the dual-token fee; §9.1 says nothing about a fee on the
    donation itself, so none was added. The argument for keeping it
    free: a fee on giving is a tax on generosity, and the
    participation-cost rule exists to price *participation*, not
    charity. The argument against: every other write action costs, and
    free actions are spam surfaces (though a donation costs the donor
    real PollCoin by construction, which is its own friction — spamming
    donations means giving your money away).

    **Also recorded, deliberately NOT built:** donations do not accrue
    PollCoin. `tip()` accrues because TOKENOMICS §4 names tips as a
    participation action; donations are not on that list. Adding accrual
    to giving-money would also invent a loop worth auditing (give →
    accrue → give), so it stays off until the spec says otherwise.

19. ~~**Fund Auditor numbers**~~ — **RATIFIED AS BUILT (owner,
    2026-07-16: "go with your picks").** Sample 25%, reward 5uG, offer
    window 12h, self-deal threshold 3/24h. All four are rails: they move
    by poll, and they SHOULD move once real usage exists to price them
    against — they were derived from neighbouring anchors, not measured.
    The one thing that is design and must not drift: **per case, never
    per finding.** *(Original reasoning below.)*

19-original. **Fund Auditor numbers — build-time defaults, nobody sized
    this role (Phase 8.7 Slice 6, 2026-07-16).** The Phase C numbers session
    (2026-07-09) couldn't size Fund Auditors because they didn't exist
    until 2026-07-16. Derived from the nearest ratified anchors and
    flagged rather than presented as settled:
    - **`fundAudit.samplePercent` = 25%** — sampling, not census.
      Auditing every release costs more than it protects, and the
      deterrent lives in *unpredictability*: a chamber can't know which
      release gets read, so the honest posture is to expect all of them
      might. No anchor existed; 25% is a guess with a rationale.
    - **`fundAudit.caseRewardG` = 5uG** — the badge case-reward
      magnitude, since it's the same kind of work (civic service the
      treasury funds). **Per case, never per finding** — that part is
      design, not a number, and shouldn't move.
    - **`fundAudit.offerWindowHours` = 12h** — mirrors the badge
      offer-accept window exactly.
    - **`sentinel.selfDealReleaseThreshold` = 3 releases / 24h** — ONE
      self-reimbursement is ordinary and must stay allowed (forbidding
      it would push real spending off the record where nobody can see
      it); a pattern is a question worth asking in public. 3 is a guess.

    None of these are load-bearing for correctness — they're dials. But
    they're *my* dials, not yours, and they'd benefit from a numbers
    sitting once there's real usage to look at.

25. **Gate spend and feature write should share one transaction — DO AT
    DEPLOYMENT (security review, 2026-07-17).** Every gated action proves
    humanity (spending a nullifier) in one database save, then does the
    real work (post, vote, attest) in a *second* save. If the second save
    rolls back, the nullifier is already spent — so a retry is refused as a
    DUPLICATE and the action is silently lost. The rollback trigger is two
    ledger-writing actions committing in the same instant, which needs the
    production database (Postgres); SQLite (dev + testnet) is single-writer
    and serializes, so this **cannot happen on what runs today**, and
    production is behind the Phase 9 legal gate. Worst case is one lost
    action, operator-recoverable — no funds or security exposure.

    **The fix (its own slice, ~half a day):** add a transaction-aware
    `clearGateTx(tx, …)` twin of `clearGate` — the pattern already exists
    (`clearRegistration` runs inside the caller's transaction) — then move
    the gate call *inside* each feature transaction at all **23** call
    sites (polls, DMs, moderation, flags, chambers, circles, discussions,
    escrow, fellow-souls, domains), so gate-spend and feature-write commit
    or roll back together. Not architecturally risky; the cost is 23
    careful rewires with the 262-test suite as the net. **Natural home:
    the deployment slice (#14)** — the moment Postgres concurrency becomes
    real and can be tested against actual Postgres. Deferred here on
    purpose rather than rushed into a wrap-up session.
