import { describe, expect, it } from "vitest";
import type { DbOrTx } from "../lib/db";
import { getRail } from "../lib/rails";

function railDb(values: Record<string, number>): DbOrTx {
  return {
    rail: {
      findUnique: async ({ where }: { where: { key: string } }) =>
        where.key in values ? { key: where.key, value: values[where.key] } : null,
    },
  } as unknown as DbOrTx;
}

describe("chamber rails", () => {
  // The dual-token signature is two rails, read as two amounts. A combined
  // "unified cost" rail once collapsed them, made the tokens substitutable,
  // and halved a chamber's real price; getRail must never synthesize one.
  it("reads each half of the dual-token creation fee on its own", async () => {
    const db = railDb({
      "chamber.creationFeePc": 20,
      "chamber.creationFeeG": 20,
    });
    await expect(getRail(db, "chamber.creationFeePc")).resolves.toBe(20);
    await expect(getRail(db, "chamber.creationFeeG")).resolves.toBe(20);
  });

  it("reads each half of the dual-token workshop micro-fee on its own", async () => {
    const db = railDb({ "chamber.postFeePc": 1, "chamber.postFeeG": 1 });
    await expect(getRail(db, "chamber.postFeePc")).resolves.toBe(1);
    await expect(getRail(db, "chamber.postFeeG")).resolves.toBe(1);
  });

  it("refuses to derive a retired combined cost from the two halves", async () => {
    const db = railDb({
      "chamber.creationFeePc": 20,
      "chamber.creationFeeG": 20,
      "chamber.postFeePc": 1,
      "chamber.postFeeG": 1,
    });
    await expect(getRail(db, "chamber.creationCost")).rejects.toThrow("Rail not seeded");
    await expect(getRail(db, "chamber.postCost")).rejects.toThrow("Rail not seeded");
  });
});
