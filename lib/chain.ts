// The Cardano testnet rail (Phase 8.6 — TESTNET_RAILS_SPEC §1.3, §6).
// TESTNET-ONLY BY CONSTRUCTION: the network selector refuses mainnet
// values, the wallet-link path refuses mainnet addresses, and nothing
// in this module custodies anything — the wallet stays the soul's;
// the platform records only which testnet address a face chose to
// connect. The Phase A gate machinery is untouched (§6.6): this rail
// is additive.

import type { PrismaClient } from "@prisma/client";

const TESTNETS = new Set(["preprod", "preview"]);

/** The configured Cardano testnet (§6.1). Throws on mainnet — this
 *  phase has no production posture at all, and a misconfigured env
 *  should fail loudly, not quietly reach a real network. */
export function cardanoNetwork(): "preprod" | "preview" {
  const net = process.env.CARDANO_NETWORK ?? "preprod";
  if (!TESTNETS.has(net)) {
    throw new Error(
      `CARDANO_NETWORK must be a Cardano TESTNET ("preprod" or "preview"); got "${net}". ` +
        "Mainnet is out of scope for Phase 8.6 by ratified design (§6.6)."
    );
  }
  return net as "preprod" | "preview";
}

export type WalletLinkResult = { ok: true } | { ok: false; reason: string };

/** Record which testnet address this face connected (§6.3). One link
 *  per face (re-connecting updates it); mainnet addresses are refused
 *  at the door — addr1… never enters this table. */
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
        "This phase runs no mainnet anything — if your wallet shows addr1…, " +
        "switch it to the Preprod network first.",
    };
  }
  if (!TESTNETS.has(input.network)) {
    return { ok: false, reason: "Only testnet networks (preprod, preview) can be linked." };
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
  return { ok: true };
}

/** The face's current testnet wallet link, if any. */
export async function walletLinkFor(db: PrismaClient, profileId: string) {
  return db.testnetWalletLink.findUnique({ where: { profileId } });
}

// ------------------------------------------------------------------
// On-chain migration Slice 2: the self-custody proof. The soul's OWN
// wallet builds, signs, and submits a transaction in the browser; the
// platform never sees a key and never submits anything. All the server
// does is VERIFY the claimed hash exists on the configured testnet
// before recording it — CIP-30 cannot distinguish preprod from preview
// (both report networkId 0), so the 8.6 wrong-testnet gotcha is closed
// here with a real check instead of a footnote.
// ------------------------------------------------------------------

const TX_HASH_RE = /^[0-9a-f]{64}$/i;

export type ProofResult =
  | { ok: true; txHash: string }
  | { ok: false; reason: string; retryable: boolean };

/** Does this transaction exist on the CONFIGURED testnet? Blockfrost,
 *  server-side only — the browser never holds the project key. Returns
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

/** Record the face's self-custody proof — but only once the tx is
 *  actually visible on the configured testnet. Not-yet-found is
 *  retryable (propagation takes seconds to a couple of minutes);
 *  the caller polls. The verifier is injectable for tests. */
export async function recordSelfCustodyProof(
  db: PrismaClient,
  input: { profileId: string; txHash: string },
  verify: (txHash: string) => Promise<boolean> = txExistsOnConfiguredTestnet
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
      reason: "No wallet is linked to this face yet — connect one first.",
    };
  }
  const found = await verify(txHash);
  if (!found) {
    return {
      ok: false,
      retryable: true,
      reason:
        `Not visible on ${cardanoNetwork()} yet. If this persists past a couple of ` +
        "minutes, your wallet is probably on the OTHER testnet (Preview) — " +
        "the two share the same address format.",
    };
  }
  await db.testnetWalletLink.update({
    where: { profileId: input.profileId },
    data: { proofTxHash: txHash, proofAt: new Date() },
  });
  return { ok: true, txHash };
}
