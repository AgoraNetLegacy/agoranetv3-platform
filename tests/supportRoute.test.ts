import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeFace: vi.fn<() => Promise<{ id: string } | null>>(),
  ensureSessionId: vi.fn<() => Promise<string>>(),
  enforceRateLimit: vi.fn<() => Promise<void>>(),
  supportCaseCreate: vi.fn(),
}));

vi.mock("@/lib/webSession", () => ({
  activeFace: mocks.activeFace,
  ensureSessionId: mocks.ensureSessionId,
}));

vi.mock("@/lib/db", () => ({
  db: {
    supportCase: { create: mocks.supportCaseCreate },
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
});

describe("support API user flow", () => {
  it("returns grounded help with safe onboarding context", async () => {
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
    expect(payload.refused).toBe(false);
    expect(payload.articles.some((article: { slug: string }) => article.slug === "wallet-connection")).toBe(true);
    expect(mocks.enforceRateLimit).toHaveBeenCalledTimes(2);
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
      category: "technical",
      severity: "normal",
      subject: "Wallet connection keeps failing",
      description: "Lace is unlocked on preprod, but the connection still fails after reloading.",
      sourceArticle: "wallet-connection",
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
});
