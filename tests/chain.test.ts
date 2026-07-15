import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb } from "./helpers/testDb";

const { url } = createTestDb("chain");
process.env.DATABASE_URL = url;
process.env.CARDANO_NETWORK = "preprod";

import { PrismaClient } from "@prisma/client";
import { cardanoNetwork, recordWalletLink, walletLinkFor } from "../lib/chain";

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
