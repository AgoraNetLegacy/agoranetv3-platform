// Phase 0 checkpoint demo (owner review) — runs against a self-contained
// demo database (prisma/demo.db), reset on every run:
//
//   1. Seed the canon (7 pillars, 49 questions) — every seeding on the ledger.
//   2. One human, two faces (True Self + Alias), pseudonyms only.
//   3. Gated actions through pending → proof → cleared, per-profile and
//      per-human scopes, duplicates rejected privately.
//   4. Print the ledger, then run db:verify.
//
// Companion: `npm run demo:tamper` shows the invariant check failing loudly.

import { execSync, spawnSync } from "child_process";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

const REPO_ROOT = resolve(__dirname, "..");
export const DEMO_DB_FILE = resolve(REPO_ROOT, "prisma", "demo.db");
const DEMO_DB_URL = `file:${DEMO_DB_FILE}`;
const env = { ...process.env, DATABASE_URL: DEMO_DB_URL };

function banner(title: string) {
  console.log(`\n${"═".repeat(64)}\n  ${title}\n${"═".repeat(64)}`);
}

async function main() {
  banner("1. Fresh database + canon seed");
  execSync("npx prisma db push --skip-generate --force-reset", {
    cwd: REPO_ROOT, env, stdio: "pipe",
  });
  execSync("npx tsx prisma/seed.ts", { cwd: REPO_ROOT, env, stdio: "inherit" });

  const db = new PrismaClient({ datasources: { db: { url: DEMO_DB_URL } } });
  const { clearGate } = await import("../lib/gate");
  const { makeOnboardedSoul } = await import("../tests/helpers/souls");

  banner("2. One human, two faces — pseudonyms only");
  const soul = await makeOnboardedSoul(db, {
    trueSelf: "bright-heron-42",
    alias: "quiet-cedar-17",
  });
  const trueSelf = { id: soul.trueSelfId, handle: "bright-heron-42" };
  const alias = { id: soul.aliasId, handle: "quiet-cedar-17" };
  console.log(`True Self handle: ${trueSelf.handle}`);
  console.log(`Alias handle:     ${alias.handle}`);
  console.log("(Since Phase 2, the Alias row carries no humanId at all — the");
  console.log(" ledger below never names an internal id; db:verify enforces both.)");

  banner("3. Gated actions — pending → proof → cleared");

  const act = async (label: string, profileId: string, scope: string, scopeKind: "per-profile" | "per-human") => {
    const result = await clearGate(db, { profileId, scope, scopeKind });
    console.log(`${label.padEnd(52)} → ${result.outcome}`);
    return result;
  };

  console.log("\n— per-profile scope (the ratified default: each face is a voice)");
  await act("True Self replies in Discussion q43", trueSelf.id, "discussion:q43:reply:face", "per-profile");
  await act("True Self tries the same action again", trueSelf.id, "discussion:q43:reply:face", "per-profile");
  console.log("   ^ DUPLICATE is private: no ledger event, visible only to the soul");
  await act("Alias replies in the same Discussion", alias.id, "discussion:q43:reply:face", "per-profile");
  console.log("   ^ same human, other face: clears independently — two voices");

  console.log("\n— per-human scope (held in reserve; registration uses it by definition)");
  await act("True Self clears a per-human demo scope", trueSelf.id, "demo:once-per-human", "per-human");
  await act("Alias attempts a per-human scope", alias.id, "demo:once-per-human", "per-human");
  console.log("   ^ INVALID: since Phase 2 an Alias carries no humanId, so");
  console.log("     per-human scopes are structurally closed to it — the");
  console.log("     one-per-human registrations happen at the ceremony itself");

  banner("4. The Civic Ledger (hash-chained, append-only)");
  const events = await db.ledgerEvent.findMany({ orderBy: { seq: "asc" } });
  const shown = [...events.slice(0, 3), null, ...events.slice(-4)];
  for (const ev of shown) {
    if (!ev) { console.log("  ⋮  (" + (events.length - 7) + " more seed events)"); continue; }
    const payload = ev.payload.length > 72 ? ev.payload.slice(0, 72) + "…" : ev.payload;
    console.log(`#${String(ev.seq).padStart(3)} ${ev.eventType.padEnd(16)} actor=${ev.actorId ?? "system"}`);
    console.log(`     ${payload}`);
  }
  console.log(`\n${events.length} events, chained GENESIS → ${events[events.length - 1].entryHash.slice(0, 16)}…`);

  await db.$disconnect();

  banner("5. db:verify — the invariant check");
  const verify = spawnSync("npx", ["tsx", "scripts/verify.ts"], {
    cwd: REPO_ROOT, env, stdio: "inherit",
  });
  process.exit(verify.status ?? 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
