import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "child_process";
import { createTestDb, REPO_ROOT } from "./helpers/testDb";

const { url } = createTestDb("economy");
process.env.DATABASE_URL = url;
process.env.GATE_OPERATOR_SECRET = "test-secret-for-economy-tests";

import { PrismaClient } from "@prisma/client";
import { balanceOf, tip, tipStats } from "../lib/economy";
import { createPost, upgradePostPermanence, createPollDiscussion } from "../lib/discussions";
import { createPoll, castVote } from "../lib/polls";
import { saveSeedAnswer, seedQuestions } from "../lib/valuesSeed";
import { makeOnboardedSoul, topUpForTests } from "./helpers/souls";

const db = new PrismaClient({ datasources: { db: { url } } });

let trueSelfId: string;
let aliasId: string;
let discussionId: string;

function runVerify() {
  return spawnSync("npx", ["tsx", "scripts/verify.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
}

beforeAll(async () => {
  const seeded = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  if (seeded.status !== 0) throw new Error(`seed failed: ${seeded.stderr}`);
  const soul = await makeOnboardedSoul(db, {
    trueSelf: "earner-1",
    alias: "spender-1",
  });
  trueSelfId = soul.trueSelfId;
  aliasId = soul.aliasId;
  discussionId = (await db.discussion.findFirstOrThrow()).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("the Welcome Grant", () => {
  it("funds a new True Self at verification and an Alias at hatch", async () => {
    expect(await balanceOf(db, trueSelfId, "PC")).toBe(25);
    expect(await balanceOf(db, trueSelfId, "G")).toBe(25);
    expect(await balanceOf(db, aliasId, "PC")).toBe(10);
    expect(await balanceOf(db, aliasId, "G")).toBe(10);
  });

  it("pays the values-seed milestone once, at seven answers", async () => {
    const questions = await seedQuestions(db);
    for (const q of questions) {
      await saveSeedAnswer(db, { profileId: trueSelfId, questionId: q.id, body: "An answer." });
    }
    expect(await balanceOf(db, trueSelfId, "PC")).toBe(35);
    // Re-answering never re-grants.
    await saveSeedAnswer(db, { profileId: trueSelfId, questionId: questions[0].id, body: "Edited." });
    expect(await balanceOf(db, trueSelfId, "PC")).toBe(35);
  });
});

describe("fees flow to the treasury", () => {
  it("charges the reply fee and pays the first-action bonus", async () => {
    const before = await balanceOf(db, trueSelfId, "PC");
    const gBefore = await balanceOf(db, trueSelfId, "G");
    const result = await createPost(db, {
      discussionId,
      profileId: trueSelfId,
      body: "A costly word.",
    });
    expect(result.ok).toBe(true);
    expect(await balanceOf(db, trueSelfId, "PC")).toBe(before - 1);
    // First fee-bearing action → +5 G (True Self journey milestone).
    expect(await balanceOf(db, trueSelfId, "G")).toBe(gBefore + 5);
    const treasury = await db.treasuryBalance.findUnique({ where: { currency: "PC" } });
    expect(treasury!.amount).toBeGreaterThanOrEqual(1);
  });

  it("refuses an action the balance cannot cover", async () => {
    const { credential } = await import("../lib/identity").then((m) => m.verifyHumanity(db));
    const broke = await import("../lib/identity").then((m) =>
      m.registerTrueSelf(db, { credential, handle: "broke-soul-9", displayName: "Broke" })
    );
    if (!broke.ok) throw new Error(broke.reason);
    const { recordAck } = await import("../lib/consent");
    await recordAck(db, { profileId: broke.profileId, kind: "permanence" });
    await recordAck(db, { profileId: broke.profileId, kind: "constitution" });
    // Drain: 25 PC grant − two poll creations (10 each) = 5 left; a third fails.
    const pillarId = (await db.pillar.findFirstOrThrow()).id;
    const mk = () =>
      createPoll(db, {
        profileId: broke.profileId,
        pillarId,
        title: "Spend",
        type: "single",
        mode: "pseudonymous",
        options: ["A", "B"],
        durationHours: 2,
      });
    expect((await mk()).ok).toBe(true);
    expect((await mk()).ok).toBe(true);
    const third = await mk();
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.reason).toContain("Insufficient PollCoin");
  });

  it("votes cost the micro-fee, and the fee entry never names the poll", async () => {
    const pillarId = (await db.pillar.findFirstOrThrow()).id;
    const poll = await createPoll(db, {
      profileId: trueSelfId,
      pillarId,
      title: "Fee check",
      type: "single",
      mode: "pseudonymous",
      options: ["A", "B"],
      durationHours: 2,
    });
    if (!poll.ok) throw new Error(poll.reason);
    const option = await db.pollOption.findFirstOrThrow({ where: { pollId: poll.pollId } });
    const before = await balanceOf(db, aliasId, "PC");
    const vote = await castVote(db, { pollId: poll.pollId, profileId: aliasId, optionIds: [option.id] });
    expect(vote.ok).toBe(true);
    expect(await balanceOf(db, aliasId, "PC")).toBe(before - 0.25);
    const feeEntry = await db.economyEntry.findFirstOrThrow({ where: { kind: "fee.vote" } });
    expect(feeEntry.refId).toBeNull();
  });
});

describe("tips", () => {
  it("moves Gratium with the treasury micro-cut, tracks breadth not names", async () => {
    const post = await db.post.findFirstOrThrow({ where: { authorProfileId: trueSelfId } });
    await topUpForTests(db, aliasId, { g: 10 });
    const authorBefore = await balanceOf(db, trueSelfId, "G");
    const tipperBefore = await balanceOf(db, aliasId, "G");

    const result = await tip(db, { postId: post.id, tipperProfileId: aliasId, amount: 2 });
    expect(result.ok).toBe(true);

    expect(await balanceOf(db, aliasId, "G")).toBe(tipperBefore - 2);
    expect(await balanceOf(db, trueSelfId, "G")).toBe(authorBefore + 1.9); // 5% cut
    const stats = await tipStats(db, post.id);
    expect(stats.total).toBe(2);
    expect(stats.uniqueTippers).toBe(1);
  });

  it("refuses self-tipping", async () => {
    const post = await db.post.findFirstOrThrow({ where: { authorProfileId: trueSelfId } });
    const result = await tip(db, { postId: post.id, tipperProfileId: trueSelfId, amount: 1 });
    expect(result.ok).toBe(false);
  });
});

describe("paid permanence", () => {
  it("upgrades an own post in a deletable space and hash-commits it", async () => {
    // Build a deletable space via an ordinary poll's context Discussion.
    const pillarId = (await db.pillar.findFirstOrThrow()).id;
    const poll = await createPoll(db, {
      profileId: trueSelfId, pillarId, title: "Context host", type: "single",
      mode: "pseudonymous", options: ["A", "B"], durationHours: 2,
    });
    if (!poll.ok) throw new Error(poll.reason);
    const context = await createPollDiscussion(db, { pollId: poll.pollId, profileId: trueSelfId });
    if (!context.ok) throw new Error(context.reason);

    const posted = await createPost(db, {
      discussionId: context.postId,
      profileId: trueSelfId,
      body: "Worth keeping forever.",
    });
    if (!posted.ok) throw new Error(posted.reason);
    // Deletable space: no post.recorded event yet.
    const eventsBefore = await db.ledgerEvent.count({ where: { eventType: "post.recorded" } });

    await topUpForTests(db, trueSelfId, { g: 20 });
    const upgraded = await upgradePostPermanence(db, { postId: posted.postId, profileId: trueSelfId });
    expect(upgraded.ok).toBe(true);
    expect(await db.ledgerEvent.count({ where: { eventType: "post.recorded" } })).toBe(eventsBefore + 1);

    const again = await upgradePostPermanence(db, { postId: posted.postId, profileId: trueSelfId });
    expect(again.ok).toBe(false);

    // Not the author → refused.
    const foreign = await upgradePostPermanence(db, { postId: posted.postId, profileId: aliasId });
    expect(foreign.ok).toBe(false);
  });
});

describe("attestation & sources", () => {
  it("records the human-made mark and a vouched shared source object", async () => {
    const posted = await createPost(db, {
      discussionId,
      profileId: trueSelfId,
      body: "Sourced and signed.",
      humanMade: true,
      source: { url: "https://example.org/study", kind: "study", vouch: "vouched" },
    });
    expect(posted.ok).toBe(true);
    if (!posted.ok) return;
    const post = await db.post.findUniqueOrThrow({
      where: { id: posted.postId },
      include: { sources: { include: { source: true } } },
    });
    expect(post.humanMade).toBe(true);
    expect(post.sources[0].vouch).toBe("vouched");

    // One source, one object: a second citation reuses it.
    const again = await createPost(db, {
      discussionId,
      profileId: aliasId,
      body: "Citing the same study.",
      source: { url: "https://example.org/study", kind: "study", vouch: "unverified" },
    });
    expect(again.ok).toBe(true);
    expect(await db.sourceObject.count({ where: { url: "https://example.org/study" } })).toBe(1);
    const usages = await db.postSource.count({
      where: { source: { url: "https://example.org/study" } },
    });
    expect(usages).toBe(2);
  });
});

describe("db:verify conservation", () => {
  it("passes on the honest state", () => {
    const result = runVerify();
    expect(result.stdout).toContain("ALL CHECKS PASSED");
    expect(result.status).toBe(0);
  });

  it("fails loudly when a balance is inflated out of thin air", async () => {
    await db.balance.update({
      where: { profileId_currency: { profileId: trueSelfId, currency: "PC" } },
      data: { amount: { increment: 1000 } },
    });
    const result = runVerify();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain("CONSERVATION BROKEN");
    await db.balance.update({
      where: { profileId_currency: { profileId: trueSelfId, currency: "PC" } },
      data: { amount: { decrement: 1000 } },
    });
  });
});
