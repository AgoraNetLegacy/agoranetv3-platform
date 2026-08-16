import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "child_process";
import { createTestDb, REPO_ROOT } from "./helpers/testDb";

const { url } = createTestDb("identity");
process.env.DATABASE_URL = url;
process.env.GATE_OPERATOR_SECRET = "test-secret-for-identity-tests";

import { PrismaClient } from "@prisma/client";
import {
  verifyHumanity,
  registerTrueSelf,
  registerAlias,
  activateDueAliases,
  profileForAccessKey,
} from "../lib/identity";
import { recordAck } from "../lib/consent";
import { createPost } from "../lib/discussions";
import {
  createSession,
  addFace,
  switchFace,
  enterPillar,
  releaseLock,
  releaseLocks,
  purgeExpired,
} from "../lib/parking";
import { getRail } from "../lib/rails";

const db = new PrismaClient({ datasources: { db: { url } } });

beforeAll(async () => {
  const seeded = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  if (seeded.status !== 0) throw new Error(`seed failed: ${seeded.stderr}`);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("the True Self ceremony", () => {
  it("registers once per human, pseudonym-only on the ledger", async () => {
    const { credential } = await verifyHumanity(db);
    const first = await registerTrueSelf(db, { credential, handle: "first-light-9", displayName: "first-light-9" });
    expect(first.ok).toBe(true);

    const event = await db.ledgerEvent.findFirst({
      where: { eventType: "trueself.registered" },
      orderBy: { seq: "desc" },
    });
    expect(event).not.toBeNull();
    expect(JSON.parse(event!.payload).handle).toBe("first-light-9");
    if (first.ok) expect(event!.payload).not.toContain(first.profileId);

    const second = await registerTrueSelf(db, { credential, handle: "second-face-1", displayName: "second-face-1" });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toContain("already holds a True Self");
  });

  it("rejects an unknown credential", async () => {
    const result = await registerTrueSelf(db, {
      credential: "not-a-real-credential",
      handle: "ghost-7",
      displayName: "ghost-7",
    });
    expect(result.ok).toBe(false);
  });

  it("enforces the flat global taken-list: duplicate handles refused, duplicate display names welcome", async () => {
    const v = await verifyHumanity(db);
    // Same handle, different human → refused (case-insensitively).
    const dupe = await registerTrueSelf(db, {
      credential: v.credential,
      handle: "First-Light-9",
      displayName: "Someone Else",
    });
    expect(dupe.ok).toBe(false);
    if (!dupe.ok) expect(dupe.reason).toContain("taken");

    // Same DISPLAY NAME, different handle → fine: a thousand souls may
    // share one display name.
    const sameName = await registerTrueSelf(db, {
      credential: v.credential,
      handle: "different-handle-1",
      displayName: "first-light-9",
    });
    expect(sameName.ok).toBe(true);
  });

  it("never recycles a tombstoned handle", async () => {
    const { tombstoneHandle } = await import("../lib/handles");
    await tombstoneHandle(db, { handle: "retired-forever", reason: "hatched" });
    const v = await verifyHumanity(db);
    const result = await registerTrueSelf(db, {
      credential: v.credential,
      handle: "retired-forever",
      displayName: "Grave Robber",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("never recycled");
  });
});

describe("the Alias ceremony; private by default", () => {
  let credential: string;

  beforeAll(async () => {
    const v = await verifyHumanity(db);
    credential = v.credential;
    const ts = await registerTrueSelf(db, { credential, handle: "day-face-4", displayName: "day-face-4" });
    if (!ts.ok) throw new Error(ts.reason);
  });

  it("hatches with no public trace and starts private but immediately available", async () => {
    const eventsBefore = await db.ledgerEvent.count();
    const result = await registerAlias(db, {
      credential,
      handle: "night-face-8",
      displayName: "night-face-8",
      disclosuresAccepted: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.visibilityHint).toBe("available now; private until you choose to be visible");

    // No ledger trace at registration.
    expect(await db.ledgerEvent.count()).toBe(eventsBefore);

    const alias = await db.profile.findUniqueOrThrow({
      where: { handle: "night-face-8" },
    });
    expect(alias.status).toBe("active");
    expect(alias.humanId).toBeNull();
    expect(alias.joinedPeriod).toMatch(/^\d{4}-\d{2}$/);
    expect(alias.spiritActive).toBe(true);
    expect(alias.spiritLevel).toBe("ghost");
    expect(alias.activateAt).toBeNull();
  });

  it("refuses the disclosures being skipped", async () => {
    const v = await verifyHumanity(db);
    const result = await registerAlias(db, {
      credential: v.credential,
      handle: "hasty-hatch-2",
      displayName: "hasty-hatch-2",
      disclosuresAccepted: false,
    });
    expect(result.ok).toBe(false);
  });

  it("can sign in immediately while remaining private until the owner appears", async () => {
    const alias = await db.profile.findUniqueOrThrow({
      where: { handle: "night-face-8" },
    });
    const v = await verifyHumanity(db);
    const ts = await registerTrueSelf(db, { credential: v.credential, handle: "keyed-ts-3", displayName: "keyed-ts-3" });
    expect(ts.ok).toBe(true);
    const hatched = await registerAlias(db, {
      credential: v.credential,
      handle: "keyed-alias-3",
      displayName: "keyed-alias-3",
      disclosuresAccepted: true,
    });
    expect(hatched.ok).toBe(true);
    if (!hatched.ok) return;

    const login = await profileForAccessKey(db, hatched.accessKey);
    expect(login.ok).toBe(true);
    if (login.ok) {
      expect(login.profile.status).toBe("active");
      expect(login.profile.spiritActive).toBe(true);
      expect(login.profile.spiritLevel).toBe("ghost");
    }
    expect(
      await db.ledgerEvent.findFirst({
        where: { eventType: "alias.activated", payload: { contains: "keyed-alias-3" } },
      })
    ).toBeNull();
    void alias;
  });
});

describe("consent before posting", () => {
  it("refuses a post from a face without the blocking acknowledgments", async () => {
    const v = await verifyHumanity(db);
    const ts = await registerTrueSelf(db, { credential: v.credential, handle: "unconsented-5", displayName: "unconsented-5" });
    expect(ts.ok).toBe(true);
    if (!ts.ok) return;

    const discussion = await db.discussion.findFirstOrThrow();
    const refused = await createPost(db, {
      discussionId: discussion.id,
      profileId: ts.profileId,
      body: "words before consent",
    });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.reason).toContain("acknowledgments");

    await recordAck(db, { profileId: ts.profileId, kind: "permanence" });
    await recordAck(db, { profileId: ts.profileId, kind: "constitution" });
    const allowed = await createPost(db, {
      discussionId: discussion.id,
      profileId: ts.profileId,
      body: "words after consent",
    });
    expect(allowed.ok).toBe(true);
  });
});

describe("the parking rule", () => {
  let sessionId: string;
  let tsId: string;
  let aliasId: string;
  let pillarA: string;
  let pillarB: string;

  beforeAll(async () => {
    const v = await verifyHumanity(db);
    const ts = await registerTrueSelf(db, { credential: v.credential, handle: "parked-ts-6", displayName: "parked-ts-6" });
    if (!ts.ok) throw new Error(ts.reason);
    tsId = ts.profileId;
    const hatched = await registerAlias(db, {
      credential: v.credential,
      handle: "parked-alias-6",
      displayName: "parked-alias-6",
      disclosuresAccepted: true,
    });
    if (!hatched.ok) throw new Error(hatched.reason);
    const alias = await db.profile.findUniqueOrThrow({
      where: { handle: "parked-alias-6" },
    });
    await db.profile.update({
      where: { id: alias.id },
      data: { activateAt: new Date(Date.now() - 1000) },
    });
    await activateDueAliases(db);
    aliasId = alias.id;

    sessionId = await createSession(db);
    await addFace(db, { sessionId, profileId: tsId });
    await addFace(db, { sessionId, profileId: aliasId });

    const pillars = await db.pillar.findMany({ orderBy: { position: "asc" }, take: 2 });
    pillarA = pillars[0].id;
    pillarB = pillars[1].id;
  });

  it("one face per pillar: the sibling is blocked, by name", async () => {
    const enterTs = await enterPillar(db, { sessionId, profileId: tsId, pillarId: pillarA });
    expect(enterTs.allowed).toBe(true);

    const enterAlias = await enterPillar(db, { sessionId, profileId: aliasId, pillarId: pillarA });
    expect(enterAlias.allowed).toBe(false);
    if (enterAlias.allowed) return;
    expect(enterAlias.heldByHandle).toBe("parked-ts-6");
    expect(enterAlias.heldByFace).toBe("True Self");
  });

  it("a different pillar is a different lot", async () => {
    const result = await enterPillar(db, { sessionId, profileId: aliasId, pillarId: pillarB });
    expect(result.allowed).toBe(true);
  });

  it("releasing the lot opens it to the other face", async () => {
    await releaseLock(db, { sessionId, pillarId: pillarA });
    const result = await enterPillar(db, { sessionId, profileId: aliasId, pillarId: pillarA });
    expect(result.allowed).toBe(true);
    await releaseLocks(db, { sessionId, profileId: aliasId });
  });

  it("switches faces instantly (owner-resolved: no cooldown); but the rail still enforces if ever set", async () => {
    const first = await switchFace(db, { sessionId, fromProfileId: null, toProfileId: tsId });
    expect(first.ok).toBe(true);
    // The vision: seamless switching.
    const second = await switchFace(db, { sessionId, fromProfileId: tsId, toProfileId: aliasId });
    expect(second.ok).toBe(true);

    // The mechanism survives as a governance dial: set the rail, and it
    // enforces; zero it, and it vanishes.
    await db.rail.update({
      where: { key: "identity.faceSwitchCooldownMinutes" },
      data: { value: 5 },
    });
    const third = await switchFace(db, { sessionId, fromProfileId: aliasId, toProfileId: tsId });
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.reason).toContain("Identity-switch limit");
    await db.rail.update({
      where: { key: "identity.faceSwitchCooldownMinutes" },
      data: { value: 0 },
    });
    const fourth = await switchFace(db, { sessionId, fromProfileId: aliasId, toProfileId: tsId });
    expect(fourth.ok).toBe(true);
  });

  it("expired sessions purge, faces and locks with them (short retention)", async () => {
    const shortLived = await createSession(db);
    await addFace(db, { sessionId: shortLived, profileId: tsId });
    await db.soulSession.update({
      where: { id: shortLived },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await purgeExpired(db);
    expect(await db.soulSession.findUnique({ where: { id: shortLived } })).toBeNull();
    expect(
      await db.sessionFace.findFirst({ where: { sessionId: shortLived } })
    ).toBeNull();
  });
});
