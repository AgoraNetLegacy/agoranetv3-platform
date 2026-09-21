# Stake Pool Commons

## A future civic layer for understanding Cardano stake pools

**Status:** Future concept; not approved for implementation or production use

**Prepared:** 2026-09-21
**Depends on:** Open-source readiness, stable wallet rails, a reviewed Cardano
indexing provider, and a separate privacy and security review

## 1. Plain-language purpose

Cardano stake pools run infrastructure that helps validate the Cardano network.
ADA holders can delegate to a pool while keeping their ADA in their own wallet.
Choosing a pool is therefore a civic and technical decision: people may care
about reliability, fees, concentration of stake, operator transparency, and
what a pool says it will do.

Stake Pool Commons would give those decisions a public place to be investigated
and discussed. It would help people examine pools together. It would never hold
their ADA, choose a pool for them, or submit a delegation transaction without
their own wallet approval.

## 2. The opportunity for AgoraNet

The feature turns several AgoraNet principles into a useful Cardano practice:

| AgoraNet principle | Stake Pool Commons expression |
| --- | --- |
| Permanent record | Operator statements and public pool evidence retain visible history. |
| Evidence before assertion | Pool facts are derived from an indexer or chain evidence, with freshness shown. |
| Community governance | People can discuss, compare, and form recommendations without surrendering their own choice. |
| Private participation | A person may join discussion with an Alias; no public delegation graph is created by AgoraNet. |
| Self-custody | Delegation always happens in the user's own compatible wallet. |

The product is not a yield-ranking site or financial-advice service. Its
purpose is to make pool claims and community reasoning inspectable.

## 3. Scope and non-goals

### In scope

- public, read-only pool profiles derived from Cardano data;
- visible pool identifiers, published metadata, fees, pledge, and data
  freshness;
- an optional operator claim backed by cryptographic proof of control;
- permanent or clearly labeled discussion attached to a pool;
- sources, evidence, corrections, and community polls about pool-related
  questions;
- optional Circle recommendations that are explicitly non-binding.

### Out of scope

- holding, pooling, moving, or voting with a user's ADA;
- automatic delegation, delegation on behalf of a user, or a shared
  delegation wallet;
- promises of reward, performance, safety, or financial return;
- ranking pools with a hidden or proprietary score;
- accepting arbitrary server addresses, URLs, or relay IP addresses from users;
- building a Cardano node, operating a stake pool, or becoming a network relay
  monitor in the first release.

## 4. User experience

### 4.1 Find and read

A visitor can search a pool by ticker, name, or canonical pool ID. A profile
shows two visibly separate kinds of information:

1. **Chain facts:** pool ID, registration status, fees, pledge, metadata link,
   and the time and source of the latest observation.
2. **Human record:** an operator's claimed profile, public statements,
   sources, corrections, discussions, and polls.

Every displayed claim says whether it came from the chain, the operator, or a
community member. A stale or unavailable source is labeled, never silently
replaced with a current-looking value.

### 4.2 Operator claim

An operator begins with a pool ID, not an IP address. AgoraNet verifies that
the pool exists in the configured Cardano data source, then asks the operator
to sign a purpose-limited challenge with an authorized pool-controlled key or
wallet method supported by the reviewed design.

On success, the page may say **"operator claim verified"**. It must not claim
that AgoraNet has audited the pool, guaranteed its performance, or identified a
legal person behind it.

The operator decides whether to attach the claim publicly to a True Self,
Alias, or no AgoraNet profile at all. A verified claim proves control of the
pool credential, not the operator's civil identity.

### 4.3 Community discussion and recommendations

People may ask questions, attach sources, correct stale statements, and hold
ordinary AgoraNet polls about a pool. A Circle may publish a recommendation
with its reasons and evidence.

Recommendations must say plainly:

> This is a community view, not investment advice or a delegation instruction.
> Each person retains custody and makes their own wallet decision.

No user may be shown as having delegated to a pool unless they deliberately
choose a future, privacy-reviewed disclosure mechanism. The first release
stores no delegation data from AgoraNet users.

## 5. Trust model

```text
Cardano chain / approved indexer ──► chain facts and freshness
Pool-controlled signing key       ──► optional operator-control proof
Operator and community members    ──► attributed public statements
AgoraNet ledger                   ──► history of AgoraNet-side changes
User's own wallet                 ──► any personal delegation decision
```

These sources answer different questions. Chain data can show a registration
or a published parameter. A wallet signature can show control of a chosen
credential. Neither proves that a pool is honest, safe, high-performing, or a
good delegation choice.

## 6. Security and privacy requirements

### 6.1 No relay-address submission path

Stake-pool registrations can contain relay network addresses. Stake Pool
Commons must **derive** any displayed relay information from the configured
indexer or verified chain data. It must not expose a form where a user supplies
an IP address, hostname, callback URL, or custom Cardano endpoint for AgoraNet
to fetch.

This is deliberate. It avoids turning AgoraNet into a server-side request
forgery or network-scanning service, and it keeps the current transitive
Cardano SDK `ip-address` advisory out of the product's reachable paths.

### 6.2 Fixed provider boundary

- Production reads use only configured, allowlisted Cardano indexers.
- Provider base URLs are deployment configuration, never user input.
- Requests have bounded timeouts, response-size limits, caching, and rate
  limits.
- Data-parser failures are treated as unavailable evidence, not as an excuse to
  show unverified operator input as fact.

### 6.3 Operator-proof boundary

- Challenges are unique, short-lived, purpose-bound, and replay-protected.
- A proof authorizes only the pool claim workflow; it grants no wallet spending
  authority and is never a seed phrase or private key.
- Revocation, rotation, and a contested-claim path are mandatory.
- An AgoraNet profile's two identities must not be linked by claim handling.

### 6.4 Community safety

- Pool pages use ordinary AgoraNet moderation and evidence rules.
- Disputes about an operator claim have a visible correction and appeal path.
- Public data must be attributed to its source and observation time.
- The feature must not expose private wallet links, raw access logs, or a
  profile-to-delegation graph.

## 7. Proposed data model

### PoolSnapshot

- `poolId` and ticker/name where published;
- registration and retirement status;
- on-chain parameters permitted by the selected indexer;
- metadata reference and resolved metadata status;
- source, observed block or slot, and `observedAt`;
- normalized data hash for change detection.

Snapshots are cached read models, not user assertions. Historical changes need
an append-only observation record so a changed fee or metadata claim can be
examined later.

### PoolClaim

- `poolId`;
- optional claiming profile reference, protected according to the chosen
  identity display policy;
- public display preference;
- proof type, challenge hash, verification time, expiry, and revocation state;
- a pointer to the minimum public evidence needed to verify the claim without
  publishing secret material.

### PoolStatement and PoolEvidence

These use existing discussion, source, correction, and ledger primitives where
possible. The feature should avoid creating a parallel social system.

## 8. Delivery stages

| Stage | Deliverable | Required gate |
| --- | --- | --- |
| P0; Research | Provider comparison, data-field contract, threat model, and legal review. | No implementation. |
| P1; Read-only directory | Searchable pool profiles from one configured source, freshness labels, no claims and no user delegation data. | Security review of provider boundary and parser. |
| P2; Verified operator claim | Signed challenge, claim/revocation lifecycle, and visible proof status. | Wallet/privacy review and adversarial tests. |
| P3; Civic record | Discussions, sources, corrections, and clearly labeled community polls. | Moderation and record-integrity review. |
| P4; Circle recommendations | Non-binding Circle recommendation pages with evidence and conflict disclosures. | Governance approval and no-custody review. |

No stage adds automatic or platform-mediated delegation. Any later delegation
assistant is a separate specification requiring wallet, legal, privacy, and
security approval.

## 9. Decisions required before P1

1. Which Cardano indexer is the approved source for the initial network?
2. Will the first directory use preprod, mainnet, or a clearly separated view
   for each?
3. Which pool fields are chain facts, and which are operator assertions?
4. What constitutes a valid pool-control proof, and how is it revoked?
5. Which profile-display options preserve the True Self/Alias boundary?
6. How long may snapshots remain visible before they become stale?
7. What moderation and correction rule applies to contested operator claims?
8. What legal and communications review is required before any recommendation
   surface is public?

## 10. Acceptance criteria for the first buildable slice

P1 is ready to build only when all of the following are true:

- the provider API and allowed response schema are documented;
- no user-controlled URL, hostname, or IP reaches a server-side fetch;
- the directory distinguishes chain facts from human statements;
- every fact has an observation time and source;
- no user wallet, ADA balance, or delegation choice is collected;
- outage, stale-data, malformed-metadata, and rate-limit tests exist;
- the Cardano/Mesh dependency advisories are re-reviewed and the conclusion is
  recorded in `docs/DEPENDENCY_SECURITY_TRIAGE.md`.

## 11. Current decision

Stake Pool Commons is a promising future feature because it applies AgoraNet's
public-record and community-governance model to a real Cardano coordination
problem. It is deliberately deferred. The immediate work remains open-source
readiness, platform hardening, and the existing wallet and Chamber work.
