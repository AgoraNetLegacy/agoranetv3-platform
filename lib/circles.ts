// Circles — the action layer (Phase 6, Circles/CIRCLES_SPEC.md).
//
// A Circle converts shared concern into logged, attested, real-world
// action. Purpose, membership, and the action log are radically public;
// the working conversation is the members' room. Almost nothing here is
// bespoke: the room is the Discussion primitive Circle-scoped, internal
// votes are Circle-restricted Polls (lib/polls.ts), joining and every
// write clears the same gate as everything else. The one genuinely new
// mechanism is the action log with attestation (§6):
//
//   logged → attested (threshold co-signers) → the public civic ledger
//
// What the ledger proves is narrow and honest (§6.2): N verified humans
// publicly staked their pseudonymous reputations on this claim at time
// T, permanently — NOT "the platform verified this happened." The UI
// carries that sentence verbatim (HONEST_CLAIM below).
//
// The sharp privacy rule (§7): Circle-internal polls are always
// per-profile scope, never per-human — inside a small membership,
// per-human duplicate rejection would let the group infer that two of
// its member profiles share a human. lib/polls.ts votes are per-profile
// everywhere, so the rule holds by construction; tests assert it.

import { createHash, randomUUID } from "crypto";
import type { PrismaClient } from "@prisma/client";
import type { DbOrTx, Tx } from "./db";
import { clearGateTx, isGateDuplicateError } from "./gate";
import { appendEvent, canonicalJson } from "./ledger";
import { getRail } from "./rails";
import { hasPostingConsents } from "./consent";
import { chargeToTreasury, maybeFirstActionGrant } from "./economy";
import { accrueForAction } from "./accrual";
import { notify } from "./notifications";

class InsufficientFunds extends Error {}

export type CircleResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; reason: string; aliasWarning?: boolean };

/** Fixed UI copy (§6.2) — displayed on every Circle's log, not
 *  per-Circle editable. The ledger proves attestation, not truth. */
export const HONEST_CLAIM =
  "Attested entries mean N verified humans put their names to this " +
  "claim, permanently — not that the platform verified it happened. " +
  "Weigh attestor count, attestor standing, and this Circle's history " +
  "the way you would weigh any testimony.";

/** The Alias small-community warning (§5) — DUAL_IDENTITY §7.1 vector 5,
 *  said out loud at the exact moment it matters. Informed choice, never
 *  a wall. */
export const ALIAS_SMALL_COMMUNITY_WARNING =
  "Small, local groups shrink the crowd you're anonymous within. " +
  "Consider whether joining as this face is right for you.";

function entryContentHash(input: {
  body: string;
  didAt?: string | null;
  place?: string | null;
  correctionOfId?: string | null;
  drewOn: Array<{ kind: string; body: string }>;
}): string {
  return createHash("sha256")
    .update(
      canonicalJson({
        body: input.body,
        didAt: input.didAt ?? null,
        place: input.place ?? null,
        correctionOf: input.correctionOfId ?? null,
        drewOn: input.drewOn,
      })
    )
    .digest("hex");
}

// ------------------------------------------------------------ membership

/** The active membership row, or null. */
export async function activeMembership(
  db: DbOrTx,
  circleId: string,
  profileId: string
) {
  return db.circleMember.findFirst({
    where: { circleId, profileId, leftAt: null },
  });
}

/** Ever a member? Closed Circles keep the room readable for former
 *  members (§8). */
export async function everMember(
  db: DbOrTx,
  circleId: string,
  profileId: string
): Promise<boolean> {
  const row = await db.circleMember.findFirst({
    where: { circleId, profileId },
  });
  return row !== null;
}

/** Room access (§2.2, §8): active members read and write while the
 *  Circle lives; a closed Circle's room is read-only for anyone who was
 *  ever a member. */
export async function roomAccess(
  db: DbOrTx,
  circle: { id: string; status: string },
  profileId: string | null
): Promise<{ read: boolean; write: boolean }> {
  if (!profileId) return { read: false, write: false };
  const active = await activeMembership(db, circle.id, profileId);
  if (circle.status === "closed") {
    return { read: await everMember(db, circle.id, profileId), write: false };
  }
  return { read: active !== null, write: active !== null };
}

// ------------------------------------------------------------- lifecycle

/** "Inactive" is an honest derived label (§8), never a stored state:
 *  quiet past the rail ⇒ inactive; any activity lifts it. */
export async function circleStatusLabel(
  db: DbOrTx,
  circle: { status: string; lastActivityAt: Date }
): Promise<"active" | "inactive" | "closed"> {
  if (circle.status === "closed") return "closed";
  const quietDays = await getRail(db, "circle.inactivityDays");
  const quietSince = Date.now() - circle.lastActivityAt.getTime();
  return quietSince > quietDays * 86_400_000 ? "inactive" : "active";
}

async function touchActivity(tx: Tx, circleId: string) {
  await tx.circle.update({
    where: { id: circleId },
    data: { lastActivityAt: new Date() },
  });
}

// ---------------------------------------------------------- notifications

/**
 * "Circle activity (your Circles)" — the quiet-inbox category the
 * NOTIFICATIONS spec reserves for CIRCLES. Enclosed-space discipline
 * (NOTIFICATIONS §6): space name + event type only; content is visible
 * on entering the space. Aggregated per Circle — never a storm.
 */
async function notifyCircleActivity(
  tx: Tx,
  circle: { id: string; name: string },
  eventLabel: string,
  excludeProfileId: string
) {
  const members = await tx.circleMember.findMany({
    where: { circleId: circle.id, leftAt: null, profileId: { not: excludeProfileId } },
    select: { profileId: true },
  });
  for (const m of members) {
    await notify(tx, {
      profileId: m.profileId,
      tier: "quiet",
      category: "circle-activity",
      title: `Circle activity — ${circle.name}`,
      body: `${eventLabel}. Details are in the Circle.`,
      refType: "circle",
      refId: circle.id,
      aggregationKey: `circle-activity:${circle.id}`,
    });
  }
}

// ------------------------------------------------------------- formation

/**
 * Formation (§3): gate-cleared, fee-bearing (25u rail), live
 * immediately — no approval queue; quality control is downstream.
 * The founder role is thin by design. The members' room (a
 * Circle-scoped Discussion) is born with the Circle.
 */
export async function formCircle(
  db: PrismaClient,
  input: {
    profileId: string;
    name: string;
    purpose: string;
    pillarId?: string | null;
    // Optional domain within the pillar (§2.1) — data since Phase 7.
    domainId?: string | null;
    placeTag?: string | null;
    problem?: string | null;
  }
): Promise<CircleResult<{ circleId: string }>> {
  const name = input.name.trim();
  const purpose = input.purpose.trim();
  const placeTag = input.placeTag?.trim() || null;
  const problem = input.problem?.trim() || null;
  const pillarId = input.pillarId || null;
  if (!name) return { ok: false, reason: "A Circle needs a name." };
  if (!purpose) {
    return { ok: false, reason: "The purpose statement is the public claim — it can't be empty." };
  }
  // At least one focus tag (§2.1).
  if (!pillarId && !placeTag && !problem) {
    return {
      ok: false,
      reason: "Give the Circle at least one focus: a pillar, a place, or a problem statement.",
    };
  }

  const profile = await db.profile.findUnique({ where: { id: input.profileId } });
  if (!profile || profile.status !== "active") {
    return { ok: false, reason: "No active face." };
  }
  if (!(await hasPostingConsents(db, profile.id))) {
    return { ok: false, reason: "The permanence and Constitution acknowledgments come first." };
  }

  let pillar = null;
  if (pillarId) {
    pillar = await db.pillar.findUnique({ where: { id: pillarId } });
    if (!pillar) return { ok: false, reason: "No such pillar." };
  }
  // A domain tag is always a domain OF the tagged pillar.
  let domain = null;
  if (input.domainId) {
    if (!pillar) return { ok: false, reason: "A domain tag needs its pillar tag." };
    domain = await db.domain.findUnique({ where: { id: input.domainId } });
    if (!domain || domain.pillarId !== pillar.id) {
      return { ok: false, reason: "That domain doesn't belong to the tagged pillar." };
    }
  }
  // The members' room is a Discussion, and Discussions live in a pillar;
  // an untagged Circle's room is homed in the meta pillar (the Agora —
  // the platform's own container), which changes nothing about access:
  // Circle-scoped Discussions never appear on pillar pages.
  const homePillar =
    pillar ?? (await db.pillar.findFirstOrThrow({ where: { isMeta: true } }));

  // Gate spend + fee + Circle creation share one transaction (#25), so a
  // rollback leaves no orphan spend.
  try {
    return await db.$transaction(async (tx) => {
      const gate = await clearGateTx(tx, {
        profileId: profile.id,
        scope: `circle-create:${randomUUID()}`,
        scopeKind: "per-profile",
      });
      if (gate.outcome !== "CLEARED") return { ok: false as const, reason: `Gate: ${gate.outcome}` };
      const fee = await chargeToTreasury(tx, {
        profileId: profile.id,
        currency: "PC",
        amount: await getRail(tx, "circle.creationFee"),
        kind: "fee.circle",
        refType: "circle",
      });
      if (!fee.ok) throw new InsufficientFunds(fee.reason);
      await maybeFirstActionGrant(tx, profile.id);
      await accrueForAction(tx, profile.id);

      const created = await tx.circle.create({
        data: {
          name,
          purpose,
          pillarId,
          domainId: domain?.id ?? null,
          placeTag,
          problem,
          founderProfileId: profile.id,
          founderHandle: profile.handle,
          attestationThreshold: Math.round(
            await getRail(tx, "circle.attestationThreshold")
          ),
          removalBarPercent: await getRail(tx, "circle.removalBarPercent"),
        },
      });
      // The founder is member #1 — a Circle belongs to its members.
      await tx.circleMember.create({
        data: { circleId: created.id, profileId: profile.id, handle: profile.handle },
      });
      // The members' room, born with the Circle (§2.2): Discussion
      // primitive, Circle-scoped, deletable class — the working
      // conversation is not the permanent record (§2.3).
      await tx.discussion.create({
        data: {
          title: `Members' room — ${name}`,
          pillarId: homePillar.id,
          circleId: created.id,
          permanence: "deletable",
        },
      });
      await appendEvent(tx, {
        actorType: "soul",
        actorId: profile.handle,
        eventType: "circle.formed",
        payload: {
          circleRef: created.id,
          name,
          purpose,
          pillar: pillar?.slug,
          domain: domain?.title ?? undefined,
          place: placeTag ?? undefined,
          problem: problem ?? undefined,
          handle: profile.handle,
        },
      });
      await appendEvent(tx, {
        actorType: "soul",
        actorId: profile.handle,
        eventType: "circle.joined",
        payload: { circleRef: created.id, handle: profile.handle },
      });
      return { ok: true as const, circleId: created.id };
    });
  } catch (err) {
    if (err instanceof InsufficientFunds) return { ok: false, reason: err.message };
    throw err;
  }
}

/**
 * Purpose/tag edits — the founder's ONLY power (§3.3), versioned (§2.3):
 * a Circle can't quietly rewrite what it claimed to be.
 */
export async function editPurpose(
  db: PrismaClient,
  input: {
    circleId: string;
    profileId: string;
    purpose: string;
    pillarId?: string | null;
    placeTag?: string | null;
    problem?: string | null;
  }
): Promise<CircleResult> {
  const circle = await db.circle.findUnique({
    where: { id: input.circleId },
    include: { pillar: true },
  });
  if (!circle) return { ok: false, reason: "No such Circle." };
  if (circle.status === "closed") return { ok: false, reason: "This Circle is closed — its record stands as written." };
  if (circle.founderProfileId !== input.profileId) {
    return { ok: false, reason: "Only the founder edits the purpose statement — and nothing else." };
  }
  const purpose = input.purpose.trim();
  const placeTag = input.placeTag?.trim() || null;
  const problem = input.problem?.trim() || null;
  const pillarId = input.pillarId || null;
  if (!purpose) return { ok: false, reason: "The purpose statement can't be empty." };
  if (!pillarId && !placeTag && !problem) {
    return { ok: false, reason: "A Circle keeps at least one focus tag." };
  }
  let newPillarSlug: string | undefined;
  if (pillarId) {
    const pillar = await db.pillar.findUnique({ where: { id: pillarId } });
    if (!pillar) return { ok: false, reason: "No such pillar." };
    newPillarSlug = pillar.slug;
  }

  await db.$transaction(async (tx) => {
    // Keep the prior version — public, versioned.
    await tx.circlePurposeRevision.create({
      data: {
        circleId: circle.id,
        purpose: circle.purpose,
        pillarSlug: circle.pillar?.slug ?? null,
        placeTag: circle.placeTag,
        problem: circle.problem,
      },
    });
    await tx.circle.update({
      where: { id: circle.id },
      data: { purpose, pillarId, placeTag, problem },
    });
    await appendEvent(tx, {
      actorType: "soul",
      actorId: circle.founderHandle,
      eventType: "circle.purpose-amended",
      payload: {
        circleRef: circle.id,
        purpose,
        pillar: newPillarSlug,
        place: placeTag ?? undefined,
        problem: problem ?? undefined,
        handle: circle.founderHandle,
      },
    });
  });
  return { ok: true };
}

// ---------------------------------------------------------- join & leave

/**
 * Does this join need the Alias small-community warning (§5)? Alias
 * face AND (membership below the rail OR place-tagged). Computed
 * server-side so the join page can show it BEFORE the action.
 */
export async function joinNeedsAliasWarning(
  db: DbOrTx,
  circleId: string,
  profileId: string
): Promise<boolean> {
  const profile = await db.profile.findUnique({ where: { id: profileId } });
  if (!profile || profile.face !== "ALIAS") return false;
  const circle = await db.circle.findUnique({ where: { id: circleId } });
  if (!circle) return false;
  if (circle.placeTag) return true;
  const memberCount = await db.circleMember.count({
    where: { circleId, leftAt: null },
  });
  return memberCount < (await getRail(db, "circle.smallCommunityMembers"));
}

/**
 * Joining (§5): one gate-cleared action, per-profile scope. No
 * application essays, no founder approval — the humanity gate plus
 * visible standing is the filter. Join events are public record.
 */
export async function joinCircle(
  db: PrismaClient,
  input: { circleId: string; profileId: string; acceptedAliasWarning?: boolean }
): Promise<CircleResult> {
  const circle = await db.circle.findUnique({ where: { id: input.circleId } });
  if (!circle) return { ok: false, reason: "No such Circle." };
  if (circle.status === "closed") {
    return { ok: false, reason: "This Circle is closed — no longer joinable; its record remains." };
  }
  const profile = await db.profile.findUnique({ where: { id: input.profileId } });
  if (!profile || profile.status !== "active") {
    return { ok: false, reason: "No active face." };
  }
  // Membership is a public permanent record — the same blocking
  // acknowledgments that gate the pen gate the list.
  if (!(await hasPostingConsents(db, profile.id))) {
    return { ok: false, reason: "The permanence and Constitution acknowledgments come first." };
  }
  if (await activeMembership(db, circle.id, profile.id)) {
    return { ok: false, reason: "You are already a member of this Circle." };
  }
  // The warning is informed choice, never a wall — but it must have
  // been SHOWN and accepted when it applies (§5).
  if (
    (await joinNeedsAliasWarning(db, circle.id, profile.id)) &&
    !input.acceptedAliasWarning
  ) {
    return { ok: false, aliasWarning: true, reason: ALIAS_SMALL_COMMUNITY_WARNING };
  }

  // Each join is its own gate-cleared action (rejoining after leaving
  // is allowed — §8 keeps Circles joinable); membership uniqueness
  // lives in the membership table, humanity proof in the gate.
  // Gate spend + membership row share one transaction (#25).
  return db.$transaction(async (tx) => {
    const gate = await clearGateTx(tx, {
      profileId: profile.id,
      scope: `circle:${circle.id}:join:${randomUUID()}`,
      scopeKind: "per-profile",
    });
    if (gate.outcome !== "CLEARED") return { ok: false as const, reason: `Gate: ${gate.outcome}` };
    const already = await tx.circleMember.findFirst({
      where: { circleId: circle.id, profileId: profile.id, leftAt: null },
    });
    if (already) throw new Error("Already a member.");
    await tx.circleMember.create({
      data: { circleId: circle.id, profileId: profile.id, handle: profile.handle },
    });
    await appendEvent(tx, {
      actorType: "soul",
      actorId: profile.handle,
      eventType: "circle.joined",
      payload: { circleRef: circle.id, handle: profile.handle },
    });
    await touchActivity(tx, circle.id);
    await accrueForAction(tx, profile.id);
    await notifyCircleActivity(tx, circle, "A soul joined", profile.id);
    return { ok: true as const };
  });
}

/** Leaving (§5): one tap, no ceremony, logged as public record. */
export async function leaveCircle(
  db: PrismaClient,
  input: { circleId: string; profileId: string }
): Promise<CircleResult> {
  const membership = await activeMembership(db, input.circleId, input.profileId);
  if (!membership) return { ok: false, reason: "Not a member." };
  const profile = await db.profile.findUniqueOrThrow({ where: { id: input.profileId } });

  await db.$transaction(async (tx) => {
    await tx.circleMember.update({
      where: { id: membership.id },
      data: { leftAt: new Date() },
    });
    await appendEvent(tx, {
      actorType: "soul",
      actorId: profile.handle,
      eventType: "circle.left",
      payload: { circleRef: input.circleId, handle: profile.handle },
    });
  });
  return { ok: true };
}

// -------------------------------------------------------- resource board

/**
 * The resource board (§5): members-only listings — living statements,
 * not commitments of record. Gate-cleared like every write, but with
 * PRIVATE recording: members-only content leaves no public trace until
 * a logged action references it.
 */
export async function postOffer(
  db: PrismaClient,
  input: { circleId: string; profileId: string; kind: string; body: string }
): Promise<CircleResult<{ offerId: string }>> {
  const body = input.body.trim();
  if (!body) return { ok: false, reason: "An empty offer offers nothing." };
  if (!["skill", "tool", "time", "pledge"].includes(input.kind)) {
    return { ok: false, reason: "Offers are skills, tools, time, or pledges." };
  }
  const circle = await db.circle.findUnique({ where: { id: input.circleId } });
  if (!circle) return { ok: false, reason: "No such Circle." };
  if (circle.status === "closed") return { ok: false, reason: "This Circle is closed." };
  const membership = await activeMembership(db, circle.id, input.profileId);
  if (!membership) return { ok: false, reason: "Members only." };
  const profile = await db.profile.findUniqueOrThrow({ where: { id: input.profileId } });

  // Gate spend + offer row share one transaction (#25).
  return db.$transaction(async (tx) => {
    const gate = await clearGateTx(tx, {
      profileId: profile.id,
      scope: `circle:${circle.id}:offer:${randomUUID()}`,
      scopeKind: "per-profile",
      ledgerRecording: "private",
    });
    if (gate.outcome !== "CLEARED") return { ok: false as const, reason: `Gate: ${gate.outcome}` };
    const created = await tx.resourceOffer.create({
      data: {
        circleId: circle.id,
        memberProfileId: profile.id,
        memberHandle: profile.handle,
        kind: input.kind,
        body,
      },
    });
    await touchActivity(tx, circle.id);
    await accrueForAction(tx, profile.id);
    return { ok: true as const, offerId: created.id };
  });
}

/** Offers are editable and retractable by their member (§2.3, §5). */
export async function updateOffer(
  db: PrismaClient,
  input: { offerId: string; profileId: string; body?: string; retract?: boolean }
): Promise<CircleResult> {
  const offer = await db.resourceOffer.findUnique({
    where: { id: input.offerId },
    include: { circle: true },
  });
  if (!offer) return { ok: false, reason: "No such offer." };
  if (offer.memberProfileId !== input.profileId) {
    return { ok: false, reason: "Only the offering member edits an offer." };
  }
  if (offer.circle.status === "closed") return { ok: false, reason: "This Circle is closed." };
  // Offers live in the members' room: editing or retracting one is a
  // membership act, like postOffer. A member who has left (or been removed)
  // no longer manages the board — their offer stays as a record of what was
  // pledged while they were in.
  if (!(await activeMembership(db, offer.circleId, input.profileId))) {
    return { ok: false, reason: "You have left this Circle — its offers are no longer yours to change." };
  }
  const body = input.body?.trim();
  await db.resourceOffer.update({
    where: { id: offer.id },
    data: {
      ...(body ? { body } : {}),
      ...(input.retract ? { status: "retracted" } : {}),
      updatedAt: new Date(),
    },
  });
  return { ok: true };
}

// ------------------------------------------------------- the action log

/**
 * Log an action (§6.1): permanent public record from the moment of
 * writing — the composer shows the permanence badge, and the entry
 * hash-commits to the civic ledger immediately, attributed to the
 * posting member's pseudonym. No edit, no delete; corrections are new
 * entries that reference the mistaken one. Referenced offers are
 * snapshotted — that is the moment a pledge becomes part of the record.
 */
export async function logAction(
  db: PrismaClient,
  input: {
    circleId: string;
    profileId: string;
    body: string;
    didAt?: string;
    place?: string;
    correctionOfId?: string;
    drewOnOfferIds?: string[];
  }
): Promise<CircleResult<{ entryId: string }>> {
  const body = input.body.trim();
  if (!body) return { ok: false, reason: "Say what was done — the log is the proof." };
  const circle = await db.circle.findUnique({ where: { id: input.circleId } });
  if (!circle) return { ok: false, reason: "No such Circle." };
  if (circle.status === "closed") {
    return { ok: false, reason: "This Circle is closed — its log is complete." };
  }
  const membership = await activeMembership(db, circle.id, input.profileId);
  if (!membership) return { ok: false, reason: "Members only — join the Circle to log its work." };
  const profile = await db.profile.findUniqueOrThrow({ where: { id: input.profileId } });
  if (!(await hasPostingConsents(db, profile.id))) {
    return { ok: false, reason: "The permanence and Constitution acknowledgments come first." };
  }

  if (input.correctionOfId) {
    const target = await db.actionEntry.findUnique({ where: { id: input.correctionOfId } });
    if (!target || target.circleId !== circle.id) {
      return { ok: false, reason: "A correction references an entry in this Circle's log." };
    }
  }

  // Snapshot referenced offers now — offers stay living statements;
  // the record freezes what the action drew on (§5).
  const drewOn: Array<{ offerId: string; kind: string; body: string }> = [];
  for (const offerId of Array.from(new Set(input.drewOnOfferIds ?? []))) {
    const offer = await db.resourceOffer.findUnique({ where: { id: offerId } });
    if (!offer || offer.circleId !== circle.id) {
      return { ok: false, reason: "Referenced offers must be on this Circle's board." };
    }
    drewOn.push({ offerId: offer.id, kind: offer.kind, body: offer.body });
  }

  const didAt = input.didAt?.trim() || null;
  const place = input.place?.trim() || null;

  // Gate spend + action entry share one transaction (#25).
  return db.$transaction(async (tx) => {
    const gate = await clearGateTx(tx, {
      profileId: profile.id,
      scope: `circle:${circle.id}:action:${randomUUID()}`,
      scopeKind: "per-profile",
    });
    if (gate.outcome !== "CLEARED") return { ok: false as const, reason: `Gate: ${gate.outcome}` };
    const created = await tx.actionEntry.create({
      data: {
        circleId: circle.id,
        authorProfileId: profile.id,
        authorHandle: profile.handle,
        authorDisplayName: profile.displayName,
        body,
        didAt,
        place,
        correctionOfId: input.correctionOfId ?? null,
      },
    });
    for (const d of drewOn) {
      await tx.actionEntryPledge.create({
        data: { entryId: created.id, offerId: d.offerId, kind: d.kind, body: d.body },
      });
    }
    await appendEvent(tx, {
      actorType: "soul",
      actorId: profile.handle,
      eventType: "action.logged",
      payload: {
        circleRef: circle.id,
        entryRef: created.id,
        contentHash: entryContentHash({
          body,
          didAt,
          place,
          correctionOfId: input.correctionOfId ?? null,
          drewOn: drewOn.map((d) => ({ kind: d.kind, body: d.body })),
        }),
        handle: profile.handle,
        displayName: profile.displayName,
        correctionOf: input.correctionOfId ?? undefined,
        // Referencing a pledge is what makes it part of the permanent
        // record (§5) — the snapshot rides the public event.
        drewOn: drewOn.length > 0 ? drewOn.map((d) => ({ kind: d.kind, body: d.body })) : undefined,
      },
    });
    await touchActivity(tx, circle.id);
    await accrueForAction(tx, profile.id);
    await notifyCircleActivity(tx, circle, "An action was logged", profile.id);
    return { ok: true as const, entryId: created.id };
  });
}

/** Re-derivable hash of an entry's public claim — verify.ts re-checks
 *  every entry against its action.logged commitment. */
export function actionEntryHash(entry: {
  body: string;
  didAt: string | null;
  place: string | null;
  correctionOfId: string | null;
  pledges: Array<{ kind: string; body: string }>;
}): string {
  return entryContentHash({
    body: entry.body,
    didAt: entry.didAt,
    place: entry.place,
    correctionOfId: entry.correctionOfId,
    drewOn: entry.pledges.map((p) => ({ kind: p.kind, body: p.body })),
  });
}

/**
 * Attest (§6.1 step 3): co-sign with your own pseudonym. Members only,
 * never the author, once per entry (the gate's per-entry scope IS the
 * once — a second attempt is a private DUPLICATE). At the Circle's
 * threshold the entry latches to attested — the state that counts for
 * Light Score and pillar surfacing.
 */
export async function attestAction(
  db: PrismaClient,
  input: { entryId: string; profileId: string }
): Promise<CircleResult> {
  const entry = await db.actionEntry.findUnique({
    where: { id: input.entryId },
    include: { circle: true },
  });
  if (!entry) return { ok: false, reason: "No such entry." };
  if (entry.circle.status === "closed") {
    return { ok: false, reason: "This Circle is closed — its log is complete." };
  }
  if (entry.authorProfileId === input.profileId) {
    return { ok: false, reason: "Attestation is other voices — you already signed it by writing it." };
  }
  const membership = await activeMembership(db, entry.circleId, input.profileId);
  if (!membership) return { ok: false, reason: "Members only." };
  const profile = await db.profile.findUniqueOrThrow({ where: { id: input.profileId } });
  if (!(await hasPostingConsents(db, profile.id))) {
    return { ok: false, reason: "The permanence and Constitution acknowledgments come first." };
  }

  // One attestation per profile per entry: a fixed per-entry scope, so
  // the nullifier collision rejects repeats — privately, like all
  // duplicates. Gate spend + attestation + latch share ONE transaction
  // (#25): a rollback (e.g. the ledger append losing a concurrent race) no
  // longer strands the attest nullifier, so the co-signature is retryable
  // instead of vanishing as a phantom DUPLICATE.
  try {
    return await db.$transaction(async (tx) => {
    const gate = await clearGateTx(tx, {
      profileId: profile.id,
      scope: `circle-attest:${entry.id}`,
      scopeKind: "per-profile",
    });
    if (gate.outcome === "DUPLICATE") {
      return { ok: false as const, reason: "You have already attested this entry." };
    }
    if (gate.outcome !== "CLEARED") return { ok: false as const, reason: `Gate: ${gate.outcome}` };
    await tx.attestation.create({
      data: {
        entryId: entry.id,
        attestorProfileId: profile.id,
        attestorHandle: profile.handle,
      },
    });
    // Count from the DATABASE inside the tx — never entry.attestations from
    // the snapshot read before it, which is stale the moment another
    // attestation commits. (Attestations serialise on the ledger append, so
    // a co-signer commits after this function's opening read was taken.)
    const count = await tx.attestation.count({ where: { entryId: entry.id } });
    await appendEvent(tx, {
      actorType: "soul",
      actorId: profile.handle,
      eventType: "action.attested",
      payload: {
        circleRef: entry.circleId,
        entryRef: entry.id,
        handle: profile.handle,
        attestorCount: count,
      },
    });

    // Atomic threshold latch: updateMany's WHERE attestedAt=null lets
    // exactly ONE attestation flip the entry to attested. That caller
    // "crosses" (credits author + cohort); any later co-signature is a
    // wasAttested late credit. Deriving both from the write, not the stale
    // entry.attestedAt, is what stops a double author-credit at the edge.
    let nowAttested = false;
    let wasAttested = false;
    if (count >= entry.circle.attestationThreshold) {
      const latched = await tx.actionEntry.updateMany({
        where: { id: entry.id, attestedAt: null },
        data: { attestedAt: new Date() },
      });
      if (latched.count === 1) nowAttested = true;
      else wasAttested = true;
    }

    // Light Score crediting (§6.3, LIGHT_SCORE spec §2): ATTESTED
    // entries only — logging alone credits nothing; attesting credits
    // less than authoring. Recorded now, consumed by the Phase 7 engine.
    if (entry.circle.pillarId) {
      if (nowAttested) {
        // Crossing the threshold credits the author and every attestor
        // so far (their signatures made the state) — read fresh from the tx.
        await creditCircleLightScore(tx, {
          profileId: entry.authorProfileId,
          pillarId: entry.circle.pillarId,
          circleId: entry.circleId,
          entryId: entry.id,
          railKey: "circle.lsAuthorCredit",
          refType: "circle-action",
          diminishing: true,
        });
        const attestors = await tx.attestation.findMany({
          where: { entryId: entry.id },
          select: { attestorProfileId: true },
        });
        for (const a of attestors) {
          await creditCircleLightScore(tx, {
            profileId: a.attestorProfileId,
            pillarId: entry.circle.pillarId,
            circleId: entry.circleId,
            entryId: entry.id,
            railKey: "circle.lsAttestCredit",
            refType: "circle-attest",
            diminishing: false,
          });
        }
      } else if (wasAttested) {
        // A late co-signature on an already-attested entry still stakes
        // reputation — it credits the attestor.
        await creditCircleLightScore(tx, {
          profileId: profile.id,
          pillarId: entry.circle.pillarId,
          circleId: entry.circleId,
          entryId: entry.id,
          railKey: "circle.lsAttestCredit",
          refType: "circle-attest",
          diminishing: false,
        });
      }
    }

    await touchActivity(tx, entry.circleId);
    await accrueForAction(tx, profile.id);
    if (nowAttested) {
      await notifyCircleActivity(
        tx,
        entry.circle,
        "An action reached attested",
        profile.id
      );
    }
    return { ok: true as const };
    });
  } catch (err) {
    if (isGateDuplicateError(err)) {
      return { ok: false, reason: "You have already attested this entry." };
    }
    throw err;
  }
}

/**
 * Circle-derived Light Score credit, under the LIGHT_SCORE §5.1
 * anti-gaming guardrails: a per-profile, per-Circle, per-day cap, and
 * diminishing returns (authored credits halve for each further entry
 * attested the same day). Rails, all of it.
 */
async function creditCircleLightScore(
  tx: Tx,
  input: {
    profileId: string;
    pillarId: string;
    circleId: string;
    entryId: string;
    railKey: "circle.lsAuthorCredit" | "circle.lsAttestCredit";
    refType: "circle-action" | "circle-attest";
    diminishing: boolean;
  }
) {
  const base = await getRail(tx, input.railKey);
  const cap = await getRail(tx, "circle.lsDailyCapPoints");
  const dayStart = new Date(new Date().setUTCHours(0, 0, 0, 0));

  // Today's Circle-derived credits for this profile in this circle —
  // the entry ids of this circle scope the sum.
  const circleEntryIds = (
    await tx.actionEntry.findMany({
      where: { circleId: input.circleId },
      select: { id: true },
    })
  ).map((e) => e.id);
  const today = await tx.lightScoreAdjustment.findMany({
    where: {
      profileId: input.profileId,
      refType: { in: ["circle-action", "circle-attest"] },
      refId: { in: circleEntryIds },
      createdAt: { gte: dayStart },
    },
  });
  const spentToday = today.reduce((s, a) => s + a.amount, 0);

  let amount = base;
  if (input.diminishing) {
    const priorAuthored = today.filter((a) => a.refType === "circle-action").length;
    amount = base / Math.pow(2, priorAuthored);
  }
  amount = Math.min(amount, Math.max(0, cap - spentToday));
  if (amount <= 0) return;

  await tx.lightScoreAdjustment.create({
    data: {
      profileId: input.profileId,
      pillarId: input.pillarId,
      amount,
      refType: input.refType,
      refId: input.entryId,
    },
  });
}

// ------------------------------------- stewardship (binding internal polls)

export type CircleActionKind =
  | "remove-member"
  | "close-circle"
  | "appoint-founder"
  | "set-attestation-threshold";

/**
 * Validate a binding stewardship action string at poll creation.
 * Returns the minimum consensus bar the poll must carry.
 */
export async function validateCircleAction(
  db: DbOrTx,
  circle: { id: string; removalBarPercent: number },
  action: string
): Promise<{ ok: true; minThreshold: number } | { ok: false; reason: string }> {
  const [kind, arg] = splitAction(action);
  switch (kind) {
    case "remove-member": {
      const member = await db.circleMember.findFirst({
        where: { circleId: circle.id, handle: arg ?? "", leftAt: null },
      });
      if (!member) return { ok: false, reason: "No such member to remove." };
      // Never below simple majority; the Circle's own bar governs (§7).
      return { ok: true, minThreshold: circle.removalBarPercent / 100 };
    }
    case "appoint-founder": {
      const member = await db.circleMember.findFirst({
        where: { circleId: circle.id, handle: arg ?? "", leftAt: null },
      });
      if (!member) return { ok: false, reason: "The next founder must be a member." };
      return { ok: true, minThreshold: 0.5 };
    }
    case "close-circle":
      return { ok: true, minThreshold: 0.5 };
    case "set-attestation-threshold": {
      const n = Number(arg);
      const rail = await db.rail.findUnique({ where: { key: "circle.attestationThreshold" } });
      if (!rail || !Number.isInteger(n) || n < rail.boundMin || n > rail.boundMax) {
        return {
          ok: false,
          reason: `The attestation threshold is a rail: an integer between ${rail?.boundMin ?? 2} and ${rail?.boundMax ?? 8}.`,
        };
      }
      return { ok: true, minThreshold: 0.5 };
    }
    default:
      return { ok: false, reason: "Unknown stewardship action." };
  }
}

function splitAction(action: string): [string, string | null] {
  const idx = action.indexOf(":");
  return idx === -1 ? [action, null] : [action.slice(0, idx), action.slice(idx + 1)];
}

/**
 * Execute a passed stewardship poll (called by closeDuePolls inside the
 * close transaction, only when the consensus passed with Adopt leading).
 * Stewardship outcomes are public record — membership and lifecycle
 * events already are.
 */
export async function executeCircleAction(
  tx: Tx,
  poll: { id: string; circleRef: string | null; circleAction: string | null }
): Promise<void> {
  if (!poll.circleRef || !poll.circleAction) return;
  const circle = await tx.circle.findUnique({ where: { id: poll.circleRef } });
  if (!circle || circle.status === "closed") return;
  const [kind, arg] = splitAction(poll.circleAction);

  const lapse = async (why: string) => {
    await appendEvent(tx, {
      actorType: "system",
      eventType: "circle.decision-lapsed",
      payload: { circleRef: circle.id, pollRef: poll.id, action: poll.circleAction, why },
    });
  };

  switch (kind) {
    case "remove-member": {
      const member = await tx.circleMember.findFirst({
        where: { circleId: circle.id, handle: arg ?? "", leftAt: null },
      });
      if (!member) return lapse("member already gone");
      await tx.circleMember.update({
        where: { id: member.id },
        data: { leftAt: new Date() },
      });
      await appendEvent(tx, {
        actorType: "system",
        eventType: "circle.member-removed",
        payload: { circleRef: circle.id, handle: member.handle, pollRef: poll.id },
      });
      return;
    }
    case "close-circle": {
      await tx.circle.update({ where: { id: circle.id }, data: { status: "closed" } });
      await appendEvent(tx, {
        actorType: "system",
        eventType: "circle.closed",
        payload: { circleRef: circle.id, pollRef: poll.id },
      });
      return;
    }
    case "appoint-founder": {
      const member = await tx.circleMember.findFirst({
        where: { circleId: circle.id, handle: arg ?? "", leftAt: null },
      });
      if (!member) return lapse("appointee no longer a member");
      await tx.circle.update({
        where: { id: circle.id },
        data: { founderProfileId: member.profileId, founderHandle: member.handle },
      });
      await appendEvent(tx, {
        actorType: "system",
        eventType: "circle.founder-appointed",
        payload: { circleRef: circle.id, handle: member.handle, pollRef: poll.id },
      });
      return;
    }
    case "set-attestation-threshold": {
      const n = Number(arg);
      const rail = await tx.rail.findUnique({ where: { key: "circle.attestationThreshold" } });
      if (!rail || !Number.isInteger(n) || n < rail.boundMin || n > rail.boundMax) {
        return lapse("value outside the rail bounds");
      }
      await tx.circle.update({
        where: { id: circle.id },
        data: { attestationThreshold: n },
      });
      await appendEvent(tx, {
        actorType: "system",
        eventType: "circle.rail-adjusted",
        payload: { circleRef: circle.id, key: "attestationThreshold", value: n, pollRef: poll.id },
      });
      return;
    }
  }
}

// -------------------------------------------------------------- discovery

/**
 * The values-alignment signal (§4): a Circle can be surfaced to a
 * profile that has answered canonical questions in the Circle's focus
 * pillar — the onboarding values seed first, growing with real
 * 49-question participation. v1 is a simple, explainable overlap, and
 * every surfaced recommendation SHOWS ITS WHY in plain language. No
 * black-box ranking — a product-identity commitment, not a v1 shortcut.
 */
export async function alignmentPillarsFor(
  db: DbOrTx,
  profileId: string
): Promise<Map<string, string>> {
  const reasons = new Map<string, string>();
  const seedAnswers = await db.valuesAnswer.findMany({ where: { profileId } });
  if (seedAnswers.length > 0) {
    const questions = await db.question.findMany({
      where: { id: { in: seedAnswers.map((a) => a.questionId) } },
      include: { pillar: true },
    });
    for (const q of questions) {
      reasons.set(q.pillarId, `you answered the ${q.pillar.name} values question`);
    }
  }
  const posts = await db.post.findMany({
    where: { authorProfileId: profileId, discussion: { questionId: { not: null } } },
    include: { discussion: { include: { pillar: true } } },
    distinct: ["discussionId"],
  });
  for (const p of posts) {
    const pillarId = p.discussion.pillarId;
    if (!reasons.has(pillarId)) {
      reasons.set(
        pillarId,
        `you have participated in ${p.discussion.pillar.name} discussions`
      );
    }
  }
  return reasons;
}

/** Latest attested-action time per circle — active hands rank above old
 *  claims (§6.3). */
export async function lastAttestedAt(
  db: DbOrTx,
  circleIds: string[]
): Promise<Map<string, Date>> {
  const entries = await db.actionEntry.findMany({
    where: { circleId: { in: circleIds }, attestedAt: { not: null } },
    select: { circleId: true, attestedAt: true },
  });
  const latest = new Map<string, Date>();
  for (const e of entries) {
    const cur = latest.get(e.circleId);
    if (!cur || (e.attestedAt && e.attestedAt > cur)) latest.set(e.circleId, e.attestedAt!);
  }
  return latest;
}
