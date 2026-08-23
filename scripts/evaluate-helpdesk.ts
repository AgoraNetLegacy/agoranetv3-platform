import { readFileSync, readdirSync } from "fs";
import path from "path";
import { HELP_CORPUS_VERSION } from "../lib/helpContent";
import {
  gradeHelpdeskEvaluationCase,
  parseHelpdeskEvaluationJsonl,
  type HelpdeskEvaluationCase,
  type HelpdeskEvaluationResult,
} from "../lib/helpdeskEvaluation";
import { checkHelpdeskProviderHealth } from "../lib/helpdeskProvider";
import { answerSupportQuestion } from "../lib/support";

const ROOT = path.resolve(__dirname, "..");
const EVAL_DIR = path.join(ROOT, "content", "help_support", "evals");
const jsonOutput = process.argv.includes("--json");
const verbose = process.argv.includes("--verbose");

function optionValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function loadCases(): HelpdeskEvaluationCase[] {
  const fixtures = readdirSync(EVAL_DIR).filter((name) => name.endsWith(".jsonl")).sort();
  const cases = fixtures.flatMap((name) => parseHelpdeskEvaluationJsonl(
    readFileSync(path.join(EVAL_DIR, name), "utf8"),
    name
  ));
  const seen = new Set<string>();
  for (const evaluation of cases) {
    if (seen.has(evaluation.id)) throw new Error(`Duplicate evaluation id: ${evaluation.id}`);
    seen.add(evaluation.id);
  }
  return cases;
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * fraction) - 1)];
}

async function main() {
  const health = await checkHelpdeskProviderHealth();
  if (!health.configured || !health.available) {
    throw new Error(
      `Helpdesk provider ${health.provider} is not available. Configure and start the local Gemma endpoint before running this acceptance suite.`
    );
  }

  const filter = optionValue("--filter");
  const cases = loadCases().filter((evaluation) => !filter || evaluation.id.includes(filter));
  if (cases.length === 0) throw new Error(`No evaluation cases matched ${JSON.stringify(filter)}.`);
  const results: HelpdeskEvaluationResult[] = [];
  for (const evaluation of cases) {
    const started = performance.now();
    const answer = await answerSupportQuestion({
      question: evaluation.question,
      safetyKey: `evaluation:${evaluation.id}`,
    });
    const result = gradeHelpdeskEvaluationCase(evaluation, answer, Math.round(performance.now() - started));
    results.push(result);
    if (!jsonOutput) {
      const failures = result.checks
        .filter((check) => !check.passed)
        .map((check) => `${check.metric} expected=${JSON.stringify(check.expected)} actual=${JSON.stringify(check.actual)}`)
        .join("; ");
      console.log(`${result.passed ? "PASS" : "FAIL"} ${result.id} ${result.latencyMs}ms${failures ? ` — ${failures}` : ""}`);
      if (verbose) console.log(`  ${JSON.stringify(result.actual)}`);
    }
  }

  const metricSummary = Object.fromEntries(
    ["articles", "refusal", "escalation", "severity", "generation"].map((metric) => {
      const checks = results.flatMap((result) => result.checks).filter((check) => check.metric === metric);
      return [metric, { passed: checks.filter((check) => check.passed).length, total: checks.length }];
    })
  );
  const passed = results.filter((result) => result.passed).length;
  const generatedLatencies = results.filter((result) => result.generated).map((result) => result.latencyMs);
  const deterministicLatencies = results.filter((result) => !result.generated).map((result) => result.latencyMs);
  const report = {
    corpusVersion: HELP_CORPUS_VERSION,
    provider: health,
    passed,
    total: results.length,
    passRate: results.length ? passed / results.length : 0,
    generated: results.filter((result) => result.generated).length,
    latencyMs: {
      overall: {
        p50: percentile(results.map((result) => result.latencyMs), 0.5),
        p95: percentile(results.map((result) => result.latencyMs), 0.95),
        max: Math.max(0, ...results.map((result) => result.latencyMs)),
      },
      generated: {
        p50: percentile(generatedLatencies, 0.5),
        p95: percentile(generatedLatencies, 0.95),
        max: Math.max(0, ...generatedLatencies),
      },
      deterministic: {
        p50: percentile(deterministicLatencies, 0.5),
        p95: percentile(deterministicLatencies, 0.95),
        max: Math.max(0, ...deterministicLatencies),
      },
    },
    metrics: metricSummary,
    results,
  };

  if (jsonOutput) console.log(JSON.stringify(report, null, 2));
  else console.log(
    `\n${passed}/${results.length} cases passed; generated p50 ${report.latencyMs.generated.p50}ms; generated p95 ${report.latencyMs.generated.p95}ms.`
  );
  if (passed !== results.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
