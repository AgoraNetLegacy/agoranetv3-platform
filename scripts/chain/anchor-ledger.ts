// Anchor the civic ledger's head hash into a preprod transaction's
// metadata (TESTNET_RAILS_SPEC §3) — CADENCE-AWARE since slice 4: this
// script is idempotent and joins the ops-job roster (backup/drill/
// crush/prune) the deployment host runs on schedule. Run daily; it
// anchors only when the anchor.cadenceHours rail has elapsed AND the
// ledger has moved since the last anchor. `--force` anchors regardless
// (the §5 demo's button).
//
// The internal hash-chained ledger stays the system of record; the
// public chain is an external witness anyone can verify.
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { PrismaClient } from "@prisma/client";
import { anchorLedgerHash } from "../../lib/chainMint";
import { anchorStatus, recordAnchor } from "../../lib/chainAnchor";

async function main() {
  const force = process.argv.includes("--force");
  const db = new PrismaClient();
  try {
    const status = await anchorStatus(db);
    if (!status.headSeq || !status.headHash) {
      console.log("ANCHOR_SKIP: no ledger events to anchor.");
      return;
    }
    if (!status.due && !force) {
      const why =
        status.lastAnchor && status.headSeq <= status.lastAnchor.anchoredSeq
          ? `ledger has not moved since seq ${status.lastAnchor.anchoredSeq} was anchored`
          : `cadence (${status.cadenceHours}h) has not elapsed since ${status.lastAnchor?.at.toISOString()}`;
      console.log(`ANCHOR_SKIP: not due — ${why}.`);
      return;
    }

    console.log("Anchoring civic-ledger head to " + (process.env.CARDANO_NETWORK ?? "preprod") + "…");
    console.log("  ledger head seq :", status.headSeq);
    console.log("  head hash       :", status.headHash);
    const r = await anchorLedgerHash(status.headHash);
    const ev = await recordAnchor(db, {
      anchoredSeq: status.headSeq,
      headHash: status.headHash,
      txHash: r.txHash,
      network: process.env.CARDANO_NETWORK ?? "preprod",
    });
    console.log("  tx hash         :", r.txHash);
    console.log("  ledger event    : seq", ev.seq, "(ledger.anchored)");
    console.log("  explorer        : https://preprod.cardanoscan.io/transaction/" + r.txHash);
    console.log("ANCHOR_OK:" + r.txHash + ":" + status.headHash);
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error("ANCHOR_FAIL:", e.message ?? e);
  process.exit(1);
});
