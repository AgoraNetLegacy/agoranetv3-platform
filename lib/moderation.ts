// Moderation Live (Phase 5 — MODERATION_SPEC.md + the rulebook).
//
// Sortition: random opt-in 48-hour badges; nobody campaigns for the
// power, nobody keeps it, nobody rules on their own community's cases.
// Fact-finding only: the moderator answers "does this break the cited
// rule," and consequences auto-apply. The triangle of blindness holds
// everywhere: moderators never see who flagged or posted; the accused
// never learns who flagged or ruled; the public sees the tombstone and
// the rule. Rulings are nullifier-keyed in every public record —
// moderator identity lives only in Phase A operator space, where the
// treasury pays it and the rating measures it.

import type { PrismaClient, ModCase, Prisma } from "@prisma/client";
import type { Tx } from "./db";
import { clearGate } from "./gate";
import { appendEvent } from "./ledger";
import { getRail } from "./rails";
import { chargeToTreasury, grant, payFromTreasury } from "./economy";
import { BUDGET_MODERATION_REWARDS, BUDGET_TRIBUNAL_STIPENDS } from "./budget";
import { notify } from "./notifications";
import { contentHash } from "./discussions";

// The full-hide expedited lane — R3.1 and R3.3 only (MODERATION §OQ6,
// poll-governed, deliberately short).
const EXPEDITED_RULES = ["R3.1", "R3.3"];

// v0 Moderation Rating — the input categories are public (agreement
// with final outcomes, appeal survival); the weights below are platform
// secret by ratified design. Never rendered.
function ratingMultiplier(agreementRate: number, max: number): number {
  const raw = 1 + Math.max(0, agreementRate - 0.5) * 2 * (max - 1);
  return Math.min(Math.max(raw, 1), max);
}

// ------------------------------------------------------------------ cases

/** Open a case for a flag, or join the evidence's existing open case.
 *  Posts blur under review (full-hide only in the expedited lane, §5);
 *  DM excerpts (Phase 6.5) carry no content action — nothing public
 *  exists to blur, and the recipient already holds the message. */
export async function openOrJoinCase(
  tx: Tx,
  input: { flagId: string; ruleId: string; postId?: string; dmExcerptId?: string }
): Promise<string> {
  if (!input.postId && !input.dmExcerptId) {
    throw new Error("A case needs evidence: a post or a DM excerpt.");
  }
  const existing = await tx.modCase.findFirst({
    where: {
      ...(input.postId ? { postId: input.postId } : { dmExcerptId: input.dmExcerptId }),
      status: { in: ["open", "awaiting-supervision"] },
    },
  });
  if (existing) {
    await tx.flag.update({
      where: { id: input.flagId },
      data: { caseId: existing.id, status: "in-case" },
    });
    return existing.id;
  }

  const rule = await tx.rule.findUniqueOrThrow({ where: { id: input.ruleId } });
  const expedited = EXPEDITED_RULES.includes(rule.id);

  let heavy = false;
  if (input.postId) {
    const post = await tx.post.findUniqueOrThrow({
      where: { id: input.postId },
      include: { discussion: true },
    });
    // Heavy = removal from a permanent space — three independent rulings.
    heavy = post.discussion.permanence.startsWith("permanent") || post.permanentUpgraded;
  }

  const created = await tx.modCase.create({
    data: {
      postId: input.postId ?? null,
      dmExcerptId: input.dmExcerptId ?? null,
      ruleId: rule.id,
      tier: rule.tier,
      heavy,
      expedited,
      tribunal: rule.tier === 3,
    },
  });
  await tx.flag.update({
    where: { id: input.flagId },
    data: { caseId: created.id, status: "in-case" },
  });
  if (input.postId) {
    // Blur, don't erase — a flag is never an instant censor button.
    await tx.post.update({
      where: { id: input.postId },
      data: { status: expedited ? "hidden" : "blurred" },
    });
  }
  return created.id;
}

/**
 * The accused behind a case's evidence, plus the pillar its
 * consequences land in. DM conduct (Phase 6.5) strikes in the meta
 * pillar — a violation of the commons' rules rather than any one
 * pillar's room (build-time interim, flagged in DECISIONS_PENDING).
 */
async function accusedOf(
  db: PrismaClient | Tx,
  modCase: { postId: string | null; dmExcerptId: string | null }
): Promise<{ profileId: string; pillarId: string }> {
  if (modCase.postId) {
    const post = await db.post.findUniqueOrThrow({
      where: { id: modCase.postId },
      include: { discussion: true },
    });
    return { profileId: post.authorProfileId, pillarId: post.discussion.pillarId };
  }
  const excerpt = await db.dmExcerpt.findUniqueOrThrow({
    where: { id: modCase.dmExcerptId! },
  });
  const meta = await db.pillar.findFirstOrThrow({ where: { isMeta: true } });
  return { profileId: excerpt.senderProfileId, pillarId: meta.id };
}

// ----------------------------------------------------------------- badges

/** All sweeps, run opportunistically (no scheduler infrastructure). */
export async function runModerationSweeps(db: PrismaClient): Promise<void> {
  const now = new Date();
  await db.badgeOffer.updateMany({
    where: { status: "offered", expiresAt: { lte: now } },
    data: { status: "expired" },
  });
  await scaleOffers(db);
  await seatTribunal(db);
  await sentinelSweep(db);
}

/** Pool sizing: the number of active badges scales with queue depth
 *  within poll-set bounds (§2.6). */
async function scaleOffers(db: PrismaClient): Promise<void> {
  const now = new Date();
  const [poolMin, poolMax, offerWindowHours, cooldownDays] = await Promise.all([
    getRail(db, "moderation.poolMin"),
    getRail(db, "moderation.poolMax"),
    getRail(db, "moderation.offerWindowHours"),
    getRail(db, "moderation.cooldownDays"),
  ]);
  const openCases = await db.modCase.count({
    where: { status: "open", tribunal: false },
  });
  if (openCases === 0) return;
  const target = Math.min(Math.max(openCases, poolMin), poolMax);

  const activeTerms = await db.badgeTerm.count({ where: { endsAt: { gt: now } } });
  const pendingOffers = await db.badgeOffer.count({
    where: { status: "offered", expiresAt: { gt: now } },
  });
  let deficit = target - activeTerms - pendingOffers;
  if (deficit <= 0) return;

  // Eligible: active profiles, no live term/offer, past cooldown.
  const candidates = await db.profile.findMany({
    where: { status: "active", readOnlyUntil: null },
    select: { id: true },
  });
  const cooldownCutoff = new Date(now.getTime() - cooldownDays * 86_400_000);
  const shuffled = candidates.sort(() => Math.random() - 0.5);
  for (const candidate of shuffled) {
    if (deficit <= 0) break;
    const liveOffer = await db.badgeOffer.findFirst({
      where: {
        profileId: candidate.id,
        OR: [
          { status: "offered", expiresAt: { gt: now } },
          { status: "equipped", term: { endsAt: { gt: now } } },
        ],
      },
    });
    if (liveOffer) continue;
    const recentTerm = await db.badgeTerm.findFirst({
      where: { profileId: candidate.id, endsAt: { gt: cooldownCutoff } },
    });
    if (recentTerm) continue; // no consecutive holds + cooldown (§2.5)

    const offer = await db.badgeOffer.create({
      data: {
        profileId: candidate.id,
        expiresAt: new Date(now.getTime() + offerWindowHours * 3_600_000),
      },
    });
    await notify(db, {
      profileId: candidate.id,
      tier: "time-sensitive",
      category: "badge-offer",
      title: "You've been offered a moderation badge",
      body: `Sortition chose this face. Equip within ${offerWindowHours} hours or it passes on — freely, without penalty.`,
      refType: "badge-offer",
      refId: offer.id,
    });
    deficit--;
  }
}

export async function equipBadge(
  db: PrismaClient,
  input: { offerId: string; profileId: string }
): Promise<{ ok: true; termId: string } | { ok: false; reason: string }> {
  const offer = await db.badgeOffer.findUnique({ where: { id: input.offerId } });
  if (!offer || offer.profileId !== input.profileId) {
    return { ok: false, reason: "Not your offer." };
  }
  if (offer.status !== "offered" || offer.expiresAt <= new Date()) {
    return { ok: false, reason: "This offer has passed." };
  }
  const termHours = await getRail(db, "moderation.termHours");
  const term = await db.$transaction(async (tx) => {
    await tx.badgeOffer.update({
      where: { id: offer.id },
      data: { status: "equipped" },
    });
    return tx.badgeTerm.create({
      data: {
        offerId: offer.id,
        profileId: input.profileId,
        endsAt: new Date(Date.now() + termHours * 3_600_000),
      },
    });
  });
  return { ok: true, termId: term.id };
}

export async function passBadge(
  db: PrismaClient,
  input: { offerId: string; profileId: string }
): Promise<void> {
  await db.badgeOffer.updateMany({
    where: { id: input.offerId, profileId: input.profileId, status: "offered" },
    data: { status: "passed" },
  });
}

export async function activeTermFor(db: PrismaClient, profileId: string) {
  return db.badgeTerm.findFirst({
    where: { profileId, endsAt: { gt: new Date() } },
  });
}

// -------------------------------------------------------------- the queue

/** The minimal case file (§3.1) — and nothing else. DM cases show the
 *  revealed excerpt in place of a post; the triangle holds identically
 *  (no handles, no ids, standing only). */
export async function caseFileFor(db: PrismaClient, caseId: string) {
  const modCase = await db.modCase.findUniqueOrThrow({
    where: { id: caseId },
    include: { flags: { select: { note: true } } },
  });
  const accused = await accusedOf(db, modCase);
  const activeStrikes = await activeStrikeCount(db, accused.profileId);
  const lsAdjustments = await db.lightScoreAdjustment.aggregate({
    where: { profileId: accused.profileId, pillarId: accused.pillarId },
    _sum: { amount: true },
  });

  let content: string;
  let parentExcerpt: string | null = null;
  let pillarName: string;
  if (modCase.postId) {
    const post = await db.post.findUniqueOrThrow({
      where: { id: modCase.postId },
      include: { discussion: { include: { pillar: true } } },
    });
    content = post.body;
    // Thread excerpt: the parent post, if any, for minimal context.
    const parent = post.parentId
      ? await db.post.findUnique({ where: { id: post.parentId }, select: { body: true } })
      : null;
    parentExcerpt = parent?.body?.slice(0, 280) ?? null;
    pillarName = post.discussion.pillar.name;
  } else {
    const excerpt = await db.dmExcerpt.findUniqueOrThrow({
      where: { id: modCase.dmExcerptId! },
    });
    content = excerpt.body;
    pillarName = "Direct message (recipient-revealed excerpt)";
  }

  return {
    caseId: modCase.id,
    allegedRule: modCase.ruleId,
    tier: modCase.tier,
    heavy: modCase.heavy,
    expedited: modCase.expedited,
    isDm: modCase.dmExcerptId !== null,
    content,
    parentExcerpt,
    pillar: pillarName,
    // The accused as a case, never a person: standing + history only.
    accusedActiveStrikes: activeStrikes,
    accusedPillarStanding: lsAdjustments._sum.amount ?? 0,
    flagNotes: modCase.flags.map((f) => f.note).filter(Boolean),
    // No handles, no display names, no profile ids — the triangle.
  };
}

/** Open cases this moderator may rule: conflicts excluded (§10.5). */
export async function caseQueueFor(db: PrismaClient, profileId: string) {
  const term = await activeTermFor(db, profileId);
  if (!term) return [];
  const cases = await db.modCase.findMany({
    where: { status: "open", tribunal: false },
    orderBy: [{ expedited: "desc" }, { createdAt: "asc" }],
    include: { flags: { select: { reporterProfileId: true } }, rulings: true },
  });
  const out: ModCase[] = [];
  for (const c of cases) {
    const accused = await accusedOf(db, c);
    if (accused.profileId === profileId) continue; // own content
    if (c.flags.some((f) => f.reporterProfileId === profileId)) continue; // own flag
    if (c.rulings.some((r) => r.moderatorProfileId === profileId)) continue; // already ruled
    // Fresh eyes (§9): an appeal is never judged by an original ruler.
    if (c.appealOfId) {
      const originalRuling = await db.ruling.findFirst({
        where: { caseId: c.appealOfId, moderatorProfileId: profileId },
      });
      if (originalRuling) continue;
    }
    out.push(c);
  }
  return out;
}

// ---------------------------------------------------------------- rulings

async function confirmedRulingCount(db: PrismaClient | Tx, profileId: string) {
  return db.ruling.count({
    where: {
      moderatorProfileId: profileId,
      supervision: { in: ["none", "confirmed"] },
      case: { status: { in: ["ruled", "resolved", "appealed"] } },
    },
  });
}

/** Is there any qualified second moderator (past initial supervision,
 *  holding a live badge) other than this one? Cold-start interim: when
 *  none exists anywhere, rulings take effect directly (documented). */
async function qualifiedSupervisorExists(
  db: PrismaClient,
  excludeProfileId: string
): Promise<boolean> {
  const initial = await getRail(db, "moderation.supervisionInitialCases");
  const terms = await db.badgeTerm.findMany({
    where: { endsAt: { gt: new Date() }, profileId: { not: excludeProfileId } },
    select: { profileId: true },
  });
  for (const t of terms) {
    if ((await confirmedRulingCount(db, t.profileId)) >= initial) return true;
  }
  return false;
}

export type RulingInput = {
  caseId: string;
  profileId: string;
  verdict: "uphold" | "decline" | "no-rule-fits" | "escalate";
  citedRuleId?: string;
  badFaithFlag?: boolean;
};

export async function submitRuling(
  db: PrismaClient,
  input: RulingInput
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const term = await activeTermFor(db, input.profileId);
  if (!term) return { ok: false, reason: "No active badge — the workbench is closed to you." };

  const modCase = await db.modCase.findUnique({
    where: { id: input.caseId },
    include: { flags: true, rulings: true },
  });
  if (!modCase || !["open", "awaiting-supervision"].includes(modCase.status)) {
    return { ok: false, reason: "This case is not open." };
  }
  const accused = await accusedOf(db, modCase);
  if (accused.profileId === input.profileId) {
    return { ok: false, reason: "Conflict: your own content." };
  }
  if (modCase.flags.some((f) => f.reporterProfileId === input.profileId)) {
    return { ok: false, reason: "Conflict: you flagged this content." };
  }
  if (modCase.appealOfId) {
    const originalRuling = await db.ruling.findFirst({
      where: { caseId: modCase.appealOfId, moderatorProfileId: input.profileId },
    });
    if (originalRuling) {
      return { ok: false, reason: "Fresh eyes only — you ruled the original case." };
    }
  }
  if (input.verdict === "uphold" && !input.citedRuleId) {
    return { ok: false, reason: "An uphold must cite a specific rule." };
  }
  if (input.citedRuleId) {
    const cited = await db.rule.findUnique({ where: { id: input.citedRuleId } });
    if (!cited) return { ok: false, reason: "Cite a real rule." };
  }

  // The nullifier keys the ruling (v2 sealed-vote pattern) and enforces
  // one-ruling-per-moderator-per-case; private recording — the public
  // record is written at resolution.
  const gate = await clearGate(db, {
    profileId: input.profileId,
    scope: `ruling:${modCase.id}`,
    scopeKind: "per-profile",
    ledgerRecording: "private",
  });
  if (gate.outcome === "DUPLICATE") {
    return { ok: false, reason: "You have already ruled on this case." };
  }
  if (gate.outcome !== "CLEARED" || !gate.nullifier) {
    return { ok: false, reason: `Gate: ${gate.outcome}` };
  }

  // Supervision (§6): a new moderator's early rulings are double-checked
  // before effect — when a qualified second exists.
  const initial = await getRail(db, "moderation.supervisionInitialCases");
  const myConfirmed = await confirmedRulingCount(db, input.profileId);
  const needsSupervision =
    myConfirmed < initial && (await qualifiedSupervisorExists(db, input.profileId));

  await db.ruling.create({
    data: {
      caseId: modCase.id,
      moderatorNullifier: gate.nullifier,
      moderatorProfileId: input.profileId,
      verdict: input.verdict,
      citedRuleId: input.citedRuleId ?? null,
      badFaithFlag: input.badFaithFlag ?? false,
      supervision: needsSupervision ? "pending" : "none",
    },
  });

  if (needsSupervision) {
    await db.modCase.update({
      where: { id: modCase.id },
      data: { status: "awaiting-supervision" },
    });
    return { ok: true };
  }
  await maybeResolve(db, modCase.id);
  return { ok: true };
}

/** Supervision queue: pending rulings a qualified moderator may review. */
export async function supervisionQueueFor(db: PrismaClient, profileId: string) {
  const term = await activeTermFor(db, profileId);
  if (!term) return [];
  const initial = await getRail(db, "moderation.supervisionInitialCases");
  if ((await confirmedRulingCount(db, profileId)) < initial) return [];
  return db.ruling.findMany({
    where: {
      supervision: "pending",
      moderatorProfileId: { not: profileId },
    },
    include: { case: true },
  });
}

export async function reviewSupervisedRuling(
  db: PrismaClient,
  input: { rulingId: string; profileId: string; agree: boolean }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const ruling = await db.ruling.findUnique({
    where: { id: input.rulingId },
    include: { case: true },
  });
  if (!ruling || ruling.supervision !== "pending") {
    return { ok: false, reason: "Nothing to review." };
  }
  if (ruling.moderatorProfileId === input.profileId) {
    return { ok: false, reason: "You cannot supervise yourself." };
  }
  await db.ruling.update({
    where: { id: ruling.id },
    data: { supervision: input.agree ? "confirmed" : "overridden" },
  });
  if (input.agree) {
    await maybeResolve(db, ruling.caseId);
  } else {
    // Disagreement escalates (§6.1): back to the open queue for fresh
    // eyes; the overridden ruling stays on record for the rating.
    await db.modCase.update({
      where: { id: ruling.caseId },
      data: { status: "open" },
    });
  }
  return { ok: true };
}

// ------------------------------------------------------------- resolution

/** Resolve when enough effective rulings exist: routine = 1; heavy = 3
 *  independent, majority (§4). Escalate verdicts route to the Tribunal. */
async function maybeResolve(db: PrismaClient, caseId: string): Promise<void> {
  const modCase = await db.modCase.findUniqueOrThrow({
    where: { id: caseId },
    include: { rulings: true },
  });
  const effective = modCase.rulings.filter((r) =>
    ["none", "confirmed"].includes(r.supervision)
  );
  if (effective.some((r) => r.verdict === "escalate")) {
    await db.modCase.update({
      where: { id: caseId },
      data: { tribunal: true, status: "open" },
    });
    return;
  }
  const needed = modCase.heavy ? 3 : 1;
  if (effective.length < needed) {
    if (modCase.status !== "open") {
      await db.modCase.update({ where: { id: caseId }, data: { status: "open" } });
    }
    return;
  }

  const upholds = effective.filter((r) => r.verdict === "uphold").length;
  const noRuleFits = effective.filter((r) => r.verdict === "no-rule-fits").length;
  const majorityUphold = upholds > effective.length / 2;
  const outcome = majorityUphold
    ? "upheld"
    : noRuleFits > effective.length / 2
      ? "no-rule-fits"
      : "declined";
  const citedRuleId =
    effective.find((r) => r.verdict === "uphold" && r.citedRuleId)?.citedRuleId ??
    modCase.ruleId;
  const badFaith = !majorityUphold && effective.some((r) => r.badFaithFlag);

  await resolveCase(db, { caseId, outcome, citedRuleId, badFaith });
  await settleAppeal(db, caseId);
}

export async function resolveCase(
  db: PrismaClient,
  input: {
    caseId: string;
    outcome: "upheld" | "declined" | "no-rule-fits";
    citedRuleId: string;
    badFaith: boolean;
  }
): Promise<void> {
  const [caseRewardG, multiplierMax] = await Promise.all([
    getRail(db, "moderation.caseRewardG"),
    getRail(db, "moderation.ratingMultiplierMax"),
  ]);

  await db.$transaction(async (tx) => {
    const modCase = await tx.modCase.findUniqueOrThrow({
      where: { id: input.caseId },
      include: { rulings: true, flags: true },
    });
    const accused = await accusedOf(tx, modCase);
    const post = modCase.postId
      ? await tx.post.findUniqueOrThrow({ where: { id: modCase.postId } })
      : null;

    await tx.modCase.update({
      where: { id: modCase.id },
      data: {
        status: "resolved",
        outcome: input.outcome,
        badFaithFlag: input.badFaith,
        resolvedAt: new Date(),
      },
    });

    // Content: tombstone on uphold; restore on decline (blur was never
    // erasure). The tombstone keeps the rule citation, publicly, forever.
    // DM cases carry no content action — the message lives in a private
    // thread the recipient already holds; consequences are personal.
    if (input.outcome === "upheld") {
      if (post) {
        await tx.post.update({
          where: { id: post.id },
          data: { status: "removed" },
        });
        await appendEvent(tx, {
          actorType: "system",
          eventType: "content.removed",
          payload: {
            postRef: post.id,
            discussionRef: post.discussionId,
            rule: input.citedRuleId,
            caseRef: modCase.id,
            contentHash: contentHash(post.body),
          },
        });
      }
      await applyStrikeLadder(tx, {
        profileId: accused.profileId,
        pillarId: accused.pillarId,
        tier: modCase.tier,
        caseId: modCase.id,
      });
    } else if (post) {
      await tx.post.update({
        where: { id: post.id },
        data: { status: "visible" },
      });
    }

    // "No rule fits" surfaces publicly — the judiciary tells the
    // legislature where the law is thin (§3.4).
    if (input.outcome === "no-rule-fits") {
      await appendEvent(tx, {
        actorType: "system",
        eventType: "no-rule-fits.filed",
        payload: { caseRef: modCase.id, allegedRule: modCase.ruleId },
      });
    }

    // The public resolution record — nullifier-keyed rulings, no handles.
    await appendEvent(tx, {
      actorType: "system",
      eventType: "case.resolved",
      payload: {
        caseRef: modCase.id,
        outcome: input.outcome,
        rule: input.citedRuleId,
        rulings: modCase.rulings
          .filter((r) => ["none", "confirmed"].includes(r.supervision))
          .map((r) => ({ nullifier: r.moderatorNullifier, verdict: r.verdict })),
      },
    });

    // Where ruling notifications point: the post, or the DM thread
    // (both parties already know the thread exists — nothing leaks).
    const excerpt = modCase.dmExcerptId
      ? await tx.dmExcerpt.findUniqueOrThrow({ where: { id: modCase.dmExcerptId } })
      : null;
    const notifyRef = post
      ? { refType: "post", refId: post.id }
      : { refType: "dm-thread", refId: excerpt!.threadId };

    // Deposits: refunded on upheld AND good-faith declined; forfeited
    // only on an explicit bad-faith ruling (DISCUSSIONS §7).
    for (const flag of modCase.flags) {
      const refund = flag.depositHeld > 0 && !input.badFaith;
      if (refund) {
        // Through the one door (economy.payFromTreasury) — a refund is
        // still the treasury spending, so it carries its category like
        // any other outflow.
        const paid = await payFromTreasury(tx, {
          profileId: flag.reporterProfileId,
          currency: "PC",
          amount: flag.depositHeld,
          kind: "refund.flag",
          budgetCategory: BUDGET_MODERATION_REWARDS,
          refType: "flag",
          refId: flag.id,
        });
        if (!paid.ok) throw new Error(`Flag refund refused: ${paid.reason}`);
      }
      await tx.flag.update({
        where: { id: flag.id },
        data: { status: refund ? "refunded" : flag.depositHeld > 0 ? "forfeited" : "settled" },
      });
      await notify(tx, {
        profileId: flag.reporterProfileId,
        tier: "time-sensitive",
        category: "ruling",
        title: "Your flag has been ruled",
        body:
          input.outcome === "upheld"
            ? `Upheld under ${input.citedRuleId}. ${flag.depositHeld > 0 ? "Your deposit is refunded." : ""}`
            : input.badFaith
              ? "Declined and ruled bad-faith — your deposit is forfeited to the treasury."
              : `Declined in good faith. ${flag.depositHeld > 0 ? "Your deposit is refunded." : ""}`,
        ...notifyRef,
      });
    }

    // The accused learns the ruling and the citation — never who.
    await notify(tx, {
      profileId: accused.profileId,
      tier: "time-sensitive",
      category: "ruling",
      title: input.outcome === "upheld" ? "A ruling on your content" : "Your content was reviewed and stands",
      body:
        input.outcome === "upheld"
          ? `${post ? "Removed" : "Upheld"} under ${input.citedRuleId}. You may appeal once${modCase.tier <= 2 ? "; a restorative option may be available" : ""}.`
          : post
            ? "A flag on your content was declined — it is visible again."
            : "A report on a message of yours was declined.",
      ...notifyRef,
    });

    // Rewards: per case RESOLVED, never per uphold — every effective
    // ruler is paid, treasury-funded, scaled by their (secret-weighted)
    // rating within the floor-and-cap rails.
    for (const ruling of modCase.rulings) {
      if (!["none", "confirmed"].includes(ruling.supervision)) continue;
      const total = await tx.ruling.count({
        where: { moderatorProfileId: ruling.moderatorProfileId, supervision: { in: ["none", "confirmed"] } },
      });
      const agreed = await tx.ruling.count({
        where: {
          moderatorProfileId: ruling.moderatorProfileId,
          supervision: { in: ["none", "confirmed"] },
          case: { status: "resolved" },
        },
      });
      const agreementRate = total > 0 ? agreed / total : 0.5;
      const reward =
        Math.round(caseRewardG * ratingMultiplier(agreementRate, multiplierMax) * 100) / 100;
      const paidReward = await payFromTreasury(tx, {
        profileId: ruling.moderatorProfileId,
        currency: "G",
        amount: reward,
        kind: "reward.moderation",
        budgetCategory: BUDGET_MODERATION_REWARDS,
        refType: "case",
        refId: modCase.id,
      });
      if (!paidReward.ok) throw new Error(`Badge reward refused: ${paidReward.reason}`);
      const term = await tx.badgeTerm.findFirst({
        where: { profileId: ruling.moderatorProfileId },
        orderBy: { startedAt: "desc" },
      });
      if (term) {
        await tx.badgeTerm.update({
          where: { id: term.id },
          data: { casesCompleted: { increment: 1 }, gratiumEarned: { increment: reward } },
        });
      }
    }
  });
}

/** The auto-applied ladder (§7) — the moderator never sentences. */
async function applyStrikeLadder(
  tx: Tx,
  input: { profileId: string; pillarId: string; tier: number; caseId: string }
): Promise<void> {
  const decayMonths = await getRail(tx, "moderation.strikeDecayMonths");
  const decaysAt = new Date(Date.now() + decayMonths * 30 * 86_400_000);
  const active = await tx.strike.count({
    where: { profileId: input.profileId, decaysAt: { gt: new Date() }, restorative: false },
  });
  const strikeNumber = active + 1;

  await tx.strike.create({
    data: {
      profileId: input.profileId,
      pillarId: input.pillarId,
      tier: input.tier,
      caseId: input.caseId,
      decaysAt,
    },
  });

  const [p1, p2, ls1, ls2, rateLimitHours, readOnlyDays] = await Promise.all([
    getRail(tx, "moderation.strike1PenaltyG"),
    getRail(tx, "moderation.strike2PenaltyG"),
    getRail(tx, "moderation.strike1LsDeduction"),
    getRail(tx, "moderation.strike2LsDeduction"),
    getRail(tx, "moderation.rateLimitHours"),
    getRail(tx, "moderation.readOnlyDays"),
  ]);

  const penaltyG = strikeNumber === 1 ? p1 : p2;
  const lsBase = strikeNumber === 1 ? ls1 : ls2;

  // Gratium penalty — clamped at the balance; penalties never create debt.
  const balance = await tx.balance.findUnique({
    where: { profileId_currency: { profileId: input.profileId, currency: "G" } },
  });
  const charge = Math.min(penaltyG, balance?.amount ?? 0);
  if (charge > 0) {
    await tx.balance.update({
      where: { profileId_currency: { profileId: input.profileId, currency: "G" } },
      data: { amount: { decrement: charge } },
    });
    await tx.treasuryBalance.upsert({
      where: { currency: "G" },
      create: { currency: "G", amount: charge },
      update: { amount: { increment: charge } },
    });
    await tx.economyEntry.create({
      data: {
        kind: "penalty.strike",
        currency: "G",
        amount: charge,
        fromProfileId: input.profileId,
        toTreasury: true,
        refType: "case",
        refId: input.caseId,
      },
    });
  }

  // Light Score deduction — pillar-scoped, tier-scaled, decaying on the
  // strike clock; the Phase 7 engine consumes these records.
  await tx.lightScoreAdjustment.create({
    data: {
      profileId: input.profileId,
      pillarId: input.pillarId,
      amount: -(lsBase * input.tier),
      caseId: input.caseId,
      decaysAt,
    },
  });

  if (strikeNumber === 2) {
    await tx.profile.update({
      where: { id: input.profileId },
      data: { rateLimitedUntil: new Date(Date.now() + rateLimitHours * 3_600_000) },
    });
  }
  if (strikeNumber >= 3) {
    await tx.profile.update({
      where: { id: input.profileId },
      data: { readOnlyUntil: new Date(Date.now() + readOnlyDays * 86_400_000) },
    });
    // Tribunal review of the third strike (§7 ladder) — the docket
    // entry carries the originating case's evidence, whichever kind.
    const origin = await tx.modCase.findUniqueOrThrow({ where: { id: input.caseId } });
    await tx.modCase.create({
      data: {
        postId: origin.postId,
        dmExcerptId: origin.dmExcerptId,
        ruleId: "R3.6", // placeholder docket entry: severe-lane review
        tier: 3,
        tribunal: true,
      },
    });
  }
}

export async function activeStrikeCount(db: PrismaClient, profileId: string) {
  return db.strike.count({
    where: { profileId, decaysAt: { gt: new Date() }, restorative: false },
  });
}

// ---------------------------------------------------------------- appeals

export async function appealCase(
  db: PrismaClient,
  input: { caseId: string; profileId: string }
): Promise<{ ok: true; appealCaseId: string } | { ok: false; reason: string }> {
  const original = await db.modCase.findUnique({
    where: { id: input.caseId },
    include: { appealedBy: true },
  });
  if (!original || original.status !== "resolved") {
    return { ok: false, reason: "Nothing to appeal." };
  }
  if (original.appealedBy) {
    return { ok: false, reason: "One appeal per ruling — this case has had its appeal." };
  }
  const accused = await accusedOf(db, original);
  if (accused.profileId !== input.profileId) {
    return { ok: false, reason: "Only the accused may appeal." };
  }

  const deposit = await getRail(db, "tribunal.appealDepositPc");
  try {
    const appeal = await db.$transaction(async (tx) => {
      const charged = await chargeToTreasury(tx, {
        profileId: input.profileId,
        currency: "PC",
        amount: deposit,
        kind: "deposit.appeal",
        refType: "case",
        refId: original.id,
      });
      if (!charged.ok) throw new Error(charged.reason);
      return tx.modCase.create({
        data: {
          postId: original.postId,
          dmExcerptId: original.dmExcerptId,
          ruleId: original.ruleId,
          tier: original.tier,
          heavy: original.heavy,
          // Severe rulings appeal to the Tribunal; routine to fresh eyes.
          tribunal: original.tier === 3 || original.tribunal,
          appealOfId: original.id,
        },
      });
    });
    await db.modCase.update({
      where: { id: original.id },
      data: { status: "appealed" },
    });
    return { ok: true, appealCaseId: appeal.id };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

/** On appeal resolution: if the outcome changed, reverse consequences
 *  and refund the deposit; if not, the deposit was the price of a
 *  baseless appeal. */
export async function settleAppeal(db: PrismaClient, appealCaseId: string): Promise<void> {
  const appeal = await db.modCase.findUniqueOrThrow({
    where: { id: appealCaseId },
    include: { appealOf: true },
  });
  if (appeal.status !== "resolved" || !appeal.appealOf) return;
  const original = appeal.appealOf;
  const changed = appeal.outcome !== original.outcome;
  const post = appeal.postId
    ? await db.post.findUniqueOrThrow({ where: { id: appeal.postId } })
    : null;

  await db.$transaction(async (tx) => {
    const depositEntry = await tx.economyEntry.findFirst({
      where: { kind: "deposit.appeal", refId: original.id },
    });
    if (changed && depositEntry) {
      // The appeal deposit returns when the Tribunal changes the ruling
      // (POLLS §8). Through the one door — a refund is the treasury
      // spending, and it carries its category like every other outflow.
      const refunded = await payFromTreasury(tx, {
        profileId: depositEntry.fromProfileId!,
        currency: "PC",
        amount: depositEntry.amount,
        kind: "refund.appeal",
        budgetCategory: BUDGET_TRIBUNAL_STIPENDS,
        refType: "case",
        refId: original.id,
      });
      if (!refunded.ok) throw new Error(`Appeal refund refused: ${refunded.reason}`);
    }
    // Original upheld, appeal says otherwise → restore and unwind.
    // (DM cases have no content to restore; the personal consequences
    // unwind identically.)
    if (changed && original.outcome === "upheld") {
      if (post) {
        await tx.post.update({ where: { id: post.id }, data: { status: "visible" } });
      }
      await tx.strike.deleteMany({ where: { caseId: original.id } });
      await tx.lightScoreAdjustment.deleteMany({ where: { caseId: original.id } });
      await appendEvent(tx, {
        actorType: "system",
        eventType: "appeal.reversed",
        payload: { caseRef: original.id, appealRef: appeal.id },
      });
    }
  });
}

// --------------------------------------------------------------- tribunal

/** Interim seating (BUILD_ORDER Phase 5): sortition from all
 *  badge-completers while the early cohort is small; rating threshold
 *  takes over as track records accumulate. */
export async function seatTribunal(db: PrismaClient): Promise<void> {
  const [seats, termDays, stipendG] = await Promise.all([
    getRail(db, "tribunal.seats"),
    getRail(db, "tribunal.termDays"),
    getRail(db, "tribunal.stipendG"),
  ]);
  const now = new Date();
  const seated = await db.tribunalSeat.count({ where: { termEnd: { gt: now } } });
  const docket = await db.modCase.count({ where: { tribunal: true, status: "open" } });
  if (docket === 0 || seated >= seats) return;

  const completers = await db.badgeTerm.findMany({
    where: { casesCompleted: { gt: 0 } },
    select: { profileId: true },
    distinct: ["profileId"],
  });
  const currentSeats = await db.tribunalSeat.findMany({
    where: { termEnd: { gt: now } },
    select: { profileId: true },
  });
  const seatedIds = new Set(currentSeats.map((s) => s.profileId));
  const eligible = completers.filter((c) => !seatedIds.has(c.profileId));
  const shuffled = eligible.sort(() => Math.random() - 0.5);
  const toSeat = shuffled.slice(0, seats - seated);

  for (const candidate of toSeat) {
    await db.$transaction(async (tx) => {
      await tx.tribunalSeat.create({
        data: {
          profileId: candidate.profileId,
          termEnd: new Date(now.getTime() + termDays * 86_400_000),
        },
      });
      // Treasury-paid stipend per term (service is compensated, never
      // charged) — through the one door, carrying its category.
      const paidStipend = await payFromTreasury(tx, {
        profileId: candidate.profileId,
        currency: "G",
        amount: stipendG,
        kind: "stipend.tribunal",
        budgetCategory: BUDGET_TRIBUNAL_STIPENDS,
      });
      if (!paidStipend.ok) throw new Error(`Tribunal stipend refused: ${paidStipend.reason}`);
    });
  }
}

export async function isTribunalMember(db: PrismaClient, profileId: string) {
  const seat = await db.tribunalSeat.findFirst({
    where: { profileId, termEnd: { gt: new Date() } },
  });
  return seat !== null;
}

export async function tribunalDocket(db: PrismaClient) {
  return db.modCase.findMany({
    where: { tribunal: true, status: "open" },
    orderBy: [{ expedited: "desc" }, { createdAt: "asc" }],
  });
}

/** Tribunal rulings reuse submitRuling's machinery; resolution needs a
 *  majority of SEATED members (quorum 4/7 interim: majority of current
 *  seats). */
export async function submitTribunalRuling(
  db: PrismaClient,
  input: RulingInput
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!(await isTribunalMember(db, input.profileId))) {
    return { ok: false, reason: "Tribunal members only." };
  }
  const modCase = await db.modCase.findUnique({
    where: { id: input.caseId },
    include: { flags: true },
  });
  if (!modCase || !modCase.tribunal || modCase.status !== "open") {
    return { ok: false, reason: "Not an open Tribunal case." };
  }
  if (input.verdict === "uphold" && !input.citedRuleId) {
    return { ok: false, reason: "An uphold must cite a specific rule." };
  }
  const gate = await clearGate(db, {
    profileId: input.profileId,
    scope: `ruling:${modCase.id}`,
    scopeKind: "per-profile",
    ledgerRecording: "private",
  });
  if (gate.outcome === "DUPLICATE") {
    return { ok: false, reason: "You have already ruled on this case." };
  }
  if (gate.outcome !== "CLEARED" || !gate.nullifier) {
    return { ok: false, reason: `Gate: ${gate.outcome}` };
  }
  await db.ruling.create({
    data: {
      caseId: modCase.id,
      moderatorNullifier: gate.nullifier,
      moderatorProfileId: input.profileId,
      verdict: input.verdict,
      citedRuleId: input.citedRuleId ?? null,
      badFaithFlag: input.badFaithFlag ?? false,
      supervision: "none",
    },
  });

  const seatedNow = await db.tribunalSeat.count({ where: { termEnd: { gt: new Date() } } });
  const rulings = await db.ruling.count({ where: { caseId: modCase.id } });
  const quorum = Math.floor(seatedNow / 2) + 1;
  if (rulings >= quorum) {
    const all = await db.ruling.findMany({ where: { caseId: modCase.id } });
    const upholds = all.filter((r) => r.verdict === "uphold").length;
    const outcome = upholds >= quorum ? "upheld" : "declined";
    const cited =
      all.find((r) => r.verdict === "uphold" && r.citedRuleId)?.citedRuleId ?? modCase.ruleId;
    await resolveCase(db, {
      caseId: modCase.id,
      outcome,
      citedRuleId: cited,
      badFaith: outcome === "declined" && all.some((r) => r.badFaithFlag),
    });
    await settleAppeal(db, modCase.id);
  }
  return { ok: true };
}

// ------------------------------------------------------------- restorative

/** The restorative option (§7): for mid-tier violations, acknowledge and
 *  append the correction where the harm happened, for a reduced strike.
 *  Offered, never forced. */
export async function acceptRestorative(
  db: PrismaClient,
  input: { caseId: string; profileId: string; correction: string }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const modCase = await db.modCase.findUnique({ where: { id: input.caseId } });
  if (!modCase || modCase.outcome !== "upheld" || modCase.tier > 2) {
    return { ok: false, reason: "The restorative option applies to upheld mid-tier cases." };
  }
  const strike = await db.strike.findFirst({
    where: { caseId: modCase.id, profileId: input.profileId, restorative: false },
  });
  if (!strike) return { ok: false, reason: "No active strike on this case for you." };
  const correction = input.correction.trim();
  if (!correction) return { ok: false, reason: "The correction needs words." };

  const profile = await db.profile.findUniqueOrThrow({ where: { id: input.profileId } });

  const gate = await clearGate(db, {
    profileId: input.profileId,
    scope: `restorative:${modCase.id}`,
    scopeKind: "per-profile",
    ledgerRecording: "private",
  });
  if (gate.outcome !== "CLEARED") return { ok: false, reason: `Gate: ${gate.outcome}` };

  await db.$transaction(async (tx) => {
    const body = `[Restorative correction] ${correction}`;
    if (modCase.postId) {
      const post = await tx.post.findUniqueOrThrow({ where: { id: modCase.postId } });
      const graceMinutes = await getRail(tx, "discussion.graceWindowMinutes");
      const discussion = await tx.discussion.findUniqueOrThrow({
        where: { id: post.discussionId },
      });
      // The correction is appended where the harm happened — remediation,
      // not participation: no fee. In a permanent space it is hash-
      // committed like every other permanent record.
      const created = await tx.post.create({
        data: {
          discussionId: post.discussionId,
          parentId: post.id,
          authorProfileId: profile.id,
          authorHandle: profile.handle,
          authorDisplayName: profile.displayName,
          body,
          editableUntil: new Date(Date.now() + graceMinutes * 60_000),
        },
      });
      if (discussion.permanence.startsWith("permanent")) {
        await appendEvent(tx, {
          actorType: "soul",
          actorId: profile.handle,
          eventType: "post.recorded",
          payload: {
            discussionRef: post.discussionId,
            postRef: created.id,
            contentHash: contentHash(body),
            handle: profile.handle,
            displayName: profile.displayName,
            restorative: true,
          },
        });
      }
    } else if (modCase.dmExcerptId) {
      // DM case: the harm happened in the thread — the correction is
      // appended there, fee-exempt, encrypted like any message.
      const excerpt = await tx.dmExcerpt.findUniqueOrThrow({
        where: { id: modCase.dmExcerptId },
      });
      const thread = await tx.dmThread.findUniqueOrThrow({
        where: { id: excerpt.threadId },
      });
      const { threadKeyFor, sealMessage } = await import("./dmCrypto");
      const threadKey = await threadKeyFor(tx, thread);
      await tx.dmMessage.create({
        data: {
          threadId: thread.id,
          senderProfileId: profile.id,
          ciphertext: sealMessage(threadKey, thread.id, profile.id, body),
        },
      });
      await tx.dmThread.update({
        where: { id: thread.id },
        data: { lastMessageAt: new Date() },
      });
    }
    await tx.strike.update({
      where: { id: strike.id },
      data: { restorative: true },
    });
    // Reduced, not erased: half the Light Score deduction comes back.
    const adjustment = await tx.lightScoreAdjustment.findFirst({
      where: { caseId: modCase.id, profileId: input.profileId },
    });
    if (adjustment) {
      await tx.lightScoreAdjustment.update({
        where: { id: adjustment.id },
        data: { amount: adjustment.amount / 2 },
      });
    }
    // Public-record only for public content: a DM case's ruling is
    // known to its parties alone, so no ledger event may name the
    // accused (the correction lives in the private thread).
    if (!modCase.postId) return;
    await appendEvent(tx, {
      actorType: "soul",
      actorId: profile.handle,
      eventType: "restorative.accepted",
      payload: { caseRef: modCase.id, handle: profile.handle },
    });
  });
  return { ok: true };
}

// --------------------------------------------------------------- sentinel

/** Sentinel v1 (§11): brigade detection only. Anomalies never punish —
 *  they bundle to the Tribunal, labeled machine-flagged. */
async function sentinelSweep(db: PrismaClient): Promise<void> {
  const [threshold, windowHours] = await Promise.all([
    getRail(db, "sentinel.brigadeFlagThreshold"),
    getRail(db, "sentinel.brigadeWindowHours"),
  ]);
  const since = new Date(Date.now() - windowHours * 3_600_000);
  const cases = await db.modCase.findMany({
    where: { status: "open", sentinelBundled: false, tribunal: false },
    include: { flags: { where: { createdAt: { gte: since } } } },
  });
  for (const c of cases) {
    const distinct = new Set(c.flags.map((f) => f.reporterProfileId)).size;
    if (distinct >= threshold) {
      await db.modCase.update({
        where: { id: c.id },
        data: { sentinelBundled: true, tribunal: true },
      });
    }
  }
}

/** Self-visible Moderation Rating (§6.5): inputs and trend, never public,
 *  never the weights. */
export async function myModerationRating(db: PrismaClient, profileId: string) {
  const max = await getRail(db, "moderation.ratingMultiplierMax");
  const total = await db.ruling.count({
    where: { moderatorProfileId: profileId, supervision: { in: ["none", "confirmed"] } },
  });
  const resolved = await db.ruling.count({
    where: {
      moderatorProfileId: profileId,
      supervision: { in: ["none", "confirmed"] },
      case: { status: "resolved" },
    },
  });
  const overridden = await db.ruling.count({
    where: { moderatorProfileId: profileId, supervision: "overridden" },
  });
  const agreementRate = total > 0 ? resolved / total : 0.5;
  return {
    casesRuled: total,
    resolvedWithOutcome: resolved,
    supervisionOverrides: overridden,
    rewardMultiplier: Math.round(ratingMultiplier(agreementRate, max) * 100) / 100,
  };
}

export type { Prisma };
