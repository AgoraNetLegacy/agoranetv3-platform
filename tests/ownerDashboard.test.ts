import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTestDb } from "./helpers/testDb";
import { getOwnerDashboardOperator } from "../lib/supportOperations";
import { ownerDashboardMetrics } from "../lib/ownerDashboard";

const { url } = createTestDb("owner-dashboard");
const db = new PrismaClient({ datasources: { db: { url } } });

async function profile(id: string, handle: string, face: string, status = "active") {
  return db.profile.create({
    data: {
      id,
      face,
      handle,
      displayName: handle,
      accessKeyHash: `hash-${id}`,
      joinedPeriod: "2026-Q3",
      status,
    },
  });
}

beforeAll(async () => {
  await profile("owner-profile", "shawnb", "TRUE_SELF");
  await profile("other-profile", "other-user", "TRUE_SELF");
  await profile("alias-profile", "private-alias", "ALIAS");
  await profile("pending-profile", "pending-user", "ALIAS", "pending");
  await db.human.create({ data: { credentialHash: "owner-human" } });
  await db.supportOperator.createMany({
    data: [
      { profileId: "owner-profile", role: "lead", active: true },
      { profileId: "other-profile", role: "lead", active: true },
    ],
  });
  await db.analyticsEvent.createMany({
    data: [
      { name: "funnel.verified" },
      { name: "funnel.trueself" },
      { name: "funnel.alias" },
    ],
  });
  await db.analyticsAggregate.create({
    data: { period: new Date().toISOString().slice(0, 10), name: "funnel.verified", count: 4 },
  });
});

afterAll(() => db.$disconnect());

describe("owner dashboard authorization and aggregates", () => {
  it("allows only @shawnb with an active lead grant", async () => {
    expect((await getOwnerDashboardOperator(db, "owner-profile"))?.profile.handle).toBe("shawnb");
    expect(await getOwnerDashboardOperator(db, "other-profile")).toBeNull();
    process.env.OWNER_DASHBOARD_ENABLED = "false";
    expect(await getOwnerDashboardOperator(db, "owner-profile")).toBeNull();
    delete process.env.OWNER_DASHBOARD_ENABLED;
  });

  it("reports population counts and labels funnel values as aggregates", async () => {
    const metrics = await ownerDashboardMetrics(db);
    expect(metrics.population).toMatchObject({
      verifiedHumans: 1,
      activeTrueSelves: 2,
      activeAliases: 1,
      activeIdentities: 3,
      pendingIdentities: 1,
    });
    expect(metrics.funnel.find((row) => row.name === "funnel.verified")?.count).toBe(5);
    expect(metrics.signupWindows[0]).toMatchObject({ days: 1, humans: 5, trueSelves: 1, aliases: 1 });
    expect(metrics.environment).toBe("LOCAL");
  });
});
