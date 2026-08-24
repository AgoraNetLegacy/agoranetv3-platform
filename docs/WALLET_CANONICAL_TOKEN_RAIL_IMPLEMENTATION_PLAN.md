# AgoraNet Progressive Token Rail — Implementation Plan

**Status:** First direct fee and reward implemented; live activation checkpoint pending
**Started:** 2026-08-23
**Source specification:** `docs/WALLET_CANONICAL_TOKEN_RAIL_SPEC.md`
**Scope:** Cardano testnet and fake `dPOLL`/`dGRA` only

## 1. Delivery rule

Every change is additive until its checkpoint passes. Credits mode remains the default and every existing platform action keeps working. Wallet mode is opt-in, per identity, and testnet-only. Mainnet addresses and real-value configuration remain rejected.

The code does not by itself authorize activation. `WALLET_MODE_TESTNET_ENABLED`, `WALLET_DISCUSSION_FEE_ENABLED`, `WALLET_REWARDS_TESTNET_ENABLED`, and `CREDIT_CLAIMS_TESTNET_ENABLED` remain off by default. Wallet mode may be enabled only after the Slice 5 automated checkpoint and supervised Lace/chain checkpoint both pass. Credit claims may be enabled only after an operator completes the live fake-asset delivery and recovery runbook.

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

**Build status:** Implemented behind disabled flags; automated checkpoint passed 2026-08-23. Supervised live wallet and recovery checkpoint remains pending.

The first fee is the standard Discussion post/reply micro-fee: the linked Lace account signs a fake `dPOLL` output to the compiled mission-treasury script with the `agoranet-platform-fees-v1` datum tag. The first rewards are the existing first-action `dGRA` grant and ordinary `dPOLL` participation accrual, queued to the linked wallet through the isolated testnet reward runner. The fee vault's testnet governance/recoverability posture must be explicitly verified before activation; flags remain off until then.

Deliverables:

- Convert one low-risk action to a wallet-signed fake-token flow.
- Preserve the Credits implementation for Credits mode.
- Refuse unsupported Wallet-mode actions clearly.

Checkpoint:

- One product action works in both modes, with the correct source of value in each.
- A transaction hash cannot satisfy two actions.
- Closing the browser after submission does not lose or duplicate the post.
- Rewards are leased once and verified at the exact linked destination.
- Unsupported Wallet-mode actions refuse instead of touching Credits.

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

## 7. Direct action checkpoint; 2026-08-23

Implemented without deployment, flag activation, or network value movement:

- short-lived, content-hashed `WalletActionDraft` records;
- browser-only Lace construction/signing/submission for Discussion fees;
- exact linked-input, compiled-destination, policy, asset, and quantity verification;
- atomic fee confirmation, post creation, civic ledger write, and reward enqueue;
- idempotent transaction hashes and automatic closed-tab reconciliation;
- isolated reward leasing, submission, exact delivery confirmation, and uncertain-broadcast quarantine;
- explicit no-fallback guards for unsupported wallet actions;
- novice-facing pending, wrong-account, do-not-pay-twice, and recovery guidance.

Automated evidence: 384 tests, including fee replay, pending confirmation, exact chain evidence, reward leasing, Credits preservation, hosted activation guards, and Credits-mode regression coverage. The live Lace checkpoint, fee-vault governance initialization/recoverability check, distributor restart exercise, PostgreSQL migration, deployment, and flag activation remain deliberately pending.

## 8. Decisions deferred beyond the direct-action build

- Production conversion rate and economic treatment of Credits.
- Whether production claims are one-way, reversible, capped, or time-bound.
- Production distribution authority and treasury contract.
- Network-fee sponsorship.
- Mainnet policy, audit, legal classification, and deployment approval.
- Privacy-preserving wallet-account strategy beyond separate addresses/accounts.
