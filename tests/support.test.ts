import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import { createTestDb, REPO_ROOT } from "./helpers/testDb";
import {
  answerSupportQuestion,
  containsPastedSecret,
  createSupportCase,
  findRelevantHelp,
} from "../lib/support";

const { url } = createTestDb("support");
process.env.DATABASE_URL = url;
process.env.GATE_OPERATOR_SECRET = "test-secret-for-support-tests";
delete process.env.OPENAI_API_KEY;

const db = new PrismaClient({ datasources: { db: { url } } });

beforeAll(() => {
  const seeded = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  if (seeded.status !== 0) throw new Error(`seed failed: ${seeded.stderr}`);
}, 120_000);

afterAll(async () => {
  await db.$disconnect();
});

describe("Help & Support", () => {
  it("matches user language to approved help articles", () => {
    const wallet = findRelevantHelp("Lace wallet will not connect on preprod");
    expect(wallet[0]?.slug).toBe("wallet-connection");

    const onboarding = findRelevantHelp("I closed the browser halfway through onboarding");
    expect(onboarding.some((article) => article.slug === "onboarding-interrupted")).toBe(true);
  });

  it("refuses broader platform guidance in pre-account mode", async () => {
    const answer = await answerSupportQuestion({
      question: "How do I create a Circle and invite members?",
      safetyKey: "pre-account-test",
      access: "pre-account",
    });
    expect(answer.refused).toBe(true);
    expect(answer.articles).toHaveLength(0);

    const onboarding = await answerSupportQuestion({
      question: "I closed the browser halfway through onboarding",
      safetyKey: "pre-account-test",
      access: "pre-account",
    });
    expect(onboarding.articles.some((article) => article.slug === "onboarding-interrupted")).toBe(true);

    const twoCodes = await answerSupportQuestion({
      question: "It showed me two codes while I was signing up. Which one do I use to log in?",
      safetyKey: "pre-account-two-codes",
      access: "pre-account",
    });
    expect(twoCodes.refused).toBe(false);
    expect(twoCodes.articles[0]?.slug).toBe("what-to-save");
  });

  it("blocks pasted secrets before model or case handling", async () => {
    expect(containsPastedSecret("access key: very-secret-value")).toBe(true);
    expect(containsPastedSecret("I lost my access key")).toBe(false);

    const answer = await answerSupportQuestion({
      question: "Humanity Credential: do-not-send-this",
      safetyKey: "test-session",
    });
    expect(answer.secretRejected).toBe(true);
    expect(answer.generated).toBe(false);
    expect(answer.severity).toBe("critical");
  });

  it("falls back to grounded article help when no AI key is configured", async () => {
    const answer = await answerSupportQuestion({
      question: "Why is my transaction still pending?",
      context: { route: "/treasury", errorCode: "TX-PENDING" },
      safetyKey: "test-session",
    });
    expect(answer.generated).toBe(false);
    expect(answer.articles.some((article) => article.slug === "transaction-pending")).toBe(true);
    expect(answer.answer.length).toBeGreaterThan(40);
  });

  it("persists only allowlisted context and scopes a case to one profile", async () => {
    const profileId = "profile-scope-a";
    const result = await createSupportCase(db, {
      profileId,
      category: "technical",
      severity: "normal",
      subject: "Verification screen will not continue",
      description: "The verification screen returned error VERIFY-17 twice after I pressed continue.",
      context: {
        stage: "gate",
        route: "/verify",
        errorCode: "VERIFY-17",
        clientVersion: "web-test",
      },
      sourceArticle: "verification-troubleshooting",
    });
    expect(result.reference).toMatch(/^AN-/);
    const stored = await db.supportCase.findUniqueOrThrow({ where: { id: result.id } });
    expect(stored.profileId).toBe(profileId);
    expect(JSON.parse(stored.safeContext ?? "{}")).toEqual({
      stage: "gate",
      route: "/verify",
      errorCode: "VERIFY-17",
      clientVersion: "web-test",
    });
    const audit = await db.supportAuditEvent.findFirstOrThrow({
      where: { caseId: result.id, action: "case.created" },
    });
    expect(audit.details).not.toContain("Verification screen will not continue");
  });

  it("requires a reply address for a guest case", async () => {
    await expect(
      createSupportCase(db, {
        category: "other",
        severity: "normal",
        subject: "I need help with a public page",
        description: "The public help page is not loading after two refresh attempts.",
      })
    ).rejects.toThrow(/valid reply email/i);
  });
});
