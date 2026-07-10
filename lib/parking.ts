// Sessions & the parking rule (SEVEN_PILLAR_DASHBOARD_SPEC §3).
//
// A SoulSession is one browser context — the only place a soul's two
// faces ever co-occur, and only while both are signed in there. That
// shared context is what lets the backend enforce "one face per pillar
// at a time" without holding any durable link between the faces. The
// rows are short-retention by design and purged on expiry (DUAL_IDENTITY
// §7.2). A soul using two separate browsers steps outside the lock's
// enforceable context — the lock protects them within the session that
// knows both faces; it cannot (and must not) consult a cross-face
// registry that doesn't exist.

import type { PrismaClient } from "@prisma/client";
import { getRail } from "./rails";

export async function createSession(db: PrismaClient): Promise<string> {
  const lifetimeHours = await getRail(db, "identity.sessionLifetimeHours");
  const session = await db.soulSession.create({
    data: { expiresAt: new Date(Date.now() + lifetimeHours * 3_600_000) },
  });
  return session.id;
}

/** Purge expired sessions (cascades faces + locks) and stale pillar locks. */
export async function purgeExpired(db: PrismaClient): Promise<void> {
  const timeoutMinutes = await getRail(db, "identity.pillarSessionTimeoutMinutes");
  await db.soulSession.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  await db.pillarLock.deleteMany({
    where: { lastActiveAt: { lte: new Date(Date.now() - timeoutMinutes * 60_000) } },
  });
}

export async function getSession(db: PrismaClient, sessionId: string) {
  await purgeExpired(db);
  return db.soulSession.findFirst({
    where: { id: sessionId, expiresAt: { gt: new Date() } },
    include: { faces: true, locks: true },
  });
}

/** Sign a face into this session (after access-key login). */
export async function addFace(
  db: PrismaClient,
  input: { sessionId: string; profileId: string }
): Promise<void> {
  await db.sessionFace.upsert({
    where: {
      sessionId_profileId: {
        sessionId: input.sessionId,
        profileId: input.profileId,
      },
    },
    create: { sessionId: input.sessionId, profileId: input.profileId },
    update: {},
  });
}

export type ParkingResult =
  | { allowed: true }
  | { allowed: false; heldByHandle: string; heldByFace: string };

/**
 * The hard lock (§3.3): a face entering a pillar takes the lot; the
 * session's OTHER face is blocked until that lot is released. Blocked
 * entry names the holding face plainly — expected behavior, not an
 * error state.
 */
export async function enterPillar(
  db: PrismaClient,
  input: { sessionId: string; profileId: string; pillarId: string }
): Promise<ParkingResult> {
  const timeoutMinutes = await getRail(db, "identity.pillarSessionTimeoutMinutes");
  const staleBefore = new Date(Date.now() - timeoutMinutes * 60_000);

  const lock = await db.pillarLock.findUnique({
    where: {
      sessionId_pillarId: {
        sessionId: input.sessionId,
        pillarId: input.pillarId,
      },
    },
  });

  if (lock && lock.profileId !== input.profileId && lock.lastActiveAt > staleBefore) {
    const holder = await db.profile.findUnique({ where: { id: lock.profileId } });
    return {
      allowed: false,
      heldByHandle: holder?.handle ?? "your other face",
      heldByFace: holder?.face === "TRUE_SELF" ? "True Self" : "Alias",
    };
  }

  await db.pillarLock.upsert({
    where: {
      sessionId_pillarId: {
        sessionId: input.sessionId,
        pillarId: input.pillarId,
      },
    },
    create: {
      sessionId: input.sessionId,
      pillarId: input.pillarId,
      profileId: input.profileId,
    },
    update: { profileId: input.profileId, lastActiveAt: new Date() },
  });
  return { allowed: true };
}

/** Returning to the hub ends this face's pillar sessions (§3.3.5). */
export async function releaseLocks(
  db: PrismaClient,
  input: { sessionId: string; profileId: string }
): Promise<void> {
  await db.pillarLock.deleteMany({
    where: { sessionId: input.sessionId, profileId: input.profileId },
  });
}

/** End one pillar's session in this browser (the blocked-entry remedy). */
export async function releaseLock(
  db: PrismaClient,
  input: { sessionId: string; pillarId: string }
): Promise<void> {
  await db.pillarLock.deleteMany({
    where: { sessionId: input.sessionId, pillarId: input.pillarId },
  });
}

/**
 * The face-switch flow (§3.4): a deliberate control. Ends the departing
 * face's locks, then enforces the cooldown rail before the next switch
 * (DUAL_IDENTITY §7.2 timing mitigation).
 */
export async function switchFace(
  db: PrismaClient,
  input: { sessionId: string; fromProfileId: string | null; toProfileId: string }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const session = await db.soulSession.findUnique({
    where: { id: input.sessionId },
    include: { faces: true },
  });
  if (!session) return { ok: false, reason: "Session expired." };

  const target = session.faces.find((f) => f.profileId === input.toProfileId);
  if (!target) return { ok: false, reason: "That face is not signed in here." };

  const cooldownMinutes = await getRail(db, "identity.faceSwitchCooldownMinutes");
  const lastSwitchAt = session.lastSwitchAt;
  if (
    session.activeProfileId !== null &&
    session.activeProfileId !== input.toProfileId &&
    lastSwitchAt &&
    Date.now() - lastSwitchAt.getTime() < cooldownMinutes * 60_000
  ) {
    const wait = Math.ceil(
      (cooldownMinutes * 60_000 - (Date.now() - lastSwitchAt.getTime())) / 60_000
    );
    return {
      ok: false,
      reason: `Face-switch cooldown: try again in about ${wait} minute(s).`,
    };
  }

  if (input.fromProfileId) {
    await releaseLocks(db, {
      sessionId: input.sessionId,
      profileId: input.fromProfileId,
    });
  }
  await db.soulSession.update({
    where: { id: input.sessionId },
    data: { activeProfileId: input.toProfileId, lastSwitchAt: new Date() },
  });
  return { ok: true };
}
