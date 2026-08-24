// Reconcile wallet-paid product actions after a tab closes or a web process
// restarts. This performs no signing and holds no key; it verifies submitted
// public hashes and commits already-paid drafts.

import { db } from "../../lib/db";
import { finalizeWalletPost } from "../../lib/walletActions";
import { walletModeActivationReady } from "../../lib/progressiveEconomy";
import { transitionTokenIntent } from "../../lib/tokenIntents";

async function main() {
  if (!walletModeActivationReady()) {
    throw new Error(
      "Wallet action reconciliation is disabled. Enable all Wallet-mode testnet flags first."
    );
  }
  const expiredDrafts = await db.walletActionDraft.findMany({
    where: { status: "awaiting_wallet_approval", expiresAt: { lt: new Date() } },
    select: { id: true, transactionIntentId: true },
    take: 100,
  });
  let expired = 0;
  for (const draft of expiredDrafts) {
    await db.$transaction(async (tx) => {
      const result = await transitionTokenIntent(tx, {
        id: draft.transactionIntentId,
        to: "expired",
      });
      if (!result.ok) return;
      await tx.walletActionDraft.updateMany({
        where: { id: draft.id, status: "awaiting_wallet_approval" },
        data: { status: "expired" },
      });
      expired += 1;
    });
  }
  const drafts = await db.walletActionDraft.findMany({
    where: { kind: "discussion.post", status: "submitted" },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  let confirmed = 0;
  let pending = 0;
  let review = 0;
  for (const draft of drafts) {
    const result = await finalizeWalletPost(db, {
      profileId: draft.profileId,
      intentId: draft.transactionIntentId,
    });
    if (result.ok) confirmed += 1;
    else if (result.retryable) pending += 1;
    else review += 1;
  }
  console.log(
    JSON.stringify({ expired, scanned: drafts.length, confirmed, pending, review }, null, 2)
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
