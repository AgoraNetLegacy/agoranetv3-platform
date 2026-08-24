// Restart-safe Wallet-mode product actions. The browser owns signing; this
// module stores only ordinary draft content and public transaction facts.

import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { demoAssetUnit, cardanoNetwork, walletLinkFor } from "./chain";
import { verifyWalletFeePayment, walletFeeDestination } from "./chainWalletEconomy";
import { createPost, validatePostRequest, type CreatePostInput } from "./discussions";
import { getRail } from "./rails";
import { walletModeActivationReady } from "./progressiveEconomy";
import { createTokenIntent, transitionTokenIntent } from "./tokenIntents";

type Environment = Record<string, string | undefined>;

export type WalletPostPayload = Pick<
  CreatePostInput,
  "discussionId" | "body" | "parentId" | "humanMade" | "source"
>;

export type PreparedWalletPost = {
  ok: true;
  draftId: string;
  intentId: string;
  linkedAddress: string;
  destinationAddress: string;
  treasuryTag: string;
  assetUnit: string;
  amount: string;
  network: "preprod" | "preview";
  expiresAt: string;
};

export type WalletActionResult =
  | PreparedWalletPost
  | { ok: false; reason: string; retryable?: boolean };

function normalizedPayload(input: WalletPostPayload): WalletPostPayload {
  return {
    discussionId: input.discussionId,
    body: input.body.trim(),
    parentId: input.parentId || null,
    humanMade: Boolean(input.humanMade),
    ...(input.source
      ? {
          source: {
            url: input.source.url.trim(),
            kind: input.source.kind,
            vouch: input.source.vouch,
          },
        }
      : {}),
  };
}

function serializePayload(input: WalletPostPayload) {
  const payload = normalizedPayload(input);
  const json = JSON.stringify(payload);
  return {
    payload,
    json,
    hash: createHash("sha256").update(json).digest("hex"),
  };
}

function draftIdFor(profileId: string, idempotencyKey: string) {
  return `wad_${createHash("sha256")
    .update(`${profileId}\0${idempotencyKey}`)
    .digest("hex")
    .slice(0, 32)}`;
}

async function preparedView(
  db: PrismaClient,
  draftId: string,
  env: Environment
): Promise<PreparedWalletPost> {
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
    assetUnit: demoAssetUnit("PC", env),
    amount: intent.amount,
    network: cardanoNetwork(env),
    expiresAt: draft.expiresAt.toISOString(),
  };
}

/** Validate a post before the wallet popup and persist an idempotent draft. */
export async function prepareWalletPost(
  db: PrismaClient,
  input: {
    profileId: string;
    idempotencyKey: string;
    payload: WalletPostPayload;
  },
  env: Environment = process.env
): Promise<WalletActionResult> {
  if (!walletModeActivationReady(env)) {
    return { ok: false, reason: "Testnet Wallet mode is not enabled yet." };
  }
  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey || idempotencyKey.length > 120) {
    return { ok: false, reason: "This post needs a fresh request identifier. Reload and try again." };
  }
  const serialized = serializePayload(input.payload);
  const validation = await validatePostRequest(db, {
    ...serialized.payload,
    profileId: input.profileId,
  });
  if (!validation.ok) return validation;
  if (validation.discussion.chamberId) {
    return {
      ok: false,
      reason:
        "Wallet mode does not support workshop posts yet because that action charges two tokens. Switch this identity to Credits mode for the workshop.",
    };
  }
  if (validation.profile.economyMode !== "wallet") {
    return { ok: false, reason: "This identity is using Credits mode, so no wallet approval is needed." };
  }
  const link = await walletLinkFor(db, input.profileId);
  const network = cardanoNetwork(env);
  if (!link || link.network !== network) {
    return { ok: false, reason: `Connect this identity's Lace wallet on ${network} first.` };
  }
  const fee = await getRail(db, "discussion.replyFee");
  if (!Number.isSafeInteger(fee) || fee <= 0) {
    throw new Error("Wallet-mode discussion fees require a positive whole dPOLL rail.");
  }
  const destination = await walletFeeDestination();
  const expiryMinutes = await getRail(db, "onchain.walletActionExpiryMinutes");
  const draftId = draftIdFor(input.profileId, idempotencyKey);
  const expiresAt = new Date(Date.now() + expiryMinutes * 60_000);

  const existing = await db.walletActionDraft.findUnique({ where: { id: draftId } });
  if (existing) {
    if (
      existing.profileId !== input.profileId ||
      existing.payloadHash !== serialized.hash ||
      existing.kind !== "discussion.post"
    ) {
      throw new Error("That post request identifier already belongs to different content.");
    }
    if (existing.status === "awaiting_wallet_approval") {
      return preparedView(db, draftId, env);
    }
    return {
      ok: false,
      reason:
        existing.status === "completed"
          ? "This post was already published."
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
          existingDraft.kind !== "discussion.post"
        ) {
          throw new Error("That post request identifier already belongs to different content.");
        }
        return;
      }
      const intent = await createTokenIntent(tx, {
        profileId: input.profileId,
        kind: "fee.reply",
        currency: "PC",
        amount: String(fee),
        idempotencyKey: `wallet-post:${input.profileId}:${idempotencyKey}`,
        sourceWalletScope: link.cardanoAddress,
        destinationWalletScope: destination.address,
        refType: "wallet-action-draft",
        refId: draftId,
      });
      await tx.walletActionDraft.create({
        data: {
          id: draftId,
          profileId: input.profileId,
          kind: "discussion.post",
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
export async function recordWalletPostSubmission(
  db: PrismaClient,
  input: { profileId: string; intentId: string; txHash: string }
) {
  const txHash = input.txHash.trim().toLowerCase();
  const intent = await db.tokenTransactionIntent.findUnique({ where: { id: input.intentId } });
  if (!intent || intent.profileId !== input.profileId || intent.kind !== "fee.reply") {
    return { ok: false as const, reason: "Pending wallet post not found." };
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
    return { ok: false as const, reason: "This pending post is not waiting for wallet approval." };
  }
  if (draft.expiresAt <= new Date()) {
    await db.$transaction(async (tx) => {
      await transitionTokenIntent(tx, { id: intent.id, to: "expired" });
      await tx.walletActionDraft.update({ where: { id: draft.id }, data: { status: "expired" } });
    });
    return { ok: false as const, reason: "That wallet request expired. No post was created; start again." };
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
      if (changed.count !== 1) throw new Error("Pending wallet post changed; reload before retrying.");
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false as const, reason: "That transaction is already attached to another action." };
    }
    throw error;
  }
  return { ok: true as const, intentId: intent.id };
}

export async function rejectWalletPost(
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

/** Chain-verify and commit. Safe to call from the browser poller or runner. */
export async function finalizeWalletPost(
  db: PrismaClient,
  input: { profileId: string; intentId: string },
  verify: typeof verifyWalletFeePayment = verifyWalletFeePayment
) {
  const intent = await db.tokenTransactionIntent.findUnique({ where: { id: input.intentId } });
  if (!intent || intent.profileId !== input.profileId || intent.kind !== "fee.reply") {
    return { ok: false as const, reason: "Pending wallet post not found.", retryable: false };
  }
  const draft = await db.walletActionDraft.findUnique({
    where: { transactionIntentId: intent.id },
  });
  if (!draft) {
    return { ok: false as const, reason: "Pending wallet post not found.", retryable: false };
  }
  if (draft.status === "completed" && draft.resultRefId) {
    return { ok: true as const, postId: draft.resultRefId };
  }
  if (intent.status !== "submitted" || draft.status !== "submitted" || !intent.txHash) {
    return { ok: false as const, reason: "The wallet transaction has not been submitted.", retryable: false };
  }
  if (
    !intent.sourceWalletScope ||
    !intent.destinationWalletScope ||
    (intent.currency !== "PC" && intent.currency !== "G")
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
    currency: intent.currency,
    quantity: intent.amount,
  });
  if (!confirmed) {
    return {
      ok: false as const,
      reason: "The testnet payment is not confirmed yet.",
      retryable: true,
    };
  }
  const payload = JSON.parse(draft.payloadJson) as WalletPostPayload;
  const created = await createPost(db, {
    ...payload,
    profileId: input.profileId,
    walletFee: { intentId: intent.id, draftId: draft.id, txHash: intent.txHash },
  });
  if (!created.ok) {
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
        return { ok: true as const, postId: current.resultRefId };
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
  return { ok: true as const, postId: created.postId };
}
