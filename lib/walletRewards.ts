// Wallet-mode reward queue. Product transactions enqueue fake-asset rewards
// in the same database transaction as the civic action; an isolated operator
// runner delivers them later. No request path imports the mint mnemonic.

import type { PrismaClient } from "@prisma/client";
import type { Tx } from "./db";
import { cardanoNetwork, verifyDemoAssetDelivery } from "./chain";
import { walletRewardsTestnetEnabled } from "./progressiveEconomy";
import {
  acquireTokenIntentForDistribution,
  createTokenIntent,
  transitionTokenIntent,
} from "./tokenIntents";

type Currency = "PC" | "G";

export async function queueWalletReward(
  tx: Tx,
  input: {
    profileId: string;
    currency: Currency;
    amount: number;
    kind: string;
    idempotencyKey: string;
    refType?: string;
    refId?: string;
  },
  env: Record<string, string | undefined> = process.env
) {
  if (!walletRewardsTestnetEnabled(env)) {
    throw new Error("Wallet rewards are not enabled in this test environment.");
  }
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw new Error("Wallet rewards must use a positive whole fake-asset amount.");
  }
  const [profile, link] = await Promise.all([
    tx.profile.findUnique({ where: { id: input.profileId } }),
    tx.testnetWalletLink.findUnique({ where: { profileId: input.profileId } }),
  ]);
  if (!profile || profile.economyMode !== "wallet") {
    throw new Error("Wallet rewards require wallet custody on this profile.");
  }
  if (!link || link.network !== cardanoNetwork(env)) {
    throw new Error("Wallet rewards require this profile's linked wallet on the active testnet.");
  }
  const intent = await createTokenIntent(tx, {
    profileId: input.profileId,
    kind: input.kind,
    currency: input.currency,
    amount: String(input.amount),
    idempotencyKey: input.idempotencyKey,
    destinationWalletScope: link.cardanoAddress,
    refType: input.refType,
    refId: input.refId,
  });
  if (intent.status === "requested") {
    const prepared = await transitionTokenIntent(tx, { id: intent.id, to: "prepared" });
    if (!prepared.ok) throw new Error(prepared.reason);
  }
  return intent.id;
}

export async function acquireWalletReward(db: PrismaClient, intentId: string) {
  return acquireTokenIntentForDistribution(db, { id: intentId, kindPrefix: "reward." });
}

export async function markWalletRewardSubmitted(
  db: PrismaClient,
  input: { intentId: string; txHash: string }
) {
  const intent = await db.tokenTransactionIntent.findUnique({ where: { id: input.intentId } });
  if (!intent || intent.status !== "distributing" || !intent.kind.startsWith("reward.")) {
    return { ok: false as const, reason: "Reward is not leased for distribution." };
  }
  return transitionTokenIntent(db, {
    id: input.intentId,
    to: "submitted",
    txHash: input.txHash,
  });
}

export async function confirmWalletReward(
  db: PrismaClient,
  intentId: string,
  verify = verifyDemoAssetDelivery
) {
  const intent = await db.tokenTransactionIntent.findUnique({ where: { id: intentId } });
  if (!intent || intent.status !== "submitted" || !intent.txHash) {
    return { ok: false as const, reason: "Reward is not awaiting confirmation." };
  }
  if (intent.currency !== "PC" && intent.currency !== "G") {
    return { ok: false as const, reason: "Reward currency is invalid." };
  }
  if (!intent.destinationWalletScope) {
    return { ok: false as const, reason: "Reward destination is missing." };
  }
  const delivered = await verify(
    intent.txHash,
    intent.destinationWalletScope,
    intent.currency,
    intent.amount
  );
  if (!delivered) {
    return { ok: false as const, reason: "The testnet reward is not confirmed yet." };
  }
  return transitionTokenIntent(db, { id: intent.id, to: "confirmed" });
}
