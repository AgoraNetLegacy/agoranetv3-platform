// Rails — every number is data, never a literal (build law). Values are
// the ratified v0 TEST SCHEDULE from Economics/ECONOMIC_STARTING_DEFAULTS.md
// (units: u, where 1u = one reply; all of it expires at the Phase 9
// real-money re-review). Bounds policy: poll-adjustable within [¼×, 4×]
// of the shipped default unless a spec says otherwise.
//
// Phase 1 seeds only the rails its features name. Fee rails are seeded as
// data now; actual balance debits wire up in Phase 4, when internal
// balances exist ("every ratified fee wired" — BUILD_ORDER Phase 4).

import type { DbOrTx } from "./db";

export interface RailDefault {
  key: string;
  value: number;
  unit: "uPC" | "uG" | "minutes";
  boundMin?: number; // defaults to ¼× value
  boundMax?: number; // defaults to 4× value
  description: string;
}

export const RAIL_DEFAULTS: RailDefault[] = [
  {
    key: "discussion.replyFee",
    value: 1,
    unit: "uPC",
    description:
      "Reply micro-fee — the anchor unit (participation-cost rule, TOKENOMICS §1). Fee-bearing from Phase 1; debits wire up with Phase 4's internal balances.",
  },
  {
    key: "discussion.graceWindowMinutes",
    value: 15,
    unit: "minutes",
    description:
      "Grace window for typo repair in permanent spaces, with visible edit history; the record locks when it closes (DISCUSSIONS §8).",
  },
  {
    key: "moderation.flagDeposit",
    value: 5,
    unit: "uPC",
    description:
      "Refundable flag deposit (participation-cost rule). Refunded on upheld and good-faith declined; forfeited on bad-faith/pattern rulings. Wires up with Phase 4 balances; flagging is never blocked by an empty balance.",
  },
];

/** Read one rail's current value. Throws if the rail was never seeded —
 *  a missing rail is a build error, not a case to default silently. */
export async function getRail(db: DbOrTx, key: string): Promise<number> {
  const rail = await db.rail.findUnique({ where: { key } });
  if (!rail) throw new Error(`Rail not seeded: ${key}`);
  return rail.value;
}
