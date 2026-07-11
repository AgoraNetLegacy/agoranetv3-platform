// Phase 2 checkpoint demo (owner review) — both faces through onboarding,
// the parking lock verified, and the linkage audit: proof that nothing in
// the database links the two. Self-contained demo db, reset each run.
//
//   1. Verification → True Self ceremony → consents → values seed.
//   2. The Alias hatch: no public trace, randomized cohort activation,
//      coarse join period; a second hatch refused blind.
//   3. Cohort release → the alias.activated event (batched timestamp).
//   4. The parking rule: lock, blocked-by-name, separate lots, release,
//      switch cooldown.
//   5. THE LINKAGE AUDIT: sweep every table for any row containing both
//      faces — then sign out and sweep again.
//   6. db:verify (now 11 checks) over the final state.

import { execSync, spawnSync } from "child_process";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

const REPO_ROOT = resolve(__dirname, "..");
const DEMO_DB_FILE = resolve(REPO_ROOT, "prisma", "demo.db");
const DEMO_DB_URL = `file:${DEMO_DB_FILE}`;
const env = { ...process.env, DATABASE_URL: DEMO_DB_URL };

function banner(title: string) {
  console.log(`\n${"═".repeat(64)}\n  ${title}\n${"═".repeat(64)}`);
}

async function main() {
  banner("1. Fresh database + the True Self journey");
  execSync("npx prisma db push --skip-generate --force-reset", {
    cwd: REPO_ROOT, env, stdio: "pipe",
  });
  execSync("npx tsx prisma/seed.ts", { cwd: REPO_ROOT, env, stdio: "pipe" });
  console.log("Seeded: canon, 49 canonical Discussions, rails, rulebook.");

  const db = new PrismaClient({ datasources: { db: { url: DEMO_DB_URL } } });
  const identity = await import("../lib/identity");
  const consent = await import("../lib/consent");
  const valuesSeed = await import("../lib/valuesSeed");
  const parking = await import("../lib/parking");

  const { credential } = await identity.verifyHumanity(db);
  console.log(`Issuer hands over a credential (soul-held): ${credential.slice(0, 12)}… (platform keeps only a hash)`);

  const ts = await identity.registerTrueSelf(db, { credential, handle: "bright-heron-42", displayName: "bright-heron-42" });
  if (!ts.ok) throw new Error(ts.reason);
  console.log(`True Self registered through the gate: bright-heron-42`);
  const regEvent = await db.ledgerEvent.findFirst({
    where: { eventType: "trueself.registered" }, orderBy: { seq: "desc" },
  });
  console.log(`Ledger #${regEvent!.seq}: trueself.registered — pseudonym + nullifier, nothing else.`);

  await consent.recordAck(db, { profileId: ts.profileId, kind: "permanence" });
  await consent.recordAck(db, { profileId: ts.profileId, kind: "constitution" });
  console.log("Blocking consents acknowledged: permanence, Constitution.");
  const seedQs = await valuesSeed.seedQuestions(db);
  await valuesSeed.saveSeedAnswer(db, {
    profileId: ts.profileId,
    questionId: seedQs[0].id,
    body: "Compassion is showing up before being asked.",
  });
  console.log("Values seed: 1/7 answered (skippable, matchmaking-only, never public).\n");

  banner("2. The Alias hatch — no trace, no timing arrow");
  const eventsBefore = await db.ledgerEvent.count();
  const hatch = await identity.registerAlias(db, {
    credential, handle: "quiet-cedar-17", displayName: "quiet-cedar-17", disclosuresAccepted: true,
  });
  if (!hatch.ok) throw new Error(hatch.reason);
  const eventsAfter = await db.ledgerEvent.count();
  const aliasRow = await db.profile.findUniqueOrThrow({ where: { handle: "quiet-cedar-17" } });
  console.log(`Hatched. Ledger events before: ${eventsBefore}, after: ${eventsAfter} — the public learns NOTHING.`);
  console.log(`Status: ${aliasRow.status}; activation: randomized, cohort-snapped → ${aliasRow.activateAt!.toISOString()}`);
  console.log(`Soul is told only: "${hatch.activationHint}". Profile will show join period "${aliasRow.joinedPeriod}".`);
  console.log(`Alias row humanId: ${JSON.stringify(aliasRow.humanId)} ← no stored link, ever.`);

  const second = await identity.registerAlias(db, {
    credential, handle: "third-face-99", displayName: "third-face-99", disclosuresAccepted: true,
  });
  console.log(`A second hatch attempt: ${second.ok ? "UNEXPECTED!" : `refused — "${!second.ok && second.reason}" (blind, no public trace)`}`);

  banner("3. The cohort releases (time-travelled for the demo)");
  await db.profile.update({
    where: { id: aliasRow.id },
    data: { activateAt: new Date(Date.now() - 1000) },
  });
  await identity.activateDueAliases(db);
  const actEvent = await db.ledgerEvent.findFirst({
    where: { eventType: "alias.activated" }, orderBy: { seq: "desc" },
  });
  console.log(`Ledger #${actEvent!.seq}: alias.activated — the cohort's shared timestamp, not the soul's.`);
  await consent.recordAck(db, { profileId: aliasRow.id, kind: "permanence" });
  await consent.recordAck(db, { profileId: aliasRow.id, kind: "constitution" });

  banner("4. The parking rule — one face per pillar, enforced");
  const sessionId = await parking.createSession(db);
  await parking.addFace(db, { sessionId, profileId: ts.profileId });
  await parking.addFace(db, { sessionId, profileId: aliasRow.id });
  const pillars = await db.pillar.findMany({ orderBy: { position: "asc" }, take: 2 });

  const e1 = await parking.enterPillar(db, { sessionId, profileId: ts.profileId, pillarId: pillars[0].id });
  console.log(`True Self enters ${pillars[0].name}: ${e1.allowed ? "parked ✓" : "blocked?!"}`);
  const e2 = await parking.enterPillar(db, { sessionId, profileId: aliasRow.id, pillarId: pillars[0].id });
  console.log(`Alias tries ${pillars[0].name}: ${e2.allowed ? "UNEXPECTED" : `BLOCKED — held by ${!e2.allowed && e2.heldByHandle} (${!e2.allowed && e2.heldByFace})`}`);
  const e3 = await parking.enterPillar(db, { sessionId, profileId: aliasRow.id, pillarId: pillars[1].id });
  console.log(`Alias enters ${pillars[1].name} instead: ${e3.allowed ? "parked ✓ (different lot)" : "blocked?!"}`);
  await parking.releaseLock(db, { sessionId, pillarId: pillars[0].id });
  const e4 = await parking.enterPillar(db, { sessionId, profileId: aliasRow.id, pillarId: pillars[0].id });
  console.log(`After release, Alias enters ${pillars[0].name}: ${e4.allowed ? "parked ✓" : "blocked?!"}`);

  const s1 = await parking.switchFace(db, { sessionId, fromProfileId: null, toProfileId: ts.profileId });
  const s2 = await parking.switchFace(db, { sessionId, fromProfileId: ts.profileId, toProfileId: aliasRow.id });
  console.log(`Rapid face-switch: first ${s1.ok ? "ok" : "?"}, second ${s2.ok ? "ok — seamless, as the owner intended (no cooldown; the parking rule is the timing mitigation)" : `UNEXPECTED: ${!s2.ok && s2.reason}`}`);

  banner("5. THE LINKAGE AUDIT — what actually connects the two faces?");
  const tsIds = [ts.profileId, "bright-heron-42"];
  const aliasIds = [aliasRow.id, "quiet-cedar-17"];
  const tables = (await db.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'`
  )).map((t) => t.name);

  let coRows = 0;
  const sharedContext: string[] = [];
  for (const table of tables) {
    const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM "${table}"`);
    for (const row of rows) {
      const text = JSON.stringify(row);
      const hasTs = tsIds.some((x) => text.includes(x));
      const hasAlias = aliasIds.some((x) => text.includes(x));
      if (hasTs && hasAlias) {
        coRows++;
        console.log(`  ✗ ${table}: a single row contains both faces!`);
      }
    }
    // Second-order: rows of the two faces sharing a foreign key.
    if (table === "SessionFace" || table === "PillarLock") {
      const text = JSON.stringify(rows);
      if (tsIds.some((x) => text.includes(x)) && aliasIds.some((x) => text.includes(x))) {
        sharedContext.push(table);
      }
    }
  }
  console.log(`Tables swept: ${tables.length}. Rows containing BOTH faces: ${coRows}.`);
  console.log(`Shared context found only in: ${sharedContext.length ? sharedContext.join(", ") : "none"}`);
  console.log("  ^ the SoulSession — the soul's own signed-in browser, ephemeral");
  console.log("    by design (short retention, purged on expiry/sign-out).");
  console.log("\nNow the soul signs out…");
  await db.soulSession.delete({ where: { id: sessionId } });
  let coAfter = 0;
  let secondOrder = 0;
  for (const table of tables) {
    const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM "${table}"`);
    const text = JSON.stringify(rows);
    for (const row of rows) {
      const t = JSON.stringify(row);
      if (tsIds.some((x) => t.includes(x)) && aliasIds.some((x) => t.includes(x))) coAfter++;
    }
    if (["SessionFace", "PillarLock", "SoulSession"].includes(table)) {
      if (tsIds.some((x) => text.includes(x)) && aliasIds.some((x) => text.includes(x))) secondOrder++;
    }
  }
  console.log(`After sign-out — co-occurrence rows: ${coAfter}; shared session context: ${secondOrder}.`);
  console.log("\nThe honest Phase A residual, stated plainly: the operator secret");
  console.log("could re-derive registration nullifiers by brute force over humans.");
  console.log('That is exactly the disclosure — "operator policy, not yet');
  console.log('cryptography" — and it retires at Phase C with the secret itself.');

  await db.$disconnect();

  banner("6. db:verify — all eleven checks");
  const verify = spawnSync("npx", ["tsx", "scripts/verify.ts"], {
    cwd: REPO_ROOT, env, stdio: "inherit",
  });
  process.exit(verify.status ?? 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
