// Progressive token rail: beginner-friendly Credits remain available while
// linked identities may opt into testnet Wallet mode. This module owns the
// boundary; ordinary economy code must never infer wallet mode from the mere
// existence of an address.

import type { PrismaClient } from "@prisma/client";
import {
  cardanoNetwork,
  demoAssetBalances,
  demoAssetPolicyId,
  walletLinkFor,
} from "./chain";

export const ECONOMY_MODES = ["credits", "wallet", "mixed"] as const;
export type EconomyMode = (typeof ECONOMY_MODES)[number];
type Environment = Record<string, string | undefined>;

export type EconomyModeResult =
  | { ok: true; mode: EconomyMode }
  | { ok: false; reason: string };

export function walletModeTestnetEnabled(env: Environment = process.env) {
  return env.WALLET_MODE_TESTNET_ENABLED === "true";
}

export function creditClaimsTestnetEnabled(env: Environment = process.env) {
  return env.CREDIT_CLAIMS_TESTNET_ENABLED === "true";
}

export function walletDiscussionFeeEnabled(env: Environment = process.env) {
  return env.WALLET_DISCUSSION_FEE_ENABLED === "true";
}

export function walletRewardsTestnetEnabled(env: Environment = process.env) {
  return env.WALLET_REWARDS_TESTNET_ENABLED === "true";
}

/** Wallet mode is load-bearing only when its first ordinary fee and reward
 * are both available. A balance display alone must never activate the mode. */
export function walletModeActivationReady(env: Environment = process.env) {
  return (
    walletModeTestnetEnabled(env) &&
    walletDiscussionFeeEnabled(env) &&
    walletRewardsTestnetEnabled(env)
  );
}

export function testnetAssetRegistry(env: Environment = process.env) {
  const network = env.CARDANO_NETWORK ?? "preprod";
  if (network !== "preprod" && network !== "preview") {
    throw new Error(`Progressive token rail refuses non-testnet network "${network}".`);
  }
  const policyId = demoAssetPolicyId(env);
  return {
    chain: "cardano",
    network,
    assets: [
      {
        currency: "PC" as const,
        policyId,
        assetName: "dPOLL",
        symbol: "dPOLL",
        displayName: "PollCoin Demo",
        decimals: 0,
      },
      {
        currency: "G" as const,
        policyId,
        assetName: "dGRA",
        symbol: "dGRA",
        displayName: "Gratium Demo",
        decimals: 0,
      },
    ],
  };
}

export async function setEconomyMode(
  db: PrismaClient,
  input: { profileId: string; mode: string },
  env: Environment = process.env
): Promise<EconomyModeResult> {
  if (!ECONOMY_MODES.includes(input.mode as EconomyMode)) {
    return { ok: false, reason: "Choose Credits mode or Wallet mode." };
  }
  const mode = input.mode as EconomyMode;
  if (mode === "mixed" && env.WALLET_MIXED_MODE_ENABLED !== "true") {
    return { ok: false, reason: "Mixed mode is reserved for controlled testing." };
  }
  if (mode !== "credits") {
    if (!walletModeActivationReady(env)) {
      return {
        ok: false,
        reason: "Testnet Wallet mode is not ready until its first fee and reward are both enabled.",
      };
    }
    const link = await walletLinkFor(db, input.profileId);
    if (!link) {
      return { ok: false, reason: "Connect a testnet wallet to this profile first." };
    }
    if (link.network !== cardanoNetwork(env)) {
      return {
        ok: false,
        reason: `The linked wallet is on ${link.network}; AgoraNet is using ${cardanoNetwork(env)}.`,
      };
    }
  } else {
    const pendingWalletAction = await db.walletActionDraft.findFirst({
      where: {
        profileId: input.profileId,
        status: { in: ["awaiting_wallet_approval", "submitted", "requires_review"] },
      },
      select: { status: true },
    });
    if (pendingWalletAction) {
      return {
        ok: false,
        reason:
          pendingWalletAction.status === "awaiting_wallet_approval"
            ? "Finish or let the open Lace request expire before switching to Credits mode."
            : "A wallet-paid action is still being confirmed or reviewed. Do not switch modes or pay again; check its status first.",
      };
    }
  }
  await db.profile.update({
    where: { id: input.profileId },
    data: { economyMode: mode },
  });
  return { ok: true, mode };
}

/**
 * Refresh the chain-derived read model for one identity. On provider failure
 * the last known quantities remain intact and are marked stale; an outage must
 * never masquerade as a zero wallet balance.
 */
export async function refreshWalletBalanceSnapshots(
  db: PrismaClient,
  profileId: string
) {
  const link = await walletLinkFor(db, profileId);
  if (!link) return { ok: false as const, reason: "No testnet wallet is linked." };
  const registry = testnetAssetRegistry();
  const definitions = await Promise.all(
    registry.assets.map((asset) =>
      db.assetDefinition.upsert({
        where: {
          chain_network_policyId_assetName: {
            chain: registry.chain,
            network: registry.network,
            policyId: asset.policyId,
            assetName: asset.assetName,
          },
        },
        create: {
          chain: registry.chain,
          network: registry.network,
          policyId: asset.policyId,
          assetName: asset.assetName,
          symbol: asset.symbol,
          decimals: asset.decimals,
          displayName: asset.displayName,
          isTestAsset: true,
        },
        update: {
          symbol: asset.symbol,
          decimals: asset.decimals,
          displayName: asset.displayName,
          isTestAsset: true,
          active: true,
        },
      })
    )
  );
  try {
    const balances = await demoAssetBalances(link.cardanoAddress);
    const quantities: Record<"PC" | "G", string> = {
      PC: balances.pollCoin,
      G: balances.gratium,
    };
    const observedAt = new Date();
    await Promise.all(
      definitions.map((definition, index) =>
        db.walletBalanceSnapshot.upsert({
          where: {
            profileId_assetDefinitionId: {
              profileId,
              assetDefinitionId: definition.id,
            },
          },
          create: {
            profileId,
            assetDefinitionId: definition.id,
            quantity: quantities[registry.assets[index].currency],
            observedAt,
            syncStatus: "current",
          },
          update: {
            quantity: quantities[registry.assets[index].currency],
            observedAt,
            syncStatus: "current",
            errorCode: null,
          },
        })
      )
    );
    return { ok: true as const, observedAt, balances: quantities };
  } catch {
    await db.walletBalanceSnapshot.updateMany({
      where: { profileId },
      data: { syncStatus: "stale", errorCode: "provider_unavailable" },
    });
    return {
      ok: false as const,
      reason: "Wallet balances are temporarily unavailable; the last confirmed values were kept.",
    };
  }
}

export async function walletBalanceView(db: PrismaClient, profileId: string) {
  const rows = await db.walletBalanceSnapshot.findMany({
    where: { profileId },
    orderBy: { observedAt: "desc" },
  });
  const definitions = rows.length
    ? await db.assetDefinition.findMany({
        where: { id: { in: rows.map((row) => row.assetDefinitionId) } },
      })
    : [];
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));
  const result = { PC: "0", G: "0", observedAt: null as Date | null, syncStatus: "missing" };
  for (const row of rows) {
    const definition = byId.get(row.assetDefinitionId);
    if (!definition) continue;
    if (definition.symbol === "dPOLL") result.PC = row.quantity;
    if (definition.symbol === "dGRA") result.G = row.quantity;
    if (!result.observedAt || row.observedAt > result.observedAt) result.observedAt = row.observedAt;
    if (row.syncStatus !== "current") result.syncStatus = row.syncStatus;
    else if (result.syncStatus === "missing") result.syncStatus = "current";
  }
  return result;
}
