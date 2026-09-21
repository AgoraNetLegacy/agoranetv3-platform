// Self-custody chamber creation: a soul who holds their own tokens can
// build in the Pollinator without first parking value with the platform
// (DECISIONS_PENDING #28). The dual-token signature still binds; both
// tokens move, in ONE transaction the soul signs.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import { createTestDb, REPO_ROOT } from "./helpers/testDb";

const { url } = createTestDb("wallet-chamber");
process.env.DATABASE_URL = url;
process.env.GATE_OPERATOR_SECRET = "test-secret-for-wallet-chamber-tests";
process.env.CARDANO_NETWORK = "preprod";
process.env.WALLET_MODE_TESTNET_ENABLED = "true";
process.env.WALLET_DISCUSSION_FEE_ENABLED = "true";
process.env.WALLET_REWARDS_TESTNET_ENABLED = "true";
process.env.BLOCKFROST_PROJECT_ID = "test-blockfrost-project";

import { PrismaClient } from "@prisma/client";
import { mConStr1, serializeData, stringToHex } from "@meshsdk/core";
import { recordWalletLink, demoAssetUnit } from "../lib/chain";
import {
  verifyWalletDualFeePayment,
  WALLET_FEE_TREASURY_TAG,
} from "../lib/chainWalletEconomy";
import { chargeToTreasury, dualBalanceOf } from "../lib/economy";
import { setEconomyMode } from "../lib/progressiveEconomy";
import {
  finalizeWalletChamber,
  prepareWalletChamber,
  recordWalletChamberSubmission,
  rejectWalletChamber,
} from "../lib/walletChamber";
import { makeOnboardedSoul } from "./helpers/souls";

const db = new PrismaClient({ datasources: { db: { url } } });
const env = {
  CARDANO_NETWORK: "preprod",
  WALLET_MODE_TESTNET_ENABLED: "true",
  WALLET_DISCUSSION_FEE_ENABLED: "true",
  WALLET_REWARDS_TESTNET_ENABLED: "true",
};

const SCAFFOLD = {
  solving: "Self-custody souls cannot build here.",
  needToKnow: "How Cardano carries two assets in one output.",
  success: "A chamber opened straight from a wallet.",
};

const PAYLOAD = {
  title: "Self-Custody Chamber",
  subject: "Building without parking value with the platform",
  pitch: "A chamber opened from a wallet the soul controls.",
  whyCare: "Custody should be a choice, not a toll gate. Now, before habits set.",
  isPublic: true,
  scaffold: SCAFFOLD,
};

let walletProfileId: string;
let creditsProfileId: string;
const linkedAddress =
  "addr_test1qzwalletchamber00000000000000000000000000000000000000000000";

function runVerify() {
  return spawnSync("npx", ["tsx", "scripts/verify.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
}

beforeAll(async () => {
  const seeded = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  if (seeded.status !== 0) throw new Error(`seed failed: ${seeded.stderr}`);

  const walletSoul = await makeOnboardedSoul(db, {
    trueSelf: "wallet-chamber-user",
    alias: "wallet-chamber-alias",
  });
  walletProfileId = walletSoul.trueSelfId;
  const creditSoul = await makeOnboardedSoul(db, {
    trueSelf: "credits-chamber-user",
    alias: "credits-chamber-alias",
  });
  creditsProfileId = creditSoul.trueSelfId;

  await recordWalletLink(db, {
    profileId: walletProfileId,
    cardanoAddress: linkedAddress,
    network: "preprod",
  });
  expect(
    await setEconomyMode(db, { profileId: walletProfileId, mode: "wallet" }, env)
  ).toEqual({ ok: true, mode: "wallet" });

  // The whole point: this soul holds NOTHING in platform custody. Spend the
  // welcome grant through accounted treasury charges rather than deleting the
  // rows, so the conservation invariant still re-derives.
  const granted = await dualBalanceOf(db, walletProfileId);
  await db.$transaction(async (tx) => {
    for (const currency of ["PC", "G"] as const) {
      if (granted[currency] <= 0) continue;
      const spent = await chargeToTreasury(tx, {
        profileId: walletProfileId,
        currency,
        amount: granted[currency],
        kind: currency === "PC" ? "fee.discussion" : "fee.permanence",
      });
      if (!spent.ok) throw new Error(spent.reason);
    }
  });
}, 120_000);

afterAll(async () => db.$disconnect());

describe("self-custody chamber creation", () => {
  it("opens a chamber for a soul with an empty platform balance, charging only the chain", async () => {
    expect(await dualBalanceOf(db, walletProfileId)).toEqual({ PC: 0, G: 0 });

    const prepared = await prepareWalletChamber(
      db,
      { profileId: walletProfileId, idempotencyKey: "chamber-one", payload: PAYLOAD },
      env
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    // Both legs, named and priced at the ratified rails, in one request.
    expect(prepared.assets).toEqual([
      { currency: "PC", unit: demoAssetUnit("PC"), quantity: "20" },
      { currency: "G", unit: demoAssetUnit("G"), quantity: "20" },
    ]);
    expect(prepared.linkedAddress).toBe(linkedAddress);

    const duplicate = await prepareWalletChamber(
      db,
      { profileId: walletProfileId, idempotencyKey: "chamber-one", payload: PAYLOAD },
      env
    );
    expect(duplicate.ok).toBe(true);
    if (!duplicate.ok) return;
    expect(duplicate.intentId).toBe(prepared.intentId);
    expect(await db.walletActionDraft.count({ where: { kind: "chamber.create" } })).toBe(1);

    const submitted = await recordWalletChamberSubmission(db, {
      profileId: walletProfileId,
      intentId: prepared.intentId,
      txHash: "a".repeat(64),
    });
    expect(submitted.ok).toBe(true);

    // Unconfirmed on chain: no chamber may exist yet.
    const waiting = await finalizeWalletChamber(
      db,
      { profileId: walletProfileId, intentId: prepared.intentId },
      async () => false
    );
    expect(waiting).toMatchObject({ ok: false, retryable: true });
    expect(await db.chamber.count({ where: { title: PAYLOAD.title } })).toBe(0);

    const confirmed = await finalizeWalletChamber(
      db,
      { profileId: walletProfileId, intentId: prepared.intentId },
      async () => true
    );
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;

    const chamber = await db.chamber.findUniqueOrThrow({
      where: { id: confirmed.chamberId },
    });
    expect(chamber.creatorProfileId).toBe(walletProfileId);
    expect(chamber.isPublic).toBe(true);

    // The chamber is whole: creator inside, workshop born, civic record.
    expect(
      await db.chamberMember.count({
        where: { chamberId: chamber.id, profileId: walletProfileId },
      })
    ).toBe(1);
    const workshop = await db.discussion.findFirstOrThrow({
      where: { chamberId: chamber.id },
    });
    expect(workshop.permanence).toBe("deletable");
    expect(
      await db.ledgerEvent.count({
        where: { eventType: "chamber.created", payload: { contains: chamber.id } },
      })
    ).toBe(1);

    // Nothing was debited internally, and no internal receipt was invented:
    // the value moved on chain, so the confirmed intent IS the receipt.
    expect(await dualBalanceOf(db, walletProfileId)).toEqual({ PC: 0, G: 0 });
    expect(
      await db.economyEntry.count({
        where: { kind: "fee.chamber", fromProfileId: walletProfileId },
      })
    ).toBe(0);
    const intent = await db.tokenTransactionIntent.findUniqueOrThrow({
      where: { id: prepared.intentId },
    });
    expect(intent.status).toBe("confirmed");
    expect(intent.currency).toBe("PC");
    expect(intent.amount).toBe("20");
    expect(intent.secondaryCurrency).toBe("G");
    expect(intent.secondaryAmount).toBe("20");
    expect(
      (await db.walletActionDraft.findUniqueOrThrow({ where: { id: prepared.draftId } }))
        .resultRefId
    ).toBe(chamber.id);
  }, 60_000);

  it("is idempotent after completion; one payment opens exactly one chamber", async () => {
    const draft = await db.walletActionDraft.findFirstOrThrow({
      where: { kind: "chamber.create", status: "completed" },
    });
    const again = await finalizeWalletChamber(
      db,
      { profileId: walletProfileId, intentId: draft.transactionIntentId },
      async () => true
    );
    expect(again).toEqual({ ok: true, chamberId: draft.resultRefId });
    expect(await db.chamber.count({ where: { title: PAYLOAD.title } })).toBe(1);

    // The same request identifier cannot be paid twice.
    const replay = await prepareWalletChamber(
      db,
      { profileId: walletProfileId, idempotencyKey: "chamber-one", payload: PAYLOAD },
      env
    );
    expect(replay).toMatchObject({ ok: false });
  }, 60_000);

  it("refuses a platform-custody identity; it has no wallet to sign with", async () => {
    const result = await prepareWalletChamber(
      db,
      { profileId: creditsProfileId, idempotencyKey: "credits-try", payload: PAYLOAD },
      env
    );
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.reason).toContain("platform custody");
  });

  it("validates the brief BEFORE Lace opens, so nobody pays for a refused chamber", async () => {
    const result = await prepareWalletChamber(
      db,
      {
        profileId: walletProfileId,
        idempotencyKey: "no-scaffold",
        payload: { ...PAYLOAD, scaffold: { ...SCAFFOLD, success: "" } },
      },
      env
    );
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.reason).toContain("scaffold");
    expect(await db.walletActionDraft.count({ where: { kind: "chamber.create" } })).toBe(1);
  });

  it("releases a cancelled request without opening a chamber", async () => {
    const prepared = await prepareWalletChamber(
      db,
      { profileId: walletProfileId, idempotencyKey: "cancel-me", payload: PAYLOAD },
      env
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(
      await rejectWalletChamber(db, {
        profileId: walletProfileId,
        intentId: prepared.intentId,
      })
    ).toEqual({ ok: true });
    expect(
      (await db.tokenTransactionIntent.findUniqueOrThrow({ where: { id: prepared.intentId } }))
        .status
    ).toBe("rejected");
    expect(await db.chamber.count({ where: { title: PAYLOAD.title } })).toBe(1);
  }, 60_000);

  it("db:verify accepts an on-chain settled chamber and still demands its proof", () => {
    const result = runVerify();
    expect(result.stdout + result.stderr).not.toContain("✗");
    expect(result.status).toBe(0);
  }, 90_000);

  it("db:verify fails loudly if a wallet chamber's payment is not confirmed", async () => {
    const draft = await db.walletActionDraft.findFirstOrThrow({
      where: { kind: "chamber.create", status: "completed" },
    });
    await db.tokenTransactionIntent.update({
      where: { id: draft.transactionIntentId },
      data: { status: "submitted" },
    });
    const result = runVerify();
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("UNSETTLED WALLET CHAMBER");
    await db.tokenTransactionIntent.update({
      where: { id: draft.transactionIntentId },
      data: { status: "confirmed" },
    });
    expect(runVerify().status).toBe(0);
  }, 120_000);
});

describe("dual-token chain evidence", () => {
  const destination = "addr_test1qzdestination00000000000000000000000000000000000000000";
  const datum = serializeData(mConStr1([stringToHex(WALLET_FEE_TREASURY_TAG)]));
  const legs = [
    { currency: "PC" as const, quantity: "20" },
    { currency: "G" as const, quantity: "20" },
  ];

  function fetcherFor(amount: { unit: string; quantity: string }[]) {
    return (async () =>
      new Response(
        JSON.stringify({
          inputs: [{ address: linkedAddress }],
          outputs: [{ address: destination, inline_datum: datum, amount }],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )) as unknown as typeof fetch;
  }

  const base = {
    txHash: "c".repeat(64),
    sourceAddress: linkedAddress,
    destinationAddress: destination,
  };

  it("accepts one transaction carrying both tokens", async () => {
    expect(
      await verifyWalletDualFeePayment(
        { ...base, legs },
        fetcherFor([
          { unit: demoAssetUnit("PC"), quantity: "20" },
          { unit: demoAssetUnit("G"), quantity: "20" },
        ])
      )
    ).toBe(true);
  });

  it("refuses a transaction that pays only PollCoin, however generously", async () => {
    expect(
      await verifyWalletDualFeePayment(
        { ...base, legs },
        fetcherFor([{ unit: demoAssetUnit("PC"), quantity: "4000" }])
      )
    ).toBe(false);
  });

  it("refuses a transaction that pays only Gratium", async () => {
    expect(
      await verifyWalletDualFeePayment(
        { ...base, legs },
        fetcherFor([{ unit: demoAssetUnit("G"), quantity: "4000" }])
      )
    ).toBe(false);
  });

  it("refuses when one leg is short", async () => {
    expect(
      await verifyWalletDualFeePayment(
        { ...base, legs },
        fetcherFor([
          { unit: demoAssetUnit("PC"), quantity: "20" },
          { unit: demoAssetUnit("G"), quantity: "19" },
        ])
      )
    ).toBe(false);
  });

  it("refuses a payment the linked wallet did not fund", async () => {
    expect(
      await verifyWalletDualFeePayment(
        {
          ...base,
          legs,
          sourceAddress: "addr_test1qznotlinked000000000000000000000000000000000000000",
        },
        fetcherFor([
          { unit: demoAssetUnit("PC"), quantity: "20" },
          { unit: demoAssetUnit("G"), quantity: "20" },
        ])
      ).catch(() => false)
    ).toBe(false);
  });
});
