// Fund-auditor settlement runner (Slice 7): pays each completed,
// unsettled audit's auditor at THEIR OWN linked wallet, per case,
// never per finding; with the basis declared in public CIP-20
// metadata (label 674) on every settlement tx. Idempotent: settled
// rows are never re-paid; unlinked auditors are skipped and counted.
//
// Usage: npm run chain:settle-auditors
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { PrismaClient } from "@prisma/client";

async function main() {
  const db = new PrismaClient();
  const { settleCompletedAudits } = await import("../../lib/chainSettlement");
  const { mintWallet } = await import("../../lib/chainMint");
  const { Transaction } = await import("@meshsdk/core");
  const wallet = await mintWallet();

  const result = await settleCompletedAudits(db, async (to, lovelace, note) => {
    const tx = new Transaction({ initiator: wallet });
    tx.sendLovelace(to, String(lovelace));
    tx.setMetadata(674, {
      msg: ["AgoraNet fund-audit settlement (testnet)"],
      auditId: note.auditId,
      basis: note.basis,
    });
    return wallet.submitTx(await wallet.signTx(await tx.build()));
  });

  console.log(
    result.settled.length
      ? `SETTLED ${result.settled.length}: ${result.settled
          .map((s) => `${s.auditId.slice(0, 8)}→${s.txHash.slice(0, 12)}… (${s.lovelace})`)
          .join(", ")}` +
          (result.skippedNoWallet ? `; ${result.skippedNoWallet} auditor(s) without a linked wallet skipped` : "")
      : `Nothing due; every completed audit is settled or its auditor has no linked wallet (${result.skippedNoWallet} skipped).`
  );
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
