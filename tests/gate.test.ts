import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb } from "./helpers/testDb";

const { url } = createTestDb("gate");
process.env.DATABASE_URL = url;
process.env.GATE_OPERATOR_SECRET = "test-secret-for-gate-tests-only";

import { PrismaClient } from "@prisma/client";
import { clearGate, submitProof } from "../lib/gate";
import { verifyChain, findForbiddenId } from "../lib/ledger";

const db = new PrismaClient({ datasources: { db: { url } } });

let humanId: string;
let trueSelfId: string;
let aliasId: string;

beforeAll(async () => {
  const human = await db.human.create({
    data: {
      profiles: {
        create: [
          { face: "TRUE_SELF", pseudonym: "bright-heron-42" },
          { face: "ALIAS", pseudonym: "quiet-cedar-17" },
        ],
      },
    },
    include: { profiles: true },
  });
  humanId = human.id;
  trueSelfId = human.profiles.find((p) => p.face === "TRUE_SELF")!.id;
  aliasId = human.profiles.find((p) => p.face === "ALIAS")!.id;
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

  it("per-human scope: the second face is a DUPLICATE — one act per human, enforced blind", async () => {
    const first = await clearGate(db, {
      profileId: trueSelfId,
      scope: "registration:demo",
      scopeKind: "per-human",
    });
    expect(first.outcome).toBe("CLEARED");

    const before = await db.ledgerEvent.count();
    const second = await clearGate(db, {
      profileId: aliasId,
      scope: "registration:demo",
      scopeKind: "per-human",
    });
    expect(second.outcome).toBe("DUPLICATE");
    // The rejection is private: nothing public links the two faces.
    expect(await db.ledgerEvent.count()).toBe(before);
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
