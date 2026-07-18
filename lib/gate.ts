// The gate — the single flow every gated action uses, forever
// (DUAL_IDENTITY_MODULE.md §3.3):
//
//   action → PENDING → proof → nullifier checked unseen → CLEARED → settle
//
// Application code never branches on identity — only on clearance. One
// gate serves Polls, Circles, Discussions, moderation eligibility, and
// anything added later. NO FEATURE MAY EVER BYPASS THIS INTERFACE, even
// in Phase A when bypassing would be easy (§10; BUILD_ORDER Rule 2). The
// interface is the contract; the trust model behind it upgrades on
// schedule (Phase B: client-side ZK proofs; Phase C: operator secret
// retired), not the callers.

import { Prisma, PrismaClient } from "@prisma/client";
import type { Tx } from "./db";
import { appendEvent } from "./ledger";
import { nullifierFor, type ScopeKind } from "./nullifier";

/**
 * Ships with the feature it describes (BUILD_ORDER Rule 5). Shown wherever
 * the gate's guarantee is claimed, until Phase B/C make it obsolete.
 */
export const PHASE_A_DISCLOSURE =
  "Unlinkability is currently operator policy, not yet cryptography. " +
  "AgoraNet's gate enforces one-per-scope integrity with an operator-held " +
  "secret: we are structurally honest, but you are trusting us not to " +
  "look. The replacement is no longer hypothetical: a public Midnight " +
  "testnet contract already proves the nullifier half on-chain with " +
  "zero-knowledge proofs — that no subject can act twice in a scope, " +
  "verifiable by anyone. Binding each subject to a single human (so a new " +
  "secret can't just be minted) is the other half, and remains the " +
  "cutover work ahead. The live gate cuts over when both halves are " +
  "proven and proving is consumer-ready; until then, this notice stays up.";

export type GateOutcome = "CLEARED" | "DUPLICATE" | "INVALID";

/**
 * How a clearance is recorded publicly. "pseudonymous" (default): civic
 * actions are public record — pseudonym + nullifier + timestamp on the
 * ledger. "private": the gate still enforces humanity + one-per-scope,
 * but NO public event exists — for actions whose existence must not be
 * observable (flags: MODERATION §3.2's triangle of blindness — the
 * public sees only outcomes; same reasoning as §4.3's nullifier-keyed
 * sealed ballots).
 */
export type LedgerRecording = "pseudonymous" | "private";

export interface GateResult {
  outcome: GateOutcome;
  requestId: string;
  /** Present on CLEARED — the opaque per-scope nullifier on the ledger. */
  nullifier?: string;
}

/** Step 1: the action is marked PENDING and a proof is requested. */
export async function requestGate(
  db: PrismaClient,
  input: {
    profileId: string;
    scope: string;
    scopeKind: ScopeKind;
    ledgerRecording?: LedgerRecording;
  }
) {
  return db.gateRequest.create({
    data: {
      profileId: input.profileId,
      scope: input.scope,
      scopeKind: input.scopeKind,
      ledgerRecording: input.ledgerRecording ?? "pseudonymous",
      status: "PENDING",
    },
  });
}

/**
 * Step 2: the proof arrives and is checked. In Phase A the "proof" is the
 * server deriving the HMAC nullifier itself (operator-trusted); in Phase B
 * the soul's wallet sends a ZK proof and this function only verifies. The
 * caller sees CLEARED / DUPLICATE / INVALID — and nothing else.
 *
 * A DUPLICATE is deliberately private (§3.2): the request row records it
 * for the soul, but no public ledger event exists — enforcement must never
 * become an observation channel.
 */
export async function submitProof(
  db: PrismaClient,
  requestId: string
): Promise<GateResult> {
  const request = await db.gateRequest.findUnique({
    where: { id: requestId },
    include: { profile: true },
  });
  if (!request || request.status !== "PENDING") {
    if (request) {
      await db.gateRequest.update({
        where: { id: requestId },
        data: { status: "INVALID", resolvedAt: new Date() },
      });
    }
    return { outcome: "INVALID", requestId };
  }

  const scopeKind = request.scopeKind as ScopeKind;
  // An Alias carries no humanId (deliberately — lib/identity.ts), so it
  // cannot act in per-human scopes. Per the ratified scope table those
  // are registration-only anyway; anything else per-human is reserved.
  const subjectId =
    scopeKind === "per-human" ? request.profile.humanId : request.profileId;
  if (!subjectId) {
    await db.gateRequest.update({
      where: { id: requestId },
      data: { status: "INVALID", resolvedAt: new Date() },
    });
    return { outcome: "INVALID", requestId };
  }
  const nullifier = nullifierFor(request.scope, scopeKind, subjectId);

  try {
    return await db.$transaction(async (tx) => {
      // The uniqueness check IS the one-per-scope enforcement: same
      // subject + same scope ⇒ same nullifier ⇒ this insert collides.
      await tx.nullifierSpend.create({
        data: { scope: request.scope, nullifier },
      });
      await tx.gateRequest.update({
        where: { id: requestId },
        data: { status: "CLEARED", nullifier, resolvedAt: new Date() },
      });
      if (request.ledgerRecording === "pseudonymous") {
        await appendEvent(tx, {
          actorType: "soul",
          actorId: request.profile.handle,
          eventType: "gate.cleared",
          payload: {
            scope: request.scope,
            scopeKind,
            nullifier,
            handle: request.profile.handle,
          },
        });
      }
      return { outcome: "CLEARED" as const, requestId, nullifier };
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      await db.gateRequest.update({
        where: { id: requestId },
        data: { status: "DUPLICATE", resolvedAt: new Date() },
      });
      return { outcome: "DUPLICATE", requestId };
    }
    throw err;
  }
}

/**
 * The gate flow, run INSIDE the caller's transaction — the tx-aware twin of
 * clearGate (same contract: scope in, opaque outcome out). Because the
 * nullifier spend commits with the feature write, an action that rolls back
 * no longer strands a spent nullifier that would refuse the retry as a
 * DUPLICATE (DECISIONS_PENDING #25). This is still THE gate — feature code
 * branches on outcome only, never on identity.
 *
 * The duplicate check is a findUnique, NOT a caught insert: a P2002 inside
 * the caller's transaction would abort it on Postgres. The pre-check clears
 * the common "already acted" case without touching the transaction; the
 * rare truly-simultaneous spend still collides on the create below and rolls
 * the whole action back — correct now, because the retry finds no spend.
 */
export async function clearGateTx(
  tx: Tx,
  input: {
    profileId: string;
    scope: string;
    scopeKind: ScopeKind;
    ledgerRecording?: LedgerRecording;
  }
): Promise<GateResult> {
  const ledgerRecording = input.ledgerRecording ?? "pseudonymous";
  const request = await tx.gateRequest.create({
    data: {
      profileId: input.profileId,
      scope: input.scope,
      scopeKind: input.scopeKind,
      ledgerRecording,
      status: "PENDING",
    },
  });

  const profile = await tx.profile.findUnique({ where: { id: input.profileId } });
  // An Alias carries no humanId (deliberately — lib/identity.ts), so it
  // cannot act in per-human scopes.
  const subjectId =
    input.scopeKind === "per-human" ? profile?.humanId : input.profileId;
  if (!profile || !subjectId) {
    await tx.gateRequest.update({
      where: { id: request.id },
      data: { status: "INVALID", resolvedAt: new Date() },
    });
    return { outcome: "INVALID", requestId: request.id };
  }

  const nullifier = nullifierFor(input.scope, input.scopeKind, subjectId);
  const existing = await tx.nullifierSpend.findUnique({
    where: { scope_nullifier: { scope: input.scope, nullifier } },
  });
  if (existing) {
    // Private duplicate record (§3.2): a row for the soul, no public event.
    await tx.gateRequest.update({
      where: { id: request.id },
      data: { status: "DUPLICATE", resolvedAt: new Date() },
    });
    return { outcome: "DUPLICATE", requestId: request.id };
  }

  await tx.nullifierSpend.create({ data: { scope: input.scope, nullifier } });
  await tx.gateRequest.update({
    where: { id: request.id },
    data: { status: "CLEARED", nullifier, resolvedAt: new Date() },
  });
  if (ledgerRecording === "pseudonymous") {
    await appendEvent(tx, {
      actorType: "soul",
      actorId: profile.handle,
      eventType: "gate.cleared",
      payload: {
        scope: input.scope,
        scopeKind: input.scopeKind,
        nullifier,
        handle: profile.handle,
      },
    });
  }
  return { outcome: "CLEARED", requestId: request.id, nullifier };
}

/**
 * The full flow in one call. Prefer clearGateTx from inside a feature
 * transaction so the spend and the write commit together; this wrapper
 * remains for callers that own no surrounding transaction. On the rare
 * simultaneous-spend P2002 (the pre-check missed it), report the DUPLICATE
 * it is — the transaction rolled back, so nothing was spent.
 */
export async function clearGate(
  db: PrismaClient,
  input: {
    profileId: string;
    scope: string;
    scopeKind: ScopeKind;
    ledgerRecording?: LedgerRecording;
  }
): Promise<GateResult> {
  try {
    return await db.$transaction((tx) => clearGateTx(tx, input));
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { outcome: "DUPLICATE", requestId: "" };
    }
    throw err;
  }
}

/** True for any Prisma unique-constraint (P2002) error. Necessary but NOT
 *  sufficient to conclude a gated action was a duplicate — a transaction can
 *  raise P2002 from OTHER unique constraints (the ledger's prevHash under
 *  concurrent appends, a GrantClaim first-action race). Use
 *  gateDuplicateConfirmed to decide DUPLICATE; this is its first gate. */
export function isGateDuplicateError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

/**
 * After a gated transaction rolls back with a P2002, decide whether it was
 * genuinely the one-per-scope nullifier collision — versus an unrelated
 * unique clash (a ledger-prevHash race, a GrantClaim first-action race) that
 * happened to roll the same transaction back. Returns true ONLY if the error
 * is P2002 AND this subject's nullifier for this scope is now actually spent
 * (by the winner of a truly-simultaneous race). Otherwise the action rolled
 * back cleanly and is genuinely retryable — the caller must re-throw so it
 * surfaces as a retryable error, never a misleading "you already did this".
 *
 * Fixed-scope gated actions call this from their OUTER catch (never inside
 * the transaction — a caught P2002 poisons it on Postgres). Cannot fire on
 * SQLite, which serialises writers; a Postgres-only edge, like #25 itself.
 */
export async function gateDuplicateConfirmed(
  db: PrismaClient,
  err: unknown,
  input: { profileId: string; scope: string; scopeKind: ScopeKind }
): Promise<boolean> {
  if (!isGateDuplicateError(err)) return false;
  const profile = await db.profile.findUnique({ where: { id: input.profileId } });
  const subjectId =
    input.scopeKind === "per-human" ? profile?.humanId : input.profileId;
  if (!subjectId) return false;
  const nullifier = nullifierFor(input.scope, input.scopeKind, subjectId);
  const spent = await db.nullifierSpend.findUnique({
    where: { scope_nullifier: { scope: input.scope, nullifier } },
  });
  return spent !== null;
}

export type RegistrationOutcome = "CLEARED" | "DUPLICATE";

/**
 * The gate's own bootstrap (DUAL_IDENTITY §3.2 steps 2–3): registration
 * ceremonies prove "this human has not registered in this scope before."
 * Always per-human by definition — this IS the one-True-Self /
 * one-Alias enforcement. No profile exists yet, so there is no
 * GateRequest row; the nullifier spend is the enforcement record, and
 * the ceremony (lib/identity.ts) decides what, if anything, reaches the
 * public ledger — a True Self registration is public immediately; an
 * Alias leaves no public trace until its cohort activates (ONBOARDING
 * §3.3–3.4: registration time must never be observable).
 *
 * The humanId is used transiently to derive the nullifier and is not
 * stored by this function. Runs inside the caller's transaction so the
 * spend and the profile creation commit atomically.
 */
export async function clearRegistration(
  tx: { nullifierSpend: PrismaClient["nullifierSpend"] },
  input: { humanId: string; scope: "true-self-registration" | "alias-registration" }
): Promise<{ outcome: RegistrationOutcome; nullifier: string }> {
  const nullifier = nullifierFor(input.scope, "per-human", input.humanId);
  try {
    await tx.nullifierSpend.create({
      data: { scope: input.scope, nullifier },
    });
    return { outcome: "CLEARED", nullifier };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { outcome: "DUPLICATE", nullifier };
    }
    throw err;
  }
}
