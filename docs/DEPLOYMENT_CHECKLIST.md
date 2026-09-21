# AgoraNet v3 Deployment Checklist

Use this checklist as the source of truth for the staging deployment. Do not
delete or repurpose hosted resources until their role is recorded here.

## Local application

- [x] Review the pending session-lifetime changes.
- [x] Run test suite: 22 files, 327 tests passed.
- [x] Run TypeScript validation.
- [x] Run `npm run build:postgres` successfully.
- [x] Create and verify a PostgreSQL 18 production backup, then deploy the
  index-only `20260818_performance_indexes` migration before the performance
  application release.
- [x] Commit and push the migration-first Chamber-cover release through
  `629571e`.
- [x] On 2026-08-31, create and validate a PostgreSQL 18 production backup,
  then apply `20260829_unified_pollinator_currency` and
  `20260831_expand_welcome_grants` before verifying the corresponding live
  application releases.

## Railway; staging infrastructure

- [x] Railway account authenticated.
- [x] Project exists: `agoranet-staging`.
- [x] Inventory completed: three standalone PostgreSQL services.
- [x] `Postgres` assigned as the application database.
- [x] `Postgres-TSjx` reserved as the scratch/restore-drill database.
- [ ] Resolve the role of the third PostgreSQL service before changing it.
- [x] Enable Railway TCP public access for `Postgres` on PostgreSQL port 5432.
- [x] Configure database variables without exposing secret values.
- [x] Run PostgreSQL migrations (`0_init`, reply-fee update, and
  `20260817_chamber_cover_metadata`).
- [x] Seed the staging database.
- [x] Re-provision and verify the private `agoranet-operations` scheduler.
  The 2026-08-25 deployment is built from `Dockerfile.operations`, has no
  public domain, mounts its persistent backup volume at `/data`, and starts
  the UTC scheduler loop successfully.
- [ ] Observe the first scheduled backup and monthly restore drill, then
  confirm Railway failure notifications for this service.

## Vercel; application hosting

- [x] Confirm the Vercel project is linked to `projectpollify/agoranetv3-platform`.
- [x] Configure staging environment variables.
- [x] Set build command to `npm run build:postgres`.
- [x] Deploy the committed application.
- [x] Verify the deployment URL: https://agoranet-staging.vercel.app
- [x] Attach custom domain `agoranet.ai` to the Vercel project.
- [x] Verify `https://agoranet.ai` after DNS propagation.
- [x] Provision and connect the public `agoranet-chamber-covers` Vercel Blob
  store without committing its token.
- [x] Deploy Chamber-cover code with uploads disabled, smoke-test, then enable
  `CHAMBER_COVERS_ENABLED` and redeploy.
- [x] Permit the public Vercel Blob host in the production image CSP and verify
  the policy on the canonical domain.
- [x] Deploy and verify the public Platform Souls Directory and the
  **Platform/Fellow Souls** navigation entry.

## Verification

- [x] Run `npm run db:verify:postgres` against staging; all checks passed.
- [x] Run `STAGING_URL=https://agoranet-staging.vercel.app npm run smoke:staging`.
- [x] Enable Cloudflare Turnstile in Vercel Production and verify the live
  `/verify` flow on `agoranet.ai`.
- [ ] Complete one throwaway-soul walkthrough.
- [x] Record final URLs and resource names here.
- [x] Verify on 2026-08-31 that `/souls` is readable without signing in, lists
  all seven registered production profiles regardless of presence, gives
  True Self and Alias profiles identical directory cards, and keeps the
  directory payload free of identity type and private social state.
- [x] Historical: on 2026-08-31 the live header showed the then-current
  combined wallet + platform balances and unified 20-unit Chamber cost. This
  implementation was superseded by the restored dual-token requirement below.
- [ ] Apply `20260906_restore_dual_token_chamber_fees`, which restores the
  ratified dual-token pricing (20u PC + 20u G) that
  `20260829_unified_pollinator_currency` had collapsed into one substitutable
  20-unit cost. Then confirm chamber creation requires BOTH tokens and that
  `db:verify:postgres` reports chamber integrity green.
- [ ] Apply `20260906_wallet_dual_fee_settlement` (adds the nullable
  `secondaryCurrency`/`secondaryAmount` columns to `TokenTransactionIntent`),
  then confirm a wallet-mode identity is offered the self-custody chamber
  option and that `db:verify:postgres` still reports chamber integrity green.

## Rules

- Production changes follow backup → migration → disabled code → smoke test →
  feature enablement; database-reading code never leads its migration.
- No mainnet or custody configuration.
- No deletion of Railway resources without an identified role and explicit
  confirmation at the point of deletion.
- Never commit `.env` or provider secrets.

## Current Railway inventory

All three services expose the standard Railway/Postgres variables. Their
recorded roles are:

- `Postgres`; application database.
- `Postgres-TSjx`; scratch/restore-drill database.
- `Postgres-43aM`; unassigned; do not change until its role is confirmed.
- `agoranet-operations`; private scheduler with the
  `agoranet-operations-volume` volume mounted at `/data`. It uses `Postgres`
  for routine work and `Postgres-TSjx` only for restore drills.

## Working staging result

- Public app: https://agoranet-staging.vercel.app
- Custom domain: `agoranet.ai` verified and redirecting to canonical `www` hostname.
- Railway project: `agoranet-staging`
- Main database: `Postgres` with TCP public access enabled on port 5432.
- Scratch database: `Postgres-TSjx` reserved for restore drills.
- Verification: Postgres invariant suite passed and all public smoke surfaces
  returned HTTP 200 with their expected landmarks. The private Railway
  operations service is online; its corrected Docker build, mounted volume,
  PostgreSQL Prisma client, and scheduler startup were verified on 2026-08-25.
  The remaining evidence is the first scheduled backup, restore drill, and
  configured failure notifications.
- Anti-bot gate: Cloudflare Turnstile is enabled in Production; `/verify`
  successfully renders and validates the challenge.
- Public image lane: Vercel Blob store `agoranet-chamber-covers`; Chamber
  cover uploads are sanitized, metadata-stripped, limited to 5 MB, and tracked
  by append-only ledger events.
