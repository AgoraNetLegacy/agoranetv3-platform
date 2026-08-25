import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "child_process";
import { createTestDb, REPO_ROOT } from "./helpers/testDb";

const { url } = createTestDb("moderation");
process.env.DATABASE_URL = url;
process.env.GATE_OPERATOR_SECRET = "test-secret-for-moderation-tests";

import { PrismaClient } from "@prisma/client";
import { createPost } from "../lib/discussions";
import { fileFlag } from "../lib/flags";
import { balanceOf } from "../lib/economy";
import {
  runModerationSweeps,
  equipBadge,
  caseQueueFor,
  caseFileFor,
  submitRuling,
  reviewSupervisedRuling,
  appealCase,
  submitTribunalRuling,
  acceptRestorative,
  activeStrikeCount,
  seatTribunal,
} from "../lib/moderation";
import { inboxFor } from "../lib/notifications";
import { makeOnboardedSoul, topUpForTests } from "./helpers/souls";

const db = new PrismaClient({ datasources: { db: { url } } });

let author: Awaited<ReturnType<typeof makeOnboardedSoul>>;
let flagger: Awaited<ReturnType<typeof makeOnboardedSoul>>;
let judge: Awaited<ReturnType<typeof makeOnboardedSoul>>;
let discussionId: string;

function runVerify() {
  return spawnSync("npx", ["tsx", "scripts/verify.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
}

async function equipFor(profileId: string) {
  await runModerationSweeps(db);
  let offer = await db.badgeOffer.findFirst({
    where: { profileId, status: "offered", expiresAt: { gt: new Date() } },
  });
  if (!offer) {
    // Sortition is random; the test needs THIS judge; mint the offer
    // directly (the lifecycle rails are covered by the sweep tests).
    offer = await db.badgeOffer.create({
      data: { profileId, expiresAt: new Date(Date.now() + 3_600_000) },
    });
  }
  const equipped = await equipBadge(db, { offerId: offer.id, profileId });
  if (!equipped.ok) throw new Error(equipped.reason);
}

beforeAll(async () => {
  const seeded = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  if (seeded.status !== 0) throw new Error(`seed failed: ${seeded.stderr}`);
  author = await makeOnboardedSoul(db, { trueSelf: "accused-1", alias: "accused-1a" });
  flagger = await makeOnboardedSoul(db, { trueSelf: "flagger-1", alias: "flagger-1a" });
  judge = await makeOnboardedSoul(db, { trueSelf: "judge-1", alias: "judge-1a" });
  discussionId = (
    await db.discussion.findFirstOrThrow({ where: { permanence: "permanent-canonical" } })
  ).id;
  await topUpForTests(db, author.trueSelfId, { pc: 50, g: 20 });
  await topUpForTests(db, flagger.trueSelfId, { pc: 50 });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("the whole road: flag → blur → ruling → tombstone → ladder", () => {
  let postId: string;
  let caseId: string;

  it("a flag blurs the content and opens a case", async () => {
    const posted = await createPost(db, {
      discussionId,
      profileId: author.trueSelfId,
      body: "Allegedly disruptive words.",
    });
    if (!posted.ok) throw new Error(posted.reason);
    postId = posted.postId;

    const flagged = await fileFlag(db, {
      postId,
      profileId: flagger.trueSelfId,
      ruleId: "R1.2",
    });
    expect(flagged.ok).toBe(true);

    const post = await db.post.findUniqueOrThrow({ where: { id: postId } });
    expect(post.status).toBe("blurred"); // blur, don't erase
    const modCase = await db.modCase.findFirstOrThrow({ where: { postId } });
    expect(modCase.heavy).toBe(true); // canonical space = permanent = heavy
    caseId = modCase.id;
  });

  it("the case file is minimal; no handles, no identities", async () => {
    const file = await caseFileFor(db, caseId);
    const text = JSON.stringify(file);
    expect(text).not.toContain("accused-1");
    expect(text).not.toContain("flagger-1");
    expect(text).not.toContain(author.trueSelfId);
    expect(file.content).toContain("Allegedly disruptive");
    expect(file.accusedActiveStrikes).toBe(0);
  });

  it("conflict exclusions keep the author and the flagger off the case", async () => {
    await equipFor(author.trueSelfId);
    await equipFor(flagger.trueSelfId);
    const authorQueue = await caseQueueFor(db, author.trueSelfId);
    expect(authorQueue.map((c) => c.id)).not.toContain(caseId);
    const flaggerQueue = await caseQueueFor(db, flagger.trueSelfId);
    expect(flaggerQueue.map((c) => c.id)).not.toContain(caseId);
  });

  it("heavy cases need three independent rulings; majority resolves with a tombstone", async () => {
    // Three judges (the case sits in a permanent space).
    const judge2 = await makeOnboardedSoul(db, { trueSelf: "judge-2", alias: "judge-2a" });
    const judge3 = await makeOnboardedSoul(db, { trueSelf: "judge-3", alias: "judge-3a" });
    await equipFor(judge.trueSelfId);
    await equipFor(judge2.trueSelfId);
    await equipFor(judge3.trueSelfId);

    for (const j of [judge.trueSelfId, judge2.trueSelfId, judge3.trueSelfId]) {
      const ruled = await submitRuling(db, {
        caseId,
        profileId: j,
        verdict: "uphold",
        citedRuleId: "R1.2",
      });
      expect(ruled.ok).toBe(true);
    }

    const resolved = await db.modCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(resolved.status).toBe("resolved");
    expect(resolved.outcome).toBe("upheld");

    const post = await db.post.findUniqueOrThrow({ where: { id: postId } });
    expect(post.status).toBe("removed"); // the tombstone

    const tombstone = await db.ledgerEvent.findFirst({
      where: { eventType: "content.removed" },
      orderBy: { seq: "desc" },
    });
    expect(JSON.parse(tombstone!.payload).rule).toBe("R1.2");

    // The public resolution is nullifier-keyed; never a handle.
    const resolution = await db.ledgerEvent.findFirst({
      where: { eventType: "case.resolved" },
      orderBy: { seq: "desc" },
    });
    expect(resolution!.payload).not.toContain("judge-1");
    expect(JSON.parse(resolution!.payload).rulings).toHaveLength(3);
  });

  it("the ladder applied itself: strike, penalty, pillar-scoped deduction", async () => {
    expect(await activeStrikeCount(db, author.trueSelfId)).toBe(1);
    const adjustment = await db.lightScoreAdjustment.findFirstOrThrow({
      where: { profileId: author.trueSelfId },
    });
    expect(adjustment.amount).toBeLessThan(0);
    const penalty = await db.economyEntry.findFirst({
      where: { kind: "penalty.strike", fromProfileId: author.trueSelfId },
    });
    expect(penalty).not.toBeNull();
  });

  it("deposits refund on upheld; both parties are notified in the right tier", async () => {
    const refund = await db.economyEntry.findFirst({
      where: { kind: "refund.flag", toProfileId: flagger.trueSelfId },
    });
    expect(refund).not.toBeNull();

    const flaggerInbox = await inboxFor(db, flagger.trueSelfId);
    expect(flaggerInbox.timeSensitive.some((n) => n.category === "ruling")).toBe(true);
    const accusedInbox = await inboxFor(db, author.trueSelfId);
    const ruling = accusedInbox.timeSensitive.find((n) => n.category === "ruling");
    expect(ruling).toBeDefined();
    expect(ruling!.body).toContain("R1.2");
    // The triangle: the accused's notification never names the flagger.
    expect(ruling!.body).not.toContain("flagger-1");
  });

  it("the restorative option reduces the strike and appends the correction", async () => {
    const result = await acceptRestorative(db, {
      caseId,
      profileId: author.trueSelfId,
      correction: "I overstated this; here is the correction.",
    });
    expect(result.ok).toBe(true);
    expect(await activeStrikeCount(db, author.trueSelfId)).toBe(0); // reduced
    const correction = await db.post.findFirst({
      where: { body: { contains: "[Restorative correction]" } },
    });
    expect(correction).not.toBeNull();
  });

  it("one appeal goes to FRESH badge holders; reversal restores and refunds", async () => {
    const before = await balanceOf(db, author.trueSelfId, "PC");
    const appealed = await appealCase(db, { caseId, profileId: author.trueSelfId });
    expect(appealed.ok).toBe(true);
    if (!appealed.ok) return;
    expect(await balanceOf(db, author.trueSelfId, "PC")).toBe(before - 25);

    // A second appeal is refused.
    const again = await appealCase(db, { caseId, profileId: author.trueSelfId });
    expect(again.ok).toBe(false);

    // Fresh eyes: an original ruler cannot touch the appeal.
    const staleAttempt = await submitRuling(db, {
      caseId: appealed.appealCaseId,
      profileId: judge.trueSelfId,
      verdict: "decline",
    });
    expect(staleAttempt.ok).toBe(false);
    if (!staleAttempt.ok) expect(staleAttempt.reason).toContain("Fresh eyes");

    // Three fresh judges decline; the appeal succeeds.
    for (const name of ["fresh-1", "fresh-2", "fresh-3"]) {
      const soul = await makeOnboardedSoul(db, { trueSelf: name, alias: `${name}a` });
      await equipFor(soul.trueSelfId);
      const ruled = await submitRuling(db, {
        caseId: appealed.appealCaseId,
        profileId: soul.trueSelfId,
        verdict: "decline",
      });
      expect(ruled.ok).toBe(true);
    }
    const appealCaseRow = await db.modCase.findUniqueOrThrow({
      where: { id: appealed.appealCaseId },
    });
    expect(appealCaseRow.status).toBe("resolved");
    expect(appealCaseRow.outcome).toBe("declined");

    // Reversal: post restored, deposit refunded.
    const post = await db.post.findUniqueOrThrow({ where: { id: postId } });
    expect(post.status).toBe("visible");
    const refund = await db.economyEntry.findFirst({
      where: { kind: "refund.appeal", toProfileId: author.trueSelfId },
    });
    expect(refund).not.toBeNull();
  });

  it("severe cases route to the Tribunal, seated from badge-completers", async () => {
    const posted = await createPost(db, {
      discussionId,
      profileId: author.trueSelfId,
      body: "Severe-category content for the tribunal lane.",
    });
    if (!posted.ok) throw new Error(posted.reason);
    const flagged = await fileFlag(db, {
      postId: posted.postId,
      profileId: flagger.trueSelfId,
      ruleId: "R3.2", // severe, not expedited
    });
    expect(flagged.ok).toBe(true);
    const severeCase = await db.modCase.findFirstOrThrow({
      where: { postId: posted.postId },
    });
    expect(severeCase.tribunal).toBe(true);

    await seatTribunal(db);
    const seats = await db.tribunalSeat.findMany({ where: { termEnd: { gt: new Date() } } });
    expect(seats.length).toBeGreaterThan(0);

    for (const seat of seats) {
      await submitTribunalRuling(db, {
        caseId: severeCase.id,
        profileId: seat.profileId,
        verdict: "uphold",
        citedRuleId: "R3.2",
      });
    }
    const resolved = await db.modCase.findUniqueOrThrow({ where: { id: severeCase.id } });
    expect(resolved.status).toBe("resolved");
    expect(resolved.outcome).toBe("upheld");
  });

  it("a routine badge holder cannot rule on a Tribunal case (segregation)", async () => {
    // A fresh severe case sits at status "open", tribunal: true; the same
    // shape the routine bench sees, but off-limits to it.
    const posted = await createPost(db, {
      discussionId,
      profileId: author.trueSelfId,
      body: "Severe content a routine judge must not be able to resolve.",
    });
    if (!posted.ok) throw new Error(posted.reason);
    const flagged = await fileFlag(db, {
      postId: posted.postId,
      profileId: flagger.trueSelfId,
      ruleId: "R3.2", // severe → tribunal
    });
    expect(flagged.ok).toBe(true);
    const tribunalCase = await db.modCase.findFirstOrThrow({
      where: { postId: posted.postId },
    });
    expect(tribunalCase.tribunal).toBe(true);
    expect(tribunalCase.status).toBe("open");

    // An ordinary badge holder, not seated on the Tribunal, hand-crafts the
    // case id into the routine ruling path. It must be refused, and the case
    // must remain undecided.
    const outsider = await makeOnboardedSoul(db, {
      trueSelf: "routine-judge",
      alias: "routine-judge-a",
    });
    await equipFor(outsider.trueSelfId);
    const attempt = await submitRuling(db, {
      caseId: tribunalCase.id,
      profileId: outsider.trueSelfId,
      verdict: "decline", // would shield a fraudster if it landed
    });
    expect(attempt.ok).toBe(false);

    const stillOpen = await db.modCase.findUniqueOrThrow({
      where: { id: tribunalCase.id },
    });
    expect(stillOpen.status).toBe("open");
    expect(stillOpen.outcome).toBeNull();
    const rulings = await db.ruling.count({ where: { caseId: tribunalCase.id } });
    expect(rulings).toBe(0); // nothing was recorded
  });

  it("an unqualified soul cannot confirm a pending supervised ruling", async () => {
    // Stand up a routine case with a genuinely pending ruling.
    const posted = await createPost(db, {
      discussionId,
      profileId: author.trueSelfId,
      body: "Content whose ruling is awaiting supervision.",
    });
    if (!posted.ok) throw new Error(posted.reason);
    const flagged = await fileFlag(db, {
      postId: posted.postId,
      profileId: flagger.trueSelfId,
      ruleId: "R1.2",
    });
    expect(flagged.ok).toBe(true);
    const pendingCase = await db.modCase.findFirstOrThrow({
      where: { postId: posted.postId },
    });
    const realJudge = await makeOnboardedSoul(db, {
      trueSelf: "sup-judge",
      alias: "sup-judge-a",
    });
    const pendingRuling = await db.ruling.create({
      data: {
        caseId: pendingCase.id,
        moderatorNullifier: "test-nullifier-pending-review",
        moderatorProfileId: realJudge.trueSelfId,
        verdict: "uphold",
        citedRuleId: "R1.2",
        supervision: "pending",
      },
    });

    // A soul with no badge at all must be refused, and the strike ladder
    // must NOT fire on the accused.
    const strikesBefore = await activeStrikeCount(db, author.trueSelfId);
    const badgeless = await makeOnboardedSoul(db, {
      trueSelf: "no-badge",
      alias: "no-badge-a",
    });
    const attempt = await reviewSupervisedRuling(db, {
      rulingId: pendingRuling.id,
      profileId: badgeless.trueSelfId,
      agree: true,
    });
    expect(attempt.ok).toBe(false);

    const stillPending = await db.ruling.findUniqueOrThrow({
      where: { id: pendingRuling.id },
    });
    expect(stillPending.supervision).toBe("pending"); // untouched
    expect(await activeStrikeCount(db, author.trueSelfId)).toBe(strikesBefore);
  });
});

describe("moderation bootstrap handover", () => {
  it("does not issue community badge offers before the eligible pool is viable", async () => {
    const previous = process.env.MODERATION_COMMUNITY_OFFERS_ENABLED;
    delete process.env.MODERATION_COMMUNITY_OFFERS_ENABLED;
    const offer = await db.badgeOffer.create({
      data: {
        profileId: judge.trueSelfId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await db.notification.create({
      data: {
        profileId: judge.trueSelfId,
        tier: "time-sensitive",
        category: "badge-offer",
        title: "You've been offered a moderation badge",
        body: "Bootstrap test offer",
        refType: "badge-offer",
        refId: offer.id,
      },
    });

    await runModerationSweeps(db);

    expect(
      await db.badgeOffer.count({ where: { id: offer.id, status: "offered" } })
    ).toBe(0);
    expect(
      await db.notification.count({ where: { refType: "badge-offer", refId: offer.id } })
    ).toBe(0);
    if (previous === undefined) delete process.env.MODERATION_COMMUNITY_OFFERS_ENABLED;
    else process.env.MODERATION_COMMUNITY_OFFERS_ENABLED = previous;
  });
});

describe("db:verify over the whole Phase 5 state", () => {
  it("passes on the honest state", () => {
    const result = runVerify();
    expect(result.stdout).toContain("ALL CHECKS PASSED");
    expect(result.status).toBe(0);
  });

  it("fails loudly if content is removed without process", async () => {
    const rogue = await createPost(db, {
      discussionId,
      profileId: flagger.trueSelfId,
      body: "About to vanish without a case.",
    });
    if (!rogue.ok) throw new Error(rogue.reason);
    await db.post.update({ where: { id: rogue.postId }, data: { status: "removed" } });

    const result = runVerify();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain("OFF-PROCESS ACTION");

    await db.post.update({ where: { id: rogue.postId }, data: { status: "visible" } });
  });
});
