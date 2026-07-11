// The public transparency dashboard's books (Phase 7 —
// TREASURY_DASHBOARD_SPEC). One surface, three questions: what came in,
// what went out, what have the operators done.
//
// The dashboard is a VIEW over the money ledger, never a second
// bookkeeping system (§3): every figure re-derives from EconomyEntry
// rows, db:verify re-derives the snapshots, and drift fails loudly.
// The Constitution's must-guardrail is rendered structurally: every
// treasury flow kind MUST map to a category — an unmapped kind throws,
// here and in db:verify, rather than rendering a quiet "misc".
//
// Privacy (§2): aggregates by default; drill-down shows pseudonymized
// entries (no actor of any kind — an economy row's profile ids are
// Phase A operator space and never render). Stipend and reward outflows
// display as AGGREGATES ONLY — itemizing them would out badge holders
// (MODERATION §3 anonymity beats treasury itemization, the one ratified
// exception). Vote-fee entries carry no poll reference by design
// (sealed means sealed), so mid-poll linkage is structurally absent.

import type { PrismaClient } from "@prisma/client";
import type { DbOrTx } from "./db";
import { appendEvent } from "./ledger";

export type FlowDirection = "inflow" | "outflow" | "issuance";

export interface KindInfo {
  category: string;
  direction: FlowDirection;
  /** Aggregate-only: never itemized in drill-down (MODERATION §3). */
  aggregateOnly?: boolean;
}

// Every treasury-touching EconomyEntry kind, categorized (§1.2/§1.3 +
// ECONOMIC_STARTING_DEFAULTS §6 launch budget categories).
export const KIND_CATEGORIES: Record<string, KindInfo> = {
  // Inflows — the fee lattice made visible.
  "fee.discussion": { category: "Creation fees", direction: "inflow" },
  "fee.poll": { category: "Creation fees", direction: "inflow" },
  "fee.circle": { category: "Creation fees", direction: "inflow" },
  "fee.reply": { category: "Reply & vote micro-fees", direction: "inflow" },
  "fee.vote": { category: "Reply & vote micro-fees", direction: "inflow" },
  "tip.cut": { category: "Tip micro-cuts", direction: "inflow" },
  "fee.permanence": { category: "Paid permanence", direction: "inflow" },
  "fee.request": { category: "Social-action fees", direction: "inflow" },
  "fee.dm-thread": { category: "Social-action fees", direction: "inflow" },
  "fee.dm-message": { category: "Social-action fees", direction: "inflow" },
  "penalty.strike": { category: "Rule-violation penalties", direction: "inflow" },
  "deposit.flag": { category: "Deposits held (flag & appeal)", direction: "inflow" },
  "deposit.appeal": { category: "Deposits held (flag & appeal)", direction: "inflow" },
  // Outflows — budget categories (Constitution must-guardrail).
  "reward.moderation": {
    category: "Moderation rewards",
    direction: "outflow",
    aggregateOnly: true,
  },
  "stipend.tribunal": {
    category: "Tribunal stipends",
    direction: "outflow",
    aggregateOnly: true,
  },
  "refund.flag": { category: "Deposit refunds", direction: "outflow" },
  "refund.appeal": { category: "Deposit refunds", direction: "outflow" },
  // Issuance — the internal era's faucet, accounted honestly (grants
  // mint from issuance, not the treasury; shown in their own section so
  // the money story has no dark corners).
  "grant.welcome": { category: "Welcome Grants (issuance)", direction: "issuance" },
  "grant.seed": { category: "Welcome Grants (issuance)", direction: "issuance" },
  "grant.orientation": { category: "Welcome Grants (issuance)", direction: "issuance" },
  "grant.first-action": { category: "Welcome Grants (issuance)", direction: "issuance" },
  "grant.hatch": { category: "Welcome Grants (issuance)", direction: "issuance" },
  "grant.test": { category: "Test faucet (issuance, dev only)", direction: "issuance" },
  accrual: { category: "Participation accrual (issuance)", direction: "issuance" },
  "accrual.streak": { category: "Participation accrual (issuance)", direction: "issuance" },
  // Profile→profile flows the treasury only brushes (the cut is above).
  tip: { category: "Tips (soul to soul — treasury takes only the cut)", direction: "issuance" },
};

export function kindInfo(kind: string): KindInfo {
  const info = KIND_CATEGORIES[kind];
  if (!info) {
    throw new Error(
      `Uncategorized economy kind "${kind}" — the Constitution's ` +
        "budgeted-categories guardrail forbids flows without a category. " +
        "Map it in lib/transparency.ts."
    );
  }
  return info;
}

export interface CategoryTotals {
  [category: string]: { PC: number; G: number; entries: number };
}

export interface Books {
  balances: { PC: number; G: number };
  inflows: CategoryTotals;
  outflows: CategoryTotals;
  issuance: CategoryTotals;
}

/** Re-derive the whole money story from the entry rows. With `asOf`,
 *  flows are cut at that moment and the treasury balances re-derive
 *  from entries alone — how db:verify re-checks a snapshot. */
export async function computeBooks(db: DbOrTx, asOf?: Date): Promise<Books> {
  const balances = { PC: 0, G: 0 };
  if (asOf) {
    const entries = await db.economyEntry.findMany({
      where: { createdAt: { lte: asOf } },
      select: { currency: true, amount: true, fromTreasury: true, toTreasury: true },
    });
    for (const e of entries) {
      const c = e.currency as "PC" | "G";
      if (e.toTreasury) balances[c] += e.amount;
      if (e.fromTreasury) balances[c] -= e.amount;
    }
    balances.PC = Math.round(balances.PC * 1e6) / 1e6;
    balances.G = Math.round(balances.G * 1e6) / 1e6;
  } else {
    const treasury = await db.treasuryBalance.findMany();
    for (const t of treasury) balances[t.currency as "PC" | "G"] = t.amount;
  }

  const grouped = await db.economyEntry.groupBy({
    by: ["kind", "currency"],
    _sum: { amount: true },
    _count: true,
    ...(asOf ? { where: { createdAt: { lte: asOf } } } : {}),
  });

  const inflows: CategoryTotals = {};
  const outflows: CategoryTotals = {};
  const issuance: CategoryTotals = {};
  for (const g of grouped) {
    const info = kindInfo(g.kind);
    // Tips are profile→profile; only the cut (its own kind) touches the
    // treasury — skip the pass-through so the treasury books stay the
    // treasury's.
    if (g.kind === "tip") continue;
    const bucket =
      info.direction === "inflow" ? inflows : info.direction === "outflow" ? outflows : issuance;
    const cell = (bucket[info.category] ??= { PC: 0, G: 0, entries: 0 });
    cell[g.currency as "PC" | "G"] += g._sum.amount ?? 0;
    cell.entries += g._count;
  }
  return { balances, inflows, outflows, issuance };
}

export function utcDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** The daily snapshot (§6.2, owner-ratified cadence): generated on the
 *  platform's daily cycle — lazily, on first traffic of the UTC day —
 *  timestamped, ledger-evented, and re-derivable. The underlying ledger
 *  stays live; only these rendered aggregates are periodic. */
export async function ensureDailySnapshot(db: PrismaClient) {
  const day = utcDay();
  const existing = await db.treasurySnapshot.findUnique({ where: { day } });
  if (existing) return existing;

  const books = await computeBooks(db);
  return db.$transaction(async (tx) => {
    const again = await tx.treasurySnapshot.findUnique({ where: { day } });
    if (again) return again;
    const snapshot = await tx.treasurySnapshot.create({
      data: {
        day,
        balances: JSON.stringify(books.balances),
        inflows: JSON.stringify(books.inflows),
        outflows: JSON.stringify(books.outflows),
      },
    });
    await appendEvent(tx, {
      actorType: "system",
      eventType: "treasury.snapshot",
      payload: {
        day,
        balances: books.balances,
        inflowCategories: Object.keys(books.inflows).length,
        outflowCategories: Object.keys(books.outflows).length,
      },
    });
    return snapshot;
  });
}

/** Public moderation stats (BUILD_ORDER Phase 7: "moderation stats" —
 *  aggregates only; nothing here can identify a moderator, a reporter,
 *  or an accused). */
export async function moderationStats(db: PrismaClient) {
  const [
    casesByStatus,
    casesByOutcome,
    casesByTier,
    flagsByStatus,
    termsServed,
    appeals,
    tribunalSeats,
    resolvedTimes,
  ] = await Promise.all([
    db.modCase.groupBy({ by: ["status"], _count: true }),
    db.modCase.groupBy({ by: ["outcome"], _count: true, where: { outcome: { not: null } } }),
    db.modCase.groupBy({ by: ["tier"], _count: true }),
    db.flag.groupBy({ by: ["status"], _count: true }),
    db.badgeTerm.count(),
    db.modCase.count({ where: { appealOfId: { not: null } } }),
    db.tribunalSeat.count(),
    db.modCase.findMany({
      where: { resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
    }),
  ]);

  const avgHoursToResolve =
    resolvedTimes.length > 0
      ? resolvedTimes.reduce(
          (s, c) => s + (c.resolvedAt!.getTime() - c.createdAt.getTime()) / 3_600_000,
          0
        ) / resolvedTimes.length
      : null;

  return {
    casesByStatus: Object.fromEntries(casesByStatus.map((g) => [g.status, g._count])),
    casesByOutcome: Object.fromEntries(casesByOutcome.map((g) => [g.outcome!, g._count])),
    casesByTier: Object.fromEntries(casesByTier.map((g) => [`tier ${g.tier}`, g._count])),
    flagsByStatus: Object.fromEntries(flagsByStatus.map((g) => [g.status, g._count])),
    badgeTermsServed: termsServed,
    appeals,
    tribunalSeatsFilled: tribunalSeats,
    avgHoursToResolve,
  };
}
