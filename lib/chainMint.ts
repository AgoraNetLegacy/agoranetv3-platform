// The Cardano testnet mint + anchor engine (Phase 8.6;
// TESTNET_RAILS_SPEC §2.1, §3). TESTNET ONLY, throwaway policy: this
// module holds NOTHING of value and mints a demo-labeled asset under a
// disposable key. The internal double-entry economy remains the system
// of record (§2.1); this only mirrors boundary events onto real test
// rails so the demo shows real tokens moving.
//
// Node-only (uses the operator's throwaway key + Blockfrost); never
// imported into the Next.js request path.

import {
  MeshWallet,
  BlockfrostProvider,
  ForgeScript,
  Transaction,
  resolveScriptHash,
  stringToHex,
} from "@meshsdk/core";
import { demoAssetPolicyId } from "./chain";

// Env is read INSIDE the functions, never at module top level; script
// callers load env (Next's loadEnvConfig) after the hoisted import, so
// top-level reads would see undefined.
function testnetEnv() {
  const net = process.env.CARDANO_NETWORK ?? "preprod";
  const projectId = process.env.BLOCKFROST_PROJECT_ID;
  const mnemonic = process.env.TESTNET_MINT_MNEMONIC;
  if (net !== "preprod" && net !== "preview") {
    throw new Error(`Refusing to run: CARDANO_NETWORK="${net}" is not a testnet.`);
  }
  if (!projectId?.startsWith("preprod") && !projectId?.startsWith("preview")) {
    throw new Error("Refusing to run: BLOCKFROST_PROJECT_ID is not a testnet key.");
  }
  if (!mnemonic) throw new Error("TESTNET_MINT_MNEMONIC is not set.");
  return { net, projectId, mnemonic };
}

export function mintProvider() {
  const { projectId } = testnetEnv();
  return new BlockfrostProvider(projectId!);
}

export async function mintWallet() {
  const { projectId, mnemonic } = testnetEnv();
  const provider = new BlockfrostProvider(projectId!);
  const wallet = new MeshWallet({
    networkId: 0, // testnet; never 1 (mainnet) in this module
    fetcher: provider,
    submitter: provider,
    key: { type: "mnemonic", words: mnemonic!.trim().split(/\s+/) },
  });
  await wallet.init();
  return wallet;
}

/** Mint the demo asset "PollCoin Demo" (ticker dPOLL, owner-ruled
 *  2026-07-13) under a throwaway signature policy. Returns the policy
 *  id, the on-chain unit, and the submitted tx hash. */
export async function mintDemoPollCoin(quantity = "1000000") {
  const wallet = await mintWallet();
  const addr = (await wallet.getUsedAddresses())[0] ?? (await wallet.getChangeAddress());

  // Throwaway policy: a native "signed by this key" script; disposable
  // by construction, exactly what §2.1 calls for.
  const forge = ForgeScript.withOneSignature(addr);
  const policyId = resolveScriptHash(forge);
  const assetNameHex = stringToHex("dPOLL");

  const tx = new Transaction({ initiator: wallet });
  tx.mintAsset(forge, {
    assetName: "dPOLL",
    assetQuantity: quantity,
    metadata: {
      name: "PollCoin Demo",
      ticker: "dPOLL",
      desc: "AgoraNet Phase 8.6 testnet demo token; no real value, ever.",
    },
    label: "721",
    recipient: addr,
  });

  const unsigned = await tx.build();
  const signed = await wallet.signTx(unsigned);
  const txHash = await wallet.submitTx(signed);
  return { policyId, unit: policyId + assetNameHex, assetNameHex, txHash, address: addr };
}

/** Mint and deliver the two demo currencies to a user-owned preprod address.
 * TESTNET ONLY: the assets have no value, the recipient must be addr_test1,
 * and the operator wallet only pays the preprod transaction fee.
 */
export async function mintDemoCurrenciesToAddress(
  recipient: string,
  pollCoinQuantity = "1000",
  gratiumQuantity = "1000"
) {
  if (!recipient.startsWith("addr_test1")) {
    throw new Error("Refusing to send demo currencies anywhere except a preprod address.");
  }
  const wallet = await mintWallet();
  const operatorAddress =
    (await wallet.getUsedAddresses())[0] ?? (await wallet.getChangeAddress());
  const forge = ForgeScript.withOneSignature(operatorAddress);
  const policyId = resolveScriptHash(forge);
  const pollCoinName = "dPOLL";
  const gratiumName = "dGRA";
  const pollCoinUnit = policyId + stringToHex(pollCoinName);
  const gratiumUnit = policyId + stringToHex(gratiumName);

  const tx = new Transaction({ initiator: wallet });
  tx.mintAsset(forge, {
    assetName: pollCoinName,
    assetQuantity: pollCoinQuantity,
    metadata: {
      name: "PollCoin Demo",
      ticker: pollCoinName,
      desc: "AgoraNet preprod test asset; no real value.",
    },
    label: "721",
    recipient,
  });
  tx.mintAsset(forge, {
    assetName: gratiumName,
    assetQuantity: gratiumQuantity,
    metadata: {
      name: "Gratium Demo",
      ticker: gratiumName,
      desc: "AgoraNet preprod test asset; no real value.",
    },
    label: "721",
    recipient,
  });

  const unsigned = await tx.build();
  const signed = await wallet.signTx(unsigned);
  const txHash = await wallet.submitTx(signed);
  return { txHash, policyId, pollCoinUnit, gratiumUnit, recipient };
}

/** Mint and deliver exactly one fake AgoraNet currency for an explicit
 * Credit claim. Kept in this Node-only module so the web process never
 * imports the testnet distribution mnemonic. */
export async function mintDemoAssetToAddress(
  recipient: string,
  currency: "PC" | "G",
  quantity: string
) {
  if (!recipient.startsWith("addr_test1")) {
    throw new Error("Refusing to send demo currencies anywhere except a testnet address.");
  }
  if (!/^(?:0*[1-9][0-9]*)$/.test(quantity)) {
    throw new Error("Demo asset quantity must be a positive integer.");
  }
  const wallet = await mintWallet();
  const operatorAddress =
    (await wallet.getUsedAddresses())[0] ?? (await wallet.getChangeAddress());
  const forge = ForgeScript.withOneSignature(operatorAddress);
  const policyId = resolveScriptHash(forge);
  const configuredPolicyId = demoAssetPolicyId();
  if (policyId !== configuredPolicyId) {
    throw new Error(
      "The testnet mint wallet does not match TEST_POLLCOIN_POLICY_ID; refusing to create an unrecognized asset."
    );
  }
  const assetName = currency === "PC" ? "dPOLL" : "dGRA";
  const tx = new Transaction({ initiator: wallet });
  tx.mintAsset(forge, {
    assetName,
    assetQuantity: quantity,
    metadata: {
      name: currency === "PC" ? "PollCoin Demo" : "Gratium Demo",
      ticker: assetName,
      desc: "AgoraNet progressive-rail test asset; no real value.",
    },
    label: "721",
    recipient,
  });
  tx.setMetadata(674, {
    msg: ["AgoraNet Credit claim (testnet; no real value)"],
  });
  const unsigned = await tx.build();
  const signed = await wallet.signTx(unsigned);
  const txHash = await wallet.submitTx(signed);
  return { txHash, recipient, currency, quantity };
}

/** Anchor one civic-ledger hash into a preprod transaction's metadata
 *  (§3, CIP-20 style). The chain becomes an external, public witness
 *  to the internal ledger's integrity; anyone can look it up. */
export async function anchorLedgerHash(hashHex: string) {
  const wallet = await mintWallet();
  const addr = (await wallet.getUsedAddresses())[0] ?? (await wallet.getChangeAddress());

  const tx = new Transaction({ initiator: wallet });
  // Self-send the minimum, carrying the anchor in metadata label 674
  // (CIP-20 message standard).
  tx.sendLovelace(addr, "1000000");
  tx.setMetadata(674, {
    msg: ["AgoraNet civic-ledger anchor (testnet)"],
    ledgerHash: hashHex,
  });
  const unsigned = await tx.build();
  const signed = await wallet.signTx(unsigned);
  const txHash = await wallet.submitTx(signed);
  return { txHash, hashHex, address: addr };
}
