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
    const first = await registerTrueSelf(db, { credential, handle: "first-light-9" });
    expect(first.ok).toBe(true);

    const event = await db.ledgerEvent.findFirst({
      where: { eventType: "trueself.registered" },
      orderBy: { seq: "desc" },
    });
    expect(event).not.toBeNull();
    expect(JSON.parse(event!.payload).pseudonym).toBe("first-light-9");
    if (first.ok) expect(event!.payload).not.toContain(first.profileId);

    const second = await registerTrueSelf(db, { credential, handle: "second-face-1" });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toContain("already holds a True Self");
  });

  it("rejects an unknown credential", async () => {
    const result = await registerTrueSelf(db, {
      credential: "not-a-real-credential",
      handle: "ghost-7",
    });
    expect(result.ok).toBe(false);
  });
});

describe("the Alias ceremony — timing mitigations", () => {
  let credential: string;

  beforeAll(async () => {
    const v = await verifyHumanity(db);
    credential = v.credential;
    const ts = await registerTrueSelf(db, { credential, handle: "day-face-4" });
    if (!ts.ok) throw new Error(ts.reason);
  });

  it("hatches with no public trace, a randomized cohort activation, and a coarse join period", async () => {
    const eventsBefore = await db.ledgerEvent.count();
    const result = await registerAlias(db, {
      credential,
      handle: "night-face-8",
      disclosuresAccepted: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.activationHint).toBe("within the next few days");

    // No ledger trace at registration.
    expect(await db.ledgerEvent.count()).toBe(eventsBefore);

    const alias = await db.profile.findUniqueOrThrow({
      where: { pseudonym: "night-face-8" },
    });
    expect(alias.status).toBe("pending");
    expect(alias.humanId).toBeNull();
    expect(alias.joinedPeriod).toMatch(/^\d{4}-\d{2}$/);

    // Activation inside the rail window, snapped to a cohort boundary.
    const [minH, maxH, cadenceH] = await Promise.all([
      getRail(db, "identity.aliasActivationMinHours"),
      getRail(db, "identity.aliasActivationMaxHours"),
      getRail(db, "identity.aliasCohortCadenceHours"),
    ]);
    const delayMs = alias.activateAt!.getTime() - Date.now();
    expect(delayMs).toBeGreaterThan(minH * 3_600_000 - 1000);
    // Cohort snap can push past the raw max by up to one cadence.
    expect(delayMs).toBeLessThanOrEqual((maxH + cadenceH) * 3_600_000);
    expect(alias.activateAt!.getTime() % (cadenceH * 3_600_000)).toBe(0);
  });

  it("refuses the disclosures being skipped", async () => {
    const v = await verifyHumanity(db);
    const result = await registerAlias(db, {
      credential: v.credential,
      handle: "hasty-hatch-2",
      disclosuresAccepted: false,
    });
    expect(result.ok).toBe(false);
  });

  it("a pending Alias cannot sign in; an activated one can — and activation is a cohort event", async () => {
    const alias = await db.profile.findUniqueOrThrow({
      where: { pseudonym: "night-face-8" },
    });
    // Pending: access key exists but sign-in is refused. (We can't know
    // the key here — assert via status path in profileForAccessKey using
    // a fresh hatch below instead.)
    const v = await verifyHumanity(db);
    const ts = await registerTrueSelf(db, { credential: v.credential, handle: "keyed-ts-3" });
    expect(ts.ok).toBe(true);
    const hatched = await registerAlias(db, {
      credential: v.credential,
      handle: "keyed-alias-3",
      disclosuresAccepted: true,
    });
    expect(hatched.ok).toBe(true);
    if (!hatched.ok) return;

    const pendingLogin = await profileForAccessKey(db, hatched.accessKey);
    expect(pendingLogin.ok).toBe(false);

    // Release the cohort (time-travel) — both pending aliases activate.
    await db.profile.updateMany({
      where: { status: "pending" },
      data: { activateAt: new Date(Date.now() - 1000) },
    });
    const released = await activateDueAliases(db);
    expect(released).toBeGreaterThanOrEqual(2);

    const activatedLogin = await profileForAccessKey(db, hatched.accessKey);
    expect(activatedLogin.ok).toBe(true);

    const event = await db.ledgerEvent.findFirst({
      where: { eventType: "alias.activated" },
      orderBy: { seq: "desc" },
    });
    expect(event).not.toBeNull();
    expect(JSON.parse(event!.payload).cohort).toBeDefined();
    void alias;
  });
});

describe("consent before posting", () => {
  it("refuses a post from a face without the blocking acknowledgments", async () => {
    const v = await verifyHumanity(db);
    const ts = await registerTrueSelf(db, { credential: v.credential, handle: "unconsented-5" });
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
    const ts = await registerTrueSelf(db, { credential: v.credential, handle: "parked-ts-6" });
    if (!ts.ok) throw new Error(ts.reason);
    tsId = ts.profileId;
    const hatched = await registerAlias(db, {
      credential: v.credential,
      handle: "parked-alias-6",
      disclosuresAccepted: true,
    });
    if (!hatched.ok) throw new Error(hatched.reason);
    const alias = await db.profile.findUniqueOrThrow({
      where: { pseudonym: "parked-alias-6" },
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
    expect(enterAlias.heldByPseudonym).toBe("parked-ts-6");
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

  it("face-switching enforces the cooldown rail", async () => {
    const first = await switchFace(db, { sessionId, fromProfileId: null, toProfileId: tsId });
    expect(first.ok).toBe(true);
    const second = await switchFace(db, { sessionId, fromProfileId: tsId, toProfileId: aliasId });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.reason).toContain("cooldown");
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
