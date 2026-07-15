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
