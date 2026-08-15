# Recovery Runbook; backups, drills, and the worst day

Per `Backup and DR/BACKUP_DR_SPEC.md` (owner-ratified 2026-07-08).
This document is maintained WITH the machinery it describes; if a
script changes, this file changes in the same commit. **Keep a printed
or off-platform copy**; §4's quarterly drill exists partly to answer
"where is the runbook when the primary machine is gone."

**The objectives (ratified):**
- **RPO ~1 day at launch**; nightly backups, built to tighten
  (`backup.cadenceHours` rail; tightening is a schedule change, not a
  project). **Mandatory re-review before Phase 9** (real money).
- **RTO: restore within a working day** at launch scale.
- Backups live **same provider, different region** (ratified, with the
  honest limitation on record: provider-wide compromise reaches both
  copies; the 3-2-1 second-provider upgrade joins the Phase 9 entry
  checklist).

---

## 1. What runs on a schedule (cron, explained)

`cron` is the host's job scheduler: a daemon that reads a table
(`crontab`) of "at these times, run this command" lines. Each line is
five time fields (minute, hour, day-of-month, month, day-of-week)
followed by the command. `crontab -e` edits your user's table;
`crontab -l` lists it. Railway (the decided host; see
docs/DEPLOYMENT.md, owner-ratified 2026-07-13) offers the same thing
as "cron jobs" in its dashboard, which is what we'll actually use: you
paste the command and pick the schedule in a UI, and the host runs it
in the app's environment (env vars already present).

The platform's schedule (all times UTC):

| When | Command | What it is |
|---|---|---|
| `0 3 * * *` (03:00 daily) | `cd /app && npm run db:backup:postgres` | The nightly backup. Cadence = the RPO rail; tightening RPO means adding lines (e.g. hourly `0 * * * *`), nothing else changes. |
| `30 3 * * *` (03:30 daily) | `cd /app && npm run rate-limits:prune` | Deletes expired rate-limit counters (minimal-log discipline). |
| `0 4 1 * *` (04:00, 1st of month) | `cd /app && npm run db:restore-drill` | The monthly automated restore drill (§4). **A failed drill is a production incident**; the job exits nonzero so the host's failure alert fires; make sure that alert is switched on. |
| `45 3 * * *` (03:45 daily) | `cd /app && npm run analytics:crush` | The 90-day crush (ANALYTICS §5): raw events past the retention rail become permanent aggregates and are deleted. db:verify check 26 fails if this stops running. |
| `0 5 * * *` (05:00 daily) | `cd /app && npm run chain:anchor` | **New, Phase 8.6.** The civic ledger's daily anchor: witnesses the current head hash in a public Cardano preprod transaction, rail-governed (`anchor.cadenceHours`) and idempotent; skips cleanly if nothing's moved or the cadence hasn't elapsed. db:verify check 27 keeps the on-chain witness and the internal record honest against each other. |

Required environment for the jobs (beyond the app's own env):
`BACKUP_DIR` (a path on the region-replicated volume),
`DRILL_DATABASE_URL` (a scratch Postgres database; never production;
the drill refuses to run if it matches), `CARDANO_NETWORK` +
`BLOCKFROST_PROJECT_ID` + `TESTNET_MINT_MNEMONIC` (the anchor job,
testnet-only, no real value), and optionally `OPERATOR_NAME` when a
human runs a job by hand (the admin log attributes runs; unattended
runs are recorded as `unattended-cron`).

Every run lands on the public admin log (`admin.backup.*` events on
the civic ledger, rendered at `/transparency`); souls can see that
backups happen and that drills pass, without learning anything else.

## 2. The monthly automated drill (what it proves)

`npm run db:restore-drill`:
1. restores the **latest** backup into the scratch database,
2. runs the FULL `db:verify` invariant suite (29 checks) against the
   restored copy; because the ledger is hash-chained, this proves the
   recovered data is **cryptographically untampered**, not merely
   present,
3. records `admin.backup.drill { ok }` on the production admin log,
4. exits nonzero on any failure.

## 3. The quarterly manual drill (what scripts can't test)

A human; Shawn, or whoever operates that quarter; walks this list
end to end and notes the date in the ops journal:

- [ ] Can you reach the hosting dashboard **without** the primary
      machine (phone/second device; are the credentials in the
      password manager)?
- [ ] Can you reach this runbook without the repo (printed/off-platform
      copy current)?
- [ ] List the backups (`ls $BACKUP_DIR`): is last night's there and
      plausibly sized (`du -h`)?
- [ ] Run the drill by hand with your name attached:
      `cd /app && OPERATOR_NAME=<you> npm run db:restore-drill`
- [ ] Restore to a scratch db and click around a staging app pointed at
      it: do Discussions render, does `/ledger` verify, does
      `/transparency` show the books?
- [ ] DNS: do you know where the domain is registered and can you log
      in there?
- [ ] Secrets: are `GATE_OPERATOR_SECRET`, `DM_MASTER_SECRET`,
      `RATE_LIMIT_SECRET`, and the database credentials in the secret
      manager, and do you know the rotation procedure?

## 4. The worst day; decision tree

First, classify. The three bad days are different days:

**A. Corruption / bad deploy** (app is up but data is wrong, or
`db:verify` fails):
1. Take the app down (maintenance mode / scale to zero). Do not let
   writes continue on a corrupt record.
2. `pg_dump` the CURRENT (corrupt) state to a separate file; evidence,
   and protection against making it worse.
3. Identify the last good backup: run the drill against candidates
   (newest first) until `db:verify` passes clean.
4. Restore it to the scratch db first, sanity-check, then to production:
   `ALLOW_DATABASE_RESTORE=YES RESTORE_DATABASE_URL=<prod> BACKUP_FILE=<good dump> npm run db:restore:postgres`
5. `npm run db:verify:postgres` against production. Green before traffic.
6. Bring the app up. Write the incident note. The restore is already on
   the public admin log (`admin.backup.restored`); say publicly what
   window of activity was lost; the RPO is a promise, honor it honestly.

**B. Outage / host loss** (region or provider down, data presumed fine):
1. Don't restore anything yet; an outage is not corruption. Wait for
   provider status or fail over.
2. If the region is gone: provision the standby region (the deploy doc's
   provisioning steps), point it at the replicated backup volume,
   restore the latest backup, `db:verify`, repoint DNS.
3. RTO is a working day; move deliberately, not frantically.

**C. Compromise** (unauthorized access suspected):
1. Freeze: revoke the deploy tokens and database credentials FIRST,
   then take the app down.
2. Rotate every secret (the three platform secrets + database + host
   +, since Phase 8.6, the testnet chain secrets; `BLOCKFROST_PROJECT_ID`,
   `TESTNET_MINT_MNEMONIC`, `MIDNIGHT_DEPLOY_SEED`; low urgency, since
   all three are testnet-only and hold no real value, but rotate for
   cleanliness). Note: rotating `GATE_OPERATOR_SECRET` invalidates
   Phase A nullifier derivation for NEW acts only (spent nullifiers
   are stored); rotating `DM_MASTER_SECRET` re-keys DM escrow; both
   rotations are documented operator acts for the admin log.
3. Preserve evidence (dump current state; keep host logs).
4. Restore to a KNOWN-GOOD backup from before the intrusion window on
   fresh infrastructure; `db:verify` proves the restored ledger
   untampered; that proof is the point of the hash chain.
5. Disclose on the platform, plainly. The trust model is honesty.

**Who does what:** at launch scale the operator is Shawn; every step
above is a one-person job by design. When that changes, this section
gains names.

## 5. What is deliberately NOT in backups

Wallet keys and soul credential material; never platform-held
(DUAL_IDENTITY). The platform's own operational secrets live in the
host's secret manager (custody spec's jurisdiction), NOT in dumps:
a leaked backup contains ciphertext DMs and hashed identifiers only.
Backups inherit the data's sensitivity: encrypted at rest (host-level
volume/bucket encryption ON), access individually attributable, and
access recorded on the admin log.
