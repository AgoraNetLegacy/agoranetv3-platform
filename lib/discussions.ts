// Discussions core (Phase 1 — DISCUSSIONS_SPEC.md §3, §8).
//
// Every write action goes through the gate (no bypass, ever). Posts in
// permanent spaces are committed to the Civic Ledger by content hash:
// post.recorded at creation, post.amended for each grace-window edit —
// visible edit history, then the record locks. db:verify re-hashes every
// locked permanent post against its last ledger commitment, so a locked
// record cannot be silently altered even in the database.
//
// Replying is fee-bearing (participation-cost rule; rail
// "discussion.replyFee") — the debit wires up in Phase 4 when internal
// balances exist ("every ratified fee wired", BUILD_ORDER Phase 4).

import { createHash, randomUUID } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { clearGate } from "./gate";
import { appendEvent } from "./ledger";
import { getRail } from "./rails";
import { hasPostingConsents } from "./consent";

export function contentHash(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

export type PostResult =
  | { ok: true; postId: string }
  | { ok: false; reason: string };

/** Create a reply (or a top-level post) in a Discussion. */
export async function createPost(
  db: PrismaClient,
  input: {
    discussionId: string;
    profileId: string;
    body: string;
    parentId?: string | null;
  }
): Promise<PostResult> {
  const body = input.body.trim();
  if (!body) return { ok: false, reason: "Empty post." };

  const discussion = await db.discussion.findUnique({
    where: { id: input.discussionId },
  });
  if (!discussion) return { ok: false, reason: "No such Discussion." };

  if (input.parentId) {
    const parent = await db.post.findUnique({ where: { id: input.parentId } });
    if (!parent || parent.discussionId !== discussion.id) {
      return { ok: false, reason: "Parent post not in this Discussion." };
    }
  }

  const profile = await db.profile.findUnique({
    where: { id: input.profileId },
  });
  if (!profile) return { ok: false, reason: "No such profile." };
  if (profile.status !== "active") {
    return { ok: false, reason: "This face has not activated yet." };
  }
  // Consent before the first post, always (ONBOARDING Stage 4 — the
  // blocking acks are not legal wallpaper; they gate the pen).
  if (!(await hasPostingConsents(db, profile.id))) {
    return {
      ok: false,
      reason: "The permanence and Constitution acknowledgments come first.",
    };
  }

  // Every post is its own action instance: the scope is unique per post,
  // so the nullifier proves humanity for THIS act (DUAL_IDENTITY §3.2 —
  // every gated action re-proves fresh) rather than rationing posts.
  const actionRef = randomUUID();
  const gate = await clearGate(db, {
    profileId: profile.id,
    scope: `discussion:${discussion.id}:post:${actionRef}`,
    scopeKind: "per-profile",
  });
  if (gate.outcome !== "CLEARED") {
    return { ok: false, reason: `Gate: ${gate.outcome}` };
  }

  const graceMinutes = await getRail(db, "discussion.graceWindowMinutes");
  const editableUntil = new Date(Date.now() + graceMinutes * 60_000);

  const post = await db.$transaction(async (tx) => {
    const created = await tx.post.create({
      data: {
        discussionId: discussion.id,
        parentId: input.parentId ?? null,
        authorProfileId: profile.id,
        authorPseudonym: profile.pseudonym,
        body,
        editableUntil,
      },
    });
    if (discussion.permanence.startsWith("permanent")) {
      await appendEvent(tx, {
        actorType: "soul",
        actorId: profile.pseudonym,
        eventType: "post.recorded",
        payload: {
          discussionRef: discussion.id,
          postRef: created.id,
          contentHash: contentHash(body),
          pseudonym: profile.pseudonym,
          nullifier: gate.nullifier,
        },
      });
    }
    return created;
  });

  return { ok: true, postId: post.id };
}

/** Edit a post within its grace window — visible history, then locked. */
export async function editPost(
  db: PrismaClient,
  input: { postId: string; profileId: string; body: string }
): Promise<PostResult> {
  const body = input.body.trim();
  if (!body) return { ok: false, reason: "Empty post." };

  const post = await db.post.findUnique({
    where: { id: input.postId },
    include: { discussion: true },
  });
  if (!post) return { ok: false, reason: "No such post." };
  if (post.authorProfileId !== input.profileId) {
    return { ok: false, reason: "Only the author may edit." };
  }
  if (new Date() >= post.editableUntil) {
    return {
      ok: false,
      reason: "The grace window has closed — this record is locked.",
    };
  }

  await db.$transaction(async (tx) => {
    await tx.postRevision.create({
      data: { postId: post.id, body: post.body },
    });
    await tx.post.update({
      where: { id: post.id },
      data: { body },
    });
    if (post.discussion.permanence.startsWith("permanent")) {
      await appendEvent(tx, {
        actorType: "soul",
        actorId: post.authorPseudonym,
        eventType: "post.amended",
        payload: {
          discussionRef: post.discussionId,
          postRef: post.id,
          contentHash: contentHash(body),
          pseudonym: post.authorPseudonym,
        },
      });
    }
  });

  return { ok: true, postId: post.id };
}
