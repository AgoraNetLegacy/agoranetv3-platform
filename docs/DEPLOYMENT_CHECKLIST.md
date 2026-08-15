# AgoraNet v3 Deployment Checklist

Use this checklist as the source of truth for the staging deployment. Do not
delete or repurpose hosted resources until their role is recorded here.

## Local application

- [x] Review the pending session-lifetime changes.
- [x] Run test suite: 22 files, 319 tests passed.
- [x] Run TypeScript validation.
- [x] Run `npm run build:postgres` successfully.
- [x] Commit clean working tree: `5fc9f81`.

## Railway — staging infrastructure

- [x] Railway account authenticated.
- [x] Project exists: `agoranet-staging`.
- [x] Inventory completed: three standalone PostgreSQL services; no app or ops
  service is deployed yet.
- [x] `Postgres` assigned as the application database.
- [x] `Postgres-TSjx` reserved as the scratch/restore-drill database.
- [ ] Resolve the role of the third PostgreSQL service before changing it.
- [x] Enable Railway TCP public access for `Postgres` on PostgreSQL port 5432.
- [x] Configure database variables without exposing secret values.
- [x] Run PostgreSQL migrations (`0_init`).
- [x] Seed the staging database.
- [ ] Add and configure the operations service after the app is working.

## Vercel — application hosting

- [x] Confirm the Vercel project is linked to `projectpollify/agoranetv3-platform`.
- [x] Configure staging environment variables.
- [x] Set build command to `npm run build:postgres`.
- [x] Deploy the committed application.
- [x] Verify the deployment URL: https://agoranet-staging.vercel.app

## Verification

- [x] Run `npm run db:verify:postgres` against staging — all checks passed.
- [x] Run `STAGING_URL=https://agoranet-staging.vercel.app npm run smoke:staging`.
- [ ] Complete one throwaway-soul walkthrough.
- [ ] Record final URLs and resource names here.

## Rules

- No production deployment.
- No mainnet or custody configuration.
- No deletion of Railway resources without an identified role and explicit
  confirmation at the point of deletion.
- Never commit `.env` or provider secrets.

## Current Railway inventory

All three services expose the standard Railway/Postgres variables and are
currently empty according to their reported volume usage. Their roles have not
yet been assigned:

- `Postgres`
- `Postgres-TSjx`
- `Postgres-43aM`

## Working staging result

- Public app: https://agoranet-staging.vercel.app
- Railway project: `agoranet-staging`
- Main database: `Postgres` with TCP public access enabled on port 5432.
- Scratch database: `Postgres-TSjx` reserved for restore drills.
- Verification: Postgres invariant suite passed; all public smoke surfaces
  returned HTTP 200 with their expected landmarks.
