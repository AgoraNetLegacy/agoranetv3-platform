// db:verify; the invariant check. Run after any work session; CI runs it
// on every push. v2's proven pattern, reimplemented on the v3 schema
// (declared reuse, DUAL_IDENTITY_MODULE.md §1.2 invariant 3 / §9).
//
// The check list grows with each phase, never shrinks.
// Phase 0:
// 1. Civic Ledger hash chain verifies from GENESIS.
// 2. Canon integrity: 7 pillars, 49 questions, full lens coverage,
//    positions 1–49 complete.
// 3. Identity-leak guard: no Human id, no Profile db id anywhere in the
//    ledger; pseudonyms only.
// 4. Gate integrity: every PSEUDONYMOUS cleared request is on the ledger
//    (nothing clears off-ledger), one clearance per (scope, nullifier),
//    duplicate rejections private, PRIVATE clearances have no event.
// Phase 1:
// 5. Canonical Discussions: 49 permanent spaces, 1:1 with the canon.
// 6. Permanent-record integrity: every permanent-space post has a
//    post.recorded event; every LOCKED post's body re-hashes to its
//    last ledger commitment; a locked record cannot be silently edited.
// 7. Flag privacy: no flag-related event type on the public ledger, and
//    no flag's nullifier appears anywhere in it (triangle of blindness).
// Phase 2:
// 8. Structural unlinkability: no Alias row carries a humanId; at most
//    one True Self per human.
// 9. Registration evidence: nullifier spends match profile counts;
//    active faces have their registration/activation events; PENDING
//    aliases appear NOWHERE in the public ledger.
// 10. Session hygiene: expired sessions/locks purged (short retention;
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
// Phase 6:
// 16. Circle integrity: every Circle paid its formation fee and is on
//     the ledger; exactly one members' room; membership rows and
//     join/leave/removal events correspond; one active membership per
//     (circle, profile); action-log entries re-hash to their
//     action.logged commitments (no silent edits; there is no edit);
//     every attestation is on the ledger, by a member, never the
//     author, never doubled; attested state implies the platform floor
//     of co-signers; corrections stay in their circle.
// 17. Members'-room privacy + circle-poll discipline: no circle-room
//     post ever hash-commits to the public ledger (the room is not the
//     permanent record); circle-restricted polls are never governance,
//     their poll.created events carry a re-derivable contentHash and
//     never the question text; every circle-poll voter was a member;
//     Circle Light Score credits reference real attested entries and
//     respect the per-circle daily cap.
// Phase 6.5:
// 18. Social privacy; the graph never leaks: NOTHING social on the
//     public ledger (no event types, no bond/request/thread/message/
//     excerpt/block ids anywhere in it); every social gate clearance
//     ran in PRIVATE recording; social fee entries are blinded (no
//     counterparty reference); no notification carries message content.
// 19. Social integrity: bonds are normalized non-self pairs, each
//     backed by an accepted request; threads join exactly their two
//     members and every message's ciphertext AUTHENTICATES and
//     decrypts under the re-derived thread key (a silently altered or
//     plaintext-smuggled message fails loudly); stale pending requests
//     are swept per the expiry rail; every flag and case carries
//     exactly one evidence pointer (post XOR DM excerpt).
// Phase 7:
// 20. Domain & Picture integrity: 56 domains (8 per pillar), each with
//     its permanent thread and a contiguous revision history whose v1
//     is the seed and whose every later version traces to exactly one
//     ACCEPTED repair; every accepted repair rides a closed governance
//     poll that PASSED with Adopt leading, in the domain's own pillar,
//     system-opened ("system" is tombstoned, never claimable); declined
//     repairs left no revision and no credit; every picture-repair
//     Light Score credit references a real accepted repair at the rail
//     amount in the right pillar.
// 21. Transparency books: every economy kind maps to a category (the
//     Constitution's budgeted-categories guardrail; an unmapped flow
//     fails here, not renders as "misc"); the latest treasury snapshot
//     re-derives from the entries as of its timestamp; the dashboard
//     is a view, never a second set of books.
// 22. Feed & search privacy: reading-surface state (feed sources,
//     settings, search history) is per-profile operator space; no
//     feed/search event type exists on the public ledger and no such
//     row id appears anywhere in it; every feed source is a known kind.
// Phase 7.5:
// 23. Chamber integrity: every chamber paid BOTH halves of the
//     dual-token creation fee and has its chamber.created event;
//     exactly one workshop Discussion per chamber, deletable class
//     (never permanent; the drafts are not the record); the scaffold
//     and the "why should people care" field are non-empty (the
//     ratified creation requirements); every workshop post's author
//     entered the chamber, and every workshop post paid the dual-token
//     participation fee (PC and G entries pair 1:1 with posts); every
//     private-chamber member is the creator or was invited.
// 24. Workshop enclosure: no workshop post ever hash-commits to the
//     public ledger or upgrades to permanence; no chamber member,
//     invite, or workshop-discussion id appears anywhere in the
//     ledger (entry, invites, and workshop posting all clear the gate
//     in PRIVATE recording; membership is enclosed-space information,
//     the public sees count and activity level only).
// Phase 8:
// 25. Ops & counter hygiene (minimal-log discipline, DUAL_IDENTITY
//     §7.1 vector 4): every rate-limit bucket key is HMAC-shaped (a
//     raw IP/session/profile identifier can never persist as a
//     counter key); every admin.* ops event carries its operator
//     attribution and file reference and NOTHING beyond the audited
//     payload fields; ops-log payload creep toward soul data fails
//     loudly here.
// 26. Analytics discipline (ANALYTICS_SPEC): every event name is in
//     the closed measured vocabulary (an unaudited event type cannot
//     ship); subject keys are HMAC-shaped and appear ONLY on the
//     retention/funnel events that need them (a raw profile id can
//     never persist in analytics); no raw event outlives the
//     retention rail plus a one-week crush grace (the 90-day promise
//     is checked, not assumed); nothing analytics-flavored exists on
//     the public ledger.

import { createHash } from "crypto";
import { PrismaClient } from "@prisma/client";
import { verifyChain, findForbiddenId } from "../lib/ledger";
import { PILLARS, LENSES } from "../lib/canon";
import { getRail } from "../lib/rails";

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
  //        and no raw Profile ids; only pseudonyms. (Dual-identity safety.)
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

  // --- 4b. One clearance per (scope, nullifier); among requests AND events.
  const seenReq = new Set<string>();
  for (const req of clearedRequests) {
    const key = `${req.scope}|${req.nullifier}`;
    if (seenReq.has(key)) {
      gateProblems++;
      console.error(`✗ DOUBLE CLEARANCE: (scope, nullifier) cleared twice; ${req.scope}`);
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

  // --- 9. Registration evidence + private-by-default Alias behavior.
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
  for (const ev of events) {
    try {
      const p = JSON.parse(ev.payload);
      if (ev.eventType === "trueself.registered" && typeof p?.handle === "string") {
        registeredHandles.add(p.handle);
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
    if (p.status === "pending") {
      // Legacy pending Aliases must be invisible: their pseudonym appears nowhere.
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
    console.log(`✓ Registration evidence (${trueSelves.length} True Self(s), ${aliases.length} Alias(es); private-by-default Aliases protected)`);
  } else {
    failures += regProblems;
  }

  // --- 9b. Handle namespace integrity (naming ruling 2026-07-10): no
  //         live handle may collide with a tombstone; never recycled.
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

  // --- 10. Session hygiene: short retention is a promise; sweep expired
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
  // Triangle: no moderator handle or profile id in any ledger event;
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

  // --- 16. Circle integrity (the action layer's whole promise).
  const { actionEntryHash } = await import("../lib/circles");
  const circles = await db.circle.findMany({
    include: {
      members: true,
      discussions: true,
      actions: { include: { attestations: true, pledges: true } },
    },
  });
  let circleProblems = 0;

  // Index the circle-related ledger events once.
  const formedEvents = new Set<string>();
  const joinEvents = new Map<string, number>(); // circleRef|handle → count
  const leftEvents = new Map<string, number>();
  const loggedHashByEntry = new Map<string, string>();
  const attestEvents = new Set<string>(); // entryRef|handle
  for (const ev of events) {
    try {
      const p = JSON.parse(ev.payload);
      if (ev.eventType === "circle.formed" && typeof p?.circleRef === "string") {
        formedEvents.add(p.circleRef);
      }
      if (ev.eventType === "circle.joined" && typeof p?.circleRef === "string") {
        const k = `${p.circleRef}|${p.handle}`;
        joinEvents.set(k, (joinEvents.get(k) ?? 0) + 1);
      }
      if (
        (ev.eventType === "circle.left" || ev.eventType === "circle.member-removed") &&
        typeof p?.circleRef === "string"
      ) {
        const k = `${p.circleRef}|${p.handle}`;
        leftEvents.set(k, (leftEvents.get(k) ?? 0) + 1);
      }
      if (ev.eventType === "action.logged" && typeof p?.entryRef === "string") {
        loggedHashByEntry.set(p.entryRef, p.contentHash);
      }
      if (ev.eventType === "action.attested" && typeof p?.entryRef === "string") {
        attestEvents.add(`${p.entryRef}|${p.handle}`);
      }
    } catch {
      /* chain check covers bytes */
    }
  }

  const attestationRail = await db.rail.findUnique({
    where: { key: "circle.attestationThreshold" },
  });
  const circleFees = economyEntries.filter((e) => e.kind === "fee.circle");

  for (const circle of circles) {
    if (!formedEvents.has(circle.id)) {
      circleProblems++;
      console.error(`✗ OFF-LEDGER CIRCLE: ${circle.id} has no circle.formed event`);
    }
    const rooms = circle.discussions.filter((d) => d.circleId === circle.id);
    if (rooms.length !== 1) {
      circleProblems++;
      console.error(`✗ ROOM COUNT: circle ${circle.id} has ${rooms.length} members' rooms`);
    }
    if (
      attestationRail &&
      (circle.attestationThreshold < attestationRail.boundMin ||
        circle.attestationThreshold > attestationRail.boundMax)
    ) {
      circleProblems++;
      console.error(`✗ RAIL BREACH: circle ${circle.id} threshold ${circle.attestationThreshold} outside bounds`);
    }

    // Membership rows ↔ public events; one active row per profile.
    const activeByProfile = new Map<string, number>();
    const rowsByHandle = new Map<string, { joins: number; leaves: number }>();
    for (const m of circle.members) {
      const r = rowsByHandle.get(m.handle) ?? { joins: 0, leaves: 0 };
      r.joins++;
      if (m.leftAt) r.leaves++;
      rowsByHandle.set(m.handle, r);
      if (!m.leftAt) {
        activeByProfile.set(m.profileId, (activeByProfile.get(m.profileId) ?? 0) + 1);
      }
    }
    for (const [profileId, n] of Array.from(activeByProfile.entries())) {
      if (n > 1) {
        circleProblems++;
        console.error(`✗ DOUBLE MEMBERSHIP: circle ${circle.id} profile ${profileId} has ${n} active rows`);
      }
    }
    for (const [handle, r] of Array.from(rowsByHandle.entries())) {
      if ((joinEvents.get(`${circle.id}|${handle}`) ?? 0) !== r.joins) {
        circleProblems++;
        console.error(`✗ OFF-LEDGER JOIN: circle ${circle.id} @${handle} rows=${r.joins} events=${joinEvents.get(`${circle.id}|${handle}`) ?? 0}`);
      }
      if ((leftEvents.get(`${circle.id}|${handle}`) ?? 0) !== r.leaves) {
        circleProblems++;
        console.error(`✗ OFF-LEDGER LEAVE: circle ${circle.id} @${handle} departures unrecorded`);
      }
    }

    // The action log: permanent means re-derivable, forever.
    const memberHandles = new Set(circle.members.map((m) => m.handle));
    for (const entry of circle.actions) {
      const recorded = loggedHashByEntry.get(entry.id);
      const actual = actionEntryHash({
        body: entry.body,
        didAt: entry.didAt,
        place: entry.place,
        correctionOfId: entry.correctionOfId,
        pledges: entry.pledges.map((p) => ({ kind: p.kind, body: p.body })),
      });
      if (!recorded) {
        circleProblems++;
        console.error(`✗ OFF-LEDGER ACTION: entry ${entry.id} has no action.logged event`);
      } else if (recorded !== actual) {
        circleProblems++;
        console.error(`✗ ACTION LOG ALTERED: entry ${entry.id} no longer matches its ledger commitment`);
      }
      if (entry.attestedAt && entry.attestations.length < 2) {
        circleProblems++;
        console.error(`✗ ATTESTED BELOW FLOOR: entry ${entry.id} attested with ${entry.attestations.length} co-signer(s)`);
      }
      const seenAttestors = new Set<string>();
      for (const a of entry.attestations) {
        if (a.attestorProfileId === entry.authorProfileId) {
          circleProblems++;
          console.error(`✗ SELF-ATTESTATION: entry ${entry.id}`);
        }
        if (seenAttestors.has(a.attestorProfileId)) {
          circleProblems++;
          console.error(`✗ DOUBLE ATTESTATION: entry ${entry.id}`);
        }
        seenAttestors.add(a.attestorProfileId);
        if (!memberHandles.has(a.attestorHandle)) {
          circleProblems++;
          console.error(`✗ NON-MEMBER ATTESTOR: entry ${entry.id} @${a.attestorHandle}`);
        }
        if (!attestEvents.has(`${entry.id}|${a.attestorHandle}`)) {
          circleProblems++;
          console.error(`✗ OFF-LEDGER ATTESTATION: entry ${entry.id} @${a.attestorHandle}`);
        }
      }
      if (entry.correctionOfId) {
        const target = await db.actionEntry.findUnique({ where: { id: entry.correctionOfId } });
        if (!target || target.circleId !== circle.id) {
          circleProblems++;
          console.error(`✗ CROSS-CIRCLE CORRECTION: entry ${entry.id}`);
        }
      }
    }
  }
  // Formation is never free: at least one fee.circle entry per circle.
  if (circleFees.length < circles.length) {
    circleProblems++;
    console.error(`✗ FREE CIRCLE: ${circles.length} circle(s) but ${circleFees.length} formation fee(s)`);
  }
  if (circleProblems === 0) {
    const attestedCount = circles.flatMap((c) => c.actions).filter((a) => a.attestedAt).length;
    console.log(`✓ Circle integrity (${circles.length} circle(s), ${circles.flatMap((c) => c.actions).length} log entrie(s), ${attestedCount} attested; log re-derives, membership on-ledger)`);
  } else {
    failures += circleProblems;
  }

  // --- 17. Members'-room privacy + circle-poll discipline + LS guardrails.
  const { circlePollContentHash } = await import("../lib/polls");
  let roomProblems = 0;

  // No circle-room post ever reaches the public ledger, in any form.
  const roomPosts = await db.post.findMany({
    where: { discussion: { circleId: { not: null } } },
    select: { id: true, permanentUpgraded: true },
  });
  const committedPostRefs = new Set(lastHashByPost.keys());
  for (const p of roomPosts) {
    if (committedPostRefs.has(p.id)) {
      roomProblems++;
      console.error(`✗ ROOM LEAK: members'-room post ${p.id} is hash-committed on the public ledger`);
    }
    if (p.permanentUpgraded) {
      roomProblems++;
      console.error(`✗ ROOM PERMANENCE: members'-room post ${p.id} was permanence-upgraded`);
    }
  }
  // Resource-offer ids never appear on the ledger (offers surface only
  // as snapshots inside action.logged payloads).
  const offerIds = new Set(
    (await db.resourceOffer.findMany({ select: { id: true } })).map((o) => o.id)
  );
  for (const ev of events) {
    const hit = findForbiddenId(ev, offerIds);
    if (hit) {
      roomProblems++;
      console.error(`✗ BOARD LEAK: resource offer id on the ledger at seq ${ev.seq}`);
      break;
    }
  }

  // Circle-restricted polls: never governance; created-event discipline.
  const createdEventByPoll = new Map<string, Record<string, unknown>>();
  for (const ev of events) {
    if (ev.eventType !== "poll.created") continue;
    try {
      const p = JSON.parse(ev.payload);
      if (typeof p?.pollRef === "string") createdEventByPoll.set(p.pollRef, p);
    } catch { /* covered */ }
  }
  const circlePolls = await db.poll.findMany({
    where: { visibilityScope: "circle" },
    include: { options: { orderBy: { position: "asc" } } },
  });
  const memberEverByCircle = new Map<string, Set<string>>();
  for (const c of circles) {
    memberEverByCircle.set(c.id, new Set(c.members.map((m) => m.profileId)));
  }
  for (const poll of circlePolls) {
    if (poll.isGovernance) {
      roomProblems++;
      console.error(`✗ SCOPE BREACH: circle poll ${poll.id} is marked governance`);
    }
    if (!poll.circleRef) {
      roomProblems++;
      console.error(`✗ ORPHAN CIRCLE POLL: ${poll.id} has circle scope but no circle`);
      continue;
    }
    const created = createdEventByPoll.get(poll.id);
    if (!created) {
      roomProblems++;
      console.error(`✗ OFF-LEDGER POLL: circle poll ${poll.id} has no poll.created event`);
    } else {
      if ("title" in created || "options" in created) {
        roomProblems++;
        console.error(`✗ ROOM LEAK: circle poll ${poll.id} question text on the public ledger`);
      }
      const expected = circlePollContentHash(
        poll.title,
        poll.options.map((o) => o.label)
      );
      if (created.contentHash !== expected) {
        roomProblems++;
        console.error(`✗ POLL COMMITMENT BROKEN: circle poll ${poll.id} contentHash does not re-derive`);
      }
    }
    // Every voter was a member of the circle (operator-space check).
    const voters = await db.gateRequest.findMany({
      where: { scope: `poll:${poll.id}`, status: "CLEARED" },
      select: { profileId: true },
    });
    const everMembers = memberEverByCircle.get(poll.circleRef) ?? new Set();
    for (const v of voters) {
      if (!everMembers.has(v.profileId)) {
        roomProblems++;
        console.error(`✗ NON-MEMBER BALLOT: circle poll ${poll.id} has a vote from outside the membership`);
      }
    }
  }

  // Light Score guardrails: credits name real attested entries; the
  // per-circle daily cap holds.
  const circleCredits = await db.lightScoreAdjustment.findMany({
    where: { refType: { in: ["circle-action", "circle-attest"] } },
  });
  const entryById = new Map(
    circles.flatMap((c) => c.actions).map((a) => [a.id, a])
  );
  const capRail = await db.rail.findUnique({ where: { key: "circle.lsDailyCapPoints" } });
  const perProfileCircleDay = new Map<string, number>();
  for (const credit of circleCredits) {
    const entry = credit.refId ? entryById.get(credit.refId) : undefined;
    if (!entry || !entry.attestedAt) {
      roomProblems++;
      console.error(`✗ PHANTOM CREDIT: LS adjustment ${credit.id} references no attested entry`);
      continue;
    }
    if (credit.amount <= 0) {
      roomProblems++;
      console.error(`✗ CREDIT SIGN: circle LS adjustment ${credit.id} is not positive`);
    }
    const day = Math.floor(credit.createdAt.getTime() / 86_400_000);
    const key = `${credit.profileId}|${entry.circleId}|${day}`;
    perProfileCircleDay.set(key, (perProfileCircleDay.get(key) ?? 0) + credit.amount);
  }
  if (capRail) {
    for (const [key, total] of Array.from(perProfileCircleDay.entries())) {
      if (total > capRail.value + 0.000001) {
        roomProblems++;
        console.error(`✗ LS DAILY CAP BROKEN: ${key} credited ${total} points in one day`);
      }
    }
  }

  if (roomProblems === 0) {
    console.log(`✓ Members'-room privacy & circle-poll discipline (${roomPosts.length} room post(s) unleaked, ${circlePolls.length} circle poll(s) hash-committed, ${circleCredits.length} LS credit(s) capped)`);
  } else {
    failures += roomProblems;
  }

  // --- 18. Social privacy: the graph never leaks.
  let socialProblems = 0;
  const bonds = await db.fellowSoulBond.findMany();
  const requests = await db.fellowSoulRequest.findMany();
  const threads = await db.dmThread.findMany();
  const dmMessages = await db.dmMessage.findMany();
  const excerpts = await db.dmExcerpt.findMany();
  const blocks = await db.block.findMany();

  // No social event types, ever.
  const socialEventTypes = events.filter((ev) =>
    /^(fellow|dm|request|bond|block)/i.test(ev.eventType)
  );
  if (socialEventTypes.length > 0) {
    socialProblems++;
    console.error(`✗ GRAPH LEAK: ${socialEventTypes.length} social event(s) on the public ledger`);
  }
  // No social row id anywhere in the ledger.
  const socialIds = new Set<string>([
    ...bonds.map((b) => b.id),
    ...requests.map((r) => r.id),
    ...threads.map((t) => t.id),
    ...dmMessages.map((m) => m.id),
    ...excerpts.map((e) => e.id),
    ...blocks.map((b) => b.id),
  ]);
  for (const ev of events) {
    const hit = findForbiddenId(ev, socialIds);
    if (hit) {
      socialProblems++;
      console.error(`✗ GRAPH LEAK: social id on the ledger at seq ${ev.seq}`);
      break;
    }
  }
  // Every social clearance ran private (enforcement must never become
  // an observation channel; and the graph is nobody's civic record).
  const socialScopes = await db.gateRequest.findMany({
    where: {
      status: "CLEARED",
      OR: [
        { scope: { startsWith: "fellow-request:" } },
        { scope: { startsWith: "dm-thread:" } },
        { scope: { startsWith: "dm-message:" } },
        { scope: { startsWith: "flag:dm:" } },
      ],
    },
    select: { id: true, ledgerRecording: true },
  });
  for (const req of socialScopes) {
    if (req.ledgerRecording !== "private") {
      socialProblems++;
      console.error(`✗ GRAPH LEAK: social clearance ${req.id} recorded publicly`);
    }
  }
  // Blinded fees: who-asked-whom and who-messages-whom stay out of the
  // economy table.
  const socialFees = economyEntries.filter((e) =>
    ["fee.request", "fee.dm-thread", "fee.dm-message"].includes(e.kind)
  );
  for (const fee of socialFees) {
    if (fee.refId || fee.toProfileId) {
      socialProblems++;
      console.error(`✗ FEE LEAK: social fee entry ${fee.id} names a counterparty or reference`);
    }
  }
  if (socialProblems === 0) {
    console.log(
      `✓ Social privacy (${bonds.length} bond(s), ${threads.length} thread(s), ${dmMessages.length} message(s); nothing on the ledger, clearances private, fees blind)`
    );
  } else {
    failures += socialProblems;
  }

  // --- 19. Social integrity + encryption.
  let dmProblems = 0;
  const requestPairs = new Set(
    requests
      .filter((r) => r.status === "accepted")
      .map((r) => [r.fromProfileId, r.toProfileId].sort().join(":"))
  );
  const seenBondPairs = new Set<string>();
  for (const bond of bonds) {
    if (bond.aProfileId >= bond.bProfileId) {
      dmProblems++;
      console.error(`✗ BOND SHAPE: ${bond.id} is not a normalized pair`);
    }
    const key = `${bond.aProfileId}:${bond.bProfileId}`;
    if (seenBondPairs.has(key)) {
      dmProblems++;
      console.error(`✗ DOUBLE BOND: ${key}`);
    }
    seenBondPairs.add(key);
    if (!requestPairs.has(key)) {
      dmProblems++;
      console.error(`✗ CONSENTLESS BOND: ${bond.id} has no accepted request behind it`);
    }
  }

  const { threadKeyFor, openMessage } = await import("../lib/dmCrypto");
  const threadById = new Map(threads.map((t) => [t.id, t]));
  const decryptedMessages: Array<{
    body: string;
    threadId: string;
    recipientProfileId: string;
  }> = [];
  for (const t of threads) {
    const expectedKey = [t.initiatorProfileId, t.otherProfileId].sort().join(":");
    if (t.pairKey !== expectedKey || t.initiatorProfileId === t.otherProfileId) {
      dmProblems++;
      console.error(`✗ THREAD SHAPE: ${t.id} pairKey/self mismatch`);
    }
  }
  for (const message of dmMessages) {
    const thread = threadById.get(message.threadId);
    if (!thread) {
      dmProblems++;
      console.error(`✗ ORPHAN MESSAGE: ${message.id}`);
      continue;
    }
    if (
      message.senderProfileId !== thread.initiatorProfileId &&
      message.senderProfileId !== thread.otherProfileId
    ) {
      dmProblems++;
      console.error(`✗ INTRUDER MESSAGE: ${message.id} sender is not a thread member`);
      continue;
    }
    try {
      const key = await threadKeyFor(db, thread);
      decryptedMessages.push({
        body: openMessage(key, thread.id, message.senderProfileId, message.ciphertext),
        threadId: thread.id,
        recipientProfileId:
          message.senderProfileId === thread.initiatorProfileId
            ? thread.otherProfileId
            : thread.initiatorProfileId,
      });
    } catch {
      dmProblems++;
      console.error(`✗ CIPHERTEXT BROKEN: message ${message.id} fails authentication; altered, or plaintext smuggled into the column`);
    }
  }
  // Recipient-only DM previews are allowed by owner ruling (2026-08-17).
  // The same plaintext anywhere else remains a structural content leak.
  const allNotifications = await db.notification.findMany({
    select: {
      id: true,
      profileId: true,
      category: true,
      body: true,
      refType: true,
      refId: true,
    },
  });
  for (const n of allNotifications) {
    for (const message of decryptedMessages) {
      if (message.body.length < 8 || !n.body.includes(message.body)) continue;
      const allowedRecipientPreview =
        n.profileId === message.recipientProfileId &&
        (n.category === "dm" || n.category === "request") &&
        n.refType === "dm-thread" &&
        n.refId === message.threadId;
      if (!allowedRecipientPreview) {
        dmProblems++;
        console.error(`✗ CONTENT LEAK: notification ${n.id} exposes DM plaintext outside its recipient thread preview`);
      }
    }
  }
  // Requests hygiene: sweep, then assert (the sessions pattern).
  const expiryRail = await db.rail.findUnique({ where: { key: "social.requestExpiryDays" } });
  if (expiryRail) {
    const cutoff = new Date(Date.now() - expiryRail.value * 86_400_000);
    await db.fellowSoulRequest.updateMany({
      where: { status: "pending", createdAt: { lte: cutoff } },
      data: { status: "expired", resolvedAt: new Date() },
    });
    const stale = await db.fellowSoulRequest.count({
      where: { status: "pending", createdAt: { lte: cutoff } },
    });
    if (stale > 0) {
      dmProblems++;
      console.error(`✗ REQUEST RETENTION: ${stale} pending request(s) past the expiry rail`);
    }
  }
  // EXACTLY ONE evidence pointer per flag and per case; a post, a DM
  // excerpt, or (Phase 8.7) a mission release. The rule is unchanged;
  // only the number of legal shapes grew. Two pointers would make the
  // case file ambiguous about what is actually being judged.
  const exactlyOne = (...pointers: (string | null)[]) =>
    pointers.filter(Boolean).length === 1;

  const allFlags = await db.flag.findMany({
    select: { id: true, postId: true, dmExcerptId: true, releaseId: true },
  });
  for (const f of allFlags) {
    if (!exactlyOne(f.postId, f.dmExcerptId, f.releaseId)) {
      dmProblems++;
      const n = [f.postId, f.dmExcerptId, f.releaseId].filter(Boolean).length;
      console.error(`✗ EVIDENCE SHAPE: flag ${f.id} has ${n === 0 ? "no" : `${n}`} evidence pointers`);
    }
  }
  const allCases = await db.modCase.findMany({
    select: { id: true, postId: true, dmExcerptId: true, releaseId: true },
  });
  for (const c of allCases) {
    if (!exactlyOne(c.postId, c.dmExcerptId, c.releaseId)) {
      dmProblems++;
      const n = [c.postId, c.dmExcerptId, c.releaseId].filter(Boolean).length;
      console.error(`✗ EVIDENCE SHAPE: case ${c.id} has ${n === 0 ? "no" : `${n}`} evidence pointers`);
    }
  }
  if (dmProblems === 0) {
    console.log(
      `✓ Social integrity & encryption (${bonds.length} bond(s) consented, ${dmMessages.length} message(s) authenticate and decrypt, requests swept, evidence pointers exact)`
    );
  } else {
    failures += dmProblems;
  }

  // --- 20. Domain & Picture integrity (Phase 7).
  let domainProblems = 0;
  const domains = await db.domain.findMany({
    include: {
      pillar: { select: { slug: true } },
      discussion: true,
      revisions: { orderBy: { version: "asc" } },
      repairs: true,
    },
  });
  if (domains.length !== 56) {
    domainProblems++;
    console.error(`✗ DOMAIN COUNT: ${domains.length} (expected 56)`);
  }
  const perPillar = new Map<string, number>();
  for (const d of domains) {
    perPillar.set(d.pillar.slug, (perPillar.get(d.pillar.slug) ?? 0) + 1);
    if (!d.discussion || d.discussion.permanence !== "permanent-canonical") {
      domainProblems++;
      console.error(`✗ DOMAIN THREAD: ${d.pillar.slug} domain ${d.position} lacks its permanent thread`);
    }
    // Revision history: contiguous from 1; v1 is the seed; every later
    // version traces to exactly one accepted repair of THIS domain.
    d.revisions.forEach((r, i) => {
      if (r.version !== i + 1) {
        domainProblems++;
        console.error(`✗ REVISION GAP: ${d.pillar.slug} domain ${d.position} v${r.version} at index ${i}`);
      }
    });
    if (d.revisions.length === 0 || d.revisions[0].repairId !== null) {
      domainProblems++;
      console.error(`✗ PICTURE SEED: ${d.pillar.slug} domain ${d.position} v1 missing or not the seed`);
    }
    for (const r of d.revisions.slice(1)) {
      const repair = d.repairs.find((rep) => rep.id === r.repairId);
      if (!repair || repair.status !== "accepted") {
        domainProblems++;
        console.error(`✗ ORPHAN REVISION: ${d.pillar.slug} domain ${d.position} v${r.version} has no accepted repair behind it`);
      }
    }
  }
  for (const [slug, count] of perPillar) {
    if (count !== 8) {
      domainProblems++;
      console.error(`✗ DOMAIN SHAPE: ${slug} has ${count} domains (expected 8)`);
    }
  }
  const allRepairs = await db.pictureRepair.findMany({
    include: { domain: { select: { pillarId: true } }, revision: true },
  });
  const repairRail = await db.rail.findUnique({ where: { key: "lightScore.repairAcceptedCredit" } });
  for (const r of allRepairs) {
    const poll = r.pollId ? await db.poll.findUnique({ where: { id: r.pollId }, include: { options: true } }) : null;
    if (!poll) {
      domainProblems++;
      console.error(`✗ POLL-LESS REPAIR: ${r.id} has no acceptance poll`);
      continue;
    }
    if (!poll.isGovernance || poll.pillarId !== r.domain.pillarId || poll.creatorHandle !== "system") {
      domainProblems++;
      console.error(`✗ REPAIR POLL SHAPE: ${r.id}; not a system governance poll in the domain's pillar`);
    }
    if (r.status === "open" && poll.status !== "open") {
      domainProblems++;
      console.error(`✗ REPAIR STATE: ${r.id} open but its poll closed without executing`);
    }
    if (r.status === "accepted") {
      const adopt = poll.options.find((o) => o.position === 1)?.tally ?? 0;
      const top = Math.max(0, ...poll.options.map((o) => o.tally ?? 0));
      if (poll.status !== "closed" || poll.outcome !== "passed" || adopt !== top || adopt === 0) {
        domainProblems++;
        console.error(`✗ UNBACKED ACCEPTANCE: repair ${r.id} accepted without a passing Adopt poll`);
      }
      if (!r.revision) {
        domainProblems++;
        console.error(`✗ MISSING REVISION: accepted repair ${r.id} produced no Picture version`);
      }
    }
    if (r.status === "declined" && r.revision) {
      domainProblems++;
      console.error(`✗ GHOST REVISION: declined repair ${r.id} has a revision`);
    }
  }
  const repairCredits = await db.lightScoreAdjustment.findMany({
    where: { refType: "picture-repair" },
  });
  const acceptedById = new Map(allRepairs.filter((r) => r.status === "accepted").map((r) => [r.id, r]));
  for (const credit of repairCredits) {
    const repair = credit.refId ? acceptedById.get(credit.refId) : undefined;
    if (!repair) {
      domainProblems++;
      console.error(`✗ PHANTOM REPAIR CREDIT: adjustment ${credit.id} references no accepted repair`);
      continue;
    }
    if (
      repair.authorProfileId !== credit.profileId ||
      repair.domain.pillarId !== credit.pillarId ||
      (repairRail && credit.amount !== repairRail.value)
    ) {
      domainProblems++;
      console.error(`✗ REPAIR CREDIT SHAPE: adjustment ${credit.id} wrong soul, pillar, or amount`);
    }
  }
  const systemTombstone = await db.handleTombstone.findUnique({ where: { handle: "system" } });
  if (!systemTombstone) {
    domainProblems++;
    console.error(`✗ RESERVED HANDLE: "system" is claimable`);
  }
  if (domainProblems === 0) {
    const accepted = allRepairs.filter((r) => r.status === "accepted").length;
    console.log(
      `✓ Domain & Picture integrity (${domains.length} domains, ${allRepairs.length} repair(s), ${accepted} accepted; histories contiguous, every acceptance poll-backed)`
    );
  } else {
    failures += domainProblems;
  }

  // --- 21. Transparency books re-derive.
  let bookProblems = 0;
  const { kindInfo, computeBooks } = await import("../lib/transparency");
  const distinctKinds = await db.economyEntry.groupBy({ by: ["kind"] });
  for (const k of distinctKinds) {
    try {
      kindInfo(k.kind);
    } catch {
      bookProblems++;
      console.error(`✗ UNCATEGORIZED FLOW: economy kind "${k.kind}" has no budget category`);
    }
  }
  const latestSnapshot = await db.treasurySnapshot.findFirst({ orderBy: { takenAt: "desc" } });
  if (latestSnapshot) {
    const rederived = await computeBooks(db, latestSnapshot.takenAt);
    const stored = {
      balances: JSON.parse(latestSnapshot.balances),
      inflows: JSON.parse(latestSnapshot.inflows),
      outflows: JSON.parse(latestSnapshot.outflows),
    };
    const close = (a: number, b: number) => Math.abs(a - b) < 1e-6;
    if (
      !close(rederived.balances.PC, stored.balances.PC) ||
      !close(rederived.balances.G, stored.balances.G)
    ) {
      bookProblems++;
      console.error(
        `✗ SNAPSHOT DRIFT: ${latestSnapshot.day} balances ${JSON.stringify(stored.balances)} != re-derived ${JSON.stringify(rederived.balances)}`
      );
    }
    for (const [section, storedTotals] of [
      ["inflows", stored.inflows],
      ["outflows", stored.outflows],
    ] as const) {
      const fresh = rederived[section];
      const categories = new Set([...Object.keys(storedTotals), ...Object.keys(fresh)]);
      for (const c of categories) {
        const s = storedTotals[c] ?? { PC: 0, G: 0 };
        const f = fresh[c] ?? { PC: 0, G: 0 };
        if (!close(s.PC, f.PC) || !close(s.G, f.G)) {
          bookProblems++;
          console.error(`✗ SNAPSHOT DRIFT: ${latestSnapshot.day} ${section} "${c}" stored ${s.PC}/${s.G} != re-derived ${f.PC}/${f.G}`);
        }
      }
    }
  }
  if (bookProblems === 0) {
    console.log(
      `✓ Transparency books (every kind categorized; ${latestSnapshot ? `snapshot ${latestSnapshot.day} re-derives` : "no snapshot yet"})`
    );
  } else {
    failures += bookProblems;
  }

  // --- 22. Feed & search privacy.
  let feedProblems = 0;
  for (const e of events) {
    if (e.eventType.startsWith("feed.") || e.eventType.startsWith("search.")) {
      feedProblems++;
      console.error(`✗ READING-SURFACE LEAK: ledger event ${e.seq} is ${e.eventType}`);
    }
  }
  const [feedSources, feedSettingsRows, searchQueries] = await Promise.all([
    db.feedSource.findMany(),
    db.feedSettings.findMany(),
    db.searchQuery.findMany({ select: { id: true } }),
  ]);
  const readingIds = [
    ...feedSources.map((f) => f.id),
    ...searchQueries.map((s) => s.id),
  ];
  if (readingIds.length > 0) {
    for (const ev of events) {
      const hit = findForbiddenId(ev, readingIds);
      if (hit) {
        feedProblems++;
        console.error(`✗ READING-SURFACE LEAK: id ${hit} in ledger event ${ev.seq}`);
      }
    }
  }
  const validKinds = new Set(["pillar", "domain", "discussion", "circle", "chamber", "poll", "fellow-souls"]);
  for (const source of feedSources) {
    if (!validKinds.has(source.kind) || (source.kind !== "fellow-souls" && !source.refId)) {
      feedProblems++;
      console.error(`✗ FEED SOURCE SHAPE: ${source.id} kind "${source.kind}"`);
    }
  }
  if (feedProblems === 0) {
    console.log(
      `✓ Feed & search privacy (${feedSources.length} source(s), ${feedSettingsRows.length} setting(s), ${searchQueries.length} quer(ies); nothing on the ledger)`
    );
  } else {
    failures += feedProblems;
  }

  // --- 23. Chamber integrity (Phase 7.5).
  let chamberProblems = 0;
  const chambers = await db.chamber.findMany({
    include: {
      members: true,
      invites: true,
      discussions: true,
    },
  });
  const chamberCreatedEvents = new Set<string>();
  for (const ev of events) {
    if (ev.eventType !== "chamber.created") continue;
    try {
      const p = JSON.parse(ev.payload);
      if (typeof p?.chamberRef === "string") chamberCreatedEvents.add(p.chamberRef);
    } catch {
      /* chain check covers bytes */
    }
  }
  // The dual-token signature (NEURAL_POLLINATOR §3): each half is checked
  // on its own, so a chamber paid entirely in one token fails here even
  // when the combined figure looks right.
  //
  // Two settlement paths, two proofs. Platform custody debits internal
  // balances and leaves a PC receipt and a G receipt. Self-custody moves
  // both tokens on chain instead, so it leaves NO internal receipt; its
  // proof is a confirmed dual-leg intent carrying a real transaction hash.
  // Counting them together would let either path hide behind the other.
  const chamberCost: Record<string, number> = {
    PC: await getRail(db, "chamber.creationFeePc"),
    G: await getRail(db, "chamber.creationFeeG"),
  };
  const chamberIds = new Set(chambers.map((c) => c.id));
  const walletChamberDrafts = await db.walletActionDraft.findMany({
    where: { kind: "chamber.create", status: "completed" },
  });
  const walletSettled = new Map<string, string>();
  for (const draft of walletChamberDrafts) {
    if (draft.resultRefId && chamberIds.has(draft.resultRefId)) {
      walletSettled.set(draft.resultRefId, draft.transactionIntentId);
    }
  }
  const platformChamberCount = chambers.length - walletSettled.size;
  for (const currency of ["PC", "G"] as const) {
    const half = economyEntries.filter(
      (e) => e.kind === "fee.chamber" && e.currency === currency
    );
    const paid = half.reduce((sum, entry) => sum + entry.amount, 0);
    const expected = platformChamberCount * chamberCost[currency];
    if (half.length !== platformChamberCount || Math.abs(paid - expected) > 0.000001) {
      chamberProblems++;
      console.error(
        `✗ HALF-PAID CHAMBER: ${platformChamberCount} platform-settled chamber(s) require ${expected}u ${currency} across ${platformChamberCount} entries; the ledger records ${paid}u across ${half.length}. The signature is both halves or neither.`
      );
    }
  }
  for (const [chamberId, intentId] of walletSettled) {
    const intent = await db.tokenTransactionIntent.findUnique({ where: { id: intentId } });
    const bothLegsRatified =
      intent?.kind === "fee.chamber" &&
      intent.currency === "PC" &&
      intent.amount === String(chamberCost.PC) &&
      intent.secondaryCurrency === "G" &&
      intent.secondaryAmount === String(chamberCost.G);
    if (!intent || intent.status !== "confirmed" || !intent.txHash || !bothLegsRatified) {
      chamberProblems++;
      console.error(
        `✗ UNSETTLED WALLET CHAMBER: ${chamberId} claims self-custody settlement, but its intent is not a confirmed on-chain payment of ${chamberCost.PC} PC + ${chamberCost.G} G`
      );
    }
  }
  const workshopDiscussionIds = new Set<string>();
  for (const chamber of chambers) {
    if (!chamberCreatedEvents.has(chamber.id)) {
      chamberProblems++;
      console.error(`✗ OFF-LEDGER CHAMBER: ${chamber.id} has no chamber.created event`);
    }
    const workshops = chamber.discussions.filter((d) => d.chamberId === chamber.id);
    if (workshops.length !== 1) {
      chamberProblems++;
      console.error(`✗ WORKSHOP COUNT: chamber ${chamber.id} has ${workshops.length} workshops`);
    }
    for (const w of workshops) {
      workshopDiscussionIds.add(w.id);
      if (w.permanence !== "deletable") {
        chamberProblems++;
        console.error(`✗ WORKSHOP PERMANENCE: chamber ${chamber.id} workshop is "${w.permanence}"; the drafts are not the record`);
      }
    }
    if (
      !chamber.scaffoldSolving.trim() ||
      !chamber.scaffoldNeedToKnow.trim() ||
      !chamber.scaffoldSuccess.trim() ||
      !chamber.whyCare.trim() ||
      !chamber.pitch.trim()
    ) {
      chamberProblems++;
      console.error(`✗ UNSCAFFOLDED CHAMBER: ${chamber.id} is missing ratified creation requirements`);
    }
    if (!chamber.isPublic) {
      const invited = new Set(chamber.invites.map((i) => i.profileId));
      for (const m of chamber.members) {
        if (m.profileId !== chamber.creatorProfileId && !invited.has(m.profileId)) {
          chamberProblems++;
          console.error(`✗ UNINVITED ENTRY: private chamber ${chamber.id} member ${m.id} was never invited`);
        }
      }
    }
  }
  // Workshop posts: authors entered and each paid the unified cost.
  const workshopPosts = await db.post.findMany({
    where: { discussion: { chamberId: { not: null } } },
    include: { discussion: { select: { chamberId: true } } },
  });
  const memberKey = new Set(
    chambers.flatMap((c) => c.members.map((m) => `${c.id}|${m.profileId}`))
  );
  for (const post of workshopPosts) {
    if (!memberKey.has(`${post.discussion.chamberId}|${post.authorProfileId}`)) {
      chamberProblems++;
      console.error(`✗ INTRUDER DRAFT: workshop post ${post.id} by a soul who never entered`);
    }
  }
  const postCost: Record<string, number> = {
    PC: await getRail(db, "chamber.postFeePc"),
    G: await getRail(db, "chamber.postFeeG"),
  };
  for (const currency of ["PC", "G"] as const) {
    const half = economyEntries.filter(
      (e) => e.kind === "fee.chamber-post" && e.currency === currency
    );
    const paid = half.reduce((sum, entry) => sum + entry.amount, 0);
    const expected = workshopPosts.length * postCost[currency];
    if (half.length !== workshopPosts.length || Math.abs(paid - expected) > 0.000001) {
      chamberProblems++;
      console.error(
        `✗ HALF-PAID WORKSHOP POST: ${workshopPosts.length} post(s) require ${expected}u ${currency} across ${workshopPosts.length} entries; the ledger records ${paid}u across ${half.length}. The signature is both halves or neither.`
      );
    }
  }
  if (chamberProblems === 0) {
    console.log(
      `✓ Chamber integrity (${chambers.length} chamber(s), ${workshopPosts.length} workshop post(s); dual-token costs paid in both halves, scaffolds complete, private entry invite-backed)`
    );
  } else {
    failures += chamberProblems;
  }

  // --- 24. Workshop enclosure; the enter-to-see boundary is structural.
  let enclosureProblems = 0;
  for (const post of workshopPosts) {
    if (lastHashByPost.has(post.id)) {
      enclosureProblems++;
      console.error(`✗ WORKSHOP LEAK: post ${post.id} is hash-committed on the public ledger`);
    }
    if (post.permanentUpgraded) {
      enclosureProblems++;
      console.error(`✗ WORKSHOP PERMANENCE: post ${post.id} was permanence-upgraded`);
    }
  }
  // No enclosed row id; member, invite, workshop discussion; anywhere
  // in the ledger. (The chamber id itself is public: creating a chamber
  // is a civic act; what happens inside is not.)
  const enclosedIds = new Set<string>([
    ...chambers.flatMap((c) => c.members.map((m) => m.id)),
    ...chambers.flatMap((c) => c.invites.map((i) => i.id)),
    ...workshopDiscussionIds,
  ]);
  for (const ev of events) {
    const hit = findForbiddenId(ev, enclosedIds);
    if (hit) {
      enclosureProblems++;
      console.error(`✗ ENCLOSURE LEAK: enclosed chamber id on the ledger at seq ${ev.seq}`);
      break;
    }
  }
  // Entry, invites, and workshop posting all clear the gate PRIVATELY;
  // enforcement must never become an observation channel for who works
  // inside.
  const chamberScopes = await db.gateRequest.findMany({
    where: { status: "CLEARED", scope: { startsWith: "chamber:" } },
    select: { id: true, ledgerRecording: true },
  });
  for (const req of chamberScopes) {
    if (req.ledgerRecording !== "private") {
      enclosureProblems++;
      console.error(`✗ ENCLOSURE LEAK: chamber clearance ${req.id} recorded publicly`);
    }
  }
  const workshopPostScopes = await db.gateRequest.findMany({
    where: { status: "CLEARED", scope: { startsWith: "discussion:" } },
    select: { id: true, scope: true, ledgerRecording: true },
  });
  for (const req of workshopPostScopes) {
    const discussionId = req.scope.split(":")[1];
    if (workshopDiscussionIds.has(discussionId) && req.ledgerRecording !== "private") {
      enclosureProblems++;
      console.error(`✗ ENCLOSURE LEAK: workshop post clearance ${req.id} recorded publicly`);
    }
  }
  if (enclosureProblems === 0) {
    console.log(
      `✓ Workshop enclosure (${workshopPosts.length} draft(s) unleaked, ${chamberScopes.length} chamber clearance(s) private)`
    );
  } else {
    failures += enclosureProblems;
  }

  // --- 25. Ops & counter hygiene (Phase 8; minimal-log discipline)
  let opsProblems = 0;
  const buckets = await db.rateLimitBucket.findMany({
    select: { key: true },
  });
  for (const bucket of buckets) {
    if (!/^[0-9a-f]{64}$/.test(bucket.key)) {
      opsProblems++;
      console.error(
        `✗ COUNTER HYGIENE: rate-limit bucket key is not an HMAC (a raw identifier may have persisted)`
      );
      break;
    }
  }
  const OPS_PAYLOAD_FIELDS: Record<string, Set<string>> = {
    "admin.backup.created": new Set(["operator", "file", "sizeBytes", "retained", "pruned"]),
    "admin.backup.pruned": new Set(["operator", "file"]),
    "admin.backup.drill": new Set(["operator", "file", "ok", "note"]),
    "admin.backup.restored": new Set(["operator", "file"]),
  };
  const opsEvents = events.filter((e) => e.eventType.startsWith("admin."));
  for (const ev of opsEvents) {
    const allowed = OPS_PAYLOAD_FIELDS[ev.eventType];
    if (!allowed) {
      opsProblems++;
      console.error(`✗ OPS LOG: unaudited admin event type ${ev.eventType} at seq ${ev.seq}`);
      continue;
    }
    const payload = JSON.parse(ev.payload) as Record<string, unknown>;
    if (typeof payload.operator !== "string" || !payload.operator) {
      opsProblems++;
      console.error(`✗ OPS LOG: admin event at seq ${ev.seq} lacks operator attribution`);
    }
    for (const field of Object.keys(payload)) {
      if (!allowed.has(field)) {
        opsProblems++;
        console.error(
          `✗ OPS LOG: admin event at seq ${ev.seq} carries unaudited payload field "${field}"`
        );
      }
    }
  }
  if (opsProblems === 0) {
    console.log(
      `✓ Ops & counter hygiene (${buckets.length} bucket key(s) HMAC-shaped, ${opsEvents.length} ops event(s) within their audited payloads)`
    );
  } else {
    failures += opsProblems;
  }

  // --- 26. Analytics discipline (Phase 8; ANALYTICS_SPEC)
  let analyticsProblems = 0;
  const { MEASURED_EVENTS, SUBJECT_KEYED_EVENTS } = await import("../lib/analytics");
  const analyticsEvents = await db.analyticsEvent.findMany({
    select: { id: true, name: true, subjectKey: true, createdAt: true },
  });
  const retentionRail = await db.rail.findUnique({
    where: { key: "analytics.retentionDays" },
  });
  if (!retentionRail) {
    analyticsProblems++;
    console.error(
      "✗ ANALYTICS: rail analytics.retentionDays is not seeded; run db:seed (a missing rail is a build error)"
    );
  }
  const retentionDays = retentionRail?.value ?? 90;
  const crushDeadline = new Date(
    Date.now() - (retentionDays + 7) * 24 * 60 * 60 * 1000
  );
  for (const ev of analyticsEvents) {
    if (!MEASURED_EVENTS.has(ev.name)) {
      analyticsProblems++;
      console.error(`✗ ANALYTICS: unaudited event name "${ev.name}"`);
      break;
    }
  }
  for (const ev of analyticsEvents) {
    if (ev.subjectKey !== null) {
      if (!/^[0-9a-f]{64}$/.test(ev.subjectKey)) {
        analyticsProblems++;
        console.error(`✗ ANALYTICS: subject key is not an HMAC on "${ev.name}"`);
        break;
      }
      if (!SUBJECT_KEYED_EVENTS.has(ev.name)) {
        analyticsProblems++;
        console.error(`✗ ANALYTICS: "${ev.name}" carries a subject key it is not entitled to`);
        break;
      }
    }
  }
  const overdue = analyticsEvents.filter((ev) => ev.createdAt < crushDeadline);
  if (overdue.length) {
    analyticsProblems++;
    console.error(
      `✗ ANALYTICS: ${overdue.length} raw event(s) outlived the ${retentionDays}d retention rail + crush grace; the crush job is not running`
    );
  }
  const analyticsLedgerLeak = events.find((e) =>
    e.eventType.startsWith("analytics")
  );
  if (analyticsLedgerLeak) {
    analyticsProblems++;
    console.error(`✗ ANALYTICS: analytics event type on the public ledger at seq ${analyticsLedgerLeak.seq}`);
  }
  if (analyticsProblems === 0) {
    console.log(
      `✓ Analytics discipline (${analyticsEvents.length} raw event(s) in vocabulary, subject-keying scoped, retention honored, ledger clean)`
    );
  } else {
    failures += analyticsProblems;
  }

  // --- 27. Anchor integrity (Phase 8.6 slice 4; TESTNET_RAILS §3):
  // every ledger.anchored event must point at a real ledger row whose
  // anchorRef carries the same external tx; the public witness and the
  // internal record may never disagree.
  let anchorProblems = 0;
  const anchorEvents = events.filter((e) => e.eventType === "ledger.anchored");
  for (const ev of anchorEvents) {
    const p = JSON.parse(ev.payload) as {
      anchoredSeq?: number;
      headHash?: string;
      txHash?: string;
    };
    if (!p.anchoredSeq || !p.headHash || !p.txHash) {
      anchorProblems++;
      console.error(`✗ ANCHOR: event seq ${ev.seq} is missing anchoredSeq/headHash/txHash`);
      continue;
    }
    const anchored = await db.ledgerEvent.findUnique({
      where: { seq: p.anchoredSeq },
      select: { entryHash: true, anchorRef: true },
    });
    if (!anchored) {
      anchorProblems++;
      console.error(`✗ ANCHOR: event seq ${ev.seq} anchors seq ${p.anchoredSeq}, which does not exist`);
      continue;
    }
    if (anchored.entryHash !== p.headHash) {
      anchorProblems++;
      console.error(
        `✗ ANCHOR: event seq ${ev.seq} claims head hash ${p.headHash.slice(0, 16)}… for seq ${p.anchoredSeq}, but that row's hash is ${anchored.entryHash.slice(0, 16)}…`
      );
    }
    if (anchored.anchorRef !== p.txHash) {
      anchorProblems++;
      console.error(
        `✗ ANCHOR: seq ${p.anchoredSeq}'s anchorRef (${anchored.anchorRef ?? "null"}) does not match the anchor event's tx ${p.txHash}`
      );
    }
  }
  if (anchorProblems === 0) {
    console.log(
      `✓ Anchor integrity (${anchorEvents.length} anchor(s) on the ledger, refs and hashes agree)`
    );
  } else {
    failures += anchorProblems;
  }

  // --- 33. The budgeted-categories must-guardrail (PHASE_8_7_SPEC §3,
  // Slice 1). PLATFORM_CONSTITUTION Appendix A: "The treasury MUST NOT
  // spend outside budgeted categories." TREASURY_DASHBOARD §1.3 promises
  // it is "rendered structurally: an outflow without a budget category
  // cannot exist." This check is what makes that sentence true; the
  // rule is enforced in economy.payFromTreasury(), and pinned here so a
  // future call site that hand-rolls an outflow fails loudly instead of
  // silently reopening the hole.
  const outflows = await db.economyEntry.findMany({ where: { fromTreasury: true } });
  const categories = await db.budgetCategory.findMany();
  const categoryNames = new Set(categories.map((c) => c.name));
  const activeNames = new Set(categories.filter((c) => c.active).map((c) => c.name));
  let budgetProblems = 0;

  for (const entry of outflows) {
    if (!entry.budgetCategory) {
      console.error(
        `✗ Treasury outflow with NO budget category: ${entry.kind} ${entry.amount}${entry.currency} (entry ${entry.id}); the Constitution's must-guardrail says this cannot exist.`
      );
      budgetProblems++;
      continue;
    }
    if (!categoryNames.has(entry.budgetCategory)) {
      console.error(
        `✗ Treasury outflow cites an unknown budget category "${entry.budgetCategory}": ${entry.kind} (entry ${entry.id}).`
      );
      budgetProblems++;
    }
  }

  // The inverse leak: only outflows may carry a category. An inflow or an
  // issuance grant wearing one would corrupt every budget-utilization
  // figure the transparency dashboard derives from this column.
  const miscategorized = await db.economyEntry.findMany({
    where: { fromTreasury: false, NOT: { budgetCategory: null } },
  });
  for (const entry of miscategorized) {
    console.error(
      `✗ Non-outflow carries a budget category: ${entry.kind} → "${entry.budgetCategory}" (entry ${entry.id}). Only treasury spending is budgeted.`
    );
    budgetProblems++;
  }

  // The three TOKENOMICS §3 outflows must exist as categories; if a
  // deploy loses them, payFromTreasury starts refusing moderation
  // rewards, and the moderators simply stop being paid. Fail here, loudly
  // and early, rather than in a badge holder's silent missing stipend.
  for (const required of [
    "moderation-rewards",
    "tribunal-stipends",
    "platform-operations",
    "credit-claim-refunds",
  ]) {
    if (!activeNames.has(required)) {
      console.error(
        `✗ Ratified budget category missing or inactive: "${required}" (TOKENOMICS §3's treasury loop names it).`
      );
      budgetProblems++;
    }
  }

  if (budgetProblems === 0) {
    console.log(
      `✓ Budgeted-categories guardrail (${outflows.length} outflow(s), all categorized; ${categories.length} categor(ies) seeded; no inflow miscategorized)`
    );
  } else {
    failures += budgetProblems;
  }

  if (failures > 0) {
    console.error(`\nVERIFICATION FAILED: ${failures} problem(s).`);
    process.exit(1);
  }
  console.log("\nALL CHECKS PASSED.");
}

main().finally(() => db.$disconnect());
