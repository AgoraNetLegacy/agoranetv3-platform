// Rails; every number is data, never a literal (build law). Values are
// the ratified v0 TEST SCHEDULE from Economics/ECONOMIC_STARTING_DEFAULTS.md
// (units: u, where 1u = one reply; all of it expires at the Phase 9
// real-money re-review). Bounds policy: poll-adjustable within [¼×, 4×]
// of the shipped default unless a spec says otherwise.
//
// Phase 1 seeds only the rails its features name. Fee rails are seeded as
// data now; actual balance debits wire up in Phase 4, when internal
// balances exist ("every ratified fee wired"; BUILD_ORDER Phase 4).

import type { DbOrTx } from "./db";

export interface RailDefault {
  key: string;
  value: number;
  unit:
    | "uPC"
    | "uG"
    | "u"
    | "minutes"
    | "hours"
    | "days"
    | "months"
    | "percent"
    | "badges"
    | "cases"
    | "points"
    | "seats"
    | "flags"
    | "members"
    | "x"
    | "actions"
    | "lovelace"
    | "posts"
    | "cards";
  boundMin?: number; // defaults to ¼× value
  boundMax?: number; // defaults to 4× value
  description: string;
}

export const RAIL_DEFAULTS: RailDefault[] = [
  {
    key: "discussion.replyFee",
    value: 2,
    unit: "uPC",
    description:
      "Reply micro-fee; two PollCoin units charged, with one participation unit accrued back when the daily and weekly ceilings allow (participation-cost rule, TOKENOMICS §1).",
  },
  {
    key: "discussion.graceWindowMinutes",
    value: 15,
    unit: "minutes",
    description:
      "Grace window for typo repair in permanent spaces, with visible edit history; the record locks when it closes (DISCUSSIONS §8).",
  },
  {
    key: "moderation.flagDeposit",
    value: 5,
    unit: "uPC",
    description:
      "Refundable flag deposit (participation-cost rule). Refunded on upheld and good-faith declined; forfeited on bad-faith/pattern rulings. Wires up with Phase 4 balances; flagging is never blocked by an empty balance.",
  },
  // --- Identity & session rails (Phase 2). The activation window bounds
  // follow ONBOARDING §3.3's indicative 24–72h; cohort cadence follows
  // its daily example. Cooldown and timeout are build-time defaults for
  // open items deferred to this phase (OPEN_ITEMS Track 5 #35/#36);
  // flagged to the owner at the Phase 2 checkpoint.
  {
    key: "identity.aliasActivationMinHours",
    value: 24,
    unit: "hours",
    description:
      "Earliest a newly hatched Alias may activate (randomized within the window; ONBOARDING §3.3).",
  },
  {
    key: "identity.aliasActivationMaxHours",
    value: 72,
    unit: "hours",
    description:
      "Latest a newly hatched Alias may activate (ONBOARDING §3.3).",
  },
  {
    key: "identity.aliasCohortCadenceHours",
    value: 24,
    unit: "hours",
    description:
      "Alias activations release in cohorts on this cadence; a new Alias always appears alongside others (ONBOARDING §3.4).",
  },
  {
    key: "identity.faceSwitchCooldownMinutes",
    value: 0,
    unit: "minutes",
    boundMin: 0,
    boundMax: 15,
    description:
      "Identity-switch cooldown; OWNER-RESOLVED (2026-07-11, DUAL_ID OQ5): NONE; seamless switching is the product vision. The parking rule remains the timing mitigation. Mechanism retained as a rail (0–15 min) should governance ever want it.",
  },
  {
    key: "identity.pillarSessionTimeoutMinutes",
    value: 30,
    unit: "minutes",
    description:
      "A pillar parking lock expires after this inactivity (DASHBOARD §3.3.5 left the duration to build time).",
  },
  {
    key: "identity.sessionLifetimeHours",
    value: 9600,
    unit: "hours",
    boundMin: 1,
    boundMax: 9600,
    description:
      "SoulSession lifetime; owner ruling 2026-07-23: 9600h (400 days, the cookie ceiling) so login survives browser restarts. Departs from DUAL_IDENTITY §7.2 short-retention posture: a session where both identities sign in now holds their co-occurrence for its whole lifetime. Explicit sign-out still purges immediately.",
  },
  {
    key: "identity.displayNameCooldownDays",
    value: 7,
    unit: "days",
    description:
      "Minimum days between display-name changes (naming ruling 2026-07-10: rate-limited; free renaming is a mid-dispute impersonation vector). Build-time default, owner-adjustable.",
  },
  {
    key: "discussion.creationFee",
    value: 10,
    unit: "uPC",
    description:
      "Discussion creation fee; ten replies' worth of commitment (ECONOMIC_STARTING_DEFAULTS §1). Host feature (soul-created context Discussions) arrived Phase 3; wires at Phase 4.",
  },
  // --- Poll rails (Phase 3). Fees designated per the participation-cost
  // rule; debits wire at Phase 4 with internal balances.
  {
    key: "poll.creationFee",
    value: 10,
    unit: "uPC",
    description:
      "Poll creation fee; same altitude as a Discussion (ECONOMIC_STARTING_DEFAULTS §1). Anti-spam cost, never vote weight. Wires at Phase 4.",
  },
  {
    key: "poll.voteFee",
    value: 0.25,
    unit: "uPC",
    description:
      "Vote micro-fee; ordinary AND governance, identical per law: voting must never feel expensive, and a fee to cast is not weight. Wires at Phase 4.",
  },
  {
    key: "poll.candleWindowPercent",
    value: 20,
    unit: "percent",
    description:
      "The candle's final stretch, as a percent of poll duration: the true close is drawn randomly inside this window (POLLS §8 anti-sniping). Stretch length was left to build time; default flagged to owner.",
  },
  // --- Economy rails (Phase 4; ECONOMIC_STARTING_DEFAULTS, the
  // ratified v0 test schedule; everything expires at the Phase 9
  // real-money re-review).
  {
    key: "economy.tipCutPercent",
    value: 5,
    unit: "percent",
    description:
      "Treasury micro-cut on tips (owner-ratified 5%); nearly all appreciation reaches the soul.",
  },
  {
    key: "economy.permanenceUpgradeFee",
    value: 15,
    unit: "uG",
    description:
      "Paid-permanence upgrade (Discussion at creation, or own post); cost-plus over real archival cost; margin to treasury (DISCUSSIONS §8, ARWEAVE §4).",
  },
  {
    key: "grant.verification.pc",
    value: 25,
    unit: "uPC",
    description: "Welcome Grant at humanity verification; PollCoin half (one per human, cryptographically).",
  },
  {
    key: "grant.verification.g",
    value: 25,
    unit: "uG",
    description: "Welcome Grant at humanity verification; Gratium half.",
  },
  {
    key: "grant.valuesSeed.pc",
    value: 10,
    unit: "uPC",
    description: "Welcome Grant milestone: values seed completed (all 7 answers).",
  },
  {
    key: "grant.orientation.pc",
    value: 5,
    unit: "uPC",
    description: "Welcome Grant milestone: orientation completed.",
  },
  {
    key: "grant.firstAction.g",
    value: 5,
    unit: "uG",
    description: "Welcome Grant milestone: first action completed (Stage 6; finish what you came to do).",
  },
  {
    key: "grant.hatch.pc",
    value: 10,
    unit: "uPC",
    description: "Hatching grant to a new Alias; PollCoin half (so an Alias isn't born traceable-by-poverty).",
  },
  {
    key: "grant.hatch.g",
    value: 10,
    unit: "uG",
    description: "Hatching grant to a new Alias; Gratium half.",
  },
  // --- Participation Accrual (TOKENOMICS §4; scheduled into Phase 4 by
  // owner-delegated decision 2026-07-10). The ceilings are the
  // load-bearing guardrail: capped, presence-based earning converges on
  // a civic allowance; never an engagement treadmill.
  {
    key: "accrual.dailyCeilingPc",
    value: 10,
    unit: "uPC",
    description:
      "Hard daily accrual ceiling; idle-farming saturates fast; an active soul earns a Discussion's cost in one good day.",
  },
  {
    key: "accrual.weeklyCeilingPc",
    value: 50,
    unit: "uPC",
    description:
      "Weekly accrual ceiling (< 7× daily; sustained grinding flattens).",
  },
  {
    key: "accrual.streakBonusPc",
    value: 1,
    unit: "uPC",
    description:
      "Consecutive-active-day bonus, paid on the first qualifying action of the day.",
  },
  {
    key: "accrual.streakWeeklyCapPc",
    value: 5,
    unit: "uPC",
    description:
      "Streak bonuses flatten at +5u/week; habit acknowledged, obsession not cultivated.",
  },
  // --- Moderation rails (Phase 5; MODERATION_SPEC placeholders,
  // owner-confirmed 2026-07-09; strike penalty amounts are build-time
  // defaults flagged in DECISIONS_PENDING).
  { key: "moderation.offerWindowHours", value: 12, unit: "hours", description: "Badge offer expiry; unanswered passes automatically (MODERATION §2.2)." },
  { key: "moderation.termHours", value: 48, unit: "hours", description: "Badge term; hard cutoff, no carryover (§2.3–4)." },
  { key: "moderation.cooldownDays", value: 7, unit: "days", description: "Per-profile cooldown before re-eligibility; no consecutive holds (§2.5)." },
  { key: "moderation.poolMin", value: 5, unit: "badges", description: "Minimum concurrent badges (§OQ1)." },
  { key: "moderation.poolMax", value: 200, unit: "badges", description: "Maximum concurrent badges; the auto-scaling bound (§OQ1)." },
  { key: "moderation.slaHours", value: 48, unit: "hours", description: "Target time-to-ruling; pool scales to hold it (§OQ1)." },
  { key: "moderation.supervisionInitialCases", value: 10, unit: "cases", description: "A new moderator's first N rulings are 100% double-checked (§OQ3)." },
  { key: "moderation.supervisionAgreementPct", value: 85, unit: "percent", description: "Agreement rate that graduates a moderator to sampled supervision (§OQ3)." },
  { key: "moderation.qaSamplePct", value: 5, unit: "percent", description: "Standing blind re-review sample of ALL moderators' rulings (§6.1)." },
  { key: "moderation.caseRewardG", value: 3, unit: "uG", description: "Base Gratium per case RESOLVED; never per uphold (fixed law; ECONOMIC §5)." },
  { key: "moderation.ratingMultiplierMax", value: 2, unit: "x", description: "Moderation Rating reward multiplier cap; floor 1×, no moderator aristocracy (owner-confirmed 2×)." },
  { key: "moderation.strikeDecayMonths", value: 6, unit: "months", description: "Active-strike decay; the record is permanent, the count is not; Light Score deductions share this clock (§7)." },
  { key: "moderation.strike1PenaltyG", value: 5, unit: "uG", description: "Strike 1 Gratium penalty; derived: equals the flag deposit, the two halves of the §7 symmetry carry the same sting (DERIVED_DEFAULTS.md)." },
  { key: "moderation.strike2PenaltyG", value: 15, unit: "uG", description: "Strike 2 Gratium penalty; derived: the ratified serious-consequence magnitude (= paid-permanence fee; 3× lattice step)." },
  { key: "moderation.strike1LsDeduction", value: 5, unit: "points", description: "Strike 1 LS deduction ×tier; derived: one substantive contribution (v2 engine answer weight = 5; DERIVED_DEFAULTS.md)." },
  { key: "moderation.strike2LsDeduction", value: 10, unit: "points", description: "Strike 2 LS deduction ×tier; derived: a full discussion's maximum credit (v2 participation cap = 10)." },
  { key: "moderation.rateLimitHours", value: 24, unit: "hours", description: "Strike 2 short rate-limit duration (build-time default)." },
  { key: "moderation.readOnlyDays", value: 7, unit: "days", description: "Strike 3: read-only period + Tribunal review (§7)." },
  { key: "tribunal.seats", value: 7, unit: "seats", description: "The platform's number, deliberately (§8)." },
  { key: "tribunal.termDays", value: 30, unit: "days", description: "Staggered terms, no consecutive (§8)." },
  { key: "tribunal.stipendG", value: 100, unit: "uG", description: "Treasury-paid stipend per 30-day term (ECONOMIC §5)." },
  { key: "tribunal.appealDepositPc", value: 25, unit: "uPC", description: "Appeal deposit; refunded if the ruling changes, forfeited if baseless (ECONOMIC §2)." },
  { key: "sentinel.brigadeFlagThreshold", value: 5, unit: "flags", description: "Sentinel v1 brigade threshold; derived: 5 deposits = 25u collective stake = the appeal-deposit magnitude staked against one item in one day-cycle." },
  { key: "sentinel.brigadeWindowHours", value: 24, unit: "hours", description: "Sentinel v1 brigade detection window (build-time default)." },
  { key: "sentinel.selfDealReleaseThreshold", value: 3, unit: "actions", description: "Sentinel's mission watch (FUND_INTEGRITY §3.5): self-directed mission releases within the window before the pattern is machine-flagged. ONE is ordinary; reimbursing a member who fronted costs is the most common legitimate use of a mission's money, and forbidding it would push real spending off the record. A PATTERN is a question worth asking in public. Never punishes; anomalies bundle, they don't convict. BUILD-TIME DEFAULT (DECISIONS_PENDING #19)." },
  { key: "notifications.digestCadenceHours", value: 24, unit: "hours", description: "Quiet-inbox digest cadence (spec default: daily)." },
  { key: "notifications.pollClosingSoonHours", value: 6, unit: "hours", description: "How close to a poll's nominal end the closing-soon notification fires (build-time default)." },
  {
    key: "anchor.cadenceHours",
    value: 24,
    unit: "hours",
    description:
      "Civic-ledger anchor cadence (ARWEAVE_RECORDS' ratified daily anchors, at TESTNET_RAILS §3's testnet grade): the head hash is witnessed by a public testnet transaction on this rhythm; when the ledger has moved. The 7-minute heartbeat is the recorded money-era target, not this phase's.",
  },
  {
    key: "onchain.demoDonationLovelace",
    value: 3_000_000,
    unit: "lovelace",
    boundMin: 1_000_000,
    boundMax: 12_000_000,
    description:
      "On-chain migration Slice 3: size of the demo donation a soul's own wallet locks at the donation-lock script (testnet tADA only; 3 tADA default). A demo parameter, railed like every number; the real donation model waits on the securities answer.",
  },
  {
    key: "onchain.auditorSettlementLovelace",
    value: 2_000_000,
    unit: "lovelace",
    boundMin: 1_000_000,
    boundMax: 8_000_000,
    description:
      "On-chain migration Slice 7: testnet tADA settled to a fund auditor's own wallet PER COMPLETED CASE; never per finding, mirroring the internal rail's rule ('clean' and 'concern' pay identically). Demo-grade; the internal economy remains the system of record.",
  },
  {
    key: "onchain.demoLockMinutes",
    value: 10,
    unit: "minutes",
    boundMin: 2,
    boundMax: 1440,
    description:
      "On-chain migration Slice 3: how long the demo donation stays time-locked at the script before the beneficiary may collect. Short by design; the demo proves the lock is real without stranding testnet funds for days.",
  },
  {
    key: "onchain.claimMinCredits",
    value: 1,
    unit: "uPC",
    boundMin: 1,
    boundMax: 10,
    description:
      "Progressive token rail: minimum platform-held PC/G in one explicit test-wallet transfer. Testnet only; no real-value meaning.",
  },
  {
    key: "onchain.claimMaxCredits",
    value: 25,
    unit: "uPC",
    boundMin: 1,
    boundMax: 100,
    description:
      "Progressive token rail: maximum platform-held PC/G reserved by one test-wallet transfer. Limits mistakes and testnet spam.",
  },
  {
    key: "onchain.claimAssetPerCredit",
    value: 1,
    unit: "x",
    boundMin: 1,
    boundMax: 10,
    description:
      "Progressive token rail test conversion: fake wallet asset units delivered per eligible Credit. Testnet only and not a promise of production value.",
  },
  {
    key: "onchain.claimExpiryHours",
    value: 24,
    unit: "hours",
    boundMin: 1,
    boundMax: 168,
    description:
      "Progressive token rail: time a reserved platform-to-wallet PC/G transfer may wait for testnet distribution before reconciliation review.",
  },
  {
    key: "onchain.walletActionExpiryMinutes",
    value: 15,
    unit: "minutes",
    boundMin: 5,
    boundMax: 60,
    description:
      "Progressive token rail: time a validated action draft may wait for its user-signed fake-asset fee before it expires.",
  },
  // --- Circle rails (Phase 6; CIRCLES_SPEC.md; "rails, not rules" is
  // the spec's own Principle 6). Per-Circle dials (attestation
  // threshold, removal bar) take their default AND bounds from here;
  // Circles adjust them by internal Poll within the bounds.
  {
    key: "circle.creationFee",
    value: 25,
    unit: "uPC",
    description:
      "Circle creation fee; the action layer carries the most real-world weight (ECONOMIC_STARTING_DEFAULTS §1). Anti-spam precedent from Polls, same reasoning (CIRCLES §3.1).",
  },
  {
    key: "circle.attestationThreshold",
    value: 2,
    unit: "members",
    boundMin: 2,
    boundMax: 8,
    description:
      "Default attestation threshold; owner-resolved as a rail (CIRCLES OQ1): shipped default 2, per-Circle adjustable within these bounds; floor 2 so \"attested\" always means more than one voice.",
  },
  {
    key: "circle.removalBarPercent",
    value: 60,
    unit: "percent",
    boundMin: 50,
    boundMax: 100,
    description:
      "Default member-removal consensus bar; owner-resolved as a rail (CIRCLES OQ2): consensus-type Poll, per-Circle adjustable, never below simple majority. Default 60% = the platform's consensus example.",
  },
  {
    key: "circle.smallCommunityMembers",
    value: 25,
    unit: "members",
    description:
      "Below this many members a Circle is \"small\" for the Alias warning (CIRCLES §5 / OQ6, build-time derived: 25 is the lattice's serious-stake magnitude; Circle fee, appeal deposit, verification grant). Place-tagged Circles always warn.",
  },
  {
    key: "circle.inactivityDays",
    value: 90,
    unit: "days",
    description:
      "Quiet period before the honest auto-label \"inactive\" (CIRCLES §8 / OQ4; build-time default, the spec's own first suggestion; = 3 tribunal terms). Still joinable; a new member may be what revives it.",
  },
  {
    key: "circle.lsAuthorCredit",
    value: 5,
    unit: "points",
    description:
      "Light Score credit to the AUTHOR when an entry becomes attested, per pillar the Circle is tagged to; derived: the v2 engine's substantive-answer weight (DERIVED_DEFAULTS anchor); recorded now, consumed by the Phase 7 engine.",
  },
  {
    key: "circle.lsAttestCredit",
    value: 1,
    unit: "points",
    description:
      "Light Score credit to each ATTESTOR; smaller than authoring, the LIGHT_SCORE spec's shipped default (its OQ2 keeps this a rail). Derived: the anchor unit, one reply's worth of standing.",
  },
  {
    key: "circle.lsDailyCapPoints",
    value: 10,
    unit: "points",
    description:
      "Per-profile, per-Circle, per-day cap on Circle-derived Light Score credits; the anti-collusion guardrail (LIGHT_SCORE §5.1's required daily cap); derived: the v2 per-discussion participation cap. Authored credits also halve within the day (diminishing returns, same section).",
  },
  // --- Social rails (Phase 6.5; FELLOW_SOULS_AND_DM_SPEC + the
  // ratified fee lattice). Initiator pays; spam prices itself out.
  {
    key: "social.requestFee",
    value: 2,
    unit: "uPC",
    description:
      "Fellow-soul request fee; social actions cost slightly more than speech, initiator pays (ECONOMIC_STARTING_DEFAULTS §1). Accept/ignore/decline are free.",
  },
  {
    key: "social.requestCooldownDays",
    value: 30,
    unit: "days",
    description:
      "A declined or ignored requester cannot re-request the same profile for this window (FELLOW_SOULS §2, shipped default 30).",
  },
  {
    key: "social.requestExpiryDays",
    value: 30,
    unit: "days",
    description:
      "Pending requests (fellow-soul AND stranger DM threads) expire after this many days, or earlier if deleted by the receiver; owner-resolved 2026-07-09 (FELLOW_SOULS §9.4).",
  },
  {
    key: "dm.threadFee",
    value: 2,
    unit: "uPC",
    description:
      "DM thread-opening fee; stranger contact priced like a request, initiator pays (ECONOMIC §1). Recipients never pay to receive or reply within an accepted thread.",
  },
  {
    key: "dm.messageFee",
    value: 0.1,
    unit: "uPC",
    description:
      "Per-message micro-fee, sender pays; near-invisible to humans; spam still compounds to real cost (ECONOMIC §1).",
  },
  // --- Light Score rails (Phase 7; LIGHT_SCORE_EXTENSION_SPEC; the v2
  // engine's weights carried as rails per build law. Relative weights of
  // the four input types remain a Track 3 → post-data item; these are the
  // v2 anchors + DERIVED_DEFAULTS derivations.)
  {
    key: "lightScore.answerPoints",
    value: 5,
    unit: "points",
    description:
      "Points per top-level answer in a Discussion; the v2 engine's substantive-answer weight (declared reuse, lib/score.ts).",
  },
  {
    key: "lightScore.debatePostPoints",
    value: 1,
    unit: "points",
    description:
      "Points per threaded debate reply; the v2 engine's debate weight (declared reuse).",
  },
  {
    key: "lightScore.participationCapPerDiscussion",
    value: 10,
    unit: "points",
    description:
      "Ceiling on participation points earned in ONE discussion; insight over volume; raw volume can't be farmed (v2 invariant, unchanged).",
  },
  {
    key: "lightScore.repairAcceptedCredit",
    value: 5,
    unit: "points",
    description:
      "Credit to a repair's author when accepted into the Picture's revision history, in the domain's pillar; derived: the substantive-answer weight (an accepted repair is at least a substantive answer). Accepted repairs only; rejected patterns earn nothing and cost nothing (LIGHT_SCORE §2/§5.2).",
  },
  {
    key: "lightScore.moderationCaseCredit",
    value: 1,
    unit: "points",
    description:
      "Credit per case RESOLVED, in the case's pillar, quality-gated (overridden rulings accrue nothing); derived: the anchor unit; per-case credit is deliberately small (LIGHT_SCORE §2/§5.3).",
  },
  {
    key: "lightScore.moderationDailyCapPoints",
    value: 10,
    unit: "points",
    description:
      "Daily cap on moderation-service Light Score credit; derived: the participation cap; grinding flattens (LIGHT_SCORE §5.3).",
  },
  // --- Picture repair rails (Phase 7; DASHBOARD §6.5; acceptance rides
  // the platform's ratified decision mechanism, a governance poll in the
  // pillar's room; DASHBOARD §6.3).
  {
    key: "repair.consensusPercent",
    value: 60,
    unit: "percent",
    boundMin: 50,
    boundMax: 100,
    description:
      "Consensus bar for accepting a Picture repair; the platform's consensus example (60%), never below simple majority. Build-time derived, flagged.",
  },
  {
    key: "repair.pollDurationHours",
    value: 72,
    unit: "hours",
    description:
      "Duration of the system-opened governance poll deciding a repair; the platform's default deliberation window. Build-time derived, flagged.",
  },
  // --- Feed rails (Phase 7; FEED_AND_SEARCH §2.2). The lens inputs are
  // ratified (unique contributors weighted highest, tips, sourced posts,
  // recency decay; never views, never dwell); exact WEIGHTS are the
  // spec's §9.1 open item, deferred to real usage data (OPEN_ITEMS Track
  // 6 #46), so these ship as derived rails, flagged: contributor weight 3
  // = the v2 engine's insightful-vote weight (quality's multiplier);
  // tips and sourced at the anchor unit; half-life 72h = the platform's
  // default deliberation window.
  {
    key: "feed.lensContributorWeight",
    value: 3,
    unit: "points",
    description:
      "Open-lens weight per unique contributor; weighted highest, per the ratified formula skeleton.",
  },
  {
    key: "feed.lensTipWeight",
    value: 1,
    unit: "points",
    description: "Open-lens weight per unique tipper (breadth, never amounts).",
  },
  {
    key: "feed.lensSourcedWeight",
    value: 1,
    unit: "points",
    description: "Open-lens weight per sourced post.",
  },
  {
    key: "feed.lensHalfLifeHours",
    value: 72,
    unit: "hours",
    description:
      "Open-lens recency decay half-life; activity's weight halves every this many hours.",
  },
  // --- Chamber rails (Phase 7.5; NEURAL_POLLINATOR §3, the ratified
  // unified participation pricing. PC and G convert 1:1 into the same
  // spendable participation units; one cost is checked and settled by
  // the canonical economy helper.
  {
    key: "chamber.creationCost",
    value: 20,
    unit: "u",
    description:
      "Chamber creation participation cost; PC and G count 1:1 toward one unified balance.",
  },
  {
    key: "chamber.postCost",
    value: 2,
    unit: "u",
    description:
      "Workshop participation cost; PC and G count 1:1 toward one unified balance.",
  },
  // --- Mission funding (NEURAL_POLLINATOR §9.1; PHASE_8_7_SPEC Slices
  // 2-5). "Both numbers are rails, adjustable per chamber within bounds."
  {
    key: "chamber.releaseThreshold",
    value: 2,
    unit: "members",
    boundMin: 2,
    boundMax: 8,
    description:
      "Default co-signers required to release mission funds (§9.1). Floor 2 carries CIRCLES' reasoning verbatim; \"attested\" must always mean more than one voice; the proposer's own voice never counts. The CEILING does work Circles never needed: on a Circle log an unreachable threshold merely means nothing gets attested, but on escrow it STRANDS FUNDS (a chamber that set 50 could never release its own money).",
  },
  {
    key: "chamber.releaseBindingVoteThreshold",
    value: 25,
    unit: "uPC",
    description:
      "Above this, a release is authorized by a binding vote of the chamber rather than by attestation (§9.1). 25u is the platform's established serious-stake magnitude; verified in ECONOMIC_STARTING_DEFAULTS: Circle creation 25u PC, Tribunal appeal deposit 25u PC. Two co-signers are corroboration for a reimbursement; they are not a mandate for the mission's whole purse.",
  },
  // --- Fund Auditors (FUND_INTEGRITY §3.5, Tier 4). Build-time
  // defaults, FLAGGED to the owner (DECISIONS_PENDING #19); the numbers
  // session never sized this role, because it didn't exist yet.
  {
    key: "fundAudit.samplePercent",
    value: 25,
    unit: "percent",
    boundMin: 0,
    boundMax: 100,
    description:
      "Share of released mission money drawn for after-the-fact audit. Sampling, not census: auditing everything costs more than it protects, and the deterrent lives in unpredictability; a chamber cannot know which release gets read, so the honest answer is to expect all of them might. BUILD-TIME DEFAULT (DECISIONS_PENDING #19).",
  },
  {
    key: "fundAudit.offerWindowHours",
    value: 12,
    unit: "hours",
    boundMin: 6,
    boundMax: 48,
    description:
      "How long a drawn audit waits before it passes on its own; mirrors the badge offer-accept window (moderation.offerWindowHours). Service is opt-in; silence is a valid answer and costs nothing.",
  },
  {
    key: "fundAudit.caseRewardG",
    value: 5,
    unit: "uG",
    description:
      "Per completed audit; PER CASE, NEVER PER FINDING. 'clean' and 'concern' pay identically, by design: an auditor who profits from concerns manufactures concerns. Derived from the badge case reward's magnitude (same kind of work: civic service the treasury funds). BUILD-TIME DEFAULT (DECISIONS_PENDING #19).",
  },
  // --- Treasury dashboard (Phase 7; TREASURY_DASHBOARD §6.2,
  // owner-ratified: daily snapshots; the cadence is itself a rail).
  {
    key: "treasury.snapshotCadenceHours",
    value: 24,
    unit: "hours",
    description:
      "Transparency-dashboard snapshot cadence (owner-ratified daily, 2026-07-08). The underlying ledger stays live; only rendered aggregates are periodic.",
  },
  // --- Backups (Phase 8; BACKUP_DR_SPEC §1–2, owner-ratified
  // 2026-07-08). The cadence is the RPO rail: nightly at launch,
  // explicitly built to tighten to hourly/continuous WITHOUT redesign;
  // change the rail, not the machinery. Mandatory re-review before the
  // real-money era (Phase 9 entry checklist).
  {
    key: "backup.cadenceHours",
    value: 24,
    unit: "hours",
    boundMin: 1,
    boundMax: 24,
    description:
      "Backup cadence = the data-loss tolerance (RPO ~1 day at launch, owner-ratified with tighten-path). Lowering it is a config change by design; it can never exceed one day-cycle.",
  },
  {
    key: "backup.retainDaily",
    value: 30,
    unit: "x",
    description:
      "Daily backups retained (BACKUP_DR §2 shipped default). Older dailies are pruned by the backup job itself.",
  },
  {
    key: "backup.retainMonthly",
    value: 12,
    unit: "x",
    description:
      "Monthly backups retained (BACKUP_DR §2 shipped default): the first backup of each month is kept a year.",
  },
  // --- Early-platform honesty (Phase 8; DUAL_IDENTITY §7.2: "early-
  // platform UX should say so rather than imply full crowd-anonymity
  // from day one"). Same 25 anchor as the Circle small-community
  // warning (the lattice's serious-stake magnitude, CIRCLES OQ6).
  {
    key: "identity.smallPopulationThreshold",
    value: 25,
    unit: "members",
    description:
      "Below this many active souls, the Alias ceremony carries the early-platform crowd-size honesty note (§7.2 vector 5). Auto-lifts as the commons grows; never blocks hatching.",
  },
  // --- Analytics (Phase 8; ANALYTICS_SPEC §5, owner-ratified 90 days).
  {
    key: "analytics.retentionDays",
    value: 90,
    unit: "days",
    boundMin: 7,
    boundMax: 90,
    description:
      "Raw analytics events live this long, then are crushed into permanent aggregates and deleted. Shortening is always allowed; the bound CAPS at the ratified 90; lengthening is a code change requiring the same scrutiny as any privacy-touching parameter (§5).",
  },
  // --- Rate limits (Phase 8; the consolidated W4 schedule,
  // ANTI_SYBIL_CONSOLIDATION §3). Each value is the max acts per its
  // policy's window (lib/rateLimit.ts fixes the windows: 10-min burst,
  // hour, or 24h day-cycle). Numbers anchor to the v2 platform's proven
  // limiter; the same anchor discipline as the Light Score weights.
  // Walls sit at machine speed; fees remain the real throttle.
  {
    key: "ratelimit.verify",
    value: 5,
    unit: "actions",
    description:
      "Verification attempts per hour per arrival (v2 signup wall). Identity multiplication is surface #1; the gate does the real work; this stops the hammering.",
  },
  {
    key: "ratelimit.register",
    value: 3,
    unit: "actions",
    description:
      "Registration ceremonies per hour per arrival (v2 anchor). One-True-Self/one-Alias is enforced by nullifiers; this is the outer wall.",
  },
  {
    key: "ratelimit.login",
    value: 10,
    unit: "actions",
    description:
      "Sign-in attempts per burst window per arrival; the credential-stuffing wall (v2 verify wall, burst-shaped).",
  },
  {
    key: "ratelimit.posting",
    value: 12,
    unit: "actions",
    description:
      "Posts/edits per burst window per identity (v2 answer wall verbatim). A deliberating human writes slower; a flood writes faster.",
  },
  {
    key: "ratelimit.votes",
    value: 120,
    unit: "actions",
    description:
      "Ballots per burst window per identity (v2 vote wall verbatim). Generous; a soul working through every open poll never meets it.",
  },
  {
    key: "ratelimit.economy",
    value: 30,
    unit: "actions",
    description:
      "Tips/permanence upgrades per burst window per identity (v2 debate wall). Tips already cost; this stops tip-bot cycling.",
  },
  {
    key: "ratelimit.creation",
    value: 6,
    unit: "actions",
    description:
      "Space/poll/action creations per hour per identity (v2 creation wall). Creations carry real fees; this is the automation backstop.",
  },
  {
    key: "ratelimit.flags",
    value: 20,
    unit: "actions",
    description:
      "Flags/reports per hour per identity (v2 flag wall verbatim). Deposits price flag abuse; the wall stops flag-storms outright.",
  },
  {
    key: "ratelimit.moderation",
    value: 60,
    unit: "actions",
    description:
      "Moderation acts per hour per identity (v2 moderate wall verbatim). A badge-holder working a full queue stays far under it.",
  },
  {
    key: "ratelimit.appeals",
    value: 5,
    unit: "actions",
    description:
      "Appeals/restorative acceptances per day-cycle per identity (v2 appeal wall verbatim). Appeals also carry the 25u deposit.",
  },
  {
    key: "ratelimit.social",
    value: 20,
    unit: "actions",
    description:
      "Social acts (requests, joins, attestations, invites, thread opens) per burst window per identity (v2 stance wall). Initiator-pays does the real anti-spam work.",
  },
  {
    key: "ratelimit.dmMessages",
    value: 30,
    unit: "actions",
    description:
      "Direct messages per burst window per identity (v2 debate wall). Conversation-speed is untouched; scripted blasts are not.",
  },
  {
    key: "ratelimit.settings",
    value: 60,
    unit: "actions",
    description:
      "Preference changes (feed sources, follows, mutes, reads) per burst window per identity. Cheap writes, generous wall.",
  },
  {
    key: "ratelimit.faceSwitch",
    value: 30,
    unit: "actions",
    description:
      "Identity switches per burst window per session (v2 switch wall verbatim). NOT a cooldown; the owner resolved that to NONE (2026-07-11); this is an anti-automation wall two orders of magnitude above human switching.",
  },
  {
    key: "ratelimit.supportHelp",
    value: 20,
    unit: "actions",
    description:
      "Helpdesk questions per burst window per active identity or browser session. Conversation speed remains comfortable; scripted prompt floods do not.",
  },
  {
    key: "ratelimit.supportCases",
    value: 5,
    unit: "actions",
    description:
      "Support-case submissions per hour per active identity or browser session. Repeated unresolved questions belong in one case, not a queue flood.",
  },
  {
    key: "ratelimit.global",
    value: 240,
    unit: "actions",
    description:
      "The backstop: total write actions per burst window per identity/session; 2x the most generous family wall. Nothing human meets it.",
  },
  // --- The Beacon Feed (BEACON_FEED_SPEC §11, owner-ratified 2026-07-21) ---
  {
    key: "feed.saved.resurfaceMinNewPosts",
    value: 1,
    unit: "posts",
    boundMin: 1,
    boundMax: 10,
    description:
      "Saved current: new posts since the identity's own watermark before a saved thread resurfaces in the feed (BEACON §3.3).",
  },
  {
    key: "feed.saved.maxResurfacedCards",
    value: 5,
    unit: "cards",
    boundMin: 1,
    boundMax: 20,
    description:
      "Saved current: the memory current's slice of one feed load; the feed still ends (BEACON §3.3).",
  },
  {
    key: "feed.commons.windowHours",
    value: 72,
    unit: "hours",
    boundMin: 6,
    boundMax: 336,
    description:
      "The commons stream: recency window for platform-wide recently-active threads on the dashboard (BEACON §5.3).",
  },
  {
    key: "feed.lane.pulseCards",
    value: 3,
    unit: "cards",
    boundMin: 1,
    boundMax: 10,
    description:
      "Community lanes: pillar-pulse cards per feed load; the open-lens formula scoped to the day's featured pillar (BEACON §3.4).",
  },
  {
    key: "feed.lane.radarSources",
    value: 3,
    unit: "cards",
    boundMin: 1,
    boundMax: 10,
    description:
      "Community lanes: sources-radar entries per feed load; the most-cited source objects in the featured pillar's window (BEACON §3.4).",
  },
  {
    key: "feed.nudge.defaultAfterMin",
    value: 20,
    unit: "minutes",
    boundMin: 5,
    boundMax: 120,
    description:
      "Wellbeing: default minutes of continuous feed reading before the calm go-act nudge for identities that haven't tuned it; each identity adjusts or disables in Settings (BEACON §7).",
  },
];

const LEGACY_COMBINED_RAILS: Readonly<Record<string, readonly [string, string]>> = {
  "chamber.creationCost": ["chamber.creationFeePc", "chamber.creationFeeG"],
  "chamber.postCost": ["chamber.postFeePc", "chamber.postFeeG"],
};

/** Read one rail's current value. The two chamber costs have an explicit
 * deployment bridge: before their data migration lands, derive the combined
 * amount from the two old rails. This keeps old and new database states valid
 * during rollout without restoring the old two-balance eligibility rule. */
export async function getRail(db: DbOrTx, key: string): Promise<number> {
  const rail = await db.rail.findUnique({ where: { key } });
  if (rail) return rail.value;
  const legacyKeys = LEGACY_COMBINED_RAILS[key];
  if (legacyKeys) {
    const legacyRails = await Promise.all(
      legacyKeys.map((legacyKey) => db.rail.findUnique({ where: { key: legacyKey } }))
    );
    if (legacyRails.every((legacyRail) => legacyRail !== null)) {
      return legacyRails.reduce((total, legacyRail) => total + (legacyRail?.value ?? 0), 0);
    }
  }
  throw new Error(`Rail not seeded: ${key}`);
}
