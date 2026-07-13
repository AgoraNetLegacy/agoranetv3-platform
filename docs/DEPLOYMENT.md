# Deployment — staging and production

Phase 8 deliverable. The app is deployable from this commit: the
Postgres track, runtime guard, backup/drill machinery, and scheduled
ops jobs are all built and tested. What remains is provisioning —
free accounts, no billing required at cohort scale — which is the
owner's (Claude can't and shouldn't hold a credit card, and this path
doesn't need one).

**Owner directive (2026-07-13): reuse his existing stack — Vercel for
the app, Railway for the backend infra** (his convention across his
other projects; he already holds both accounts). This lands cheaper
than Render and needs no new signups.

## 1. What any host must provide (the requirements matrix)

| Requirement | Why | Where it's enforced |
|---|---|---|
| Node 20+, `npm run build:postgres` + `npm start` | The app | package.json |
| Managed PostgreSQL, TLS, pooled + direct URLs | DATABASE_SETUP.md | runtime guard refuses anything else |
| Scheduled jobs (4 jobs) | Backups, drill, crush, prune | docs/RUNBOOK.md §1 |
| Storage for backup files | BACKUP_DR §3 (owner-ratified posture) | backup script writes there |
| A scratch Postgres database | The monthly restore drill | drill refuses to run against production |
| Secret manager for the three platform secrets + DB URLs | Custody discipline | runtime guard checks strength |
| Proxy that sets `x-forwarded-for` | Rate-limit keying | `TRUST_PROXY=true` declared |
| **Access-log retention configurable (off or ≤7 days), log drains OFF** | docs/LOG_DISCIPLINE_AUDIT.md #4 — binding | host dashboard; note the setting here when configured |
| Failure alerts on the ops jobs | A failed drill is a production incident | host dashboard notifications |

## 2. Provider decision — Vercel + Railway (owner-ratified 2026-07-13)

**Decided: Vercel hosts the app; Railway hosts the backend infra.**
This is the owner's established split across his other projects, and
it happens to fit this app cleanly even though AgoraNet is a single
Next.js codebase (pages and server-side logic together, not a
separate frontend/backend service pair — nothing here gets split
apart to match the convention, just hosted across the two providers
the way he already thinks about infrastructure):

- **Vercel** (Hobby/free tier) hosts the whole app — every page and
  all its server actions. Next.js's home turf; generous free
  bandwidth/build/function allowances.
- **Railway** (existing account; usage-based billing, historically a
  small monthly minimum — check the current rate on the dashboard) is
  the backend: managed Postgres (pooled + direct connection strings,
  matching DATABASE_SETUP.md's dual-URL expectation) plus a second
  free database for the restore drill, AND a small always-on service
  running the four ops jobs (backup, drill, crush, prune) on
  schedule. Railway containers are real, persistent, and have a real
  filesystem — unlike Vercel's serverless functions, they can run
  `pg_dump`/`pg_restore` as genuine long-lived processes and hold
  backup files on an attached volume with no third service needed for
  storage.

Superseded by this: the Render recommendation (cost) and a briefly-
considered Vercel+Neon+GitHub-Actions+Cloudflare-R2 stitch (unneeded
complexity once Railway's real containers are in the picture).

The spec stays provider-agnostic; nothing in the app code knows any
host's name. Moving providers later costs an afternoon.

## 3. Standing up staging (step by step, Vercel + Railway)

**What the owner does:** create a free Vercel account if he doesn't
already have one for this repo (Railway account already exists).

**What Claude does from there, in one sitting:**

1. On Railway: create the Postgres service; note both connection
   strings (pooled → `DATABASE_URL`, direct → `DIRECT_DATABASE_URL`)
   and a second database for the drill (`DRILL_DATABASE_URL`).
2. On Railway: create a small second service (the "ops" service) from
   this same repo, with a persistent volume mounted for `BACKUP_DIR`,
   running the four scheduled jobs from docs/RUNBOOK.md §1 via
   Railway's cron trigger — real `pg_dump`/`pg_restore` on a real
   filesystem, no external storage needed.
3. Connect the GitHub repo to Vercel for the app itself; set the
   environment (see `.env.example`'s hosted section):
   `DEPLOYMENT_ENV=staging`, `TRUST_PROXY=true`, the three generated
   secrets (`openssl rand -hex 32` each), plus the Railway `DATABASE_URL`.
   The app **refuses to boot** if any of this is missing or
   placeholder — that's the runtime guard working, not a bug.
4. Build & release: `npm run build:postgres` (generates the Postgres
   client, runs the guard, builds). Release command:
   `npm run db:migrate:postgres && npm run db:seed:postgres`.
   (Migrations are `migrate deploy` — they only apply checked-in
   history; the seed is idempotent.)
5. Turn on Railway's failure notifications for the ops service —
   covers the "a failed drill is a production incident" requirement.
6. Configure the access-log posture (matrix row above) and record the
   setting in this file.
7. Verify: `npm run db:verify:postgres` against staging, then
   `STAGING_URL=https://<staging-host> npm run smoke:staging` (public
   surfaces + landmark content, signed out).
8. Onboard one throwaway soul end to end (verify → True Self →
   consents → seed → post somewhere), then check `/commons` shows the
   funnel moved and `/transparency` shows the fee.

Production later = the same steps (likely on paid tiers by then, once
there's real usage to justify it), plus DNS and the go/no-go items on
the Phase 8 checkpoint.

## 4. What is deliberately NOT set up

- **No error-tracking/observability SaaS** — LOG_DISCIPLINE_AUDIT §4
  rule 4: any such tool gets its own correlation review first.
- **No CDN/edge cache config** — text-first launch doesn't need one;
  adding one later must respect `force-dynamic` pages.
- **No email provider** — nothing sends email (notifications are
  in-app by ratified design; recovery is key-based).
- **No object storage** — no uploads at launch (BACKUP_DR §6.2 notes
  the future media lane).
