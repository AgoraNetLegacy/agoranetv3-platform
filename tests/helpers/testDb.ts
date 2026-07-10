// Spin up a throwaway SQLite database for integration tests. Each caller
// gets a fresh file; DATABASE_URL is pointed at it before PrismaClient is
// constructed.

import { execSync } from "child_process";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

export const REPO_ROOT = resolve(__dirname, "..", "..");

export function createTestDb(name: string): { url: string; file: string } {
  const dir = mkdtempSync(join(tmpdir(), `agoranet-${name}-`));
  const file = join(dir, "test.db");
  const url = `file:${file}`;
  execSync("npx prisma db push --skip-generate", {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
  return { url, file };
}
