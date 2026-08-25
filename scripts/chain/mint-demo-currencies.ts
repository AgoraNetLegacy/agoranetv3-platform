import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { mintDemoCurrenciesToAddress } from "../../lib/chainMint";

const recipientInput = process.env.DEMO_RECIPIENT_ADDRESS?.trim();
const matchedRecipient = recipientInput?.match(/addr_test1[0-9a-z]+/i)?.[0]?.toLowerCase();
if (!matchedRecipient) {
  throw new Error(
    "DEMO_RECIPIENT_ADDRESS must contain a Cardano testnet address beginning with addr_test1."
  );
}
const recipientAddress: string = matchedRecipient;

async function main() {
  console.log("Minting demo PollCoin and Gratium on Cardano preprod…");
  const result = await mintDemoCurrenciesToAddress(recipientAddress);
  console.log("Transaction:", result.txHash);
  console.log("PollCoin unit:", result.pollCoinUnit);
  console.log("Gratium unit:", result.gratiumUnit);
  console.log(
    "Explorer: https://preprod.cardanoscan.io/transaction/" + result.txHash
  );
}

main().catch((error) => {
  console.error("MINT_FAIL:", error instanceof Error ? error.message : error);
  process.exit(1);
});
