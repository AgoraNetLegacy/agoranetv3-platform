// The internal economy (TOKENOMICS_SPEC.md). Two currencies, two jobs:
// PollCoin pays fees and stakes support; Gratium is earned appreciation,
// spent on tips and permanence. Both live as per-profile internal
// balances — a soul's two faces are never bridged. Every flow is a
// double-entry EconomyEntry; balances are always the sum of entries,
// and db:verify re-derives them (conservation, loudly).
//
// Grants mint from "issuance" (the internal era's accounted faucet);
// everything else moves value between profiles and the treasury. Money
// never buys outcome weight — nothing in this module touches a tally.

import type { PrismaClient } from "@prisma/client";
import type { DbOrTx, Tx } from "./db";
import { getRail } from "./rails";

export type Currency = "PC" | "G";

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

export type EconomyResult = { ok: true } | { ok: false; reason: string };

/** Debit a profile into the treasury (fees, deposits). */
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
  await ensureBalance(tx, input.profileId, input.currency);
  const balance = await balanceOf(tx, input.profileId, input.currency);
  if (balance < input.amount) {
    return {
      ok: false,
      reason: `Insufficient ${input.currency === "PC" ? "PollCoin" : "Gratium"} (${balance.toFixed(2)}u of ${input.amount}u) — participation costs; the earnable path covers committed souls.`,
    };
  }
  await tx.balance.update({
    where: { profileId_currency: { profileId: input.profileId, currency: input.currency } },
    data: { amount: { decrement: input.amount } },
  });
  await tx.treasuryBalance.upsert({
    where: { currency: input.currency },
    create: { currency: input.currency, amount: input.amount },
    update: { amount: { increment: input.amount } },
  });
  await tx.economyEntry.create({
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
  return { ok: true };
}

/**
 * The single door money leaves the treasury by (PHASE_8_7_SPEC §3,
 * Slice 1).
 *
 * The Constitution's Appendix A carries a must-guardrail — "the treasury
 * MUST NOT spend outside budgeted categories" — and TREASURY_DASHBOARD
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
 * Refuses (never throws — callers get a reason) when the category is
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

  const category = await tx.budgetCategory.findUnique({
    where: { name: input.budgetCategory },
  });
  if (!category) {
    return {
      ok: false,
      reason: `No budget category "${input.budgetCategory}" — the treasury may not spend outside budgeted categories (Constitution, Appendix A).`,
    };
  }
  if (!category.active) {
    return {
      ok: false,
      reason: `Budget category "${input.budgetCategory}" is inactive — the treasury may not spend outside active budgeted categories (Constitution, Appendix A).`,
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
  await tx.economyEntry.create({
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
  return { ok: true };
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
 * both mint — the second insert collides with P2002 and its transaction
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
 * rail taken from the gross — nearly all appreciation reaches the soul.
 */
export async function tip(
  db: PrismaClient,
  input: { postId: string; tipperProfileId: string; amount: number }
): Promise<EconomyResult> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, reason: "A tip must be a positive amount." };
  }
  const post = await db.post.findUnique({ where: { id: input.postId } });
  if (!post) return { ok: false, reason: "No such post." };
  if (post.authorProfileId === input.tipperProfileId) {
    return { ok: false, reason: "Appreciation flows outward — no self-tipping." };
  }
  const cutPercent = await getRail(db, "economy.tipCutPercent");

  try {
    return await db.$transaction(async (tx) => {
      await ensureBalance(tx, input.tipperProfileId, "G");
      const balance = await balanceOf(tx, input.tipperProfileId, "G");
      if (balance < input.amount) {
        return {
          ok: false as const,
          reason: `Insufficient Gratium (${balance.toFixed(2)}u) — appreciation is costly on purpose.`,
        };
      }
      const cut = Math.round(input.amount * cutPercent) / 100;
      const net = input.amount - cut;

      await tx.balance.update({
        where: { profileId_currency: { profileId: input.tipperProfileId, currency: "G" } },
        data: { amount: { decrement: input.amount } },
      });
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
      // Giving is positive participation (TOKENOMICS §4) — it accrues.
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
 * journey only — the Alias's grant is the hatch grant (ECONOMIC §3).
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
  // transaction rolls back — no double mint; the retry sees the claim and
  // skips.
  const already = await tx.grantClaim.findUnique({
    where: { profileId_kind: { profileId, kind: "grant.first-action" } },
  });
  if (already) return;
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
