import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeFace: vi.fn<() => Promise<{ id: string } | null>>(),
  ensureSessionId: vi.fn<() => Promise<string>>(),
  enforceRateLimit: vi.fn<() => Promise<void>>(),
  supportCaseCreate: vi.fn(),
  supportAuditCreate: vi.fn(),
}));

vi.mock("@/lib/webSession", () => ({
  activeFace: mocks.activeFace,
  ensureSessionId: mocks.ensureSessionId,
}));

vi.mock("@/lib/db", () => ({
  db: {
    supportCase: { create: mocks.supportCaseCreate },
    supportAuditEvent: { create: mocks.supportAuditCreate },
    $transaction: vi.fn(async (work) => work({
      supportCase: { create: mocks.supportCaseCreate },
      supportAuditEvent: { create: mocks.supportAuditCreate },
    })),
  },
}));

vi.mock("@/lib/rateLimit", () => {
  class RateLimitError extends Error {
    retryAfterSeconds: number;
    constructor(message: string, retryAfterSeconds = 60) {
      super(message);
      this.retryAfterSeconds = retryAfterSeconds;
    }
  }
  return { enforceRateLimit: mocks.enforceRateLimit, RateLimitError };
});

import { POST } from "../app/api/support/route";

function request(body: Record<string, unknown>): Request {
  return new Request("http://agoranet.test/api/support", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.HELPDESK_PROVIDER = "disabled";
  mocks.activeFace.mockReset().mockResolvedValue(null);
  mocks.ensureSessionId.mockReset().mockResolvedValue("support-route-session");
  mocks.enforceRateLimit.mockReset().mockResolvedValue(undefined);
  mocks.supportCaseCreate.mockReset().mockResolvedValue({ id: "support-case-12345678" });
  mocks.supportAuditCreate.mockReset().mockResolvedValue({ id: "support-audit-created" });
});

describe("support API user flow", () => {
  it("keeps signed-out AI help inside the pre-account corpus", async () => {
    const response = await POST(request({
      action: "ask",
      question: "Why will my Lace wallet not connect on preprod?",
      context: {
        stage: "wallet",
        route: "/verify?private=discarded-by-allowlist-length-only",
        errorCode: "WALLET-CONNECT",
        clientVersion: "web-test",
        hiddenProfile: "must-not-enter-context",
      },
    }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.generated).toBe(false);
    expect(payload.refused).toBe(true);
    expect(payload.articles).toHaveLength(0);
    expect(payload.answer).toMatch(/creating an AgoraNet account and completing onboarding/i);
    expect(mocks.enforceRateLimit).toHaveBeenCalledTimes(2);
  });

  it("gives signed-in profiles the complete approved help corpus", async () => {
    mocks.activeFace.mockResolvedValue({ id: "member-profile" });
    const response = await POST(request({
      action: "ask",
      question: "Why will my Lace wallet not connect on preprod?",
    }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.refused).toBe(false);
    expect(payload.articles.some((article: { slug: string }) => article.slug === "wallet-connection")).toBe(true);
  });

  it("blocks a pasted secret before model generation or case creation", async () => {
    const response = await POST(request({
      action: "ask",
      question: "access key: this-must-never-be-sent",
    }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.secretRejected).toBe(true);
    expect(payload.refused).toBe(true);
    expect(payload.severity).toBe("critical");
  });

  it("creates a consented guest case and persists only allowlisted fields", async () => {
    const response = await POST(request({
      action: "case",
      contactEmail: "SOUL@EXAMPLE.COM",
      category: "onboarding",
      severity: "normal",
      subject: "Onboarding cannot continue",
      description: "The onboarding journey remains on the verification step after a safe reload.",
      sourceArticle: "verification-troubleshooting",
      context: {
        stage: "wallet",
        route: "/verify",
        errorCode: "WALLET-CONNECT",
        clientVersion: "web-test",
        hiddenProfile: "must-not-be-persisted",
      },
    }));
    const payload = await response.json();
    expect(response.status).toBe(201);
    expect(payload.reference).toBe("AN-12345678");
    expect(mocks.supportCaseCreate).toHaveBeenCalledOnce();
    expect(mocks.supportAuditCreate).toHaveBeenCalledOnce();
    const data = mocks.supportCaseCreate.mock.calls[0][0].data;
    expect(data.contactEmail).toBe("soul@example.com");
    expect(JSON.parse(data.safeContext)).toEqual({
      stage: "wallet",
      route: "/verify",
      errorCode: "WALLET-CONNECT",
      clientVersion: "web-test",
    });
    expect(data).not.toHaveProperty("hiddenProfile");
  });

  it("blocks broader platform cases from signed-out visitors", async () => {
    const response = await POST(request({
      action: "case",
      contactEmail: "soul@example.com",
      category: "wallet-and-transactions",
      severity: "normal",
      subject: "A transaction question",
      description: "I want detailed help with a platform transaction and wallet behavior.",
      sourceArticle: "transaction-pending",
    }));
    expect(response.status).toBe(403);
    expect(mocks.supportCaseCreate).not.toHaveBeenCalled();
  });

  it("rejects a broader request disguised with an onboarding category", async () => {
    const response = await POST(request({
      action: "case",
      contactEmail: "soul@example.com",
      category: "onboarding",
      severity: "normal",
      subject: "Creating a Circle",
      description: "Please explain all Circle permissions and member-management features.",
    }));
    expect(response.status).toBe(403);
    expect(mocks.enforceRateLimit).toHaveBeenCalledTimes(2);
    expect(mocks.supportCaseCreate).not.toHaveBeenCalled();
  });
});
