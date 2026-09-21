# AgoraNet Progressive Token Rail

## Testnet-first implementation plan for accessible, non-custodial Web3

**Status:** Approved direction; additive testnet implementation in progress
**Date:** 2026-08-23
**Applies to:** PollCoin (PC) and Gratium (G)
**Test network:** Cardano Preprod, using fake/demo assets
**Production network:** To be selected only after legal, economic, and security approval

> **Current implementation decision (2026-08-26):** PC and G are the canonical
> application assets in both modes. Internal ledger custody and Cardano testnet
> custody are settlement rails for the same assets, not separate currencies.

## 1. Executive decision

AgoraNet's long-term model has two user paths:

- New users can participate immediately with AgoraNet Credits; no wallet or crypto knowledge is required.
- Advanced users can connect a wallet and claim fake/testnet PC/G into their own wallet.
- Wallet-held PC/G is the source of truth for on-chain ownership when a wallet
  settlement has occurred; the internal ledger is the source of truth for
  platform actions not yet settled externally.
- AgoraNet displays wallet balances through an indexer and displays Credits through its internal ledger.
- Users approve wallet value-moving transactions themselves.
- AgoraNet never receives seed phrases, private keys, signing keys, or wallet spending authority.
- The internal ledger records Credits, claims, intents, pending transactions, confirmations, failures, disputes, and reconciliation. It is not silently presented as wallet-owned PC/G.

This progressive model preserves the beginner-friendly Web2 experience while proving the intended Web3 ownership path on testnet. Mainnet must be a configuration and asset-policy change, not a second application architecture.

## 2. Why the current split is not the final design

The current repository contains two deliberately separate systems:

1. `lib/economy.ts` maintains per-profile internal PC/G database balances and double-entry entries.
2. `lib/chain.ts` links a user's Cardano testnet address and reads `dPOLL`/`dGRA` from the chain.

The wallet rail currently proves connection, wallet ownership, signed transactions, donations, and selected settlements. The internal economy currently provides the beginner path, but it does not yet have an explicit, user-controlled bridge that lets a user claim corresponding testnet assets into their wallet.

The separation is useful and should remain, but the labels and conversion boundary must be honest. AgoraNet Credits are not the same asset as wallet-held PC/G until an explicit claim or conversion transaction is confirmed.

## 3. Goals

- Let beginners participate immediately with internal AgoraNet Credits.
- Make wallet-held PC/G assets authoritative for on-chain ownership.
- Provide an explicit, testnet-only claim path from eligible Credits into the user's wallet.
- Use fake Cardano Preprod tokens to exercise the complete future flow.
- Define which actions use instant Credits and which require wallet transactions.
- Make wallet claims, transfers, donations, and settlements explicit transaction flows.
- Preserve a fast, understandable user experience despite blockchain confirmation time.
- Keep True Self and Alias wallet links separate and non-mergeable.
- Ensure every state transition is observable, idempotent, auditable, and recoverable.
- Allow testnet-to-mainnet promotion through configuration, asset policy, and deployment gates.
- Make the product disclosures and Help & Support content match the actual custody boundary.

## 4. Non-goals

- No mainnet activation in this implementation phase.
- No real-value token issuance, sale, exchange, or promise of value.
- No platform-held user wallet, seed phrase, signing key, or hot wallet.
- No silent conversion between Credits and on-chain tokens; claims require user consent and a verifiable transaction.
- No requirement that a new user create, fund, or understand a wallet before participating.
- No requirement that every read-only page wait for a new blockchain transaction.
- No linking of a user's two AgoraNet identities through a common wallet.

## 5. Vocabulary and custody boundary

| Term | Meaning |
|---|---|
| AgoraNet Credit | An internal, beginner-friendly unit recorded by the platform. It is not an on-chain token and is not shown as a wallet balance. |
| On-chain balance | Confirmed quantity of the configured PC or G asset at the identity's linked wallet account/address. |
| Indexed balance | A read model produced from the chain by an indexer; it is never the source of ownership. |
| Transaction intent | A database record describing an action the user wants to perform. It is not a completed transfer. |
| Pending transaction | An intent with an unsigned, signed, or submitted transaction reference awaiting a final outcome. |
| Confirmed transaction | A transaction observed on the configured network with the expected asset movement and validation rules. |
| Failed transaction | A transaction rejected, expired, invalid, or conclusively absent after its retry window. |
| Platform ledger | The source of truth for AgoraNet Credits and workflow records; for wallet assets it records intents, reservations, disputes, and reconciliation but does not determine ownership. |
| Custody | A legal and technical determination requiring professional review. This design avoids platform control of user signing authority but does not by itself determine every regulatory classification. |

The UI must label the two systems separately: `AgoraNet Credits` and `Wallet Balance`. Credits must never be presented as already-owned wallet PC/G. A claim is the explicit boundary between them.

## 6. Target architecture

```text
Beginner path:  AgoraNet Credits ──► platform actions
                         │
                         └── optional explicit claim ──► user's wallet

Advanced path:  user's wallet ──► wallet-signed transfer/claim ──► Cardano
                                             │
                                  indexer/reconciliation worker
                                             ▼
                                  confirmed wallet balance/read model
```

The application can display a cached indexed wallet balance for speed, but each display must include freshness and confirmation state. Credits remain fast internal units. A refresh must never invent or directly mutate wallet ownership.

## 7. Asset and network configuration

All token identity must be configuration-driven and validated at startup.

### Testnet configuration

- `CARDANO_NETWORK=preprod` or another explicitly supported test network.
- A dedicated throwaway policy ID for `dPOLL` and `dGRA`.
- Token names remain visibly marked as demo/test assets.
- Dev-only minting keys exist only in an isolated operator/development environment.
- Mainnet addresses, policy IDs, and signing material are rejected by runtime guards.

### Production configuration

Production requires a separate deployment, policy, asset identifiers, indexer credentials, transaction-fee policy, and security review. No testnet secret or policy may be reused.

The application code must consume an `AssetRegistry` abstraction rather than hard-code `dPOLL`, `dGRA`, or a single policy ID. Testnet and production implementations must satisfy the same interface.

## 8. Identity and privacy rules

Wallet linking is identity-scoped:

- A wallet link belongs to exactly one profile identity at a time.
- True Self and Alias must not share a wallet account or address.
- The server must reject an address already linked to the other identity.
- The UI must explain that using the same wallet for both identities can publicly link them, even if AgoraNet does not merge the database records.
- Wallet addresses and transaction hashes are public-chain data and must not be exposed in unrelated identity surfaces, support cases, analytics, or logs.
- A wallet address is not proof of humanity and must not be used as a substitute for the identity ceremony.
- Switching wallets must be explicit, re-verified, and recorded as a new link event; historical transaction ownership must remain immutable.

The future design must decide whether an identity uses one stable account address, rotating receive addresses, or a privacy-preserving account abstraction. That decision must be made before production because address reuse can create public linkage.

## 9. Canonical data model

The existing `TestnetWalletLink` should evolve into a network-neutral, versioned wallet-link model while retaining testnet guards during this phase.

### Required entities

#### WalletLink

- `id`
- `profileId`
- `network`
- `chain`
- `accountReference` or approved public address representation
- `assetScope`
- `connectedAt`, `lastVerifiedAt`, `revokedAt`
- `linkProofTxHash` or signed challenge reference
- unique constraint preventing the same wallet scope from linking to both identities

#### AssetDefinition

- `chain`
- `network`
- `policyId`
- `assetName`
- `symbol`
- `decimals`
- `displayName`
- `isTestAsset`
- `active`

#### TokenTransactionIntent

- `id`
- `profileId`
- `kind` (fee, reward, tip, transfer, donation, withdrawal, settlement)
- `assetId`
- `amount`
- `sourceWalletScope`
- `destinationWalletScope` or script reference
- `status`
- `unsignedTxHash` or transaction body reference, never a private key
- `txHash`
- `createdAt`, `submittedAt`, `confirmedAt`, `failedAt`
- `failureCode`, `failureMessage`
- `idempotencyKey`
- `refType`, `refId`

#### BalanceSnapshot

- `walletScope`
- `assetId`
- `confirmedQuantity`
- `observedAt`
- `sourceBlock`
- `indexer`
- `syncStatus`

Snapshots are caches. They must be reproducible from chain data and may never be edited to grant ownership.

#### Reservation / PendingClaim

Used for application actions that need a deterministic result before chain confirmation. It must include an expiry and a link to the transaction intent. A reservation is not a balance and cannot be transferred.

#### CreditClaim

Records an explicit conversion of eligible AgoraNet Credits into testnet PC/G:

- `id`
- `profileId`
- `creditCurrency`
- `creditAmount`
- `assetId`
- `assetAmount`
- `destinationWalletScope`
- `status`
- `transactionIntentId`
- `createdAt`, `confirmedAt`, `expiredAt`
- unique constraint preventing the same Credit grant from being claimed twice

A claim must be authorized by the current identity, sent to that identity's linked wallet, and confirmed on the configured testnet before the Credits are marked claimed. The application must not debit Credits merely because a user opened the wallet prompt.

#### EconomyMode

Per identity, the user may select:

- `CREDITS`: use AgoraNet Credits; no wallet required.
- `WALLET`: use confirmed wallet PC/G for supported actions; wallet approval is required where value moves.
- `MIXED` during testnet rollout only: Credits remain available while the user tests wallet actions, but every amount is labeled by source and no automatic merging occurs.

An advanced user who connects a wallet can go directly into `WALLET` mode. A new user remains in `CREDITS` mode until they choose otherwise. True Self and Alias have independent modes.

## 10. Transaction lifecycle

Every value-moving action follows the same state machine:

```text
requested
  → prepared
  → awaiting_wallet_approval
  → signed
  → submitted
  → confirmed

requested/prepared/awaiting/signed/submitted
  → rejected | expired | failed
```

Rules:

- The server creates the intent before asking the wallet to sign.
- The browser receives only the transaction body or a safe transaction-building request.
- The user wallet signs; the platform never signs for the user.
- Submission is idempotent by `idempotencyKey` and transaction hash.
- Confirmation requires checking the configured network, expected inputs/outputs, asset quantity, destination, and reference metadata.
- A client-reported success is never sufficient; the indexer or chain provider must confirm it.
- Failed or rejected actions release any reservation and do not debit a balance.
- The UI must distinguish “wallet rejected,” “network pending,” “confirmed,” and “AgoraNet still syncing.”

## 11. How the major product actions work

### Beginner participation with Credits

1. A verified user receives the approved starting Credit grant.
2. Fees, participation costs, and beginner rewards use the Credit ledger for immediate feedback.
3. The UI calls these units `AgoraNet Credits`, not wallet PC/G.
4. The user can continue without a wallet.
5. When ready, the user connects a wallet and sees a plain-language explanation of the optional claim path.

### Credit claims

1. The user selects an eligible Credit amount and a linked wallet.
2. AgoraNet creates a `CreditClaim` and reserves the Credits.
3. The application prepares a testnet transaction sending the corresponding fake PC/G to that user's wallet.
4. The user approves the transaction in Lace or another supported wallet.
5. The indexer confirms the expected asset amount at the user's wallet.
6. Only then are the reserved Credits marked claimed and the claim finalized.
7. A rejected, expired, or invalid transaction releases the reservation; it does not consume Credits.

The conversion rate, eligibility, expiry, and whether claims are one-way must be explicit product rails. No hidden 1:1 assumption may be baked into code.

### Rewards and accruals

1. AgoraNet determines that a reward is due under the approved rule.
2. If the user is in Credit mode, it records the reward in the internal Credit ledger.
3. If the user is in wallet mode, or claims Credits, it creates a wallet transaction intent.
4. The wallet path is confirmed by the indexer before being presented as owned PC/G.

The reward rule must not silently increment a database field labeled as wallet-owned PC/G.

### Fees

The product must choose and document whether each fee is a Credit action or a wallet action. For wallet actions, choose one of these models:

- **User-signed fee:** the user's wallet sends PC/G to a protocol treasury or script.
- **Transaction-bundled fee:** the user's signed transaction includes the fee output.
- **Sponsored transaction:** a separate, approved relayer pays network fees but cannot redirect user assets.

The platform may debit AgoraNet Credits for a Credit-mode action, but must not subtract a Credit amount and call a wallet-token transfer complete.

### Tips and peer transfers

The sender approves a transaction to the recipient's wallet scope. The recipient's on-chain balance changes only after confirmation. AgoraNet records the social context and transaction reference, not ownership by database decree.

### Treasury and donations

Treasury destinations must be published, policy-controlled, and independently verifiable. A treasury may be a script or an approved multi-signature arrangement; no single application operator should be able to silently redirect production value.

### Withdrawals

In the wallet-canonical model, ordinary user-held assets do not require a “withdrawal” from AgoraNet because AgoraNet never owns them. A withdrawal flow exists only for a confirmed platform-held or escrowed settlement balance, if such a feature is approved after legal review.

## 12. UI requirements

The header and settings surfaces must show:

- The selected economy mode: `Credits mode` or `Wallet mode`.
- `AgoraNet Credits` when Credits exist.
- `Wallet balance` for confirmed indexed on-chain PC/G.
- `Pending` amounts separately, with a link to transaction status.
- Network name: `Cardano Preprod — test assets` during this phase.
- Last indexed time and confirmation state.
- A clear “Connect wallet” or “Reconnect wallet” action.
- A clear choice after connection: `Use wallet for AgoraNet actions` or `Keep using Credits`.
- A link to the public explorer for confirmed transactions.
- A plain-language warning that testnet assets have no real value and cannot be moved to mainnet.

The UI must not show internal Credits as wallet assets. In Wallet mode, supported fees and rewards use the wallet path; unsupported or unavailable actions must say so instead of silently falling back to Credits. In Credits mode, the user may claim eligible Credits into the wallet explicitly.

## 13. Migration from the current internal economy

Migration is additive and reversible until the cutover gate.

### Slice 0 — freeze the contract

- Rename or expose current `Balance` rows as the legacy/transitioning Credit ledger.
- Stop labeling database PC/G rows as wallet ownership.
- Update product and Help & Support language to distinguish Credits from wallet assets.
- Add feature flags for `CREDITS_MODE`, `WALLET_MODE_TESTNET`, and later `WALLET_MODE_MAINNET`.
- Add an identity-scoped `EconomyMode` with `CREDITS` as the safe default.

### Slice 1 — asset registry, wallet read model, and direct wallet mode

- Add network-neutral asset definitions.
- Generalize `TestnetWalletLink` without enabling mainnet.
- Add indexed balance snapshots and freshness state.
- Add the wallet balance read model and freshness state.
- Let a newly connected user select Wallet mode immediately.
- Keep Credits visible as a separate balance until the user claims or spends them according to the selected policy.

### Slice 2 — transaction intent primitives

- Add the intent state machine and idempotency keys.
- Build a common Cardano transaction adapter.
- Add confirmation and reconciliation workers.
- Add failure, retry, and support-safe diagnostics.

### Slice 3 — one complete user action

Implement one low-risk action end-to-end, preferably a testnet tip or explicit self-transfer:

- browser preparation;
- wallet approval;
- submission;
- confirmation;
- indexed balance update;
- explorer link;
- retry and duplicate protection.

Do not migrate all economy actions until this slice passes.

### Slice 4 — direct wallet actions

- Implement one fee and one reward directly in Wallet mode.
- Show wallet approval, pending, confirmed, and failed states.
- Prove that a user in Wallet mode is not silently charged Credits.

### Slice 5 — Credit claims and rewards/fees

- Implement the explicit Credit-to-wallet claim flow.
- Convert one reward rail and one fee rail for both modes.
- Keep Credit ledger writes for Credit mode and transaction intents for Wallet mode.
- Make all display amounts identify their source.

### Slice 6 — transfers, treasury, donations, and settlements

- Convert peer tips/transfers.
- Convert approved treasury/donation flows.
- Generalize the existing auditor settlement pattern.
- Add reconciliation reports for every intent whose chain result differs from the expected result.

### Slice 7 — mode hardening and legacy retirement

- Stop creating unlabeled internal PC/G balances.
- Preserve the Credit ledger as the beginner path, not as hidden wallet ownership.
- Do not silently convert Credits to testnet assets; require an explicit claim.
- Remove ambiguous balance displays and enforce mode-specific action paths.

## 14. Testnet-to-mainnet parity gate

The testnet implementation is not complete until the same automated test suite passes with only these configuration changes:

| Concern | Testnet | Production |
|---|---|---|
| Network | Cardano Preprod | Approved production network |
| Asset policy | Throwaway `dPOLL`/`dGRA` policy | Approved PC/G policy |
| Explorer/indexer | Preprod provider | Production provider |
| Wallet address guard | `addr_test1…` only | Approved production address format |
| Secrets | Test-only provider and dev distribution credentials | Production secret manager, independently provisioned |
| UI label | Test assets / no value | Approved production disclosure |
| Feature flag | `CREDITS_MODE` + `WALLET_MODE_TESTNET` | `CREDITS_MODE` + `WALLET_MODE_MAINNET` after gates |

No business logic should branch on “testnet means internal balance” versus “mainnet means wallet balance.” Both networks use the same Credits-plus-wallet service; only the asset, network, policy, and approved production configuration change.

## 15. Acceptance criteria

### Custody and security

- No seed phrase, private key, signing key, or wallet spending password reaches the server.
- Server logs, support cases, analytics, and error reports contain no wallet secrets.
- Mainnet cannot be reached by a testnet configuration.
- The operator cannot alter a user's confirmed wallet balance through a database write.
- True Self and Alias cannot share a wallet scope.

### Functional

- A newly linked testnet wallet displays its confirmed `dPOLL`/`dGRA` balance.
- A new user can complete onboarding and participate without a wallet.
- A wallet user can select Wallet mode immediately after connecting.
- A Credit-mode user can make an explicit testnet claim into their own wallet.
- A claim cannot consume Credits before the expected wallet transaction is confirmed.
- A wallet-signed transfer reaches the destination and changes both indexed balances after confirmation.
- A rejected transaction leaves balances unchanged.
- A pending transaction is not counted as confirmed.
- Refreshing, retrying, or reopening the browser cannot duplicate a transfer.
- A provider outage produces “temporarily unavailable,” never a false zero balance.
- A confirmed chain transaction missing from the read model is detectable and support-escalatable.

### Product integrity

- Every visible PC/G number identifies whether it is confirmed, pending, reserved, or legacy.
- Help articles explain wallet, network, address, transaction hash, pending, and confirmed in beginner language.
- The Transparency surface links the asset policy, network, indexed source, and confirmed transactions.
- Testnet language is visible at the point of action.

## 16. Required test matrix

- Connect, disconnect, reconnect, and switch wallets.
- True Self and Alias isolation.
- Wrong network and wrong asset policy.
- Zero balance, delayed indexer, provider timeout, and provider rate limit.
- Wallet rejection, browser closure, duplicate click, refresh, and retry.
- Submitted transaction that never confirms.
- Confirmed transaction with wrong amount or destination.
- Indexer reorganization or stale snapshot.
- Concurrent reward and fee intents.
- Server restart during every lifecycle state.
- Full testnet run using fake assets from wallet connection through confirmed transfer.
- Configuration-only promotion rehearsal in an isolated production-like environment.

## 17. Current implementation gaps

The following are known gaps between the repository and this target:

1. Existing `Balance` rows correctly remain spendable Credits in Credits mode; most product actions still need their Wallet-mode equivalent.
2. `TestnetWalletLink` remains testnet-specific rather than a final network-neutral wallet-link model.
3. Indexed snapshots are implemented, but a production-grade indexer and reorganization policy remain pending.
4. Ordinary Discussion posting has a wallet-signed `dPOLL` fee, and **chamber creation now has wallet-signed dual-token settlement**: one transaction the soul signs in Lace carries BOTH `dPOLL` and `dGRA` to the compiled treasury script, so a self-custody soul can open a chamber without first moving value into platform custody. The chamber exists only after the chain confirms both legs. Tips, polls, **workshop posts** (the in-chamber micro-fee), permanence, mission funding/releases, and peer transfers remain unsupported in Wallet mode; the workshop composer says so and points to platform custody.
5. First-action `dGRA` and participation `dPOLL` rewards now use durable intents and an isolated distributor; other reward and settlement authorities remain pending.
6. The testnet fee vault uses the compiled mission-treasury script and a dedicated datum tag; its state initialization, governance signers, release, and recovery drill must pass before activation.
7. The transaction lifecycle, idempotency, restart recovery, and exact confirmation primitives exist but are not yet generalized to every value-moving action.
8. Help content now distinguishes Credits from wallet assets and explains the first wallet-ready action; additional articles must ship with each converted action.
9. Mainnet enablement still requires separate legal, economic, security, contract-audit, custody-boundary, and operational approval.

## 18. Recommended build order

1. Add economy modes, feature flags, and the asset registry.
2. Add indexed balance snapshots and let connected users enter Wallet mode directly.
3. Add the universal transaction-intent schema and state machine.
4. Prove one signed testnet transfer end-to-end.
5. Implement explicit Credit claims into a user's wallet.
6. Implement one reward and one fee in both Credits mode and Wallet mode.
7. Convert tips/transfers and then treasury/settlement flows.
8. Run the full failure/recovery, beginner UX, and privacy test matrix.
9. Perform a configuration-only mainnet rehearsal with no real assets.
10. Stop at the legal and production gate until written approval is complete.

## 19. Final product principle

AgoraNet should not force a beginner to become a crypto user before they can participate. Credits provide the accessible starting path; the chain owns the truth for users who choose wallet mode; and an explicit claim lets a beginner cross that boundary when ready.

The testnet is therefore not a miniature substitute or a disposable demo. It is the production architecture with valueless assets, two clearly labeled user paths, explicit guards, and reversible configuration. If both the beginner path and the wallet path cannot be made safe and understandable with fake coins, the system is not ready for real coins.
