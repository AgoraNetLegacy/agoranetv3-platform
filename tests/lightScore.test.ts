// Light Score v3 (Phase 7; LIGHT_SCORE_EXTENSION_SPEC) and the Picture
// repair loop (DASHBOARD §6.5). The invariants under test: per-face,
// per-pillar, never summed (the anti-sum guard THROWS); insight over
// volume (per-discussion cap); members'-room posts never feed standing;
// deductions decay on the strike clock; accepted repairs credit, declined
// ones cost nothing; every change carries a named cause.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "child_process";
import { createTestDb, REPO_ROOT } from "./helpers/testDb";

const { url } = createTestDb("lightscore");
process.env.DATABASE_URL = url;
process.env.GATE_OPERATOR_SECRET = "test-secret-for-lightscore-tests";

import { PrismaClient } from "@prisma/client";
import { scorePillar } from "../lib/score";
import {
  faceConstellation,
  pillarStanding,
  scoreChangeLog,
  ScoreConstellation,
} from "../lib/lightScore";
import { submitRepair, currentPicture, repairStatus } from "../lib/domains";
import { castVote, closeDuePolls, candleCommitmentFor } from "../lib/polls";
import { createPost } from "../lib/discussions";
import { makeOnboardedSoul, topUpForTests } from "./helpers/souls";

const db = new PrismaClient({ datasources: { db: { url } } });

const W = { answer: 5, debatePost: 1, participationCapPerDiscussion: 10 };

let authorId: string;
let voterAId: string;
let voterBId: string;
let compassionId: string;
let hopeId: string;

beforeAll(async () => {
  const seeded = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  if (seeded.status !== 0) throw new Error(`seed failed: ${seeded.stderr}`);

  const a = await makeOnboardedSoul(db, { trueSelf: "aria", alias: "aria-veil" });
  const b = await makeOnboardedSoul(db, { trueSelf: "bram", alias: "bram-veil" });
  const c = await makeOnboardedSoul(db, { trueSelf: "cleo", alias: "cleo-veil" });
  authorId = a.trueSelfId;
  voterAId = b.trueSelfId;
  voterBId = c.trueSelfId;
  for (const id of [authorId, voterAId, voterBId]) {
    await topUpForTests(db, id, { pc: 200, g: 200 });
  }

  compassionId = (await db.pillar.findUniqueOrThrow({ where: { slug: "compassion" } })).id;
  hopeId = (await db.pillar.findUniqueOrThrow({ where: { slug: "hope" } })).id;
}, 120_000);

afterAll(async () => {
  await db.$disconnect();
});

describe("the pure engine (v2 port)", () => {
  it("weights answers over debate and caps participation per discussion", () => {
    const r = scorePillar(
      [
        { discussionId: "d1", answers: 1, debatePosts: 2 }, // 7, under cap
        { discussionId: "d2", answers: 4, debatePosts: 0 }, // 20 → capped to 10
      ],
      W
    );
    expect(r.points).toBe(7 + 10);
    expect(r.lines.find((l) => l.label.includes("cap"))?.points).toBe(-10);
  });

  it("scores nothing for no contributions", () => {
    expect(scorePillar([], W).points).toBe(0);
  });
});

describe("the anti-sum guard", () => {
  it("throws on every route to a universal score", () => {
    const c = new ScoreConstellation([]);
    for (const key of ["total", "sum", "overall", "global", "combined"]) {
      expect(() => (c as never as Record<string, unknown>)[key]).toThrowError(/Anti-sum guard/);
    }
  });
});

describe("the constellation (derivation)", () => {
  it("derives per-pillar standing from public Discussion posts only", async () => {
    const compassionThread = await db.discussion.findFirstOrThrow({
      where: { pillarId: compassionId, questionId: { not: null } },
    });
    const top = await createPost(db, {
      profileId: authorId,
      discussionId: compassionThread.id,
      body: "A substantive answer.",
    });
    expect(top.ok).toBe(true);
    const reply = await createPost(db, {
      profileId: authorId,
      discussionId: compassionThread.id,
      body: "And a debate reply.",
      parentId: top.ok ? top.postId : undefined,
    });
    expect(reply.ok).toBe(true);

    const standing = await pillarStanding(db, authorId, compassionId);
    expect(standing.points).toBe(W.answer + W.debatePost);

    // Hope untouched: per-pillar means per-pillar.
    const hope = await pillarStanding(db, authorId, hopeId);
    expect(hope.points).toBe(0);
  });

  it("counts adjustments while they live and drops them past decay", async () => {
    await db.lightScoreAdjustment.create({
      data: {
        profileId: authorId,
        pillarId: compassionId,
        amount: -8,
        caseId: "case-x",
        decaysAt: new Date(Date.now() + 3_600_000),
      },
    });
    let standing = await pillarStanding(db, authorId, compassionId);
    expect(standing.points).toBe(W.answer + W.debatePost - 8);
    expect(standing.lines.some((l) => l.label.includes("deduction"))).toBe(true);

    // Time passes; the active effect decays, the record remains.
    await db.lightScoreAdjustment.updateMany({
      where: { caseId: "case-x" },
      data: { decaysAt: new Date(Date.now() - 1000) },
    });
    standing = await pillarStanding(db, authorId, compassionId);
    expect(standing.points).toBe(W.answer + W.debatePost);
    expect(await db.lightScoreAdjustment.count({ where: { caseId: "case-x" } })).toBe(1);
  });

  it("never derives standing from members'-room posts", async () => {
    // A circle-scoped discussion in Compassion: posts there are the
    // working conversation, not the record.
    const circle = await db.circle.create({
      data: {
        name: "Quiet Hands",
        purpose: "test",
        pillarId: compassionId,
        founderProfileId: authorId,
        founderHandle: "aria",
      },
    });
    const room = await db.discussion.create({
      data: {
        title: "Members' room; Quiet Hands",
        pillarId: compassionId,
        circleId: circle.id,
        permanence: "deletable",
      },
    });
    await db.circleMember.create({
      data: { circleId: circle.id, profileId: authorId, handle: "aria" },
    });
    const before = (await pillarStanding(db, authorId, compassionId)).points;
    const post = await createPost(db, {
      profileId: authorId,
      discussionId: room.id,
      body: "Room talk.",
    });
    expect(post.ok).toBe(true);
    const after = (await pillarStanding(db, authorId, compassionId)).points;
    expect(after).toBe(before);
  });

  it("credits moderation service per resolved case, quality-gated", async () => {
    const rule = await db.rule.findFirstOrThrow();
    const thread = await db.discussion.findFirstOrThrow({
      where: { pillarId: hopeId, questionId: { not: null } },
    });
    const post = await createPost(db, {
      profileId: voterAId,
      discussionId: thread.id,
      body: "Content that ends up in cases.",
    });
    if (!post.ok) throw new Error("post failed");

    const mkCase = (status: string, supervision: string, n: number) =>
      db.modCase.create({
        data: {
          postId: post.postId,
          ruleId: rule.id,
          tier: 1,
          status,
          rulings: {
            create: {
              moderatorNullifier: `null-${supervision}-${n}`,
              moderatorProfileId: authorId,
              verdict: "decline",
              supervision,
            },
          },
        },
      });
    await mkCase("resolved", "none", 1);
    await mkCase("resolved", "overridden", 2); // quality gate: accrues nothing
    await mkCase("open", "none", 3); // unresolved: accrues nothing

    const standing = await pillarStanding(db, authorId, hopeId);
    expect(standing.points).toBe(1); // one counted case × 1-point rail
    expect(standing.lines.some((l) => l.label.startsWith("Moderation service"))).toBe(true);
  });
});

describe("the Picture repair loop", () => {
  it("walks challenge → governance poll → adoption → revision + credit + named cause", async () => {
    const domain = await db.domain.findFirstOrThrow({
      where: { pillarId: compassionId, position: 1 },
    });
    const v1 = await currentPicture(db, domain.id);
    expect(v1.version).toBe(1);

    const submitted = await submitRepair(db, {
      domainId: domain.id,
      profileId: authorId,
      challenge: "The Picture underweights the role of medical debt collection.",
      proposedText: v1.body + " Amended: collection agencies profit from the debt itself.",
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;

    // One open repair per soul per domain; the structural anti-spam.
    const dup = await submitRepair(db, {
      domainId: domain.id,
      profileId: authorId,
      challenge: "Another thought.",
      proposedText: "Different text.",
    });
    expect(dup.ok).toBe(false);

    // The acceptance poll is a system-opened governance poll in the
    // domain's pillar: sealed, candled, consensus-typed.
    const poll = await db.poll.findUniqueOrThrow({ where: { id: submitted.pollId } });
    expect(poll.isGovernance).toBe(true);
    expect(poll.creatorHandle).toBe("system");
    expect(poll.pillarId).toBe(compassionId);
    expect(poll.candleCommitment).toBeTruthy();

    const status = await repairStatus(db, [domain.id]);
    expect(status.get(domain.id)!.openRepairs).toBe(1);

    for (const voter of [voterAId, voterBId]) {
      const vote = await castVote(db, {
        pollId: poll.id,
        profileId: voter,
        optionIds: [
          (await db.pollOption.findFirstOrThrow({
            where: { pollId: poll.id, position: 1 },
          })).id,
        ],
      });
      expect(vote.ok).toBe(true);
    }

    // Time-travel to close; votes landed before the candle. The candle
    // recommits for the moved moment (the phase-3 pattern).
    const movedClose = new Date(Date.now() - 500);
    await db.poll.update({
      where: { id: poll.id },
      data: {
        nominalCloseAt: new Date(Date.now() - 1000),
        trueCloseAt: movedClose,
        candleCommitment: candleCommitmentFor(movedClose, poll.candleSalt!),
      },
    });
    await db.ballot.updateMany({
      where: { pollId: poll.id },
      data: { castAt: new Date(Date.now() - 10_000) },
    });
    await closeDuePolls(db);

    const repair = await db.pictureRepair.findUniqueOrThrow({
      where: { id: submitted.repairId },
    });
    expect(repair.status).toBe("accepted");

    const v2 = await currentPicture(db, domain.id);
    expect(v2.version).toBe(2);
    expect(v2.repairId).toBe(repair.id);
    expect(v2.body).toContain("collection agencies");

    // The author's standing gained the accepted-repair credit, with its
    // named cause in the owner-visible change log.
    const adj = await db.lightScoreAdjustment.findFirst({
      where: { profileId: authorId, refType: "picture-repair", refId: repair.id },
    });
    expect(adj?.amount).toBe(5);
    const log = await scoreChangeLog(db, authorId);
    expect(log.some((c) => c.cause.startsWith("Accepted repair on"))).toBe(true);

    // The whole story is on the ledger.
    const events = await db.ledgerEvent.findMany({
      where: { eventType: { in: ["repair.submitted", "picture.repaired"] } },
    });
    expect(events).toHaveLength(2);

    const after = await repairStatus(db, [domain.id]);
    expect(after.get(domain.id)!.openRepairs).toBe(0);
    expect(after.get(domain.id)!.lastRepairedAt).toBeTruthy();
  });

  it("declines quietly when consensus fails; honest misses stay safe", async () => {
    const domain = await db.domain.findFirstOrThrow({
      where: { pillarId: hopeId, position: 1 },
    });
    const submitted = await submitRepair(db, {
      domainId: domain.id,
      profileId: voterAId,
      challenge: "A challenge that will not find consensus.",
      proposedText: "A replacement text.",
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;

    // One vote to decline (position 2); Adopt cannot lead.
    const decline = await db.pollOption.findFirstOrThrow({
      where: { pollId: submitted.pollId, position: 2 },
    });
    await castVote(db, { pollId: submitted.pollId, profileId: voterBId, optionIds: [decline.id] });
    const declinePoll = await db.poll.findUniqueOrThrow({ where: { id: submitted.pollId } });
    const movedClose2 = new Date(Date.now() - 500);
    await db.poll.update({
      where: { id: submitted.pollId },
      data: {
        nominalCloseAt: new Date(Date.now() - 1000),
        trueCloseAt: movedClose2,
        candleCommitment: candleCommitmentFor(movedClose2, declinePoll.candleSalt!),
      },
    });
    await db.ballot.updateMany({
      where: { pollId: submitted.pollId },
      data: { castAt: new Date(Date.now() - 10_000) },
    });
    await closeDuePolls(db);

    const repair = await db.pictureRepair.findUniqueOrThrow({
      where: { id: submitted.repairId },
    });
    expect(repair.status).toBe("declined");
    // No revision, no credit, no deduction; nothing.
    expect((await currentPicture(db, domain.id)).version).toBe(1);
    expect(
      await db.lightScoreAdjustment.count({
        where: { profileId: voterAId, refType: "picture-repair" },
      })
    ).toBe(0);
  });
});
