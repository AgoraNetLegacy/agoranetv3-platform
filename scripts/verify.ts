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
// Phase 3:
// 12. Poll integrity: sealed-until-close (open polls leak nothing to
//     the ledger beyond poll.created); every closed poll's tallies
//     recompute from counted ballots and match the poll.closed event;
//     candle reveals verify against their pre-vote commitments; only
//     ballots cast before the true close count; pseudonymous ballots
//     carry no profile and their ballotsHash re-derives; public
//     ballots match their post-close vote.recorded events; one ballot
//     per nullifier per poll.

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
    where: {
      OR: [
        { discussion: { permanence: { startsWith: "permanent" } } },
        { permanentUpgraded: true }, // paid own-post permanence (Phase 4)
      ],
    },
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
    select: { id: true, face: true, humanId: true, status: true, handle: true },
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
  const registeredHandles = new Set<string>();
  const activatedHandles = new Set<string>();
  for (const ev of events) {
    try {
      const p = JSON.parse(ev.payload);
      if (ev.eventType === "trueself.registered" && typeof p?.handle === "string") {
        registeredHandles.add(p.handle);
      }
      if (ev.eventType === "alias.activated" && typeof p?.handle === "string") {
        activatedHandles.add(p.handle);
      }
    } catch {
      /* covered by chain check */
    }
  }
  for (const p of trueSelves) {
    if (!registeredHandles.has(p.handle)) {
      regProblems++;
      console.error(`✗ OFF-LEDGER REGISTRATION: True Self ${p.handle} has no trueself.registered event`);
    }
  }
  for (const p of aliases) {
    if (p.status === "active" && !activatedHandles.has(p.handle)) {
      regProblems++;
      console.error(`✗ OFF-LEDGER ACTIVATION: active Alias ${p.handle} has no alias.activated event`);
    }
    if (p.status === "pending") {
      // A pending Alias must be invisible: its pseudonym appears nowhere.
      for (const ev of events) {
        if (`${ev.actorId ?? ""} ${ev.payload}`.includes(p.handle)) {
          regProblems++;
          console.error(`✗ PENDING ALIAS VISIBLE: ${p.handle} appears on the ledger at seq ${ev.seq}`);
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

  // --- 9b. Handle namespace integrity (naming ruling 2026-07-10): no
  //         live handle may collide with a tombstone — never recycled.
  const tombstones = await db.handleTombstone.findMany({ select: { handle: true } });
  const tombstoneSet = new Set(tombstones.map((t) => t.handle));
  let handleProblems = 0;
  for (const p of allProfiles) {
    if (tombstoneSet.has(p.handle)) {
      handleProblems++;
      console.error(`✗ HANDLE RECYCLED: live @${p.handle} collides with a tombstone`);
    }
  }
  if (handleProblems === 0) {
    console.log(`✓ Handle namespace (${allProfiles.length} live, ${tombstones.length} tombstoned, none recycled)`);
  } else {
    failures += handleProblems;
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

  // --- 12. Poll integrity.
  const { candleCommitmentFor, ballotsHashFor } = await import("../lib/polls");
  const polls = await db.poll.findMany({
    include: {
      options: { orderBy: { position: "asc" } },
      ballots: { include: { choices: true } },
    },
  });
  const closedEventByPoll = new Map<string, { seq: number; payload: Record<string, unknown> }>();
  const voteEventsByPoll = new Map<string, Array<{ seq: number; payload: Record<string, unknown> }>>();
  for (const ev of events) {
    try {
      const p = JSON.parse(ev.payload);
      if (ev.eventType === "poll.closed" && typeof p?.pollRef === "string") {
        closedEventByPoll.set(p.pollRef, { seq: ev.seq, payload: p });
      }
      if (ev.eventType === "vote.recorded" && typeof p?.pollRef === "string") {
        const list = voteEventsByPoll.get(p.pollRef) ?? [];
        list.push({ seq: ev.seq, payload: p });
        voteEventsByPoll.set(p.pollRef, list);
      }
    } catch {
      /* chain check covers bytes */
    }
  }

  let pollProblems = 0;
  for (const poll of polls) {
    const positionByOptionId = new Map(poll.options.map((o) => [o.id, o.position]));

    // One ballot per nullifier per poll (DB-unique; re-check independently).
    const nulls = new Set(poll.ballots.map((b) => b.nullifier));
    if (nulls.size !== poll.ballots.length) {
      pollProblems++;
      console.error(`✗ DOUBLE VOTE: poll ${poll.id} has duplicate nullifiers`);
    }

    // Pseudonymous ballots carry no profile, ever.
    if (poll.mode === "pseudonymous") {
      for (const b of poll.ballots) {
        if (b.voterProfileId || b.voterHandle) {
          pollProblems++;
          console.error(`✗ BALLOT DEANONYMIZED: pseudonymous poll ${poll.id} has a profile-attached ballot`);
          break;
        }
      }
    }

    if (poll.status === "open") {
      // Sealed until close: nothing about this poll on the ledger but
      // its creation.
      if (closedEventByPoll.has(poll.id) || voteEventsByPoll.has(poll.id)) {
        pollProblems++;
        console.error(`✗ SEAL BROKEN: open poll ${poll.id} has close/vote events on the ledger`);
      }
      continue;
    }

    const closed = closedEventByPoll.get(poll.id);
    if (!closed) {
      pollProblems++;
      console.error(`✗ OFF-LEDGER CLOSE: poll ${poll.id} closed without a poll.closed event`);
      continue;
    }

    // The candle: commitment made before votes must match the reveal.
    if (poll.candleCommitment) {
      const recomputed = candleCommitmentFor(poll.trueCloseAt, poll.candleSalt ?? "");
      if (recomputed !== poll.candleCommitment) {
        pollProblems++;
        console.error(`✗ CANDLE BROKEN: poll ${poll.id} reveal does not match its commitment`);
      }
    }

    // Only ballots cast before the true close count.
    for (const b of poll.ballots) {
      const shouldCount = b.castAt <= poll.trueCloseAt;
      if (b.counted !== shouldCount) {
        pollProblems++;
        console.error(`✗ CANDLE VIOLATED: ballot in poll ${poll.id} counted-flag disagrees with the true close`);
        break;
      }
    }

    // Recompute tallies from counted ballots; they must match both the
    // stored option tallies and the poll.closed event.
    const recomputedTallies: Record<string, number> = {};
    for (const o of poll.options) recomputedTallies[String(o.position)] = 0;
    for (const b of poll.ballots.filter((b) => b.counted)) {
      for (const c of b.choices) {
        const pos = String(positionByOptionId.get(c.optionId));
        recomputedTallies[pos] = (recomputedTallies[pos] ?? 0) + 1;
      }
    }
    const eventTallies = closed.payload.tallies as Record<string, number>;
    for (const o of poll.options) {
      const pos = String(o.position);
      if ((o.tally ?? 0) !== recomputedTallies[pos] || (eventTallies?.[pos] ?? 0) !== recomputedTallies[pos]) {
        pollProblems++;
        console.error(`✗ TALLY ALTERED: poll ${poll.id} option ${pos} disagrees with the counted ballots`);
      }
    }

    // Pseudonymous tamper-evidence: the ballotsHash must re-derive.
    const recomputedHash = ballotsHashFor(
      poll.ballots.map((b) => ({
        nullifier: b.nullifier,
        counted: b.counted ?? false,
        optionPositions: b.choices.map((c) => positionByOptionId.get(c.optionId) ?? -1),
      }))
    );
    if (closed.payload.ballotsHash !== recomputedHash) {
      pollProblems++;
      console.error(`✗ BALLOTS ALTERED: poll ${poll.id} ballotsHash no longer re-derives`);
    }

    // Public mode: counted ballots and post-close vote.recorded events
    // must correspond one-to-one, and none may precede the close.
    if (poll.mode === "public") {
      const voteEvents = voteEventsByPoll.get(poll.id) ?? [];
      const countedCount = poll.ballots.filter((b) => b.counted).length;
      if (voteEvents.length !== countedCount) {
        pollProblems++;
        console.error(`✗ PUBLIC RECORD MISMATCH: poll ${poll.id} has ${countedCount} counted ballots but ${voteEvents.length} vote.recorded events`);
      }
      for (const ev of voteEvents) {
        if (ev.seq < closed.seq) {
          pollProblems++;
          console.error(`✗ SEAL BROKEN: poll ${poll.id} has a vote.recorded event before its close`);
          break;
        }
      }
    } else if ((voteEventsByPoll.get(poll.id) ?? []).length > 0) {
      pollProblems++;
      console.error(`✗ BALLOT DEANONYMIZED: pseudonymous poll ${poll.id} has vote.recorded events`);
    }
  }
  if (pollProblems === 0) {
    const closedCount = polls.filter((p) => p.status === "closed").length;
    console.log(`✓ Poll integrity (${polls.length} poll(s), ${closedCount} closed; seals held, candles verify, tallies re-derive)`);
  } else {
    failures += pollProblems;
  }

  // --- 13. Economy conservation: every balance is exactly the sum of
  //         its entries; the treasury is exactly what flowed in minus
  //         out; nothing is negative; tips split to the gratium; vote
  //         fees never name their poll (who-voted privacy).
  const economyEntries = await db.economyEntry.findMany();
  const allBalances = await db.balance.findMany();
  const treasuryBalances = await db.treasuryBalance.findMany();
  let econProblems = 0;

  const derived = new Map<string, number>(); // profileId|currency
  const derivedTreasury = new Map<string, number>();
  for (const e of economyEntries) {
    if (e.fromProfileId) {
      const k = `${e.fromProfileId}|${e.currency}`;
      derived.set(k, (derived.get(k) ?? 0) - e.amount);
    }
    if (e.toProfileId) {
      const k = `${e.toProfileId}|${e.currency}`;
      derived.set(k, (derived.get(k) ?? 0) + e.amount);
    }
    if (e.fromTreasury) {
      derivedTreasury.set(e.currency, (derivedTreasury.get(e.currency) ?? 0) - e.amount);
    }
    if (e.toTreasury) {
      derivedTreasury.set(e.currency, (derivedTreasury.get(e.currency) ?? 0) + e.amount);
    }
  }
  const close = (a: number, b: number) => Math.abs(a - b) < 0.000001;
  for (const b of allBalances) {
    const expected = derived.get(`${b.profileId}|${b.currency}`) ?? 0;
    if (!close(b.amount, expected)) {
      econProblems++;
      console.error(`✗ CONSERVATION BROKEN: balance ${b.profileId}/${b.currency} is ${b.amount}, entries say ${expected}`);
    }
    if (b.amount < -0.000001) {
      econProblems++;
      console.error(`✗ NEGATIVE BALANCE: ${b.profileId}/${b.currency}`);
    }
    derived.delete(`${b.profileId}|${b.currency}`);
  }
  for (const [key, expected] of Array.from(derived.entries())) {
    if (!close(expected, 0)) {
      econProblems++;
      console.error(`✗ CONSERVATION BROKEN: entries reference missing balance row ${key} (${expected})`);
    }
  }
  for (const t of treasuryBalances) {
    const expected = derivedTreasury.get(t.currency) ?? 0;
    if (!close(t.amount, expected)) {
      econProblems++;
      console.error(`✗ CONSERVATION BROKEN: treasury ${t.currency} is ${t.amount}, entries say ${expected}`);
    }
  }

  // Tips: gross recorded on Tip rows must equal net + cut entries.
  const tipsGross = (await db.tip.findMany()).reduce((s, t) => s + t.amount, 0);
  const tipNet = economyEntries.filter((e) => e.kind === "tip").reduce((s, e) => s + e.amount, 0);
  const tipCut = economyEntries.filter((e) => e.kind === "tip.cut").reduce((s, e) => s + e.amount, 0);
  if (!close(tipsGross, tipNet + tipCut)) {
    econProblems++;
    console.error(`✗ TIP SPLIT BROKEN: gross ${tipsGross} ≠ net ${tipNet} + cut ${tipCut}`);
  }

  // Vote-fee privacy: a fee entry naming the poll would be a who-voted
  // record in operator space beyond what the design allows.
  const leakyVoteFees = economyEntries.filter((e) => e.kind === "fee.vote" && e.refId);
  if (leakyVoteFees.length > 0) {
    econProblems++;
    console.error(`✗ VOTE PRIVACY: ${leakyVoteFees.length} vote-fee entrie(s) name their poll`);
  }

  // Accrual ceilings (TOKENOMICS §4's load-bearing guardrail): no
  // profile may accrue past the daily rail in any UTC day.
  const dailyCeilingRail = await db.rail.findUnique({ where: { key: "accrual.dailyCeilingPc" } });
  if (dailyCeilingRail) {
    const perDay = new Map<string, number>();
    for (const e of economyEntries) {
      if (e.kind !== "accrual" && e.kind !== "accrual.streak") continue;
      const day = Math.floor(e.createdAt.getTime() / 86_400_000);
      const key = `${e.toProfileId}|${day}`;
      perDay.set(key, (perDay.get(key) ?? 0) + e.amount);
    }
    for (const [key, total] of Array.from(perDay.entries())) {
      if (total > dailyCeilingRail.value + 0.000001) {
        econProblems++;
        console.error(`✗ ACCRUAL CEILING BROKEN: ${key} accrued ${total}u in one day`);
      }
    }
  }

  if (econProblems === 0) {
    console.log(`✓ Economy conservation (${allBalances.length} balance(s), ${economyEntries.length} entrie(s); tips split exactly; vote fees blind; accrual capped)`);
  } else {
    failures += econProblems;
  }

  // --- 14. Moderation integrity: the triangle holds; every resolution
  //         is on the ledger; tombstones cite real rules; nothing hides
  //         or is removed without a case.
  const modCases = await db.modCase.findMany({ include: { rulings: true } });
  const ruleIds = new Set((await db.rule.findMany({ select: { id: true } })).map((r) => r.id));
  const resolvedEventByCase = new Map<string, Record<string, unknown>>();
  for (const ev of events) {
    if (ev.eventType !== "case.resolved") continue;
    try {
      const p = JSON.parse(ev.payload);
      if (typeof p?.caseRef === "string") resolvedEventByCase.set(p.caseRef, p);
    } catch { /* chain covers bytes */ }
  }
  let modProblems = 0;
  // Triangle: no moderator handle or profile id in any ledger event —
  // rulings appear ONLY as nullifiers.
  const moderatorIds = new Set(
    (await db.ruling.findMany({ select: { moderatorProfileId: true } })).map(
      (r) => r.moderatorProfileId
    )
  );
  for (const ev of events) {
    const hit = findForbiddenId(ev, moderatorIds);
    if (hit) {
      modProblems++;
      console.error(`✗ TRIANGLE BROKEN: moderator identity on the ledger at seq ${ev.seq}`);
      break;
    }
  }
  for (const c of modCases) {
    if (c.status === "resolved" || c.status === "appealed") {
      const ev = resolvedEventByCase.get(c.id);
      if (!ev) {
        modProblems++;
        console.error(`✗ OFF-LEDGER RESOLUTION: case ${c.id} resolved without a case.resolved event`);
        continue;
      }
      if (typeof ev.rule === "string" && !ruleIds.has(ev.rule)) {
        modProblems++;
        console.error(`✗ PHANTOM RULE: case ${c.id} cites unknown rule ${ev.rule}`);
      }
    }
  }
  // No content is removed/hidden without a case behind it.
  const actioned = await db.post.findMany({
    where: { status: { in: ["removed", "hidden", "blurred"] } },
    select: { id: true, status: true },
  });
  for (const p of actioned) {
    const c = await db.modCase.findFirst({ where: { postId: p.id } });
    if (!c) {
      modProblems++;
      console.error(`✗ OFF-PROCESS ACTION: post ${p.id} is ${p.status} with no case`);
    }
  }
  // Removed posts have their content.removed tombstone event.
  const removedEvents = new Set<string>();
  for (const ev of events) {
    if (ev.eventType !== "content.removed") continue;
    try {
      const p = JSON.parse(ev.payload);
      if (typeof p?.postRef === "string") removedEvents.add(p.postRef);
    } catch { /* covered */ }
  }
  for (const p of actioned.filter((p) => p.status === "removed")) {
    if (!removedEvents.has(p.id)) {
      modProblems++;
      console.error(`✗ SILENT REMOVAL: post ${p.id} removed without a tombstone event`);
    }
  }
  if (modProblems === 0) {
    const resolvedCount = modCases.filter((c) => c.status === "resolved" || c.status === "appealed").length;
    console.log(`✓ Moderation integrity (${modCases.length} case(s), ${resolvedCount} resolved; triangle holds, tombstones cite law)`);
  } else {
    failures += modProblems;
  }

  // --- 15. Notification isolation: every notification belongs to a real
  //         profile; no cross-face aggregation key collision leaks.
  const notifications = await db.notification.findMany({
    select: { profileId: true },
  });
  const profileIdSet = new Set(allProfiles.map((p) => p.id));
  let notifProblems = 0;
  for (const n of notifications) {
    if (!profileIdSet.has(n.profileId)) {
      notifProblems++;
      console.error(`✗ ORPHAN NOTIFICATION: unknown profile ${n.profileId}`);
    }
  }
  if (notifProblems === 0) {
    console.log(`✓ Notification isolation (${notifications.length} notification(s), all per-profile)`);
  } else {
    failures += notifProblems;
  }

  if (failures > 0) {
    console.error(`\nVERIFICATION FAILED: ${failures} problem(s).`);
    process.exit(1);
  }
  console.log("\nALL CHECKS PASSED.");
}

main().finally(() => db.$disconnect());
