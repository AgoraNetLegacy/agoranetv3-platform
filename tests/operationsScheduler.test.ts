import { describe, expect, it } from "vitest";
import {
  createOperationsScheduler,
  dueOperationsJobs,
  type OperationsJob,
} from "../scripts/operations-scheduler";

function utc(iso: string) {
  return new Date(iso);
}

describe("Railway operations scheduler", () => {
  it("uses the published UTC timetable", () => {
    expect(dueOperationsJobs(utc("2026-08-25T03:00:00.000Z"))).toEqual([
      "platform:maintain",
      "db:backup:postgres",
    ]);
    expect(dueOperationsJobs(utc("2026-08-25T03:30:00.000Z"))).toEqual([
      "platform:maintain",
      "rate-limits:prune",
    ]);
    expect(dueOperationsJobs(utc("2026-08-01T04:00:00.000Z"))).toEqual([
      "platform:maintain",
      "db:restore-drill",
    ]);
    expect(dueOperationsJobs(utc("2026-08-25T05:00:00.000Z"))).toEqual([
      "platform:maintain",
      "chain:anchor",
    ]);
    expect(dueOperationsJobs(utc("2026-08-25T12:07:00.000Z"))).toEqual([]);
  });

  it("does not run the same UTC minute twice", async () => {
    const ran: OperationsJob[] = [];
    const scheduler = createOperationsScheduler(
      async (job) => {
        ran.push(job);
      },
      () => utc("2026-08-25T12:05:10.000Z")
    );

    await scheduler.tick();
    await scheduler.tick();
    expect(ran).toEqual(["platform:maintain"]);
  });
});
