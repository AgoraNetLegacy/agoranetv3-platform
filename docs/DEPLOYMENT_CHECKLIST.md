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
- [ ] Verify which PostgreSQL service is the application database.
- [ ] Verify which PostgreSQL service is the scratch/restore-drill database.
- [ ] Resolve the role of the third PostgreSQL service before changing it.
- [ ] Configure database variables without exposing secrets.
- [ ] Run PostgreSQL migrations.
- [ ] Seed the staging database.
- [ ] Add and configure the operations service after the app is working.

## Vercel — application hosting

- [ ] Confirm the Vercel project is linked to `projectpollify/agoranetv3-platform`.
- [ ] Configure staging environment variables.
- [ ] Set build command to `npm run build:postgres`.
- [ ] Deploy the committed application.
- [ ] Verify the deployment URL.

## Verification

- [ ] Run `npm run db:verify:postgres` against staging.
- [ ] Run `STAGING_URL=<url> npm run smoke:staging`.
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
