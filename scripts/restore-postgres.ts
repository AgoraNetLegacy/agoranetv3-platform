// The real restore — the operator's worst-day command (docs/RUNBOOK.md
// walks the whole day; this script is one step of it). Destructive by
// nature, so it demands explicit consent via ALLOW_DATABASE_RESTORE=YES
// and never touches DATABASE_URL implicitly: the target is always named.
import { existsSync } from "fs";
import { basename, resolve } from "path";
import { spawnSync } from "child_process";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const databaseUrl = process.env.RESTORE_DATABASE_URL ?? "";
  const backupFile = resolve(process.env.BACKUP_FILE ?? "");

  if (process.env.ALLOW_DATABASE_RESTORE !== "YES") {
    throw new Error("Set ALLOW_DATABASE_RESTORE=YES to confirm the destructive restore.");
  }
  if (!/^(postgresql|postgres):\/\//.test(databaseUrl)) {
    throw new Error("RESTORE_DATABASE_URL must be a PostgreSQL connection.");
  }
  if (!process.env.BACKUP_FILE || !existsSync(backupFile)) {
    throw new Error("BACKUP_FILE must point to an existing pg_dump custom archive.");
  }
  const pgRestore = process.env.PG_RESTORE_BIN?.trim() || "pg_restore";

  const result = spawnSync(
    pgRestore,
    ["--clean", "--if-exists", "--no-owner", "--no-privileges", "--dbname", databaseUrl, backupFile],
    { stdio: "inherit" }
  );
  if (result.error?.message.includes("ENOENT")) {
    throw new Error(`${pgRestore} is not installed or not on PATH.`);
  }
  if (result.status !== 0) throw new Error("PostgreSQL restore failed.");

  // The restore itself goes on the restored record (ADMIN_OPS §2) —
  // recovery is an operator act souls are entitled to see.
  process.env.DATABASE_URL = databaseUrl;
  const { db } = await import("../lib/db");
  const { recordOpsEvent } = await import("../lib/opsLog");
  await recordOpsEvent(db, "admin.backup.restored", {
    file: basename(backupFile),
  });
  await db.$disconnect();

  console.log(
    "Restore completed and recorded on the admin log. Run db:verify:postgres " +
      "against the restored database before accepting traffic."
  );
}

main();
