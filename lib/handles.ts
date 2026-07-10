// The handle namespace (owner-ratified 2026-07-10, ONBOARDING Stage 3.4):
// one flat global taken-list across all profiles, both faces — live
// handles PLUS tombstones. It records THAT a string is claimed and
// nothing else: availability is a public fact anyone can probe on any
// platform, so the list carries zero linkage information. Handles are
// never recycled.
//
// Format: 3–30 chars, letters/digits/underscore/hyphen, stored lowercase
// (an attribution key must survive citation — no spaces, no lookalikes
// via case). The spec fixes uniqueness semantics; this charset is the
// minimal implementation of "@handle", noted for owner review.

import type { DbOrTx } from "./db";

const HANDLE_PATTERN = /^[a-z0-9_-]{3,30}$/;

export function normalizeHandle(raw: string): string | null {
  const handle = raw.trim().replace(/^@/, "").toLowerCase();
  return HANDLE_PATTERN.test(handle) ? handle : null;
}

/** Is this handle claimable? Consults live profiles AND tombstones. */
export async function handleTaken(db: DbOrTx, handle: string): Promise<boolean> {
  const [live, tombstone] = await Promise.all([
    db.profile.findUnique({ where: { handle } }),
    db.handleTombstone.findUnique({ where: { handle } }),
  ]);
  return live !== null || tombstone !== null;
}

/**
 * Retire a handle forever — hatching succession, deletion, abandonment.
 * The permanent record's attribution never silently changes owners.
 */
export async function tombstoneHandle(
  db: DbOrTx,
  input: { handle: string; reason: "hatched" | "deleted" | "abandoned" }
): Promise<void> {
  await db.handleTombstone.create({
    data: { handle: input.handle, reason: input.reason },
  });
}
