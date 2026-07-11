// Rails — every number is data, never a literal (build law). Values are
// the ratified v0 TEST SCHEDULE from Economics/ECONOMIC_STARTING_DEFAULTS.md
// (units: u, where 1u = one reply; all of it expires at the Phase 9
// real-money re-review). Bounds policy: poll-adjustable within [¼×, 4×]
// of the shipped default unless a spec says otherwise.
//
// Phase 1 seeds only the rails its features name. Fee rails are seeded as
// data now; actual balance debits wire up in Phase 4, when internal
// balances exist ("every ratified fee wired" — BUILD_ORDER Phase 4).

import type { DbOrTx } from "./db";

export interface RailDefault {
  key: string;
  value: number;
  unit:
    | "uPC"
    | "uG"
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
    | "x";
  boundMin?: number; // defaults to ¼× value
  boundMax?: number; // defaults to 4× value
  description: string;
}

export const RAIL_DEFAULTS: RailDefault[] = [
  {
    key: "discussion.replyFee",
    value: 1,
    unit: "uPC",
    description:
      "Reply micro-fee — the anchor unit (participation-cost rule, TOKENOMICS §1). Fee-bearing from Phase 1; debits wire up with Phase 4's internal balances.",
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
  // open items deferred to this phase (OPEN_ITEMS Track 5 #35/#36) —
  // flagged to the owner at the Phase 2 checkpoint.
  {
    key: "identity.aliasActivationMinHours",
    value: 24,
    unit: "hours",
    description:
      "Earliest a newly hatched Alias may activate (randomized within the window — ONBOARDING §3.3).",
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
      "Alias activations release in cohorts on this cadence — a new Alias always appears alongside others (ONBOARDING §3.4).",
  },
  {
    key: "identity.faceSwitchCooldownMinutes",
    value: 5,
    unit: "minutes",
    description:
      "Modest cooldown after a face switch (DUAL_IDENTITY §7.2 timing mitigation; length was open item DUAL_ID OQ5 — build-time default, owner-adjustable).",
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
    value: 24,
    unit: "hours",
    description:
      "SoulSession lifetime — session records are short-retention by design (DUAL_IDENTITY §7.2) and purged on expiry.",
  },
  {
    key: "identity.displayNameCooldownDays",
    value: 7,
    unit: "days",
    description:
      "Minimum days between display-name changes (naming ruling 2026-07-10: rate-limited — free renaming is a mid-dispute impersonation vector). Build-time default, owner-adjustable.",
  },
  {
    key: "discussion.creationFee",
    value: 10,
    unit: "uPC",
    description:
      "Discussion creation fee — ten replies' worth of commitment (ECONOMIC_STARTING_DEFAULTS §1). Host feature (soul-created context Discussions) arrived Phase 3; wires at Phase 4.",
  },
  // --- Poll rails (Phase 3). Fees designated per the participation-cost
  // rule; debits wire at Phase 4 with internal balances.
  {
    key: "poll.creationFee",
    value: 10,
    unit: "uPC",
    description:
      "Poll creation fee — same altitude as a Discussion (ECONOMIC_STARTING_DEFAULTS §1). Anti-spam cost, never vote weight. Wires at Phase 4.",
  },
  {
    key: "poll.voteFee",
    value: 0.25,
    unit: "uPC",
    description:
      "Vote micro-fee — ordinary AND governance, identical per law: voting must never feel expensive, and a fee to cast is not weight. Wires at Phase 4.",
  },
  {
    key: "poll.candleWindowPercent",
    value: 20,
    unit: "percent",
    description:
      "The candle's final stretch, as a percent of poll duration: the true close is drawn randomly inside this window (POLLS §8 anti-sniping). Stretch length was left to build time — default flagged to owner.",
  },
  // --- Economy rails (Phase 4 — ECONOMIC_STARTING_DEFAULTS, the
  // ratified v0 test schedule; everything expires at the Phase 9
  // real-money re-review).
  {
    key: "economy.tipCutPercent",
    value: 5,
    unit: "percent",
    description:
      "Treasury micro-cut on tips (owner-ratified 5%) — nearly all appreciation reaches the soul.",
  },
  {
    key: "economy.permanenceUpgradeFee",
    value: 15,
    unit: "uG",
    description:
      "Paid-permanence upgrade (Discussion at creation, or own post) — cost-plus over real archival cost; margin to treasury (DISCUSSIONS §8, ARWEAVE §4).",
  },
  {
    key: "grant.verification.pc",
    value: 25,
    unit: "uPC",
    description: "Welcome Grant at humanity verification — PollCoin half (one per human, cryptographically).",
  },
  {
    key: "grant.verification.g",
    value: 25,
    unit: "uG",
    description: "Welcome Grant at humanity verification — Gratium half.",
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
    description: "Welcome Grant milestone: first action completed (Stage 6 — finish what you came to do).",
  },
  {
    key: "grant.hatch.pc",
    value: 10,
    unit: "uPC",
    description: "Hatching grant to a new Alias — PollCoin half (so an Alias isn't born traceable-by-poverty).",
  },
  {
    key: "grant.hatch.g",
    value: 10,
    unit: "uG",
    description: "Hatching grant to a new Alias — Gratium half.",
  },
  // --- Participation Accrual (TOKENOMICS §4; scheduled into Phase 4 by
  // owner-delegated decision 2026-07-10). The ceilings are the
  // load-bearing guardrail: capped, presence-based earning converges on
  // a civic allowance — never an engagement treadmill.
  {
    key: "accrual.dailyCeilingPc",
    value: 10,
    unit: "uPC",
    description:
      "Hard daily accrual ceiling — idle-farming saturates fast; an active soul earns a Discussion's cost in one good day.",
  },
  {
    key: "accrual.weeklyCeilingPc",
    value: 50,
    unit: "uPC",
    description:
      "Weekly accrual ceiling (< 7× daily — sustained grinding flattens).",
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
      "Streak bonuses flatten at +5u/week — habit acknowledged, obsession not cultivated.",
  },
  // --- Moderation rails (Phase 5 — MODERATION_SPEC placeholders,
  // owner-confirmed 2026-07-09; strike penalty amounts are build-time
  // defaults flagged in DECISIONS_PENDING).
  { key: "moderation.offerWindowHours", value: 12, unit: "hours", description: "Badge offer expiry — unanswered passes automatically (MODERATION §2.2)." },
  { key: "moderation.termHours", value: 48, unit: "hours", description: "Badge term — hard cutoff, no carryover (§2.3–4)." },
  { key: "moderation.cooldownDays", value: 7, unit: "days", description: "Per-profile cooldown before re-eligibility; no consecutive holds (§2.5)." },
  { key: "moderation.poolMin", value: 5, unit: "badges", description: "Minimum concurrent badges (§OQ1)." },
  { key: "moderation.poolMax", value: 200, unit: "badges", description: "Maximum concurrent badges — the auto-scaling bound (§OQ1)." },
  { key: "moderation.slaHours", value: 48, unit: "hours", description: "Target time-to-ruling; pool scales to hold it (§OQ1)." },
  { key: "moderation.supervisionInitialCases", value: 10, unit: "cases", description: "A new moderator's first N rulings are 100% double-checked (§OQ3)." },
  { key: "moderation.supervisionAgreementPct", value: 85, unit: "percent", description: "Agreement rate that graduates a moderator to sampled supervision (§OQ3)." },
  { key: "moderation.qaSamplePct", value: 5, unit: "percent", description: "Standing blind re-review sample of ALL moderators' rulings (§6.1)." },
  { key: "moderation.caseRewardG", value: 3, unit: "uG", description: "Base Gratium per case RESOLVED — never per uphold (fixed law; ECONOMIC §5)." },
  { key: "moderation.ratingMultiplierMax", value: 2, unit: "x", description: "Moderation Rating reward multiplier cap — floor 1×, no moderator aristocracy (owner-confirmed 2×)." },
  { key: "moderation.strikeDecayMonths", value: 6, unit: "months", description: "Active-strike decay — the record is permanent, the count is not; Light Score deductions share this clock (§7)." },
  { key: "moderation.strike1PenaltyG", value: 5, unit: "uG", description: "Strike 1 Gratium penalty — derived: equals the flag deposit, the two halves of the §7 symmetry carry the same sting (DERIVED_DEFAULTS.md)." },
  { key: "moderation.strike2PenaltyG", value: 15, unit: "uG", description: "Strike 2 Gratium penalty — derived: the ratified serious-consequence magnitude (= paid-permanence fee; 3× lattice step)." },
  { key: "moderation.strike1LsDeduction", value: 5, unit: "points", description: "Strike 1 LS deduction ×tier — derived: one substantive contribution (v2 engine answer weight = 5; DERIVED_DEFAULTS.md)." },
  { key: "moderation.strike2LsDeduction", value: 10, unit: "points", description: "Strike 2 LS deduction ×tier — derived: a full discussion's maximum credit (v2 participation cap = 10)." },
  { key: "moderation.rateLimitHours", value: 24, unit: "hours", description: "Strike 2 short rate-limit duration (build-time default)." },
  { key: "moderation.readOnlyDays", value: 7, unit: "days", description: "Strike 3: read-only period + Tribunal review (§7)." },
  { key: "tribunal.seats", value: 7, unit: "seats", description: "The platform's number, deliberately (§8)." },
  { key: "tribunal.termDays", value: 30, unit: "days", description: "Staggered terms, no consecutive (§8)." },
  { key: "tribunal.stipendG", value: 100, unit: "uG", description: "Treasury-paid stipend per 30-day term (ECONOMIC §5)." },
  { key: "tribunal.appealDepositPc", value: 25, unit: "uPC", description: "Appeal deposit — refunded if the ruling changes, forfeited if baseless (ECONOMIC §2)." },
  { key: "sentinel.brigadeFlagThreshold", value: 5, unit: "flags", description: "Sentinel v1 brigade threshold — derived: 5 deposits = 25u collective stake = the appeal-deposit magnitude staked against one item in one day-cycle." },
  { key: "sentinel.brigadeWindowHours", value: 24, unit: "hours", description: "Sentinel v1 brigade detection window (build-time default)." },
  { key: "notifications.digestCadenceHours", value: 24, unit: "hours", description: "Quiet-inbox digest cadence (spec default: daily)." },
  { key: "notifications.pollClosingSoonHours", value: 6, unit: "hours", description: "How close to a poll's nominal end the closing-soon notification fires (build-time default)." },
];

/** Read one rail's current value. Throws if the rail was never seeded —
 *  a missing rail is a build error, not a case to default silently. */
export async function getRail(db: DbOrTx, key: string): Promise<number> {
  const rail = await db.rail.findUnique({ where: { key } });
  if (!rail) throw new Error(`Rail not seeded: ${key}`);
  return rail.value;
}
