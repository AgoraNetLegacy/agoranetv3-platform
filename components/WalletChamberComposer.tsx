"use client";

import { useEffect, useRef, useState } from "react";
import type { WalletChamberPayload } from "@/lib/walletChamber";
import { sameWalletAccount } from "@/lib/cardanoAccounts";

type PreparedAsset = { currency: "PC" | "G"; unit: string; quantity: string };

type Prepare = (input: {
  idempotencyKey: string;
  payload: WalletChamberPayload;
}) => Promise<
  | {
      ok: true;
      draftId: string;
      intentId: string;
      linkedAddress: string;
      destinationAddress: string;
      treasuryTag: string;
      assets: PreparedAsset[];
      network: "preprod" | "preview";
      expiresAt: string;
    }
  | { ok: false; reason: string; retryable?: boolean }
>;

type Submit = (input: { intentId: string; txHash: string }) => Promise<
  { ok: true; intentId: string } | { ok: false; reason: string }
>;

type Finalize = (input: { intentId: string }) => Promise<
  { ok: true; chamberId: string } | { ok: false; reason: string; retryable: boolean }
>;

const RECOVERY_PREFIX = "agoranet-wallet-chamber:";

function describe(assets: PreparedAsset[]) {
  return assets
    .map((asset) => `${asset.quantity} ${asset.currency === "PC" ? "dPOLL" : "dGRA"}`)
    .join(" + ");
}

export function WalletChamberComposer({
  costLabel,
  prepare,
  recordSubmission,
  finalize,
  reject,
}: {
  costLabel: string;
  prepare: Prepare;
  recordSubmission: Submit;
  finalize: Finalize;
  reject: (input: { intentId: string }) => Promise<{ ok: boolean }>;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // A chamber whose payment confirmed but whose browser closed mid-flight
  // must never be lost or paid for twice: the submitted hash is parked in
  // localStorage and resumed here.
  useEffect(() => {
    const lockKey = "agoranet-wallet-chamber-recovery";
    const priorLock = Number(localStorage.getItem(lockKey) ?? 0);
    if (priorLock && Date.now() - priorLock < 180_000) return;
    const storageKeys = Array.from(
      { length: localStorage.length },
      (_, index) => localStorage.key(index)
    ).filter((key): key is string => Boolean(key));
    const pendingKey = storageKeys.find((key) => key.startsWith(RECOVERY_PREFIX));
    if (!pendingKey) return;
    localStorage.setItem(lockKey, String(Date.now()));
    const pending = JSON.parse(localStorage.getItem(pendingKey) ?? "{}") as {
      intentId?: string;
      txHash?: string;
    };
    if (!pending.intentId || !pending.txHash) {
      localStorage.removeItem(pendingKey);
      localStorage.removeItem(lockKey);
      return;
    }
    let cancelled = false;
    async function recover() {
      setBusy(true);
      setStatus(
        `Resuming your pending chamber payment (${pending.txHash!.slice(0, 12)}…). Do not pay again.`
      );
      try {
        const recorded = await recordSubmission({
          intentId: pending.intentId!,
          txHash: pending.txHash!,
        });
        if (!recorded.ok) {
          setStatus(`${recorded.reason} Do not pay again; give support the saved public hash.`);
          return;
        }
        for (let attempt = 0; attempt < 24 && !cancelled; attempt++) {
          const result = await finalize({ intentId: pending.intentId! });
          if (result.ok) {
            localStorage.removeItem(pendingKey!);
            setStatus("Your recovered chamber payment confirmed. Opening the chamber…");
            window.location.href = `/pollinator/${result.chamberId}`;
            return;
          }
          if (!result.retryable) {
            setStatus(result.reason);
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
        if (!cancelled) {
          setStatus(
            "The saved payment is still pending. Do not pay again; reload later or give support the public transaction hash."
          );
        }
      } catch {
        if (!cancelled) {
          setStatus(
            "AgoraNet could not resume the saved payment yet. Do not pay again; reload later or give support the public transaction hash."
          );
        }
      } finally {
        localStorage.removeItem(lockKey);
        if (!cancelled) setBusy(false);
      }
    }
    void recover();
    return () => {
      cancelled = true;
      localStorage.removeItem(lockKey);
    };
  }, [finalize, recordSubmission]);

  async function open(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus("Checking the chamber brief before opening Lace…");
    let intentId: string | null = null;
    let submitted = false;
    let submittedHash: string | null = null;
    try {
      const formData = new FormData(event.currentTarget);
      const payload: WalletChamberPayload = {
        title: String(formData.get("title") ?? ""),
        subject: String(formData.get("subject") ?? ""),
        pitch: String(formData.get("pitch") ?? ""),
        whyCare: String(formData.get("whyCare") ?? ""),
        isPublic: formData.get("visibility") !== "private",
        scaffold: {
          solving: String(formData.get("solving") ?? ""),
          needToKnow: String(formData.get("needToKnow") ?? ""),
          success: String(formData.get("success") ?? ""),
        },
      };
      const prepared = await prepare({ idempotencyKey: crypto.randomUUID(), payload });
      if (!prepared.ok) {
        setStatus(prepared.reason);
        return;
      }
      intentId = prepared.intentId;
      if (new Date(prepared.expiresAt) <= new Date()) {
        await reject({ intentId: prepared.intentId });
        setStatus("This wallet request expired before Lace opened. Try again.");
        return;
      }

      setStatus("Opening Lace. Review the fake dPOLL and dGRA payment before approving it…");
      const { BrowserWallet, Transaction, mConStr1, stringToHex } = await import(
        "@meshsdk/core"
      );
      const available = await BrowserWallet.getAvailableWallets();
      if (!available.some((wallet) => wallet.id === "lace")) {
        await reject({ intentId: prepared.intentId });
        setStatus("Lace is not available in this browser. Install or unlock Lace, then try again.");
        return;
      }
      const wallet = await BrowserWallet.enable("lace");
      const [changeAddress, usedAddresses, unusedAddresses] = await Promise.all([
        wallet.getChangeAddress(),
        wallet.getUsedAddresses(),
        wallet.getUnusedAddresses(),
      ]);
      const availableAddresses = [changeAddress, ...usedAddresses, ...unusedAddresses];
      if (!changeAddress.startsWith("addr_test1")) {
        await reject({ intentId: prepared.intentId });
        setStatus(
          `Lace is on mainnet. Open Lace, switch to ${prepared.network}, and try again. Nothing was charged.`
        );
        return;
      }
      if (!availableAddresses.some((address) => sameWalletAccount(address, prepared.linkedAddress))) {
        await reject({ intentId: prepared.intentId });
        setStatus(
          "Lace opened a different account from the one linked to this AgoraNet identity. Switch accounts in Lace and try again."
        );
        return;
      }

      const summary = describe(prepared.assets);
      setStatus(`Building a ${summary} testnet payment in your browser…`);
      // Both tokens ride ONE output: the dual-token signature settled in a
      // single signature, so a chamber can never be half-paid on chain.
      const tx = new Transaction({ initiator: wallet });
      tx.sendAssets(
        {
          address: prepared.destinationAddress,
          datum: { value: mConStr1([stringToHex(prepared.treasuryTag)]), inline: true },
        },
        prepared.assets.map((asset) => ({ unit: asset.unit, quantity: asset.quantity }))
      );
      tx.setMetadata(674, { msg: [`AgoraNet chamber intent ${prepared.intentId}`] });
      const unsigned = await tx.build();
      setStatus(`Approve ${summary} in Lace. This is fake testnet value.`);
      const signed = await wallet.signTx(unsigned);
      const txHash = await wallet.submitTx(signed);
      submitted = true;
      submittedHash = txHash;
      const recoveryKey = `${RECOVERY_PREFIX}${prepared.intentId}`;
      localStorage.setItem(
        recoveryKey,
        JSON.stringify({ intentId: prepared.intentId, txHash })
      );
      let recorded: Awaited<ReturnType<Submit>> | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          recorded = await recordSubmission({ intentId: prepared.intentId, txHash });
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
      if (!recorded) {
        setStatus(
          `Lace submitted the testnet payment (${txHash.slice(0, 12)}…), but AgoraNet could not save it yet. Do not pay again. Reload this browser and give support the public transaction hash if it remains pending.`
        );
        return;
      }
      if (!recorded.ok) {
        setStatus(
          `${recorded.reason} Your testnet transaction hash is ${txHash}; do not pay again. Ask support to reconcile it.`
        );
        return;
      }

      for (let attempt = 0; attempt < 24; attempt++) {
        setStatus(
          `Payment submitted (${txHash.slice(0, 12)}…). Waiting for ${prepared.network} before opening your chamber…`
        );
        const result = await finalize({ intentId: prepared.intentId });
        if (result.ok) {
          setStatus("Confirmed. Your chamber is open.");
          localStorage.removeItem(recoveryKey);
          formRef.current?.reset();
          window.location.href = `/pollinator/${result.chamberId}`;
          return;
        }
        if (!result.retryable) {
          setStatus(result.reason);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
      setStatus(
        "The testnet is taking longer than two minutes. Do not pay again. AgoraNet saved the transaction and will open the chamber automatically when it can confirm it."
      );
    } catch {
      setStatus(
        submitted
          ? `The wallet submitted the testnet payment${submittedHash ? ` (${submittedHash.slice(0, 12)}…)` : ""}, but confirmation was interrupted. Do not pay again; reload this browser so AgoraNet can continue recovery, or give support the public transaction hash.`
          : "Lace did not complete the testnet payment (it may be locked, unavailable, or the request was declined). No chamber was opened."
      );
      if (intentId && !submitted) await reject({ intentId }).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={open} className="composer">
      <p className="interim-note">
        <strong>Self-custody.</strong> Lace will ask you to approve{" "}
        <strong>{costLabel}</strong> in one transaction; both tokens together,
        because the Pollinator charges in both. AgoraNet never receives your
        wallet key, and no chamber exists until the chain confirms the payment.
        Cardano also requires a small amount of test tADA for the transaction
        and script output; Lace shows the complete testnet transaction before
        you approve it.
      </p>
      <p className="interim-note">
        <strong>Know this before you pay.</strong> Wallet settlement covers
        opening the chamber. Posting inside its workshop still costs 1 PC and
        1 G from a platform-held balance; per-post signing is not built, and a
        Lace approval for every draft would be the wrong shape for a
        micro-fee. If you hold nothing in platform custody you will be able to
        open this chamber and invite others, but not yet post in it yourself.
      </p>
      <div className="chamber-field">
        <label htmlFor="wallet-chamber-title">
          <span className="field-label">Title; the short name</span>
        </label>
        <input
          id="wallet-chamber-title"
          type="text"
          name="title"
          required
          maxLength={80}
          placeholder="A clear name for your chamber"
        />
      </div>
      <div className="chamber-field">
        <label htmlFor="wallet-chamber-subject">
          <span className="field-label">Subject; one chamber, one idea</span>
        </label>
        <input
          id="wallet-chamber-subject"
          type="text"
          name="subject"
          required
          maxLength={200}
          placeholder="What is this chamber exploring?"
        />
      </div>
      <label>
        Storefront pitch; the public profile of the idea
        <textarea name="pitch" required maxLength={2000} />
      </label>
      <label>
        Why should people care; what problem, for whom, why now
        <textarea
          name="whyCare"
          required
          maxLength={1000}
          placeholder="A chamber that cannot answer this isn't ready to ask for attention."
        />
      </label>
      <p className="interim-note">
        <strong>The pre-convo scaffold</strong>; the platform&apos;s
        first-principles method, productized. Work starts oriented, not adrift;
        you can sharpen these as understanding grows (edit history stays
        visible in the workshop).
      </p>
      <label>
        1. What are we solving?; the goal statement
        <textarea name="solving" required maxLength={1000} />
      </label>
      <label>
        2. What do we need to know?; the information and expertise the work requires
        <textarea name="needToKnow" required maxLength={1000} />
      </label>
      <label>
        3. What does success look like?; the definition of done
        <textarea name="success" required maxLength={1000} />
      </label>
      <label>
        Visibility; fixed at creation{" "}
        <select name="visibility" defaultValue="public">
          <option value="public">
            Public; anyone verified may enter; tournament-eligible later
          </option>
          <option value="private">
            Private; you select who gets invited; never competes
          </option>
        </select>
      </label>
      <button type="submit" disabled={busy}>
        {busy ? "Working with Lace…" : `Open the chamber · ${costLabel} from Lace`}
      </button>
      {status && (
        <p className="notice">
          {status}
          {status.includes("permanence and Constitution acknowledgments") && (
            <>
              {" "}
              <a
                href={`/verify/consents?returnTo=${encodeURIComponent(
                  typeof window === "undefined" ? "/" : window.location.pathname
                )}`}
              >
                Complete onboarding acknowledgments
              </a>
              {" "}to continue.
            </>
          )}
        </p>
      )}
    </form>
  );
}
