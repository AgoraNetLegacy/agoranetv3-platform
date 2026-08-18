import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "child_process";
import { createTestDb, REPO_ROOT } from "./helpers/testDb";

const { url } = createTestDb("spirit");
process.env.DATABASE_URL = url;
process.env.GATE_OPERATOR_SECRET = "test-secret-for-spirit-tests";

import { PrismaClient } from "@prisma/client";
import { search } from "../lib/search";
import { sendFellowSoulRequest } from "../lib/fellowSouls";
import { openThread, sendMessage } from "../lib/dm";
import { spiritCovers, asSpiritLevel } from "../lib/spirit";
import { makeOnboardedSoul, topUpForTests } from "./helpers/souls";

const db = new PrismaClient({ datasources: { db: { url } } });

let veiledId: string; // the soul who goes into Spirit Mode
let seekerId: string; // the soul trying to find/reach them

async function setSpirit(profileId: string, active: boolean, level?: string) {
  await db.profile.update({
    where: { id: profileId },
    data: { spiritActive: active, ...(level ? { spiritLevel: level } : {}) },
  });
}

beforeAll(async () => {
  const seeded = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  if (seeded.status !== 0) throw new Error(`seed failed: ${seeded.stderr}`);

  const veiled = await makeOnboardedSoul(db, {
    trueSelf: "veiled-soul",
    alias: "veiled-shade",
  });
  const seeker = await makeOnboardedSoul(db, {
    trueSelf: "seeker-soul",
    alias: "seeker-shade",
  });
  veiledId = veiled.trueSelfId;
  seekerId = seeker.trueSelfId;
  await topUpForTests(db, seekerId, { pc: 100 });
}, 60_000);

afterAll(async () => {
  await db.$disconnect();
});

describe("the spirit level model", () => {
  it("ranks levels cumulatively and defaults unknown values to discovery", () => {
    const at = (level: string) => ({ spiritActive: true, spiritLevel: level });
    expect(spiritCovers(at("discovery"), "discovery")).toBe(true);
    expect(spiritCovers(at("discovery"), "inbound")).toBe(false);
    expect(spiritCovers(at("inbound"), "discovery")).toBe(true);
    expect(spiritCovers(at("inbound"), "ghost")).toBe(false);
    expect(spiritCovers(at("ghost"), "inbound")).toBe(true);
    expect(spiritCovers({ spiritActive: false, spiritLevel: "ghost" }, "discovery")).toBe(false);
    expect(asSpiritLevel("nonsense")).toBe("discovery");
    expect(asSpiritLevel("ghost")).toBe("ghost");
  });
});

describe("discovery level", () => {
  it("keeps registered souls in the search Souls lane while offline", async () => {
    const before = await search(db, "veiled-soul", { types: ["souls"] }, null);
    expect(before.some((h) => h.title.includes("@veiled-soul"))).toBe(true);

    await setSpirit(veiledId, true, "discovery");
    const during = await search(db, "veiled-soul", { types: ["souls"] }, null);
    expect(during.some((h) => h.title.includes("@veiled-soul"))).toBe(true);

    await setSpirit(veiledId, false);
    const after = await search(db, "veiled-soul", { types: ["souls"] }, null);
    expect(after.some((h) => h.title.includes("@veiled-soul"))).toBe(true);
  });

  it("still lets fellow-soul requests through at discovery level", async () => {
    await setSpirit(veiledId, true, "discovery");
    const result = await sendFellowSoulRequest(db, {
      fromProfileId: seekerId,
      toHandle: "veiled-soul",
    });
    expect(result.ok).toBe(true);
    // Withdraw the pending request so later cases start clean.
    await db.fellowSoulRequest.deleteMany({
      where: { fromProfileId: seekerId, toProfileId: veiledId },
    });
    await setSpirit(veiledId, false);
  });
});

describe("inbound level", () => {
  it("does not block fellow-soul requests while offline", async () => {
    await setSpirit(veiledId, true, "inbound");
    const result = await sendFellowSoulRequest(db, {
      fromProfileId: seekerId,
      toHandle: "veiled-soul",
    });
    expect(result.ok).toBe(true);
    await setSpirit(veiledId, false);
  });

  it("allows new and existing threads while offline", async () => {
    await setSpirit(veiledId, true, "inbound");
    const opened = await openThread(db, {
      fromProfileId: seekerId,
      toHandle: "veiled-soul",
      body: "Hello?",
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    // The recipient replies so the request becomes an existing thread.
    await topUpForTests(db, veiledId, { pc: 50 });
    const reply = await sendMessage(db, {
      threadId: opened.threadId,
      senderProfileId: veiledId,
      body: "I hear you.",
    });
    expect(reply.ok).toBe(true);

    const stillFlows = await sendMessage(db, {
      threadId: opened.threadId,
      senderProfileId: seekerId,
      body: "Good; existing threads keep working while you are offline.",
    });
    expect(stillFlows.ok).toBe(true);
    await setSpirit(veiledId, false);
  });
});

describe("ghost level", () => {
  it("keeps messages available while offline", async () => {
    const thread = await db.dmThread.findFirstOrThrow({});

    await setSpirit(veiledId, true, "ghost");
    const refused = await sendMessage(db, {
      threadId: thread.id,
      senderProfileId: seekerId,
      body: "Are you there?",
    });
    expect(refused.ok).toBe(true);

    // The veiled soul's own outbound messages are never blocked.
    const outbound = await sendMessage(db, {
      threadId: thread.id,
      senderProfileId: veiledId,
      body: "I walk unseen, but I can still speak.",
    });
    expect(outbound.ok).toBe(true);

    await setSpirit(veiledId, false);
    const resumed = await sendMessage(db, {
      threadId: thread.id,
      senderProfileId: seekerId,
      body: "Welcome back.",
    });
    expect(resumed.ok).toBe(true);
  });
});
