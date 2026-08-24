import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import { createTestDb, REPO_ROOT } from "./helpers/testDb";

const { url } = createTestDb("wallet-mode-actions");
process.env.DATABASE_URL = url;
process.env.GATE_OPERATOR_SECRET = "test-secret-for-wallet-action-tests";
process.env.CARDANO_NETWORK = "preprod";
process.env.WALLET_MODE_TESTNET_ENABLED = "true";
process.env.WALLET_DISCUSSION_FEE_ENABLED = "true";
process.env.WALLET_REWARDS_TESTNET_ENABLED = "true";
process.env.BLOCKFROST_PROJECT_ID = "test-blockfrost-project";

import { PrismaClient } from "@prisma/client";
import { recordWalletLink, demoAssetUnit } from "../lib/chain";
import {
  verifyWalletFeePayment,
  WALLET_FEE_TREASURY_TAG,
} from "../lib/chainWalletEconomy";
import { mConStr1, serializeData, stringToHex } from "@meshsdk/core";
import { chargeToTreasury, balanceOf } from "../lib/economy";
import { setEconomyMode } from "../lib/progressiveEconomy";
import {
  finalizeWalletPost,
  prepareWalletPost,
  recordWalletPostSubmission,
} from "../lib/walletActions";
import {
  acquireWalletReward,
  confirmWalletReward,
  markWalletRewardSubmitted,
} from "../lib/walletRewards";
import { makeOnboardedSoul } from "./helpers/souls";

const db = new PrismaClient({ datasources: { db: { url } } });
const env = {
  CARDANO_NETWORK: "preprod",
  WALLET_MODE_TESTNET_ENABLED: "true",
  WALLET_DISCUSSION_FEE_ENABLED: "true",
  WALLET_REWARDS_TESTNET_ENABLED: "true",
};

let profileId: string;
let creditsProfileId: string;
let discussionId: string;
const linkedAddress =
  "addr_test1qzwalletmode000000000000000000000000000000000000000000000";

beforeAll(async () => {
  const seeded = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  if (seeded.status !== 0) throw new Error(`seed failed: ${seeded.stderr}`);

  const walletSoul = await makeOnboardedSoul(db, {
    trueSelf: "wallet-action-user",
    alias: "wallet-action-alias",
  });
  profileId = walletSoul.trueSelfId;
  const creditSoul = await makeOnboardedSoul(db, {
    trueSelf: "credit-action-user",
    alias: "credit-action-alias",
  });
  creditsProfileId = creditSoul.trueSelfId;
  discussionId = (
    await db.discussion.findFirstOrThrow({ where: { permanence: "permanent-canonical" } })
  ).id;
  await recordWalletLink(db, {
    profileId,
    cardanoAddress: linkedAddress,
    network: "preprod",
  });
  expect(await setEconomyMode(db, { profileId, mode: "wallet" }, env)).toEqual({
    ok: true,
    mode: "wallet",
  });
});

afterAll(async () => db.$disconnect());

describe("wallet-paid discussion posts", () => {
  it("prepares idempotently, confirms one payment, and queues wallet rewards", async () => {
    const creditsBefore = {
      pc: await balanceOf(db, profileId, "PC"),
      g: await balanceOf(db, profileId, "G"),
    };
    const payload = {
      discussionId,
      body: "A post whose fake fee is signed by my own wallet.",
      humanMade: true,
    };
    const prepared = await prepareWalletPost(
      db,
      { profileId, idempotencyKey: "wallet-post-one", payload },
      env
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.amount).toBe("2");
    expect(prepared.assetUnit).toBe(demoAssetUnit("PC"));
    expect(prepared.linkedAddress).toBe(linkedAddress);
    expect(await setEconomyMode(db, { profileId, mode: "credits" }, env)).toMatchObject({
      ok: false,
    });

    const duplicate = await prepareWalletPost(
      db,
      { profileId, idempotencyKey: "wallet-post-one", payload },
      env
    );
    expect(duplicate.ok).toBe(true);
    if (!duplicate.ok) return;
    expect(duplicate.intentId).toBe(prepared.intentId);
    expect(await db.walletActionDraft.count()).toBe(1);

    const submitted = await recordWalletPostSubmission(db, {
      profileId,
      intentId: prepared.intentId,
      txHash: "a".repeat(64),
    });
    expect(submitted.ok).toBe(true);
    const waiting = await finalizeWalletPost(
      db,
      { profileId, intentId: prepared.intentId },
      async () => false
    );
    expect(waiting).toMatchObject({ ok: false, retryable: true });
    expect(await db.post.count({ where: { body: payload.body } })).toBe(0);

    const confirmed = await finalizeWalletPost(
      db,
      { profileId, intentId: prepared.intentId },
      async () => true
    );
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect((await db.tokenTransactionIntent.findUniqueOrThrow({ where: { id: prepared.intentId } })).status).toBe("confirmed");
    expect((await db.walletActionDraft.findUniqueOrThrow({ where: { id: prepared.draftId } })).status).toBe("completed");
    expect(await db.post.count({ where: { id: confirmed.postId } })).toBe(1);
    expect(await db.tokenTransactionIntent.count({
      where: { profileId, kind: { in: ["reward.first-action", "reward.accrual"] }, status: "prepared" },
    })).toBe(2);
    expect(await balanceOf(db, profileId, "PC")).toBe(creditsBefore.pc);
    expect(await balanceOf(db, profileId, "G")).toBe(creditsBefore.g);

    const repeated = await finalizeWalletPost(
      db,
      { profileId, intentId: prepared.intentId },
      async () => {
        throw new Error("idempotent completion must not verify twice");
      }
    );
    expect(repeated).toEqual({ ok: true, postId: confirmed.postId });
    expect(await db.post.count({ where: { body: payload.body } })).toBe(1);
  });

  it("does not reuse a transaction hash for a second action", async () => {
    const prepared = await prepareWalletPost(
      db,
      {
        profileId,
        idempotencyKey: "wallet-post-two",
        payload: { discussionId, body: "A second pending wallet post." },
      },
      env
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const result = await recordWalletPostSubmission(db, {
      profileId,
      intentId: prepared.intentId,
      txHash: "a".repeat(64),
    });
    expect(result.ok).toBe(false);
    expect((await db.tokenTransactionIntent.findUniqueOrThrow({ where: { id: prepared.intentId } })).status).toBe("awaiting_wallet_approval");
  });

  it("keeps ordinary Credits-mode posting unchanged", async () => {
    const { createPost } = await import("../lib/discussions");
    const before = await balanceOf(db, creditsProfileId, "PC");
    const result = await createPost(db, {
      profileId: creditsProfileId,
      discussionId,
      body: "A normal beginner Credits-mode post.",
    });
    expect(result.ok).toBe(true);
    expect(await balanceOf(db, creditsProfileId, "PC")).toBe(before - 1);
  });

  it("refuses silent internal charges in Wallet mode", async () => {
    const before = await balanceOf(db, profileId, "G");
    const result = await db.$transaction((tx) =>
      chargeToTreasury(tx, {
        profileId,
        currency: "G",
        amount: 1,
        kind: "fee.unsupported-test",
      })
    );
    expect(result.ok).toBe(false);
    expect(await balanceOf(db, profileId, "G")).toBe(before);
  });
});

describe("wallet reward delivery lifecycle", () => {
  it("leases once and confirms only exact chain delivery", async () => {
    const reward = await db.tokenTransactionIntent.findFirstOrThrow({
      where: { profileId, kind: "reward.first-action" },
    });
    expect(await acquireWalletReward(db, reward.id)).toBe(true);
    expect(await acquireWalletReward(db, reward.id)).toBe(false);
    expect(
      (
        await markWalletRewardSubmitted(db, {
          intentId: reward.id,
          txHash: "b".repeat(64),
        })
      ).ok
    ).toBe(true);
    expect((await confirmWalletReward(db, reward.id, async () => false)).ok).toBe(false);
    expect((await confirmWalletReward(db, reward.id, async () => true)).ok).toBe(true);
  });
});

describe("wallet fee chain evidence", () => {
  it("requires the linked input and exact fake asset at the compiled destination", async () => {
    const destination = "addr_test1qzdestination00000000000000000000000000000000000000000";
    const fetcher = async () =>
      new Response(
        JSON.stringify({
          inputs: [{ address: linkedAddress }],
          outputs: [
            {
              address: destination,
              inline_datum: serializeData(
                mConStr1([stringToHex(WALLET_FEE_TREASURY_TAG)])
              ),
              amount: [{ unit: demoAssetUnit("PC"), quantity: "2" }],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    expect(
      await verifyWalletFeePayment(
        {
          txHash: "c".repeat(64),
          sourceAddress: linkedAddress,
          destinationAddress: destination,
          currency: "PC",
          quantity: "2",
        },
        fetcher as typeof fetch
      )
    ).toBe(true);
    expect(
      await verifyWalletFeePayment(
        {
          txHash: "c".repeat(64),
          sourceAddress: "addr_test1qznotlinked0000000000000000000000000000000000000000",
          destinationAddress: destination,
          currency: "PC",
          quantity: "2",
        },
        fetcher as typeof fetch
      )
    ).toBe(false);
    const wrongDatumFetcher = async () =>
      new Response(
        JSON.stringify({
          inputs: [{ address: linkedAddress }],
          outputs: [
            {
              address: destination,
              inline_datum: "d87980",
              amount: [{ unit: demoAssetUnit("PC"), quantity: "2" }],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    expect(
      await verifyWalletFeePayment(
        {
          txHash: "c".repeat(64),
          sourceAddress: linkedAddress,
          destinationAddress: destination,
          currency: "PC",
          quantity: "2",
        },
        wrongDatumFetcher as typeof fetch
      )
    ).toBe(false);
  });
});
