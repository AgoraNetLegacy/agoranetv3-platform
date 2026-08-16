"use client";

import { useState, useTransition } from "react";

// The Lace testnet connect flow (TESTNET_RAILS_SPEC §1.3, §6.4 step 1):
// CIP-30 in the browser, honestly labeled. The wallet stays the
// soul's; connecting shares one testnet ADDRESS with the platform,
// nothing more; no keys, no custody, no mainnet. Mesh's BrowserWallet
// wraps the CIP-30 API and hands back bech32 addresses directly.
export function LaceConnect({
  network,
  onLink,
}: {
  network: string;
  /** Server action: records the address for the active face. */
  onLink: (formData: FormData) => Promise<void>;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function connect() {
    setStatus(null);
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
      // Prefer a used receive address so read-only balance checks follow the
      // address that holds the wallet's existing test assets. Fall back to
      // the change address for a brand-new wallet.
      const usedAddresses = await wallet.getUsedAddresses();
      const address = usedAddresses[0] ?? (await wallet.getChangeAddress());
      if (!address.startsWith("addr_test1")) {
        setStatus(
          "Lace is connected to MAINNET. This rail is testnet-only by " +
            "design; open Lace → Settings → Network → Preprod, then try again."
        );
        return;
      }
      const formData = new FormData();
      formData.set("cardanoAddress", address);
      formData.set("cardanoAddresses", JSON.stringify(usedAddresses.length ? usedAddresses : [address]));
      formData.set("network", network);
      startTransition(async () => {
        await onLink(formData);
      });
    } catch (e) {
      // The soul declining the wallet prompt lands here too; say so
      // plainly, blame nobody.
      setStatus(
        "The wallet didn't complete the connection (declined, locked, or " +
          "unavailable). Nothing was recorded; try again when ready."
      );
    }
  }

  return (
    <div>
      <button type="button" onClick={connect} disabled={pending}>
        {pending ? "Recording…" : `Connect Lace (${network})`}
      </button>
      {status && <p className="notice">{status}</p>}
    </div>
  );
}
