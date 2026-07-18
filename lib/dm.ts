// Direct Messages (Phase 6.5 — FELLOW_SOULS_AND_DM_SPEC §5).
//
// Profile-to-profile, any face combination. Encrypted at rest
// (lib/dmCrypto.ts — Phase A escrow posture, disclosed verbatim);
// initiator pays to open a thread, every sender pays the per-message
// micro-fee; recipients never pay to receive or reply. Strangers
// arrive as requests (the x.com pattern); fellow souls land direct.
// Not public record: private, deletable by each side for themselves,
// metadata per-profile only — and NOTHING here ever reaches the
// public ledger (private gate recordings, blinded fee entries).
//
// Recipient-side reporting (§5.1): the recipient reveals a specific
// message's plaintext as a frozen DmExcerpt; the excerpt feeds the
// STANDARD flag path — deposit rules, badge adjudication, anonymity
// protections unchanged.

import { randomUUID } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { clearGateTx, isGateDuplicateError } from "./gate";
import { getRail } from "./rails";
import { hasPostingConsents } from "./consent";
import { chargeToTreasury, maybeFirstActionGrant } from "./economy";
import { accrueForAction } from "./accrual";
import { notify } from "./notifications";
import {
  areFellowSouls,
  isBlocked,
  pairOf,
  type SocialResult,
} from "./fellowSouls";
import {
  ensureDmKeypair,
  threadKeyFor,
  sealMessage,
  openMessage,
} from "./dmCrypto";

export { DM_PHASE_A_DISCLOSURE } from "./dmCrypto";

type ThreadRow = {
  id: string;
  pairKey: string;
  initiatorProfileId: string;
  otherProfileId: string;
  status: string;
  initiatorMuted: boolean;
  otherMuted: boolean;
  initiatorDeletedAt: Date | null;
  otherDeletedAt: Date | null;
  createdAt: Date;
  lastMessageAt: Date;
};

function sideOf(thread: ThreadRow, profileId: string): "initiator" | "other" | null {
  if (thread.initiatorProfileId === profileId) return "initiator";
  if (thread.otherProfileId === profileId) return "other";
  return null;
}

// ------------------------------------------------------------------ threads

/**
 * Open (or reuse) the thread to another soul and send the first
 * message. Fellow souls: the thread opens directly. Strangers: it
 * arrives as a request — the recipient can reply (opens it), ignore,
 * or decline. Initiator pays the thread fee once, plus the per-message
 * fee like any sender.
 */
export async function openThread(
  db: PrismaClient,
  input: { fromProfileId: string; toHandle: string; body: string }
): Promise<SocialResult<{ threadId: string }>> {
  const body = input.body.trim();
  if (!body) return { ok: false, reason: "Say something." };
  const from = await db.profile.findUnique({ where: { id: input.fromProfileId } });
  if (!from || from.status !== "active") return { ok: false, reason: "No active face." };
  if (!(await hasPostingConsents(db, from.id))) {
    return { ok: false, reason: "The permanence and Constitution acknowledgments come first." };
  }
  const to = await db.profile.findUnique({
    where: { handle: input.toHandle.trim().replace(/^@/, "").toLowerCase() },
  });
  if (!to || to.status !== "active") {
    return { ok: false, reason: "No soul answers to that handle." };
  }
  if (to.id === from.id) return { ok: false, reason: "Your own counsel is always free." };
  // Quiet block enforcement (§5.2): neutral refusal, never a notice.
  if (await isBlocked(db, to.id, from.id)) {
    return { ok: false, reason: "This message can't be delivered." };
  }

  const { key } = pairOf(from.id, to.id);
  const existing = await db.dmThread.findUnique({ where: { pairKey: key } });
  if (existing) {
    if (existing.status === "declined") {
      return { ok: false, reason: "This message can't be delivered." };
    }
    // Thread already exists — this is just a message into it.
    const sent = await sendMessage(db, {
      threadId: existing.id,
      senderProfileId: from.id,
      body,
    });
    return sent.ok ? { ok: true, threadId: existing.id } : sent;
  }

  const bonded = await areFellowSouls(db, from.id, to.id);

  // Gate spend + fees + thread + first message share one transaction (#25),
  // so a rollback leaves no orphan spend.
  try {
    return await db.$transaction(async (tx) => {
      const gate = await clearGateTx(tx, {
        profileId: from.id,
        scope: `dm-thread:${randomUUID()}`,
        scopeKind: "per-profile",
        ledgerRecording: "private",
      });
      if (gate.outcome !== "CLEARED") return { ok: false as const, reason: `Gate: ${gate.outcome}` };
      // Initiator pays — blinded entries, no counterparty reference.
      const threadFee = await chargeToTreasury(tx, {
        profileId: from.id,
        currency: "PC",
        amount: await getRail(tx, "dm.threadFee"),
        kind: "fee.dm-thread",
      });
      if (!threadFee.ok) throw new Error(threadFee.reason);
      const messageFee = await chargeToTreasury(tx, {
        profileId: from.id,
        currency: "PC",
        amount: await getRail(tx, "dm.messageFee"),
        kind: "fee.dm-message",
      });
      if (!messageFee.ok) throw new Error(messageFee.reason);
      await maybeFirstActionGrant(tx, from.id);
      await accrueForAction(tx, from.id);

      await ensureDmKeypair(tx, from.id);
      await ensureDmKeypair(tx, to.id);

      const thread = await tx.dmThread.create({
        data: {
          pairKey: key,
          initiatorProfileId: from.id,
          otherProfileId: to.id,
          status: bonded ? "open" : "request",
        },
      });
      const threadKey = await threadKeyFor(tx, thread);
      await tx.dmMessage.create({
        data: {
          threadId: thread.id,
          senderProfileId: from.id,
          ciphertext: sealMessage(threadKey, thread.id, from.id, body),
        },
      });

      // §5.3: fellow-soul DMs are time-sensitive (a human is waiting);
      // stranger requests wait quietly. Aggregated per thread — content
      // never rides a notification.
      await notify(tx, {
        profileId: to.id,
        tier: bonded ? "time-sensitive" : "quiet",
        category: bonded ? "dm" : "request",
        title: bonded
          ? `A message from a fellow soul`
          : "A stranger opened a conversation",
        body: bonded
          ? "A fellow soul wrote to you — the message is in your threads."
          : "It waits in your Requests. Reply to open the thread, ignore it, or decline — all free.",
        refType: "dm-thread",
        refId: thread.id,
        aggregationKey: `dm:${thread.id}`,
      });
      return { ok: true as const, threadId: thread.id };
    });
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

/** Send a message into an existing thread. Senders pay the per-message
 *  rail; replying to a request thread OPENS it (§5.1). */
export async function sendMessage(
  db: PrismaClient,
  input: { threadId: string; senderProfileId: string; body: string }
): Promise<SocialResult> {
  const body = input.body.trim();
  if (!body) return { ok: false, reason: "Say something." };
  const thread = await db.dmThread.findUnique({ where: { id: input.threadId } });
  if (!thread) return { ok: false, reason: "No such thread." };
  const side = sideOf(thread, input.senderProfileId);
  if (!side) return { ok: false, reason: "Not your thread." };
  if (thread.status === "declined") {
    return { ok: false, reason: "This conversation is closed." };
  }
  // A request thread only carries more messages once the RECIPIENT
  // replies — the initiator cannot pile on while it waits (§2.3's
  // no-pressure discipline, applied to stranger threads).
  if (thread.status === "request" && side === "initiator") {
    return { ok: false, reason: "Your message waits with the request — one voice, once, until they answer." };
  }
  const otherId =
    side === "initiator" ? thread.otherProfileId : thread.initiatorProfileId;
  if (await isBlocked(db, otherId, input.senderProfileId)) {
    return { ok: false, reason: "This message can't be delivered." };
  }
  const profile = await db.profile.findUniqueOrThrow({
    where: { id: input.senderProfileId },
  });
  if (profile.status !== "active") return { ok: false, reason: "No active face." };

  // Gate spend + fee + message share one transaction (#25).
  try {
    return await db.$transaction(async (tx) => {
      const gate = await clearGateTx(tx, {
        profileId: profile.id,
        scope: `dm-message:${randomUUID()}`,
        scopeKind: "per-profile",
        ledgerRecording: "private",
      });
      if (gate.outcome !== "CLEARED") return { ok: false as const, reason: `Gate: ${gate.outcome}` };
      const fee = await chargeToTreasury(tx, {
        profileId: profile.id,
        currency: "PC",
        amount: await getRail(tx, "dm.messageFee"),
        kind: "fee.dm-message",
      });
      if (!fee.ok) throw new Error(fee.reason);
      await accrueForAction(tx, profile.id);

      const opensRequest = thread.status === "request" && side === "other";
      if (opensRequest) {
        await tx.dmThread.update({
          where: { id: thread.id },
          data: { status: "open" },
        });
      }
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

      // Notify the other side unless they muted the thread (§5.2).
      const otherMuted =
        side === "initiator" ? thread.otherMuted : thread.initiatorMuted;
      if (!otherMuted) {
        const bonded = await areFellowSouls(tx, thread.initiatorProfileId, thread.otherProfileId);
        await notify(tx, {
          profileId: otherId,
          tier: bonded ? "time-sensitive" : "quiet",
          category: bonded ? "dm" : "request",
          title: bonded ? "A message from a fellow soul" : "A reply in your thread",
          body: "New words in your thread.",
          refType: "dm-thread",
          refId: thread.id,
          aggregationKey: `dm:${thread.id}`,
        });
      }
      return { ok: true as const };
    });
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

/** Decline a request thread (free, quiet — the initiator learns nothing
 *  beyond silence). */
export async function declineThread(
  db: PrismaClient,
  input: { threadId: string; profileId: string }
): Promise<SocialResult> {
  const thread = await db.dmThread.findUnique({ where: { id: input.threadId } });
  if (!thread || thread.otherProfileId !== input.profileId) {
    return { ok: false, reason: "Not your request." };
  }
  if (thread.status !== "request") return { ok: false, reason: "This thread has settled." };
  await db.dmThread.update({
    where: { id: thread.id },
    data: { status: "declined" },
  });
  return { ok: true };
}

/** Per-thread mute (§5.2): thread stays, notifications stop. */
export async function setThreadMute(
  db: PrismaClient,
  input: { threadId: string; profileId: string; muted: boolean }
): Promise<SocialResult> {
  const thread = await db.dmThread.findUnique({ where: { id: input.threadId } });
  if (!thread) return { ok: false, reason: "No such thread." };
  const side = sideOf(thread, input.profileId);
  if (!side) return { ok: false, reason: "Not your thread." };
  await db.dmThread.update({
    where: { id: thread.id },
    data: side === "initiator" ? { initiatorMuted: input.muted } : { otherMuted: input.muted },
  });
  return { ok: true };
}

/** Delete-for-me (§5.1): hides everything up to now from THIS side
 *  only; the other soul's copy is theirs. */
export async function deleteThreadForMe(
  db: PrismaClient,
  input: { threadId: string; profileId: string }
): Promise<SocialResult> {
  const thread = await db.dmThread.findUnique({ where: { id: input.threadId } });
  if (!thread) return { ok: false, reason: "No such thread." };
  const side = sideOf(thread, input.profileId);
  if (!side) return { ok: false, reason: "Not your thread." };
  await db.dmThread.update({
    where: { id: thread.id },
    data:
      side === "initiator"
        ? { initiatorDeletedAt: new Date() }
        : { otherDeletedAt: new Date() },
  });
  return { ok: true };
}

// ------------------------------------------------------------------ reading

/** The viewer's threads, split into inbox and requests (§5.1). Only
 *  ever for the profile asking about itself. */
export async function threadsFor(db: PrismaClient, profileId: string) {
  const threads = await db.dmThread.findMany({
    where: {
      OR: [{ initiatorProfileId: profileId }, { otherProfileId: profileId }],
      status: { not: "declined" },
    },
    orderBy: { lastMessageAt: "desc" },
  });
  const otherIds = threads.map((t) =>
    t.initiatorProfileId === profileId ? t.otherProfileId : t.initiatorProfileId
  );
  const others = await db.profile.findMany({
    where: { id: { in: otherIds } },
    select: { id: true, handle: true, displayName: true },
  });
  const otherById = new Map(others.map((o) => [o.id, o]));
  const decorated = threads.map((t) => {
    const side = sideOf(t, profileId)!;
    const deletedAt = side === "initiator" ? t.initiatorDeletedAt : t.otherDeletedAt;
    return {
      id: t.id,
      status: t.status,
      side,
      muted: side === "initiator" ? t.initiatorMuted : t.otherMuted,
      deletedAt,
      lastMessageAt: t.lastMessageAt,
      other:
        otherById.get(
          t.initiatorProfileId === profileId ? t.otherProfileId : t.initiatorProfileId
        ) ?? null,
    };
  });
  return {
    // Requests area: stranger threads awaiting THIS soul's answer.
    requests: decorated.filter((t) => t.status === "request" && t.side === "other"),
    inbox: decorated.filter((t) => !(t.status === "request" && t.side === "other")),
  };
}

/** Decrypt a thread for one of its two members — never anyone else.
 *  Respects that side's delete-for-me horizon. */
export async function readThread(
  db: PrismaClient,
  input: { threadId: string; profileId: string }
): Promise<SocialResult<{
  thread: {
    id: string;
    status: string;
    muted: boolean;
    viewerIsInitiator: boolean;
    otherHandle: string;
    otherDisplayName: string;
  };
  messages: Array<{ id: string; mine: boolean; body: string; createdAt: Date }>;
}>> {
  const thread = await db.dmThread.findUnique({ where: { id: input.threadId } });
  if (!thread) return { ok: false, reason: "No such thread." };
  const side = sideOf(thread, input.profileId);
  if (!side) return { ok: false, reason: "Not your thread." };

  const deletedAt = side === "initiator" ? thread.initiatorDeletedAt : thread.otherDeletedAt;
  const rows = await db.dmMessage.findMany({
    where: {
      threadId: thread.id,
      ...(deletedAt ? { createdAt: { gt: deletedAt } } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
  const threadKey = await threadKeyFor(db, thread);
  const messages = rows.map((m) => ({
    id: m.id,
    mine: m.senderProfileId === input.profileId,
    body: openMessage(threadKey, thread.id, m.senderProfileId, m.ciphertext),
    createdAt: m.createdAt,
  }));
  const otherId =
    side === "initiator" ? thread.otherProfileId : thread.initiatorProfileId;
  const other = await db.profile.findUniqueOrThrow({
    where: { id: otherId },
    select: { handle: true, displayName: true },
  });
  return {
    ok: true,
    thread: {
      id: thread.id,
      status: thread.status,
      muted: side === "initiator" ? thread.initiatorMuted : thread.otherMuted,
      viewerIsInitiator: side === "initiator",
      otherHandle: other.handle,
      otherDisplayName: other.displayName,
    },
    messages,
  };
}

// ---------------------------------------------------------------- reporting

/**
 * Recipient-side reporting (§5.1): reveal ONE message's plaintext as a
 * frozen excerpt and file it through the standard flag path — deposit
 * rules, badge adjudication, anonymity protections unchanged. Only the
 * message's RECIPIENT may reveal it; you cannot report your own words.
 */
export async function reportMessage(
  db: PrismaClient,
  input: { messageId: string; profileId: string; ruleId: string; note?: string }
): Promise<SocialResult> {
  const message = await db.dmMessage.findUnique({
    where: { id: input.messageId },
    include: { thread: true },
  });
  if (!message) return { ok: false, reason: "No such message." };
  const side = sideOf(message.thread as ThreadRow, input.profileId);
  if (!side) return { ok: false, reason: "Not your thread." };
  if (message.senderProfileId === input.profileId) {
    return { ok: false, reason: "You cannot report your own words." };
  }
  const rule = await db.rule.findUnique({ where: { id: input.ruleId } });
  if (!rule) return { ok: false, reason: "Unknown rule — reports cite the rulebook." };

  // One report per message per recipient — the gate's fixed scope is the
  // enforcement, private like every flag.
  const threadKey = await threadKeyFor(db, message.thread);
  const plaintext = openMessage(
    threadKey,
    message.threadId,
    message.senderProfileId,
    message.ciphertext
  );

  // Gate spend + excerpt + deposit + flag + case share one transaction
  // (#25): a rollback no longer strands the report nullifier.
  try {
    return await db.$transaction(async (tx) => {
    const gate = await clearGateTx(tx, {
      profileId: input.profileId,
      scope: `flag:dm:${message.id}`,
      scopeKind: "per-profile",
      ledgerRecording: "private",
    });
    if (gate.outcome === "DUPLICATE") {
      return { ok: false as const, reason: "You have already reported this message." };
    }
    if (gate.outcome !== "CLEARED" || !gate.nullifier) {
      return { ok: false as const, reason: `Gate: ${gate.outcome}` };
    }
    const excerpt = await tx.dmExcerpt.create({
      data: {
        threadId: message.threadId,
        reporterProfileId: input.profileId,
        senderProfileId: message.senderProfileId,
        body: plaintext,
      },
    });
    // The refundable deposit — never blocked at zero (DISCUSSIONS §7).
    const depositAmount = await getRail(tx, "moderation.flagDeposit");
    const { balanceOf } = await import("./economy");
    let depositTaken = 0;
    if ((await balanceOf(tx, input.profileId, "PC")) >= depositAmount) {
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
    const flag = await tx.flag.create({
      data: {
        dmExcerptId: excerpt.id,
        ruleId: rule.id,
        note: input.note?.trim() || null,
        reporterProfileId: input.profileId,
        nullifier: gate.nullifier,
        depositHeld: depositTaken,
      },
    });
    const { openOrJoinCase } = await import("./moderation");
    await openOrJoinCase(tx, {
      flagId: flag.id,
      dmExcerptId: excerpt.id,
      ruleId: rule.id,
    });
    return { ok: true as const };
    });
  } catch (err) {
    if (isGateDuplicateError(err)) {
      return { ok: false, reason: "You have already reported this message." };
    }
    throw err;
  }
}
