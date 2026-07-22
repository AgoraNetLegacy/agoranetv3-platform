import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "child_process";
import { createTestDb, REPO_ROOT } from "./helpers/testDb";

const { url } = createTestDb("saved");
process.env.DATABASE_URL = url;
process.env.GATE_OPERATOR_SECRET = "test-secret-for-saved-tests";

import { PrismaClient } from "@prisma/client";
import {
  saveDiscussion,
  unsaveDiscussion,
  isSaved,
  touchSavedWatermark,
  savedThreadsFor,
  stirringSavesFor,
} from "../lib/saved";
import { createPost } from "../lib/discussions";
import { makeOnboardedSoul, topUpForTests } from "./helpers/souls";

const db = new PrismaClient({ datasources: { db: { url } } });

let saverId: string; // the face doing the saving
let otherId: string; // an unrelated face — must never see the saves
let discussionId: string;

beforeAll(async () => {
  const seeded = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  if (seeded.status !== 0) throw new Error(`seed failed: ${seeded.stderr}`);

  const saver = await makeOnboardedSoul(db, {
    trueSelf: "saver-soul",
    alias: "saver-shade",
  });
  const other = await makeOnboardedSoul(db, {
    trueSelf: "other-soul",
    alias: "other-shade",
  });
  saverId = saver.trueSelfId;
  otherId = other.trueSelfId;
  await topUpForTests(db, otherId, { pc: 100 });

  const discussion = await db.discussion.findFirstOrThrow({
    where: { permanence: "permanent-canonical" },
  });
  discussionId = discussion.id;
}, 60_000);

afterAll(async () => {
  await db.$disconnect();
});

describe("the save", () => {
  it("saves idempotently, reports state, and unsaves totally", async () => {
    expect(await isSaved(db, { profileId: saverId, discussionId })).toBe(false);

    const first = await saveDiscussion(db, { profileId: saverId, discussionId });
    expect(first.ok).toBe(true);
    const again = await saveDiscussion(db, { profileId: saverId, discussionId });
    expect(again.ok).toBe(true); // saving twice is never an error
    expect(await isSaved(db, { profileId: saverId, discussionId })).toBe(true);

    await unsaveDiscussion(db, { profileId: saverId, discussionId });
    expect(await isSaved(db, { profileId: saverId, discussionId })).toBe(false);
    // Total: no tombstone row survives.
    const rows = await db.savedDiscussion.findMany({ where: { profileId: saverId } });
    expect(rows.length).toBe(0);
  });

  it("refuses a save on a nonexistent discussion", async () => {
    const result = await saveDiscussion(db, {
      profileId: saverId,
      discussionId: "no-such-thread",
    });
    expect(result.ok).toBe(false);
  });

  it("keeps saves strictly per-face — the privacy boundary", async () => {
    await saveDiscussion(db, { profileId: saverId, discussionId });

    const mine = await savedThreadsFor(db, saverId);
    const theirs = await savedThreadsFor(db, otherId);
    expect(mine.length).toBe(1);
    expect(theirs.length).toBe(0);
    expect(await isSaved(db, { profileId: otherId, discussionId })).toBe(false);
  });

  it("scopes the per-pillar lens to the pillar", async () => {
    const discussion = await db.discussion.findUniqueOrThrow({
      where: { id: discussionId },
      select: { pillarId: true },
    });
    const inPillar = await savedThreadsFor(db, saverId, {
      pillarId: discussion.pillarId,
    });
    expect(inPillar.length).toBe(1);
    const elsewhere = await savedThreadsFor(db, saverId, {
      pillarId: "no-such-pillar",
    });
    expect(elsewhere.length).toBe(0);
  });
});

describe("the memory current (resurfacing)", () => {
  it("stirs only on new activity after the watermark, and settles when read", async () => {
    // Freshly watermarked: nothing new yet.
    await touchSavedWatermark(db, { profileId: saverId, discussionId });
    let stirring = await stirringSavesFor(db, saverId);
    expect(stirring.length).toBe(0);

    // Another soul posts — the saved thread has stirred.
    const posted = await createPost(db, {
      discussionId,
      profileId: otherId,
      body: "New voice after the watermark — the thread stirs.",
    });
    expect(posted.ok).toBe(true);

    stirring = await stirringSavesFor(db, saverId);
    expect(stirring.length).toBe(1);
    expect(stirring[0].newPosts).toBeGreaterThanOrEqual(1);
    expect(stirring[0].newVoices).toBeGreaterThanOrEqual(1);
    expect(stirring[0].discussion.id).toBe(discussionId);

    // The other face has no saves — nothing stirs for them.
    expect((await stirringSavesFor(db, otherId)).length).toBe(0);

    // Reading advances the watermark; the current settles.
    await touchSavedWatermark(db, { profileId: saverId, discussionId });
    stirring = await stirringSavesFor(db, saverId);
    expect(stirring.length).toBe(0);
  });
});

describe("enclosed-room access (privacy audit 2026-07-22)", () => {
  it("refuses to save an enclosed room the face doesn't belong to", async () => {
    // A circle-scoped discussion the saver is not a member of.
    const circle = await db.circle.findFirst({ where: { status: "active" } });
    if (!circle) return; // seed has circles; skip defensively
    const room = await db.discussion.findFirst({
      where: { circleId: circle.id },
      select: { id: true },
    });
    if (!room) return;
    const result = await saveDiscussion(db, {
      profileId: saverId,
      discussionId: room.id,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("can't be saved");
  });
});
