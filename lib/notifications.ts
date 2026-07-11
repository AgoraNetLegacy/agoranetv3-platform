// Notifications (NOTIFICATIONS_SPEC.md) — two tiers, per-persona, the
// quietest functional defaults. Notifications serve the soul's actual
// interests, never pull them back: no streaks, no nags, no unread-count
// inflation, no third tier. The category list is exhaustive by design.
//
// Per-persona is the hard constraint: state is stored per-profile and
// rendered only to the active face (the parking rule scopes the inbox).
// High-volume events collapse into one updating entry (aggregationKey).
//
// In-app inbox is the launch channel; push is the ratified fast-follow.

import type { PrismaClient } from "@prisma/client";
import type { DbOrTx, Tx } from "./db";
import { getRail } from "./rails";

export type NotificationTier = "time-sensitive" | "quiet";

export async function notify(
  db: DbOrTx,
  input: {
    profileId: string;
    tier: NotificationTier;
    category: string;
    title: string;
    body: string;
    refType?: string;
    refId?: string;
    aggregationKey?: string;
  }
): Promise<void> {
  if (input.aggregationKey) {
    await db.notification.upsert({
      where: {
        profileId_aggregationKey: {
          profileId: input.profileId,
          aggregationKey: input.aggregationKey,
        },
      },
      create: {
        profileId: input.profileId,
        tier: input.tier,
        category: input.category,
        title: input.title,
        body: input.body,
        refType: input.refType,
        refId: input.refId,
        aggregationKey: input.aggregationKey,
      },
      // Genuinely new activity updates the one entry (never a storm) —
      // and returns it to unread once, since the content changed.
      update: {
        body: input.body,
        count: { increment: 1 },
        readAt: null,
        updatedAt: new Date(),
      },
    });
    return;
  }
  await db.notification.create({
    data: {
      profileId: input.profileId,
      tier: input.tier,
      category: input.category,
      title: input.title,
      body: input.body,
      refType: input.refType,
      refId: input.refId,
    },
  });
}

export async function markRead(
  db: PrismaClient,
  input: { profileId: string; notificationId: string }
): Promise<void> {
  await db.notification.updateMany({
    where: { id: input.notificationId, profileId: input.profileId },
    data: { readAt: new Date() },
  });
}

export async function inboxFor(db: PrismaClient, profileId: string) {
  const all = await db.notification.findMany({
    where: { profileId },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return {
    timeSensitive: all.filter((n) => n.tier === "time-sensitive"),
    quiet: all.filter((n) => n.tier === "quiet"),
    unread: all.filter((n) => !n.readAt).length,
  };
}

/**
 * "A poll you voted in is closing soon" (time-sensitive). Phase A: the
 * voter set derives from operator-space gate requests — disclosed
 * operator trust, used in the soul's own interest, never rendered.
 */
export async function notifyClosingPolls(db: PrismaClient): Promise<void> {
  const soonHours = await getRail(db, "notifications.pollClosingSoonHours");
  const soon = new Date(Date.now() + soonHours * 3_600_000);
  const closing = await db.poll.findMany({
    where: { status: "open", nominalCloseAt: { lte: soon, gt: new Date() } },
  });
  for (const poll of closing) {
    const voters = await db.gateRequest.findMany({
      where: { scope: `poll:${poll.id}`, status: "CLEARED" },
      select: { profileId: true },
    });
    for (const v of voters) {
      await notify(db, {
        profileId: v.profileId,
        tier: "time-sensitive",
        category: "poll-closing",
        title: "A poll you voted in is closing soon",
        body: `"${poll.title}" closes around ${poll.nominalCloseAt.toLocaleString()}.`,
        refType: "poll",
        refId: poll.id,
        aggregationKey: `poll-closing:${poll.id}`,
      });
    }
  }
}

/** Quiet: results published, to that poll's voters. */
export async function notifyPollResults(tx: Tx, pollId: string, title: string): Promise<void> {
  const voters = await tx.gateRequest.findMany({
    where: { scope: `poll:${pollId}`, status: "CLEARED" },
    select: { profileId: true },
  });
  for (const v of voters) {
    await notify(tx, {
      profileId: v.profileId,
      tier: "quiet",
      category: "poll-results",
      title: "Results published",
      body: `"${title}" has closed — results are on the poll page.`,
      refType: "poll",
      refId: pollId,
      aggregationKey: `poll-results:${pollId}`,
    });
  }
}
