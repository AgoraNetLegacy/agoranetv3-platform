// The monthly automated restore drill (BACKUP_DR_SPEC §4, owner-ratified):
// prove recovery BEFORE it's needed. Restores the latest backup into a
// scratch database, runs the full db:verify invariant suite against the
// restored copy — the hash-chained ledger makes recovery *provably
// untampered*, not just "the data is back" — and records pass/fail on
// the admin log. A failed drill is a production incident, not a
// curiosity: this script exits nonzero so the cron's failure alert fires.
//
// Required: DRILL_DATABASE_URL (scratch Postgres, NEVER production —
// refused if it matches), BACKUP_DIR or BACKUP_FILE. The ops host runs
// with the Postgres client generated (db:generate:postgres).

import { existsSync, readdirSync } from "fs";
import { basename, join, resolve } from "path";
import { spawnSync } from "child_process";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function latestBackup(dir: string): string {
  const files = readdirSync(dir)
    .filter((f) => f.startsWith("agoranet-") && f.endsWith(".dump"))
    .sort();
  if (!files.length) throw new Error(`No backups found in ${dir}.`);
  return join(dir, files[files.length - 1]);
}

async function main() {
  const drillUrl = process.env.DRILL_DATABASE_URL ?? "";
  const productionUrl = process.env.DATABASE_URL ?? "";
  if (!/^(postgresql|postgres):\/\//.test(drillUrl)) {
    throw new Error("DRILL_DATABASE_URL must be a PostgreSQL connection (the scratch database).");
  }
  if (drillUrl === productionUrl || drillUrl === process.env.DIRECT_DATABASE_URL) {
    throw new Error("DRILL_DATABASE_URL must not be the production database.");
  }

  const backupFile = process.env.BACKUP_FILE
    ? resolve(process.env.BACKUP_FILE)
    : latestBackup(resolve(process.env.BACKUP_DIR ?? "backups"));
  if (!existsSync(backupFile)) {
    throw new Error(`Backup file not found: ${backupFile}`);
  }

  console.log(`Drill: restoring ${basename(backupFile)} into the scratch database…`);
  const pgRestore = process.env.PG_RESTORE_BIN?.trim() || "pg_restore";
  const restore = spawnSync(
    pgRestore,
    ["--clean", "--if-exists", "--no-owner", "--no-privileges", "--dbname", drillUrl, backupFile],
    { stdio: "inherit" }
  );
  const restored = restore.status === 0;

  let verified = false;
  let note = restored ? "" : "pg_restore failed";
  if (restored) {
    console.log("Drill: running the invariant suite against the restored copy…");
    const verify = spawnSync("npx", ["tsx", "scripts/verify.ts"], {
      env: { ...process.env, DATABASE_URL: drillUrl },
      encoding: "utf8",
    });
    verified = verify.status === 0;
    const output = `${verify.stdout ?? ""}${verify.stderr ?? ""}`;
    process.stdout.write(output);
    if (!verified) {
      note =
        output
          .split("\n")
          .find((l) => l.includes("✗") || l.toLowerCase().includes("error")) ??
        "db:verify failed";
    }
  }

  const ok = restored && verified;

  // Report to the admin log on PRODUCTION (the system-health record of
  // whether recovery works), then honor the incident contract.
  const { db } = await import("../lib/db");
  const { recordOpsEvent } = await import("../lib/opsLog");
  await recordOpsEvent(db, "admin.backup.drill", {
    file: basename(backupFile),
    ok,
    ...(ok ? {} : { note: note.slice(0, 300) }),
  });
  await db.$disconnect();

  if (!ok) {
    console.error("DRILL FAILED — treat as a production incident (BACKUP_DR §4).");
    process.exit(1);
  }
  console.log("Drill passed: the backup restores, and the restored ledger verifies untampered.");
}

main();
