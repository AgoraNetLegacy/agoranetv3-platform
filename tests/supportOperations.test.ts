import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTestDb } from "./helpers/testDb";
import {
  addSupportInternalNote,
  assignSupportCase,
  getActiveSupportOperator,
  linkSupportKnownIssue,
  listSupportCasesForOperator,
  supportCaseForOperator,
  updateSupportCaseSeverity,
  updateSupportCaseStatus,
} from "../lib/supportOperations";

const { url } = createTestDb("support-operations");
const db = new PrismaClient({ datasources: { db: { url } } });

async function profile(id: string, handle: string) {
  return db.profile.create({
    data: {
      id,
      face: "TRUE_SELF",
      handle,
      displayName: handle,
      accessKeyHash: `hash-${id}`,
      joinedPeriod: "2026-Q3",
    },
  });
}

beforeAll(async () => {
  await Promise.all([
    profile("support-agent", "support-agent"),
    profile("support-lead", "support-lead"),
    profile("support-security", "support-security"),
  ]);
  await db.supportOperator.createMany({
    data: [
      { profileId: "support-agent", role: "agent" },
      { profileId: "support-lead", role: "lead" },
      { profileId: "support-security", role: "security" },
    ],
  });
});

afterAll(() => db.$disconnect());

async function operator(profileId: string) {
  return (await getActiveSupportOperator(db, profileId))!;
}

async function supportCase(overrides: Partial<{ category: string; severity: string; status: string; assignedOperatorId: string }> = {}) {
  return db.supportCase.create({
    data: {
      category: overrides.category ?? "technical",
      severity: overrides.severity ?? "normal",
      status: overrides.status ?? "new",
      assignedOperatorId: overrides.assignedOperatorId,
      subject: "A repeatable platform problem",
      description: "The screen stays unavailable after a safe retry and page reload.",
    },
  });
}

describe("support operations authorization and audit", () => {
  it("hides sensitive cases from agents even by direct id", async () => {
    const sensitive = await supportCase({ category: "identity-and-keys", severity: "critical" });
    const agent = await operator("support-agent");
    const lead = await operator("support-lead");
    expect(await supportCaseForOperator(db, agent, sensitive.id)).toBeNull();
    expect((await listSupportCasesForOperator(db, agent)).some((item) => item.id === sensitive.id)).toBe(false);
    expect((await supportCaseForOperator(db, lead, sensitive.id))?.id).toBe(sensitive.id);
  });

  it("allows self-assignment and records the exact assignment change", async () => {
    const item = await supportCase();
    const agent = await operator("support-agent");
    const updated = await assignSupportCase(db, agent, item.id, agent.profileId);
    expect(updated.assignedOperatorId).toBe(agent.profileId);
    expect(updated.status).toBe("assigned");
    const audit = await db.supportAuditEvent.findFirstOrThrow({ where: { caseId: item.id, action: "case.assignment.changed" } });
    expect(JSON.parse(audit.details)).toMatchObject({ from: null, to: agent.profileId, status: "assigned" });
  });

  it("reserves reassignment, severity, close, and reopen for leads", async () => {
    const item = await supportCase({ status: "assigned", assignedOperatorId: "support-agent" });
    const agent = await operator("support-agent");
    const lead = await operator("support-lead");
    await expect(assignSupportCase(db, agent, item.id, lead.profileId)).rejects.toThrow(/lead/i);
    await expect(updateSupportCaseSeverity(db, agent, item.id, "high")).rejects.toThrow(/lead/i);
    await updateSupportCaseStatus(db, agent, item.id, "resolved");
    await expect(updateSupportCaseStatus(db, agent, item.id, "closed")).rejects.toThrow(/lead/i);
    const closed = await updateSupportCaseStatus(db, lead, item.id, "closed");
    expect(closed.closedAt).toBeInstanceOf(Date);
    const reopened = await updateSupportCaseStatus(db, lead, item.id, "assigned");
    expect(reopened.closedAt).toBeNull();
  });

  it("clears an ordinary agent assignment when a lead marks a case critical", async () => {
    const item = await supportCase({ status: "assigned", assignedOperatorId: "support-agent" });
    const lead = await operator("support-lead");
    const updated = await updateSupportCaseSeverity(db, lead, item.id, "critical");
    expect(updated.assignedOperatorId).toBeNull();
    expect(await supportCaseForOperator(db, await operator("support-agent"), item.id)).toBeNull();
  });

  it("stores note text separately and never copies it into audit details", async () => {
    const item = await supportCase({ status: "assigned", assignedOperatorId: "support-agent" });
    const agent = await operator("support-agent");
    await expect(addSupportInternalNote(db, agent, item.id, "access key: do-not-store-this")).rejects.toThrow(/remove credentials/i);
    const body = "Reproduced on the verification route; safe error code VERIFY-17.";
    const note = await addSupportInternalNote(db, agent, item.id, body);
    expect(note.body).toBe(body);
    const audit = await db.supportAuditEvent.findFirstOrThrow({ where: { caseId: item.id, action: "case.note.added" } });
    expect(audit.details).toContain(note.id);
    expect(audit.details).not.toContain(body);
  });

  it("only links known issues from the approved corpus", async () => {
    const item = await supportCase({ status: "assigned", assignedOperatorId: "support-agent" });
    const agent = await operator("support-agent");
    await expect(linkSupportKnownIssue(db, agent, item.id, "invented-outage")).rejects.toThrow(/approved support corpus/i);
    const updated = await linkSupportKnownIssue(db, agent, item.id, "known-issues");
    expect(updated.knownIssueId).toBe("known-issues");
  });
});
