import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "child_process";
import { createTestDb, REPO_ROOT } from "./helpers/testDb";

const { url } = createTestDb("circles");
process.env.DATABASE_URL = url;
process.env.GATE_OPERATOR_SECRET = "test-secret-for-circle-tests";

import { PrismaClient } from "@prisma/client";
import {
  formCircle,
  editPurpose,
  joinCircle,
  leaveCircle,
  postOffer,
  updateOffer,
  logAction,
  attestAction,
  joinNeedsAliasWarning,
  alignmentPillarsFor,
  circleStatusLabel,
  roomAccess,
  actionEntryHash,
} from "../lib/circles";
import { createPoll, castVote, closeDuePolls, circlePollContentHash } from "../lib/polls";
import { createPost, upgradePostPermanence } from "../lib/discussions";
import { balanceOf } from "../lib/economy";
import { makeOnboardedSoul, topUpForTests } from "./helpers/souls";

const db = new PrismaClient({ datasources: { db: { url } } });

// The cast: founder (True Self), two co-members, and a fourth soul whose
// Alias exercises the small-community warning.
let founderId: string;
let memberAId: string;
let memberBId: string;
let aliasId: string;
let outsiderId: string;
let pillarId: string;

function runVerify() {
  return spawnSync("npx", ["tsx", "scripts/verify.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
}

/** Time-travel a poll to its close: the votes happened well before. */
async function timeTravelClose(pollId: string) {
  await db.ballot.updateMany({
    where: { pollId },
    data: { castAt: new Date(Date.now() - 60_000) },
  });
  await db.poll.update({
    where: { id: pollId },
    data: {
      nominalCloseAt: new Date(Date.now() - 1000),
      trueCloseAt: new Date(Date.now() - 1000),
    },
  });
  await closeDuePolls(db);
}

beforeAll(async () => {
  const seeded = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  if (seeded.status !== 0) throw new Error(`seed failed: ${seeded.stderr}`);

  const s1 = await makeOnboardedSoul(db, { trueSelf: "circle-founder", alias: "cf-shade" });
  const s2 = await makeOnboardedSoul(db, { trueSelf: "circle-member-a", alias: "cma-shade" });
  const s3 = await makeOnboardedSoul(db, { trueSelf: "circle-member-b", alias: "cmb-shade" });
  const s4 = await makeOnboardedSoul(db, { trueSelf: "circle-outsider", alias: "outsider-shade" });
  founderId = s1.trueSelfId;
  memberAId = s2.trueSelfId;
  memberBId = s3.trueSelfId;
  aliasId = s4.aliasId;
  outsiderId = s4.trueSelfId;
  pillarId = (await db.pillar.findFirstOrThrow({ where: { isMeta: false } })).id;

  await topUpForTests(db, founderId, { pc: 200, g: 50 });
  await topUpForTests(db, memberAId, { pc: 50, g: 50 });
  await topUpForTests(db, memberBId, { pc: 50 });
  await topUpForTests(db, aliasId, { pc: 50 });
  await topUpForTests(db, outsiderId, { pc: 50 });
}, 120_000);

afterAll(async () => {
  await db.$disconnect();
});

let circleId: string;

describe("formation (§3)", () => {
  it("requires at least one focus tag", async () => {
    const result = await formCircle(db, {
      profileId: founderId,
      name: "Tagless",
      purpose: "A circle about nothing.",
    });
    expect(result.ok).toBe(false);
  });

  it("charges the 25u rail, creates the room, seats the founder, and hits the ledger", async () => {
    const before = await balanceOf(db, founderId, "PC");
    const result = await formCircle(db, {
      profileId: founderId,
      name: "Fix the Food Bank Gap",
      purpose: "Close the weekend gap in Kelowna's food bank coverage.",
      pillarId,
      placeTag: "Kelowna, BC",
      problem: "the food bank gap",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    circleId = result.circleId;

    const after = await balanceOf(db, founderId, "PC");
    expect(before - after).toBeCloseTo(25 - 1, 0); // 25u fee, ±accrual credit

    const rooms = await db.discussion.findMany({ where: { circleId } });
    expect(rooms).toHaveLength(1);
    expect(rooms[0].permanence).toBe("deletable");

    const members = await db.circleMember.findMany({ where: { circleId, leftAt: null } });
    expect(members.map((m) => m.profileId)).toEqual([founderId]);

    const formed = await db.ledgerEvent.findFirst({ where: { eventType: "circle.formed" } });
    expect(formed).not.toBeNull();
    expect(formed!.payload).toContain("Fix the Food Bank Gap");

    const fee = await db.economyEntry.findFirst({ where: { kind: "fee.circle" } });
    expect(fee?.amount).toBe(25);
  });

  it("the expanded Welcome Grant provides real exploration runway without removing limits", async () => {
    // Verification grants 100 PC. A fresh soul can form several Circles
    // while learning the platform, but the finite grant still runs out.
    const fresh = await makeOnboardedSoul(db, { trueSelf: "fresh-founder", alias: "ff-shade" });
    for (let index = 1; index <= 4; index += 1) {
      const formed = await formCircle(db, {
        profileId: fresh.trueSelfId,
        name: `Welcome Circle ${index}`,
        purpose: "Explore collaboration with the Welcome Grant.",
        problem: `new-user experiment ${index}`,
      });
      expect(formed.ok).toBe(true);
    }
    const fifth = await formCircle(db, {
      profileId: fresh.trueSelfId,
      name: "Beyond the Welcome Runway",
      purpose: "The finite grant still preserves a participation cost.",
      problem: "overreach",
    });
    expect(fifth.ok).toBe(false);
    if (!fifth.ok) expect(fifth.reason).toContain("Insufficient");
  });
});

describe("joining, leaving, the Alias warning (§5)", () => {
  it("members join through the gate; events are public record", async () => {
    for (const id of [memberAId, memberBId]) {
      const result = await joinCircle(db, { circleId, profileId: id });
      expect(result.ok).toBe(true);
    }
    const joins = await db.ledgerEvent.count({
      where: { eventType: "circle.joined", payload: { contains: circleId } },
    });
    expect(joins).toBe(3); // founder + two members
  });

  it("rejects a double join", async () => {
    const result = await joinCircle(db, { circleId, profileId: memberAId });
    expect(result.ok).toBe(false);
  });

  it("warns an Alias joining a small/place-tagged circle; and requires acceptance", async () => {
    expect(await joinNeedsAliasWarning(db, circleId, aliasId)).toBe(true);
    // A True Self never sees it.
    expect(await joinNeedsAliasWarning(db, circleId, outsiderId)).toBe(false);

    const refused = await joinCircle(db, { circleId, profileId: aliasId });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.aliasWarning).toBe(true);

    const accepted = await joinCircle(db, {
      circleId,
      profileId: aliasId,
      acceptedAliasWarning: true,
    });
    expect(accepted.ok).toBe(true);
  });

  it("leaving is one tap and public; rejoining is allowed", async () => {
    const left = await leaveCircle(db, { circleId, profileId: aliasId });
    expect(left.ok).toBe(true);
    expect(await db.ledgerEvent.count({ where: { eventType: "circle.left" } })).toBe(1);

    const rejoin = await joinCircle(db, {
      circleId,
      profileId: aliasId,
      acceptedAliasWarning: true,
    });
    expect(rejoin.ok).toBe(true);
    await leaveCircle(db, { circleId, profileId: aliasId });
  });
});

describe("the members' room (§2.2); reuse, scoped", () => {
  it("members post; outsiders are refused; nothing reaches the ledger", async () => {
    const room = await db.discussion.findFirstOrThrow({ where: { circleId } });
    const eventsBefore = await db.ledgerEvent.count({
      where: { eventType: { in: ["post.recorded", "post.amended"] } },
    });

    const memberPost = await createPost(db, {
      discussionId: room.id,
      profileId: memberAId,
      body: "Saturday plan: meet at the Rutland community centre.",
    });
    expect(memberPost.ok).toBe(true);

    const outsiderPost = await createPost(db, {
      discussionId: room.id,
      profileId: outsiderId,
      body: "I am not a member.",
    });
    expect(outsiderPost.ok).toBe(false);

    const eventsAfter = await db.ledgerEvent.count({
      where: { eventType: { in: ["post.recorded", "post.amended"] } },
    });
    expect(eventsAfter).toBe(eventsBefore); // deletable class: no commits
  });

  it("blocks permanence upgrades in the room; it is not the permanent record (§2.3)", async () => {
    const room = await db.discussion.findFirstOrThrow({ where: { circleId } });
    const post = await db.post.findFirstOrThrow({ where: { discussionId: room.id } });
    await topUpForTests(db, memberAId, { g: 20 });
    const result = await upgradePostPermanence(db, { postId: post.id, profileId: memberAId });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("action log");
  });

  it("room access: members read+write, outsiders neither", async () => {
    const circle = await db.circle.findUniqueOrThrow({ where: { id: circleId } });
    expect(await roomAccess(db, circle, memberAId)).toEqual({ read: true, write: true });
    expect(await roomAccess(db, circle, outsiderId)).toEqual({ read: false, write: false });
  });
});

describe("the resource board (§5)", () => {
  let offerId: string;
  it("members post offers; they are editable and retractable; never on the ledger", async () => {
    const posted = await postOffer(db, {
      circleId,
      profileId: memberBId,
      kind: "tool",
      body: "I have a truck.",
    });
    expect(posted.ok).toBe(true);
    if (posted.ok) offerId = posted.offerId;

    const outsider = await postOffer(db, {
      circleId,
      profileId: outsiderId,
      kind: "time",
      body: "Saturdays.",
    });
    expect(outsider.ok).toBe(false);

    const edited = await updateOffer(db, {
      offerId,
      profileId: memberBId,
      body: "I have a truck and a trailer.",
    });
    expect(edited.ok).toBe(true);

    const notOwner = await updateOffer(db, { offerId, profileId: memberAId, retract: true });
    expect(notOwner.ok).toBe(false);

    // Offer ids never appear on the public ledger.
    const events = await db.ledgerEvent.findMany();
    expect(events.some((e) => `${e.payload}`.includes(offerId))).toBe(false);
  });

  it("a member who leaves can no longer edit or retract their offer", async () => {
    // A fresh Circle so the shared one is undisturbed.
    const host = await formCircle(db, {
      profileId: outsiderId,
      name: "Board Circle",
      purpose: "Testing that offers outlive their owner's membership as record.",
      pillarId,
    });
    if (!host.ok) throw new Error(host.reason);
    const joined = await joinCircle(db, { circleId: host.circleId, profileId: memberBId });
    expect(joined.ok).toBe(true);
    const posted = await postOffer(db, {
      circleId: host.circleId,
      profileId: memberBId,
      kind: "tool",
      body: "A ladder.",
    });
    if (!posted.ok) throw new Error(posted.reason);

    // While still a member, editing their own offer works.
    const okEdit = await updateOffer(db, {
      offerId: posted.offerId,
      profileId: memberBId,
      body: "A tall ladder.",
    });
    expect(okEdit.ok).toBe(true);

    // They leave; the Circle stays open.
    const left = await leaveCircle(db, { circleId: host.circleId, profileId: memberBId });
    expect(left.ok).toBe(true);

    // Now edit and retract are both refused; the offer stands as a record
    // of what was pledged while they were in.
    const blocked = await updateOffer(db, {
      offerId: posted.offerId,
      profileId: memberBId,
      retract: true,
    });
    expect(blocked.ok).toBe(false);
    const offer = await db.resourceOffer.findUniqueOrThrow({ where: { id: posted.offerId } });
    expect(offer.status).not.toBe("retracted");
  });
});

describe("the action log (§6); the heart of the feature", () => {
  let entryId: string;

  it("a member logs an action referencing a pledge; it lands on the ledger hash-committed", async () => {
    const offer = await db.resourceOffer.findFirstOrThrow({ where: { circleId } });
    const result = await logAction(db, {
      circleId,
      profileId: memberAId,
      body: "Delivered 40 hampers to cover the weekend gap.",
      didAt: "Saturday morning",
      place: "downtown Kelowna",
      drewOnOfferIds: [offer.id],
    });
    expect(result.ok).toBe(true);
    if (result.ok) entryId = result.entryId;

    const entry = await db.actionEntry.findUniqueOrThrow({
      where: { id: entryId },
      include: { pledges: true },
    });
    expect(entry.attestedAt).toBeNull();
    expect(entry.pledges).toHaveLength(1);
    expect(entry.pledges[0].body).toContain("truck"); // snapshot

    const logged = await db.ledgerEvent.findFirst({ where: { eventType: "action.logged" } });
    expect(logged).not.toBeNull();
    const payload = JSON.parse(logged!.payload);
    expect(payload.contentHash).toBe(
      actionEntryHash({
        body: entry.body,
        didAt: entry.didAt,
        place: entry.place,
        correctionOfId: entry.correctionOfId,
        pledges: entry.pledges.map((p) => ({ kind: p.kind, body: p.body })),
      })
    );
    // The snapshot became part of the permanent record.
    expect(payload.drewOn[0].body).toContain("truck");
  });

  it("outsiders cannot log; authors cannot attest their own entry", async () => {
    const outsider = await logAction(db, {
      circleId,
      profileId: outsiderId,
      body: "I did something!",
    });
    expect(outsider.ok).toBe(false);

    const selfAttest = await attestAction(db, { entryId, profileId: memberAId });
    expect(selfAttest.ok).toBe(false);
  });

  it("attestations accumulate to the threshold; the entry latches attested; LS credits record", async () => {
    const first = await attestAction(db, { entryId, profileId: memberBId });
    expect(first.ok).toBe(true);
    let entry = await db.actionEntry.findUniqueOrThrow({ where: { id: entryId } });
    expect(entry.attestedAt).toBeNull(); // 1 of 2

    const second = await attestAction(db, { entryId, profileId: founderId });
    expect(second.ok).toBe(true);
    entry = await db.actionEntry.findUniqueOrThrow({ where: { id: entryId } });
    expect(entry.attestedAt).not.toBeNull(); // attested at 2; the rail default

    // One attestation per member, enforced by the gate's per-entry scope.
    const repeat = await attestAction(db, { entryId, profileId: memberBId });
    expect(repeat.ok).toBe(false);

    // Non-members cannot attest.
    const outsider = await attestAction(db, { entryId, profileId: outsiderId });
    expect(outsider.ok).toBe(false);

    // Ledger evidence: two action.attested events.
    expect(await db.ledgerEvent.count({ where: { eventType: "action.attested" } })).toBe(2);

    // Light Score: author credited 5 (rail), each attestor 1, to the
    // circle's pillar; recorded for the Phase 7 engine.
    const credits = await db.lightScoreAdjustment.findMany({
      where: { refId: entryId },
    });
    const author = credits.find((c) => c.profileId === memberAId);
    const attestors = credits.filter((c) => c.refType === "circle-attest");
    expect(author?.amount).toBe(5);
    expect(author?.pillarId).toBe(pillarId);
    expect(attestors.map((a) => a.amount)).toEqual([1, 1]);
  });

  it("the threshold latches exactly once; a late co-signature credits only itself", async () => {
    // Self-contained: author + three members in a fresh Circle.
    const host = await formCircle(db, {
      profileId: memberAId,
      name: "Latch Circle",
      purpose: "Prove the attested latch fires once and counts from the db.",
      pillarId,
    });
    if (!host.ok) throw new Error(host.reason);
    for (const id of [founderId, memberBId, outsiderId]) {
      const j = await joinCircle(db, { circleId: host.circleId, profileId: id });
      expect(j.ok).toBe(true);
    }
    const logged = await logAction(db, {
      circleId: host.circleId,
      profileId: memberAId,
      body: "An action three others will co-sign.",
    });
    if (!logged.ok) throw new Error(logged.reason);
    const eId = logged.entryId;

    // Two attestations reach the threshold (rail default 2) and latch it.
    expect((await attestAction(db, { entryId: eId, profileId: founderId })).ok).toBe(true);
    expect((await attestAction(db, { entryId: eId, profileId: memberBId })).ok).toBe(true);
    const attested = await db.actionEntry.findUniqueOrThrow({ where: { id: eId } });
    expect(attested.attestedAt).not.toBeNull();
    const latchedAt = attested.attestedAt;

    // The author is credited exactly once for the crossing; never twice,
    // which is the double-latch symptom the atomic guard prevents.
    const authorCredits = await db.lightScoreAdjustment.findMany({
      where: { refId: eId, profileId: memberAId, refType: "circle-action" },
    });
    expect(authorCredits).toHaveLength(1);

    // A late, third co-signature: still valid, credits only the attestor,
    // does NOT re-credit the author, and does NOT move the latch timestamp.
    const late = await attestAction(db, { entryId: eId, profileId: outsiderId });
    expect(late.ok).toBe(true);
    const after = await db.actionEntry.findUniqueOrThrow({ where: { id: eId } });
    expect(after.attestedAt).toEqual(latchedAt); // unchanged
    const authorAfter = await db.lightScoreAdjustment.count({
      where: { refId: eId, profileId: memberAId, refType: "circle-action" },
    });
    expect(authorAfter).toBe(1); // still exactly one

    // The ledger's attestorCount is the real db count (3), not a stale
    // snapshot; the third event records three signatures.
    const events = await db.ledgerEvent.findMany({
      where: { eventType: "action.attested" },
      orderBy: { seq: "asc" },
    });
    const mine = events.filter((e) => `${e.payload}`.includes(eId));
    expect(JSON.parse(mine[mine.length - 1].payload).attestorCount).toBe(3);
  });

  it("no edit, no delete; corrections are new entries referencing the old", async () => {
    const correction = await logAction(db, {
      circleId,
      profileId: memberAId,
      body: "Correction: it was 38 hampers, not 40.",
      correctionOfId: entryId,
    });
    expect(correction.ok).toBe(true);

    const crossCircle = await formCircle(db, {
      profileId: founderId,
      name: "Second Circle",
      purpose: "Another purpose entirely.",
      problem: "something else",
    });
    expect(crossCircle.ok).toBe(true);
    if (!crossCircle.ok) return;
    const wrong = await logAction(db, {
      circleId: crossCircle.circleId,
      profileId: founderId,
      body: "Correcting another circle's entry.",
      correctionOfId: entryId,
    });
    expect(wrong.ok).toBe(false);
  });

  it("daily LS credits cap at the rail (10/circle/day)", async () => {
    // Author three more attested entries today; author credits halve
    // (5 → 2.5 → 1.25) under the 10-point cap alongside attest credits.
    for (let i = 0; i < 3; i++) {
      const r = await logAction(db, {
        circleId,
        profileId: memberAId,
        body: `Further verified work, round ${i + 1}.`,
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      await attestAction(db, { entryId: r.entryId, profileId: memberBId });
      await attestAction(db, { entryId: r.entryId, profileId: founderId });
    }
    const entries = await db.actionEntry.findMany({
      where: { circleId },
      select: { id: true },
    });
    const credits = await db.lightScoreAdjustment.findMany({
      where: {
        profileId: memberAId,
        refType: "circle-action",
        refId: { in: entries.map((e) => e.id) },
      },
      orderBy: { createdAt: "asc" },
    });
    const total = credits.reduce((s, c) => s + c.amount, 0);
    expect(total).toBeLessThanOrEqual(10.000001);
    // Diminishing: each authored credit is at most half the previous.
    for (let i = 1; i < credits.length; i++) {
      expect(credits[i].amount).toBeLessThanOrEqual(credits[i - 1].amount / 2 + 1e-9);
    }
  });
});

describe("internal polls (§7); reuse with the sharp rule", () => {
  let pollId: string;

  it("creates a circle-restricted poll: hash-committed, no question text on the ledger", async () => {
    const result = await createPoll(db, {
      profileId: memberAId,
      pillarId,
      title: "Adopt the weekend delivery route?",
      type: "single",
      mode: "pseudonymous",
      options: ["Yes", "No"],
      durationHours: 1,
      circle: { circleId },
    });
    expect(result.ok).toBe(true);
    if (result.ok) pollId = result.pollId;

    const poll = await db.poll.findUniqueOrThrow({ where: { id: pollId } });
    expect(poll.visibilityScope).toBe("circle");
    expect(poll.isGovernance).toBe(false);

    const created = await db.ledgerEvent.findFirst({
      where: { eventType: "poll.created", payload: { contains: pollId } },
    });
    expect(created).not.toBeNull();
    const payload = JSON.parse(created!.payload);
    expect(payload.title).toBeUndefined();
    expect(payload.options).toBeUndefined();
    expect(payload.contentHash).toBe(
      circlePollContentHash("Adopt the weekend delivery route?", ["Yes", "No"])
    );
    expect(`${created!.payload}`).not.toContain("weekend delivery");
  });

  it("outsiders can neither create nor vote in circle polls", async () => {
    const create = await createPoll(db, {
      profileId: outsiderId,
      pillarId,
      title: "Outsider poll",
      type: "single",
      mode: "pseudonymous",
      options: ["A", "B"],
      durationHours: 1,
      circle: { circleId },
    });
    expect(create.ok).toBe(false);

    const poll = await db.poll.findUniqueOrThrow({ where: { id: pollId } });
    const opt = await db.pollOption.findFirstOrThrow({ where: { pollId: poll.id } });
    const vote = await castVote(db, {
      pollId: poll.id,
      profileId: outsiderId,
      optionIds: [opt.id],
    });
    expect(vote.ok).toBe(false);
  });

  it("member votes use per-profile scope; the §7 sharp rule", async () => {
    const opt = await db.pollOption.findFirstOrThrow({
      where: { pollId, position: 1 },
    });
    const vote = await castVote(db, { pollId, profileId: memberBId, optionIds: [opt.id] });
    expect(vote.ok).toBe(true);
    const gateReq = await db.gateRequest.findFirstOrThrow({
      where: { scope: `poll:${pollId}`, profileId: memberBId },
    });
    expect(gateReq.scopeKind).toBe("per-profile");
  });

  it("governance scope is refused inside a circle", async () => {
    const result = await createPoll(db, {
      profileId: memberAId,
      pillarId,
      title: "Circle governance?",
      type: "single",
      mode: "pseudonymous",
      options: ["A", "B"],
      durationHours: 1,
      isGovernance: true,
      circle: { circleId },
    });
    expect(result.ok).toBe(false);
  });

  it("a closed Circle's ballot box is read-only, even mid-window", async () => {
    // A fresh Circle so we don't disturb the shared one. Its founder is a
    // member by construction and opens an internal poll still in its window.
    const fresh = await formCircle(db, {
      profileId: founderId,
      name: "Closing Circle",
      purpose: "A circle that closes while a vote is open.",
      pillarId,
    });
    if (!fresh.ok) throw new Error(fresh.reason);
    const poll = await createPoll(db, {
      profileId: founderId,
      pillarId,
      title: "Decide before we close?",
      type: "single",
      mode: "pseudonymous",
      options: ["Yes", "No"],
      durationHours: 1, // still open
      circle: { circleId: fresh.circleId },
    });
    if (!poll.ok) throw new Error(poll.reason);
    const opt = await db.pollOption.findFirstOrThrow({ where: { pollId: poll.pollId } });

    // The Circle closes while the poll is still inside its window.
    await db.circle.update({ where: { id: fresh.circleId }, data: { status: "closed" } });

    const vote = await castVote(db, {
      pollId: poll.pollId,
      profileId: founderId,
      optionIds: [opt.id],
    });
    expect(vote.ok).toBe(false);
    if (!vote.ok) expect(vote.reason).toContain("closed");
    // No ballot landed.
    const cast = await db.gateRequest.findFirst({
      where: { scope: `poll:${poll.pollId}`, profileId: founderId, status: "CLEARED" },
    });
    expect(cast).toBeNull();
  });
});

describe("stewardship; binding decisions (§7, §8)", () => {
  it("member removal: consensus poll at the circle's bar, executed at close", async () => {
    // Bring the alias back in so there is someone removable.
    await joinCircle(db, { circleId, profileId: aliasId, acceptedAliasWarning: true });
    const aliasHandle = (await db.profile.findUniqueOrThrow({ where: { id: aliasId } })).handle;

    const belowBar = await createPoll(db, {
      profileId: memberAId,
      pillarId,
      title: `Remove @${aliasHandle}?`,
      type: "consensus",
      mode: "pseudonymous",
      options: ["Adopt", "Decline"],
      durationHours: 1,
      consensusThreshold: 0.5, // below the circle's 60% bar
      circle: { circleId, action: `remove-member:${aliasHandle}` },
    });
    expect(belowBar.ok).toBe(false);

    const wrongType = await createPoll(db, {
      profileId: memberAId,
      pillarId,
      title: `Remove @${aliasHandle}?`,
      type: "single",
      mode: "pseudonymous",
      options: ["Adopt", "Decline"],
      durationHours: 1,
      circle: { circleId, action: `remove-member:${aliasHandle}` },
    });
    expect(wrongType.ok).toBe(false);

    const poll = await createPoll(db, {
      profileId: memberAId,
      pillarId,
      title: `Remove @${aliasHandle}?`,
      type: "consensus",
      mode: "pseudonymous",
      options: ["Adopt", "Decline"],
      durationHours: 1,
      consensusThreshold: 0.6,
      circle: { circleId, action: `remove-member:${aliasHandle}` },
    });
    expect(poll.ok).toBe(true);
    if (!poll.ok) return;

    // All three human members adopt.
    for (const voter of [founderId, memberAId, memberBId]) {
      const adopt = await db.pollOption.findFirstOrThrow({
        where: { pollId: poll.pollId, position: 1 },
      });
      const v = await castVote(db, { pollId: poll.pollId, profileId: voter, optionIds: [adopt.id] });
      expect(v.ok).toBe(true);
    }

    // Time-travel the close and run the closer.
    await timeTravelClose(poll.pollId);

    const closed = await db.poll.findUniqueOrThrow({ where: { id: poll.pollId } });
    expect(closed.outcome).toBe("passed");
    const membership = await db.circleMember.findFirst({
      where: { circleId, profileId: aliasId, leftAt: null },
    });
    expect(membership).toBeNull(); // removed
    const removedEvent = await db.ledgerEvent.findFirst({
      where: { eventType: "circle.member-removed" },
    });
    expect(removedEvent).not.toBeNull();
  });

  it("the attestation-threshold dial moves by poll, inside rail bounds", async () => {
    const outOfBounds = await createPoll(db, {
      profileId: founderId,
      pillarId,
      title: "Threshold to 50?",
      type: "consensus",
      mode: "pseudonymous",
      options: ["Adopt", "Decline"],
      durationHours: 1,
      consensusThreshold: 0.6,
      circle: { circleId, action: "set-attestation-threshold:50" },
    });
    expect(outOfBounds.ok).toBe(false);

    const poll = await createPoll(db, {
      profileId: founderId,
      pillarId,
      title: "Threshold to 3?",
      type: "consensus",
      mode: "pseudonymous",
      options: ["Adopt", "Decline"],
      durationHours: 1,
      consensusThreshold: 0.6,
      circle: { circleId, action: "set-attestation-threshold:3" },
    });
    expect(poll.ok).toBe(true);
    if (!poll.ok) return;
    for (const voter of [founderId, memberAId, memberBId]) {
      const adopt = await db.pollOption.findFirstOrThrow({
        where: { pollId: poll.pollId, position: 1 },
      });
      await castVote(db, { pollId: poll.pollId, profileId: voter, optionIds: [adopt.id] });
    }
    await timeTravelClose(poll.pollId);
    const circle = await db.circle.findUniqueOrThrow({ where: { id: circleId } });
    expect(circle.attestationThreshold).toBe(3);
    // Restore the shipped default for later tests.
    await db.circle.update({ where: { id: circleId }, data: { attestationThreshold: 2 } });
  });

  it("a declined decision executes nothing", async () => {
    const memberBHandle = (await db.profile.findUniqueOrThrow({ where: { id: memberBId } })).handle;
    const poll = await createPoll(db, {
      profileId: memberAId,
      pillarId,
      title: `Remove @${memberBHandle}?`,
      type: "consensus",
      mode: "pseudonymous",
      options: ["Adopt", "Decline"],
      durationHours: 1,
      consensusThreshold: 0.6,
      circle: { circleId, action: `remove-member:${memberBHandle}` },
    });
    expect(poll.ok).toBe(true);
    if (!poll.ok) return;
    for (const voter of [founderId, memberAId, memberBId]) {
      const decline = await db.pollOption.findFirstOrThrow({
        where: { pollId: poll.pollId, position: 2 },
      });
      await castVote(db, { pollId: poll.pollId, profileId: voter, optionIds: [decline.id] });
    }
    await timeTravelClose(poll.pollId);
    const membership = await db.circleMember.findFirst({
      where: { circleId, profileId: memberBId, leftAt: null },
    });
    expect(membership).not.toBeNull(); // still a member
  });
});

describe("thin founders (§3.3) & purpose versioning (§2.3)", () => {
  it("only the founder edits the purpose; history is kept", async () => {
    const notFounder = await editPurpose(db, {
      circleId,
      profileId: memberAId,
      purpose: "Rewritten by a member.",
      pillarId,
    });
    expect(notFounder.ok).toBe(false);

    const edit = await editPurpose(db, {
      circleId,
      profileId: founderId,
      purpose: "Close the weekend AND holiday gaps in Kelowna's food bank coverage.",
      pillarId,
      placeTag: "Kelowna, BC",
      problem: "the food bank gap",
    });
    expect(edit.ok).toBe(true);

    const revisions = await db.circlePurposeRevision.findMany({ where: { circleId } });
    expect(revisions).toHaveLength(1);
    expect(revisions[0].purpose).toContain("weekend gap");
    expect(
      await db.ledgerEvent.count({ where: { eventType: "circle.purpose-amended" } })
    ).toBe(1);
  });
});

describe("discovery (§4); transparent alignment", () => {
  it("alignment surfaces the pillar the soul answered in, with its why", async () => {
    const reasons = await alignmentPillarsFor(db, outsiderId);
    // Every onboarded soul answered no seed questions in this suite;
    // answer one now and see the alignment appear.
    const question = await db.question.findFirstOrThrow({
      where: { pillarId, lens: "OUSIA" },
    });
    const { saveSeedAnswer } = await import("../lib/valuesSeed");
    await saveSeedAnswer(db, {
      profileId: outsiderId,
      questionId: question.id,
      body: "What it means to me, at its core.",
    });
    const after = await alignmentPillarsFor(db, outsiderId);
    expect(reasons.has(pillarId)).toBe(false);
    expect(after.has(pillarId)).toBe(true);
    expect(after.get(pillarId)).toContain("values question");
  });
});

describe("lifecycle (§8)", () => {
  it("inactive is a derived, honest, reversible label", async () => {
    const circle = await db.circle.findUniqueOrThrow({ where: { id: circleId } });
    expect(await circleStatusLabel(db, circle)).toBe("active");
    const backdated = {
      ...circle,
      lastActivityAt: new Date(Date.now() - 91 * 86_400_000),
    };
    expect(await circleStatusLabel(db, backdated)).toBe("inactive");
  });

  it("closure is by internal poll only; the record survives; the room goes read-only", async () => {
    const poll = await createPoll(db, {
      profileId: founderId,
      pillarId,
      title: "Close this Circle?",
      type: "consensus",
      mode: "pseudonymous",
      options: ["Adopt", "Decline"],
      durationHours: 1,
      consensusThreshold: 0.6,
      circle: { circleId, action: "close-circle" },
    });
    expect(poll.ok).toBe(true);
    if (!poll.ok) return;
    for (const voter of [founderId, memberAId, memberBId]) {
      const adopt = await db.pollOption.findFirstOrThrow({
        where: { pollId: poll.pollId, position: 1 },
      });
      await castVote(db, { pollId: poll.pollId, profileId: voter, optionIds: [adopt.id] });
    }
    await timeTravelClose(poll.pollId);

    const circle = await db.circle.findUniqueOrThrow({ where: { id: circleId } });
    expect(circle.status).toBe("closed");
    expect(await db.ledgerEvent.count({ where: { eventType: "circle.closed" } })).toBe(1);

    // Not joinable; log closed; room read-only for former members.
    const join = await joinCircle(db, { circleId, profileId: outsiderId });
    expect(join.ok).toBe(false);
    const log = await logAction(db, { circleId, profileId: memberAId, body: "Too late." });
    expect(log.ok).toBe(false);
    const access = await roomAccess(db, circle, memberAId);
    expect(access).toEqual({ read: true, write: false });
    const room = await db.discussion.findFirstOrThrow({ where: { circleId } });
    const post = await createPost(db, {
      discussionId: room.id,
      profileId: memberAId,
      body: "One more word.",
    });
    expect(post.ok).toBe(false);

    // The public record is preserved forever.
    const entries = await db.actionEntry.count({ where: { circleId } });
    expect(entries).toBeGreaterThan(0);
  });
});

describe("db:verify; the Phase 6 invariants hold, and break loudly", () => {
  it("passes on the honest database", () => {
    const result = runVerify();
    expect(result.stdout).toContain("Circle integrity");
    expect(result.stdout).toContain("Members'-room privacy");
    expect(result.stdout).toContain("ALL CHECKS PASSED");
    expect(result.status).toBe(0);
  }, 60_000);

  it("fails loudly when a log entry is silently edited", async () => {
    const entry = await db.actionEntry.findFirstOrThrow({ where: { circleId } });
    const original = entry.body;
    await db.actionEntry.update({
      where: { id: entry.id },
      data: { body: "History, rewritten." },
    });
    const result = runVerify();
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("ACTION LOG ALTERED");
    await db.actionEntry.update({ where: { id: entry.id }, data: { body: original } });
  }, 60_000);

  it("fails loudly on a self-attestation smuggled into the database", async () => {
    const entry = await db.actionEntry.findFirstOrThrow({
      where: { circleId, attestedAt: { not: null } },
    });
    const author = await db.profile.findUniqueOrThrow({ where: { id: entry.authorProfileId } });
    const smuggled = await db.attestation.create({
      data: {
        entryId: entry.id,
        attestorProfileId: entry.authorProfileId,
        attestorHandle: author.handle,
      },
    });
    const result = runVerify();
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("SELF-ATTESTATION");
    await db.attestation.delete({ where: { id: smuggled.id } });
  }, 60_000);
});
