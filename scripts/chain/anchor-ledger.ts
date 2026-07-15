// Anchor the civic ledger's current head hash into a preprod
// transaction's metadata (TESTNET_RAILS_SPEC §3). The internal
// hash-chained ledger stays the system of record; this makes a public
// testnet chain an external witness anyone can verify.
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { PrismaClient } from "@prisma/client";
import { anchorLedgerHash } from "../../lib/chainMint";

async function main() {
  const db = new PrismaClient();
  // The head of the hash chain: the most recent ledger event's hash is
  // the fingerprint of the entire history before it.
  const head = await db.ledgerEvent.findFirst({ orderBy: { seq: "desc" } });
  await db.$disconnect();
  if (!head) throw new Error("No ledger events to anchor.");

  console.log("Anchoring civic-ledger head to preprod…");
  console.log("  ledger head seq :", head.seq);
  console.log("  head hash       :", head.entryHash);
  const r = await anchorLedgerHash(head.entryHash);
  console.log("  tx hash         :", r.txHash);
  console.log("  explorer        : https://preprod.cardanoscan.io/transaction/" + r.txHash);
  console.log("ANCHOR_OK:" + r.txHash + ":" + head.entryHash);
}
main().catch((e) => {
  console.error("ANCHOR_FAIL:", e.message ?? e);
  process.exit(1);
});
