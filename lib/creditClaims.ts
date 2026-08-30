// Explicit Credits → fake testnet asset bridge. Requesting a claim moves
// Credits into a transparent treasury-held reservation. Confirmation keeps
// them there as the conversion sink; a terminal failure mechanically refunds
// the same identity. The chain, not a browser callback, proves delivery.

import { randomUUID } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { BUDGET_CREDIT_CLAIM_REFUNDS } from "./budget";
import { cardanoNetwork, walletLinkFor } from "./chain";
import { chargeToTreasury, payFromTreasury, type Currency } from "./economy";
import { creditClaimsTestnetEnabled, testnetAssetRegistry } from "./progressiveEconomy";
import { getRail } from "./rails";
import { createTokenIntent, transitionTokenIntent } from "./tokenIntents";
type Environment = Record<string, string | undefined>;

export type CreditClaimResult =
  | { ok: true; claimId: string }
  | { ok: false; reason: string };

export async function requestCreditClaim(
  db: PrismaClient,
  input: {
    profileId: string;
    currency: Currency;
    creditAmount: number;
    idempotencyKey?: string;
  },
  env: Environment = process.env
): Promise<CreditClaimResult> {
  if (!creditClaimsTestnetEnabled(env)) {
    return { ok: false, reason: "Platform-to-wallet token transfers are not enabled yet." };
  }
  if (!Number.isInteger(input.creditAmount)) {
    return { ok: false, reason: "Choose a whole number of PC or G to move." };
  }
  const [minimum, maximum, conversion, expiryHours] = await Promise.all([
    getRail(db, "onchain.claimMinCredits"),
    getRail(db, "onchain.claimMaxCredits"),
    getRail(db, "onchain.claimAssetPerCredit"),
    getRail(db, "onchain.claimExpiryHours"),
  ]);
  if (input.creditAmount < minimum || input.creditAmount > maximum) {
    return {
      ok: false,
      reason: `Choose between ${minimum} and ${maximum} tokens for one testnet transfer.`,
    };
  }
  const link = await walletLinkFor(db, input.profileId);
  if (!link) return { ok: false, reason: "Connect a testnet wallet to this profile first." };
  if (link.network !== cardanoNetwork(env)) {
    return { ok: false, reason: "The linked wallet is on the wrong test network." };
  }
  testnetAssetRegistry(env); // validates the network and policy before reserving anything
  const idempotencyKey =
    input.idempotencyKey?.trim() || `credit-claim:${input.profileId}:${randomUUID()}`;
  const existing = await db.tokenTransactionIntent.findUnique({ where: { idempotencyKey } });
  if (existing) {
    const claim = await db.creditClaim.findUnique({
      where: { transactionIntentId: existing.id },
    });
    return claim
      ? { ok: true, claimId: claim.id }
      : { ok: false, reason: "The existing request is incomplete; contact Support." };
  }

  try {
    return await db.$transaction(async (tx) => {
      const intent = await createTokenIntent(tx, {
        profileId: input.profileId,
        kind: "claim.credit",
        currency: input.currency,
        amount: String(input.creditAmount * conversion),
        idempotencyKey,
        destinationWalletScope: link.cardanoAddress,
      });
      const claim = await tx.creditClaim.create({
        data: {
          profileId: input.profileId,
          currency: input.currency,
          creditAmount: input.creditAmount,
          assetAmount: String(input.creditAmount * conversion),
          destinationAddress: link.cardanoAddress,
          status: "reserved",
          transactionIntentId: intent.id,
          expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000),
        },
      });
      const reservation = await chargeToTreasury(tx, {
        profileId: input.profileId,
        currency: input.currency,
        amount: input.creditAmount,
        kind: "claim.reserve",
        refType: "credit-claim",
        refId: claim.id,
      });
      if (!reservation.ok) throw new Error(reservation.reason);
      await tx.creditClaim.update({
        where: { id: claim.id },
        data: { reservationEntryId: reservation.entryId ?? null },
      });
      const prepared = await transitionTokenIntent(tx, { id: intent.id, to: "prepared" });
      if (!prepared.ok) throw new Error(prepared.reason);
      return { ok: true as const, claimId: claim.id };
    });
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "The claim could not be reserved.",
    };
  }
}

/** Atomically lease one reservation to a distributor. The state change
 * happens before any chain call, so two runners cannot mint the same claim.
 * A crash after acquisition leaves an explicit `distributing` record for
 * reconciliation; it is never silently retried or refunded. */
export async function acquireCreditClaimForDistribution(
  db: PrismaClient,
  claimId: string,
  now = new Date()
) {
  const changed = await db.creditClaim.updateMany({
    where: { id: claimId, status: "reserved", expiresAt: { gt: now } },
    data: { status: "distributing" },
  });
  return changed.count === 1;
}

export async function markCreditClaimSubmitted(
  db: PrismaClient,
  input: { claimId: string; txHash: string }
) {
  return db.$transaction(async (tx) => {
    const claim = await tx.creditClaim.findUnique({ where: { id: input.claimId } });
    if (!claim || claim.status !== "distributing") {
      return { ok: false as const, reason: "Claim is not ready for submission." };
    }
    const moved = await transitionTokenIntent(tx, {
      id: claim.transactionIntentId,
      to: "submitted",
      txHash: input.txHash,
    });
    if (!moved.ok) return moved;
    const changed = await tx.creditClaim.updateMany({
      where: { id: claim.id, status: "distributing" },
      data: { status: "submitted" },
    });
    if (changed.count !== 1) {
      throw new Error("Claim status changed before submission could be recorded.");
    }
    return { ok: true as const };
  });
}

export async function confirmCreditClaim(
  db: PrismaClient,
  input: {
    claimId: string;
    verify: (txHash: string, address: string, currency: Currency, amount: string) => Promise<boolean>;
  }
) {
  const claim = await db.creditClaim.findUnique({ where: { id: input.claimId } });
  if (!claim || claim.status !== "submitted") {
    return { ok: false as const, reason: "Claim is not awaiting confirmation." };
  }
  const intent = await db.tokenTransactionIntent.findUniqueOrThrow({
    where: { id: claim.transactionIntentId },
  });
  if (!intent.txHash) return { ok: false as const, reason: "Submitted claim has no transaction hash." };
  const verified = await input.verify(
    intent.txHash,
    claim.destinationAddress,
    claim.currency as Currency,
    claim.assetAmount
  );
  if (!verified) return { ok: false as const, reason: "The testnet delivery is not confirmed yet." };
  return db.$transaction(async (tx) => {
    const current = await tx.creditClaim.findUnique({ where: { id: claim.id } });
    if (!current || current.status !== "submitted") {
      return { ok: false as const, reason: "Claim status changed during confirmation." };
    }
    const moved = await transitionTokenIntent(tx, {
      id: current.transactionIntentId,
      to: "confirmed",
    });
    if (!moved.ok) return moved;
    await tx.creditClaim.update({
      where: { id: current.id },
      data: { status: "confirmed", confirmedAt: new Date() },
    });
    return { ok: true as const };
  });
}

export async function refundFailedCreditClaim(
  db: PrismaClient,
  input: { claimId: string; failureCode: string; failureMessage?: string }
) {
  return db.$transaction(async (tx) => {
    const claim = await tx.creditClaim.findUnique({ where: { id: input.claimId } });
    if (!claim || claim.status !== "reserved") {
      return { ok: false as const, reason: "Only an unsubmitted reservation can be refunded." };
    }
    const refund = await payFromTreasury(tx, {
      profileId: claim.profileId,
      currency: claim.currency as Currency,
      amount: claim.creditAmount,
      kind: "claim.refund",
      budgetCategory: BUDGET_CREDIT_CLAIM_REFUNDS,
      refType: "credit-claim",
      refId: claim.id,
    });
    if (!refund.ok) return refund;
    const moved = await transitionTokenIntent(tx, {
      id: claim.transactionIntentId,
      to: "failed",
      failureCode: input.failureCode,
      failureMessage: input.failureMessage,
    });
    if (!moved.ok) throw new Error(moved.reason);
    await tx.creditClaim.update({
      where: { id: claim.id },
      data: {
        status: "failed",
        failedAt: new Date(),
        finalizationEntryId: refund.entryId ?? null,
      },
    });
    return { ok: true as const };
  });
}
