// Phase 0 checkpoint demo, part two: the invariant check FAILING LOUDLY.
// Copies the demo database (run `npm run demo:phase0` first) to a scratch
// file and attacks it twice:
//
//   Attack 1; rewrite history: change one ledger payload in place.
//   Attack 2; identity leak: append a *correctly chained* event that
//              names an internal Human id (the leak-for-test fixture).
//
// Both times, db:verify must exit 1 and say exactly what broke.

import { execSync, spawnSync } from "child_process";
import { copyFileSync, existsSync } from "fs";
import { resolve } from "path";

const REPO_ROOT = resolve(__dirname, "..");
const DEMO_DB = resolve(REPO_ROOT, "prisma", "demo.db");
const SCRATCH_DB = resolve(REPO_ROOT, "prisma", "tamper-scratch.db");
const url = `file:${SCRATCH_DB}`;
const env = { ...process.env, DATABASE_URL: url };

function banner(title: string) {
  console.log(`\n${"═".repeat(64)}\n  ${title}\n${"═".repeat(64)}`);
}

function freshCopy() {
  copyFileSync(DEMO_DB, SCRATCH_DB);
}

function verify(): number {
  const result = spawnSync("npx", ["tsx", "scripts/verify.ts"], {
    cwd: REPO_ROOT, env, stdio: "inherit",
  });
  return result.status ?? -1;
}

function main() {
  if (!existsSync(DEMO_DB)) {
    console.error("Run `npm run demo:phase0` first; it builds the demo database.");
    process.exit(1);
  }

  banner("Attack 1: rewrite history (change one ledger payload in place)");
  freshCopy();
  execSync(`npx prisma db execute --url "${url}" --stdin`, {
    cwd: REPO_ROOT, env,
    input: `UPDATE LedgerEvent SET payload = '{"note":"history, edited"}' WHERE seq = 5;`,
    stdio: ["pipe", "inherit", "inherit"],
  });
  console.log("Tampered: seq 5 payload rewritten. Running db:verify…\n");
  const attack1 = verify();

  banner("Attack 2: identity leak (correctly chained, names an internal id)");
  freshCopy();
  execSync("npx tsx scripts/leak-for-test.ts", { cwd: REPO_ROOT, env, stdio: "inherit" });
  console.log("Leaked: a chained event now contains a Human id. Running db:verify…\n");
  const attack2 = verify();

  banner("Verdict");
  const caught1 = attack1 === 1;
  const caught2 = attack2 === 1;
  console.log(`Attack 1 (tampered history): ${caught1 ? "CAUGHT; verify failed loudly ✓" : "NOT CAUGHT ✗"}`);
  console.log(`Attack 2 (identity leak):    ${caught2 ? "CAUGHT; verify failed loudly ✓" : "NOT CAUGHT ✗"}`);
  process.exit(caught1 && caught2 ? 0 : 1);
}

main();
