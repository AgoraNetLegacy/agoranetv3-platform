# Deployment — staging and production

Phase 8 deliverable. The app is deployable from this commit: the
Postgres track, runtime guard, backup/drill machinery, and scheduled
ops jobs are all built and tested. What remains is provisioning —
free accounts, no billing required at cohort scale — which is the
owner's (Claude can't and shouldn't hold a credit card, and this path
doesn't need one).

**Owner directive (2026-07-13): no monthly subscription for staging.**
The plan below is the $0/month path — Vercel + a free-tier Postgres +
GitHub Actions for the ops jobs + Cloudflare R2 for backup storage.
It satisfies every requirement in §1 without a bill.

## 1. What any host must provide (the requirements matrix)

| Requirement | Why | Where it's enforced |
|---|---|---|
| Node 20+, `npm run build:postgres` + `npm start` | The app | package.json |
| Managed PostgreSQL, TLS, pooled + direct URLs | DATABASE_SETUP.md | runtime guard refuses anything else |
| Scheduled jobs (4 jobs) | Backups, drill, crush, prune | docs/RUNBOOK.md §1 |
| Storage for backup files (need not be attached to the app host) | BACKUP_DR §3 (owner-ratified posture) | backup script writes there |
| A scratch Postgres database | The monthly restore drill | drill refuses to run against production |
| Secret manager for the three platform secrets + DB URLs | Custody discipline | runtime guard checks strength |
| Proxy that sets `x-forwarded-for` | Rate-limit keying | `TRUST_PROXY=true` declared |
| **Access-log retention configurable (off or ≤7 days), log drains OFF** | docs/LOG_DISCIPLINE_AUDIT.md #4 — binding | host dashboard; note the setting here when configured |
| Failure alerts on the ops jobs | A failed drill is a production incident | GitHub Actions email/notifications |

## 2. Provider decision — the $0/month path (owner-ratified 2026-07-13)

**Decided: Vercel + Neon/Supabase + GitHub Actions + Cloudflare R2.**
No subscription. This supersedes the earlier Render recommendation —
Render remains a fine *paid* option (one dashboard, ops jobs run as a
normal server cron), but it costs money and the free stack below
covers every Phase 8 requirement at cohort scale:

- **App hosting: Vercel** (Hobby/free tier). Next.js's home turf;
  generous free bandwidth/build/function allowances.
- **Database: Neon or Supabase** (free tier). Managed Postgres with
  pooled + direct connection strings, matching DATABASE_SETUP.md's
  dual-URL expectation exactly. Free-tier databases may pause after
  inactivity — the first request after a quiet night can be slow;
  acceptable for a cohort test, worth knowing about.
- **Ops jobs: GitHub Actions**, not host-native cron. Vercel's
  serverless functions can't run `pg_dump`/`pg_restore` as real,
  long-lived processes or hold a persistent filesystem the way the
  backup/drill/crush/prune scripts need — GitHub Actions runs them on
  a real Ubuntu runner, free at this volume, on the same cron schedule
  docs/RUNBOOK.md already specifies. This is the one real
  architecture change from the Render plan; it's a workflow-file
  change in the repo, not anything the owner does.
- **Backup storage: Cloudflare R2** (free tier, no egress fees). The
  backup script's `BACKUP_DIR` target becomes an R2 bucket instead of
  a local disk.

The spec stays provider-agnostic; nothing in the app code knows any
host's name. Moving to Render (or back) later costs an afternoon.

## 3. Standing up staging (step by step, the $0 path)

**What the owner does (all free, no card):** create accounts at
vercel.com, neon.tech (or supabase.com), and cloudflare.com.

**What Claude does from there, in one sitting:**

1. Create the Neon/Supabase project; note both connection strings
   (pooled → `DATABASE_URL`, direct → `DIRECT_DATABASE_URL`) and a
   second free database/branch for the drill (`DRILL_DATABASE_URL`).
2. Create the R2 bucket for backups; generate its access keys.
3. Connect the GitHub repo to Vercel; set the environment (see
   `.env.example`'s hosted section): `DEPLOYMENT_ENV=staging`,
   `TRUST_PROXY=true`, the three generated secrets (`openssl rand
   -hex 32` each). The app **refuses to boot** if any of this is
   missing or placeholder — that's the runtime guard working, not a
   bug.
4. Build & release: `npm run build:postgres` (generates the Postgres
   client, runs the guard, builds). Release command:
   `npm run db:migrate:postgres && npm run db:seed:postgres`.
   (Migrations are `migrate deploy` — they only apply checked-in
   history; the seed is idempotent.)
5. Add a `.github/workflows/ops.yml` scheduled workflow running the
   four jobs from docs/RUNBOOK.md §1 (backup → R2, drill, crush,
   prune) on the same cadence, with `secrets.*` holding the DB URLs
   and R2 keys. GitHub emails on workflow failure by default — that
   covers the "failure alerts" requirement with nothing to configure.
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
