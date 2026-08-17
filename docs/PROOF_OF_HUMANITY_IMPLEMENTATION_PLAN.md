# Proof of Humanity Implementation Plan

Status: Phase 0/Turnstile integration deployed and verified in Vercel
Production; independent proof-of-humanity issuer selection remains open.

## Phase 0 — Correct the present-tense claim ✅ deployed

- Replace the live gate introduction's “independent issuer,” “one real
  human,” and “community with no bots” wording with the Phase A interim
  disclosure already used on the verification screen.
- Add a visible distinction between the live interim path and the local /
  testnet Identus demonstration.
- Add tests that prevent the old claim from returning to user-facing copy.
- Record the change in `CHECKPOINTS.md` and the deployment baseline.

Exit condition: the live copy accurately describes what Phase A does and does
not prove.

## Phase 1 — Baseline anti-abuse controls ✅ Turnstile deployed

- Keep the existing globally unique, never-recycled handle constraint.
- Add a server-verified CAPTCHA adapter at verification and registration;
  prefer invisible or risk-triggered challenges only for future secondary
  flows. Every True Self and Alias registration is mandatory, not randomized.
  The first slice adds Cloudflare Turnstile at the verification gate and both
  registration ceremonies; it is disabled until `TURNSTILE_ENABLED=true` and
  hosted keys are configured.
- Keep rate limits, IP handling, and retention within the existing log
  discipline rules.
- Make challenge failures retryable and avoid account-linkage disclosures.

Exit condition: automated abuse is harder, but the UI never calls CAPTCHA
proof of humanity.

## Phase 2 — Stable proof-provider interface

Define an internal adapter with operations equivalent to:

```ts
type HumanityProof = {
  issuer: string;
  proofClass: "humanity" | "uniqueness";
  subjectBinding?: string;
  issuedAt?: string;
  expiresAt?: string;
  statusRef?: string;
  scopedNullifier: string;
};

interface ProofOfHumanityProvider {
  beginEnrollment(input: { returnUrl: string }): Promise<unknown>;
  verifyCallback(input: unknown): Promise<HumanityProof>;
  beginRefresh(input: { challenge: string }): Promise<unknown>;
  verifyRefresh(input: unknown): Promise<HumanityProof>;
}
```

The exact vendor payload must never leak into `Human`, `Profile`, ledger, or
public records. Store provider-neutral proof state and an issuer version.

Exit condition: a test provider and a chosen provider can implement the same
contract without changing identity or Alias registration logic.

## Phase 3 — Select and validate an independent issuer

Evaluate at least two candidates against the requirements in
`PROOF_OF_HUMANITY_SPEC.md`. The evaluation must cover:

- uniqueness mechanism and threat model;
- document/liveness/biometric requirements;
- privacy and unlinkability;
- accessibility and geographic coverage;
- recovery and revocation;
- API and wallet experience;
- cost, uptime, vendor lock-in, and legal terms.

Do not select a provider merely because its demo is easy. The owner must
ratify the issuer and the exact claim AgoraNet will trust.

Exit condition: a written decision names the issuer, assurance class,
fallback, retention posture, and launch limitations.

## Phase 4 — Enrollment and migration

- Add an issuer-backed enrollment route beside the Phase A route.
- Verify the issuer proof server-side and derive the registration nullifier
  from a scoped proof, not a reusable global identifier.
- Preserve the existing one-True-Self / one-Alias registration semantics.
- Provide an explicit migration path for existing interim accounts; do not
  silently upgrade them to independently verified status.
- Mark accounts by assurance tier so the UI can state what has been verified.

Exit condition: a new account can complete the independent flow, create one
True Self, hatch one Alias, and fail a duplicate enrollment without linking
the two public identities.

## Phase 5 — Random freshness checks for active users

- Add a freshness record scoped to the human proof, not to both public
  identities.
- Require a fresh check for every governance vote. During Phase A this is
  Turnstile; after issuer cutover it is an issuer-backed POH presentation.
- Separately schedule randomized checks for active users at an approximate
  cadence of once per day to once every few active days. This cadence applies
  after registration, not instead of the registration check.
- Generate unpredictable challenge tokens with expiration and one-time use.
- Add a risk/action policy: ordinary actions, posting, and governance voting
  may require different freshness windows.
- Require fresh proof presentations for selected checks.
- Add accessibility, retry, device-loss, issuer-outage, and appeal paths.
- Add metrics that count outcomes, not raw identity or proof data.

Exit condition: a randomly selected check can be completed, replayed proofs
are rejected, and a failed/outage path does not leak identity linkage.

## Phase 6 — Cutover and deprecation

- Announce the assurance change in plain language.
- Stop presenting the Phase A credential as independent proof.
- Keep the interim path only for a documented migration window, if counsel
  and the owner approve it.
- Update the constitution, disclosures, README, checkpoint, transparency
  page, owners guide, and deployment runbook.
- Conduct an adversarial review before enabling real-value or public-launch
  claims.

## Acceptance tests

- Two distinct users cannot claim the same handle.
- One valid issuer proof can register one True Self only once.
- One valid issuer proof can hatch one Alias only once.
- The Alias row and public records contain no True-Self link.
- A reused proof, expired proof, revoked proof, wrong-audience proof, and
  wrong-issuer proof are rejected.
- A CAPTCHA token is verified server-side and cannot be replayed.
- A random refresh challenge is one-time, expires, and cannot be reused.
- Provider outage produces a safe retry state, not a false success.
- No identity documents, raw biometrics, reusable universal identifiers, or
  raw provider payloads enter the application database or ledger.
- Existing per-profile action nullifiers and per-human registration
  nullifiers remain behaviorally compatible.
