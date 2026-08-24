// Isolated fake-asset reward distributor for Wallet mode. The web app queues
// intents; this process alone imports the testnet mint wallet. Prepared work
// is atomically leased before minting, and submitted hashes resume after a
// restart without creating a replacement transaction.

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  if (process.env.WALLET_MODE_TESTNET_ENABLED !== "true") {
    throw new Error("WALLET_MODE_TESTNET_ENABLED must be true.");
  }
  if (process.env.WALLET_REWARDS_TESTNET_ENABLED !== "true") {
    throw new Error("WALLET_REWARDS_TESTNET_ENABLED must be true.");
  }
  const [{ db }, { mintDemoAssetToAddress }, rewards] = await Promise.all([
    import("../../lib/db"),
    import("../../lib/chainMint"),
    import("../../lib/walletRewards"),
  ]);

  const submitted = await db.tokenTransactionIntent.findMany({
    where: { kind: { startsWith: "reward." }, status: "submitted" },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  let confirmedCount = 0;
  for (const intent of submitted) {
    const result = await rewards.confirmWalletReward(db, intent.id);
    if (result.ok) confirmedCount++;
  }

  const prepared = await db.tokenTransactionIntent.findMany({
    where: { kind: { startsWith: "reward." }, status: "prepared" },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  let submittedCount = 0;
  let reconciliationCount = 0;
  for (const intent of prepared) {
    const acquired = await rewards.acquireWalletReward(db, intent.id);
    if (!acquired) continue;
    try {
      if (!intent.destinationWalletScope) throw new Error("Reward destination is missing.");
      if (intent.currency !== "PC" && intent.currency !== "G") {
        throw new Error("Reward currency is invalid.");
      }
      const sent = await mintDemoAssetToAddress(
        intent.destinationWalletScope,
        intent.currency,
        intent.amount
      );
      const marked = await rewards.markWalletRewardSubmitted(db, {
        intentId: intent.id,
        txHash: sent.txHash,
      });
      if (!marked.ok) throw new Error(marked.reason);
      submittedCount++;
      for (let attempt = 0; attempt < 24; attempt++) {
        const result = await rewards.confirmWalletReward(db, intent.id);
        if (result.ok) {
          confirmedCount++;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    } catch {
      // Unknown broadcast state must not be retried automatically. The
      // `distributing` lease remains as the reconciliation signal.
      reconciliationCount++;
    }
  }

  const alreadyUncertain = await db.tokenTransactionIntent.count({
    where: { kind: { startsWith: "reward." }, status: "distributing" },
  });
  console.log(
    `Wallet rewards: ${prepared.length} prepared, ${submitted.length} resumed, ${submittedCount} newly submitted, ${confirmedCount} confirmed, ${Math.max(alreadyUncertain, reconciliationCount)} require reconciliation.`
  );
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
