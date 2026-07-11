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
import { chargeToTreasury, maybeFirstActionGrant } from "./economy";
import { accrueForAction } from "./accrual";

export function contentHash(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

/**
 * Soul-created Discussions arrive in Phase 3 as poll-context spaces
 * (POLLS §4.4: attach at creation or later, by any soul; consensus-fail
 * offers one — prompted, never automatic). A context Discussion for a
 * governance poll lives in the Governance room and is therefore
 * permanent; ordinary context spaces are author-deletable (deletion
 * mechanics arrive with their phase). Creation fee: designated
 * (rail discussion.creationFee. wires at Phase 4).
 */
export async function createPollDiscussion(
  db: PrismaClient,
  input: {
    pollId: string;
    profileId: string;
    /** Paid permanence (§8): set at creation only, immutable, labeled
     *  "Permanent — creator-designated". Gratium fee to the treasury. */
    paidPermanent?: boolean;
  }
): Promise<PostResult> {
  const poll = await db.poll.findUnique({
    where: { id: input.pollId },
    include: { pillar: true },
  });
  if (!poll) return { ok: false, reason: "No such poll." };
  if (poll.visibilityScope === "circle") {
    return {
      ok: false,
      reason: "A Circle poll's context is the members' room — no public context space.",
    };
  }

  const profile = await db.profile.findUnique({ where: { id: input.profileId } });
  if (!profile || profile.status !== "active") {
    return { ok: false, reason: "No active face." };
  }
  if (!(await hasPostingConsents(db, profile.id))) {
    return {
      ok: false,
      reason: "The permanence and Constitution acknowledgments come first.",
    };
  }

  const gate = await clearGate(db, {
    profileId: profile.id,
    scope: `discussion-create:${randomUUID()}`,
    scopeKind: "per-profile",
  });
  if (gate.outcome !== "CLEARED") {
    return { ok: false, reason: `Gate: ${gate.outcome}` };
  }

  const permanence = poll.isGovernance
    ? "permanent-governance"
    : input.paidPermanent
      ? "permanent-creator"
      : "deletable";
  try {
    const discussion = await db.$transaction(async (tx) => {
      const fee = await chargeToTreasury(tx, {
        profileId: profile.id,
        currency: "PC",
        amount: await getRail(tx, "discussion.creationFee"),
        kind: "fee.discussion",
        refType: "poll",
        refId: poll.id,
      });
      if (!fee.ok) throw new InsufficientFunds(fee.reason);
      if (permanence === "permanent-creator") {
        const upgrade = await chargeToTreasury(tx, {
          profileId: profile.id,
          currency: "G",
          amount: await getRail(tx, "economy.permanenceUpgradeFee"),
          kind: "fee.permanence",
          refType: "poll",
          refId: poll.id,
        });
        if (!upgrade.ok) throw new InsufficientFunds(upgrade.reason);
      }
      await maybeFirstActionGrant(tx, profile.id);
    await accrueForAction(tx, profile.id);

      const created = await tx.discussion.create({
        data: {
          title: `Discussion: ${poll.title}`,
          pillarId: poll.pillarId,
          pollId: poll.id,
          permanence,
        },
      });
      await appendEvent(tx, {
        actorType: "soul",
        actorId: profile.handle,
        eventType: "discussion.created",
        payload: {
          discussionRef: created.id,
          pollRef: poll.id,
          pillar: poll.pillar.slug,
          permanence,
          handle: profile.handle,
        },
      });
      return created;
    });
    return { ok: true, postId: discussion.id };
  } catch (err) {
    if (err instanceof InsufficientFunds) {
      return { ok: false, reason: err.message };
    }
    throw err;
  }
}

/**
 * Individual own-post permanence (§8): a soul may pay to make one of
 * their own posts permanent inside a deletable space — with the caveat
 * shown at purchase that the surrounding thread may later be deleted,
 * leaving the permanent post standing amid tombstones. The purchase
 * hash-commits the post to the ledger like any permanent record.
 */
export async function upgradePostPermanence(
  db: PrismaClient,
  input: { postId: string; profileId: string }
): Promise<PostResult> {
  const post = await db.post.findUnique({
    where: { id: input.postId },
    include: { discussion: true },
  });
  if (!post) return { ok: false, reason: "No such post." };
  if (post.authorProfileId !== input.profileId) {
    return { ok: false, reason: "Own content only — nobody pays to make someone else's words permanent." };
  }
  if (post.discussion.permanence.startsWith("permanent")) {
    return { ok: false, reason: "This space is already permanent." };
  }
  if (post.permanentUpgraded) {
    return { ok: false, reason: "Already permanent." };
  }
  // The members' room is not the permanent record (CIRCLES §2.3) — a
  // members-only post never hash-commits to the public ledger. The
  // action log is where a Circle's permanent claims live.
  if (post.discussion.circleId) {
    return {
      ok: false,
      reason: "Members'-room conversation stays in the room — log an action instead; the action log is the permanent record.",
    };
  }
  // The workshop is enclosed (POLLINATOR §4.3): a public hash-commit of
  // an enclosed draft would leak that the soul works inside. The Arena
  // (post-launch) is where a chamber's case goes on the permanent
  // record — drafts stay drafts.
  if (post.discussion.chamberId) {
    return {
      ok: false,
      reason: "Workshop drafts stay in the workshop — enclosed by design. The Arena is where a chamber's case becomes permanent record.",
    };
  }

  try {
    await db.$transaction(async (tx) => {
      const fee = await chargeToTreasury(tx, {
        profileId: input.profileId,
        currency: "G",
        amount: await getRail(tx, "economy.permanenceUpgradeFee"),
        kind: "fee.permanence",
        refType: "post",
        refId: post.id,
      });
      if (!fee.ok) throw new InsufficientFunds(fee.reason);
      await tx.post.update({
        where: { id: post.id },
        data: { permanentUpgraded: true },
      });
      await appendEvent(tx, {
        actorType: "soul",
        actorId: post.authorHandle,
        eventType: "post.recorded",
        payload: {
          discussionRef: post.discussionId,
          postRef: post.id,
          contentHash: contentHash(post.body),
          handle: post.authorHandle,
          displayName: post.authorDisplayName,
          upgraded: true,
        },
      });
    });
    return { ok: true, postId: post.id };
  } catch (err) {
    if (err instanceof InsufficientFunds) {
      return { ok: false, reason: err.message };
    }
    throw err;
  }
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
    /** Content attestation (§10.1): "Human-made — my reputation on it." */
    humanMade?: boolean;
    /** A typed source tag with the sharer's vouch choice (§4, §10.2). */
    source?: { url: string; kind: string; vouch: "vouched" | "unverified" };
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
  // The members' room (Phase 6, CIRCLES §2.2): a Circle-scoped
  // Discussion writes only for active members of a living Circle.
  if (discussion.circleId) {
    const { activeMembership } = await import("./circles");
    const circle = await db.circle.findUniqueOrThrow({ where: { id: discussion.circleId } });
    if (circle.status === "closed") {
      return { ok: false, reason: "This Circle is closed — its room is read-only for former members." };
    }
    if (!(await activeMembership(db, circle.id, profile.id))) {
      return { ok: false, reason: "Members only — the working conversation belongs to the Circle." };
    }
  }
  // The workshop (Phase 7.5, POLLINATOR §4.3): a chamber-scoped
  // Discussion writes only for souls who entered the chamber.
  if (discussion.chamberId) {
    const { chamberMembership } = await import("./chambers");
    if (!(await chamberMembership(db, discussion.chamberId, profile.id))) {
      return { ok: false, reason: "Enter the chamber to work its idea — the workshop is enter-to-see." };
    }
  }
  // Consent before the first post, always (ONBOARDING Stage 4 — the
  // blocking acks are not legal wallpaper; they gate the pen).
  if (!(await hasPostingConsents(db, profile.id))) {
    return {
      ok: false,
      reason: "The permanence and Constitution acknowledgments come first.",
    };
  }
  // Strike-ladder consequences (MODERATION §7), auto-applied and
  // auto-enforced: read-only silences writing; rate-limit slows it.
  const now = new Date();
  if (profile.readOnlyUntil && profile.readOnlyUntil > now) {
    return { ok: false, reason: `Read-only until ${profile.readOnlyUntil.toLocaleString()} (strike 3 — Tribunal review pending).` };
  }
  if (profile.rateLimitedUntil && profile.rateLimitedUntil > now) {
    const recent = await db.post.findFirst({
      where: { authorProfileId: profile.id, createdAt: { gte: new Date(Date.now() - 600_000) } },
    });
    if (recent) {
      return { ok: false, reason: "Rate-limited (strike 2): one post per 10 minutes for now." };
    }
  }

  // Every post is its own action instance: the scope is unique per post,
  // so the nullifier proves humanity for THIS act (DUAL_IDENTITY §3.2 —
  // every gated action re-proves fresh) rather than rationing posts.
  // Workshop posts clear in PRIVATE recording: chamber membership is
  // enclosed-space information (unlike Circles, whose membership is
  // public record by spec), so a public clearance naming the workshop
  // would leak who works inside. The gate still enforces everything.
  const actionRef = randomUUID();
  const gate = await clearGate(db, {
    profileId: profile.id,
    scope: `discussion:${discussion.id}:post:${actionRef}`,
    scopeKind: "per-profile",
    ledgerRecording: discussion.chamberId ? "private" : "pseudonymous",
  });
  if (gate.outcome !== "CLEARED") {
    return { ok: false, reason: `Gate: ${gate.outcome}` };
  }

  const graceMinutes = await getRail(db, "discussion.graceWindowMinutes");
  const editableUntil = new Date(Date.now() + graceMinutes * 60_000);

  try {
    const post = await db.$transaction(async (tx) => {
    // The participation fee: workshop posts carry the dual-token
    // signature (POLLINATOR §3 — both currencies, rails chamber.postFee*);
    // everywhere else, the standard reply micro-fee.
    if (discussion.chamberId) {
      const { chargeWorkshopPostFee, touchChamberActivity } = await import("./chambers");
      const fee = await chargeWorkshopPostFee(tx, {
        profileId: profile.id,
        discussionId: discussion.id,
      });
      if (!fee.ok) throw new InsufficientFunds(fee.reason);
      await touchChamberActivity(tx, discussion.chamberId);
    } else {
      // The reply micro-fee (participation-cost rule): acting costs.
      const fee = await chargeToTreasury(tx, {
        profileId: profile.id,
        currency: "PC",
        amount: await getRail(tx, "discussion.replyFee"),
        kind: "fee.reply",
        refType: "discussion",
        refId: discussion.id,
      });
      if (!fee.ok) throw new InsufficientFunds(fee.reason);
    }
    await maybeFirstActionGrant(tx, profile.id);
    await accrueForAction(tx, profile.id);

    const created = await tx.post.create({
      data: {
        discussionId: discussion.id,
        parentId: input.parentId ?? null,
        authorProfileId: profile.id,
        authorHandle: profile.handle,
        // Frozen at composition (naming ruling 2026-07-10): the permanent
        // record never retroactively rewrites; live surfaces may show the
        // current display name, the record keeps this one.
        authorDisplayName: profile.displayName,
        body,
        humanMade: input.humanMade ?? false,
        editableUntil,
      },
    });

    if (input.source?.url.trim()) {
      // One source, one object: the same citation anywhere resolves to
      // one shared SourceObject (§4).
      const url = input.source.url.trim();
      const sourceObject = await tx.sourceObject.upsert({
        where: { url },
        create: { url },
        update: {},
      });
      await tx.postSource.create({
        data: {
          postId: created.id,
          sourceId: sourceObject.id,
          kind: input.source.kind,
          vouch: input.source.vouch,
          sharerProfileId: profile.id,
          sharerHandle: profile.handle,
        },
      });
    }
    if (discussion.permanence.startsWith("permanent")) {
      await appendEvent(tx, {
        actorType: "soul",
        actorId: profile.handle,
        eventType: "post.recorded",
        payload: {
          discussionRef: discussion.id,
          postRef: created.id,
          contentHash: contentHash(body),
          handle: profile.handle,
          displayName: profile.displayName,
          nullifier: gate.nullifier,
        },
      });
    }
    return created;
    });
    return { ok: true, postId: post.id };
  } catch (err) {
    if (err instanceof InsufficientFunds) {
      return { ok: false, reason: err.message };
    }
    throw err;
  }
}

class InsufficientFunds extends Error {}

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
    if (post.discussion.permanence.startsWith("permanent") || post.permanentUpgraded) {
      await appendEvent(tx, {
        actorType: "soul",
        actorId: post.authorHandle,
        eventType: "post.amended",
        payload: {
          discussionRef: post.discussionId,
          postRef: post.id,
          contentHash: contentHash(body),
          handle: post.authorHandle,
        },
      });
    }
  });

  return { ok: true, postId: post.id };
}
