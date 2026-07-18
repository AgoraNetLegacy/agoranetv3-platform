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
} from "../lib/chain";
import { anchorStatus, recordAnchor } from "../lib/chainAnchor";
import { appendEvent } from "../lib/ledger";

const db = new PrismaClient({ datasources: { db: { url } } });

// The Cardano rail's one hard rule (TESTNET_RAILS_SPEC §6.6): testnet
// only, by construction — a mainnet value anywhere fails loudly.
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

  it("refuses mainnet addresses at the door — addr1… never enters the table", async () => {
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

    // The ledger moves — but the cadence hasn't elapsed: still not due.
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

  it("records a testnet link once per face and updates on reconnect", async () => {
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
});

// On-chain migration Slice 2: the self-custody proof is recorded ONLY
// after the claimed hash is verified to exist on the configured testnet.
// The verifier is injected here — no network in the fast suite.
describe("the self-custody proof", () => {
  const goodHash = "a".repeat(64);
  const found = async () => true;
  const notFound = async () => false;

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

  it("refuses a proof for a face with no wallet link", async () => {
    const r = await recordSelfCustodyProof(
      db,
      { profileId: "profile-unlinked", txHash: goodHash },
      found
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryable).toBe(false);
  });

  it("does NOT record a hash the testnet has never seen — retryable, wrong-testnet hint", async () => {
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

  it("records a verified proof, normalized to lowercase", async () => {
    const r = await recordSelfCustodyProof(
      db,
      { profileId: "profile-a", txHash: goodHash.toUpperCase() },
      found
    );
    expect(r.ok).toBe(true);
    const link = await walletLinkFor(db, "profile-a");
    expect(link?.proofTxHash).toBe(goodHash);
    expect(link?.proofAt).toBeInstanceOf(Date);
  });

  it("re-signing updates the proof in place — still one row per face", async () => {
    const newer = "b".repeat(64);
    const r = await recordSelfCustodyProof(
      db,
      { profileId: "profile-a", txHash: newer },
      found
    );
    expect(r.ok).toBe(true);
    const link = await walletLinkFor(db, "profile-a");
    expect(link?.proofTxHash).toBe(newer);
    expect(await db.testnetWalletLink.count()).toBe(1);
  });
});
