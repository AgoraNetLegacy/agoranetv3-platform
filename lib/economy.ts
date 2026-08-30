// The internal economy (TOKENOMICS_SPEC.md). Two currencies, two jobs:
// PollCoin pays fees and stakes support; Gratium is earned appreciation,
// spent on tips and permanence. Both live as per-profile internal
// balances; a soul's two identities are never bridged. Every flow is a
// double-entry EconomyEntry; balances are always the sum of entries,
// and db:verify re-derives them (conservation, loudly).
//
// Grants mint from "issuance" (the internal era's accounted faucet);
// everything else moves value between profiles and the treasury. Money
// never buys outcome weight; nothing in this module touches a tally.

import type { PrismaClient } from "@prisma/client";
import type { DbOrTx, Tx } from "./db";
import { getRail } from "./rails";

export type Currency = "PC" | "G";

/**
 * PC and G are interchangeable for unified participation costs. Keep the
 * conversion in one exported table so eligibility, charging, tests, and UI
 * displays cannot quietly invent different arithmetic.
 */
export const UNIFIED_CURRENCY_RATES: Readonly<Record<Currency, number>> = {
  PC: 1,
  G: 1,
};

export interface UnifiedBalance {
  total: number;
  components: Record<Currency, { balance: number; rate: number; units: number }>;
}

async function ensureBalance(tx: Tx, profileId: string, currency: Currency) {
  await tx.balance.upsert({
    where: { profileId_currency: { profileId, currency } },
    create: { profileId, currency, amount: 0 },
    update: {},
  });
}

export async function balanceOf(
  db: DbOrTx,
  profileId: string,
  currency: Currency
): Promise<number> {
  const row = await db.balance.findUnique({
    where: { profileId_currency: { profileId, currency } },
  });
  return row?.amount ?? 0;
}

/** Canonical converted balance used by every unified participation check. */
export async function unifiedBalanceOf(
  db: DbOrTx,
  profileId: string
): Promise<UnifiedBalance> {
  const rows = await db.balance.findMany({
    where: { profileId, currency: { in: ["PC", "G"] } },
    select: { currency: true, amount: true },
  });
  const balances = new Map(rows.map((row) => [row.currency, row.amount]));
  const pc = balances.get("PC") ?? 0;
  const g = balances.get("G") ?? 0;
  const components = {
    PC: { balance: pc, rate: UNIFIED_CURRENCY_RATES.PC, units: pc * UNIFIED_CURRENCY_RATES.PC },
    G: { balance: g, rate: UNIFIED_CURRENCY_RATES.G, units: g * UNIFIED_CURRENCY_RATES.G },
  };
  return { total: components.PC.units + components.G.units, components };
}

export function unifiedInsufficientFundsReason(
  balance: UnifiedBalance,
  required: number
): string {
  return (
    `Insufficient combined PC/G balance: ${balance.total.toFixed(2)} of ` +
    `${required.toFixed(2)} available ` +
    `(PC ${balance.components.PC.balance.toFixed(2)} + G ${balance.components.G.balance.toFixed(2)}).`
  );
}

export function canAffordUnifiedCost(
  balance: UnifiedBalance,
  required: number
): boolean {
  return balance.total + Number.EPSILON >= required;
}

export type EconomyResult =
  | { ok: true; entryId?: string }
  | { ok: false; reason: string };

export async function creditsModeAvailable(
  db: DbOrTx,
  profileId: string
): Promise<EconomyResult> {
  // PC/G are the canonical application balances in both modes. Wallet mode
  // is an external settlement rail, not a second set of currencies; until a
  // wallet rail is available for a given action, its ledger entry remains in
  // the same internal balance used by Credits mode.
  void db;
  void profileId;
  return { ok: true };
}

/** Debit a profile into the treasury (fees, deposits). */
/**
 * Atomically debit a profile's balance. The conditional UPDATE (WHERE
 * amount >= X) is the check AND the decrement in one statement, so two
 * concurrent debits cannot both pass a stale read and overspend under
 * Postgres READ COMMITTED; the check-then-act class Gate #25 closed
 * elsewhere, applied here to balances. (SQLite's single writer masks this
 * in dev/test, which is why it never surfaced.) Returns true if debited,
 * false if the balance could not cover it.
 */
export async function debitBalance(
  tx: Tx,
  profileId: string,
  currency: Currency,
  amount: number
): Promise<boolean> {
  if (amount <= 0) return true;
  await ensureBalance(tx, profileId, currency);
  const result = await tx.balance.updateMany({
    where: { profileId, currency, amount: { gte: amount } },
    data: { amount: { decrement: amount } },
  });
  return result.count === 1;
}

export async function chargeToTreasury(
  tx: Tx,
  input: {
    profileId: string;
    currency: Currency;
    amount: number;
    kind: string;
    refType?: string;
    refId?: string;
  }
): Promise<EconomyResult> {
  if (input.amount <= 0) return { ok: true };
  if (!(await debitBalance(tx, input.profileId, input.currency, input.amount))) {
    const balance = await balanceOf(tx, input.profileId, input.currency);
    return {
      ok: false,
      reason: `Insufficient ${input.currency} balance: ${balance.toFixed(2)} of ${input.amount.toFixed(2)} units available.`,
    };
  }
  await tx.treasuryBalance.upsert({
    where: { currency: input.currency },
    create: { currency: input.currency, amount: input.amount },
    update: { amount: { increment: input.amount } },
  });
  const entry = await tx.economyEntry.create({
    data: {
      kind: input.kind,
      currency: input.currency,
      amount: input.amount,
      fromProfileId: input.profileId,
      toTreasury: true,
      refType: input.refType,
      refId: input.refId,
    },
  });
  return { ok: true, entryId: entry.id };
}

/**
 * Charge one participation cost from the canonical converted PC/G balance.
 * PC is consumed first and G covers the remainder; that deterministic order
 * keeps receipts reproducible while both currencies remain equally valuable.
 * The caller normally owns an outer transaction. If a concurrent debit wins
 * between planning and settlement, any partial debit is restored before the
 * accurate insufficient-funds result is returned.
 */
export async function chargeUnifiedToTreasury(
  tx: Tx,
  input: {
    profileId: string;
    amount: number;
    kind: string;
    refType?: string;
    refId?: string;
  }
): Promise<EconomyResult> {
  if (input.amount <= 0) return { ok: true };
  const available = await unifiedBalanceOf(tx, input.profileId);
  if (!canAffordUnifiedCost(available, input.amount)) {
    return { ok: false, reason: unifiedInsufficientFundsReason(available, input.amount) };
  }

  let remaining = input.amount;
  const debits: { currency: Currency; amount: number }[] = [];
  for (const currency of ["PC", "G"] as const) {
    if (remaining <= Number.EPSILON) break;
    const component = available.components[currency];
    const unifiedUnits = Math.min(component.units, remaining);
    const currencyAmount = unifiedUnits / component.rate;
    if (currencyAmount <= Number.EPSILON) continue;
    if (!(await debitBalance(tx, input.profileId, currency, currencyAmount))) {
      for (const debit of debits) {
        await tx.balance.update({
          where: {
            profileId_currency: { profileId: input.profileId, currency: debit.currency },
          },
          data: { amount: { increment: debit.amount } },
        });
      }
      const current = await unifiedBalanceOf(tx, input.profileId);
      return { ok: false, reason: unifiedInsufficientFundsReason(current, input.amount) };
    }
    debits.push({ currency, amount: currencyAmount });
    remaining -= unifiedUnits;
  }

  if (remaining > Number.EPSILON) {
    for (const debit of debits) {
      await tx.balance.update({
        where: {
          profileId_currency: { profileId: input.profileId, currency: debit.currency },
        },
        data: { amount: { increment: debit.amount } },
      });
    }
    const current = await unifiedBalanceOf(tx, input.profileId);
    return { ok: false, reason: unifiedInsufficientFundsReason(current, input.amount) };
  }

  let firstEntryId: string | undefined;
  for (const debit of debits) {
    await tx.treasuryBalance.upsert({
      where: { currency: debit.currency },
      create: { currency: debit.currency, amount: debit.amount },
      update: { amount: { increment: debit.amount } },
    });
    const entry = await tx.economyEntry.create({
      data: {
        kind: input.kind,
        currency: debit.currency,
        amount: debit.amount,
        fromProfileId: input.profileId,
        toTreasury: true,
        refType: input.refType,
        refId: input.refId,
      },
    });
    firstEntryId ??= entry.id;
  }
  return { ok: true, entryId: firstEntryId };
}

/**
 * The single door money leaves the treasury by (PHASE_8_7_SPEC §3,
 * Slice 1).
 *
 * The Constitution's Appendix A carries a must-guardrail; "the treasury
 * MUST NOT spend outside budgeted categories"; and TREASURY_DASHBOARD
 * §1.3 promises it is "rendered structurally: an outflow without a
 * budget category cannot exist." Until this function existed that was an
 * unbuilt promise: outflows were hand-rolled at each call site, so there
 * was no single place the rule could bind. Now there is exactly one.
 *
 * The enforcement lives HERE rather than at the admin console on
 * purpose. A console check guards the surfaces we remembered to guard;
 * a primitive that refuses guards the ones a future session forgets.
 * That is the same reasoning as ADMIN_OPS §1's allowlist: the safety is
 * the absence of a path, not the presence of a check.
 *
 * Refuses (never throws; callers get a reason) when the category is
 * missing, unknown, or inactive. Category caps are NOT enforced yet:
 * the three shipped categories are uncapped by design (their amounts are
 * already rail-governed per-action), and FUND_INTEGRITY_SPEC §3.6's
 * proposal to promote cap ceilings to Class 2 is not ratified. The
 * column exists; the rule does not. Flagged, not invented.
 */
export async function payFromTreasury(
  tx: Tx,
  input: {
    profileId: string;
    currency: Currency;
    amount: number;
    kind: string;
    budgetCategory: string;
    refType?: string;
    refId?: string;
  }
): Promise<EconomyResult> {
  if (input.amount <= 0) return { ok: true };
  if (input.kind !== "claim.refund") {
    const mode = await creditsModeAvailable(tx, input.profileId);
    if (!mode.ok) return mode;
  }

  const category = await tx.budgetCategory.findUnique({
    where: { name: input.budgetCategory },
  });
  if (!category) {
    return {
      ok: false,
      reason: `No budget category "${input.budgetCategory}"; the treasury may not spend outside budgeted categories (Constitution, Appendix A).`,
    };
  }
  if (!category.active) {
    return {
      ok: false,
      reason: `Budget category "${input.budgetCategory}" is inactive; the treasury may not spend outside active budgeted categories (Constitution, Appendix A).`,
    };
  }

  await ensureBalance(tx, input.profileId, input.currency);
  await tx.treasuryBalance.upsert({
    where: { currency: input.currency },
    create: { currency: input.currency, amount: -input.amount },
    update: { amount: { decrement: input.amount } },
  });
  await tx.balance.update({
    where: { profileId_currency: { profileId: input.profileId, currency: input.currency } },
    data: { amount: { increment: input.amount } },
  });
  const entry = await tx.economyEntry.create({
    data: {
      kind: input.kind,
      currency: input.currency,
      amount: input.amount,
      fromTreasury: true,
      toProfileId: input.profileId,
      budgetCategory: category.name,
      refType: input.refType,
      refId: input.refId,
    },
  });
  return { ok: true, entryId: entry.id };
}

/** Mint a grant from issuance to a profile (Welcome Grant milestones). */
export async function grant(
  tx: Tx,
  input: {
    profileId: string;
    currency: Currency;
    amount: number;
    kind: string;
  }
): Promise<void> {
  if (input.amount <= 0) return;
  await ensureBalance(tx, input.profileId, input.currency);
  await tx.balance.update({
    where: { profileId_currency: { profileId: input.profileId, currency: input.currency } },
    data: { amount: { increment: input.amount } },
  });
  await tx.economyEntry.create({
    data: {
      kind: input.kind,
      currency: input.currency,
      amount: input.amount,
      toProfileId: input.profileId,
    },
  });
}

/**
 * Mint a one-time grant atomically. The GrantClaim insert IS the mutex:
 * (profileId, kind) is the primary key, so two concurrent callers can never
 * both mint; the second insert collides with P2002 and its transaction
 * rolls back (the lib/gate.ts nullifier pattern). A plain
 * grantAlreadyGiven()-then-grant() is a SELECT-then-INSERT race that mints
 * issuance N× under concurrent requests.
 *
 * Runs inside the caller's transaction. Callers that OWN the whole
 * transaction should wrap it in try/catch and treat P2002 as "already
 * granted" (no double issue, no error surfaced). Callers that nest this in
 * a larger action transaction should pre-check with a GrantClaim lookup so
 * the constraint only trips on a genuine race (see maybeFirstActionGrant).
 */
export async function grantOnce(
  tx: Tx,
  input: { profileId: string; currency: Currency; amount: number; kind: string }
): Promise<void> {
  await tx.grantClaim.create({
    data: { profileId: input.profileId, kind: input.kind },
  });
  await grant(tx, input);
}

/** Has this profile already received a given one-time grant? */
export async function grantAlreadyGiven(
  db: DbOrTx,
  profileId: string,
  kind: string
): Promise<boolean> {
  const existing = await db.economyEntry.findFirst({
    where: { kind, toProfileId: profileId },
  });
  return existing !== null;
}

/**
 * A tip: Gratium from reader to author, with the treasury micro-cut
 * rail taken from the gross; nearly all appreciation reaches the soul.
 */
export async function tip(
  db: PrismaClient,
  input: { postId: string; tipperProfileId: string; amount: number }
): Promise<EconomyResult> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, reason: "A tip must be a positive amount." };
  }
  const mode = await creditsModeAvailable(db, input.tipperProfileId);
  if (!mode.ok) return mode;
  const post = await db.post.findUnique({ where: { id: input.postId } });
  if (!post) return { ok: false, reason: "No such post." };
  if (post.authorProfileId === input.tipperProfileId) {
    return { ok: false, reason: "Appreciation flows outward; no self-tipping." };
  }
  const cutPercent = await getRail(db, "economy.tipCutPercent");

  try {
    return await db.$transaction(async (tx) => {
      const cut = Math.round(input.amount * cutPercent) / 100;
      const net = input.amount - cut;

      if (!(await debitBalance(tx, input.tipperProfileId, "G", input.amount))) {
        const balance = await balanceOf(tx, input.tipperProfileId, "G");
        return {
          ok: false as const,
          reason: `Insufficient Gratium (${balance.toFixed(2)}u); appreciation is costly on purpose.`,
        };
      }
      await ensureBalance(tx, post.authorProfileId, "G");
      await tx.balance.update({
        where: { profileId_currency: { profileId: post.authorProfileId, currency: "G" } },
        data: { amount: { increment: net } },
      });
      await tx.treasuryBalance.upsert({
        where: { currency: "G" },
        create: { currency: "G", amount: cut },
        update: { amount: { increment: cut } },
      });
      await tx.economyEntry.create({
        data: {
          kind: "tip",
          currency: "G",
          amount: net,
          fromProfileId: input.tipperProfileId,
          toProfileId: post.authorProfileId,
          refType: "post",
          refId: post.id,
        },
      });
      await tx.economyEntry.create({
        data: {
          kind: "tip.cut",
          currency: "G",
          amount: cut,
          fromProfileId: input.tipperProfileId,
          toTreasury: true,
          refType: "post",
          refId: post.id,
        },
      });
      await tx.tip.create({
        data: {
          postId: post.id,
          tipperProfileId: input.tipperProfileId,
          amount: input.amount,
        },
      });
      // Giving is positive participation (TOKENOMICS §4); it accrues.
      const { accrueForAction } = await import("./accrual");
      await accrueForAction(tx, input.tipperProfileId);
      // Quiet inbox: tips on one post collapse into one updating entry.
      const { notify } = await import("./notifications");
      const stats = await tx.tip.findMany({ where: { postId: post.id } });
      const totalNow = stats.reduce((s, t) => s + t.amount, 0);
      await notify(tx, {
        profileId: post.authorProfileId,
        tier: "quiet",
        category: "tip",
        title: "Your contribution was tipped",
        body: `${totalNow.toFixed(2)} G from ${new Set(stats.map((t) => t.tipperProfileId)).size} unique tipper(s) so far.`,
        refType: "post",
        refId: post.id,
        aggregationKey: `tip:${post.id}`,
      });
      return { ok: true as const };
    });
  } catch (err) {
    throw err;
  }
}

/**
 * Welcome Grant milestone: first action completed (Stage 6). True Self
 * journey only; the Alias's grant is the hatch grant (ECONOMIC §3).
 * Call after a successful fee-bearing action, inside its transaction.
 */
export async function maybeFirstActionGrant(
  tx: Tx,
  profileId: string
): Promise<void> {
  const profile = await tx.profile.findUnique({ where: { id: profileId } });
  if (!profile || profile.face !== "TRUE_SELF") return;
  // Pre-check the claim so the constraint does NOT trip on every action
  // after the first (a P2002 here would abort the caller's whole action
  // transaction). On a genuine concurrent-first-action race the pre-check
  // misses, the losing grantOnce insert collides, and that action's
  // transaction rolls back; no double mint; the retry sees the claim and
  // skips.
  const already = await tx.grantClaim.findUnique({
    where: { profileId_kind: { profileId, kind: "grant.first-action" } },
  });
  if (already) return;
  if (profile.economyMode === "wallet") {
    const amount = await getRail(tx, "grant.firstAction.g");
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error("Wallet-mode first-action rewards require a positive whole dGRA rail.");
    }
    // GrantClaim remains the one-time milestone mutex. The value itself is
    // queued to the linked wallet; no internal Gratium balance is touched.
    await tx.grantClaim.create({
      data: { profileId, kind: "grant.first-action" },
    });
    const { queueWalletReward } = await import("./walletRewards");
    await queueWalletReward(tx, {
      profileId,
      currency: "G",
      amount,
      kind: "reward.first-action",
      idempotencyKey: `reward:first-action:${profileId}`,
      refType: "profile-milestone",
      refId: profileId,
    });
    return;
  }
  await grantOnce(tx, {
    profileId,
    currency: "G",
    amount: await getRail(tx, "grant.firstAction.g"),
    kind: "grant.first-action",
  });
}

/** Public appreciation stats for a post: totals and breadth, never names. */
export async function tipStats(db: DbOrTx, postId: string) {
  const tips = await db.tip.findMany({ where: { postId } });
  return {
    total: tips.reduce((sum, t) => sum + t.amount, 0),
    uniqueTippers: new Set(tips.map((t) => t.tipperProfileId)).size,
  };
}
