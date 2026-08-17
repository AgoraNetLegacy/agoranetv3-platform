# Proof of Humanity and Uniqueness

Status: proposed architecture; vendor selection and production rollout are
not yet approved.

## 1. Purpose

AgoraNet needs two related but distinct assurances:

1. **Humanity:** a trusted process has reasonable evidence that the
   participant is a living human rather than an automated account farm.
2. **Uniqueness:** the same human cannot obtain more than one eligible
   participation root, subject to the platform's published identity policy.

The current Phase A gate does not provide either assurance independently. It
creates a platform-operated credential, stores its hash, and uses scoped
nullifiers to prevent reuse of that credential. That is an interim account
and anti-replay mechanism, not independent proof of humanity.

The live product must say this plainly until an external issuer or proof
network is in the live path. CAPTCHA, handle uniqueness, wallet possession,
email, phone number, and device signals are supporting controls; none alone
is the product's proof that one human gets one participation root.

## 2. Product promise

The intended promise is:

> One independently verified human may create one True Self and one Alias.
> AgoraNet verifies eligibility without receiving identity documents, stores
> only the minimum proof state required for enforcement, and uses scoped,
> privacy-preserving presentations for later checks.

The promise is not “no bots.” No mechanism can guarantee that phrase. The
accurate claim is a layered reduction of automated abuse and Sybil accounts,
with explicit assurance levels and failure behavior.

## 3. Roles and trust boundaries

The production design follows the issuer / holder / verifier model:

- **Issuer:** an independent organization or proof network that establishes
  the approved humanity and uniqueness claim.
- **Holder:** the participant's wallet or device, which stores the credential
  or proof material.
- **Verifier:** AgoraNet, which requests a narrowly scoped presentation and
  checks signature, issuer trust, freshness, status, and nullifier rules.

AgoraNet must not become the sole authority for the claim it uses to govern
membership. The issuer trust record, credential schema, revocation/status
method, and security contact must be documented and auditable.

## 4. Assurance tiers

| Tier | Purpose | Example control | What it may unlock |
|---|---|---|---|
| A0 | Friction and abuse control | rate limits, email/device signals, CAPTCHA | reading, low-risk requests |
| A1 | Interactive-human confidence | Turnstile or hCaptcha, server-verified | verification flow and retries |
| A2 | Independent humanity claim | issuer-signed credential or proof-of-human presentation | True Self registration |
| A3 | Strong current-human check | fresh, random re-presentation with anti-replay and status check | governance voting, high-impact actions |

A0/A1 must never be described as proof that a person is unique. A2/A3 may
be described as proof only with the issuer, claim scope, and limitations named.

## 5. Identity and uniqueness rules

- The `@handle` remains globally unique and never recycled. This is an
  attribution rule, not a humanity rule.
- One A2-approved human may register exactly one True Self.
- The same approved human may hatch exactly one Alias, with no stored
  True-Self-to-Alias row link.
- Registration nullifiers remain scoped separately from per-profile action
  nullifiers. The issuer proof supplies the human/uniqueness claim; the
  nullifier prevents replay within a defined scope.
- A verifier must never use a global reusable identifier when a scoped,
  unlinkable nullifier is sufficient.
- Duplicate proof, replay, expired proof, revoked proof, and issuer mismatch
  must fail closed without revealing which other account caused a collision.
- Every True Self registration, Alias registration, and governance vote must
  require the strongest currently available freshness check. In Phase A this
  is a server-verified Turnstile check; after issuer cutover it becomes a fresh
  issuer-backed POH presentation.

## 6. Random proof-of-humanity checks for active users

Random checks are a separate feature from enrollment. Every True Self
registration is checked; the randomized cadence applies to users who are
already participating on the platform. The checks must be credential
presentations, not surprise CAPTCHA punishment.

- At enrollment, obtain an A2 proof and establish the True-Self registration
  nullifier.
- Assign a freshness window by action class. Ordinary participation may use
  a longer window; governance voting requires a shorter one.
- Select re-checks using a server-side unpredictable event, but never expose
  the selection rule or use behavioral profiling as the selection input.
- Ask the holder to present a fresh A3 proof to a one-time challenge.
- Verify issuer, signature, schema, status/revocation, freshness, audience,
  and anti-replay binding before allowing the action.
- If the check is unavailable, offer a retry and a clear recovery path. Do
  not silently convert a failed check into a permanent account deletion.
- Record only the minimum result: proof class, issuer version, freshness
  window, scoped nullifier, and outcome. Do not record documents, biometrics,
  raw proof payloads, or a universal person identifier.

## 7. Vendor-neutral requirements

Before selecting an issuer, it must demonstrate:

- independent operation from AgoraNet;
- a documented humanity and uniqueness methodology;
- privacy-preserving, selective or minimal disclosure;
- replay resistance, revocation/status, and key rotation;
- accessibility and non-biometric fallback options where appropriate;
- recovery after device loss without allowing a second human root;
- clear outage, vendor shutdown, and migration behavior;
- public security documentation and an incident process;
- data-processing, jurisdiction, retention, and legal terms acceptable for
  the intended launch.

The integration must be an adapter behind a stable internal interface so the
issuer can change without changing the identity, nullifier, or Alias model.

## 8. Explicit non-goals

- CAPTCHA is not the final proof-of-humanity system.
- A unique handle is not proof of a unique human.
- A wallet address is not proof of a unique human.
- IP, device fingerprint, writing style, or behavioral timing must not be
  presented as proof of humanity.
- AgoraNet must not collect identity documents merely to simplify the first
  implementation.

## 9. Phase A wording

Until an independent issuer is live, the gate must say that AgoraNet
operates an interim issuer, the credential is not independent proof of
humanity, duplicate re-verification is not fully detectable, and the
testnet Identus rail is not the production gate.
