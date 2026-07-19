// On-chain migration Slice 7: fund-auditor per-case settlement.
// The OFF-CHAIN process (offer → accept → complete, Phase 8.7) stays
// the system of record; this mirrors the payout onto the testnet rail:
// each COMPLETED audit whose auditor linked a wallet gets the railed
// amount paid to THEIR OWN address, and the row records the tx hash
// only after the chain confirms the payment — verify-then-record, the
// Slice 2 discipline. PER CASE, NEVER PER FINDING: the amount is one
// rail, blind to 'clean' vs 'concern', exactly like the internal rail.
//
// The real sender lives in the runner script (it needs the Node-only
// dev wallet); this module is pure orchestration with injectable
// sender/verifier so the fast suite never touches a network.

import type { PrismaClient } from "@prisma/client";
import { getRail } from "./rails";
import { cardanoNetwork, lockedAtScriptOnConfiguredTestnet } from "./chain";

export type SettlementSender = (
  toAddress: string,
  lovelace: number,
  note: { auditId: string; basis: string }
) => Promise<string>;

export type SettlementResult = {
  settled: { auditId: string; txHash: string; lovelace: number }[];
  skippedNoWallet: number;
};

/** Sweep completed-but-unsettled audits and pay each auditor's own
 *  wallet the railed per-case amount. Recording happens only after the
 *  chain confirms lovelace at the auditor's address in that tx. */
export async function settleCompletedAudits(
  db: PrismaClient,
  send: SettlementSender,
  verify: (txHash: string, address: string) => Promise<number | null> =
    lockedAtScriptOnConfiguredTestnet
): Promise<SettlementResult> {
  const lovelace = await getRail(db, "onchain.auditorSettlementLovelace");
  const due = await db.fundAudit.findMany({
    where: { status: "completed", settlementTxHash: null },
    orderBy: { completedAt: "asc" },
  });
  const result: SettlementResult = { settled: [], skippedNoWallet: 0 };
  for (const audit of due) {
    const link = await db.testnetWalletLink.findUnique({
      where: { profileId: audit.auditorProfileId },
    });
    if (!link) {
      result.skippedNoWallet += 1;
      continue;
    }
    const txHash = (
      await send(link.cardanoAddress, lovelace, {
        auditId: audit.id,
        basis: "per-case-never-per-finding",
      })
    )
      .trim()
      .toLowerCase();
    // Verify before recording — poll briefly; the tx was just submitted.
    let paid: number | null = null;
    for (let attempt = 0; attempt < 24 && paid === null; attempt++) {
      paid = await verify(txHash, link.cardanoAddress);
      if (paid === null) await new Promise((r) => setTimeout(r, 5000));
    }
    if (paid === null || paid < lovelace) {
      throw new Error(
        `Settlement ${txHash} for audit ${audit.id} not confirmed at the auditor's address — NOT recorded.`
      );
    }
    await db.fundAudit.update({
      where: { id: audit.id },
      data: { settlementTxHash: txHash, settlementAt: new Date() },
    });
    result.settled.push({ auditId: audit.id, txHash, lovelace });
  }
  return result;
}

/** The network this settlement runs against (re-exported for the runner). */
export { cardanoNetwork };
