// db:validate:postgres — the parity check that keeps the dual-provider
// promise honest (DATABASE_SETUP.md, v2 reuse). The two schema files'
// model definitions must be BYTE-IDENTICAL from the first model onward;
// only the preamble (datasource + header comments) may differ. Runs in
// `npm run check`, so drift is caught by discipline, not memory.

import { readFileSync } from "fs";
import { spawnSync } from "child_process";
import { resolve } from "path";

const sqliteSchema = resolve("prisma/schema.prisma");
const postgresSchema = resolve("prisma/postgresql/schema.prisma");

function modelSection(path: string): string {
  const schema = readFileSync(path, "utf8");
  const match = schema.match(/^model /m);
  if (match?.index === undefined) {
    throw new Error(`Could not find model definitions in ${path}.`);
  }
  return schema.slice(match.index).trim();
}

const sqliteModels = modelSection(sqliteSchema);
const postgresModels = modelSection(postgresSchema);

if (sqliteModels !== postgresModels) {
  const sqliteLines = sqliteModels.split("\n");
  const postgresLines = postgresModels.split("\n");
  let firstDiff = 0;
  while (
    firstDiff < Math.min(sqliteLines.length, postgresLines.length) &&
    sqliteLines[firstDiff] === postgresLines[firstDiff]
  ) {
    firstDiff++;
  }
  throw new Error(
    "SQLite and PostgreSQL model definitions have drifted. Keep both " +
      "provider schemas byte-identical from the first model onward.\n" +
      `First divergence at model-section line ${firstDiff + 1}:\n` +
      `  sqlite:   ${sqliteLines[firstDiff] ?? "<end of file>"}\n` +
      `  postgres: ${postgresLines[firstDiff] ?? "<end of file>"}`
  );
}

// `prisma validate` needs a syntactically valid URL, not a live server.
const result = spawnSync(
  "./node_modules/.bin/prisma",
  ["validate", "--schema", "prisma/postgresql/schema.prisma"],
  {
    cwd: resolve("."),
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.POSTGRES_VALIDATE_URL ??
        "postgresql://agoranet:agoranet@localhost:5432/agoranet",
    },
    stdio: "inherit",
  }
);

if (result.status !== 0) {
  throw new Error("PostgreSQL Prisma schema validation failed.");
}

console.log("PostgreSQL schema is valid and model-identical with SQLite.");
