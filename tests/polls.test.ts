import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "child_process";
import { createTestDb, REPO_ROOT } from "./helpers/testDb";

const { url } = createTestDb("polls");
process.env.DATABASE_URL = url;
process.env.GATE_OPERATOR_SECRET = "test-secret-for-poll-tests";

import { PrismaClient } from "@prisma/client";
import {
  createPoll,
  castVote,
  closeDuePolls,
  visibleTally,
  candleCommitmentFor,
} from "../lib/polls";
import { makeOnboardedSoul, topUpForTests } from "./helpers/souls";

const db = new PrismaClient({ datasources: { db: { url } } });

let trueSelfId: string;
let aliasId: string;
let pillarId: string;

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
    trueSelf: "voter-prime-1",
    alias: "voter-shade-1",
  });
  trueSelfId = soul.trueSelfId;
  aliasId = soul.aliasId;
  pillarId = (await db.pillar.findFirstOrThrow()).id;
  // Poll creation costs 10 PC each; this suite makes several.
  await topUpForTests(db, trueSelfId, { pc: 100 });
  await topUpForTests(db, aliasId, { pc: 20 });
});

afterAll(async () => {
  await db.$disconnect();
});

async function makePoll(overrides: Partial<Parameters<typeof createPoll>[1]> = {}) {
  const result = await createPoll(db, {
    profileId: trueSelfId,
    pillarId,
    title: "Test question?",
    type: "single",
    mode: "pseudonymous",
    options: ["Yes", "No"],
    durationHours: 24,
    ...overrides,
  });
  if (!result.ok) throw new Error(result.reason);
  return db.poll.findUniqueOrThrow({
    where: { id: result.pollId },
    include: { options: { orderBy: { position: "asc" } } },
  });
}

describe("voting through the gate", () => {
  it("one vote per profile — a second attempt is refused privately", async () => {
    const poll = await makePoll({ title: "One voice each?" });
    const eventsBefore = await db.ledgerEvent.count();

    const first = await castVote(db, {
      pollId: poll.id,
      profileId: trueSelfId,
      optionIds: [poll.options[0].id],
    });
    expect(first.ok).toBe(true);

    const second = await castVote(db, {
      pollId: poll.id,
      profileId: trueSelfId,
      optionIds: [poll.options[1].id],
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toContain("already voted");

    // Sealed means sealed: no ledger movement from voting.
    expect(await db.ledgerEvent.count()).toBe(eventsBefore);

    // Each face is an independent voice (ratified per-profile).
    const alias = await castVote(db, {
      pollId: poll.id,
      profileId: aliasId,
      optionIds: [poll.options[1].id],
    });
    expect(alias.ok).toBe(true);
  });

  it("keeps the tally sealed while open, then reveals at close", async () => {
    const poll = await makePoll({ title: "Sealed?" });
    await castVote(db, { pollId: poll.id, profileId: trueSelfId, optionIds: [poll.options[0].id] });

    expect(await visibleTally(db, poll.id)).toBeNull();

    // Time-travel: the vote happened well before the close.
    await db.ballot.updateMany({
      where: { pollId: poll.id },
      data: { castAt: new Date(Date.now() - 60_000) },
    });
    await db.poll.update({
      where: { id: poll.id },
      data: {
        nominalCloseAt: new Date(Date.now() - 1000),
        trueCloseAt: new Date(Date.now() - 1000),
      },
    });
    await closeDuePolls(db);

    const tally = await visibleTally(db, poll.id);
    expect(tally).not.toBeNull();
    expect(tally!.get(poll.options[0].id)).toBe(1);

    const closedEvent = await db.ledgerEvent.findFirst({
      where: { eventType: "poll.closed" },
      orderBy: { seq: "desc" },
    });
    expect(JSON.parse(closedEvent!.payload).pollRef).toBe(poll.id);
  });

  it("pseudonymous ballots carry no profile; public ballots reach the ledger only after close", async () => {
    const pseudo = await makePoll({ title: "Pseudonymous check" });
    await castVote(db, { pollId: pseudo.id, profileId: trueSelfId, optionIds: [pseudo.options[0].id] });
    const pBallot = await db.ballot.findFirstOrThrow({ where: { pollId: pseudo.id } });
    expect(pBallot.voterProfileId).toBeNull();
    expect(pBallot.voterHandle).toBeNull();

    const pub = await makePoll({ title: "Public check", mode: "public" });
    await castVote(db, { pollId: pub.id, profileId: trueSelfId, optionIds: [pub.options[0].id] });
    const pubBallot = await db.ballot.findFirstOrThrow({ where: { pollId: pub.id } });
    expect(pubBallot.voterHandle).toBe("voter-prime-1");

    expect(await db.ledgerEvent.count({ where: { eventType: "vote.recorded" } })).toBe(0);
    await db.ballot.updateMany({
      where: { pollId: pub.id },
      data: { castAt: new Date(Date.now() - 60_000) },
    });
    await db.poll.update({
      where: { id: pub.id },
      data: { nominalCloseAt: new Date(Date.now() - 1000), trueCloseAt: new Date(Date.now() - 1000) },
    });
    await closeDuePolls(db);

    const votes = await db.ledgerEvent.findMany({ where: { eventType: "vote.recorded" } });
    expect(votes).toHaveLength(1);
    expect(JSON.parse(votes[0].payload).handle).toBe("voter-prime-1");
  });
});

describe("the candle close (governance)", () => {
  it("commits the true close in advance, reveals verifiably, and discards late ballots", async () => {
    const poll = await makePoll({ title: "Governance question", isGovernance: true, durationHours: 10 });
    expect(poll.isGovernance).toBe(true);
    expect(poll.liveTally).toBe(false);
    expect(poll.candleCommitment).toMatch(/^[a-f0-9]{64}$/);

    // The commitment was published at creation, before any vote.
    const created = await db.ledgerEvent.findFirst({
      where: { eventType: "poll.created" },
      orderBy: { seq: "desc" },
    });
    expect(JSON.parse(created!.payload).candleCommitment).toBe(poll.candleCommitment);

    // True close inside the final stretch.
    expect(poll.trueCloseAt.getTime()).toBeLessThanOrEqual(poll.nominalCloseAt.getTime());
    expect(poll.trueCloseAt.getTime()).toBeGreaterThan(poll.createdAt.getTime());

    // One vote before the candle moment, one after (the sniper).
    await castVote(db, { pollId: poll.id, profileId: trueSelfId, optionIds: [poll.options[0].id] });
    await castVote(db, { pollId: poll.id, profileId: aliasId, optionIds: [poll.options[1].id] });
    // Time-travel: candle burned out two minutes ago; the alias's ballot
    // "arrived" after it, inside the still-open nominal window.
    const now = Date.now();
    await db.poll.update({
      where: { id: poll.id },
      data: { nominalCloseAt: new Date(now - 1000), trueCloseAt: new Date(now - 120_000) },
    });
    await db.ballot.updateMany({
      where: { pollId: poll.id, voterProfileId: null, voterHandle: null },
      data: {},
    });
    const ballots = await db.ballot.findMany({ where: { pollId: poll.id }, orderBy: { castAt: "asc" } });
    await db.ballot.update({ where: { id: ballots[0].id }, data: { castAt: new Date(now - 240_000) } });
    await db.ballot.update({ where: { id: ballots[1].id }, data: { castAt: new Date(now - 60_000) } });

    // Recompute the commitment so the time-travel stays verifiable.
    const salt = (await db.poll.findUniqueOrThrow({ where: { id: poll.id } })).candleSalt!;
    await db.poll.update({
      where: { id: poll.id },
      data: { candleCommitment: candleCommitmentFor(new Date(now - 120_000), salt) },
    });

    await closeDuePolls(db);

    const closed = await db.ledgerEvent.findFirst({
      where: { eventType: "poll.closed" },
      orderBy: { seq: "desc" },
    });
    const payload = JSON.parse(closed!.payload);
    expect(payload.countedBallots).toBe(1);
    expect(payload.lateBallots).toBe(1);
    expect(payload.candleReveal.salt).toBe(salt);

    const counted = await db.ballot.findMany({ where: { pollId: poll.id, counted: true } });
    expect(counted).toHaveLength(1);
  });
});

describe("consensus polls", () => {
  it("passes at threshold, and offers (never forces) a Discussion below it", async () => {
    const poll = await makePoll({
      title: "Do we agree?",
      type: "consensus",
      consensusThreshold: 0.6,
    });
    // 1 of 2 counted ballots for the leading option = 50% < 60%.
    await castVote(db, { pollId: poll.id, profileId: trueSelfId, optionIds: [poll.options[0].id] });
    await castVote(db, { pollId: poll.id, profileId: aliasId, optionIds: [poll.options[1].id] });
    await db.ballot.updateMany({
      where: { pollId: poll.id },
      data: { castAt: new Date(Date.now() - 60_000) },
    });
    await db.poll.update({
      where: { id: poll.id },
      data: { nominalCloseAt: new Date(Date.now() - 1000), trueCloseAt: new Date(Date.now() - 1000) },
    });
    await closeDuePolls(db);
    const failed = await db.poll.findUniqueOrThrow({ where: { id: poll.id } });
    expect(failed.outcome).toBe("no-consensus");
    // No Discussion was auto-created — prompted, never automatic.
    expect(await db.discussion.count({ where: { pollId: poll.id } })).toBe(0);
  });
});

describe("db:verify over the whole Phase 3 state", () => {
  it("passes on the honest state", () => {
    const result = runVerify();
    expect(result.stdout).toContain("ALL CHECKS PASSED");
    expect(result.status).toBe(0);
  });

  it("fails loudly when a closed poll's ballots are altered", async () => {
    const poll = await db.poll.findFirstOrThrow({
      where: { status: "closed", mode: "pseudonymous" },
      include: { ballots: true },
    });
    const victim = poll.ballots[0];
    const originalNullifier = victim.nullifier;
    await db.ballot.update({
      where: { id: victim.id },
      data: { nullifier: "f".repeat(64) },
    });

    const result = runVerify();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain("BALLOTS ALTERED");

    await db.ballot.update({
      where: { id: victim.id },
      data: { nullifier: originalNullifier },
    });
  });
});
