// The nightly backup (BACKUP_DR_SPEC §1–3, owner-ratified). pg_dump
// custom-format archive + retention enforcement + the admin-log event.
// Cadence is the RPO rail (backup.cadenceHours); the cron invokes this
// script; tightening the RPO is a schedule change, never a redesign.
//
// Where backups live is the host's job (same provider, different region
//; owner-ratified; see docs/RUNBOOK.md): point BACKUP_DIR at the
// replicated/attached volume. Retention (30 daily / 12 monthly, rails)
// is enforced here: dailies beyond the daily window are pruned unless
// they are a month's first backup, which survives the monthly window.

import { mkdirSync, readdirSync, statSync, unlinkSync } from "fs";
import { spawnSync } from "child_process";
import { resolve, join, basename } from "path";
import { loadEnvConfig } from "@next/env";
import { selectPostgresConnectionUrl } from "../lib/postgresConnection";

loadEnvConfig(process.cwd());

const PREFIX = "agoranet-";
const SUFFIX = ".dump";

function backupDate(file: string): string | null {
  // agoranet-2026-07-11T03-00-00-000Z.dump → "2026-07-11"
  const m = basename(file).match(/^agoranet-(\d{4}-\d{2}-\d{2})T/);
  return m ? m[1] : null;
}

/** Enforce 30-daily/12-monthly (rails read by the caller; passed in so
 *  this stays a pure file policy, testable without a database). */
export function selectPrunable(
  files: string[],
  now: Date,
  retainDaily: number,
  retainMonthly: number
): string[] {
  const dated = files
    .map((f) => ({ f, date: backupDate(f) }))
    .filter((x): x is { f: string; date: string } => x.date !== null)
    .sort((a, b) => (a.f < b.f ? -1 : 1));

  // The month's first backup is the monthly candidate.
  const monthlyKeeper = new Map<string, string>();
  for (const { f, date } of dated) {
    const month = date.slice(0, 7);
    if (!monthlyKeeper.has(month)) monthlyKeeper.set(month, f);
  }

  const dailyCutoff = new Date(now.getTime() - retainDaily * 24 * 60 * 60 * 1000);
  const monthlyCutoff = new Date(now);
  monthlyCutoff.setUTCMonth(monthlyCutoff.getUTCMonth() - retainMonthly);

  return dated
    .filter(({ f, date }) => {
      const when = new Date(`${date}T00:00:00Z`);
      if (when >= dailyCutoff) return false; // inside the daily window
      const isMonthly = monthlyKeeper.get(date.slice(0, 7)) === f;
      if (isMonthly && when >= monthlyCutoff) return false; // kept monthly
      return true;
    })
    .map(({ f }) => f);
}

async function main() {
  const databaseUrl = selectPostgresConnectionUrl();
  if (!/^(postgresql|postgres):\/\//.test(databaseUrl)) {
    throw new Error("A PostgreSQL DATABASE_URL or DIRECT_DATABASE_URL is required.");
  }

  const backupDir = resolve(process.env.BACKUP_DIR ?? "backups");
  mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = join(backupDir, `${PREFIX}${timestamp}${SUFFIX}`);
  const pgDump = process.env.PG_DUMP_BIN?.trim() || "pg_dump";

  const result = spawnSync(
    pgDump,
    ["--format=custom", "--no-owner", "--no-privileges", "--file", backupFile, databaseUrl],
    { stdio: "inherit" }
  );
  if (result.error?.message.includes("ENOENT")) {
    throw new Error(`${pgDump} is not installed or not on PATH.`);
  }
  if (result.status !== 0) throw new Error("PostgreSQL backup failed.");
  const sizeBytes = statSync(backupFile).size;

  // Retention + the admin-log record, against the database just backed up.
  const { db } = await import("../lib/db");
  const { getRail } = await import("../lib/rails");
  const { recordOpsEvent } = await import("../lib/opsLog");

  const retainDaily = await getRail(db, "backup.retainDaily");
  const retainMonthly = await getRail(db, "backup.retainMonthly");
  const candidates = readdirSync(backupDir).filter(
    (f) => f.startsWith(PREFIX) && f.endsWith(SUFFIX)
  );
  const prunable = selectPrunable(candidates, new Date(), retainDaily, retainMonthly);
  for (const f of prunable) unlinkSync(join(backupDir, f));

  await recordOpsEvent(db, "admin.backup.created", {
    file: basename(backupFile),
    sizeBytes,
    retained: candidates.length - prunable.length,
    pruned: prunable.length,
  });
  await db.$disconnect();

  console.log(
    `Backup written: ${backupFile} (${sizeBytes} bytes); ` +
      `${prunable.length} pruned, ${candidates.length - prunable.length} retained.`
  );
}

// Allow tests to import selectPrunable without running a backup.
if (process.env.VITEST !== "true") main();
