"use client";

import { useEffect, useRef, useState } from "react";
import type { WalletPostPayload } from "@/lib/walletActions";
import { sameWalletAccount } from "@/lib/cardanoAccounts";

type Prepare = (input: {
  idempotencyKey: string;
  payload: WalletPostPayload;
}) => Promise<
  | {
      ok: true;
      draftId: string;
      intentId: string;
      linkedAddress: string;
      destinationAddress: string;
      treasuryTag: string;
      assetUnit: string;
      amount: string;
      network: "preprod" | "preview";
      expiresAt: string;
    }
  | { ok: false; reason: string; retryable?: boolean }
>;

type Submit = (input: { intentId: string; txHash: string }) => Promise<
  { ok: true; intentId: string } | { ok: false; reason: string }
>;

type Finalize = (input: { intentId: string; discussionId: string }) => Promise<
  | { ok: true; postId: string }
  | { ok: false; reason: string; retryable: boolean }
>;

export function WalletPostComposer({
  discussionId,
  parentId,
  graceMinutes,
  label,
  permanent,
  feeLabel,
  prepare,
  recordSubmission,
  finalize,
  reject,
}: {
  discussionId: string;
  parentId?: string;
  graceMinutes: number;
  label: string;
  permanent: boolean;
  feeLabel: string;
  prepare: Prepare;
  recordSubmission: Submit;
  finalize: Finalize;
  reject: (input: { intentId: string }) => Promise<{ ok: boolean }>;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const lockKey = "agoranet-wallet-post-recovery";
    const priorLock = Number(localStorage.getItem(lockKey) ?? 0);
    if (priorLock && Date.now() - priorLock < 180_000) return;
    const storageKeys = Array.from(
      { length: localStorage.length },
      (_, index) => localStorage.key(index)
    ).filter((key): key is string => Boolean(key));
    const pendingKey = storageKeys.find((key) => {
      if (!key.startsWith("agoranet-wallet-post:")) return false;
      try {
        const value = JSON.parse(localStorage.getItem(key) ?? "{}") as {
          discussionId?: string;
        };
        return value.discussionId === discussionId;
      } catch {
        localStorage.removeItem(key);
        return false;
      }
    });
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
        `Resuming your pending wallet post (${pending.txHash!.slice(0, 12)}…). Do not pay again.`
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
          const result = await finalize({
            intentId: pending.intentId!,
            discussionId,
          });
          if (result.ok) {
            localStorage.removeItem(pendingKey!);
            setStatus("Your recovered wallet post is confirmed and published.");
            window.location.reload();
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
  }, [discussionId, finalize, recordSubmission]);

  async function post(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus("Checking your post before opening Lace…");
    let intentId: string | null = null;
    let submitted = false;
    let submittedHash: string | null = null;
    try {
      const formData = new FormData(event.currentTarget);
      const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
      const payload: WalletPostPayload = {
        discussionId,
        parentId: parentId ?? null,
        body: String(formData.get("body") ?? ""),
        humanMade: formData.get("humanMade") === "on",
        ...(sourceUrl
          ? {
              source: {
                url: sourceUrl,
                kind: String(formData.get("sourceKind") ?? "other"),
                vouch:
                  formData.get("sourceVouch") === "vouched" ? "vouched" : "unverified",
              },
            }
          : {}),
      };
      const prepared = await prepare({
        idempotencyKey: crypto.randomUUID(),
        payload,
      });
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

      setStatus("Opening Lace. Review the fake dPOLL fee before approving it…");
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

      setStatus(`Building a ${prepared.amount} ${feeLabel} testnet payment in your browser…`);
      const tx = new Transaction({ initiator: wallet });
      tx.sendAssets(
        {
          address: prepared.destinationAddress,
          datum: {
            value: mConStr1([stringToHex(prepared.treasuryTag)]),
            inline: true,
          },
        },
        [{ unit: prepared.assetUnit, quantity: prepared.amount }]
      );
      tx.setMetadata(674, {
        msg: [`AgoraNet fee intent ${prepared.intentId}`],
      });
      const unsigned = await tx.build();
      setStatus(`Approve ${prepared.amount} ${feeLabel} in Lace. This is fake testnet value.`);
      const signed = await wallet.signTx(unsigned);
      const txHash = await wallet.submitTx(signed);
      submitted = true;
      submittedHash = txHash;
      const recoveryKey = `agoranet-wallet-post:${prepared.intentId}`;
      localStorage.setItem(
        recoveryKey,
        JSON.stringify({ intentId: prepared.intentId, discussionId, txHash })
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
          `Payment submitted (${txHash.slice(0, 12)}…). Waiting for ${prepared.network} before publishing your post…`
        );
        const result = await finalize({ intentId: prepared.intentId, discussionId });
        if (result.ok) {
          setStatus("Confirmed. Your post is published and your testnet rewards are queued.");
          localStorage.removeItem(recoveryKey);
          formRef.current?.reset();
          window.location.reload();
          return;
        }
        if (!result.retryable) {
          setStatus(result.reason);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
      setStatus(
        "The testnet is taking longer than two minutes. Do not pay again. AgoraNet saved the transaction and will finish the post automatically when it can confirm it."
      );
    } catch {
      setStatus(
        submitted
          ? `The wallet submitted the testnet payment${submittedHash ? ` (${submittedHash.slice(0, 12)}…)` : ""}, but confirmation was interrupted. Do not pay again; reload this browser so AgoraNet can continue recovery, or give support the public transaction hash.`
          : "Lace did not complete the testnet payment (it may be locked, unavailable, or the request was declined). Nothing was published."
      );
      if (intentId && !submitted) await reject({ intentId }).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={post} className="composer">
      <span className="composer-badge">
        {permanent
          ? `Permanent record; you have ${graceMinutes} minutes for visible typo repairs before it locks.`
          : `Author-deletable space; you have ${graceMinutes} minutes to edit.`}
      </span>
      <p className="interim-note">
        Wallet custody: Lace will ask you to approve the testnet dPOLL posting fee. AgoraNet
        never receives your wallet key and will not publish until the chain confirms payment.
        Cardano also requires a small amount of test tADA for the transaction and script output;
        Lace shows the complete testnet transaction before you approve it.
      </p>
      <textarea
        name="body"
        required
        placeholder={permanent ? "Speak deliberately; this space is permanent." : "Add your voice."}
      />
      <div style={{ fontSize: "0.8rem", margin: "0.3rem 0" }}>
        <label>
          <input type="checkbox" name="humanMade" /> Human-made; my reputation on it
        </label>
        <details>
          <summary>Attach a source</summary>
          <input type="text" name="sourceUrl" placeholder="https://…" style={{ width: "60%" }} />{" "}
          <select name="sourceKind" defaultValue="other">
            <option value="study">Study</option>
            <option value="news">News article</option>
            <option value="primary">Primary document</option>
            <option value="book">Book</option>
            <option value="experience">Personal experience</option>
            <option value="other">Other</option>
          </select>{" "}
          <select name="sourceVouch" defaultValue="unverified">
            <option value="vouched">I vouch for this</option>
            <option value="unverified">Sharing unverified</option>
          </select>
        </details>
      </div>
      <button type="submit" disabled={busy}>
        {busy ? "Working with Lace…" : `${label} · ${feeLabel} from Lace`}
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
