// Server-side donation reconciliation (On-chain migration, Slice 4
// carry-over). The Slice 3 lesson: the chain is the source of truth,
// and a record path that needs the donor's tab to stay open loses the
// race the moment they walk away. So the server mirrors the chain on
// ITS schedule: sweep every linked wallet's recent transactions, and
// any that provably locked value at the donation script but have no
// row yet get recorded — through the same chain-verified path the UI
// uses. Idempotent by construction (one row per tx hash); running it
// twice, or concurrently with a live UI poll, changes nothing.

import type { PrismaClient } from "@prisma/client";
import { cardanoNetwork, lockedAtScriptOnConfiguredTestnet } from "./chain";

export type AddressTxLister = (address: string) => Promise<string[]>;

/** Recent tx hashes touching an address, newest first, from the
 *  configured testnet. 404 = address never used → empty. */
export async function listRecentAddressTxs(address: string): Promise<string[]> {
  const net = cardanoNetwork();
  const projectId = process.env.BLOCKFROST_PROJECT_ID;
  if (!projectId) throw new Error("BLOCKFROST_PROJECT_ID is not set.");
  const res = await fetch(
    `https://cardano-${net}.blockfrost.io/api/v0/addresses/${address}/transactions?order=desc&count=25`,
    { headers: { project_id: projectId }, cache: "no-store" }
  );
  // 404 = never used; 400 = not a decodable address (a dev placeholder
  // link, say). Neither can hold donations — skip, don't kill the
  // sweep. Real failures (auth, rate limit, outage) still throw.
  if (res.status === 404 || res.status === 400) return [];
  if (!res.ok) throw new Error(`Blockfrost address lookup failed (${res.status}).`);
  return ((await res.json()) as { tx_hash: string }[]).map((t) => t.tx_hash.toLowerCase());
}

/** Sweep all linked wallets for donations the database missed. Returns
 *  what was recovered. Dependencies injectable for tests. */
export async function reconcileDonations(
  db: PrismaClient,
  scriptAddress: string,
  deps: {
    listTxs?: AddressTxLister;
    lockedAtScript?: (txHash: string, scriptAddress: string) => Promise<number | null>;
  } = {}
): Promise<{ walletsScanned: number; recovered: { txHash: string; lovelace: number }[] }> {
  const listTxs = deps.listTxs ?? listRecentAddressTxs;
  const lockedAtScript = deps.lockedAtScript ?? lockedAtScriptOnConfiguredTestnet;
  const links = await db.testnetWalletLink.findMany();
  const recovered: { txHash: string; lovelace: number }[] = [];
  for (const link of links) {
    for (const txHash of await listTxs(link.cardanoAddress)) {
      const known = await db.testnetDonation.findUnique({ where: { txHash } });
      if (known) continue;
      const lovelace = await lockedAtScript(txHash, scriptAddress);
      if (lovelace === null || lovelace <= 0) continue;
      await db.testnetDonation.upsert({
        where: { txHash },
        create: {
          profileId: link.profileId,
          txHash,
          lovelace,
          scriptAddress,
          network: cardanoNetwork(),
        },
        update: {},
      });
      recovered.push({ txHash, lovelace });
    }
  }
  return { walletsScanned: links.length, recovered };
}
