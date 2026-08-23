import type { HelpdeskAnswer, SupportSeverity } from "./support";

export interface HelpdeskEvaluationExpected {
  articleSlugs?: string[];
  refuse?: boolean;
  escalate?: boolean;
  severity?: SupportSeverity;
  generated?: boolean;
}

export interface HelpdeskEvaluationCase {
  id: string;
  question: string;
  expected: HelpdeskEvaluationExpected;
}

export interface HelpdeskEvaluationCheck {
  metric: "articles" | "refusal" | "escalation" | "severity" | "generation";
  passed: boolean;
  expected: unknown;
  actual: unknown;
}

export interface HelpdeskEvaluationResult {
  id: string;
  passed: boolean;
  latencyMs: number;
  generated: boolean;
  actual: {
    answer: string;
    articleSlugs: string[];
    refused: boolean;
    escalate: boolean;
    severity: SupportSeverity;
    confidence?: string;
  };
  checks: HelpdeskEvaluationCheck[];
}

const SEVERITIES = new Set<SupportSeverity>(["informational", "normal", "high", "critical"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseHelpdeskEvaluationJsonl(text: string, source = "evaluation fixture"): HelpdeskEvaluationCase[] {
  const cases: HelpdeskEvaluationCase[] = [];
  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line) continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      throw new Error(`${source}:${index + 1} is not valid JSON.`);
    }
    if (!isRecord(value) || typeof value.id !== "string" || !value.id.trim()) {
      throw new Error(`${source}:${index + 1} requires a non-empty id.`);
    }
    if (typeof value.question !== "string" || value.question.trim().length < 3) {
      throw new Error(`${source}:${index + 1} requires a complete question.`);
    }
    if (!isRecord(value.expected)) {
      throw new Error(`${source}:${index + 1} requires an expected object.`);
    }
    const expected: HelpdeskEvaluationExpected = {};
    if (value.expected.articleSlugs !== undefined) {
      if (!Array.isArray(value.expected.articleSlugs) || value.expected.articleSlugs.some((slug) => typeof slug !== "string" || !slug)) {
        throw new Error(`${source}:${index + 1} has invalid expected articleSlugs.`);
      }
      expected.articleSlugs = value.expected.articleSlugs as string[];
    }
    if (value.expected.refuse !== undefined) {
      if (typeof value.expected.refuse !== "boolean") throw new Error(`${source}:${index + 1} has invalid expected refuse.`);
      expected.refuse = value.expected.refuse;
    }
    if (value.expected.escalate !== undefined) {
      if (typeof value.expected.escalate !== "boolean") throw new Error(`${source}:${index + 1} has invalid expected escalate.`);
      expected.escalate = value.expected.escalate;
    }
    if (value.expected.severity !== undefined) {
      if (typeof value.expected.severity !== "string" || !SEVERITIES.has(value.expected.severity as SupportSeverity)) {
        throw new Error(`${source}:${index + 1} has invalid expected severity.`);
      }
      expected.severity = value.expected.severity as SupportSeverity;
    }
    if (value.expected.generated !== undefined) {
      if (typeof value.expected.generated !== "boolean") throw new Error(`${source}:${index + 1} has invalid expected generated.`);
      expected.generated = value.expected.generated;
    }
    if (Object.keys(expected).length === 0) {
      throw new Error(`${source}:${index + 1} must define at least one expectation.`);
    }
    cases.push({ id: value.id.trim(), question: value.question.trim(), expected });
  }
  return cases;
}

export function gradeHelpdeskEvaluationCase(
  evaluation: HelpdeskEvaluationCase,
  answer: HelpdeskAnswer,
  latencyMs: number
): HelpdeskEvaluationResult {
  const checks: HelpdeskEvaluationCheck[] = [];
  if (evaluation.expected.articleSlugs) {
    const actual = answer.articles.map((article) => article.slug);
    checks.push({
      metric: "articles",
      passed: evaluation.expected.articleSlugs.every((slug) => actual.includes(slug)),
      expected: evaluation.expected.articleSlugs,
      actual,
    });
  }
  if (evaluation.expected.refuse !== undefined) {
    checks.push({
      metric: "refusal",
      passed: answer.refused === evaluation.expected.refuse,
      expected: evaluation.expected.refuse,
      actual: answer.refused,
    });
  }
  if (evaluation.expected.escalate !== undefined) {
    checks.push({
      metric: "escalation",
      passed: answer.escalate === evaluation.expected.escalate,
      expected: evaluation.expected.escalate,
      actual: answer.escalate,
    });
  }
  if (evaluation.expected.severity !== undefined) {
    checks.push({
      metric: "severity",
      passed: answer.severity === evaluation.expected.severity,
      expected: evaluation.expected.severity,
      actual: answer.severity,
    });
  }
  if (evaluation.expected.generated !== undefined) {
    checks.push({
      metric: "generation",
      passed: answer.generated === evaluation.expected.generated,
      expected: evaluation.expected.generated,
      actual: answer.generated,
    });
  }
  return {
    id: evaluation.id,
    passed: checks.every((check) => check.passed),
    latencyMs,
    generated: answer.generated,
    actual: {
      answer: answer.answer,
      articleSlugs: answer.articles.map((article) => article.slug),
      refused: answer.refused,
      escalate: answer.escalate,
      severity: answer.severity,
      confidence: answer.confidence,
    },
    checks,
  };
}
