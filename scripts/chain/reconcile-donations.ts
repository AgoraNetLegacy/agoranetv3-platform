// Donation reconciliation runner (Slice 4 carry-over): mirror the
// chain's donations into the database on the SERVER's schedule;
// never only on a browser poll the donor must babysit. Idempotent;
// safe on any cadence; pairs naturally with `npm run chain:anchor`.
//
// Usage: npm run chain:reconcile
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { PrismaClient } from "@prisma/client";

async function main() {
  const db = new PrismaClient();
  const { reconcileDonations } = await import("../../lib/chainReconcile");
  const { donationScript } = await import("../../lib/chainDonation");
  const { address } = await donationScript();
  const result = await reconcileDonations(db, address);
  console.log(
    `Scanned ${result.walletsScanned} linked wallet(s); ` +
      (result.recovered.length
        ? `RECOVERED ${result.recovered.length}: ${result.recovered
            .map((r) => `${r.txHash.slice(0, 12)}… (${r.lovelace} lovelace)`)
            .join(", ")}`
        : "nothing missing; database already mirrors the chain.")
  );
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
