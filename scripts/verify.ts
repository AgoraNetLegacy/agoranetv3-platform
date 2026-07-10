// db:verify — the invariant check. Run after any work session; CI runs it
// on every push. v2's proven pattern, reimplemented on the v3 schema
// (declared reuse, DUAL_IDENTITY_MODULE.md §1.2 invariant 3 / §9).
//
// Phase 0 checks — the list grows with each phase, never shrinks:
// 1. Civic Ledger hash chain verifies from GENESIS.
// 2. Canon integrity: 7 pillars, 49 questions, full lens coverage,
//    positions 1–49 complete.
// 3. Identity-leak guard: no Human id, no Profile db id anywhere in the
//    ledger — pseudonyms only.
// 4. Gate integrity: every cleared request is on the ledger (nothing
//    clears off-ledger), one clearance per (scope, nullifier), and
//    duplicate rejections stay private (no public event).

import { PrismaClient } from "@prisma/client";
import { verifyChain, findForbiddenId } from "../lib/ledger";
import { PILLARS, LENSES } from "../lib/canon";

const db = new PrismaClient();

async function main() {
  let failures = 0;

  // --- 1. Ledger chain integrity
  const events = await db.ledgerEvent.findMany({ orderBy: { seq: "asc" } });
  const chain = verifyChain(events);
  if (chain.valid) {
    console.log(`✓ Ledger chain valid (${chain.checked} events, GENESIS → head)`);
  } else {
    failures++;
    console.error(`✗ LEDGER CHAIN BROKEN: ${chain.reason}`);
  }

  // --- 2. Canon integrity
  const pillarCount = await db.pillar.count();
  const questionCount = await db.question.count();
  if (pillarCount === 7) console.log("✓ 7 pillars present");
  else { failures++; console.error(`✗ Expected 7 pillars, found ${pillarCount}`); }
  if (questionCount === 49) console.log("✓ 49 questions present");
  else { failures++; console.error(`✗ Expected 49 questions, found ${questionCount}`); }

  let lensProblems = 0;
  for (const canon of PILLARS) {
    const pillar = await db.pillar.findUnique({
      where: { slug: canon.slug },
      include: { questions: true },
    });
    if (!pillar) { failures++; lensProblems++; console.error(`✗ Missing pillar ${canon.slug}`); continue; }
    const lenses = new Set(pillar.questions.map((q) => q.lens));
    if (pillar.questions.length !== 7 || LENSES.some((l) => !lenses.has(l))) {
      failures++;
      lensProblems++;
      console.error(`✗ ${canon.slug}: lens coverage incomplete`);
    }
  }
  if (lensProblems === 0) console.log("✓ Every pillar has all 7 lenses");

  const positions = await db.question.findMany({ select: { position: true } });
  const posSet = new Set(positions.map((p) => p.position));
  const posValues = Array.from(posSet);
  const complete =
    posSet.size === 49 && Math.min(...posValues) === 1 && Math.max(...posValues) === 49;
  if (complete) console.log("✓ Question positions 1–49 complete");
  else { failures++; console.error("✗ Question positions broken"); }

  // --- 3. Identity-leak guard: the public ledger must contain no Human ids
  //        and no raw Profile ids — only pseudonyms. (Dual-identity safety.)
  const humans = await db.human.findMany({ select: { id: true } });
  const profiles = await db.profile.findMany({ select: { id: true } });
  const forbidden = new Set<string>([
    ...humans.map((h) => h.id),
    ...profiles.map((p) => p.id),
  ]);
  let leak: { seq: number; id: string } | null = null;
  for (const ev of events) {
    const hit = findForbiddenId(ev, forbidden);
    if (hit) { leak = { seq: ev.seq, id: hit }; break; }
  }
  if (leak) {
    failures++;
    console.error(`✗ LEDGER IDENTITY LEAK: forbidden id ${leak.id} found at seq ${leak.seq}`);
  } else {
    console.log("✓ Ledger contains no Human/Profile db ids (pseudonyms only)");
  }

  // --- 4a. Nothing clears off-ledger: every CLEARED gate request has a
  //         nullifier, a NullifierSpend row, and a gate.cleared event.
  const clearedEvents = events.filter((ev) => ev.eventType === "gate.cleared");
  const eventKeys = new Set<string>();
  for (const ev of clearedEvents) {
    try {
      const p = JSON.parse(ev.payload);
      if (typeof p?.scope === "string" && typeof p?.nullifier === "string") {
        eventKeys.add(`${p.scope}|${p.nullifier}`);
      }
    } catch {
      /* chain verification already covers payload bytes */
    }
  }
  const clearedRequests = await db.gateRequest.findMany({
    where: { status: "CLEARED" },
    select: { id: true, scope: true, nullifier: true },
  });
  const spends = await db.nullifierSpend.findMany();
  const spendKeys = new Set(spends.map((s) => `${s.scope}|${s.nullifier}`));
  let gateProblems = 0;
  for (const req of clearedRequests) {
    if (!req.nullifier) {
      gateProblems++;
      console.error(`✗ OFF-LEDGER CLEARANCE: request ${req.id} cleared without a nullifier`);
      continue;
    }
    const key = `${req.scope}|${req.nullifier}`;
    if (!spendKeys.has(key)) {
      gateProblems++;
      console.error(`✗ OFF-LEDGER CLEARANCE: request ${req.id} has no NullifierSpend`);
    }
    if (!eventKeys.has(key)) {
      gateProblems++;
      console.error(`✗ OFF-LEDGER CLEARANCE: request ${req.id} has no gate.cleared ledger event`);
    }
  }

  // --- 4b. One clearance per (scope, nullifier) — among requests AND events.
  const seenReq = new Set<string>();
  for (const req of clearedRequests) {
    const key = `${req.scope}|${req.nullifier}`;
    if (seenReq.has(key)) {
      gateProblems++;
      console.error(`✗ DOUBLE CLEARANCE: (scope, nullifier) cleared twice — ${req.scope}`);
    }
    seenReq.add(key);
  }
  if (clearedEvents.length !== eventKeys.size) {
    gateProblems++;
    console.error("✗ DOUBLE CLEARANCE: duplicate or malformed gate.cleared events on the ledger");
  }

  // --- 4c. Duplicate rejections are private: no public event may exist
  //         for them (enforcement must never become an observation channel).
  const duplicateEvents = events.filter((ev) => ev.eventType.startsWith("gate.") && ev.eventType !== "gate.cleared");
  if (duplicateEvents.length > 0) {
    gateProblems++;
    console.error(`✗ PRIVACY BREACH: ${duplicateEvents.length} non-cleared gate event(s) on the public ledger`);
  }

  if (gateProblems === 0) {
    console.log(`✓ Gate integrity (${clearedRequests.length} clearance(s), all on-ledger, none doubled, rejections private)`);
  } else {
    failures += gateProblems;
  }

  if (failures > 0) {
    console.error(`\nVERIFICATION FAILED: ${failures} problem(s).`);
    process.exit(1);
  }
  console.log("\nALL CHECKS PASSED.");
}

main().finally(() => db.$disconnect());
