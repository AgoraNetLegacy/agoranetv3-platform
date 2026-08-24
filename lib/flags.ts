// Flag capture; Phase 1 is queue-only: flags accumulate for Phase 5's
// adjudicators (BUILD_ORDER Phase 1). A flag cites a rulebook rule (the
// case category, MODERATION §3.1).
//
// A flag's existence is never public: the public sees only outcomes
// (triangle of blindness, MODERATION §3.2), so the gate runs in PRIVATE
// recording mode; humanity and one-flag-per-profile-per-content are
// enforced, but no ledger event exists. The flag is keyed by nullifier
// for Phase 5's nullifier-keyed handling; the reporter's profile id
// stays in Phase A operator space (deposit refunds will need it) and is
// never shown to moderators or anyone else.
//
// The flag deposit (rail "moderation.flagDeposit") wires up with Phase 4
// balances; flagging is never blocked by an empty balance (DISCUSSIONS §7).

import type { PrismaClient } from "@prisma/client";
import { clearGateTx, gateDuplicateConfirmed } from "./gate";
import { chargeToTreasury } from "./economy";
import { getRail } from "./rails";

export type FlagResult =
  | { ok: true; flagId: string }
  | { ok: false; reason: string };

export async function fileFlag(
  db: PrismaClient,
  input: {
    postId: string;
    profileId: string;
    ruleId: string;
    note?: string;
  }
): Promise<FlagResult> {
  const post = await db.post.findUnique({ where: { id: input.postId } });
  if (!post) return { ok: false, reason: "No such post." };

  const rule = await db.rule.findUnique({ where: { id: input.ruleId } });
  if (!rule) return { ok: false, reason: "Unknown rule; flags cite the rulebook." };

  // Gate and feature write share ONE transaction (#25): if anything below
  // rolls back, the humanity spend rolls back with it, so a retry is clean
  // rather than refused as a phantom DUPLICATE.
  try {
    return await db.$transaction(async (tx) => {
    const gate = await clearGateTx(tx, {
      profileId: input.profileId,
      scope: `flag:post:${post.id}`,
      scopeKind: "per-profile",
      ledgerRecording: "private",
    });
    if (gate.outcome === "DUPLICATE") {
      return { ok: false as const, reason: "You have already flagged this content." };
    }
    if (gate.outcome !== "CLEARED" || !gate.nullifier) {
      return { ok: false as const, reason: `Gate: ${gate.outcome}` };
    }

    // The refundable deposit; but flagging is NEVER blocked by an
    // empty balance (DISCUSSIONS §7): a zero-balance soul flags without
    // a deposit; pattern penalties fall back to rate-limiting, not debt.
    const depositAmount = await getRail(tx, "moderation.flagDeposit");
    const { balanceOf, creditsModeAvailable } = await import("./economy");
    let depositTaken = 0;
    const credits = await creditsModeAvailable(tx, input.profileId);
    if (credits.ok && (await balanceOf(tx, input.profileId, "PC")) >= depositAmount) {
      const deposit = await chargeToTreasury(tx, {
        profileId: input.profileId,
        currency: "PC",
        amount: depositAmount,
        kind: "deposit.flag",
        refType: "flag",
      });
      if (!deposit.ok) throw new Error(deposit.reason);
      depositTaken = depositAmount;
    }
    const created = await tx.flag.create({
      data: {
        postId: post.id,
        ruleId: rule.id,
        note: input.note?.trim() || null,
        reporterProfileId: input.profileId,
        nullifier: gate.nullifier,
        depositHeld: depositTaken,
      },
    });
    // Phase 5: the flag meets its adjudicators; open or join the
    // post's case; content blurs (or full-hides in the expedited lane).
    const { openOrJoinCase } = await import("./moderation");
    await openOrJoinCase(tx, {
      flagId: created.id,
      postId: post.id,
      ruleId: rule.id,
    });
    return { ok: true as const, flagId: created.id };
    });
  } catch (err) {
    if (await gateDuplicateConfirmed(db, err, { profileId: input.profileId, scope: `flag:post:${post.id}`, scopeKind: "per-profile" })) {
      return { ok: false, reason: "You have already flagged this content." };
    }
    throw err;
  }
}

/**
 * Report a mission payment (Phase 8.7, owner-ruled 2026-07-16).
 *
 * FUND_INTEGRITY §3.4 calls the freeze "the module's real teeth"; but a
 * case had no way to START. `Flag` accepted a post XOR a DM excerpt, and
 * a payment is neither. This is the missing door, and it was left unbuilt
 * until the owner ruled rather than guessed at (DECISIONS_PENDING #17).
 *
 * The evidence is the payment itself: its stated purpose, its amount, who
 * proposed it, who co-signed, and where it went; all already public on
 * the civic ledger. Nothing is blurred, unlike a post: **you cannot
 * un-see a payment, and pretending otherwise would be theatre.** The
 * consequence lives elsewhere; an upheld R3.4 ruling freezes whatever
 * that chamber has not yet paid out (`applyReleaseFreeze`).
 *
 * Same deposit, same triangle of blindness, same rulebook as every other
 * flag. A payment is not a special kind of accusation.
 */
export async function fileReleaseFlag(
  db: PrismaClient,
  input: {
    releaseId: string;
    profileId: string;
    ruleId: string;
    note?: string;
  }
): Promise<FlagResult> {
  const release = await db.missionRelease.findUnique({ where: { id: input.releaseId } });
  if (!release) return { ok: false, reason: "No such release." };

  const rule = await db.rule.findUnique({ where: { id: input.ruleId } });
  if (!rule) return { ok: false, reason: "Unknown rule; flags cite the rulebook." };

  try {
    return await db.$transaction(async (tx) => {
    const gate = await clearGateTx(tx, {
      profileId: input.profileId,
      scope: `flag:release:${release.id}`,
      scopeKind: "per-profile",
      ledgerRecording: "private",
    });
    if (gate.outcome === "DUPLICATE") {
      return { ok: false as const, reason: "You have already flagged this release." };
    }
    if (gate.outcome !== "CLEARED" || !gate.nullifier) {
      return { ok: false as const, reason: `Gate: ${gate.outcome}` };
    }

    const depositAmount = await getRail(tx, "moderation.flagDeposit");
    const { balanceOf, creditsModeAvailable } = await import("./economy");
    let depositTaken = 0;
    const credits = await creditsModeAvailable(tx, input.profileId);
    if (credits.ok && (await balanceOf(tx, input.profileId, "PC")) >= depositAmount) {
      const deposit = await chargeToTreasury(tx, {
        profileId: input.profileId,
        currency: "PC",
        amount: depositAmount,
        kind: "deposit.flag",
        refType: "flag",
      });
      if (!deposit.ok) throw new Error(deposit.reason);
      depositTaken = depositAmount;
    }
    const created = await tx.flag.create({
      data: {
        releaseId: release.id,
        ruleId: rule.id,
        note: input.note?.trim() || null,
        reporterProfileId: input.profileId,
        nullifier: gate.nullifier,
        depositHeld: depositTaken,
      },
    });
    const { openOrJoinCase } = await import("./moderation");
    await openOrJoinCase(tx, {
      flagId: created.id,
      releaseId: release.id,
      ruleId: rule.id,
    });
    return { ok: true as const, flagId: created.id };
    });
  } catch (err) {
    if (await gateDuplicateConfirmed(db, err, { profileId: input.profileId, scope: `flag:release:${release.id}`, scopeKind: "per-profile" })) {
      return { ok: false, reason: "You have already flagged this release." };
    }
    throw err;
  }
}
