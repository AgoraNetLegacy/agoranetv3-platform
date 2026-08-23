import { spawnSync } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  HELP_ARTICLES,
  HELP_CORPUS_VERSION,
  HELP_RETRIEVAL_DOCUMENTS,
  PRE_ACCOUNT_HELP_SLUGS,
  helpArticlesForViewer,
} from "../lib/helpContent";
import { HELP_AGENT_PROMPT, HELP_SOUL_PROMPT } from "../lib/helpPrompts.generated";
import { REPO_ROOT } from "./helpers/testDb";

const EXPECTED_SLUGS = [
  "browser-technical-help",
  "circles",
  "contact-support",
  "discussions",
  "donations-treasury",
  "fellow-souls-dms",
  "known-issues",
  "lost-keys",
  "moderation-appeals",
  "money",
  "onboarding-interrupted",
  "permanence",
  "polls-voting",
  "privacy-profile-boundaries",
  "report-content",
  "search",
  "switching-identities",
  "transaction-pending",
  "two-identities",
  "values-seed",
  "verification-troubleshooting",
  "verify-once",
  "wallet-connection",
  "what-to-save",
  "your-feed",
].sort();

describe("governed Help & Support corpus", () => {
  it("is reproducibly compiled and current", () => {
    const result = spawnSync("npm", ["run", "corpus:check"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(HELP_CORPUS_VERSION).toMatch(/^1\.0\.0\+[a-f0-9]{16}$/);
  });

  it("preserves all 25 public routes and canonical source files", () => {
    const slugs = HELP_ARTICLES.map((article) => article.slug).sort();
    expect(slugs).toEqual(EXPECTED_SLUGS);
    for (const article of HELP_ARTICLES) {
      const source = path.join(REPO_ROOT, "content", "help_support", "public", article.categoryId, `${article.slug}.md`);
      expect(existsSync(source), source).toBe(true);
      expect(article.sourceRefs.length).toBeGreaterThan(0);
      expect(article.reviewBy >= "2026-08-23").toBe(true);
    }
    expect(HELP_ARTICLES.find((article) => article.slug === "wallet-connection")?.links).toBeUndefined();
    expect(HELP_ARTICLES.find((article) => article.slug === "search")?.links?.map((link) => link.href)).toEqual([
      "/search",
      "/search/about",
      "/search/history",
    ]);
  });

  it("keeps internal knowledge, prompts, and evaluations out of public articles", () => {
    expect(HELP_RETRIEVAL_DOCUMENTS.length).toBe(30);
    expect(HELP_RETRIEVAL_DOCUMENTS.some((document) => document.audience === "operator")).toBe(true);
    expect(HELP_ARTICLES.some((article) => article.id.startsWith("internal.") || article.id.startsWith("policy."))).toBe(false);
    expect(HELP_RETRIEVAL_DOCUMENTS.some((document) => document.id.includes("SOUL") || document.id.includes("eval"))).toBe(false);
    expect(HELP_SOUL_PROMPT).toContain("AgoraNet's AI helpdesk");
    expect(HELP_AGENT_PROMPT).toContain("Use only facts stated");
  });

  it("exposes only account-creation and onboarding help before sign-in", () => {
    expect(helpArticlesForViewer(false).map((article) => article.slug).sort())
      .toEqual([...PRE_ACCOUNT_HELP_SLUGS].sort());
    expect(helpArticlesForViewer(false).some((article) => article.categoryId === "platform-features")).toBe(false);
    expect(helpArticlesForViewer(true)).toHaveLength(HELP_ARTICLES.length);
  });
});
