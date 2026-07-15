import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { mintWallet } from "../../lib/chainMint";
async function main() {
  const w = await mintWallet();
  const used = await w.getUsedAddresses();
  const change = await w.getChangeAddress();
  console.log("MINT_ADDR:" + (used[0] ?? change));
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
