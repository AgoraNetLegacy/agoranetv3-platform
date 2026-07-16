// Fund Auditors — Tier 4 (FUND_INTEGRITY §3.5; PHASE_8_7_SPEC Slice 6).
// The minimal seed of Human Links' Auditor role, pulled forward from
// parked scope by owner ruling 2026-07-16.
//
// THE ANSWER TO "WHO WATCHES THE WATCHERS" ONLY WORKS IF THE WATCHER
// CANNOT PUNISH. Everything here is shaped by that:
//
// 1. **Paid per case, NEVER per finding.** An auditor paid for finding
//    problems will find problems. The pay is for looking, and a "clean"
//    verdict earns exactly what a "concern" does. This is the same
//    reasoning MODERATION already applies to badge holders (compensated
//    per case resolved, never per conviction) — the incentive to
//    manufacture guilt is designed out, not policed.
// 2. **Drawn by lot, per round.** Nothing durable to capture: an
//    auditor cannot be lobbied before they exist, and by the time
//    anyone knows who they are, their sample is already assigned. Same
//    property that makes moderation sortition work — "nothing durable
//    to capture" (ANTI_SYBIL row 6).
// 3. **A finding is a signal, never a penalty.** It records publicly
//    and stops. Consequences travel the same due-process road as
//    everything else — a ruling — which is exactly Sentinel's rule
//    ("anomalies never punish; they bundle to the Tribunal, labeled
//    machine-flagged"). An auditor who could freeze money would be an
//    operator with extra steps.
// 4. **Badge-shaped, not Tribunal-shaped** (owner decision, 2026-07-16):
//    sampling released money is periodic work, not reactive
//    adjudication. Offers expire unanswered, exactly like badge offers —
//    service is opt-in, never conscription.
//
// ⚠ WHERE THIS STOPS TODAY: a "concern" finding has nowhere to go. There
// is no case for a release (DECISIONS_PENDING #17 — Flag accepts postId
// XOR dmExcerptId, and a release is neither), and the spec never names
// which rule is "misuse." So a concern is published and left there,
// honestly. That is a real limit, and it is written on the finding
// itself rather than hidden behind an auditor who appears to be doing
// more than they can.

import type { PrismaClient } from "@prisma/client";
import type { DbOrTx } from "./db";
import { appendEvent } from "./ledger";
import { getRail } from "./rails";
import { payFromTreasury } from "./economy";
import { BUDGET_MODERATION_REWARDS } from "./budget";

export type AuditResult = { ok: true } | { ok: false; reason: string };

/**
 * Draw auditors by lot over released mission money that nobody has
 * sampled yet.
 *
 * Sampling, not census: auditing every release would cost more than it
 * protects, and the deterrent lives in *unpredictability* — a chamber
 * cannot know which release gets read, so the honest answer is to expect
 * all of them might. Same logic as moderation's quality sampling.
 */
export async function offerFundAudits(db: PrismaClient): Promise<number> {
  const [samplePercent, offerHours] = await Promise.all([
    getRail(db, "fundAudit.samplePercent"),
    getRail(db, "fundAudit.offerWindowHours"),
  ]);

  // Expire stale offers first — an unanswered offer passes on its own.
  // Service is opt-in; silence is a valid answer and costs nothing.
  await db.fundAudit.updateMany({
    where: { status: "offered", expiresAt: { lte: new Date() } },
    data: { status: "expired" },
  });

  const unsampled = await db.missionRelease.findMany({
    where: { state: "released", audits: { none: {} } },
    include: { chamber: { include: { members: true } } },
  });
  if (unsampled.length === 0) return 0;

  // The eligible pool: proven badge-completers — souls who have already
  // done real service under the triangle of blindness. Not a
  // credentialed class; just people the platform has watched work.
  const completers = await db.badgeTerm.findMany({
    where: { casesCompleted: { gt: 0 } },
    select: { profileId: true },
    distinct: ["profileId"],
  });
  if (completers.length === 0) return 0;

  let offered = 0;
  for (const release of unsampled) {
    if (Math.random() * 100 >= samplePercent) continue;

    // Conflict exclusion, the same shape moderation already uses: an
    // auditor may not read money they are party to. Members of the
    // chamber, the proposer, and the recipient are all excluded — an
    // auditor auditing their own mission is not an audit.
    const conflicted = new Set<string>([
      release.proposerProfileId,
      release.toProfileId,
      ...release.chamber.members.map((m) => m.profileId),
    ]);
    const eligible = completers.filter((c) => !conflicted.has(c.profileId));
    if (eligible.length === 0) continue;

    const drawn = eligible[Math.floor(Math.random() * eligible.length)];
    await db.$transaction(async (tx) => {
      await tx.fundAudit.create({
        data: {
          releaseId: release.id,
          auditorProfileId: drawn.profileId,
          expiresAt: new Date(Date.now() + offerHours * 3_600_000),
        },
      });
      // The offer is public as an EVENT, but never names the auditor —
      // the triangle of blindness applies here for the same reason it
      // applies to moderation: an auditor whose identity is known before
      // they rule is an auditor who can be lobbied.
      await appendEvent(tx, {
        actorType: "system",
        eventType: "fund-audit.offered",
        payload: { releaseRef: release.id, chamberRef: release.chamberId },
      });
    });
    offered++;
  }
  return offered;
}

/** Accept a drawn audit. Opt-in, like every badge term. */
export async function acceptFundAudit(
  db: PrismaClient,
  input: { auditId: string; profileId: string }
): Promise<AuditResult> {
  const audit = await db.fundAudit.findUnique({ where: { id: input.auditId } });
  if (!audit) return { ok: false, reason: "No such audit." };
  if (audit.auditorProfileId !== input.profileId) {
    return { ok: false, reason: "This audit was drawn for someone else." };
  }
  if (audit.status !== "offered") {
    return { ok: false, reason: `This audit is ${audit.status}.` };
  }
  if (audit.expiresAt <= new Date()) {
    await db.fundAudit.update({ where: { id: audit.id }, data: { status: "expired" } });
    return { ok: false, reason: "That offer expired — it passed on its own." };
  }
  await db.fundAudit.update({ where: { id: audit.id }, data: { status: "accepted" } });
  return { ok: true };
}

/** Decline. Passing costs nothing, ever — service is never conscription. */
export async function passFundAudit(
  db: PrismaClient,
  input: { auditId: string; profileId: string }
): Promise<AuditResult> {
  const audit = await db.fundAudit.findUnique({ where: { id: input.auditId } });
  if (!audit) return { ok: false, reason: "No such audit." };
  if (audit.auditorProfileId !== input.profileId) {
    return { ok: false, reason: "This audit was drawn for someone else." };
  }
  if (audit.status !== "offered") return { ok: false, reason: `This audit is ${audit.status}.` };
  await db.fundAudit.update({ where: { id: audit.id }, data: { status: "passed" } });
  return { ok: true };
}

/**
 * Record a finding and get paid — the same amount either way.
 *
 * The pay is for looking. "clean" and "concern" earn identically, which
 * is the entire anti-incentive: an auditor who profits from concerns
 * manufactures concerns.
 */
export async function completeFundAudit(
  db: PrismaClient,
  input: {
    auditId: string;
    profileId: string;
    finding: "clean" | "concern";
    note: string;
  }
): Promise<AuditResult> {
  const audit = await db.fundAudit.findUnique({
    where: { id: input.auditId },
    include: { release: true },
  });
  if (!audit) return { ok: false, reason: "No such audit." };
  if (audit.auditorProfileId !== input.profileId) {
    return { ok: false, reason: "This audit was drawn for someone else." };
  }
  if (audit.status !== "accepted") {
    return { ok: false, reason: "Accept the audit before recording a finding." };
  }
  const note = input.note.trim();
  if (!note) {
    return {
      ok: false,
      reason: "A finding needs its reasoning — an unexplained verdict is not an audit.",
    };
  }

  const reward = await getRail(db, "fundAudit.caseRewardG");
  await db.$transaction(async (tx) => {
    await tx.fundAudit.update({
      where: { id: audit.id },
      data: {
        status: "completed",
        finding: input.finding,
        note,
        completedAt: new Date(),
        gratiumEarned: reward,
      },
    });
    // Paid per case, never per finding. Rides the moderation-rewards
    // budget category: this is the same kind of spending — the treasury
    // paying souls for civic service (TOKENOMICS §3's first funded
    // public service), and inventing a category for it would imply a
    // budget line the community never voted for.
    const paid = await payFromTreasury(tx, {
      profileId: input.profileId,
      currency: "G",
      amount: reward,
      kind: "reward.fund-audit",
      budgetCategory: BUDGET_MODERATION_REWARDS,
      refType: "release",
      refId: audit.releaseId,
    });
    if (!paid.ok) throw new Error(`Fund audit reward refused: ${paid.reason}`);

    // The finding is public — and its LIMIT is public with it. An
    // auditor who appears to be doing more than they can is worse than
    // no auditor.
    await appendEvent(tx, {
      actorType: "system",
      eventType: "fund-audit.completed",
      payload: {
        releaseRef: audit.releaseId,
        chamberRef: audit.release.chamberId,
        finding: input.finding,
        note,
        // Stated on every concern, deliberately: this signal has no
        // enforcement path yet (DECISIONS_PENDING #17). Publishing the
        // gap beats implying it isn't there.
        consequence:
          input.finding === "concern"
            ? "recorded — a concern is a public signal, not a penalty; consequences travel due process"
            : "none",
      },
    });
  });
  return { ok: true };
}

/** An auditor's own drawn work. Never public — see the offer event. */
export async function myFundAudits(db: DbOrTx, profileId: string) {
  return db.fundAudit.findMany({
    where: { auditorProfileId: profileId, status: { in: ["offered", "accepted"] } },
    include: { release: true },
    orderBy: { offeredAt: "desc" },
  });
}

/**
 * The public audit record for a release: what was found, by nobody in
 * particular. Findings are public; auditors are not — the same triangle
 * of blindness moderation runs on.
 */
export async function auditsForRelease(db: DbOrTx, releaseId: string) {
  const audits = await db.fundAudit.findMany({
    where: { releaseId, status: "completed" },
    select: { finding: true, note: true, completedAt: true },
    orderBy: { completedAt: "asc" },
  });
  return audits;
}
