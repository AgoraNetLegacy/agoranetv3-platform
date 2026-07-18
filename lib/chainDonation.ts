// The Slice 3 donation lock, server side (ONCHAIN_ECONOMY_MIGRATION.md §5).
// Everything here derives from the COMMITTED Aiken blueprint
// (infra/onchain/plutus.json) — one source of truth, no copy-pasted
// addresses that can drift from the compiled validator. Pure
// serialization only: no keys, no signing, nothing custodial. The
// mint-wallet world (lib/chainMint.ts, TESTNET_MINT_MNEMONIC) stays a
// separate module the request path never imports.

import { readFileSync } from "fs";
import { join } from "path";

const BLUEPRINT_PATH = join(process.cwd(), "infra", "onchain", "plutus.json");
const VALIDATOR_TITLE = "donation.donation_lock.spend";

let cached: { scriptCbor: string; address: string } | null = null;

/** The donation-lock script: its double-CBOR code and its TESTNET
 *  address (network id 0 — this module never produces a mainnet
 *  address), both derived from the committed blueprint. */
export async function donationScript(): Promise<{ scriptCbor: string; address: string }> {
  if (cached) return cached;
  const blueprint = JSON.parse(readFileSync(BLUEPRINT_PATH, "utf8"));
  const validator = (blueprint.validators as { title: string; compiledCode: string }[]).find(
    (v) => v.title === VALIDATOR_TITLE
  );
  if (!validator) {
    throw new Error(
      `${VALIDATOR_TITLE} missing from infra/onchain/plutus.json — run aiken build.`
    );
  }
  const { serializePlutusScript, applyCborEncoding } = await import("@meshsdk/core");
  const scriptCbor = applyCborEncoding(validator.compiledCode);
  const address = serializePlutusScript({ code: scriptCbor, version: "V3" }, undefined, 0).address;
  cached = { scriptCbor, address };
  return cached;
}

/** The demo beneficiary's verification-key hash, derived from the
 *  configured ADDRESS (public by nature; rotated via env, never a key).
 *  Track 2 replaces this single beneficiary with the M-of-N release. */
export async function demoBeneficiaryHash(): Promise<string> {
  const addr = process.env.TESTNET_DEMO_BENEFICIARY_ADDR;
  if (!addr) throw new Error("TESTNET_DEMO_BENEFICIARY_ADDR is not set.");
  if (!addr.startsWith("addr_test1")) {
    throw new Error(
      "TESTNET_DEMO_BENEFICIARY_ADDR must be a Cardano TESTNET address (addr_test1…)."
    );
  }
  const { deserializeAddress } = await import("@meshsdk/core");
  return deserializeAddress(addr).pubKeyHash;
}
