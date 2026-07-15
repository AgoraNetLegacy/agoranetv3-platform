// The anchor cadence (Phase 8.6 slice 4 — TESTNET_RAILS_SPEC §3;
// ARWEAVE_RECORDS' ratified daily-anchor cadence, at testnet grade).
//
// The internal hash-chained ledger stays the system of record; anchoring
// writes its head hash into a public preprod transaction's metadata so an
// external chain witnesses the history — after an anchor, silently
// rewriting anything before it means beating SHA-256 AND a public
// blockchain. This module is the CADENCE brain only (pure database):
// when an anchor is due, what was anchored, and how to record one. The
// chain submission itself lives in lib/chainMint.ts (Node-only, never in
// the request path) and is injected by the runner —
// scripts/chain/anchor-ledger.ts, which joins the ops-job roster
// (backup/drill/crush/prune) that the deployment host runs on schedule.
//
// Cadence is a rail (anchor.cadenceHours, default daily), and the runner
// is idempotent: not due → no-op; nothing new since the last anchor →
// no-op (an idle ledger needs no fresh witness).

import type { DbOrTx } from "./db";
import { appendEvent } from "./ledger";
import { getRail } from "./rails";

export interface AnchorStatus {
  /** The ledger head — what an anchor run would witness. */
  headSeq: number | null;
  headHash: string | null;
  /** The most recent ledger.anchored event, if any. */
  lastAnchor: {
    at: Date;
    anchoredSeq: number;
    headHash: string;
    txHash: string;
  } | null;
  cadenceHours: number;
  /** True when a run should anchor now: events exist, the cadence has
   *  elapsed (or nothing was ever anchored), and the head moved since
   *  the last anchor. */
  due: boolean;
}

export async function anchorStatus(db: DbOrTx): Promise<AnchorStatus> {
  const cadenceHours = await getRail(db, "anchor.cadenceHours");
  const head = await db.ledgerEvent.findFirst({
    orderBy: { seq: "desc" },
    select: { seq: true, entryHash: true },
  });
  const lastEvent = await db.ledgerEvent.findFirst({
    where: { eventType: "ledger.anchored" },
    orderBy: { seq: "desc" },
    select: { seq: true, createdAt: true, payload: true },
  });

  let lastAnchor: AnchorStatus["lastAnchor"] = null;
  if (lastEvent) {
    const p = JSON.parse(lastEvent.payload) as {
      anchoredSeq: number;
      headHash: string;
      txHash: string;
    };
    lastAnchor = { at: lastEvent.createdAt, ...p };
  }

  const cadenceMs = cadenceHours * 60 * 60 * 1000;
  const elapsed = !lastAnchor || Date.now() - lastAnchor.at.getTime() >= cadenceMs;
  // "Moved" compares against the anchor EVENT's own seq (not the
  // anchored seq): the ledger.anchored event is always newer than what
  // it anchored, and an idle ledger whose newest event is its own last
  // anchor needs no fresh witness.
  const headMoved = !!head && (!lastEvent || head.seq > lastEvent.seq);
  return {
    headSeq: head?.seq ?? null,
    headHash: head?.entryHash ?? null,
    lastAnchor,
    cadenceHours,
    due: !!head && elapsed && headMoved,
  };
}

/** Record a completed anchor: the anchored row gains its external
 *  reference (the Phase 0 anchorRef field doing its job), and the
 *  ledger gains a public ledger.anchored event — so the cadence itself
 *  is auditable history, and /transparency renders from the record. */
export async function recordAnchor(
  db: DbOrTx,
  input: { anchoredSeq: number; headHash: string; txHash: string; network: string }
) {
  await db.ledgerEvent.update({
    where: { seq: input.anchoredSeq },
    data: { anchorRef: input.txHash },
  });
  return appendEvent(db, {
    actorType: "system",
    actorId: null,
    eventType: "ledger.anchored",
    payload: {
      anchoredSeq: input.anchoredSeq,
      headHash: input.headHash,
      txHash: input.txHash,
      network: input.network,
    },
  });
}
