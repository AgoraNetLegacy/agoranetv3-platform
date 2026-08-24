// Participation Accrual (TOKENOMICS §4; ECONOMIC_STARTING_DEFAULTS §4).
// Scheduled into Phase 4 by owner-delegated decision (2026-07-10,
// BUILD_ORDER scheduling addendum).
//
// PollCoin accrues through positive participation; the guarantee that a
// committed human without money can always earn a voice. Per-profile,
// never per-human (the standing linkage rule: each identity earns its own).
//
// THE FORMULA IS PRIVATE by ratified design: souls see their balance
// grow, never the meter. The constants below are the v0 private weights
//; deliberately NOT rails, deliberately never rendered anywhere.
// What IS public: the input categories (participation, streaks) and the
// ceilings, which are rails. The ceilings are the load-bearing guardrail
//; capped, this is a civic allowance earned by presence, not an
// engagement treadmill. Sentinel anti-farming joins when Sentinel
// exists; until then the ceilings do exactly what the spec says they do.

import { randomUUID } from "crypto";
import type { Tx } from "./db";
import { getRail } from "./rails";
import { grant } from "./economy";
import { queueWalletReward } from "./walletRewards";

// v0 private weights (never published, never rendered).
const BASE_PER_QUALIFYING_ACTION = 1; // uPC

const DAY_MS = 86_400_000;

function utcDayStart(date: Date): Date {
  return new Date(Math.floor(date.getTime() / DAY_MS) * DAY_MS);
}

async function accruedSince(
  tx: Tx,
  profileId: string,
  since: Date,
  kinds: string[]
): Promise<number> {
  const entries = await tx.economyEntry.findMany({
    where: { toProfileId: profileId, kind: { in: kinds }, createdAt: { gte: since } },
    select: { amount: true },
  });
  return entries.reduce((sum, e) => sum + e.amount, 0);
}

async function walletAccruedSince(
  tx: Tx,
  profileId: string,
  since: Date,
  kinds: string[]
): Promise<number> {
  const intents = await tx.tokenTransactionIntent.findMany({
    where: {
      profileId,
      kind: { in: kinds },
      createdAt: { gte: since },
      status: { notIn: ["rejected", "expired", "failed"] },
    },
    select: { amount: true },
  });
  return intents.reduce((sum, intent) => sum + Number(intent.amount), 0);
}

/**
 * Accrue for one qualifying participation action. Call inside the
 * action's transaction, after its fee; so a reply is net-positive for
 * a genuine soul until the day's ceiling saturates, which is the point.
 */
export async function accrueForAction(tx: Tx, profileId: string): Promise<void> {
  const now = new Date();
  const dayStart = utcDayStart(now);
  const weekStart = new Date(dayStart.getTime() - 6 * DAY_MS); // rolling 7 days

  // Serialize this soul's concurrent qualifying actions on today's counter
  // row FIRST; before any read. The upsert compiles to an atomic INSERT …
  // ON CONFLICT DO UPDATE that acquires the row's write lock (held to
  // commit), so two actions racing near the ceiling can no longer both read
  // a pre-grant total and both grant past the cap. Taking the write before
  // the rail/total reads also keeps the ordering deadlock-free (no
  // shared-then-exclusive lock upgrade). The counter also records the day's
  // running accrual for audit.
  await tx.accrualDay.upsert({
    where: { profileId_day: { profileId, day: dayStart } },
    create: { profileId, day: dayStart, totalUpc: 0 },
    update: { totalUpc: { increment: 0 } },
  });

  const [dailyCeiling, weeklyCeiling, streakBonus, streakWeeklyCap] =
    await Promise.all([
      getRail(tx, "accrual.dailyCeilingPc"),
      getRail(tx, "accrual.weeklyCeilingPc"),
      getRail(tx, "accrual.streakBonusPc"),
      getRail(tx, "accrual.streakWeeklyCapPc"),
    ]);

  const profile = await tx.profile.findUnique({ where: { id: profileId } });
  const walletMode = profile?.economyMode === "wallet";

  const accrualKinds = walletMode
    ? ["reward.accrual", "reward.accrual.streak"]
    : ["accrual", "accrual.streak"];
  const totalsSince = walletMode ? walletAccruedSince : accruedSince;
  const todayTotal = await totalsSince(tx, profileId, dayStart, accrualKinds);
  const weekTotal = await totalsSince(tx, profileId, weekStart, accrualKinds);
  let granted = 0;

  // Streak: paid once, on the first qualifying action of a day whose
  // previous UTC day also accrued (consecutive presence).
  if (todayTotal === 0) {
    const yesterdayStart = new Date(dayStart.getTime() - DAY_MS);
    const yesterday = walletMode
      ? await tx.tokenTransactionIntent.findFirst({
          where: {
            profileId,
            kind: { in: accrualKinds },
            status: { notIn: ["rejected", "expired", "failed"] },
            createdAt: { gte: yesterdayStart, lt: dayStart },
          },
        })
      : await tx.economyEntry.findFirst({
          where: {
            toProfileId: profileId,
            kind: { in: accrualKinds },
            createdAt: { gte: yesterdayStart, lt: dayStart },
          },
        });
    if (yesterday) {
      const streakThisWeek = walletMode
        ? await walletAccruedSince(tx, profileId, weekStart, ["reward.accrual.streak"])
        : await accruedSince(tx, profileId, weekStart, ["accrual.streak"]);
      const bonus = Math.min(
        streakBonus,
        streakWeeklyCap - streakThisWeek,
        dailyCeiling - todayTotal,
        weeklyCeiling - weekTotal
      );
      if (bonus > 0) {
        if (walletMode) {
          await queueWalletReward(tx, {
            profileId,
            currency: "PC",
            amount: bonus,
            kind: "reward.accrual.streak",
            idempotencyKey: `reward:accrual-streak:${profileId}:${randomUUID()}`,
          });
        } else {
          await grant(tx, { profileId, currency: "PC", amount: bonus, kind: "accrual.streak" });
        }
        granted += bonus;
      }
    }
  }

  const afterStreakToday = await totalsSince(tx, profileId, dayStart, accrualKinds);
  const afterStreakWeek = await totalsSince(tx, profileId, weekStart, accrualKinds);
  const base = Math.min(
    BASE_PER_QUALIFYING_ACTION,
    dailyCeiling - afterStreakToday,
    weeklyCeiling - afterStreakWeek
  );
  if (base > 0) {
    if (walletMode) {
      await queueWalletReward(tx, {
        profileId,
        currency: "PC",
        amount: base,
        kind: "reward.accrual",
        idempotencyKey: `reward:accrual:${profileId}:${randomUUID()}`,
      });
    } else {
      await grant(tx, { profileId, currency: "PC", amount: base, kind: "accrual" });
    }
    granted += base;
  }

  if (granted > 0) {
    await tx.accrualDay.update({
      where: { profileId_day: { profileId, day: dayStart } },
      data: { totalUpc: { increment: granted } },
    });
  }
}
