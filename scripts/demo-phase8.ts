// Phase 8 checkpoint demo — deployment hardening, walked end to end:
// the walls hold at machine speed (and are rails), the counters and
// ops log keep the minimal-log discipline, the analytics funnel counts
// without watching, the crush deletes on schedule, the runtime guard
// refuses an unsafe boot, and the dual-provider parity promise checks
// itself. (The Postgres backup → restore-drill loop is separate live
// evidence — it ran against a real Postgres 17 with all checks green
// and a corrupted archive failing loudly; see CHECKPOINTS.md.)

import { execSync, spawnSync } from "child_process";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

const REPO_ROOT = resolve(__dirname, "..");
const DEMO_DB_URL = `file:${resolve(REPO_ROOT, "prisma", "demo.db")}`;
const env = { ...process.env, DATABASE_URL: DEMO_DB_URL };

function banner(title: string) {
  console.log(`\n${"═".repeat(64)}\n  ${title}\n${"═".repeat(64)}`);
}

function verify(): boolean {
  const result = spawnSync("npx", ["tsx", "scripts/verify.ts"], {
    cwd: REPO_ROOT, env, stdio: "inherit",
  });
  return result.status === 0;
}

async function main() {
  banner("0. Fresh database, seeded — the rails include the W4 schedule");
  execSync("npx prisma db push --skip-generate --force-reset", { cwd: REPO_ROOT, env, stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { cwd: REPO_ROOT, env, stdio: "pipe" });

  const db = new PrismaClient({ datasources: { db: { url: DEMO_DB_URL } } });
  const { checkRateLimit, enforceRateLimit, pruneRateLimitBuckets } = await import("../lib/rateLimit");
  const { recordEvent, analyticsSubjectKey } = await import("../lib/analytics");
  const { recordOpsEvent } = await import("../lib/opsLog");
  const { validateRuntimeConfig } = await import("../lib/runtimeConfig");
  const { getRail } = await import("../lib/rails");

  banner("1. The pace wall — machine speed refused, humans untouched");
  const limit = await getRail(db, "ratelimit.register");
  console.log(`ratelimit.register rail: ${limit} ceremonies/hour (a rail — poll-adjustable within bounds)`);
  const now = new Date();
  for (let i = 1; i <= limit; i++) {
    const r = await checkRateLimit(db, "register", "demo-arrival", now);
    console.log(`  attempt ${i}: allowed (${r.remaining} remaining)`);
  }
  try {
    await enforceRateLimit(db, "register", "demo-arrival", now);
    throw new Error("THE WALL DID NOT HOLD");
  } catch (error) {
    console.log(`  attempt ${limit + 1}: ${(error as Error).message}`);
  }

  banner("2. Counter hygiene — the buckets know nobody");
  const buckets = await db.rateLimitBucket.findMany();
  console.log(`  ${buckets.length} bucket(s); every key: ${buckets.every((b) => /^[0-9a-f]{64}$/.test(b.key)) ? "HMAC-shaped ✓" : "LEAKY ✗"}`);
  console.log(`  the identifier 'demo-arrival' appears in a key: ${buckets.some((b) => b.key.includes("demo-arrival")) ? "YES ✗" : "no ✓"}`);

  banner("3. The funnel counts without watching");
  await recordEvent(db, "funnel.arrival");
  await recordEvent(db, "funnel.gate");
  await recordEvent(db, "funnel.trueself", "demo-profile-id");
  await recordEvent(db, "action.any", "demo-profile-id");
  const keyed = await db.analyticsEvent.findFirst({ where: { name: "funnel.trueself" } });
  console.log(`  funnel.trueself subjectKey: ${keyed?.subjectKey?.slice(0, 16)}… (HMAC — the raw id never lands)`);
  console.log(`  same soul's rate-limit key and analytics key differ: ${
    analyticsSubjectKey("demo-profile-id") !== buckets[0]?.key ? "✓ (separate derivations, unjoinable)" : "✗"}`);

  banner("4. The 90-day crush — aggregates survive, raw events die");
  const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
  await db.analyticsEvent.createMany({
    data: [
      { name: "funnel.arrival", createdAt: old },
      { name: "funnel.arrival", createdAt: old },
      { name: "funnel.trueself", subjectKey: analyticsSubjectKey("elder-soul"), createdAt: old },
    ],
  });
  const crush = spawnSync("npx", ["tsx", "scripts/crush-analytics.ts"], {
    cwd: REPO_ROOT, env, encoding: "utf8",
  });
  process.stdout.write(crush.stdout);
  const aggregates = await db.analyticsAggregate.count();
  const remaining = await db.analyticsEvent.count({ where: { createdAt: { lt: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000) } } });
  console.log(`  permanent aggregates: ${aggregates}; raw events older than the rail remaining: ${remaining} (must be 0)`);
  if (remaining !== 0) throw new Error("THE CRUSH DID NOT DELETE");

  banner("5. The ops log — attributable, allowlisted, public");
  await recordOpsEvent(db, "admin.backup.drill", { file: "demo.dump", ok: true });
  const ops = await db.ledgerEvent.findFirst({ where: { eventType: "admin.backup.drill" } });
  console.log(`  ${ops?.eventType}: ${ops?.payload}`);
  console.log("  (renders publicly on /transparency — souls can see that drills pass)");

  banner("6. The runtime guard — an unsafe boot is refused, loudly");
  const errors = validateRuntimeConfig({
    NODE_ENV: "production",
    DATABASE_URL: "file:./dev.db",
    GATE_OPERATOR_SECRET: "short",
  } as NodeJS.ProcessEnv);
  for (const e of errors) console.log(`  ✗ ${e}`);
  if (!errors.length) throw new Error("THE GUARD DID NOT REFUSE");

  banner("7. Dual-provider parity — the two schemas cannot drift");
  const parity = spawnSync("npx", ["tsx", "scripts/check-postgres-schema.ts"], {
    cwd: REPO_ROOT, env: process.env as NodeJS.ProcessEnv, encoding: "utf8",
  });
  process.stdout.write(parity.stdout + (parity.stderr ?? ""));
  if (parity.status !== 0) throw new Error("PARITY BROKEN");

  banner("8. Housekeeping — expired counters pruned");
  const ancient = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  await checkRateLimit(db, "posting", "old-soul", ancient);
  const pruned = await pruneRateLimitBuckets(db);
  console.log(`  pruned ${pruned} expired bucket(s) — short retention is the point`);

  await db.$disconnect();

  banner("9. The full invariant suite on the exercised database");
  if (!verify()) {
    console.error("\nDEMO FAILED: verification did not pass.");
    process.exit(1);
  }

  console.log(
    "\nPhase 8 build-half demo complete. The other half of the checkpoint" +
      "\nis inherently the owner's: a small real cohort onboarding unaided" +
      "\non staging, and the funnel + logs reviewed together."
  );
}

main();
