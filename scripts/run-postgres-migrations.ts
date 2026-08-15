// Deploy Postgres migrations over the non-pooled connection when one is
// configured (DATABASE_SETUP.md). `prisma migrate deploy` never drifts a
// schema; it only applies the checked-in migration history.
import { spawnSync } from "child_process";
import { resolve } from "path";
import { loadEnvConfig } from "@next/env";
import { selectPostgresConnectionUrl } from "../lib/postgresConnection";

loadEnvConfig(process.cwd());

const migrationUrl = selectPostgresConnectionUrl();

if (!/^(postgresql|postgres):\/\//.test(migrationUrl)) {
  throw new Error(
    "Set DIRECT_DATABASE_URL (preferred) or DATABASE_URL to a PostgreSQL connection."
  );
}

const result = spawnSync(
  "./node_modules/.bin/prisma",
  ["migrate", "deploy", "--schema", "prisma/postgresql/schema.prisma"],
  {
    cwd: resolve("."),
    env: { ...process.env, DATABASE_URL: migrationUrl },
    stdio: "inherit",
  }
);

if (result.status !== 0) {
  throw new Error("PostgreSQL migration deployment failed.");
}
