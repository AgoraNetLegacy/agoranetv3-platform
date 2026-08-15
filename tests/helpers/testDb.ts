// Spin up a throwaway SQLite database for integration tests. Each caller
// gets a fresh file; DATABASE_URL is pointed at it before PrismaClient is
// constructed.

import { execSync } from "child_process";
import { createHash } from "crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

export const REPO_ROOT = resolve(__dirname, "..", "..");

function sleepSync(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Vitest imports every test file before it runs them, so calling
 * `prisma db push` inside createTestDb means a burst of schema-engine
 * processes at the same instant. Prisma's schema engine is not graceful
 * under that burst on this machine.
 *
 * The fix: build ONE schema-pushed template database per schema hash, then
 * give each test file a cheap copy of it. The schema engine runs once;
 * every test still gets a fresh isolated SQLite file.
 */
function templateDbPath(): string {
  const schema = readFileSync(join(REPO_ROOT, "prisma/schema.prisma"));
  const hash = createHash("sha256").update(schema).digest("hex").slice(0, 16);
  return join(tmpdir(), `agoranet-test-template-${hash}.db`);
}

function ensureTemplateDb(template: string) {
  if (existsSync(template)) return;

  const lock = `${template}.lock`;
  // A process SIGKILLed mid-build never runs its cleanup, orphaning the lock
  // dir. Without recovery the whole suite waits on it forever. Reclaim a lock
  // older than STALE_MS (a real db push is seconds), and hard-cap the total
  // wait so a wedged run fails loudly instead of hanging.
  const STALE_MS = 60_000;
  const GIVE_UP_MS = 120_000;
  const start = Date.now();
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch {
      // Another test file is building the template right now.
      if (existsSync(template)) return;
      try {
        if (Date.now() - statSync(lock).mtimeMs > STALE_MS) {
          rmSync(lock, { recursive: true, force: true }); // orphaned; reclaim
          continue;
        }
      } catch {
        // Lock vanished between the checks; just retry the mkdir.
      }
      if (Date.now() - start > GIVE_UP_MS) {
        throw new Error(
          `Timed out waiting for the test-template lock at ${lock}. ` +
            `Remove it and retry if no build is running.`
        );
      }
      sleepSync(25);
    }
  }

  try {
    if (!existsSync(template)) {
      execSync("./node_modules/.bin/prisma db push --skip-generate", {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          DATABASE_URL: `file:${template}`,
          // Prisma's schema engine intermittently fails on this Mac unless
          // its Rust logger is enabled; info/debug makes db push reliable.
          RUST_LOG: "debug",
        },
        stdio: "inherit",
      });
    }
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

export function createTestDb(name: string): { url: string; file: string } {
  const dir = mkdtempSync(join(tmpdir(), `agoranet-${name}-`));
  const file = join(dir, "test.db");
  const template = templateDbPath();
  ensureTemplateDb(template);
  copyFileSync(template, file);
  return { url: `file:${file}`, file };
}
