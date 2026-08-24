import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "./helpers/testDb";

const { url } = createTestDb("progressive-economy");
process.env.DATABASE_URL = url;
process.env.CARDANO_NETWORK = "preprod";

import { PrismaClient } from "@prisma/client";
import { recordWalletLink } from "../lib/chain";
import {
  setEconomyMode,
  testnetAssetRegistry,
  refreshWalletBalanceSnapshots,
  walletBalanceView,
} from "../lib/progressiveEconomy";
import {
  canTransitionTokenIntent,
  createTokenIntent,
  transitionTokenIntent,
} from "../lib/tokenIntents";
import {
  acquireCreditClaimForDistribution,
  confirmCreditClaim,
  markCreditClaimSubmitted,
  refundFailedCreditClaim,
  requestCreditClaim,
} from "../lib/creditClaims";
import { RAIL_DEFAULTS } from "../lib/rails";
import { seedBudgetCategories } from "../lib/budget";
import { grant } from "../lib/economy";

const db = new PrismaClient({ datasources: { db: { url } } });
const profileId = "progressive-profile";

beforeAll(async () => {
  await db.profile.create({
    data: {
      id: profileId,
      face: "TRUE_SELF",
      handle: "progressive-user",
      displayName: "Progressive User",
      accessKeyHash: "progressive-access-hash",
      joinedPeriod: "2026-08",
    },
  });
  for (const rail of RAIL_DEFAULTS.filter((item) => item.key.startsWith("onchain.claim"))) {
    await db.rail.create({
      data: {
        key: rail.key,
        value: rail.value,
        unit: rail.unit,
        boundMin: rail.boundMin ?? rail.value / 4,
        boundMax: rail.boundMax ?? rail.value * 4,
        description: rail.description,
      },
    });
  }
  await seedBudgetCategories(db);
});

describe("Credit claims", () => {
  const claimProfileId = "claim-profile";
  const claimEnv = {
    CARDANO_NETWORK: "preprod",
    CREDIT_CLAIMS_TESTNET_ENABLED: "true",
  };

  beforeAll(async () => {
    await db.profile.create({
      data: {
        id: claimProfileId,
        face: "TRUE_SELF",
        handle: "claim-user",
        displayName: "Claim User",
        accessKeyHash: "claim-access-hash",
        joinedPeriod: "2026-08",
      },
    });
    await recordWalletLink(db, {
      profileId: claimProfileId,
      cardanoAddress: "addr_test1qzclaim000000000000000000000000000000000000000000000000",
      network: "preprod",
    });
    await db.$transaction((tx) =>
      grant(tx, { profileId: claimProfileId, currency: "PC", amount: 25, kind: "grant.test" })
    );
  });

  it("reserves Credits once and confirms only after chain verification", async () => {
    const request = await requestCreditClaim(
      db,
      {
        profileId: claimProfileId,
        currency: "PC",
        creditAmount: 5,
        idempotencyKey: "claim:progressive:confirmed",
      },
      claimEnv
    );
    expect(request.ok).toBe(true);
    if (!request.ok) return;
    expect(
      (await db.balance.findUniqueOrThrow({ where: { profileId_currency: { profileId: claimProfileId, currency: "PC" } } })).amount
    ).toBe(20);
    const duplicate = await requestCreditClaim(
      db,
      {
        profileId: claimProfileId,
        currency: "PC",
        creditAmount: 5,
        idempotencyKey: "claim:progressive:confirmed",
      },
      claimEnv
    );
    expect(duplicate).toEqual(request);

    const claim = await db.creditClaim.findUniqueOrThrow({ where: { id: request.claimId } });
    expect(claim.reservationEntryId).toBeTruthy();
    expect(await acquireCreditClaimForDistribution(db, claim.id)).toBe(true);
    expect(await acquireCreditClaimForDistribution(db, claim.id)).toBe(false);
    const submitted = await markCreditClaimSubmitted(db, {
      claimId: claim.id,
      txHash: "b".repeat(64),
    });
    expect(submitted.ok).toBe(true);
    const notYet = await confirmCreditClaim(db, {
      claimId: claim.id,
      verify: async () => false,
    });
    expect(notYet.ok).toBe(false);
    const confirmed = await confirmCreditClaim(db, {
      claimId: claim.id,
      verify: async () => true,
    });
    expect(confirmed.ok).toBe(true);
    expect((await db.creditClaim.findUniqueOrThrow({ where: { id: claim.id } })).status).toBe(
      "confirmed"
    );
  });

  it("returns a reservation that fails before submission", async () => {
    const request = await requestCreditClaim(
      db,
      {
        profileId: claimProfileId,
        currency: "PC",
        creditAmount: 4,
        idempotencyKey: "claim:progressive:refund",
      },
      claimEnv
    );
    expect(request.ok).toBe(true);
    if (!request.ok) return;
    const beforeRefund = await db.balance.findUniqueOrThrow({
      where: { profileId_currency: { profileId: claimProfileId, currency: "PC" } },
    });
    const refunded = await refundFailedCreditClaim(db, {
      claimId: request.claimId,
      failureCode: "distribution_not_started",
    });
    expect(refunded.ok).toBe(true);
    const afterRefund = await db.balance.findUniqueOrThrow({
      where: { profileId_currency: { profileId: claimProfileId, currency: "PC" } },
    });
    expect(afterRefund.amount).toBe(beforeRefund.amount + 4);
    expect((await db.creditClaim.findUniqueOrThrow({ where: { id: request.claimId } })).finalizationEntryId).toBeTruthy();
  });

  it("does not lease an expired reservation for distribution", async () => {
    const request = await requestCreditClaim(
      db,
      {
        profileId: claimProfileId,
        currency: "PC",
        creditAmount: 1,
        idempotencyKey: "claim:progressive:expired",
      },
      claimEnv
    );
    expect(request.ok).toBe(true);
    if (!request.ok) return;
    await db.creditClaim.update({
      where: { id: request.claimId },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    expect(await acquireCreditClaimForDistribution(db, request.claimId)).toBe(false);
  });
});

afterAll(async () => db.$disconnect());

describe("progressive economy modes", () => {
  it("defaults every profile to Credits mode", async () => {
    const profile = await db.profile.findUniqueOrThrow({ where: { id: profileId } });
    expect(profile.economyMode).toBe("credits");
  });

  it("refuses Wallet mode when the feature is off or no wallet is linked", async () => {
    const off = await setEconomyMode(db, { profileId, mode: "wallet" }, {});
    expect(off.ok).toBe(false);
    const noWallet = await setEconomyMode(
      db,
      { profileId, mode: "wallet" },
      {
        WALLET_MODE_TESTNET_ENABLED: "true",
        WALLET_DISCUSSION_FEE_ENABLED: "true",
        WALLET_REWARDS_TESTNET_ENABLED: "true",
        CARDANO_NETWORK: "preprod",
      }
    );
    expect(noWallet.ok).toBe(false);
  });

  it("lets a linked identity enter Wallet mode directly", async () => {
    await recordWalletLink(db, {
      profileId,
      cardanoAddress: "addr_test1qzprogressive00000000000000000000000000000000000000000",
      network: "preprod",
    });
    const result = await setEconomyMode(
      db,
      { profileId, mode: "wallet" },
      {
        WALLET_MODE_TESTNET_ENABLED: "true",
        WALLET_DISCUSSION_FEE_ENABLED: "true",
        WALLET_REWARDS_TESTNET_ENABLED: "true",
        CARDANO_NETWORK: "preprod",
      }
    );
    expect(result).toEqual({ ok: true, mode: "wallet" });
    expect((await db.profile.findUniqueOrThrow({ where: { id: profileId } })).economyMode).toBe(
      "wallet"
    );
  });

  it("keeps indexed wallet quantities separate from Credits", async () => {
    const registry = testnetAssetRegistry({ CARDANO_NETWORK: "preprod" });
    const definition = await db.assetDefinition.create({
      data: {
        chain: registry.chain,
        network: registry.network,
        policyId: registry.assets[0].policyId,
        assetName: registry.assets[0].assetName,
        symbol: registry.assets[0].symbol,
        displayName: registry.assets[0].displayName,
      },
    });
    await db.balance.create({ data: { profileId, currency: "PC", amount: 25 } });
    await db.walletBalanceSnapshot.create({
      data: { profileId, assetDefinitionId: definition.id, quantity: "900" },
    });
    const wallet = await walletBalanceView(db, profileId);
    expect(wallet.PC).toBe("900");
    expect((await db.balance.findUniqueOrThrow({ where: { profileId_currency: { profileId, currency: "PC" } } })).amount).toBe(25);
  });

  it("keeps the last wallet quantity and marks it stale when the provider is unavailable", async () => {
    const priorProjectId = process.env.BLOCKFROST_PROJECT_ID;
    delete process.env.BLOCKFROST_PROJECT_ID;
    try {
      const result = await refreshWalletBalanceSnapshots(db, profileId);
      expect(result.ok).toBe(false);
      const wallet = await walletBalanceView(db, profileId);
      expect(wallet.PC).toBe("900");
      expect(wallet.syncStatus).toBe("stale");
    } finally {
      if (priorProjectId === undefined) delete process.env.BLOCKFROST_PROJECT_ID;
      else process.env.BLOCKFROST_PROJECT_ID = priorProjectId;
    }
  });

  it("refuses a mainnet registry", () => {
    expect(() => testnetAssetRegistry({ CARDANO_NETWORK: "mainnet" })).toThrow(/refuses/);
  });
});

describe("wallet transaction intents", () => {
  it("is idempotent and follows the legal lifecycle", async () => {
    const first = await createTokenIntent(db, {
      profileId,
      kind: "claim.credit",
      currency: "PC",
      amount: "5",
      idempotencyKey: "claim:test:one",
      destinationWalletScope: "addr_test1qzprogressive",
    });
    const duplicate = await createTokenIntent(db, {
      profileId,
      kind: "claim.credit",
      currency: "PC",
      amount: "5",
      idempotencyKey: "claim:test:one",
      destinationWalletScope: "addr_test1qzprogressive",
    });
    expect(duplicate.id).toBe(first.id);
    expect(
      await db.tokenTransactionIntent.count({
        where: { idempotencyKey: "claim:test:one" },
      })
    ).toBe(1);

    expect(canTransitionTokenIntent("requested", "prepared")).toBe(true);
    expect((await transitionTokenIntent(db, { id: first.id, to: "prepared" })).ok).toBe(true);
    expect(
      (await transitionTokenIntent(db, { id: first.id, to: "submitted" })).ok
    ).toBe(false);
    expect(
      (
        await transitionTokenIntent(db, {
          id: first.id,
          to: "submitted",
          txHash: "a".repeat(64),
        })
      ).ok
    ).toBe(true);
    expect((await transitionTokenIntent(db, { id: first.id, to: "confirmed" })).ok).toBe(
      true
    );
    expect((await transitionTokenIntent(db, { id: first.id, to: "failed" })).ok).toBe(false);
  });

  it("rejects an idempotency key reused for different transaction details", async () => {
    await createTokenIntent(db, {
      profileId,
      kind: "wallet.transfer",
      currency: "PC",
      amount: "1",
      idempotencyKey: "transfer:test:collision",
    });
    await expect(
      createTokenIntent(db, {
        profileId,
        kind: "wallet.transfer",
        currency: "PC",
        amount: "2",
        idempotencyKey: "transfer:test:collision",
      })
    ).rejects.toThrow(/different transaction request/);
  });

  it("sanitizes secret-looking failure details", async () => {
    const intent = await createTokenIntent(db, {
      profileId,
      kind: "wallet.transfer",
      currency: "G",
      amount: "1",
      idempotencyKey: "transfer:test:failure",
    });
    const failed = await transitionTokenIntent(db, {
      id: intent.id,
      to: "failed",
      failureCode: "wallet_error",
      failureMessage: "seed phrase appeared in an unsafe wallet error",
    });
    expect(failed.ok).toBe(true);
    if (failed.ok) expect(failed.intent.failureMessage).toMatch(/removed/);
  });
});
