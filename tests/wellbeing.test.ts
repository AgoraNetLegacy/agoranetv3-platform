import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "child_process";
import { createTestDb, REPO_ROOT } from "./helpers/testDb";

const { url } = createTestDb("wellbeing");
process.env.DATABASE_URL = url;
process.env.GATE_OPERATOR_SECRET = "test-secret-for-wellbeing-tests";

import { PrismaClient } from "@prisma/client";
import { beaconWellbeingFor } from "../lib/wellbeing";
import { makeOnboardedSoul } from "./helpers/souls";

const db = new PrismaClient({ datasources: { db: { url } } });
let faceId: string;

beforeAll(async () => {
  const seeded = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  if (seeded.status !== 0) throw new Error(`seed failed: ${seeded.stderr}`);
  const soul = await makeOnboardedSoul(db, {
    trueSelf: "calm-soul",
    alias: "calm-shade",
  });
  faceId = soul.trueSelfId;
}, 60_000);

afterAll(async () => {
  await db.$disconnect();
});

describe("beacon wellbeing resolution (SPEC §7)", () => {
  it("absent row → rail default nudge, no cap", async () => {
    const wb = await beaconWellbeingFor(db, faceId);
    expect(wb.nudgeAfterMin).toBe(20); // feed.nudge.defaultAfterMin rail
    expect(wb.dailyCapMin).toBeNull();
  });

  it("a row's null means explicitly OFF, and choices stick per face", async () => {
    await db.feedSettings.upsert({
      where: { profileId: faceId },
      create: { profileId: faceId, nudgeAfterMin: null, dailyCapMin: 45 },
      update: { nudgeAfterMin: null, dailyCapMin: 45 },
    });
    const wb = await beaconWellbeingFor(db, faceId);
    expect(wb.nudgeAfterMin).toBeNull(); // off, NOT the rail default
    expect(wb.dailyCapMin).toBe(45);
  });
});
