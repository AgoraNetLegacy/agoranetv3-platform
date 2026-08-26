// The private Railway operations service. It owns the platform's recurring
// chores so ordinary web requests never become a scheduler. Every job is an
// existing, independently runnable npm script; this process only supplies the
// UTC timetable and fails loudly if one of those jobs fails.
import { spawn } from "child_process";

export type OperationsJob =
  | "platform:maintain"
  | "db:backup:postgres"
  | "rate-limits:prune"
  | "analytics:crush"
  | "db:restore-drill"
  | "chain:anchor";

export function dueOperationsJobs(now: Date): OperationsJob[] {
  const minute = now.getUTCMinutes();
  const hour = now.getUTCHours();
  const jobs: OperationsJob[] = [];

  if (minute % 5 === 0) jobs.push("platform:maintain");
  if (hour === 3 && minute === 0) jobs.push("db:backup:postgres");
  if (hour === 3 && minute === 30) jobs.push("rate-limits:prune");
  if (hour === 3 && minute === 45) jobs.push("analytics:crush");
  if (now.getUTCDate() === 1 && hour === 4 && minute === 0) {
    jobs.push("db:restore-drill");
  }
  if (hour === 5 && minute === 0) jobs.push("chain:anchor");

  return jobs;
}

export async function runOperationsJob(job: OperationsJob): Promise<void> {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  await new Promise<void>((resolve, reject) => {
    const child = spawn(npm, ["run", job], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${job} failed (${signal ?? `exit ${code ?? "unknown"}`}).`));
    });
  });
}

/** Runs each UTC minute at most once for this process lifetime. */
export function createOperationsScheduler(
  runJob: (job: OperationsJob) => Promise<void> = runOperationsJob,
  clock: () => Date = () => new Date()
) {
  let lastMinute = "";
  let running = false;

  const tick = async () => {
    if (running) return;
    const now = clock();
    const minuteKey = now.toISOString().slice(0, 16);
    if (minuteKey === lastMinute) return;
    lastMinute = minuteKey;
    const jobs = dueOperationsJobs(now);
    if (!jobs.length) return;

    running = true;
    try {
      for (const job of jobs) {
        console.log(`Operations scheduler: starting ${job} (${minuteKey}Z).`);
        await runJob(job);
      }
    } finally {
      running = false;
    }
  };

  return { tick };
}

async function main() {
  const scheduler = createOperationsScheduler();
  await scheduler.tick();
  const intervalMs = Math.max(1_000, Number(process.env.OPERATIONS_SCHEDULER_TICK_MS) || 15_000);
  const timer = setInterval(() => {
    scheduler.tick().catch((error) => {
      console.error("OPERATIONS_SCHEDULER_FAIL:", error);
      process.exit(1);
    });
  }, intervalMs);
  console.log(`Operations scheduler ready; checking UTC schedule every ${intervalMs}ms.`);
  const stop = () => {
    clearInterval(timer);
    process.exit(0);
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}

if (process.env.VITEST !== "true") {
  main().catch((error) => {
    console.error("OPERATIONS_SCHEDULER_FAIL:", error);
    process.exit(1);
  });
}
