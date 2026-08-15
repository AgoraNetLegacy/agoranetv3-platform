// Delete expired rate-limit buckets (older than two day-cycles). Run
// from the ops cron alongside the nightly backup; short retention is
// the minimal-log discipline applied to our own counters.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { db } = await import("../lib/db");
  const { pruneRateLimitBuckets } = await import("../lib/rateLimit");
  const removed = await pruneRateLimitBuckets(db);
  console.log(`Pruned ${removed} expired rate-limit bucket(s).`);
  await db.$disconnect();
}

main();
