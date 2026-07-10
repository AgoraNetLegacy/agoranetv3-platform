// Identity ceremonies (Phase 2 — ONBOARDING_SPEC.md §2–3, DUAL_IDENTITY
// §3.2, Phase A trust model per §10).
//
// INTERIM ISSUER: in Phase A the platform plays the KYC issuer's role —
// clearly disclosed. The soul receives a credential secret shown ONCE
// (their "wallet"); the platform stores only its hash. At Phase B the
// real issuer (Lace ID / Identus) replaces this and the platform's copy
// of even the hash disappears from the path.
//
// The load-bearing structural choice: an Alias profile stores NO humanId.
// One-Alias-per-human is enforced by the alias-registration nullifier
// spend — the humanId is used transiently to derive it and never written
// to the Alias row. No database row links a soul's two faces. (The
// honest Phase A residual: the operator secret could re-derive the
// registration nullifiers — that is exactly the "policy, not yet
// cryptography" disclosure, retired at Phase C.)

import { createHash, randomBytes } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { clearRegistration } from "./gate";
import { appendEvent } from "./ledger";
import { getRail } from "./rails";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function newSecret(): string {
  return randomBytes(32).toString("hex");
}

function monthOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type CeremonyResult<T> = { ok: true } & T | { ok: false; reason: string };

/**
 * Stage 2 — the verification ceremony, interim issuer. Returns the
 * credential secret exactly once; only its hash persists. No profile
 * exists yet and nothing reaches the ledger — verification is an
 * issuer-side event, not a platform one.
 */
export async function verifyHumanity(
  db: PrismaClient
): Promise<{ credential: string }> {
  const credential = newSecret();
  await db.human.create({ data: { credentialHash: sha256(credential) } });
  return { credential };
}

async function humanFromCredential(db: PrismaClient, credential: string) {
  return db.human.findUnique({
    where: { credentialHash: sha256(credential.trim()) },
  });
}

/**
 * Stage 3 — True Self creation. One per human, enforced blind by the
 * true-self-registration nullifier. The ledger records the registration
 * pseudonym-only, immediately — the True Self has no timing sensitivity.
 */
export async function registerTrueSelf(
  db: PrismaClient,
  input: { credential: string; handle: string }
): Promise<CeremonyResult<{ profileId: string; accessKey: string }>> {
  const handle = input.handle.trim();
  if (!handle) return { ok: false, reason: "Choose a handle." };

  const human = await humanFromCredential(db, input.credential);
  if (!human) return { ok: false, reason: "Credential not recognized." };

  const taken = await db.profile.findUnique({ where: { pseudonym: handle } });
  if (taken) return { ok: false, reason: "That handle is taken." };

  const accessKey = newSecret();
  try {
    const profile = await db.$transaction(async (tx) => {
      const registration = await clearRegistration(tx, {
        humanId: human.id,
        scope: "true-self-registration",
      });
      if (registration.outcome === "DUPLICATE") {
        throw new DuplicateRegistration();
      }
      const created = await tx.profile.create({
        data: {
          humanId: human.id,
          face: "TRUE_SELF",
          pseudonym: handle,
          accessKeyHash: sha256(accessKey),
          status: "active",
          joinedPeriod: monthOf(new Date()),
        },
      });
      await appendEvent(tx, {
        actorType: "soul",
        actorId: handle,
        eventType: "trueself.registered",
        payload: { pseudonym: handle, nullifier: registration.nullifier },
      });
      return created;
    });
    return { ok: true, profileId: profile.id, accessKey };
  } catch (err) {
    if (err instanceof DuplicateRegistration) {
      // Visible only to the soul (DUAL_IDENTITY §3.2).
      return { ok: false, reason: "This human already holds a True Self." };
    }
    throw err;
  }
}

class DuplicateRegistration extends Error {}

/**
 * The Alias ceremony (ONBOARDING §3) — deliberately decoupled, with
 * every timing mitigation:
 *  - initiated by credential, never from a True Self session (§3.2);
 *  - NO public trace at registration — the ledger learns nothing until
 *    the cohort activates (§3.3–3.4);
 *  - activation at a random point inside the rail window, snapped to
 *    the next cohort boundary so no Alias ever appears alone;
 *  - coarse join period only (§3.5);
 *  - the §3.6 disclosures are blocking — the caller must have shown
 *    them (the ack is recorded on the new profile in-transaction).
 */
export async function registerAlias(
  db: PrismaClient,
  input: { credential: string; handle: string; disclosuresAccepted: boolean }
): Promise<CeremonyResult<{ accessKey: string; activationHint: string }>> {
  const handle = input.handle.trim();
  if (!handle) return { ok: false, reason: "Choose a handle." };
  if (!input.disclosuresAccepted) {
    return { ok: false, reason: "The Alias disclosures must be acknowledged." };
  }

  const human = await humanFromCredential(db, input.credential);
  if (!human) return { ok: false, reason: "Credential not recognized." };

  const taken = await db.profile.findUnique({ where: { pseudonym: handle } });
  if (taken) return { ok: false, reason: "That handle is taken." };

  const [minHours, maxHours, cadenceHours] = await Promise.all([
    getRail(db, "identity.aliasActivationMinHours"),
    getRail(db, "identity.aliasActivationMaxHours"),
    getRail(db, "identity.aliasCohortCadenceHours"),
  ]);
  const randomDelayMs =
    (minHours + Math.random() * (maxHours - minHours)) * 3_600_000;
  const cadenceMs = cadenceHours * 3_600_000;
  // Snap UP to the next cohort boundary (epoch-aligned): the Alias
  // appears with its cohort, never alone at a correlatable moment.
  const activateAt = new Date(
    Math.ceil((Date.now() + randomDelayMs) / cadenceMs) * cadenceMs
  );

  const accessKey = newSecret();
  try {
    await db.$transaction(async (tx) => {
      const registration = await clearRegistration(tx, {
        humanId: human.id,
        scope: "alias-registration",
      });
      if (registration.outcome === "DUPLICATE") {
        throw new DuplicateRegistration();
      }
      const created = await tx.profile.create({
        data: {
          // humanId deliberately absent — see the module header.
          face: "ALIAS",
          pseudonym: handle,
          accessKeyHash: sha256(accessKey),
          status: "pending",
          activateAt,
          joinedPeriod: monthOf(activateAt),
        },
      });
      await tx.consentAck.create({
        data: {
          profileId: created.id,
          kind: "alias-disclosures",
          version: "phase-a-v1",
        },
      });
      // NO ledger event here, by design.
    });
    return {
      ok: true,
      accessKey,
      // Roughly when — never the exact time, so even the soul's own
      // knowledge can't become a precise correlation anchor (§3.7).
      activationHint: "within the next few days",
    };
  } catch (err) {
    if (err instanceof DuplicateRegistration) {
      return { ok: false, reason: "This human already holds an Alias." };
    }
    throw err;
  }
}

/**
 * Release due cohorts: every pending Alias whose moment has arrived
 * activates in a batch, and the batch shares one public timestamp — the
 * cohort's, not any individual's. Called opportunistically (hub, login)
 * — no scheduler infrastructure needed yet.
 */
export async function activateDueAliases(db: PrismaClient): Promise<number> {
  const due = await db.profile.findMany({
    where: { status: "pending", activateAt: { lte: new Date() } },
    orderBy: { activateAt: "asc" },
  });
  for (const profile of due) {
    await db.$transaction(async (tx) => {
      await tx.profile.update({
        where: { id: profile.id },
        data: { status: "active" },
      });
      await appendEvent(tx, {
        actorType: "system",
        eventType: "alias.activated",
        payload: {
          pseudonym: profile.pseudonym,
          cohort: profile.activateAt!.toISOString(),
        },
      });
    });
  }
  return due.length;
}

/** Per-face login: each face has its own key; login never touches the Human. */
export async function profileForAccessKey(db: PrismaClient, accessKey: string) {
  const profile = await db.profile.findUnique({
    where: { accessKeyHash: sha256(accessKey.trim()) },
  });
  if (!profile) return { ok: false as const, reason: "Access key not recognized." };
  if (profile.status !== "active") {
    return {
      ok: false as const,
      reason: "This face has not activated yet — check back soon.",
    };
  }
  return { ok: true as const, profile };
}
