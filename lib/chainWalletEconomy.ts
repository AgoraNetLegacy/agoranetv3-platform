// Server-side facts for the first load-bearing Wallet-mode fee. The
// destination is derived from the committed M-of-N mission-treasury Aiken
// validator; no operator-controlled address can be substituted by a form.
// This module reads and verifies public testnet data only. It owns no key.

import { readFileSync } from "fs";
import { join } from "path";
import { mConStr1, serializeData, stringToHex } from "@meshsdk/core";
import { demoAssetUnit, cardanoNetwork } from "./chain";
import { sameWalletAccount } from "./cardanoAccounts";

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

/** Read how much of each asset the linked wallet actually delivered to the
 * compiled treasury script in one transaction. One Blockfrost read serves
 * both the single-asset and dual-token checks. Returns null when the
 * transaction does not exist or was not funded by the linked wallet. */
async function treasuryPaymentsIn(
  input: { txHash: string; sourceAddress: string; destinationAddress: string },
  fetcher: typeof fetch
): Promise<Map<string, bigint> | null> {
  if (!/^[0-9a-f]{64}$/i.test(input.txHash)) return null;
  if (!input.sourceAddress.startsWith("addr_test1")) return null;
  if (!input.destinationAddress.startsWith("addr_test1")) return null;
  const projectId = process.env.BLOCKFROST_PROJECT_ID;
  if (!projectId) throw new Error("BLOCKFROST_PROJECT_ID is not set.");
  const response = await fetcher(
    `https://cardano-${cardanoNetwork()}.blockfrost.io/api/v0/txs/${input.txHash}/utxos`,
    { headers: { project_id: projectId }, cache: "no-store" }
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Wallet fee lookup failed (${response.status}).`);
  const data = (await response.json()) as {
    inputs: { address: string }[];
    outputs: {
      address: string;
      amount: { unit: string; quantity: string }[];
      inline_datum?: string | null;
    }[];
  };
  if (!data.inputs.some((item) => sameWalletAccount(item.address, input.sourceAddress))) {
    return null;
  }
  const expectedDatum = serializeData(
    mConStr1([stringToHex(WALLET_FEE_TREASURY_TAG)])
  ).toLowerCase();
  const paid = new Map<string, bigint>();
  for (const output of data.outputs) {
    if (output.address !== input.destinationAddress) continue;
    if (output.inline_datum?.toLowerCase() !== expectedDatum) continue;
    for (const asset of output.amount) {
      paid.set(asset.unit, (paid.get(asset.unit) ?? 0n) + BigInt(asset.quantity));
    }
  }
  return paid;
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
  if (!/^(?:0*[1-9][0-9]*)$/.test(input.quantity)) return false;
  const paid = await treasuryPaymentsIn(input, fetcher);
  if (!paid) return false;
  const unit = demoAssetUnit(input.currency);
  return (paid.get(unit) ?? 0n) >= BigInt(input.quantity);
}

/** Verify a DUAL-token payment: both assets delivered by ONE transaction
 * (NEURAL_POLLINATOR §3; the Pollinator charges in both tokens, so wallet
 * settlement must too). Both legs are checked against the same transaction,
 * so a soul cannot satisfy a chamber by paying one token twice. */
export async function verifyWalletDualFeePayment(
  input: {
    txHash: string;
    sourceAddress: string;
    destinationAddress: string;
    legs: { currency: "PC" | "G"; quantity: string }[];
  },
  fetcher: typeof fetch = fetch
) {
  const currencies = new Set(input.legs.map((leg) => leg.currency));
  if (input.legs.length !== 2 || currencies.size !== 2) return false;
  if (input.legs.some((leg) => !/^(?:0*[1-9][0-9]*)$/.test(leg.quantity))) return false;
  const paid = await treasuryPaymentsIn(input, fetcher);
  if (!paid) return false;
  return input.legs.every(
    (leg) => (paid.get(demoAssetUnit(leg.currency)) ?? 0n) >= BigInt(leg.quantity)
  );
}
