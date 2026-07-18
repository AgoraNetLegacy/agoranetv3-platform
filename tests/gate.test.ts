import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb } from "./helpers/testDb";

const { url } = createTestDb("gate");
process.env.DATABASE_URL = url;
process.env.GATE_OPERATOR_SECRET = "test-secret-for-gate-tests-only";

import { spawnSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import {
  clearGate,
  clearGateTx,
  submitProof,
  isGateDuplicateError,
  gateDuplicateConfirmed,
} from "../lib/gate";
import { Prisma } from "@prisma/client";
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
    expect(payload.handle).toBe("bright-heron-42");
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
      displayName: "second-alias-attempt",
      disclosuresAccepted: true,
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.reason).toContain("already holds an Alias");
    expect(await db.ledgerEvent.count()).toBe(before);
    expect(
      await db.profile.findUnique({ where: { handle: "second-alias-attempt" } })
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

// The #25 fix: clearGateTx runs the spend INSIDE the caller's transaction,
// so a feature-write failure unwinds the spend and the action is retryable
// instead of being lost as a phantom DUPLICATE. This is the property that
// separates clearGateTx from the old two-transaction clearGate.
describe("clearGateTx: the spend commits (and rolls back) with the feature write", () => {
  it("a rolled-back feature write leaves NO spend — the retry clears", async () => {
    const scope = "poll:rollback-proof:face";

    // The gate clears inside the transaction, then the "feature write" fails.
    await expect(
      db.$transaction(async (tx) => {
        const gate = await clearGateTx(tx, {
          profileId: trueSelfId,
          scope,
          scopeKind: "per-profile",
        });
        expect(gate.outcome).toBe("CLEARED");
        throw new Error("simulated feature-write failure");
      })
    ).rejects.toThrow("simulated feature-write failure");

    // Everything rolled back with the transaction: no spend, no cleared row,
    // no ledger event — nothing was stranded.
    expect(await db.nullifierSpend.count({ where: { scope } })).toBe(0);
    expect(await db.gateRequest.count({ where: { scope, status: "CLEARED" } })).toBe(0);

    // The retry succeeds — the humanity spend was NOT consumed by the failed
    // attempt. Under the old separate-transaction gate this returned DUPLICATE
    // and the action was lost forever.
    const retry = await db.$transaction((tx) =>
      clearGateTx(tx, { profileId: trueSelfId, scope, scopeKind: "per-profile" })
    );
    expect(retry.outcome).toBe("CLEARED");
  });

  it("a COMMITTED spend still blocks the same scope as DUPLICATE", async () => {
    const scope = "poll:committed-once:face";
    const first = await db.$transaction((tx) =>
      clearGateTx(tx, { profileId: trueSelfId, scope, scopeKind: "per-profile" })
    );
    expect(first.outcome).toBe("CLEARED");
    const second = await db.$transaction((tx) =>
      clearGateTx(tx, { profileId: trueSelfId, scope, scopeKind: "per-profile" })
    );
    expect(second.outcome).toBe("DUPLICATE");
  });

  it("per-human scope with a humanId-less Alias is INVALID inside a tx too", async () => {
    const result = await db.$transaction((tx) =>
      clearGateTx(tx, { profileId: aliasId, scope: "reserved:tx-per-human", scopeKind: "per-human" })
    );
    expect(result.outcome).toBe("INVALID");
  });

  it("isGateDuplicateError matches only the P2002 collision", () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "5.22.0",
    });
    expect(isGateDuplicateError(p2002)).toBe(true);
    const other = new Prisma.PrismaClientKnownRequestError("Not found", {
      code: "P2025",
      clientVersion: "5.22.0",
    });
    expect(isGateDuplicateError(other)).toBe(false);
    expect(isGateDuplicateError(new Error("plain"))).toBe(false);
    expect(isGateDuplicateError(null)).toBe(false);
  });

  // The outer catches must NOT report DUPLICATE for a P2002 that isn't the
  // nullifier collision (a ledger prevHash race, a GrantClaim first-action
  // race) — that would drop a valid action and tell the soul, falsely, that
  // they already acted. gateDuplicateConfirmed re-checks the actual spend.
  it("gateDuplicateConfirmed: a P2002 with NO matching spend is NOT a duplicate", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "5.22.0",
    });
    const result = await gateDuplicateConfirmed(db, p2002, {
      profileId: trueSelfId,
      scope: "poll:never-spent-here:face",
      scopeKind: "per-profile",
    });
    expect(result).toBe(false); // retryable — must re-throw, not claim DUPLICATE
  });

  it("gateDuplicateConfirmed: a P2002 WITH a committed spend IS a duplicate", async () => {
    const scope = "poll:confirmed-dup:face";
    await db.$transaction((tx) =>
      clearGateTx(tx, { profileId: trueSelfId, scope, scopeKind: "per-profile" })
    );
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "5.22.0",
    });
    const result = await gateDuplicateConfirmed(db, p2002, {
      profileId: trueSelfId,
      scope,
      scopeKind: "per-profile",
    });
    expect(result).toBe(true);
  });

  it("gateDuplicateConfirmed: a non-P2002 error is never a duplicate", async () => {
    const result = await gateDuplicateConfirmed(db, new Error("boom"), {
      profileId: trueSelfId,
      scope: "poll:confirmed-dup:face",
      scopeKind: "per-profile",
    });
    expect(result).toBe(false);
  });
});
