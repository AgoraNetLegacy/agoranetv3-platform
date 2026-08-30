import { describe, expect, it } from "vitest";
import type { DbOrTx } from "../lib/db";
import { getRail } from "../lib/rails";

function legacyRailDb(values: Record<string, number>): DbOrTx {
  return {
    rail: {
      findUnique: async ({ where }: { where: { key: string } }) =>
        where.key in values ? { key: where.key, value: values[where.key] } : null,
    },
  } as unknown as DbOrTx;
}

describe("chamber rail rollout bridge", () => {
  it("keeps the legacy 20 PC and 20 G creation rails at one 20-total cost", async () => {
    const db = legacyRailDb({
      "chamber.creationFeePc": 20,
      "chamber.creationFeeG": 20,
    });
    await expect(getRail(db, "chamber.creationCost")).resolves.toBe(20);
  });

  it("keeps the legacy 1 PC plus 1 G workshop fee at a 2-total cost", async () => {
    const db = legacyRailDb({
      "chamber.postFeePc": 1,
      "chamber.postFeeG": 1,
    });
    await expect(getRail(db, "chamber.postCost")).resolves.toBe(2);
  });
});
