// Operator-side testnet Credit claim distributor. This is intentionally a
// separate process: the web app records reservations but never imports the
// fake mint wallet. Idempotent statuses prevent a confirmed/submitted claim
// from being minted twice.

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  if (process.env.CREDIT_CLAIMS_TESTNET_ENABLED !== "true") {
    throw new Error("CREDIT_CLAIMS_TESTNET_ENABLED must be true.");
  }
  const [{ db }, { mintDemoAssetToAddress }, claims, chain] = await Promise.all([
    import("../../lib/db"),
    import("../../lib/chainMint"),
    import("../../lib/creditClaims"),
    import("../../lib/chain"),
  ]);
  const due = await db.creditClaim.findMany({
    where: { status: "reserved", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  let submitted = 0;
  let confirmed = 0;
  let refunded = 0;
  let needsReconciliation = 0;

  // Expired reservations were never leased and therefore never reached a
  // chain call. They can be returned safely through the constrained refund
  // category. `distributing` claims are deliberately excluded because their
  // broadcast state may be unknown after a crash.
  const expired = await db.creditClaim.findMany({
    where: { status: "reserved", expiresAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  for (const claim of expired) {
    const result = await claims.refundFailedCreditClaim(db, {
      claimId: claim.id,
      failureCode: "reservation_expired",
      failureMessage: "The testnet distributor did not start before the reservation expired.",
    });
    if (result.ok) refunded++;
  }

  // Resume already-broadcast work before minting anything new. A process
  // restart must confirm the existing hash, never create a replacement tx.
  const awaitingConfirmation = await db.creditClaim.findMany({
    where: { status: "submitted" },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  for (const claim of awaitingConfirmation) {
    const result = await claims.confirmCreditClaim(db, {
      claimId: claim.id,
      verify: chain.verifyDemoAssetDelivery,
    });
    if (result.ok) confirmed++;
  }

  for (const claim of due) {
    const acquired = await claims.acquireCreditClaimForDistribution(db, claim.id);
    if (!acquired) continue;
    try {
      const sent = await mintDemoAssetToAddress(
        claim.destinationAddress,
        claim.currency as "PC" | "G",
        claim.assetAmount
      );
      const marked = await claims.markCreditClaimSubmitted(db, {
        claimId: claim.id,
        txHash: sent.txHash,
      });
      if (!marked.ok) throw new Error(marked.reason);
      submitted++;
      for (let attempt = 0; attempt < 24; attempt++) {
        const result = await claims.confirmCreditClaim(db, {
          claimId: claim.id,
          verify: chain.verifyDemoAssetDelivery,
        });
        if (result.ok) {
          confirmed++;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    } catch {
      // The runner cannot know whether a provider threw before or after
      // broadcast. Leave the leased claim visibly `distributing`; automatic
      // retry or refund could duplicate value. Reconcile it from chain data.
      needsReconciliation++;
    }
  }
  console.log(
    due.length || awaitingConfirmation.length || expired.length
      ? `Checked ${due.length} ready, ${awaitingConfirmation.length} submitted, and ${expired.length} expired Credit claim(s): ${submitted} newly submitted, ${confirmed} confirmed, ${refunded} refunded, ${needsReconciliation} require reconciliation.`
      : "No ready, submitted, or expired Credit claims are waiting."
  );
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
