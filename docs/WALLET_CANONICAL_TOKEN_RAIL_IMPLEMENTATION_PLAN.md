# AgoraNet Progressive Token Rail — Implementation Plan

**Status:** Foundation implemented and verified; wallet-action activation pending
**Started:** 2026-08-23
**Source specification:** `docs/WALLET_CANONICAL_TOKEN_RAIL_SPEC.md`
**Scope:** Cardano testnet and fake `dPOLL`/`dGRA` only

## 1. Delivery rule

Every change is additive until its checkpoint passes. Credits mode remains the default and every existing platform action keeps working. Wallet mode is opt-in, per identity, and testnet-only. Mainnet addresses and real-value configuration remain rejected.

The foundational code does not by itself authorize activation. `WALLET_MODE_TESTNET_ENABLED` and `CREDIT_CLAIMS_TESTNET_ENABLED` remain off by default. Wallet mode may be enabled only after Slice 5 proves at least one ordinary fee and one reward without a silent Credit fallback. Credit claims may be enabled only after an operator completes the live fake-asset delivery and recovery runbook.

## 2. Architecture decisions for this build

- `CREDITS` is the default economy mode for every existing and new profile.
- `WALLET` is available only after that identity links a supported testnet wallet.
- `MIXED` is reserved for controlled testing and is not a default user choice.
- Existing `Balance` and `EconomyEntry` rows become the Credit ledger without destructive migration.
- Confirmed chain data is authoritative for wallet balances.
- Wallet snapshots are caches and must carry freshness/error state.
- A Credit claim reserves Credits first, distributes fake assets through the isolated testnet distributor, verifies the transaction on-chain, and only then finalizes the Credit debit.
- Claim creation is feature-gated. No server request path imports or exposes the testnet mnemonic.
- Testnet asset identity comes from a registry/configuration boundary rather than UI literals.

## 3. Slice plan

### Slice 1 — Modes, registry, and schema

**Build status:** Complete; automated checkpoint passed 2026-08-23.

Deliverables:

- Add `economyMode` to `Profile`, default `credits`.
- Add `AssetDefinition`, `WalletBalanceSnapshot`, `TokenTransactionIntent`, and `CreditClaim` models.
- Add an additive PostgreSQL migration.
- Add testnet-only runtime configuration guards.
- Add mode and asset-registry domain helpers.

Checkpoint:

- Existing profiles behave as Credits users without a data migration.
- Mainnet configuration is refused.
- Both Prisma schemas remain byte-identical after their provider preambles.
- Schema generation and validation pass.

### Slice 2 — Mode-aware balance experience

**Build status:** Balance indexing, separate labels, and the per-profile selector are complete. Activation remains blocked by the Slice 5 action checkpoint.

Deliverables:

- Let a linked-wallet identity choose Credits mode or Wallet mode.
- Reject Wallet mode when no wallet is linked.
- Read wallet balances through the registry and cache a timestamped snapshot.
- Show economy mode, Credits, wallet balances, and synchronization state with separate labels.
- Never silently fall back from Wallet mode to Credits for a value-moving action.

Checkpoint:

- A no-wallet user sees and uses Credits normally.
- A linked-wallet user can enter Wallet mode directly.
- True Self and Alias modes remain independent.
- Provider failure says unavailable and never converts to a false zero.

### Slice 3 — Transaction intent infrastructure

**Build status:** Complete; automated checkpoint passed 2026-08-23.

Deliverables:

- Implement the transaction lifecycle and legal transitions.
- Add idempotency enforcement.
- Add verify-before-confirm primitives.
- Add safe failure codes and support diagnostics without secrets.

Checkpoint:

- Duplicate requests produce one intent.
- Illegal state transitions fail.
- Restart/retry can resume submitted work.

### Slice 4 — Explicit Credit claims

**Build status:** Request, reservation, idempotency, isolated distribution runner, exact on-chain verification, confirmation, and pre-submission refund are implemented. The feature remains off pending a supervised live testnet delivery and restart/recovery exercise.

Deliverables:

- Add a claim eligibility rail and conversion rails.
- Reserve Credits atomically when a claim is requested.
- Add an operator-side testnet distribution runner; never import mint keys into the web app.
- Verify destination, policy, asset quantities, and transaction hash before finalization.
- Release reservations on terminal failure or expiry.
- Add claim status UI and explorer link.

Checkpoint:

- A Credit user links Lace, claims fake assets, and receives them at their own address.
- Credits are consumed once, only after confirmed delivery.
- Rejection, timeout, retry, refresh, and duplicate submission cannot duplicate value.

### Slice 5 — Direct Wallet mode action

**Build status:** Pending. Existing self-custody and donation demonstrations prove the browser-wallet pattern, but they do not yet make Wallet mode load-bearing for an ordinary PollCoin/Gratium fee or reward.

The choice of first fee, destination contract, first reward, and issuance/release authority is recorded as `DECISIONS_PENDING.md` #27 rather than invented while the owner is unavailable.

Deliverables:

- Convert one low-risk action to a wallet-signed fake-token flow.
- Preserve the Credits implementation for Credits mode.
- Refuse unsupported Wallet-mode actions clearly.

Checkpoint:

- One product action works in both modes, with the correct source of value in each.

### Slice 6 — Economy conversion

**Build status:** Pending by design.

Deliverables:

- Convert remaining approved fees, rewards, tips, transfers, donations, and settlements incrementally.
- Add reconciliation and operator reports.
- Update Transparency and Help & Support.

Checkpoint:

- Every visible amount identifies Credits, wallet assets, pending, or reserved state.
- Full failure, privacy, and restart matrix passes.

## 4. Migration discipline

1. Commit the additive migration before code that depends on it.
2. Apply the migration to Railway before deploying dependent application code.
3. Keep defaults compatible with the currently deployed application.
4. Do not rename or drop `Balance`/`EconomyEntry` during the additive phase.
5. Rollback means disabling Wallet mode and claim creation; confirmed chain history is never deleted or reversed in the database.

## 5. Verification commands

```bash
npm run db:generate
npm run db:validate:postgres
npm test
npx tsc --noEmit
npm run build
npm run db:verify
```

Network-dependent testnet checks are separate, explicit checkpoints and must never run as part of the ordinary unit suite.

## 6. Foundation checkpoint; 2026-08-23

Implemented without deployment or network value movement:

- additive SQLite/PostgreSQL data model and migration;
- Credits-default, per-profile mode boundary;
- testnet-only fake-asset registry and mainnet refusal;
- stale-safe wallet balance snapshots;
- idempotent transaction-intent lifecycle;
- explicit Credit-claim reservation, isolated distributor, chain verification, and mechanical refund;
- separate Credits/wallet labels and novice-first Help content;
- feature flags defaulting off for Wallet mode, claims, and mixed mode.

Verification passed: corpus compilation, Prisma generation, PostgreSQL schema parity and validation, 377 tests, TypeScript, optimized Next.js build, `db:verify`, and a signed-out Help browser walkthrough with no console errors.

The remaining live checkpoint requires an awake owner because Lace must display and sign a testnet transaction. No secret, mnemonic, Cloudflare setting, deployment environment, or real-value rail was touched during the foundational build.

## 7. Decisions deferred beyond the foundational build

- Production conversion rate and economic treatment of Credits.
- Whether production claims are one-way, reversible, capped, or time-bound.
- Production distribution authority and treasury contract.
- Network-fee sponsorship.
- Mainnet policy, audit, legal classification, and deployment approval.
- Privacy-preserving wallet-account strategy beyond separate addresses/accounts.
