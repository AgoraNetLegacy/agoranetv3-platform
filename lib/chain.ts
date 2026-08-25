// The Cardano testnet rail (Phase 8.6; TESTNET_RAILS_SPEC §1.3, §6).
// TESTNET-ONLY BY CONSTRUCTION: the network selector refuses mainnet
// values, the wallet-link path refuses mainnet addresses, and nothing
// in this module custodies anything; the wallet stays the soul's;
// the platform records only which testnet address an identity chose to
// connect. The Phase A gate machinery is untouched (§6.6): this rail
// is additive.

import type { PrismaClient } from "@prisma/client";
import { deserializeAddress, stringToHex } from "@meshsdk/core";
import { sameWalletAccount, testnetRewardAddressFor } from "./cardanoAccounts";
export { sameWalletAccount, walletAccountFingerprint } from "./cardanoAccounts";

const TESTNETS = new Set(["preprod", "preview"]);
// Verified policy for the current throwaway preprod PollCoin/Gratium demo
// assets. This is public chain data, not a secret.
export const DEMO_ASSET_POLICY_ID =
  "70e8fedff8a8cd445705a0884c8b41db20e5005f7cdeef6a7322ad35";

export function demoAssetPolicyId(
  env: Record<string, string | undefined> = process.env
) {
  const policyId = env.TEST_POLLCOIN_POLICY_ID || DEMO_ASSET_POLICY_ID;
  if (!/^[0-9a-f]{56}$/i.test(policyId)) {
    throw new Error("TEST_POLLCOIN_POLICY_ID must be a 56-character testnet policy id.");
  }
  return policyId.toLowerCase();
}

export function demoAssetUnit(
  currency: "PC" | "G",
  env: Record<string, string | undefined> = process.env
) {
  return demoAssetPolicyId(env) + stringToHex(currency === "PC" ? "dPOLL" : "dGRA");
}

/** The configured Cardano testnet (§6.1). Throws on mainnet; this
 *  phase has no production posture at all, and a misconfigured env
 *  should fail loudly, not quietly reach a real network. */
export function cardanoNetwork(
  env: Record<string, string | undefined> = process.env
): "preprod" | "preview" {
  const net = env.CARDANO_NETWORK ?? "preprod";
  if (!TESTNETS.has(net)) {
    throw new Error(
      `CARDANO_NETWORK must be a Cardano TESTNET ("preprod" or "preview"); got "${net}". ` +
        "Mainnet is out of scope for Phase 8.6 by ratified design (§6.6)."
    );
  }
  return net as "preprod" | "preview";
}

export type WalletLinkResult = { ok: true } | { ok: false; reason: string };

/** Record which testnet address this identity connected (§6.3). One link
 *  per identity (re-connecting updates it); mainnet addresses are refused
 *  at the door; addr1… never enters this table. */
export async function recordWalletLink(
  db: PrismaClient,
  input: { profileId: string; cardanoAddress: string; network: string }
): Promise<WalletLinkResult> {
  const addr = input.cardanoAddress.trim();
  if (!addr.startsWith("addr_test1")) {
    return {
      ok: false,
      reason:
        "Only Cardano TESTNET addresses (addr_test1…) can be linked. " +
        "This phase runs no mainnet anything; if your wallet shows addr1…, " +
        "switch it to the Preprod network first.",
    };
  }
  if (!TESTNETS.has(input.network)) {
    return { ok: false, reason: "Only testnet networks (preprod, preview) can be linked." };
  }
  const otherLinks = await db.testnetWalletLink.findMany({
    where: { profileId: { not: input.profileId } },
    select: { cardanoAddress: true },
  });
  if (otherLinks.some((link) => sameWalletAccount(link.cardanoAddress, addr))) {
    return {
      ok: false,
      reason: "This Cardano account is already linked to another identity.",
    };
  }
  await db.testnetWalletLink.upsert({
    where: { profileId: input.profileId },
    create: {
      profileId: input.profileId,
      cardanoAddress: addr,
      network: input.network,
    },
    update: { cardanoAddress: addr, network: input.network, connectedAt: new Date() },
  });
  // Never show the previous wallet's last-known balance after a re-link. The
  // synchronized shell/settings loader will refresh this stale read model.
  await db.walletBalanceSnapshot.updateMany({
    where: { profileId: input.profileId },
    data: { syncStatus: "stale", errorCode: "wallet_relinked" },
  });
  return { ok: true };
}

/** The identity's current testnet wallet link, if any. */
export async function walletLinkFor(db: PrismaClient, profileId: string) {
  return db.testnetWalletLink.findUnique({ where: { profileId } });
}

export type DemoAssetBalances = {
  pollCoin: string;
  gratium: string;
};

/** Read the two demo assets from a linked preprod address. This is read-only;
 * no wallet keys or transaction signing are involved. */
export async function demoAssetBalances(
  address: string
): Promise<DemoAssetBalances> {
  if (!address.startsWith("addr_test1")) {
    throw new Error("Only preprod addresses can be queried.");
  }
  const net = cardanoNetwork();
  const projectId = process.env.BLOCKFROST_PROJECT_ID;
  const policyId = demoAssetPolicyId();
  if (!projectId) throw new Error("Testnet asset configuration is incomplete.");
  const headers = { project_id: projectId };
  const primary = await fetch(
    `https://cardano-${net}.blockfrost.io/api/v0/addresses/${address}`,
    { headers, cache: "no-store" }
  );
  if (primary.status !== 404 && !primary.ok) {
    throw new Error(`Wallet asset lookup failed (${primary.status}).`);
  }
  const primaryData = primary.ok ? (await primary.json()) as {
    amount: { unit: string; quantity: string }[];
    stake_address?: string;
  } : null;
  // The linked address may be an unused change address while the assets sit
  // at another receive address in the same Lace account. Derive the stable
  // reward address locally so a 404 for that one payment address does not
  // incorrectly become a zero account balance.
  const rewardAddress = primaryData?.stake_address ?? testnetRewardAddressFor(address);
  const amount = new Map<string, bigint>();

  if (rewardAddress) {
    // This Blockfrost endpoint already aggregates all payment addresses for
    // the stake account. Page through assets so large wallets are not cut off.
    for (let page = 1; page <= 100; page += 1) {
      const accountAssets = await fetch(
        `https://cardano-${net}.blockfrost.io/api/v0/accounts/${rewardAddress}/addresses/assets?count=100&page=${page}&order=asc`,
        { headers, cache: "no-store" }
      );
      if (accountAssets.status === 404) break;
      if (!accountAssets.ok) {
        throw new Error(`Wallet account asset lookup failed (${accountAssets.status}).`);
      }
      const rows = (await accountAssets.json()) as { unit: string; quantity: string }[];
      for (const item of rows) {
        amount.set(item.unit, (amount.get(item.unit) ?? 0n) + BigInt(item.quantity));
      }
      if (rows.length < 100) break;
    }
  } else if (primaryData) {
    for (const item of primaryData.amount) {
      amount.set(item.unit, (amount.get(item.unit) ?? 0n) + BigInt(item.quantity));
    }
  }
  return {
    pollCoin: (amount.get(policyId + stringToHex("dPOLL")) ?? 0n).toString(),
    gratium: (amount.get(policyId + stringToHex("dGRA")) ?? 0n).toString(),
  };
}

/** Verify one claim distribution from the transaction's actual outputs.
 * Browser callbacks and aggregate wallet balances are insufficient because
 * either can be stale or spoofed. A 404 is pending, not failure. */
export async function verifyDemoAssetDelivery(
  txHash: string,
  address: string,
  currency: "PC" | "G",
  expectedQuantity: string
): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/i.test(txHash) || !address.startsWith("addr_test1")) return false;
  if (!/^(?:0*[1-9][0-9]*)$/.test(expectedQuantity)) return false;
  const net = cardanoNetwork();
  const projectId = process.env.BLOCKFROST_PROJECT_ID;
  if (!projectId) throw new Error("BLOCKFROST_PROJECT_ID is not set.");
  const response = await fetch(
    `https://cardano-${net}.blockfrost.io/api/v0/txs/${txHash}/utxos`,
    { headers: { project_id: projectId }, cache: "no-store" }
  );
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`Claim transaction lookup failed (${response.status}).`);
  const data = (await response.json()) as {
    outputs: { address: string; amount: { unit: string; quantity: string }[] }[];
  };
  const unit = demoAssetUnit(currency);
  const delivered = data.outputs
    .filter((output) => output.address === address)
    .flatMap((output) => output.amount)
    .filter((amount) => amount.unit === unit)
    .reduce((sum, amount) => sum + BigInt(amount.quantity), 0n);
  return delivered >= BigInt(expectedQuantity);
}

// ------------------------------------------------------------------
// On-chain migration Slice 2: the self-custody proof. The soul's OWN
// wallet builds, signs, and submits a transaction in the browser; the
// platform never sees a key and never submits anything. All the server
// does is VERIFY the claimed hash exists on the configured testnet
// before recording it; CIP-30 cannot distinguish preprod from preview
// (both report networkId 0), so the 8.6 wrong-testnet gotcha is closed
// here with a real check instead of a footnote.
// ------------------------------------------------------------------

const TX_HASH_RE = /^[0-9a-f]{64}$/i;

export type ProofResult =
  | { ok: true; txHash: string }
  | { ok: false; reason: string; retryable: boolean };

/** Does this transaction exist on the CONFIGURED testnet? Blockfrost,
 *  server-side only; the browser never holds the project key. Returns
 *  false on 404 (wrong network or not yet propagated); throws on any
 *  other failure so an outage never masquerades as "wrong network". */
export async function txExistsOnConfiguredTestnet(txHash: string): Promise<boolean> {
  const net = cardanoNetwork();
  const projectId = process.env.BLOCKFROST_PROJECT_ID;
  if (!projectId) throw new Error("BLOCKFROST_PROJECT_ID is not set.");
  const res = await fetch(`https://cardano-${net}.blockfrost.io/api/v0/txs/${txHash}`, {
    headers: { project_id: projectId },
    cache: "no-store",
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`Blockfrost lookup failed (${res.status}).`);
  return true;
}

/** The addresses that FUNDED a transaction (its inputs), per the
 *  configured testnet. null when the tx isn't visible yet. The
 *  record-integrity primitive (review finding F3): a record is yours
 *  only if your linked wallet actually SENT the transaction. */
export async function txInputAddressesOnConfiguredTestnet(
  txHash: string
): Promise<string[] | null> {
  const net = cardanoNetwork();
  const projectId = process.env.BLOCKFROST_PROJECT_ID;
  if (!projectId) throw new Error("BLOCKFROST_PROJECT_ID is not set.");
  const res = await fetch(`https://cardano-${net}.blockfrost.io/api/v0/txs/${txHash}/utxos`, {
    headers: { project_id: projectId },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Blockfrost lookup failed (${res.status}).`);
  const utxos = (await res.json()) as { inputs: { address: string }[] };
  return utxos.inputs.map((i) => i.address);
}

const NOT_SENT_BY_LINKED =
  "That transaction exists, but it wasn't sent by this identity's linked " +
  "wallet; records here are only ever YOUR wallet's own acts. Nothing was recorded.";

/** Record the identity's self-custody proof; but only once the tx is
 *  actually visible on the configured testnet AND provably sent by
 *  the identity's own linked wallet (F3). Not-yet-found is retryable
 *  (propagation takes seconds to a couple of minutes); the caller
 *  polls. Verifiers are injectable for tests. */
export async function recordSelfCustodyProof(
  db: PrismaClient,
  input: { profileId: string; txHash: string },
  verify: (txHash: string) => Promise<boolean> = txExistsOnConfiguredTestnet,
  inputAddresses: (txHash: string) => Promise<string[] | null> =
    txInputAddressesOnConfiguredTestnet
): Promise<ProofResult> {
  const txHash = input.txHash.trim().toLowerCase();
  if (!TX_HASH_RE.test(txHash)) {
    return { ok: false, retryable: false, reason: "That isn't a Cardano transaction hash." };
  }
  const link = await walletLinkFor(db, input.profileId);
  if (!link) {
    return {
      ok: false,
      retryable: false,
      reason: "No wallet is linked to this identity yet; connect one first.",
    };
  }
  const found = await verify(txHash);
  if (!found) {
    return {
      ok: false,
      retryable: true,
      reason:
        `Not visible on ${cardanoNetwork()} yet. If this persists past a couple of ` +
        "minutes, your wallet is probably on the OTHER testnet (Preview); " +
        "the two share the same address format.",
    };
  }
  const senders = await inputAddresses(txHash);
  if (senders === null) {
    return { ok: false, retryable: true, reason: `Not visible on ${cardanoNetwork()} yet.` };
  }
  if (!senders.some((sender) => sameWalletAccount(sender, link.cardanoAddress))) {
    return { ok: false, retryable: false, reason: NOT_SENT_BY_LINKED };
  }
  await db.testnetWalletLink.update({
    where: { profileId: input.profileId },
    data: { proofTxHash: txHash, proofAt: new Date() },
  });
  return { ok: true, txHash };
}

// ------------------------------------------------------------------
// On-chain migration Slice 3: the non-custodial donation. The soul's
// own wallet locks value at the donation-lock SCRIPT address; the
// platform never possesses it; before recording, the server checks
// the chain and requires value to actually sit at the script in that
// transaction's outputs. Same verify-before-record discipline as the
// Slice 2 proof, one step further: not just "the tx exists" but "the
// funds went where the donor was told they went."
// ------------------------------------------------------------------

export type DonationResult =
  | { ok: true; txHash: string; lovelace: number }
  | { ok: false; reason: string; retryable: boolean };

/** How much lovelace this transaction locked at `scriptAddress`, per
 *  the configured testnet's chain. Returns null when the tx isn't
 *  visible yet (retryable); 0 means the tx exists but paid the script
 *  nothing (wrong transaction; not retryable); throws on outages so
 *  they never masquerade as either. */
export async function lockedAtScriptOnConfiguredTestnet(
  txHash: string,
  scriptAddress: string
): Promise<number | null> {
  const net = cardanoNetwork();
  const projectId = process.env.BLOCKFROST_PROJECT_ID;
  if (!projectId) throw new Error("BLOCKFROST_PROJECT_ID is not set.");
  const res = await fetch(`https://cardano-${net}.blockfrost.io/api/v0/txs/${txHash}/utxos`, {
    headers: { project_id: projectId },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Blockfrost lookup failed (${res.status}).`);
  const utxos = (await res.json()) as {
    outputs: { address: string; amount: { unit: string; quantity: string }[] }[];
  };
  return utxos.outputs
    .filter((o) => o.address === scriptAddress)
    .reduce(
      (sum, o) => sum + Number(o.amount.find((a) => a.unit === "lovelace")?.quantity ?? 0),
      0
    );
}

/** Record an identity's donation to the script; but only once the chain
 *  shows value locked there in that transaction. The verifier is
 *  injectable for tests; recording is idempotent per tx hash. */
export async function recordScriptDonation(
  db: PrismaClient,
  input: { profileId: string; txHash: string; scriptAddress: string },
  verify: (txHash: string, scriptAddress: string) => Promise<number | null> =
    lockedAtScriptOnConfiguredTestnet,
  inputAddresses: (txHash: string) => Promise<string[] | null> =
    txInputAddressesOnConfiguredTestnet
): Promise<DonationResult> {
  const txHash = input.txHash.trim().toLowerCase();
  if (!TX_HASH_RE.test(txHash)) {
    return { ok: false, retryable: false, reason: "That isn't a Cardano transaction hash." };
  }
  const link = await walletLinkFor(db, input.profileId);
  if (!link) {
    return {
      ok: false,
      retryable: false,
      reason: "No wallet is linked to this identity yet; connect one first.",
    };
  }
  const lovelace = await verify(txHash, input.scriptAddress);
  if (lovelace === null) {
    return {
      ok: false,
      retryable: true,
      reason:
        `Not visible on ${cardanoNetwork()} yet. If this persists past a couple of ` +
        "minutes, your wallet is probably on the OTHER testnet (Preview); " +
        "the two share the same address format.",
    };
  }
  if (lovelace <= 0) {
    return {
      ok: false,
      retryable: false,
      reason:
        "That transaction exists but locked nothing at the donation script; " +
        "it isn't the donation. Nothing was recorded.",
    };
  }
  const senders = await inputAddresses(txHash);
  if (senders === null) {
    return { ok: false, retryable: true, reason: `Not visible on ${cardanoNetwork()} yet.` };
  }
  if (!senders.some((sender) => sameWalletAccount(sender, link.cardanoAddress))) {
    return { ok: false, retryable: false, reason: NOT_SENT_BY_LINKED };
  }
  await db.testnetDonation.upsert({
    where: { txHash },
    create: {
      profileId: input.profileId,
      txHash,
      lovelace,
      scriptAddress: input.scriptAddress,
      network: cardanoNetwork(),
    },
    update: {},
  });
  return { ok: true, txHash, lovelace };
}

/** This identity's recorded script donations, newest first. */
export async function donationsFor(db: PrismaClient, profileId: string) {
  return db.testnetDonation.findMany({
    where: { profileId },
    orderBy: { createdAt: "desc" },
  });
}
