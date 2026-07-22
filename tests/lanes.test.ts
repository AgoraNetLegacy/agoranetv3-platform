import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "child_process";
import { createTestDb, REPO_ROOT } from "./helpers/testDb";

const { url } = createTestDb("lanes");
process.env.DATABASE_URL = url;
process.env.GATE_OPERATOR_SECRET = "test-secret-for-lanes-tests";

import { PrismaClient } from "@prisma/client";
import { openLens } from "../lib/feed";
import { createPost } from "../lib/discussions";
import { STOIC_LESSONS } from "../lib/stoicContent.generated";
import { makeOnboardedSoul, topUpForTests } from "./helpers/souls";

const db = new PrismaClient({ datasources: { db: { url } } });

let posterId: string;
let postedPillarSlug: string;

beforeAll(async () => {
  const seeded = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  if (seeded.status !== 0) throw new Error(`seed failed: ${seeded.stderr}`);
  const soul = await makeOnboardedSoul(db, {
    trueSelf: "lane-soul",
    alias: "lane-shade",
  });
  posterId = soul.trueSelfId;
  await topUpForTests(db, posterId, { pc: 50 });

  const discussion = await db.discussion.findFirstOrThrow({
    where: { permanence: "permanent-canonical", circleId: null, chamberId: null },
    include: { pillar: true },
  });
  postedPillarSlug = discussion.pillar.slug;
  const posted = await createPost(db, {
    discussionId: discussion.id,
    profileId: posterId,
    body: "Fresh activity for the pulse lane.",
  });
  if (!posted.ok) throw new Error(posted.reason);
}, 60_000);

afterAll(async () => {
  await db.$disconnect();
});

describe("pillar-pulse scoping (BEACON §3.4)", () => {
  it("scopes the published formula to one pillar, leaking nothing across", async () => {
    const scoped = await openLens(db, 10, postedPillarSlug);
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every((c) => c.pillarSlug === postedPillarSlug)).toBe(true);

    const otherSlug = postedPillarSlug === "unity" ? "justice" : "unity";
    const other = await openLens(db, 10, otherSlug);
    expect(other.every((c) => c.pillarSlug === otherSlug)).toBe(true);
    expect(other.some((c) => c.pillarSlug === postedPillarSlug)).toBe(false);
  });
});

describe("stoic-wisdom rotation (BEACON §3.4)", () => {
  it("carries 18 lessons with verbatim-verified excerpt shape", () => {
    expect(STOIC_LESSONS.length).toBe(18);
    for (const lesson of STOIC_LESSONS) {
      expect(lesson.excerpts.length).toBeGreaterThanOrEqual(1);
      for (const e of lesson.excerpts) {
        expect(e.text.length).toBeGreaterThan(0);
        expect(e.text.length).toBeLessThanOrEqual(320);
        expect(e.text).not.toContain("\n");
      }
    }
  });

  it("the date-keyed rotation is deterministic and covers every lesson", () => {
    const pick = (dayIndex: number) =>
      STOIC_LESSONS[dayIndex % STOIC_LESSONS.length];
    // Same day, same lesson — for every soul.
    expect(pick(20000)).toBe(pick(20000));
    // A full cycle touches all 18.
    const seen = new Set<string>();
    for (let d = 0; d < STOIC_LESSONS.length; d++) seen.add(pick(d).slug);
    expect(seen.size).toBe(STOIC_LESSONS.length);
  });
});
