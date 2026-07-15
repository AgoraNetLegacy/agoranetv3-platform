// Mint PollCoin Demo (dPOLL) on Cardano preprod (TESTNET_RAILS_SPEC
// §2.1). Prints the policy id, unit, and an explorer link. Idempotent
// in spirit — run again and it mints more of the same-named asset
// under the same throwaway policy.
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { mintDemoPollCoin } from "../../lib/chainMint";

async function main() {
  console.log("Minting PollCoin Demo (dPOLL) on preprod…");
  const r = await mintDemoPollCoin("1000000");
  console.log("  policy id :", r.policyId);
  console.log("  unit      :", r.unit);
  console.log("  tx hash   :", r.txHash);
  console.log("  explorer  : https://preprod.cardanoscan.io/transaction/" + r.txHash);
  console.log("MINT_OK:" + r.txHash + ":" + r.policyId);
}
main().catch((e) => {
  console.error("MINT_FAIL:", e.message ?? e);
  process.exit(1);
});
