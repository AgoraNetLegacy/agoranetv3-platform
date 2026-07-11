// Fellow Souls (Phase 6.5 — FELLOW_SOULS_AND_DM_SPEC §1–§4).
//
// The bond is mutual consent between two PROFILES — any face
// combination; the platform neither knows nor asks whether two bonded
// profiles share a human. The load-bearing privacy rules (§4) are
// structural here:
//   1. Your list is visible to you alone — no public lists, no counts.
//   2. No "people you may know," EVER. Nothing in this module computes,
//      stores, or surfaces graph-derived suggestions. Permanent.
//   3. Two personas, two graphs — everything keyed by profileId.
//   4. Mutual knowledge only: you may learn YOUR relationship to a
//      soul, never anyone's list.
// And the one that governs every function: NOTHING social ever touches
// the public ledger. Gate clearances run in PRIVATE recording mode;
// fee entries are blinded (no counterparty reference).

import { randomUUID } from "crypto";
import type { PrismaClient } from "@prisma/client";
import type { DbOrTx, Tx } from "./db";
import { clearGate } from "./gate";
import { getRail } from "./rails";
import { hasPostingConsents } from "./consent";
import { chargeToTreasury, maybeFirstActionGrant } from "./economy";
import { accrueForAction } from "./accrual";
import { notify } from "./notifications";

export type SocialResult<T = object> = ({ ok: true } & T) | { ok: false; reason: string };

/** Normalized pair key — one bond row, one thread per pair. */
export function pairOf(a: string, b: string): { a: string; b: string; key: string } {
  return a < b ? { a, b, key: `${a}:${b}` } : { a: b, b: a, key: `${b}:${a}` };
}

// -------------------------------------------------------------- the graph

/** Are these two profiles fellow souls? (§4.4 — mutual knowledge only:
 *  callers may only ever surface this for the viewer's OWN pair.) */
export async function areFellowSouls(
  db: DbOrTx,
  profileA: string,
  profileB: string
): Promise<boolean> {
  const { a, b } = pairOf(profileA, profileB);
  const bond = await db.fellowSoulBond.findUnique({
    where: { aProfileId_bProfileId: { aProfileId: a, bProfileId: b } },
  });
  return bond !== null;
}

/** The viewer's own bonds — the ONLY list this module ever returns,
 *  and only for the profile asking about itself. */
export async function myFellowSouls(db: PrismaClient, profileId: string) {
  const bonds = await db.fellowSoulBond.findMany({
    where: { OR: [{ aProfileId: profileId }, { bProfileId: profileId }] },
    orderBy: { createdAt: "asc" },
  });
  const otherIds = bonds.map((b) =>
    b.aProfileId === profileId ? b.bProfileId : b.aProfileId
  );
  return db.profile.findMany({
    where: { id: { in: otherIds } },
    select: { id: true, handle: true, displayName: true, face: true },
  });
}

export async function isBlocked(
  db: DbOrTx,
  blockerProfileId: string,
  blockedProfileId: string
): Promise<boolean> {
  const row = await db.block.findUnique({
    where: {
      blockerProfileId_blockedProfileId: { blockerProfileId, blockedProfileId },
    },
  });
  return row !== null;
}

// --------------------------------------------------------------- requests

/**
 * Send a fellow-soul request (§2): gate-cleared (private recording —
 * social actions are not civic record), initiator pays the rail, one
 * optional short note. Declined/ignored senders face the cooldown rail.
 */
export async function sendFellowSoulRequest(
  db: PrismaClient,
  input: { fromProfileId: string; toHandle: string; note?: string }
): Promise<SocialResult> {
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
  if (to.id === from.id) {
    return { ok: false, reason: "You are already your own fellow soul." };
  }
  if (await areFellowSouls(db, from.id, to.id)) {
    return { ok: false, reason: "You are already fellow souls." };
  }
  // Blocks are quiet (§5.2): the same neutral refusal a stranger would
  // see for any undeliverable request — never a block notice.
  if (await isBlocked(db, to.id, from.id)) {
    return { ok: false, reason: "This request can't be delivered." };
  }
  const pending = await db.fellowSoulRequest.findFirst({
    where: { fromProfileId: from.id, toProfileId: to.id, status: "pending" },
  });
  if (pending) return { ok: false, reason: "Your request is already waiting, quietly." };

  // The cooldown (§2, rail): a declined or expired-ignored request
  // holds the door shut for a while.
  const cooldownDays = await getRail(db, "social.requestCooldownDays");
  const recentRefusal = await db.fellowSoulRequest.findFirst({
    where: {
      fromProfileId: from.id,
      toProfileId: to.id,
      status: { in: ["declined", "expired"] },
      resolvedAt: { gte: new Date(Date.now() - cooldownDays * 86_400_000) },
    },
  });
  if (recentRefusal) {
    return {
      ok: false,
      reason: `A recent request to this soul was declined or lapsed — the door reopens after ${cooldownDays} days.`,
    };
  }

  const gate = await clearGate(db, {
    profileId: from.id,
    scope: `fellow-request:${randomUUID()}`,
    scopeKind: "per-profile",
    ledgerRecording: "private",
  });
  if (gate.outcome !== "CLEARED") return { ok: false, reason: `Gate: ${gate.outcome}` };

  try {
    await db.$transaction(async (tx) => {
      // Initiator pays (participation-cost rule) — the fee entry is
      // BLINDED: no reference to the recipient; who-asked-whom stays
      // out of the economy table entirely.
      const fee = await chargeToTreasury(tx, {
        profileId: from.id,
        currency: "PC",
        amount: await getRail(tx, "social.requestFee"),
        kind: "fee.request",
      });
      if (!fee.ok) throw new Error(fee.reason);
      await maybeFirstActionGrant(tx, from.id);
      await accrueForAction(tx, from.id);
      await tx.fellowSoulRequest.create({
        data: {
          fromProfileId: from.id,
          toProfileId: to.id,
          note: input.note?.trim() || null,
        },
      });
      // One quiet entry, nothing further, ever (§2.3): requests wait
      // politely; urgency is the requester's, not yours.
      await notify(tx, {
        profileId: to.id,
        tier: "quiet",
        category: "request",
        title: "A soul asks to be your fellow soul",
        body: "A request waits in your Souls page. Accept, ignore, or decline — all free, no clock ticking at you.",
        refType: "souls",
        aggregationKey: "fellow-requests",
      });
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

/** Accept (free): the bond forms; any pending stranger thread between
 *  the pair opens. */
export async function respondToRequest(
  db: PrismaClient,
  input: { requestId: string; profileId: string; accept: boolean }
): Promise<SocialResult> {
  const request = await db.fellowSoulRequest.findUnique({ where: { id: input.requestId } });
  if (!request || request.toProfileId !== input.profileId) {
    return { ok: false, reason: "Not your request." };
  }
  if (request.status !== "pending") return { ok: false, reason: "This request has settled." };

  await db.$transaction(async (tx) => {
    await tx.fellowSoulRequest.update({
      where: { id: request.id },
      data: { status: input.accept ? "accepted" : "declined", resolvedAt: new Date() },
    });
    if (input.accept) {
      const { a, b, key } = pairOf(request.fromProfileId, request.toProfileId);
      await tx.fellowSoulBond.upsert({
        where: { aProfileId_bProfileId: { aProfileId: a, bProfileId: b } },
        create: { aProfileId: a, bProfileId: b },
        update: {},
      });
      // Fellow souls land direct (§3/§5): a waiting stranger thread opens.
      await tx.dmThread.updateMany({
        where: { pairKey: key, status: "request" },
        data: { status: "open" },
      });
      // The requester learns the good news — quiet; nothing was asked of them.
      await notify(tx, {
        profileId: request.fromProfileId,
        tier: "quiet",
        category: "request",
        title: "Your fellow-soul request was accepted",
        body: "You are fellow souls now — DMs land direct.",
        refType: "souls",
        aggregationKey: "fellow-accepted",
      });
    }
    // Declines are silent to the requester (§2: declined requests end
    // there) — no notification, no re-notification, ever.
  });
  return { ok: true };
}

/**
 * Release a bond. The spec makes the bond mutual CONSENT — consent is
 * ongoing, so either side may withdraw it, quietly (the same
 * no-notification discipline as blocking; flagged in
 * DECISIONS_PENDING as a derived rule). DMs between the pair fall back
 * to the request rules next time.
 */
export async function releaseBond(
  db: PrismaClient,
  input: { profileId: string; otherProfileId: string }
): Promise<SocialResult> {
  const { a, b } = pairOf(input.profileId, input.otherProfileId);
  const bond = await db.fellowSoulBond.findUnique({
    where: { aProfileId_bProfileId: { aProfileId: a, bProfileId: b } },
  });
  if (!bond) return { ok: false, reason: "No bond to release." };
  await db.fellowSoulBond.delete({ where: { id: bond.id } });
  return { ok: true };
}

// ---------------------------------------------------------------- blocking

/** Block, per-profile, one-way, quiet (§5.2). */
export async function blockSoul(
  db: PrismaClient,
  input: { blockerProfileId: string; blockedHandle: string }
): Promise<SocialResult> {
  const blocked = await db.profile.findUnique({
    where: { handle: input.blockedHandle.trim().replace(/^@/, "").toLowerCase() },
  });
  if (!blocked) return { ok: false, reason: "No soul answers to that handle." };
  if (blocked.id === input.blockerProfileId) {
    return { ok: false, reason: "You cannot block yourself." };
  }
  await db.block.upsert({
    where: {
      blockerProfileId_blockedProfileId: {
        blockerProfileId: input.blockerProfileId,
        blockedProfileId: blocked.id,
      },
    },
    create: { blockerProfileId: input.blockerProfileId, blockedProfileId: blocked.id },
    update: {},
  });
  return { ok: true };
}

export async function unblockSoul(
  db: PrismaClient,
  input: { blockerProfileId: string; blockedProfileId: string }
): Promise<SocialResult> {
  await db.block.deleteMany({
    where: {
      blockerProfileId: input.blockerProfileId,
      blockedProfileId: input.blockedProfileId,
    },
  });
  return { ok: true };
}

// ----------------------------------------------------------------- hygiene

/** Expiry sweep (rail; owner-resolved 30 days): pending requests lapse
 *  quietly. Run opportunistically like every other sweep. */
export async function expireStaleRequests(db: PrismaClient): Promise<void> {
  const days = await getRail(db, "social.requestExpiryDays");
  const cutoff = new Date(Date.now() - days * 86_400_000);
  await db.fellowSoulRequest.updateMany({
    where: { status: "pending", createdAt: { lte: cutoff } },
    data: { status: "expired", resolvedAt: new Date() },
  });
  // Stranger threads that were never answered lapse the same way —
  // back to a sendable state? No: the thread row stays (the initiator
  // paid to open it); only the REQUEST decoration ends. Unanswered
  // stranger threads simply sit; the receiver may still answer later.
  // (The expiry rail governs the requests AREA — fellow-soul asks —
  // per the owner's 2026-07-09 resolution.)
}

/** Everything the viewer's requests area shows (§5.3: requests are
 *  quiet): incoming fellow-soul requests, for this face only. */
export async function requestsFor(db: PrismaClient, profileId: string) {
  const incoming = await db.fellowSoulRequest.findMany({
    where: { toProfileId: profileId, status: "pending" },
    orderBy: { createdAt: "asc" },
  });
  const senders = await db.profile.findMany({
    where: { id: { in: incoming.map((r) => r.fromProfileId) } },
    select: { id: true, handle: true, displayName: true },
  });
  const senderById = new Map(senders.map((s) => [s.id, s]));
  return incoming.map((r) => ({
    id: r.id,
    note: r.note,
    createdAt: r.createdAt,
    from: senderById.get(r.fromProfileId) ?? null,
  }));
}
