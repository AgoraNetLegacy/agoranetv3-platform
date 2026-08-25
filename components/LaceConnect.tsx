"use client";

import { useState, useTransition } from "react";

// The Lace testnet connect flow (TESTNET_RAILS_SPEC §1.3, §6.4 step 1):
// CIP-30 in the browser, honestly labeled. The wallet stays the
// soul's; connecting shares one testnet ADDRESS with the platform,
// nothing more; no keys, no custody, no mainnet. Mesh's BrowserWallet
// wraps the CIP-30 API and hands back bech32 addresses directly.
export function LaceConnect({
  network,
  identity,
  onLink,
}: {
  network: string;
  identity: "True Self" | "Alias";
  /** Server action: records the address for the active identity. */
  onLink: (formData: FormData) => Promise<void>;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [candidateAddress, setCandidateAddress] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function connect() {
    setStatus(null);
    setCandidateAddress(null);
    try {
      // Loaded on click, not on page load; the wallet SDK is heavy
      // and most page views never touch it.
      const { BrowserWallet } = await import("@meshsdk/core");
      const available = await BrowserWallet.getAvailableWallets();
      if (!available.some((w) => w.id === "lace")) {
        setStatus(
          "Lace isn't detected in this browser. Install it from lace.io, " +
            "switch it to the Preprod network, and try again."
        );
        return;
      }
      const wallet = await BrowserWallet.enable("lace");
      // The change address belongs to the account currently authorized in
      // Lace. Used/unused lists can retain addresses from another account,
      // which previously linked an Alias to a different account than the one
      // visible in Lace. Server-side balance reads aggregate the whole stake
      // account, so an unused change address is safe and stable as the link.
      const changeAddress = await wallet.getChangeAddress();
      if (!changeAddress.startsWith("addr_test1")) {
        setStatus(
          "Lace is connected to MAINNET. This rail is testnet-only by " +
            "design; open Lace → Settings → Network → Preprod, then try again."
        );
        return;
      }
      setCandidateAddress(changeAddress);
    } catch (e) {
      // The soul declining the wallet prompt lands here too; say so
      // plainly, blame nobody.
      setStatus(
        "The wallet didn't complete the connection (declined, locked, or " +
          "unavailable). Nothing was recorded; try again when ready."
      );
    }
  }

  function confirmConnection() {
    if (!candidateAddress) return;
    const formData = new FormData();
    formData.set("cardanoAddress", candidateAddress);
    formData.set("network", network);
    startTransition(async () => {
      await onLink(formData);
    });
  }

  return (
    <div>
      {!candidateAddress ? (
        <button type="button" onClick={connect} disabled={pending}>
          {pending ? "Opening Lace…" : `Connect Lace to ${identity}`}
        </button>
      ) : (
        <div className="notice">
          <strong>Confirm this wallet connection</strong>
          <p>
            Lace returned this {network} address for your {identity}:
            <br />
            <code>
              {candidateAddress.slice(0, 12)}…{candidateAddress.slice(-12)}
            </code>
          </p>
          {identity === "Alias" && (
            <p>
              Use a different Cardano account from your True Self. The same
              address cannot be linked to both identities.
            </p>
          )}
          <button type="button" onClick={confirmConnection} disabled={pending}>
            {pending ? "Saving…" : `Confirm ${identity} wallet`}
          </button>{" "}
          <button
            type="button"
            className="linklike"
            onClick={() => setCandidateAddress(null)}
            disabled={pending}
          >
            Cancel
          </button>
        </div>
      )}
      {status && <p className="notice">{status}</p>}
    </div>
  );
}
