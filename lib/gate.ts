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
  "look. The cryptographic rail (Midnight/Identus) replaces this trust " +
  "with math on a published schedule — until then, this notice stays up.";

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
  const subjectId =
    scopeKind === "per-human" ? request.profile.humanId : request.profileId;
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
          actorId: request.profile.pseudonym,
          eventType: "gate.cleared",
          payload: {
            scope: request.scope,
            scopeKind,
            nullifier,
            pseudonym: request.profile.pseudonym,
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

/** The full flow in one call — what feature code will actually use. */
export async function clearGate(
  db: PrismaClient,
  input: {
    profileId: string;
    scope: string;
    scopeKind: ScopeKind;
    ledgerRecording?: LedgerRecording;
  }
): Promise<GateResult> {
  const request = await requestGate(db, input);
  return submitProof(db, request.id);
}
