// Durable lifecycle for wallet-side value movement. The chain remains the
// authority; this record makes preparation, retry, failure, and reconciliation
// understandable without ever storing wallet secrets.

import type { DbOrTx } from "./db";

export const TOKEN_INTENT_STATUSES = [
  "requested",
  "prepared",
  "awaiting_wallet_approval",
  "signed",
  "distributing",
  "submitted",
  "confirmed",
  "rejected",
  "expired",
  "failed",
] as const;
export type TokenIntentStatus = (typeof TOKEN_INTENT_STATUSES)[number];

const NEXT: Record<TokenIntentStatus, readonly TokenIntentStatus[]> = {
  requested: ["prepared", "rejected", "expired", "failed"],
  prepared: ["awaiting_wallet_approval", "distributing", "submitted", "expired", "failed"],
  awaiting_wallet_approval: ["signed", "rejected", "expired", "failed"],
  signed: ["submitted", "failed"],
  distributing: ["submitted", "failed"],
  submitted: ["confirmed", "expired", "failed"],
  confirmed: [],
  rejected: [],
  expired: [],
  failed: [],
};

export function canTransitionTokenIntent(from: string, to: string) {
  if (!TOKEN_INTENT_STATUSES.includes(from as TokenIntentStatus)) return false;
  if (!TOKEN_INTENT_STATUSES.includes(to as TokenIntentStatus)) return false;
  return NEXT[from as TokenIntentStatus].includes(to as TokenIntentStatus);
}

function positiveQuantity(value: string) {
  return /^(?:0*[1-9][0-9]*)$/.test(value);
}

function safeFailureMessage(value?: string) {
  if (!value) return null;
  const compact = value.replace(/\s+/g, " ").trim().slice(0, 240);
  if (/seed phrase|private key|signing key|access key|password|mnemonic/i.test(compact)) {
    return "Sensitive details were removed. Use the failure code for support.";
  }
  return compact;
}

export async function createTokenIntent(
  db: DbOrTx,
  input: {
    profileId: string;
    kind: string;
    currency: "PC" | "G";
    amount: string;
    /** The second leg of a dual-token payment; one transaction, two assets. */
    secondaryCurrency?: "PC" | "G";
    secondaryAmount?: string;
    idempotencyKey: string;
    sourceWalletScope?: string;
    destinationWalletScope?: string;
    refType?: string;
    refId?: string;
  }
) {
  if (!positiveQuantity(input.amount)) throw new Error("Token amount must be a positive integer.");
  if (input.secondaryCurrency || input.secondaryAmount) {
    if (!input.secondaryCurrency || !positiveQuantity(input.secondaryAmount ?? "")) {
      throw new Error("A dual-token intent needs both a second currency and a positive amount.");
    }
    if (input.secondaryCurrency === input.currency) {
      throw new Error("A dual-token intent must name two different tokens.");
    }
  }
  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey || idempotencyKey.length > 160) {
    throw new Error("A bounded idempotency key is required.");
  }
  const intent = await db.tokenTransactionIntent.upsert({
    where: { idempotencyKey },
    create: { ...input, idempotencyKey },
    update: {},
  });
  if (
    intent.profileId !== input.profileId ||
    intent.kind !== input.kind ||
    intent.currency !== input.currency ||
    intent.amount !== input.amount ||
    (intent.sourceWalletScope ?? undefined) !== input.sourceWalletScope ||
    (intent.destinationWalletScope ?? undefined) !== input.destinationWalletScope ||
    (intent.refType ?? undefined) !== input.refType ||
    (intent.refId ?? undefined) !== input.refId
  ) {
    throw new Error("That idempotency key already belongs to a different transaction request.");
  }
  return intent;
}

export async function transitionTokenIntent(
  db: DbOrTx,
  input: {
    id: string;
    to: TokenIntentStatus;
    txHash?: string;
    failureCode?: string;
    failureMessage?: string;
  }
) {
  const current = await db.tokenTransactionIntent.findUnique({ where: { id: input.id } });
  if (!current) return { ok: false as const, reason: "Transaction intent not found." };
  if (!canTransitionTokenIntent(current.status, input.to)) {
    return {
      ok: false as const,
      reason: `Transaction cannot move from ${current.status} to ${input.to}.`,
    };
  }
  const txHash = input.txHash?.trim().toLowerCase();
  if ((input.to === "submitted" || input.to === "confirmed") && !current.txHash && !txHash) {
    return { ok: false as const, reason: "A transaction hash is required." };
  }
  if (txHash && !/^[0-9a-f]{64}$/.test(txHash)) {
    return { ok: false as const, reason: "Transaction hash format is invalid." };
  }
  const now = new Date();
  const data: Record<string, unknown> = { status: input.to };
  if (txHash) data.txHash = txHash;
  if (input.to === "prepared") data.preparedAt = now;
  if (input.to === "submitted") data.submittedAt = now;
  if (input.to === "confirmed") data.confirmedAt = now;
  if (["failed", "rejected", "expired"].includes(input.to)) {
    data.failedAt = now;
    data.failureCode = input.failureCode?.trim().slice(0, 80) || input.to;
    data.failureMessage = safeFailureMessage(input.failureMessage);
  }
  const changed = await db.tokenTransactionIntent.updateMany({
    where: { id: current.id, status: current.status },
    data,
  });
  if (changed.count !== 1) {
    return {
      ok: false as const,
      reason: "Transaction status changed while this update was being applied; reload before retrying.",
    };
  }
  const updated = await db.tokenTransactionIntent.findUniqueOrThrow({
    where: { id: current.id },
  });
  return { ok: true as const, intent: updated };
}

/** Lease an operator-delivered reward before any chain call. A second runner
 * cannot acquire the same prepared intent, and an interrupted lease remains
 * visible for reconciliation rather than being minted twice. */
export async function acquireTokenIntentForDistribution(
  db: DbOrTx,
  input: { id: string; kindPrefix: string }
) {
  const changed = await db.tokenTransactionIntent.updateMany({
    where: {
      id: input.id,
      status: "prepared",
      kind: { startsWith: input.kindPrefix },
    },
    data: { status: "distributing" },
  });
  return changed.count === 1;
}
