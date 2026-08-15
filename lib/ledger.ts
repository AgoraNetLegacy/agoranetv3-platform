// The Civic Ledger; v3 reimplementation of the v2 pattern (declared reuse,
// DUAL_IDENTITY_MODULE.md §9).
//
// Rules:
// 1. Append-only. Nothing edits or deletes ledger rows; corrections are
//    new amendment events.
// 2. Every event's entryHash commits to the previous event's hash,
//    forming a verifiable chain back to GENESIS.
// 3. Pseudonym-only (DUAL_IDENTITY §1.2 invariant 3): no Human id, no
//    Profile db id; only pseudonyms, nullifiers, commitments. db:verify
//    scans the whole chain for leaks and fails loudly.
// 4. When on-chain anchoring arrives (Phase 9, Arweave/Midnight), batches
//    of entryHashes are anchored; nothing in this module changes.

import { createHash } from "crypto";
import type { DbOrTx } from "./db";

export const GENESIS_HASH = "GENESIS";

export interface LedgerEventInput {
  actorType: "system" | "soul" | "founder" | "moderator";
  /** A pseudonym, or null for system events; never an internal db id. */
  actorId?: string | null;
  eventType: string;
  payload: Record<string, unknown>;
}

/** Deterministic JSON: keys sorted recursively so hashes are stable. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
  return `{${entries.join(",")}}`;
}

/** entryHash = sha256(prevHash + "|" + eventType + "|" + canonical payload) */
export function computeEntryHash(
  prevHash: string,
  eventType: string,
  canonicalPayload: string
): string {
  return createHash("sha256")
    .update(`${prevHash}|${eventType}|${canonicalPayload}`)
    .digest("hex");
}

/**
 * Append one event to the ledger. Reads the latest event's hash and chains
 * onto it. Call inside a transaction when appending alongside other writes.
 */
export async function appendEvent(db: DbOrTx, input: LedgerEventInput) {
  const last = await db.ledgerEvent.findFirst({
    orderBy: { seq: "desc" },
    select: { entryHash: true },
  });
  const prevHash = last?.entryHash ?? GENESIS_HASH;
  const payload = canonicalJson(input.payload);
  const entryHash = computeEntryHash(prevHash, input.eventType, payload);

  return db.ledgerEvent.create({
    data: {
      prevHash,
      entryHash,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      eventType: input.eventType,
      payload,
    },
  });
}

/**
 * Identity-leak guard (v2's findForbiddenId, reimplemented). The public
 * ledger must speak only in pseudonyms; never a Human id, never a raw
 * Profile db id. Scans an event's actorId and canonical payload for any
 * forbidden identifier and returns the first one found, or null if the
 * event is clean. db:verify runs this over the whole chain so the leak
 * can never silently return.
 */
export function findForbiddenId(
  event: { actorId: string | null; payload: string },
  forbiddenIds: Iterable<string>
): string | null {
  const haystack = `${event.actorId ?? ""} ${event.payload}`;
  for (const id of Array.from(forbiddenIds)) {
    if (id && haystack.includes(id)) return id;
  }
  return null;
}

export interface ChainCheckResult {
  valid: boolean;
  checked: number;
  firstBrokenSeq: number | null;
  reason: string | null;
}

/** Re-verify the entire chain from GENESIS forward. */
export function verifyChain(
  events: Array<{
    seq: number;
    prevHash: string;
    entryHash: string;
    eventType: string;
    payload: string;
  }>
): ChainCheckResult {
  let expectedPrev = GENESIS_HASH;
  for (const ev of events) {
    if (ev.prevHash !== expectedPrev) {
      return {
        valid: false,
        checked: ev.seq,
        firstBrokenSeq: ev.seq,
        reason: `prevHash mismatch at seq ${ev.seq}`,
      };
    }
    const recomputed = computeEntryHash(ev.prevHash, ev.eventType, ev.payload);
    if (recomputed !== ev.entryHash) {
      return {
        valid: false,
        checked: ev.seq,
        firstBrokenSeq: ev.seq,
        reason: `entryHash mismatch at seq ${ev.seq} (payload or type altered)`,
      };
    }
    expectedPrev = ev.entryHash;
  }
  return { valid: true, checked: events.length, firstBrokenSeq: null, reason: null };
}
