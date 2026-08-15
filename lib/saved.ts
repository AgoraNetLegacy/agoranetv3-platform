// Saved threads; the Beacon's memory current (BEACON_FEED_SPEC §3.3,
// §4, owner-ratified 2026-07-21).
//
// The law of the save, enforced here structurally:
//   - Per-face and PRIVATE: every read keys on profileId; nothing in
//     this module can answer "who saved this thread" or "how many";
//     those queries deliberately do not exist.
//   - Never a ranking input for anyone else: no aggregate leaves this
//     module; the only thing a save ranks is the saving face's own
//     saved current.
//   - Free: no fee, no gate spend, no ledger event; a save is a
//     private act, not a civic one.
//   - Unsave is total: delete, no tombstone.

import type { PrismaClient } from "@prisma/client";
import type { DbOrTx } from "./db";
import { getRail } from "./rails";
import { roomAccess } from "./circles";
import { workshopAccess } from "./chambers";

/** Can this face read this thread right now? Public spaces are always
 *  readable; enclosed rooms require current membership; the same rule
 *  the thread page itself enforces. Load-bearing for saves: a saved
 *  enclosed room must stop leaking the moment the face loses access
 *  (privacy audit 2026-07-22). */
async function canRead(
  db: DbOrTx,
  discussion: {
    circleId: string | null;
    chamberId: string | null;
    circle?: { id: string; status: string } | null;
  },
  profileId: string
): Promise<boolean> {
  if (discussion.circleId) {
    if (!discussion.circle) return false;
    return (await roomAccess(db, discussion.circle, profileId)).read;
  }
  if (discussion.chamberId) {
    return workshopAccess(db, discussion.chamberId, profileId);
  }
  return true;
}

export async function saveDiscussion(
  db: DbOrTx,
  input: { profileId: string; discussionId: string }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const discussion = await db.discussion.findUnique({
    where: { id: input.discussionId },
    select: {
      id: true,
      circleId: true,
      chamberId: true,
      circle: { select: { id: true, status: true } },
    },
  });
  if (!discussion) return { ok: false, reason: "No such Discussion." };
  // You can only save what you can currently read; never a handle onto
  // an enclosed room you don't belong to.
  if (!(await canRead(db, discussion, input.profileId))) {
    return { ok: false, reason: "This Discussion can't be saved." };
  }
  await db.savedDiscussion.upsert({
    where: {
      profileId_discussionId: {
        profileId: input.profileId,
        discussionId: input.discussionId,
      },
    },
    create: { profileId: input.profileId, discussionId: input.discussionId },
    update: {}, // saving twice is idempotent, never an error
  });
  return { ok: true };
}

export async function unsaveDiscussion(
  db: DbOrTx,
  input: { profileId: string; discussionId: string }
): Promise<void> {
  await db.savedDiscussion.deleteMany({
    where: { profileId: input.profileId, discussionId: input.discussionId },
  });
}

export async function isSaved(
  db: DbOrTx,
  input: { profileId: string; discussionId: string }
): Promise<boolean> {
  const row = await db.savedDiscussion.findUnique({
    where: {
      profileId_discussionId: {
        profileId: input.profileId,
        discussionId: input.discussionId,
      },
    },
  });
  return row !== null;
}

/** Reading a saved thread advances its watermark: activity after this
 *  instant counts as new for resurfacing. A time and nothing else. */
export async function touchSavedWatermark(
  db: DbOrTx,
  input: { profileId: string; discussionId: string }
): Promise<void> {
  await db.savedDiscussion.updateMany({
    where: { profileId: input.profileId, discussionId: input.discussionId },
    data: { lastSeenAt: new Date() },
  });
}

/** The face's own saved threads, optionally scoped to one pillar;
 *  the per-pillar Saved lens and the unified dashboard list. */
export async function savedThreadsFor(
  db: PrismaClient,
  profileId: string,
  opts?: { pillarId?: string }
) {
  const saves = await db.savedDiscussion.findMany({
    where: {
      profileId,
      ...(opts?.pillarId ? { discussion: { pillarId: opts.pillarId } } : {}),
    },
    include: {
      discussion: {
        include: {
          pillar: { select: { name: true, slug: true, isMeta: true } },
          circle: { select: { id: true, status: true } },
          posts: {
            select: { createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          _count: { select: { posts: true } },
        },
      },
    },
    orderBy: { savedAt: "desc" },
  });
  // Defense in depth: a save can outlive access (member left the room).
  // Never surface an enclosed room the face can no longer read.
  const readable = [];
  for (const s of saves) {
    if (await canRead(db, s.discussion, profileId)) readable.push(s);
  }
  return readable;
}

/** The memory current (§3.3): the face's saved threads that have
 *  genuinely stirred; new posts since the face's own watermark;
 *  ranked by the published resurfacing formula:
 *
 *    resurface priority = new posts + new unique contributors since
 *    last read, with recency decay; never views, never dwell.
 *
 *  Rails: feed.saved.resurfaceMinNewPosts, feed.saved.maxResurfacedCards.
 */
export async function stirringSavesFor(db: PrismaClient, profileId: string) {
  const [minNew, maxCards] = await Promise.all([
    getRail(db, "feed.saved.resurfaceMinNewPosts"),
    getRail(db, "feed.saved.maxResurfacedCards"),
  ]);
  const saves = await db.savedDiscussion.findMany({
    where: { profileId },
    include: {
      discussion: {
        include: {
          pillar: { select: { name: true, slug: true, isMeta: true } },
          circle: { select: { id: true, status: true } },
          _count: { select: { posts: true } },
        },
      },
    },
  });
  const stirring = [];
  for (const s of saves) {
    // A save can outlive access; never resurface a room the face can
    // no longer read (privacy audit 2026-07-22).
    if (!(await canRead(db, s.discussion, profileId))) continue;
    const fresh = await db.post.findMany({
      where: {
        discussionId: s.discussionId,
        // Moderated posts (hidden/blurred/removed) must not inflate the
        // "new posts / new voices" counts (correctness audit 2026-07-22).
        status: "visible",
        createdAt: { gt: s.lastSeenAt },
      },
      select: { authorHandle: true, createdAt: true },
    });
    if (fresh.length < minNew) continue;
    const voices = new Set(fresh.map((p) => p.authorHandle)).size;
    const newestAt = fresh.reduce(
      (m, p) => (p.createdAt > m ? p.createdAt : m),
      new Date(0)
    );
    // Recency decay: half-life of 72h on the newest fresh post.
    const ageH = (Date.now() - newestAt.getTime()) / 3_600_000;
    const decay = Math.pow(0.5, ageH / 72);
    stirring.push({
      save: s,
      discussion: s.discussion,
      newPosts: fresh.length,
      newVoices: voices,
      priority: (fresh.length + voices) * decay,
    });
  }
  stirring.sort((a, b) => b.priority - a.priority);
  return stirring.slice(0, Math.max(1, Math.round(maxCards)));
}
