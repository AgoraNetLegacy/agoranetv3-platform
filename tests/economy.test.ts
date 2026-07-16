import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "child_process";
import { createTestDb, REPO_ROOT } from "./helpers/testDb";

const { url } = createTestDb("economy");
process.env.DATABASE_URL = url;
process.env.GATE_OPERATOR_SECRET = "test-secret-for-economy-tests";

import { PrismaClient } from "@prisma/client";
import { balanceOf, tip, tipStats, payFromTreasury } from "../lib/economy";
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
  it("charges the reply fee, pays the first-action bonus, and accrues", async () => {
    const before = await balanceOf(db, trueSelfId, "PC");
    const gBefore = await balanceOf(db, trueSelfId, "G");
    const result = await createPost(db, {
      discussionId,
      profileId: trueSelfId,
      body: "A costly word.",
    });
    expect(result.ok).toBe(true);
    // −1 reply fee, +1 participation accrual: a genuine soul's reply is
    // net-free until the daily ceiling saturates — the ratified intent.
    expect(await balanceOf(db, trueSelfId, "PC")).toBe(before - 1 + 1);
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
    // −0.25 fee, +1 accrual (the alias's first qualifying action today).
    expect(await balanceOf(db, aliasId, "PC")).toBe(before - 0.25 + 1);
    const feeEntry = await db.economyEntry.findFirstOrThrow({ where: { kind: "fee.vote" } });
    expect(feeEntry.refId).toBeNull();
  });

  describe("participation accrual", () => {
    it("accrues per qualifying action and saturates at the daily ceiling", async () => {
      const v = await import("../lib/identity").then((m) => m.verifyHumanity(db));
      const soul = await import("../lib/identity").then((m) =>
        m.registerTrueSelf(db, { credential: v.credential, handle: "accruer-1", displayName: "Accruer" })
      );
      if (!soul.ok) throw new Error(soul.reason);
      const { recordAck } = await import("../lib/consent");
      await recordAck(db, { profileId: soul.profileId, kind: "permanence" });
      await recordAck(db, { profileId: soul.profileId, kind: "constitution" });
      await topUpForTests(db, soul.profileId, { pc: 100 });

      // 12 replies: each −1 fee +1 accrual until the 10u/day ceiling,
      // then fees keep collecting but accrual stops.
      for (let i = 0; i < 12; i++) {
        const r = await createPost(db, {
          discussionId,
          profileId: soul.profileId,
          body: `Accruing word ${i}.`,
        });
        expect(r.ok).toBe(true);
      }
      const accrued = await db.economyEntry.findMany({
        where: { toProfileId: soul.profileId, kind: { in: ["accrual", "accrual.streak"] } },
      });
      expect(accrued.reduce((s, e) => s + e.amount, 0)).toBe(10);
    });

    it("pays the streak bonus on the first action of a consecutive day", async () => {
      const soul = await db.profile.findUniqueOrThrow({ where: { handle: "accruer-1" } });
      // Simulate yesterday's presence by backdating today's accrual
      // entries one day (the day rolls over; the streak logic sees them
      // as yesterday's).
      await db.economyEntry.updateMany({
        where: { toProfileId: soul.id, kind: { in: ["accrual", "accrual.streak"] } },
        data: { createdAt: new Date(Date.now() - 86_400_000) },
      });
      const before = await balanceOf(db, soul.id, "PC");
      const r = await createPost(db, {
        discussionId,
        profileId: soul.id,
        body: "Back the next day.",
      });
      expect(r.ok).toBe(true);
      // −1 fee, +1 base accrual, +1 streak bonus.
      expect(await balanceOf(db, soul.id, "PC")).toBe(before - 1 + 1 + 1);
      const streak = await db.economyEntry.count({
        where: { toProfileId: soul.id, kind: "accrual.streak" },
      });
      expect(streak).toBe(1);
    });
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

// PHASE_8_7_SPEC §3, Slice 1. The Constitution's Appendix A carries a
// must-guardrail — "the treasury MUST NOT spend outside budgeted
// categories" — and TREASURY_DASHBOARD §1.3 promises it is "rendered
// structurally: an outflow without a budget category cannot exist."
// These tests are what make those two sentences true rather than
// aspirational.
describe("the budgeted-categories must-guardrail (Constitution, Appendix A)", () => {
  it("seeds exactly the three outflows TOKENOMICS §3's treasury loop names", async () => {
    const categories = await db.budgetCategory.findMany({ orderBy: { name: "asc" } });
    expect(categories.map((c) => c.name)).toEqual([
      "moderation-rewards",
      "platform-operations",
      "tribunal-stipends",
    ]);
    // Uncapped by design: these are service categories whose amounts are
    // already rail-governed per-action. Promoting cap ceilings to Class 2
    // is FUND_INTEGRITY_SPEC §3.6's unratified proposal, not this phase's.
    expect(categories.every((c) => c.cap === null)).toBe(true);
    expect(categories.every((c) => c.active)).toBe(true);
  });

  it("pays through the one door and stamps the category on the entry", async () => {
    const before = await balanceOf(db, trueSelfId, "G");
    const result = await db.$transaction((tx) =>
      payFromTreasury(tx, {
        profileId: trueSelfId,
        currency: "G",
        amount: 3,
        kind: "reward.moderation",
        budgetCategory: "moderation-rewards",
      })
    );
    expect(result.ok).toBe(true);
    expect(await balanceOf(db, trueSelfId, "G")).toBeCloseTo(before + 3, 5);

    const entry = await db.economyEntry.findFirst({
      where: { kind: "reward.moderation", toProfileId: trueSelfId },
      orderBy: { createdAt: "desc" },
    });
    expect(entry?.fromTreasury).toBe(true);
    expect(entry?.budgetCategory).toBe("moderation-rewards");
  });

  it("REFUSES an outflow with no such category — the guardrail, structurally", async () => {
    const before = await balanceOf(db, trueSelfId, "G");
    const result = await db.$transaction((tx) =>
      payFromTreasury(tx, {
        profileId: trueSelfId,
        currency: "G",
        amount: 5,
        kind: "reward.moderation",
        budgetCategory: "slush-fund",
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("budgeted categories");
    // Refused means nothing moved — not a warning, not a log line.
    expect(await balanceOf(db, trueSelfId, "G")).toBeCloseTo(before, 5);
    expect(await db.economyEntry.count({ where: { budgetCategory: "slush-fund" } })).toBe(0);
  });

  it("REFUSES an outflow against a deactivated category", async () => {
    await db.budgetCategory.create({
      data: { name: "retired-category", description: "deactivated by governance", active: false },
    });
    const result = await db.$transaction((tx) =>
      payFromTreasury(tx, {
        profileId: trueSelfId,
        currency: "G",
        amount: 5,
        kind: "reward.moderation",
        budgetCategory: "retired-category",
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("inactive");
    await db.budgetCategory.delete({ where: { name: "retired-category" } });
  });

  it("fails loudly if an outflow ever lands without a category", async () => {
    // Simulates precisely what this slice existed to prevent: a future
    // call site hand-rolling an outflow instead of using the one door.
    const smuggled = await db.economyEntry.create({
      data: {
        kind: "reward.moderation",
        currency: "G",
        amount: 99,
        fromTreasury: true,
        toProfileId: trueSelfId,
      },
    });
    const result = runVerify();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain("Treasury outflow with NO budget category");
    await db.economyEntry.delete({ where: { id: smuggled.id } });
  });

  it("fails loudly if a ratified category goes missing", async () => {
    // A deploy that loses this category doesn't crash — payFromTreasury
    // starts refusing, and moderators quietly stop being paid. Verify is
    // where that surfaces, early and loudly.
    await db.budgetCategory.update({
      where: { name: "tribunal-stipends" },
      data: { active: false },
    });
    const result = runVerify();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain("Ratified budget category missing or inactive");
    await db.budgetCategory.update({
      where: { name: "tribunal-stipends" },
      data: { active: true },
    });
  });

  it("fails loudly if an inflow is miscategorized as budgeted spending", async () => {
    // The inverse leak: a fee wearing a category would corrupt every
    // budget-utilization figure the transparency dashboard derives.
    const smuggled = await db.economyEntry.create({
      data: {
        kind: "fee.reply",
        currency: "PC",
        amount: 1,
        fromProfileId: trueSelfId,
        toTreasury: true,
        budgetCategory: "platform-operations",
      },
    });
    const result = runVerify();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain("Non-outflow carries a budget category");
    await db.economyEntry.delete({ where: { id: smuggled.id } });
  });
});
