// Scoped nullifiers, Phase A (DUAL_IDENTITY_MODULE.md §4.1, §10).
//
// A nullifier proves "this subject already acted in this scope" without
// revealing who; and without a stored link to either public identity. Phase A
// implementation: HMAC(operator secret, scope + subject). One-way and
// unlinkable to a profile in every record it appears in, but the operator
// holds the secret; operator-trusted integrity, honestly disclosed
// (PHASE_A_DISCLOSURE in lib/gate.ts). Phase B replaces this with a ZK
// nullifier derived client-side from the humanity credential; Phase C
// retires the secret. The *interface*; scope in, opaque nullifier out;
// is the contract that survives the cutover.
//
// Scope design is product policy (§4.2, owner-ratified 2026-07-06):
// per-profile everywhere for voting-like acts (each identity an independent
// voice); per-human reserved for registration scopes (the one-True-Self /
// one-Alias enforcement itself) and held in reserve elsewhere. Both scope
// kinds exist from day one, by build order.

import { createHmac } from "crypto";

export type ScopeKind = "per-profile" | "per-human";

function operatorSecret(): string {
  const secret = process.env.GATE_OPERATOR_SECRET;
  if (!secret || secret === "replace-me-with-a-real-secret") {
    throw new Error(
      "GATE_OPERATOR_SECRET is required to derive Phase A nullifiers."
    );
  }
  return secret;
}

/**
 * Derive the nullifier for one subject in one scope.
 *
 * - `per-profile`: subjectId is the profile's id; the same human's two
 *   identities produce unrelated nullifiers (two voices, deliberately).
 * - `per-human`: subjectId is the human's id; both identities produce the SAME
 *   nullifier, so a second attempt is detectable as a duplicate without
 *   the platform learning which identities are siblings.
 *
 * The scope kind is folded into the HMAC input so the two kinds can never
 * collide even if a profile id and human id were ever equal.
 */
export function nullifierFor(
  scope: string,
  scopeKind: ScopeKind,
  subjectId: string
): string {
  return createHmac("sha256", operatorSecret())
    .update(`${scopeKind}:${scope}:${subjectId}`)
    .digest("hex");
}
