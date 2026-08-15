"use client";

import { useRef, useState } from "react";
import type { ProofResult } from "@/lib/chain";

// On-chain migration Slice 2 (ONCHAIN_ECONOMY_MIGRATION.md §5, Track 1):
// the soul's OWN wallet builds, signs, and submits a transaction; a
// ~2 tADA self-send carrying a CIP-20 note. Everything value-touching
// happens in the browser against the wallet's own UTxOs and endpoint;
// the platform holds no key, sees no key, submits nothing. The server's
// only job is verifying the resulting hash really exists on preprod
// before recording it (CIP-30 can't tell preprod from preview).
export function SelfCustodySign({
  network,
  onProof,
}: {
  network: string;
  /** Server action: verify-then-record the signed tx hash. */
  onProof: (formData: FormData) => Promise<ProofResult>;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cancelled = useRef(false);

  async function signProof() {
    setBusy(true);
    cancelled.current = false;
    setStatus("Waiting for Lace…");
    try {
      const { BrowserWallet, Transaction } = await import("@meshsdk/core");
      const wallet = await BrowserWallet.enable("lace");
      const address = await wallet.getChangeAddress();
      if (!address.startsWith("addr_test1")) {
        setStatus(
          "Lace is on MAINNET. This rail is testnet-only; open Lace → " +
            "Settings → Network → Preprod, then try again."
        );
        return;
      }

      // Built in the browser from the WALLET'S own UTxOs; no server
      // round-trip, no platform key, no custody. A self-send: the tADA
      // leaves your wallet and returns to it; only the fee is spent.
      setStatus("Building the transaction in your browser…");
      const tx = new Transaction({ initiator: wallet });
      tx.sendLovelace(address, "2000000");
      tx.setMetadata(674, { msg: ["AgoraNet slice-2 self-custody proof (testnet)"] });
      const unsigned = await tx.build();

      setStatus("Approve the transaction in the Lace popup…");
      const signed = await wallet.signTx(unsigned);

      // Submitted through the WALLET'S endpoint, not the platform's.
      const txHash = await wallet.submitTx(signed);
      setStatus(`Submitted (${txHash.slice(0, 12)}…). Waiting for ${network} to confirm…`);

      // Poll the server, which refuses to record until the hash is
      // actually visible on the configured testnet.
      for (let attempt = 0; attempt < 24; attempt++) {
        if (cancelled.current) return;
        const formData = new FormData();
        formData.set("txHash", txHash);
        const result = await onProof(formData);
        if (result.ok) {
          setStatus(null);
          return;
        }
        if (!result.retryable) {
          setStatus(result.reason);
          return;
        }
        setStatus(
          `Submitted (${txHash.slice(0, 12)}…). ${result.reason} Checking again shortly…`
        );
        await new Promise((r) => setTimeout(r, 5000));
      }
      setStatus(
        "Two minutes without a confirmation; the network may just be slow. " +
          "Your funds are fine (a self-send can't lose them). Try the button " +
          "again in a minute; an already-confirmed transaction records instantly."
      );
    } catch {
      // Declining the Lace popup lands here too; say so plainly.
      setStatus(
        "The wallet didn't complete the signature (declined, locked, or " +
          "unavailable). Nothing left your wallet and nothing was recorded."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={signProof} disabled={busy}>
        {busy ? "Working…" : `Sign the self-custody proof (${network})`}
      </button>
      {status && <p className="notice">{status}</p>}
    </div>
  );
}
