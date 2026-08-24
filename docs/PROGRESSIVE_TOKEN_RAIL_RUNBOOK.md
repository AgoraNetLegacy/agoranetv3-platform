# AgoraNet Progressive Token Rail — Testnet Operations Runbook

**Status:** Additive migrations applied to staging; activation not authorized
**Scope:** Cardano `preprod` or `preview`, fake `dPOLL`/`dGRA` only
**Companion documents:** `WALLET_CANONICAL_TOKEN_RAIL_SPEC.md` and `WALLET_CANONICAL_TOKEN_RAIL_IMPLEMENTATION_PLAN.md`

## 1. Safety boundary

This runbook does not authorize mainnet, real-value assets, deployment, or a legal conclusion. Keep these defaults until the named checkpoint is ready:

```env
WALLET_MODE_TESTNET_ENABLED="false"
WALLET_DISCUSSION_FEE_ENABLED="false"
WALLET_REWARDS_TESTNET_ENABLED="false"
CREDIT_CLAIMS_TESTNET_ENABLED="false"
WALLET_MIXED_MODE_ENABLED="false"
```

Never paste a wallet seed phrase, signing key, private key, Cloudflare secret, Vercel secret, or access key into chat, source control, a support case, or command output. The web application must never receive the testnet mint mnemonic.

## 2. What survives a restart

The database, not a running process, holds the workflow state:

| Credit claim status | Meaning after a restart | Safe action |
|---|---|---|
| `reserved` | Credits are held; no distributor owns the claim | Run the distributor; one process will lease it |
| `distributing` | A process leased it, but the database has no transaction hash | Stop automatic work and reconcile on-chain; do not mint or refund again |
| `submitted` | A transaction hash is recorded and awaits confirmation | Run the distributor; it verifies the existing hash and never remints |
| `confirmed` | Exact destination, asset, and quantity were verified | No action |
| `failed` | An unsubmitted reservation was returned through the constrained refund category | No action |

An expired `reserved` claim is safe to refund because it was never leased. An expired or old `distributing` claim is not automatically refundable: a provider can fail after broadcasting, and refunding or retrying without reconciliation could duplicate value.

Wallet-paid posts are also durable:

| Wallet post status | Meaning after a restart | Safe action |
|---|---|---|
| `awaiting_wallet_approval` | No transaction hash exists | Let it expire or reject it; nothing was paid |
| `submitted` | The public hash is saved; the post awaits exact chain proof | Run `npm run chain:process-wallet-actions`; never ask the user to pay again |
| `completed` | Payment, post, ledger record, and reward queue committed together | No action |
| `requires_review` | Payment is confirmed but product state prevented publication | Preserve it for support reconciliation; do not create another fee |

Wallet rewards use `prepared → distributing → submitted → confirmed`. A `distributing` reward has uncertain broadcast state and must never be automatically minted again.

## 3. Migration-first activation order

1. Create and verify a PostgreSQL backup.
2. Apply `prisma/postgresql/migrations/20260824_progressive_token_rail/migration.sql`, then `20260824_wallet_mode_actions/migration.sql`, while all Wallet/claim flags remain `false`.
3. Run the unchanged application and smoke-test sign-in, Credits balances, fees, rewards, and `/settings`.
4. Deploy the dependent application code with all three flags still `false`.
5. Run `npm run db:verify` against the target database.
6. Enable `CREDIT_CLAIMS_TESTNET_ENABLED` only in a controlled test environment with the isolated distributor configured.
7. Complete one supervised claim for each currency, plus decline, duplicate-submit, expiry/refund, restart-after-submit, and provider-outage tests.
8. Run the idempotent seed so `onchain.walletActionExpiryMinutes` exists.
9. Keep all three Wallet-mode flags false until the fee, reward, fee-vault, and restart checkpoints pass.

Never reverse this order. Application code that reads the new tables must not reach an environment before the additive migration.

## 4. Controlled Credit-claim exercise

Preconditions:

- Cardano network is `preprod` or `preview`.
- The current identity has its own linked testnet wallet address.
- The fake-asset policy matches the configured test policy.
- The isolated operator process has its testnet mint configuration; the web app does not.
- `credit-claim-refunds` exists and is active in `BudgetCategory`.

Exercise:

1. Enable claims in the controlled environment.
2. From Credits mode, request the minimum whole-Credit claim in `/settings`.
3. Confirm the UI says the Credits are reserved and shows one claim.
4. Run the isolated distributor once:

   ```bash
   npm run chain:process-credit-claims
   ```

5. Confirm the claim becomes `submitted` or `confirmed` and records one transaction hash.
6. Confirm the linked wallet receives the exact fake asset and quantity.
7. Run the distributor again. It must verify the existing hash or report no work; it must not mint a second transaction.
8. Refresh `/settings`; Credits and wallet assets must remain separately labeled.

Repeat with the other fake currency. Then exercise rejection, timeout, duplicate form submission, expired unstarted reservation, provider failure, and process restart.

## 5. `distributing` reconciliation

If a claim remains `distributing`, do not rerun it and do not refund it automatically.

1. Record the claim ID, destination address, currency, quantity, and lease time. These are non-secret operational facts; still keep the identity scope private.
2. Search Cardano testnet activity for an output after the lease time that matches the exact destination, policy ID, asset name, and quantity.
3. If an exact transaction is found, record its hash through a reviewed reconciliation command before allowing confirmation.
4. If no transaction is found, require a second operator review before returning the reservation or resetting the claim.
5. Record the decision and evidence. Never infer “not submitted” from a temporary explorer outage.

The foundational build intentionally does not include a one-click reset for this state. The absence of an automatic retry is the duplicate-value guard.

## 6. Wallet-mode activation checkpoint

Wallet mode is not ready merely because balances can be read. Before enabling it:

- one ordinary PollCoin fee works with fake `dPOLL` and never debits Credits;
- one ordinary Gratium reward works with fake `dGRA` and never grants Credits;
- rejection, insufficient funds, wrong network, refresh, and duplicate submission are tested;
- unsupported actions state that they are unavailable in Wallet mode instead of falling back to Credits;
- True Self and Alias remain independent, including wallet address and mode;
- Help & Support explains the action to someone unfamiliar with crypto.

Only after that checkpoint may `WALLET_MODE_TESTNET_ENABLED` become `true` in the controlled test environment. Mixed mode remains off unless a separate test explicitly requires it.

Activation requires all three flags together:

```env
WALLET_MODE_TESTNET_ENABLED="true"
WALLET_DISCUSSION_FEE_ENABLED="true"
WALLET_REWARDS_TESTNET_ENABLED="true"
```

Before setting them, verify the compiled fee destination and decide how the `agoranet-platform-fees-v1` mission-treasury state is initialized and governed on the selected testnet. The current code intentionally derives the address from committed Aiken bytecode; it does not permit an environment variable to redirect fees. Do not activate a fee vault whose release/recovery policy has not been tested.

### Supervised Wallet-mode post exercise

1. Link a dedicated Lace account on the configured testnet and fund it with tADA plus fake `dPOLL`.
2. Select Wallet mode for that identity.
3. Create an ordinary Discussion post. Confirm Lace shows the expected fake `dPOLL` quantity and script destination.
4. Approve once. Confirm the UI says pending and never publishes before chain verification.
5. Close the tab after submission. Run `npm run chain:process-wallet-actions`; confirm exactly one post appears.
6. Run `npm run chain:process-wallet-actions` again; it must create nothing else.
7. Run `npm run chain:process-wallet-rewards`; confirm the exact `dGRA` first-action reward and `dPOLL` accrual reach the linked address.
8. Run the reward process again; it must not mint a duplicate.
9. Repeat rejection, wrong Lace account, insufficient fake asset, provider outage, and process restart.

### Bringing the workers back after a reboot

The database preserves work; the scripts are one-shot reconcilers, not hidden long-running daemons.

```bash
cd "/path/to/Agoranetv3/platform"
npm run chain:process-wallet-actions
npm run chain:process-wallet-rewards
```

Run the action reconciler first. It needs only the application database and chain provider. Run the reward distributor only in the isolated operator environment that holds the testnet mint configuration. Never copy the mint mnemonic into Vercel or the web application. At initial test traffic, run both after Wallet-mode activity and after a reboot. Add a supervised scheduler only after the live checkpoint; overlapping reward runs are lease-safe, but an uncertain `distributing` record still requires manual reconciliation.

## 7. Rollback

Disable new work by setting the relevant feature flag to `false` and redeploying. Do not delete claims, intents, snapshots, transaction hashes, or confirmed chain history. Continue confirmation/reconciliation for already-submitted work. An application rollback must remain schema-compatible with the additive migration.

## 8. Routine verification

```bash
npm run corpus:check
npm run db:generate
npm test
npm run db:validate:postgres
npx tsc --noEmit
npm run build
npm run db:verify
```

Network-dependent claim and wallet tests are manual, explicit checkpoints. They must never become part of the ordinary automated suite or run against mainnet.
