// The invariant check must pass on an honest database and FAIL LOUDLY on a
// tampered one — this is the Phase 0 checkpoint guarantee, kept under test
// forever. Runs seed.ts and verify.ts as real subprocesses against a
// throwaway SQLite file.

import { describe, it, expect, beforeAll } from "vitest";
import { execSync, spawnSync } from "child_process";
import { createTestDb, REPO_ROOT } from "./helpers/testDb";

const { url } = createTestDb("verify");
const env = {
  ...process.env,
  DATABASE_URL: url,
  GATE_OPERATOR_SECRET: "test-secret-for-verify-tests-only",
};

function run(cmd: string) {
  return spawnSync("npx", ["tsx", cmd], {
    cwd: REPO_ROOT,
    env,
    encoding: "utf8",
  });
}

function sql(statement: string) {
  execSync(`npx prisma db execute --url "${url}" --stdin`, {
    cwd: REPO_ROOT,
    env,
    input: statement,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

beforeAll(() => {
  const seeded = run("prisma/seed.ts");
  if (seeded.status !== 0) throw new Error(`seed failed: ${seeded.stderr}`);
});

// These tests run seed/verify as REAL subprocesses (several seconds
// each on CI runners, and the verify suite grows every phase) — the
// default 5s vitest timeout is far too tight for them.
const SUBPROCESS_TIMEOUT = 120_000;

describe("db:verify", () => {
  it("passes on an honestly seeded database", () => {
    const result = run("scripts/verify.ts");
    expect(result.stdout).toContain("ALL CHECKS PASSED");
    expect(result.status).toBe(0);
  }, SUBPROCESS_TIMEOUT);

  it("fails loudly when a ledger payload is tampered with", () => {
    sql(`UPDATE LedgerEvent SET payload = '{"tampered":true}' WHERE seq = 3;`);
    const result = run("scripts/verify.ts");
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain("LEDGER CHAIN BROKEN");
    // Restore the honest row is impossible — the chain does not forgive.
    // Rebuild the db for the next test instead.
  }, SUBPROCESS_TIMEOUT);

  it("fails loudly when an internal id leaks onto the ledger", () => {
    // Fresh database (the previous test broke the chain on purpose).
    execSync("npx prisma db push --skip-generate --force-reset", {
      cwd: REPO_ROOT,
      env,
      stdio: "pipe",
    });
    const seeded = run("prisma/seed.ts");
    expect(seeded.status).toBe(0);

    // A soul exists…
    sql(
      `INSERT INTO Human (id, credentialHash, verifiedAt, createdAt) VALUES ('humansecret123', 'nothashedforreal', ${Date.now()}, ${Date.now()});`
    );
    // …and someone writes their INTERNAL id into a properly-chained event.
    // The chain math is satisfied; only the identity-leak guard can catch it.
    const leak = run("scripts/leak-for-test.ts");
    expect(leak.status).toBe(0);

    const result = run("scripts/verify.ts");
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain("LEDGER IDENTITY LEAK");
  }, SUBPROCESS_TIMEOUT);
});
