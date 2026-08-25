import { cache } from "react";
import { db } from "./db";
import {
  refreshWalletBalanceSnapshots,
  walletBalanceView,
} from "./progressiveEconomy";

/** One request-scoped balance read shared by the persistent header and the
 * Settings page. Without this, Settings could update the chain snapshot only
 * after the header had already rendered an older value in the same response. */
export const synchronizedWalletBalanceView = cache(
  async function synchronizedWalletBalanceView(profileId: string) {
    const existing = await walletBalanceView(db, profileId);
    const stillFresh =
      existing.syncStatus === "current" &&
      existing.observedAt !== null &&
      Date.now() - existing.observedAt.getTime() < 30_000;
    if (stillFresh) return { balances: existing, error: null as string | null };

    const refreshed = await refreshWalletBalanceSnapshots(db, profileId);
    const balances = await walletBalanceView(db, profileId);
    return {
      balances,
      error: refreshed.ok ? null : refreshed.reason,
    };
  }
);
