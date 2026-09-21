# Matching Foundation Progress

**Status:** implemented and verified through 2026-08-31  
**Scope:** foundations completed before the dedicated matching-system specification

## Why this record exists

AgoraNet's future matching system begins with complementarity: can a provider
satisfy a need under the relevant constraints? It does not begin with profile
similarity. Recent production work established the people, privacy, currency,
and coordination surfaces that this matcher will depend on. This document
records what is now real, the owner decisions that constrain future design,
and what remains unbuilt.

## Completed foundation

### 1. Platform Souls is the registered-profile layer

- `/souls` is publicly readable without an account.
- The left navigation calls the combined destination **Platform/Fellow Souls**.
- The public section is titled **Platform Souls Directory**.
- Every registered, activated profile is included. Directory membership is
  independent of login state, online/offline presence, and Spirit Mode.
- Search covers public display name, `@handle`, self-declared place, and public
  bio. Results are paginated and link to the existing public profile window.
- Directory cards use one presentation for all souls: avatar, display name,
  handle, optional place, and public bio.
- The directory query does not select or return the profile `face`; directory
  cards therefore do not label a soul as True Self or Alias.
- Inactive or not-yet-activated records remain excluded.

Boundary: the no-label decision currently applies to the directory. The
pre-existing About section on an individual profile window still discloses
True Self or Alias. Broadening the no-label rule beyond the directory requires
an explicit product/privacy decision.

### 2. Fellow Souls remains the private relationship layer

Signed-in souls use the lower section of the same `/souls` destination to see:

- Fellow Soul requests;
- accepted mutual connections;
- private message threads;
- blocked profiles; and
- controls to request, release, message, block, or unblock.

This state is per identity. It is not included in the public directory result,
public search, counts, ranking, or recommendations. A True Self's private
relationship state is not shown while using an Alias, and vice versa.

### 3. Newcomers have enough participation runway

- A new True Self receives a one-time **100 PC + 100 G** verification grant.
- A newly hatched Alias receives a one-time **50 PC + 50 G** grant.
- Existing milestone grants remain: 10 PC for the values seed, 5 PC for
  orientation, and 5 G for the first completed action.
- The expanded grants affect future issuance only; existing balances were not
  silently rewritten.

This removes an avoidable early dead end: a new soul can explore several
features before ordinary participation earnings become necessary.

### 4. Pollinator charges the dual-token signature

- A chamber costs 20 PC AND 20 G; a workshop post 1 PC AND 1 G. Neither
  token substitutes for the other (NEURAL_POLLINATOR §3).
- Eligibility, charging, displayed availability, and the insufficient-funds
  message all read the same dual cost.
- Platform custody requires both 20 PC and 20 G. Self-custody chamber
  creation sends both testnet assets in one wallet-signed transaction; the
  two custody paths never silently mix.
- Wallet-held and platform-held amounts are represented in the header's
  canonical balances; a crypto wallet is not required to use platform-held
  tokens.
- The PostgreSQL debit path tolerates only narrowly bounded floating-point
  residue at the exact-empty boundary, preventing a displayed sufficient
  balance from failing settlement.
- Stale PollCoin-only validation and messaging have been removed from the live
  path.

### 5. Chamber cover images can render in production

- Sanitized chamber covers are stored in the configured public Vercel Blob
  store.
- Production Content Security Policy permits that public Blob image host.
- Upload validation, metadata stripping, the 5 MB limit, and append-only
  ledger tracking remain in force.

## Verified evidence

The implementation is pinned by tests and production checks:

- directory tests prove that offline True Self and Alias fixtures both appear,
  inactive fixtures do not, and neither identity type nor private social state
  is returned;
- economy tests cover mixed PC/G affordability and invisible Float residue;
- chamber tests cover dual-token charging, refusing a soul who holds one
  token but not the other, and insufficient-funds behavior;
- the Help corpus and production build pass;
- production `/souls` returned seven registered profiles during the 2026-08-31
  audit, including the owner's offline profile and both existing Aliases;
- production rendered identical directory cards with no True Self/Alias badge;
- production header balances and enabled Pollinator creation state were
  inspected in the signed-in application; and
- the production database was backed up and the archive validated before the
  two currency/grant migrations were applied.

Relevant release commits:

- `84c2cf9` — chamber debit/cover repair, expanded grants, first public directory;
- `3982846` — Platform Souls naming;
- `70a1dbf` — presence-independent registered-profile membership;
- `335259a` — identical directory cards and removal of `face` from directory data;
- `158676b` — **Platform/Fellow Souls** navigation naming.

## Matching-system implications

The future matcher can now treat Platform Souls as its public candidate roster
and Fellow Souls/DMs as an optional, private coordination route. It must not
infer identity type from directory data or use a private relationship graph as
a ranking signal.

The planned pipeline remains:

**Need → classify → extract constraints → retrieve candidates → hard-filter →
functional match → contextual scoring → rank → user choice → outcome feedback**

Hard constraints belong before ranking. Capability, required credentials,
physical radius, deadline, language, and actual availability may eliminate an
impossible candidate. Functional complementarity ranks the feasible set.
Values, reputation, geography, and context remain separate, task-conditioned
signals rather than one opaque global score.

## Not implemented yet

The following remain specification work, not shipped matching behavior:

- structured **I need help** and **I can help** declarations;
- the owner-ratified Phase 0.1 task-category set in product data;
- capability, credential, location, deadline, language, and availability
  constraint schemas;
- retrieval, eligibility filtering, complementarity ranking, explanations,
  consent, and outcome-feedback workflows;
- task-specific reputation that measures reliability after a commitment rather
  than punishing someone for needing help;
- safety, reporting, dispute, and liability controls for real-world matches;
- explicit value-sensitivity controls for tasks where Pillar context matters;
  and
- any multi-agent orchestration or learned matching model.

Owner decision retained: **technical assistance is excluded from the Phase 0.1
initial task categories** because pairing a user with someone who could exploit
their devices, accounts, credentials, or data creates unacceptable early-stage
risk. Reintroducing it requires a dedicated safety and liability design.

## Next specification step

Define the request and offer records before choosing a model. The next spec
should settle:

1. the initial task taxonomy and category-specific risk limits;
2. the minimum public and private fields for a need or offer;
3. hard eligibility constraints for each category;
4. the functional match explanation shown to both parties;
5. consent and communication boundaries before identities are introduced; and
6. completion, cancellation, reporting, and feedback states.

The protocol should remain model-agnostic. A Transformer, rules engine, or
future multi-agent system may implement the matching function without changing
the public contract of AgoraNet.
