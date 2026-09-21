import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb } from "./helpers/testDb";

const { url } = createTestDb("chain");
process.env.DATABASE_URL = url;
process.env.CARDANO_NETWORK = "preprod";

import { PrismaClient } from "@prisma/client";
import {
  cardanoNetwork,
  recordWalletLink,
  walletLinkFor,
  recordSelfCustodyProof,
  recordScriptDonation,
  donationsFor,
  demoAssetPolicyId,
  demoAssetUnit,
  demoAssetBalances,
  sameWalletAccount,
  verifyDemoAssetDelivery,
} from "../lib/chain";
import { anchorStatus, recordAnchor } from "../lib/chainAnchor";
import { appendEvent } from "../lib/ledger";

const db = new PrismaClient({ datasources: { db: { url } } });

// The Cardano rail's one hard rule (TESTNET_RAILS_SPEC §6.6): testnet
// only, by construction; a mainnet value anywhere fails loudly.
describe("the testnet wallet rail", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("refuses a mainnet CARDANO_NETWORK loudly", () => {
    const prior = process.env.CARDANO_NETWORK;
    process.env.CARDANO_NETWORK = "mainnet";
    expect(() => cardanoNetwork()).toThrow(/TESTNET/);
    process.env.CARDANO_NETWORK = prior;
    expect(cardanoNetwork()).toBe("preprod");
  });

  it("uses one validated policy identity for registry, balance, and delivery units", () => {
    const policyId = "a".repeat(56);
    expect(demoAssetPolicyId({ TEST_POLLCOIN_POLICY_ID: policyId })).toBe(policyId);
    expect(demoAssetUnit("PC", { TEST_POLLCOIN_POLICY_ID: policyId })).toMatch(
      new RegExp(`^${policyId}`)
    );
    expect(() => demoAssetPolicyId({ TEST_POLLCOIN_POLICY_ID: "not-a-policy" })).toThrow(
      /56-character/
    );
  });

  it("reads the whole stake account when the linked change address is unused", async () => {
    const priorFetch = global.fetch;
    const priorProjectId = process.env.BLOCKFROST_PROJECT_ID;
    process.env.BLOCKFROST_PROJECT_ID = "test-project";
    const linkedUnusedAddress =
      "addr_test1qq6kx44vqaa883kna9r3v3g6m42k57d36ppgz0perhzu86m0vxk5grzvq3e08znluzwhfd20ztevn9fjz3vke3le7cpsm6z4r2";
    const calls: string[] = [];
    global.fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes(`/addresses/${linkedUnusedAddress}`)) {
        return new Response(JSON.stringify({ message: "not found" }), { status: 404 });
      }
      if (url.includes("/accounts/stake_test1") && url.includes("/addresses/assets")) {
        return new Response(
          JSON.stringify([
            { unit: demoAssetUnit("PC"), quantity: "1000" },
            { unit: demoAssetUnit("G"), quantity: "1005" },
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ message: "unexpected" }), { status: 500 });
    };
    try {
      expect(await demoAssetBalances(linkedUnusedAddress)).toEqual({
        pollCoin: "1000",
        gratium: "1005",
      });
      expect(calls).toHaveLength(2);
    } finally {
      global.fetch = priorFetch;
      if (priorProjectId === undefined) delete process.env.BLOCKFROST_PROJECT_ID;
      else process.env.BLOCKFROST_PROJECT_ID = priorProjectId;
    }
  });

  it("compares wallet ownership by stake account, not one rotating address", () => {
    const linked =
      "addr_test1qr69pgcjz83k5ka74qvemskh3gn28upv66ar3caa7gpvpw0kvd0jgy72l2pkgdp7ym08am5rsq6mcyrsc0tf2sqxg3eqqh7x03";
    const otherAccount =
      "addr_test1qq6kx44vqaa883kna9r3v3g6m42k57d36ppgz0perhzu86m0vxk5grzvq3e08znluzwhfd20ztevn9fjz3vke3le7cpsm6z4r2";
    expect(sameWalletAccount(linked, linked)).toBe(true);
    expect(sameWalletAccount(linked, otherAccount)).toBe(false);
  });

  it("refuses mainnet addresses at the door; addr1… never enters the table", async () => {
    const refused = await recordWalletLink(db, {
      profileId: "profile-a",
      cardanoAddress:
        "addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgse35a3x",
      network: "preprod",
    });
    expect(refused.ok).toBe(false);
    expect(await walletLinkFor(db, "profile-a")).toBeNull();
  });

  it("refuses a non-testnet network label", async () => {
    const refused = await recordWalletLink(db, {
      profileId: "profile-a",
      cardanoAddress: "addr_test1qz000000000000000000000000000000000000000000000000000000",
      network: "mainnet",
    });
    expect(refused.ok).toBe(false);
  });

  it("anchor cadence: due when the ledger moves, idle after its own anchor, railed rhythm (§3)", async () => {
    // The rail is data, seeded like every other number.
    await db.rail.create({
      data: {
        key: "anchor.cadenceHours",
        value: 24,
        unit: "hours",
        boundMin: 6,
        boundMax: 96,
        description: "test seed",
      },
    });

    // Empty ledger: nothing to witness.
    let s = await anchorStatus(db);
    expect(s.due).toBe(false);
    expect(s.headSeq).toBeNull();

    // First event, never anchored: due immediately.
    const ev = await appendEvent(db, {
      actorType: "system",
      actorId: null,
      eventType: "test.event",
      payload: { n: 1 },
    });
    s = await anchorStatus(db);
    expect(s.due).toBe(true);
    expect(s.headSeq).toBe(ev.seq);

    // Recording an anchor writes BOTH sides of the witness: the row's
    // anchorRef and a public ledger.anchored event.
    await recordAnchor(db, {
      anchoredSeq: ev.seq,
      headHash: ev.entryHash,
      txHash: "txhash-test-0001",
      network: "preprod",
    });
    const anchored = await db.ledgerEvent.findUnique({ where: { seq: ev.seq } });
    expect(anchored?.anchorRef).toBe("txhash-test-0001");
    s = await anchorStatus(db);
    expect(s.lastAnchor?.txHash).toBe("txhash-test-0001");
    // The anchor's own event never re-triggers: an idle ledger whose
    // newest event is its own last anchor is NOT due, even though the
    // head moved past the anchored seq.
    expect(s.due).toBe(false);

    // The ledger moves; but the cadence hasn't elapsed: still not due.
    await appendEvent(db, {
      actorType: "system",
      actorId: null,
      eventType: "test.event",
      payload: { n: 2 },
    });
    s = await anchorStatus(db);
    expect(s.due).toBe(false);

    // Backdate the anchor past the cadence: now it's due again.
    await db.ledgerEvent.updateMany({
      where: { eventType: "ledger.anchored" },
      data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });
    s = await anchorStatus(db);
    expect(s.due).toBe(true);
  });

  it("records a testnet link once per identity and updates on reconnect", async () => {
    const first = await recordWalletLink(db, {
      profileId: "profile-a",
      cardanoAddress: "addr_test1qz000000000000000000000000000000000000000000000000000000",
      network: "preprod",
    });
    expect(first.ok).toBe(true);

    const second = await recordWalletLink(db, {
      profileId: "profile-a",
      cardanoAddress: "addr_test1qz111111111111111111111111111111111111111111111111111111",
      network: "preprod",
    });
    expect(second.ok).toBe(true);

    const link = await walletLinkFor(db, "profile-a");
    expect(link?.cardanoAddress).toContain("addr_test1qz1111");
    const rows = await db.testnetWalletLink.count();
    expect(rows).toBe(1);
  });

  it("verifies a claim from the transaction output, not a browser callback", async () => {
    const priorFetch = global.fetch;
    const priorProjectId = process.env.BLOCKFROST_PROJECT_ID;
    process.env.BLOCKFROST_PROJECT_ID = "test-project";
    const address = "addr_test1qzdelivery000000000000000000000000000000000000000000000";
    global.fetch = async () =>
      new Response(
        JSON.stringify({
          outputs: [
            {
              address,
              amount: [{ unit: demoAssetUnit("PC"), quantity: "5" }],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    try {
      expect(await verifyDemoAssetDelivery("c".repeat(64), address, "PC", "5")).toBe(true);
      expect(await verifyDemoAssetDelivery("c".repeat(64), address, "PC", "6")).toBe(false);
      expect(await verifyDemoAssetDelivery("c".repeat(64), address, "G", "1")).toBe(false);
    } finally {
      global.fetch = priorFetch;
      if (priorProjectId === undefined) delete process.env.BLOCKFROST_PROJECT_ID;
      else process.env.BLOCKFROST_PROJECT_ID = priorProjectId;
    }
  });
});

// On-chain migration Slice 2: the self-custody proof is recorded ONLY
// after the claimed hash is verified to exist on the configured testnet.
// The verifier is injected here; no network in the fast suite.
describe("the self-custody proof", () => {
  const goodHash = "a".repeat(64);
  const found = async () => true;
  const notFound = async () => false;
  // F3: the linked wallet must have SENT the tx.
  const sentByLinked = async () => [
    (await walletLinkFor(db, "profile-a"))!.cardanoAddress,
  ];
  const sentByStranger = async () => [
    "addr_test1qzstranger0000000000000000000000000000000000000000000",
  ];

  it("refuses a malformed transaction hash without consulting the chain", async () => {
    let consulted = false;
    const spy = async () => ((consulted = true), true);
    const r = await recordSelfCustodyProof(
      db,
      { profileId: "profile-a", txHash: "not-a-hash" },
      spy
    );
    expect(r.ok).toBe(false);
    expect(consulted).toBe(false);
  });

  it("refuses a proof for an identity with no wallet link", async () => {
    const r = await recordSelfCustodyProof(
      db,
      { profileId: "profile-unlinked", txHash: goodHash },
      found
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryable).toBe(false);
  });

  it("does NOT record a hash the testnet has never seen; retryable, wrong-testnet hint", async () => {
    const r = await recordSelfCustodyProof(
      db,
      { profileId: "profile-a", txHash: goodHash },
      notFound
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.retryable).toBe(true);
      expect(r.reason).toMatch(/Preview/);
    }
    const link = await walletLinkFor(db, "profile-a");
    expect(link?.proofTxHash).toBeNull();
  });

  it("refuses a real tx that was NOT sent by the identity's linked wallet (F3)", async () => {
    const r = await recordSelfCustodyProof(
      db,
      { profileId: "profile-a", txHash: goodHash },
      found,
      sentByStranger
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.retryable).toBe(false);
      expect(r.reason).toMatch(/wasn't sent by this identity's linked wallet/);
    }
    const link = await walletLinkFor(db, "profile-a");
    expect(link?.proofTxHash).toBeNull();
  });

  it("records a verified proof, normalized to lowercase", async () => {
    const r = await recordSelfCustodyProof(
      db,
      { profileId: "profile-a", txHash: goodHash.toUpperCase() },
      found,
      sentByLinked
    );
    expect(r.ok).toBe(true);
    const link = await walletLinkFor(db, "profile-a");
    expect(link?.proofTxHash).toBe(goodHash);
    expect(link?.proofAt).toBeInstanceOf(Date);
  });

  it("re-signing updates the proof in place; still one row per identity", async () => {
    const newer = "b".repeat(64);
    const r = await recordSelfCustodyProof(
      db,
      { profileId: "profile-a", txHash: newer },
      found,
      sentByLinked
    );
    expect(r.ok).toBe(true);
    const link = await walletLinkFor(db, "profile-a");
    expect(link?.proofTxHash).toBe(newer);
    // Only profile-a's link exists at this point in the suite.
    expect(await db.testnetWalletLink.count({ where: { profileId: "profile-a" } })).toBe(1);
  });
});

// On-chain migration Slice 3: a donation is recorded ONLY when the
// chain shows value locked at the donation script in that transaction.
// The verifier is injected; no network in the fast suite.
describe("the non-custodial donation", () => {
  const script = "addr_test1wzscript000000000000000000000000000000000000000000";
  const hash = (c: string) => c.repeat(64);
  const sentByLinked = async () => [
    (await walletLinkFor(db, "profile-a"))!.cardanoAddress,
  ];

  it("refuses a malformed hash without consulting the chain", async () => {
    let consulted = false;
    const spy = async () => ((consulted = true), 3_000_000 as number | null);
    const r = await recordScriptDonation(
      db,
      { profileId: "profile-a", txHash: "nope", scriptAddress: script },
      spy
    );
    expect(r.ok).toBe(false);
    expect(consulted).toBe(false);
  });

  it("refuses a donation for an identity with no wallet link", async () => {
    const r = await recordScriptDonation(
      db,
      { profileId: "profile-unlinked", txHash: hash("c"), scriptAddress: script },
      async () => 3_000_000
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryable).toBe(false);
  });

  it("tx not visible yet → retryable, nothing recorded", async () => {
    const r = await recordScriptDonation(
      db,
      { profileId: "profile-a", txHash: hash("c"), scriptAddress: script },
      async () => null
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryable).toBe(true);
    expect(await db.testnetDonation.count()).toBe(0);
  });

  it("tx exists but locked NOTHING at the script → refused, not retryable", async () => {
    const r = await recordScriptDonation(
      db,
      { profileId: "profile-a", txHash: hash("c"), scriptAddress: script },
      async () => 0
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryable).toBe(false);
    expect(await db.testnetDonation.count()).toBe(0);
  });

  it("refuses someone ELSE's donation tx; not sent by the linked wallet (F3)", async () => {
    const r = await recordScriptDonation(
      db,
      { profileId: "profile-a", txHash: hash("c"), scriptAddress: script },
      async () => 3_000_000,
      async () => ["addr_test1qzsomeoneelse000000000000000000000000000000000000000"]
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.retryable).toBe(false);
      expect(r.reason).toMatch(/wasn't sent by this identity's linked wallet/);
    }
    expect(await db.testnetDonation.count()).toBe(0);
  });

  it("records the donation with the chain-verified amount", async () => {
    const r = await recordScriptDonation(
      db,
      { profileId: "profile-a", txHash: hash("c"), scriptAddress: script },
      async () => 3_000_000,
      sentByLinked
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.lovelace).toBe(3_000_000);
    const rows = await donationsFor(db, "profile-a");
    expect(rows).toHaveLength(1);
    expect(rows[0].scriptAddress).toBe(script);
    expect(rows[0].network).toBe("preprod");
  });

  it("recording the same tx twice stays one row; idempotent per hash", async () => {
    const r = await recordScriptDonation(
      db,
      { profileId: "profile-a", txHash: hash("c"), scriptAddress: script },
      async () => 3_000_000,
      sentByLinked
    );
    expect(r.ok).toBe(true);
    expect(await db.testnetDonation.count()).toBe(1);
  });
});

// On-chain migration Slice 7: fund-auditor settlement; per case,
// never per finding, verify-then-record, idempotent. Sender and
// chain verifier injected; no network in the fast suite.
describe("auditor settlement", () => {
  const auditorWallet = "addr_test1qz222222222222222222222222222222222222222222222222222222";
  let auditId = "";

  it("pays a completed audit's auditor at their own wallet and records only after verification", async () => {
    const { settleCompletedAudits } = await import("../lib/chainSettlement");
    // Fixture: chamber → release → completed audit, auditor with a wallet.
    const chamber = await db.chamber.create({
      data: {
        title: "t",
        subject: "s",
        pitch: "p",
        whyCare: "w",
        isPublic: true,
        scaffoldSolving: "x",
        scaffoldNeedToKnow: "y",
        scaffoldSuccess: "z",
        creatorProfileId: "profile-p",
        creatorHandle: "p",
      },
    });
    const release = await db.missionRelease.create({
      data: {
        chamberId: chamber.id,
        currency: "PC",
        amount: 1,
        purpose: "test",
        toProfileId: "profile-r",
        toHandle: "r",
        proposerProfileId: "profile-p",
        proposerHandle: "p",
      },
    });
    const audit = await db.fundAudit.create({
      data: {
        releaseId: release.id,
        auditorProfileId: "profile-auditor",
        expiresAt: new Date(Date.now() + 86_400_000),
        status: "completed",
        finding: "clean",
        completedAt: new Date(),
      },
    });
    auditId = audit.id;
    await db.rail.create({
      data: {
        key: "onchain.auditorSettlementLovelace",
        value: 2_000_000,
        unit: "lovelace",
        boundMin: 1_000_000,
        boundMax: 8_000_000,
        description: "test seed",
      },
    });
    await recordWalletLink(db, {
      profileId: "profile-auditor",
      cardanoAddress: auditorWallet,
      network: "preprod",
    });

    const sends: { to: string; lovelace: number; auditId: string; basis: string }[] = [];
    const result = await settleCompletedAudits(
      db,
      async (to, lovelace, note) => {
        sends.push({ to, lovelace, ...note });
        return "F".repeat(64);
      },
      async () => 2_000_000
    );
    expect(sends).toEqual([
      {
        to: auditorWallet,
        lovelace: 2_000_000,
        auditId: audit.id,
        basis: "per-case-never-per-finding",
      },
    ]);
    expect(result.settled).toHaveLength(1);
    const row = await db.fundAudit.findUnique({ where: { id: audit.id } });
    expect(row?.settlementTxHash).toBe("f".repeat(64));
    expect(row?.settlementAt).toBeInstanceOf(Date);
  });

  it("is idempotent; a settled case is never paid twice", async () => {
    const { settleCompletedAudits } = await import("../lib/chainSettlement");
    let sendCalls = 0;
    const result = await settleCompletedAudits(
      db,
      async () => ((sendCalls += 1), "a".repeat(64)),
      async () => 2_000_000
    );
    expect(sendCalls).toBe(0);
    expect(result.settled).toEqual([]);
  });

  it("refuses to record an unconfirmed settlement; and leaves the row unsettled", async () => {
    const { settleCompletedAudits } = await import("../lib/chainSettlement");
    // A second completed audit for the same auditor, unsettled.
    const prior = await db.fundAudit.findUnique({ where: { id: auditId } });
    const audit = await db.fundAudit.create({
      data: {
        releaseId: prior!.releaseId,
        auditorProfileId: "profile-auditor2",
        expiresAt: new Date(Date.now() + 86_400_000),
        status: "completed",
        finding: "concern",
        completedAt: new Date(),
      },
    });
    await recordWalletLink(db, {
      profileId: "profile-auditor2",
      cardanoAddress: "addr_test1qz333333333333333333333333333333333333333333333333333333",
      network: "preprod",
    });
    await expect(
      settleCompletedAudits(
        db,
        async () => "b".repeat(64),
        async () => 0 // chain says: paid nothing
      )
    ).rejects.toThrow(/NOT recorded/);
    const row = await db.fundAudit.findUnique({ where: { id: audit.id } });
    expect(row?.settlementTxHash).toBeNull();
  });
});

// Slice 4 carry-over: the server mirrors the chain on ITS schedule;
// a donation the browser poll lost is recovered by the sweep, and
// nothing is double-recorded or invented. Chain access injected.
describe("donation reconciliation", () => {
  it("recovers a chain-confirmed donation the database missed", async () => {
    const { reconcileDonations } = await import("../lib/chainReconcile");
    const missed = "d".repeat(64);
    const script = "addr_test1wzscript000000000000000000000000000000000000000000";
    const linked = (await walletLinkFor(db, "profile-a"))!.cardanoAddress;
    const result = await reconcileDonations(db, script, {
      // The linked wallet's recent txs: one already recorded, one missed,
      // one unrelated (pays the script nothing).
      listTxs: async () => ["c".repeat(64), missed, "e".repeat(64)],
      lockedAtScript: async (tx) => (tx === missed ? 3_000_000 : 0),
      inputAddresses: async () => [linked],
    });
    expect(result.recovered).toEqual([{ txHash: missed, lovelace: 3_000_000 }]);
    expect(await db.testnetDonation.count()).toBe(2);
    const row = await db.testnetDonation.findUnique({ where: { txHash: missed } });
    expect(row?.scriptAddress).toBe(script);
  });

  it("never mis-attributes a tx the wallet RECEIVED but did not send (F3)", async () => {
    const { reconcileDonations } = await import("../lib/chainReconcile");
    const foreign = "1".repeat(64);
    const result = await reconcileDonations(
      db,
      "addr_test1wzscript000000000000000000000000000000000000000000",
      {
        // A tx that paid the script AND touched the linked wallet's
        // address listing; but was FUNDED by someone else entirely.
        listTxs: async () => [foreign],
        lockedAtScript: async () => 3_000_000,
        inputAddresses: async () => ["addr_test1qzsomeoneelse00000000000000000000000000000000000"],
      }
    );
    expect(result.recovered).toEqual([]);
    expect(await db.testnetDonation.findUnique({ where: { txHash: foreign } })).toBeNull();
  });

  it("is idempotent; a second sweep recovers nothing and verifies nothing twice", async () => {
    const { reconcileDonations } = await import("../lib/chainReconcile");
    let verifierCalls = 0;
    const result = await reconcileDonations(
      db,
      "addr_test1wzscript000000000000000000000000000000000000000000",
      {
        listTxs: async () => ["c".repeat(64), "d".repeat(64)],
        lockedAtScript: async () => (verifierCalls++, 3_000_000),
        inputAddresses: async () => [],
      }
    );
    expect(result.recovered).toEqual([]);
    // Both txs already have rows; the chain is never re-consulted.
    expect(verifierCalls).toBe(0);
    expect(await db.testnetDonation.count()).toBe(2);
  });
});
