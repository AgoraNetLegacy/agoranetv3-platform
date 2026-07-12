# Deployment — staging and production

Phase 8 deliverable. The app is deployable from this commit: the
Postgres track, runtime guard, backup/drill machinery, and cron jobs
are all built and tested. What remains is provisioning — accounts,
billing, DNS — which is the owner's (Claude can't and shouldn't hold
the credit card).

## 1. What any host must provide (the requirements matrix)

| Requirement | Why | Where it's enforced |
|---|---|---|
| Node 20+, `npm run build:postgres` + `npm start` | The app | package.json |
| Managed PostgreSQL, TLS, pooled + direct URLs | DATABASE_SETUP.md | runtime guard refuses anything else |
| Cron / scheduled jobs (4 jobs) | Backups, drill, crush, prune | docs/RUNBOOK.md §1 |
| Persistent volume or same-provider different-region storage for `BACKUP_DIR` | BACKUP_DR §3 (owner-ratified posture) | backup script writes there |
| A scratch Postgres database | The monthly restore drill | drill refuses to run against production |
| Secret manager for the three platform secrets + DB URLs | Custody discipline | runtime guard checks strength |
| Proxy that sets `x-forwarded-for` | Rate-limit keying | `TRUST_PROXY=true` declared |
| **Access-log retention configurable (off or ≤7 days), log drains OFF** | docs/LOG_DISCIPLINE_AUDIT.md #4 — binding | host dashboard; note the setting here when configured |
| Failure alerts on cron jobs | A failed drill is a production incident | host dashboard |

## 2. Provider recommendation (Track 5 #37 — flagged, owner decides)

**Recommended: Render** (one dashboard for a solo operator: web
service + managed Postgres + native cron jobs + persistent disks +
env groups). Runner-up: **Railway** (same shape, slightly simpler,
younger platform); **Fly.io** if multi-region control ever matters
more than dashboard simplicity. Ruled out for launch: Vercel-style
serverless — the cron scripts (pg_dump, restore drill) want a real
filesystem and shell, and serverless splits the app from its ops.

The spec is provider-agnostic by design; nothing in the repo knows the
host's name. Switching costs one afternoon of dashboard work.

## 3. Standing up staging (step by step)

1. Create the staging Postgres (note both URLs: pooled → `DATABASE_URL`,
   direct → `DIRECT_DATABASE_URL`) and a second empty database on the
   same instance for the drill (`DRILL_DATABASE_URL`).
2. Set the environment (see `.env.example`'s hosted section):
   `DEPLOYMENT_ENV=staging`, `TRUST_PROXY=true`, the three generated
   secrets (`openssl rand -hex 32` each), `BACKUP_DIR` on the mounted
   disk. The app **refuses to boot** if any of this is missing or
   placeholder — that's the runtime guard working, not a bug.
3. Build & release: `npm run build:postgres` (generates the Postgres
   client, runs the guard, builds). Release command:
   `npm run db:migrate:postgres && npm run db:seed:postgres`.
   (Migrations are `migrate deploy` — they only apply checked-in
   history; the seed is idempotent.)
4. Add the four cron jobs from docs/RUNBOOK.md §1. Turn ON failure
   alerts, especially for the drill.
5. Configure the access-log posture (matrix row above) and record the
   setting in this file.
6. Verify: `npm run db:verify:postgres` against staging, then
   `STAGING_URL=https://<staging-host> npm run smoke:staging` (public
   surfaces + landmark content, signed out).
7. Onboard one throwaway soul end to end (verify → True Self →
   consents → seed → post somewhere), then check `/commons` shows the
   funnel moved and `/transparency` shows the fee.

Production later = the same steps with `DEPLOYMENT_ENV=production`,
plus DNS and the go/no-go items on the Phase 8 checkpoint.

## 4. What is deliberately NOT set up

- **No error-tracking/observability SaaS** — LOG_DISCIPLINE_AUDIT §4
  rule 4: any such tool gets its own correlation review first.
- **No CDN/edge cache config** — text-first launch doesn't need one;
  adding one later must respect `force-dynamic` pages.
- **No email provider** — nothing sends email (notifications are
  in-app by ratified design; recovery is key-based).
- **No object storage** — no uploads at launch (BACKUP_DR §6.2 notes
  the future media lane).
