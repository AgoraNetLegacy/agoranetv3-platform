"use client";

import { useRef, useState } from "react";
import type { DonationResult } from "@/lib/chain";

// On-chain migration Slice 3 (ONCHAIN_ECONOMY_MIGRATION.md §5): the
// first real non-custodial value movement. The soul's OWN wallet sends
// tADA to the donation-lock SCRIPT; an address governed by validator
// math, not by anyone's key. Built in the browser from the wallet's own
// UTxOs, signed and submitted by the wallet; the platform holds
// nothing, at any moment. The server then verifies on-chain that the
// funds actually sit at the script before recording the donation.
export function DonateToScript({
  network,
  scriptAddress,
  beneficiaryHash,
  lovelace,
  lockMinutes,
  onDonate,
}: {
  network: string;
  /** The donation-lock script address (derived server-side from the blueprint). */
  scriptAddress: string;
  /** Who may collect after the lock; a verification-key hash (demo: the dev wallet). */
  beneficiaryHash: string;
  /** Donation size in lovelace (a rail). */
  lovelace: number;
  /** Time-lock length in minutes (a rail). */
  lockMinutes: number;
  /** Server action: verify-then-record the donation tx hash. */
  onDonate: (formData: FormData) => Promise<DonationResult>;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cancelled = useRef(false);

  async function donate() {
    setBusy(true);
    cancelled.current = false;
    setStatus("Waiting for Lace…");
    try {
      const { BrowserWallet, Transaction, mConStr0 } = await import("@meshsdk/core");
      const wallet = await BrowserWallet.enable("lace");
      const address = await wallet.getChangeAddress();
      if (!address.startsWith("addr_test1")) {
        setStatus(
          "Lace is on MAINNET. This rail is testnet-only; open Lace → " +
            "Settings → Network → Preprod, then try again."
        );
        return;
      }

      // The datum is the donor's public promise: who may collect, and
      // not before when. Locked inline with the funds, readable by
      // anyone, enforced by the validator.
      const unlockAfter = Date.now() + lockMinutes * 60_000;
      setStatus("Building the donation in your browser…");
      const tx = new Transaction({ initiator: wallet });
      tx.sendLovelace(
        {
          address: scriptAddress,
          datum: { value: mConStr0([beneficiaryHash, unlockAfter]), inline: true },
        },
        String(lovelace)
      );

      setStatus("Approve the donation in the Lace popup…");
      const unsigned = await tx.build();
      const signed = await wallet.signTx(unsigned);

      // Submitted through the WALLET'S endpoint, not the platform's.
      const txHash = await wallet.submitTx(signed);
      setStatus(`Submitted (${txHash.slice(0, 12)}…). Waiting for ${network} to confirm…`);

      // Poll the server, which refuses to record until the chain shows
      // the funds at the script.
      for (let attempt = 0; attempt < 24; attempt++) {
        if (cancelled.current) return;
        const formData = new FormData();
        formData.set("txHash", txHash);
        const result = await onDonate(formData);
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
          "Try the button again in a minute; an already-confirmed donation " +
          "records instantly without a second signature."
      );
    } catch {
      // Declining the Lace popup lands here too; say so plainly.
      setStatus(
        "The wallet didn't complete the donation (declined, locked, or " +
          "unavailable). Nothing left your wallet and nothing was recorded."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={donate} disabled={busy}>
        {busy ? "Working…" : `Donate ${(lovelace / 1_000_000).toLocaleString()} tADA to the script (${network})`}
      </button>
      {status && <p className="notice">{status}</p>}
    </div>
  );
}
