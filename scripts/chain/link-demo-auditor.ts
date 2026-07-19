// Slice 7 live-proof fixture: give one completed-but-unsettled fund
// audit's auditor a linked testnet wallet (a freshly brewed throwaway
// address — settlement only needs somewhere to pay). The off-chain
// process (Phase 8.7's offer→accept→complete) is the system of record;
// this only links the wallet the settlement pays.
//
// Usage: npx tsx scripts/chain/link-demo-auditor.ts
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { PrismaClient } from "@prisma/client";

async function main() {
  const db = new PrismaClient();
  const { recordWalletLink } = await import("../../lib/chain");
  const { MeshWallet, deserializeAddress } = await import("@meshsdk/core");
  const due = await db.fundAudit.findFirst({
    where: { status: "completed", settlementTxHash: null },
    orderBy: { completedAt: "asc" },
  });
  if (!due) throw new Error("No completed, unsettled fund audit found — run the 8.7 demo first.");
  const existing = await db.testnetWalletLink.findUnique({
    where: { profileId: due.auditorProfileId },
  });
  if (existing) {
    console.log(`auditor ${due.auditorProfileId.slice(0, 8)} already linked: ${existing.cardanoAddress.slice(0, 24)}…`);
  } else {
    const w = new MeshWallet({
      networkId: 0,
      key: { type: "mnemonic", words: MeshWallet.brew() as string[] },
    });
    await w.init();
    const addr = await w.getChangeAddress();
    const r = await recordWalletLink(db, {
      profileId: due.auditorProfileId,
      cardanoAddress: addr,
      network: "preprod",
    });
    if (!r.ok) throw new Error(r.reason);
    console.log(`auditor ${due.auditorProfileId.slice(0, 8)} linked to brewed ${addr.slice(0, 24)}… (hash of audit ${due.id.slice(0, 8)})`);
    console.log(`AUDITOR_ADDR:${addr}`);
  }
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
