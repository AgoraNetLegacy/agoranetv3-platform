// db:verify — the invariant check. Run after any work session; CI runs it
// on every push. v2's proven pattern, reimplemented on the v3 schema
// (declared reuse, DUAL_IDENTITY_MODULE.md §1.2 invariant 3 / §9).
//
// The check list grows with each phase, never shrinks.
// Phase 0:
// 1. Civic Ledger hash chain verifies from GENESIS.
// 2. Canon integrity: 7 pillars, 49 questions, full lens coverage,
//    positions 1–49 complete.
// 3. Identity-leak guard: no Human id, no Profile db id anywhere in the
//    ledger — pseudonyms only.
// 4. Gate integrity: every PSEUDONYMOUS cleared request is on the ledger
//    (nothing clears off-ledger), one clearance per (scope, nullifier),
//    duplicate rejections private, PRIVATE clearances have no event.
// Phase 1:
// 5. Canonical Discussions: 49 permanent spaces, 1:1 with the canon.
// 6. Permanent-record integrity: every permanent-space post has a
//    post.recorded event; every LOCKED post's body re-hashes to its
//    last ledger commitment — a locked record cannot be silently edited.
// 7. Flag privacy: no flag-related event type on the public ledger, and
//    no flag's nullifier appears anywhere in it (triangle of blindness).
// Phase 2:
// 8. Structural unlinkability: no Alias row carries a humanId; at most
//    one True Self per human.
// 9. Registration evidence: nullifier spends match profile counts;
//    active faces have their registration/activation events; PENDING
//    aliases appear NOWHERE in the public ledger.
// 10. Session hygiene: expired sessions/locks purged (short retention —
//     this check sweeps, then asserts).
// 11. Consent-before-posting: every post author holds the two blocking
//     acknowledgments.

import { createHash } from "crypto";
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
    select: { id: true, scope: true, nullifier: true, ledgerRecording: true },
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
    if (req.ledgerRecording === "private") {
      // Private clearances must leave NO public trace.
      if (eventKeys.has(key)) {
        gateProblems++;
        console.error(`✗ PRIVACY BREACH: private clearance ${req.id} has a public ledger event`);
      }
    } else if (!eventKeys.has(key)) {
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
    console.log(`✓ Gate integrity (${clearedRequests.length} clearance(s), recording discipline holds, none doubled, rejections private)`);
  } else {
    failures += gateProblems;
  }

  // --- 5. Canonical Discussions: 49 permanent spaces, 1:1 with the canon.
  const discussions = await db.discussion.findMany({
    where: { questionId: { not: null } },
    select: { id: true, permanence: true, questionId: true },
  });
  const canonicalProblems: string[] = [];
  if (discussions.length !== 49) {
    canonicalProblems.push(`expected 49 canonical Discussions, found ${discussions.length}`);
  }
  for (const d of discussions) {
    if (d.permanence !== "permanent-canonical") {
      canonicalProblems.push(`Discussion ${d.id} is canonical but marked "${d.permanence}"`);
    }
  }
  if (canonicalProblems.length === 0) {
    console.log("✓ 49 canonical Discussions, all permanent");
  } else {
    failures += canonicalProblems.length;
    for (const p of canonicalProblems) console.error(`✗ CANONICAL SPACES: ${p}`);
  }

  // --- 6. Permanent-record integrity: every permanent-space post is on the
  //        ledger, and every LOCKED post's body matches its last recorded
  //        content hash. A locked record cannot be silently edited.
  const permanentPosts = await db.post.findMany({
    where: { discussion: { permanence: { startsWith: "permanent" } } },
    select: { id: true, body: true, editableUntil: true },
  });
  const lastHashByPost = new Map<string, string>();
  for (const ev of events) {
    if (ev.eventType !== "post.recorded" && ev.eventType !== "post.amended") continue;
    try {
      const p = JSON.parse(ev.payload);
      if (typeof p?.postRef === "string" && typeof p?.contentHash === "string") {
        lastHashByPost.set(p.postRef, p.contentHash); // seq order ⇒ last write wins
      }
    } catch {
      /* chain verification covers payload bytes */
    }
  }
  const now = new Date();
  let recordProblems = 0;
  let lockedCount = 0;
  for (const post of permanentPosts) {
    const recorded = lastHashByPost.get(post.id);
    if (!recorded) {
      recordProblems++;
      console.error(`✗ OFF-LEDGER POST: permanent-space post ${post.id} has no post.recorded event`);
      continue;
    }
    if (post.editableUntil <= now) {
      lockedCount++;
      const actual = createHash("sha256").update(post.body).digest("hex");
      if (actual !== recorded) {
        recordProblems++;
        console.error(`✗ LOCKED RECORD ALTERED: post ${post.id} body no longer matches its ledger commitment`);
      }
    }
  }
  if (recordProblems === 0) {
    console.log(`✓ Permanent records intact (${permanentPosts.length} post(s), ${lockedCount} locked, all match the ledger)`);
  } else {
    failures += recordProblems;
  }

  // --- 7. Flag privacy: the public must never learn a flag exists. No
  //        flag event types; no flag nullifier anywhere on the ledger.
  const flags = await db.flag.findMany({ select: { id: true, nullifier: true } });
  let flagProblems = 0;
  const flagEvents = events.filter((ev) => ev.eventType.startsWith("flag"));
  if (flagEvents.length > 0) {
    flagProblems++;
    console.error(`✗ FLAG PRIVACY: ${flagEvents.length} flag event(s) on the public ledger`);
  }
  const flagNullifiers = new Set(flags.map((f) => f.nullifier));
  for (const ev of events) {
    const hit = findForbiddenId(ev, flagNullifiers);
    if (hit) {
      flagProblems++;
      console.error(`✗ FLAG PRIVACY: flag nullifier found on the ledger at seq ${ev.seq}`);
      break;
    }
  }
  if (flagProblems === 0) {
    console.log(`✓ Flag privacy (${flags.length} flag(s) queued, none visible on the ledger)`);
  } else {
    failures += flagProblems;
  }

  // --- 8. Structural unlinkability: no database row links a soul's two
  //        faces. Aliases carry no humanId, period.
  const allProfiles = await db.profile.findMany({
    select: { id: true, face: true, humanId: true, status: true, pseudonym: true },
  });
  let linkProblems = 0;
  for (const p of allProfiles) {
    if (p.face === "ALIAS" && p.humanId !== null) {
      linkProblems++;
      console.error(`✗ LINKAGE: Alias ${p.id} carries a humanId`);
    }
    if (p.face === "TRUE_SELF" && p.humanId === null) {
      linkProblems++;
      console.error(`✗ ORPHAN: True Self ${p.id} has no human root (recovery would be impossible)`);
    }
  }
  const byHuman = new Map<string, number>();
  for (const p of allProfiles) {
    if (p.humanId) byHuman.set(p.humanId, (byHuman.get(p.humanId) ?? 0) + 1);
  }
  for (const [humanId, count] of Array.from(byHuman.entries())) {
    if (count > 1) {
      linkProblems++;
      console.error(`✗ LINKAGE: human ${humanId} has ${count} linked profiles`);
    }
  }
  if (linkProblems === 0) {
    console.log(`✓ Structural unlinkability (${allProfiles.length} profile(s); no row links two faces)`);
  } else {
    failures += linkProblems;
  }

  // --- 9. Registration evidence + pending invisibility.
  const trueSelves = allProfiles.filter((p) => p.face === "TRUE_SELF");
  const aliases = allProfiles.filter((p) => p.face === "ALIAS");
  const tsSpends = await db.nullifierSpend.count({ where: { scope: "true-self-registration" } });
  const aliasSpends = await db.nullifierSpend.count({ where: { scope: "alias-registration" } });
  let regProblems = 0;
  if (tsSpends !== trueSelves.length) {
    regProblems++;
    console.error(`✗ REGISTRATION: ${trueSelves.length} True Selves but ${tsSpends} registration spend(s)`);
  }
  if (aliasSpends !== aliases.length) {
    regProblems++;
    console.error(`✗ REGISTRATION: ${aliases.length} Aliases but ${aliasSpends} registration spend(s)`);
  }
  const registeredPseudonyms = new Set<string>();
  const activatedPseudonyms = new Set<string>();
  for (const ev of events) {
    try {
      const p = JSON.parse(ev.payload);
      if (ev.eventType === "trueself.registered" && typeof p?.pseudonym === "string") {
        registeredPseudonyms.add(p.pseudonym);
      }
      if (ev.eventType === "alias.activated" && typeof p?.pseudonym === "string") {
        activatedPseudonyms.add(p.pseudonym);
      }
    } catch {
      /* covered by chain check */
    }
  }
  for (const p of trueSelves) {
    if (!registeredPseudonyms.has(p.pseudonym)) {
      regProblems++;
      console.error(`✗ OFF-LEDGER REGISTRATION: True Self ${p.pseudonym} has no trueself.registered event`);
    }
  }
  for (const p of aliases) {
    if (p.status === "active" && !activatedPseudonyms.has(p.pseudonym)) {
      regProblems++;
      console.error(`✗ OFF-LEDGER ACTIVATION: active Alias ${p.pseudonym} has no alias.activated event`);
    }
    if (p.status === "pending") {
      // A pending Alias must be invisible: its pseudonym appears nowhere.
      for (const ev of events) {
        if (`${ev.actorId ?? ""} ${ev.payload}`.includes(p.pseudonym)) {
          regProblems++;
          console.error(`✗ PENDING ALIAS VISIBLE: ${p.pseudonym} appears on the ledger at seq ${ev.seq}`);
          break;
        }
      }
    }
  }
  if (regProblems === 0) {
    console.log(`✓ Registration evidence (${trueSelves.length} True Self(s), ${aliases.length} Alias(es); pending faces invisible)`);
  } else {
    failures += regProblems;
  }

  // --- 10. Session hygiene: short retention is a promise — sweep expired
  //         ephemera, then assert none remain.
  await db.soulSession.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  const lingering = await db.soulSession.count({ where: { expiresAt: { lte: new Date() } } });
  if (lingering === 0) {
    const liveSessions = await db.soulSession.count();
    console.log(`✓ Session hygiene (${liveSessions} live session(s); expired records purged)`);
  } else {
    failures += lingering;
    console.error(`✗ SESSION RETENTION: ${lingering} expired session(s) linger`);
  }

  // --- 11. Consent before posting: every author acknowledged permanence
  //         and the Constitution before their words landed.
  const authors = await db.post.findMany({
    select: { authorProfileId: true },
    distinct: ["authorProfileId"],
  });
  let consentProblems = 0;
  for (const a of authors) {
    const acks = await db.consentAck.count({
      where: {
        profileId: a.authorProfileId,
        kind: { in: ["permanence", "constitution"] },
      },
    });
    if (acks !== 2) {
      consentProblems++;
      console.error(`✗ CONSENT: author ${a.authorProfileId} posted without the blocking acknowledgments`);
    }
  }
  if (consentProblems === 0) {
    console.log(`✓ Consent before posting (${authors.length} author(s), all acknowledged)`);
  } else {
    failures += consentProblems;
  }

  if (failures > 0) {
    console.error(`\nVERIFICATION FAILED: ${failures} problem(s).`);
    process.exit(1);
  }
  console.log("\nALL CHECKS PASSED.");
}

main().finally(() => db.$disconnect());
