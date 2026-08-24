// Server-side facts for the first load-bearing Wallet-mode fee. The
// destination is derived from the committed M-of-N mission-treasury Aiken
// validator; no operator-controlled address can be substituted by a form.
// This module reads and verifies public testnet data only. It owns no key.

import { readFileSync } from "fs";
import { join } from "path";
import { mConStr1, serializeData, stringToHex } from "@meshsdk/core";
import { demoAssetUnit, cardanoNetwork } from "./chain";

const BLUEPRINT_PATH = join(process.cwd(), "infra", "onchain", "plutus.json");
const VALIDATOR_TITLE = "mission_treasury.mission_treasury.spend";
export const WALLET_FEE_TREASURY_TAG = "agoranet-platform-fees-v1";

let cachedDestination: { address: string; treasuryTag: string } | null = null;

export async function walletFeeDestination() {
  if (cachedDestination) return cachedDestination;
  const blueprint = JSON.parse(readFileSync(BLUEPRINT_PATH, "utf8")) as {
    validators: { title: string; compiledCode: string }[];
  };
  const validator = blueprint.validators.find((item) => item.title === VALIDATOR_TITLE);
  if (!validator) {
    throw new Error(`${VALIDATOR_TITLE} missing from infra/onchain/plutus.json; run aiken build.`);
  }
  const { applyCborEncoding, serializePlutusScript } = await import("@meshsdk/core");
  const scriptCbor = applyCborEncoding(validator.compiledCode);
  const address = serializePlutusScript(
    { code: scriptCbor, version: "V3" },
    undefined,
    0
  ).address;
  if (!address.startsWith("addr_test1")) {
    throw new Error("Wallet fee destination is not a Cardano testnet script address.");
  }
  cachedDestination = { address, treasuryTag: WALLET_FEE_TREASURY_TAG };
  return cachedDestination;
}

/** Verify that the linked wallet funded a transaction and that the expected
 * fake asset reached the compiled treasury script. A tx hash can pay exactly
 * one intent because TokenTransactionIntent.txHash is unique. */
export async function verifyWalletFeePayment(
  input: {
    txHash: string;
    sourceAddress: string;
    destinationAddress: string;
    currency: "PC" | "G";
    quantity: string;
  },
  fetcher: typeof fetch = fetch
) {
  if (!/^[0-9a-f]{64}$/i.test(input.txHash)) return false;
  if (!input.sourceAddress.startsWith("addr_test1")) return false;
  if (!input.destinationAddress.startsWith("addr_test1")) return false;
  if (!/^(?:0*[1-9][0-9]*)$/.test(input.quantity)) return false;
  const projectId = process.env.BLOCKFROST_PROJECT_ID;
  if (!projectId) throw new Error("BLOCKFROST_PROJECT_ID is not set.");
  const response = await fetcher(
    `https://cardano-${cardanoNetwork()}.blockfrost.io/api/v0/txs/${input.txHash}/utxos`,
    { headers: { project_id: projectId }, cache: "no-store" }
  );
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`Wallet fee lookup failed (${response.status}).`);
  const data = (await response.json()) as {
    inputs: { address: string }[];
    outputs: {
      address: string;
      amount: { unit: string; quantity: string }[];
      inline_datum?: string | null;
    }[];
  };
  if (!data.inputs.some((item) => item.address === input.sourceAddress)) return false;
  const expectedDatum = serializeData(
    mConStr1([stringToHex(WALLET_FEE_TREASURY_TAG)])
  ).toLowerCase();
  const unit = demoAssetUnit(input.currency);
  const paid = data.outputs
    .filter(
      (output) =>
        output.address === input.destinationAddress &&
        output.inline_datum?.toLowerCase() === expectedDatum
    )
    .flatMap((output) => output.amount)
    .filter((asset) => asset.unit === unit)
    .reduce((sum, asset) => sum + BigInt(asset.quantity), 0n);
  return paid >= BigInt(input.quantity);
}
