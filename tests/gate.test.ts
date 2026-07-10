import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb } from "./helpers/testDb";

const { url } = createTestDb("gate");
process.env.DATABASE_URL = url;
process.env.GATE_OPERATOR_SECRET = "test-secret-for-gate-tests-only";

import { spawnSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import { clearGate, submitProof } from "../lib/gate";
import { verifyChain, findForbiddenId } from "../lib/ledger";
import { registerAlias } from "../lib/identity";
import { makeOnboardedSoul } from "./helpers/souls";
import { REPO_ROOT } from "./helpers/testDb";

const db = new PrismaClient({ datasources: { db: { url } } });

let credential: string;
let humanId: string;
let trueSelfId: string;
let aliasId: string;

beforeAll(async () => {
  const seeded = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  if (seeded.status !== 0) throw new Error(`seed failed: ${seeded.stderr}`);

  const soul = await makeOnboardedSoul(db, {
    trueSelf: "bright-heron-42",
    alias: "quiet-cedar-17",
  });
  credential = soul.credential;
  humanId = soul.humanId;
  trueSelfId = soul.trueSelfId;
  aliasId = soul.aliasId;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("the gate: pending → proof → cleared", () => {
  it("clears a first action and records it on the ledger pseudonymously", async () => {
    const result = await clearGate(db, {
      profileId: trueSelfId,
      scope: "poll:demo-1:face",
      scopeKind: "per-profile",
    });
    expect(result.outcome).toBe("CLEARED");
    expect(result.nullifier).toMatch(/^[a-f0-9]{64}$/);

    const event = await db.ledgerEvent.findFirst({
      where: { eventType: "gate.cleared" },
      orderBy: { seq: "desc" },
    });
    expect(event).not.toBeNull();
    expect(event!.actorId).toBe("bright-heron-42");
    const payload = JSON.parse(event!.payload);
    expect(payload.pseudonym).toBe("bright-heron-42");
    expect(payload.nullifier).toBe(result.nullifier);
  });

  it("rejects a second attempt in the same per-profile scope as DUPLICATE — privately", async () => {
    const before = await db.ledgerEvent.count();
    const result = await clearGate(db, {
      profileId: trueSelfId,
      scope: "poll:demo-1:face",
      scopeKind: "per-profile",
    });
    expect(result.outcome).toBe("DUPLICATE");
    // No public ledger event for a rejection (DUAL_IDENTITY §3.2).
    expect(await db.ledgerEvent.count()).toBe(before);
  });

  it("per-profile scope: the same human's other face clears independently (two voices)", async () => {
    const result = await clearGate(db, {
      profileId: aliasId,
      scope: "poll:demo-1:face",
      scopeKind: "per-profile",
    });
    expect(result.outcome).toBe("CLEARED");
  });

  it("per-human scope: available to the True Self (the reserved dial)", async () => {
    const result = await clearGate(db, {
      profileId: trueSelfId,
      scope: "reserved:per-human-demo",
      scopeKind: "per-human",
    });
    expect(result.outcome).toBe("CLEARED");
  });

  it("per-human scope: structurally impossible for an Alias (it carries no humanId)", async () => {
    const result = await clearGate(db, {
      profileId: aliasId,
      scope: "reserved:per-human-demo",
      scopeKind: "per-human",
    });
    expect(result.outcome).toBe("INVALID");
  });

  it("one Alias per human — a second hatch is refused blind, with no public trace", async () => {
    const before = await db.ledgerEvent.count();
    const second = await registerAlias(db, {
      credential,
      handle: "second-alias-attempt",
      disclosuresAccepted: true,
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.reason).toContain("already holds an Alias");
    expect(await db.ledgerEvent.count()).toBe(before);
    expect(
      await db.profile.findUnique({ where: { pseudonym: "second-alias-attempt" } })
    ).toBeNull();
  });

  it("the Alias row carries no humanId — no database row links the two faces", async () => {
    const alias = await db.profile.findUniqueOrThrow({ where: { id: aliasId } });
    expect(alias.humanId).toBeNull();
    const trueSelf = await db.profile.findUniqueOrThrow({ where: { id: trueSelfId } });
    expect(trueSelf.humanId).toBe(humanId);
  });

  it("returns INVALID for an unknown request", async () => {
    const result = await submitProof(db, "no-such-request");
    expect(result.outcome).toBe("INVALID");
  });

  it("never lets an internal id onto the ledger, and the chain verifies", async () => {
    const events = await db.ledgerEvent.findMany({ orderBy: { seq: "asc" } });
    expect(events.length).toBeGreaterThan(0);

    const profiles = await db.profile.findMany({ select: { id: true } });
    const forbidden = [humanId, ...profiles.map((p) => p.id)];
    for (const ev of events) {
      expect(findForbiddenId(ev, forbidden)).toBeNull();
    }

    expect(verifyChain(events).valid).toBe(true);
  });
});
