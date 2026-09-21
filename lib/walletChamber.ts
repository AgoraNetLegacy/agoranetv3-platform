// Wallet-mode settlement for opening a Chamber; the self-custody half of
// the owner's custody vision (DECISIONS_PENDING #28).
//
// A soul who holds their own tokens should be able to build in the
// Pollinator without first parking value with the platform. The obstacle
// was never philosophical: chamber fees debited a platform balance, and a
// self-custody soul has none, so the storefront refused them while their
// wallet sat full.
//
// The Pollinator charges in BOTH tokens (NEURAL_POLLINATOR §3), so wallet
// settlement must move both. Cardano carries many assets in one output, so
// this is ONE transaction the soul signs once, carrying 20 dPOLL AND 20
// dGRA to the compiled treasury script. That keeps the dual-token
// signature honest on chain: a soul still has to hold a working stock of
// each, exactly as platform custody requires.
//
// The browser owns signing. This module stores ordinary draft content and
// public transaction facts, and never a key.

import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { demoAssetUnit, cardanoNetwork, walletLinkFor } from "./chain";
import {
  verifyWalletDualFeePayment,
  walletFeeDestination,
} from "./chainWalletEconomy";
import {
  chamberCreationCost,
  createChamber,
  validateChamberRequest,
  type CreateChamberInput,
} from "./chambers";
import { getRail } from "./rails";
import { walletModeActivationReady } from "./progressiveEconomy";
import { createTokenIntent, transitionTokenIntent } from "./tokenIntents";

type Environment = Record<string, string | undefined>;

export type WalletChamberPayload = Omit<CreateChamberInput, "profileId" | "walletFee">;

export type PreparedWalletChamber = {
  ok: true;
  draftId: string;
  intentId: string;
  linkedAddress: string;
  destinationAddress: string;
  treasuryTag: string;
  /** Both legs; the browser puts them in one output. */
  assets: { currency: "PC" | "G"; unit: string; quantity: string }[];
  network: "preprod" | "preview";
  expiresAt: string;
};

export type WalletChamberResult =
  | PreparedWalletChamber
  | { ok: false; reason: string; retryable?: boolean };

function normalizedPayload(input: WalletChamberPayload): WalletChamberPayload {
  return {
    title: input.title.trim(),
    subject: input.subject.trim(),
    pitch: input.pitch.trim(),
    whyCare: input.whyCare.trim(),
    isPublic: Boolean(input.isPublic),
    scaffold: {
      solving: input.scaffold.solving.trim(),
      needToKnow: input.scaffold.needToKnow.trim(),
      success: input.scaffold.success.trim(),
    },
  };
}

function serializePayload(input: WalletChamberPayload) {
  const payload = normalizedPayload(input);
  const json = JSON.stringify(payload);
  return { payload, json, hash: createHash("sha256").update(json).digest("hex") };
}

function draftIdFor(profileId: string, idempotencyKey: string) {
  return `wac_${createHash("sha256")
    .update(`${profileId}\0${idempotencyKey}`)
    .digest("hex")
    .slice(0, 32)}`;
}

/** Whole-token amounts only: a Cardano asset quantity is an integer. */
function wholeTokenQuantity(amount: number, label: string) {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error(`The ${label} wallet fee must be a positive whole token amount.`);
  }
  return String(amount);
}

async function preparedView(
  db: PrismaClient,
  draftId: string,
  env: Environment
): Promise<PreparedWalletChamber> {
  const draft = await db.walletActionDraft.findUniqueOrThrow({ where: { id: draftId } });
  const intent = await db.tokenTransactionIntent.findUniqueOrThrow({
    where: { id: draft.transactionIntentId },
  });
  const destination = await walletFeeDestination();
  return {
    ok: true,
    draftId: draft.id,
    intentId: intent.id,
    linkedAddress: intent.sourceWalletScope!,
    destinationAddress: destination.address,
    treasuryTag: destination.treasuryTag,
    assets: [
      { currency: "PC", unit: demoAssetUnit("PC", env), quantity: intent.amount },
      {
        currency: "G",
        unit: demoAssetUnit("G", env),
        quantity: intent.secondaryAmount!,
      },
    ],
    network: cardanoNetwork(env),
    expiresAt: draft.expiresAt.toISOString(),
  };
}

/** Validate the chamber before Lace opens, then persist an idempotent draft.
 * Nothing is created and no balance moves until the payment confirms. */
export async function prepareWalletChamber(
  db: PrismaClient,
  input: {
    profileId: string;
    idempotencyKey: string;
    payload: WalletChamberPayload;
  },
  env: Environment = process.env
): Promise<WalletChamberResult> {
  if (!walletModeActivationReady(env)) {
    return { ok: false, reason: "Testnet wallet custody is not enabled yet." };
  }
  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey || idempotencyKey.length > 120) {
    return { ok: false, reason: "This chamber needs a fresh request identifier. Reload and try again." };
  }
  const serialized = serializePayload(input.payload);
  const validation = await validateChamberRequest(db, {
    ...serialized.payload,
    profileId: input.profileId,
  });
  if (!validation.ok) return { ok: false, reason: validation.reason };
  if (validation.profile.economyMode === "credits") {
    return { ok: false, reason: "This identity uses platform custody, so no wallet approval is needed." };
  }
  const link = await walletLinkFor(db, input.profileId);
  const network = cardanoNetwork(env);
  if (!link || link.network !== network) {
    return { ok: false, reason: `Connect this identity's Lace wallet on ${network} first.` };
  }

  const cost = await chamberCreationCost(db);
  const pcAmount = wholeTokenQuantity(cost.PC, "chamber PollCoin");
  const gAmount = wholeTokenQuantity(cost.G, "chamber Gratium");
  const destination = await walletFeeDestination();
  const expiryMinutes = await getRail(db, "onchain.walletActionExpiryMinutes");
  const draftId = draftIdFor(input.profileId, idempotencyKey);
  const expiresAt = new Date(Date.now() + expiryMinutes * 60_000);

  const existing = await db.walletActionDraft.findUnique({ where: { id: draftId } });
  if (existing) {
    if (
      existing.profileId !== input.profileId ||
      existing.payloadHash !== serialized.hash ||
      existing.kind !== "chamber.create"
    ) {
      throw new Error("That chamber request identifier already belongs to different content.");
    }
    if (existing.status === "awaiting_wallet_approval") {
      return preparedView(db, draftId, env);
    }
    return {
      ok: false,
      reason:
        existing.status === "completed"
          ? "This chamber was already opened."
          : "This wallet request was already submitted or closed. Do not pay again; reload to check it.",
    };
  }

  try {
    await db.$transaction(async (tx) => {
      const existingDraft = await tx.walletActionDraft.findUnique({ where: { id: draftId } });
      if (existingDraft) {
        if (
          existingDraft.profileId !== input.profileId ||
          existingDraft.payloadHash !== serialized.hash ||
          existingDraft.kind !== "chamber.create"
        ) {
          throw new Error("That chamber request identifier already belongs to different content.");
        }
        return;
      }
      const intent = await createTokenIntent(tx, {
        profileId: input.profileId,
        kind: "fee.chamber",
        currency: "PC",
        amount: pcAmount,
        secondaryCurrency: "G",
        secondaryAmount: gAmount,
        idempotencyKey: `wallet-chamber:${input.profileId}:${idempotencyKey}`,
        sourceWalletScope: link.cardanoAddress,
        destinationWalletScope: destination.address,
        refType: "wallet-action-draft",
        refId: draftId,
      });
      await tx.walletActionDraft.create({
        data: {
          id: draftId,
          profileId: input.profileId,
          kind: "chamber.create",
          payloadJson: serialized.json,
          payloadHash: serialized.hash,
          status: "awaiting_wallet_approval",
          transactionIntentId: intent.id,
          expiresAt,
        },
      });
      const prepared = await transitionTokenIntent(tx, { id: intent.id, to: "prepared" });
      if (!prepared.ok) throw new Error(prepared.reason);
      const awaiting = await transitionTokenIntent(tx, {
        id: intent.id,
        to: "awaiting_wallet_approval",
      });
      if (!awaiting.ok) throw new Error(awaiting.reason);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, reason: "That wallet transaction is already attached to another action." };
    }
    throw error;
  }
  return preparedView(db, draftId, env);
}

/** Record only the public hash after Lace submits. */
export async function recordWalletChamberSubmission(
  db: PrismaClient,
  input: { profileId: string; intentId: string; txHash: string }
) {
  const txHash = input.txHash.trim().toLowerCase();
  const intent = await db.tokenTransactionIntent.findUnique({ where: { id: input.intentId } });
  if (!intent || intent.profileId !== input.profileId || intent.kind !== "fee.chamber") {
    return { ok: false as const, reason: "Pending chamber payment not found." };
  }
  if (
    (intent.status === "submitted" || intent.status === "confirmed") &&
    intent.txHash === txHash
  ) {
    return { ok: true as const, intentId: intent.id };
  }
  const draft = await db.walletActionDraft.findUnique({
    where: { transactionIntentId: intent.id },
  });
  if (!draft || draft.status !== "awaiting_wallet_approval") {
    return { ok: false as const, reason: "This pending chamber is not waiting for wallet approval." };
  }
  if (draft.expiresAt <= new Date()) {
    await db.$transaction(async (tx) => {
      await transitionTokenIntent(tx, { id: intent.id, to: "expired" });
      await tx.walletActionDraft.update({ where: { id: draft.id }, data: { status: "expired" } });
    });
    return {
      ok: false as const,
      reason: "That wallet request expired. No chamber was opened; start again.",
    };
  }
  try {
    await db.$transaction(async (tx) => {
      const signed = await transitionTokenIntent(tx, { id: intent.id, to: "signed" });
      if (!signed.ok) throw new Error(signed.reason);
      const submitted = await transitionTokenIntent(tx, {
        id: intent.id,
        to: "submitted",
        txHash,
      });
      if (!submitted.ok) throw new Error(submitted.reason);
      const changed = await tx.walletActionDraft.updateMany({
        where: { id: draft.id, status: "awaiting_wallet_approval" },
        data: { status: "submitted" },
      });
      if (changed.count !== 1) {
        throw new Error("Pending chamber changed; reload before retrying.");
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false as const, reason: "That transaction is already attached to another action." };
    }
    throw error;
  }
  return { ok: true as const, intentId: intent.id };
}

export async function rejectWalletChamber(
  db: PrismaClient,
  input: { profileId: string; intentId: string }
) {
  const intent = await db.tokenTransactionIntent.findUnique({ where: { id: input.intentId } });
  if (!intent || intent.profileId !== input.profileId) return { ok: false as const };
  if (intent.status !== "awaiting_wallet_approval") return { ok: false as const };
  await db.$transaction(async (tx) => {
    const rejected = await transitionTokenIntent(tx, { id: intent.id, to: "rejected" });
    if (!rejected.ok) throw new Error(rejected.reason);
    await tx.walletActionDraft.update({
      where: { transactionIntentId: intent.id },
      data: { status: "rejected" },
    });
  });
  return { ok: true as const };
}

/** Chain-verify BOTH legs, then open the chamber. Safe to call repeatedly
 * from the browser poller; a completed draft returns its chamber. */
export async function finalizeWalletChamber(
  db: PrismaClient,
  input: { profileId: string; intentId: string },
  verify: typeof verifyWalletDualFeePayment = verifyWalletDualFeePayment
) {
  const intent = await db.tokenTransactionIntent.findUnique({ where: { id: input.intentId } });
  if (!intent || intent.profileId !== input.profileId || intent.kind !== "fee.chamber") {
    return { ok: false as const, reason: "Pending chamber payment not found.", retryable: false };
  }
  const draft = await db.walletActionDraft.findUnique({
    where: { transactionIntentId: intent.id },
  });
  if (!draft) {
    return { ok: false as const, reason: "Pending chamber payment not found.", retryable: false };
  }
  if (draft.status === "completed" && draft.resultRefId) {
    return { ok: true as const, chamberId: draft.resultRefId };
  }
  if (intent.status !== "submitted" || draft.status !== "submitted" || !intent.txHash) {
    return {
      ok: false as const,
      reason: "The wallet transaction has not been submitted.",
      retryable: false,
    };
  }
  if (
    !intent.sourceWalletScope ||
    !intent.destinationWalletScope ||
    intent.currency !== "PC" ||
    intent.secondaryCurrency !== "G" ||
    !intent.secondaryAmount
  ) {
    return { ok: false as const, reason: "The wallet payment record is incomplete.", retryable: false };
  }
  const hash = createHash("sha256").update(draft.payloadJson).digest("hex");
  if (hash !== draft.payloadHash) {
    throw new Error(`Wallet action draft ${draft.id} failed its content hash check.`);
  }
  const confirmed = await verify({
    txHash: intent.txHash,
    sourceAddress: intent.sourceWalletScope,
    destinationAddress: intent.destinationWalletScope,
    legs: [
      { currency: "PC", quantity: intent.amount },
      { currency: "G", quantity: intent.secondaryAmount },
    ],
  });
  if (!confirmed) {
    return {
      ok: false as const,
      reason: "The testnet payment is not confirmed yet.",
      retryable: true,
    };
  }
  const payload = JSON.parse(draft.payloadJson) as WalletChamberPayload;
  const created = await createChamber(db, {
    ...payload,
    profileId: input.profileId,
    walletFee: { intentId: intent.id, draftId: draft.id, txHash: intent.txHash },
  });
  if (!created.ok) {
    // The tokens are gone and no chamber exists. Never silently swallow
    // that: park it for support with the payment preserved and visible.
    const movedToReview = await db.$transaction(async (tx) => {
      const changed = await tx.walletActionDraft.updateMany({
        where: { id: draft.id, status: "submitted" },
        data: { status: "requires_review" },
      });
      if (changed.count !== 1) return false;
      const recorded = await transitionTokenIntent(tx, {
        id: intent.id,
        to: "confirmed",
        txHash: intent.txHash!,
      });
      if (!recorded.ok) throw new Error(recorded.reason);
      return true;
    });
    if (!movedToReview) {
      const current = await db.walletActionDraft.findUnique({ where: { id: draft.id } });
      if (current?.status === "completed" && current.resultRefId) {
        return { ok: true as const, chamberId: current.resultRefId };
      }
      return {
        ok: false as const,
        reason: "This wallet action changed while it was being reconciled. Reload its status.",
        retryable: true,
      };
    }
    return {
      ok: false as const,
      reason: `${created.reason} Your confirmed testnet payment is preserved for support review.`,
      retryable: false,
    };
  }
  return { ok: true as const, chamberId: created.chamberId };
}
