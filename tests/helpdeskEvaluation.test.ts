import { readFileSync, readdirSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  gradeHelpdeskEvaluationCase,
  parseHelpdeskEvaluationJsonl,
  type HelpdeskEvaluationCase,
} from "../lib/helpdeskEvaluation";
import type { HelpdeskAnswer } from "../lib/support";
import { REPO_ROOT } from "./helpers/testDb";

describe("helpdesk evaluation gate", () => {
  it("validates every fixture and keeps evaluation ids unique", () => {
    const directory = path.join(REPO_ROOT, "content", "help_support", "evals");
    const cases = readdirSync(directory)
      .filter((name) => name.endsWith(".jsonl"))
      .flatMap((name) => parseHelpdeskEvaluationJsonl(readFileSync(path.join(directory, name), "utf8"), name));
    expect(cases).toHaveLength(18);
    expect(new Set(cases.map((evaluation) => evaluation.id)).size).toBe(cases.length);
  });

  it("grades citations, refusals, escalation, and severity independently", () => {
    const evaluation: HelpdeskEvaluationCase = {
      id: "test.case",
      question: "Test question",
      expected: {
        articleSlugs: ["wallet-connection"],
        refuse: false,
        escalate: true,
        severity: "high",
        generated: true,
      },
    };
    const answer: HelpdeskAnswer = {
      answer: "Approved guidance.",
      articles: [{ slug: "wallet-connection", title: "Wallet", summary: "Help" }],
      refused: false,
      escalate: true,
      severity: "high",
      generated: true,
    };
    const result = gradeHelpdeskEvaluationCase(evaluation, answer, 42);
    expect(result.passed).toBe(true);
    expect(result.checks.map((check) => check.metric)).toEqual(["articles", "refusal", "escalation", "severity", "generation"]);
  });

  it("rejects malformed fixture expectations", () => {
    expect(() => parseHelpdeskEvaluationJsonl(
      '{"id":"bad","question":"Question?","expected":{"refuse":"yes"}}',
      "bad.jsonl"
    )).toThrow(/invalid expected refuse/);
  });
});
