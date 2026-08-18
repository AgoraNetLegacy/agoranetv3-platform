# AgoraNet v3 Deployment Checklist

Use this checklist as the source of truth for the staging deployment. Do not
delete or repurpose hosted resources until their role is recorded here.

## Local application

- [x] Review the pending session-lifetime changes.
- [x] Run test suite: 22 files, 323 tests passed.
- [x] Run TypeScript validation.
- [x] Run `npm run build:postgres` successfully.
- [x] Commit and push the migration-first Chamber-cover release through
  `629571e`.

## Railway; staging infrastructure

- [x] Railway account authenticated.
- [x] Project exists: `agoranet-staging`.
- [x] Inventory completed: three standalone PostgreSQL services; the Railway
  operations service is deployed and configured.
- [x] `Postgres` assigned as the application database.
- [x] `Postgres-TSjx` reserved as the scratch/restore-drill database.
- [ ] Resolve the role of the third PostgreSQL service before changing it.
- [x] Enable Railway TCP public access for `Postgres` on PostgreSQL port 5432.
- [x] Configure database variables without exposing secret values.
- [x] Run PostgreSQL migrations (`0_init`, reply-fee update, and
  `20260817_chamber_cover_metadata`).
- [x] Seed the staging database.
- [x] Add and configure the operations service after the app is working.

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

## Verification

- [x] Run `npm run db:verify:postgres` against staging; all checks passed.
- [x] Run `STAGING_URL=https://agoranet-staging.vercel.app npm run smoke:staging`.
- [x] Enable Cloudflare Turnstile in Vercel Production and verify the live
  `/verify` flow on `agoranet.ai`.
- [ ] Complete one throwaway-soul walkthrough.
- [x] Record final URLs and resource names here.

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

## Working staging result

- Public app: https://agoranet-staging.vercel.app
- Custom domain: `agoranet.ai` verified and redirecting to canonical `www` hostname.
- Railway project: `agoranet-staging`
- Main database: `Postgres` with TCP public access enabled on port 5432.
- Scratch database: `Postgres-TSjx` reserved for restore drills.
- Verification: Postgres invariant suite passed; all public smoke surfaces
  returned HTTP 200 with their expected landmarks; Railway operations service
  is active with scheduled jobs and failure notifications configured.
- Anti-bot gate: Cloudflare Turnstile is enabled in Production; `/verify`
  successfully renders and validates the challenge.
- Public image lane: Vercel Blob store `agoranet-chamber-covers`; Chamber
  cover uploads are sanitized, metadata-stripped, limited to 5 MB, and tracked
  by append-only ledger events.
