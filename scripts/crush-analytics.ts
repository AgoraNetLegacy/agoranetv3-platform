// The 90-day crush (ANALYTICS_SPEC §5): raw events older than the
// retention rail become permanent aggregates; daily counts (+ distinct
// subjects where kept) and weekly retention-cohort rows; and are then
// DELETED. No deep behavioral archive ever accumulates. Run daily from
// the ops cron (see docs/RUNBOOK.md §1).

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function utcWeek(d: Date): string {
  // ISO week label, UTC.
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

async function main() {
  const { db } = await import("../lib/db");
  const { getRail } = await import("../lib/rails");

  const retentionDays = await getRail(db, "analytics.retentionDays");
  const cutoff = new Date(Date.now() - retentionDays * DAY_MS);
  const stale = await db.analyticsEvent.findMany({
    where: { createdAt: { lt: cutoff } },
    orderBy: { createdAt: "asc" },
  });

  if (!stale.length) {
    console.log("Nothing to crush; no raw events older than the retention rail.");
    await db.$disconnect();
    return;
  }

  // Daily aggregates: count + distinct subjects per (day, name).
  const daily = new Map<string, { count: number; subjects: Set<string> }>();
  for (const ev of stale) {
    const key = `${utcDay(ev.createdAt)}\0${ev.name}`;
    const agg = daily.get(key) ?? { count: 0, subjects: new Set<string>() };
    agg.count++;
    if (ev.subjectKey) agg.subjects.add(ev.subjectKey);
    daily.set(key, agg);
  }

  // Retention cohorts: a subject's cohort week is its first
  // funnel.trueself/alias week; each later week with an action.any
  // marks a return. Computed over the events being crushed; cohort
  // aggregates accumulate monotonically across crush runs.
  const cohortOf = new Map<string, string>();
  for (const ev of stale) {
    if (
      (ev.name === "funnel.trueself" || ev.name === "funnel.alias") &&
      ev.subjectKey &&
      !cohortOf.has(ev.subjectKey)
    ) {
      cohortOf.set(ev.subjectKey, utcWeek(ev.createdAt));
    }
  }
  const returns = new Map<string, Set<string>>(); // "cohort\0weekLabel" -> subjects
  for (const ev of stale) {
    if (ev.name !== "action.any" || !ev.subjectKey) continue;
    const cohort = cohortOf.get(ev.subjectKey);
    if (!cohort) continue;
    const week = utcWeek(ev.createdAt);
    if (week === cohort) continue; // same-week activity isn't a return
    const key = `${cohort}\0${week}`;
    (returns.get(key) ?? returns.set(key, new Set()).get(key)!).add(ev.subjectKey);
  }

  await db.$transaction(async (tx) => {
    for (const [key, agg] of daily) {
      const [period, name] = key.split("\0");
      const distinct = agg.subjects.size || null;
      const existing = await tx.analyticsAggregate.findUnique({
        where: { period_name: { period, name } },
      });
      if (existing) {
        await tx.analyticsAggregate.update({
          where: { id: existing.id },
          data: {
            count: existing.count + agg.count,
            distinct:
              distinct === null
                ? existing.distinct
                : (existing.distinct ?? 0) + distinct,
          },
        });
      } else {
        await tx.analyticsAggregate.create({
          data: { period, name, count: agg.count, distinct },
        });
      }
    }
    // Cohort sizes, grouped per cohort week.
    const sizes = new Map<string, number>();
    for (const cohort of cohortOf.values()) {
      sizes.set(cohort, (sizes.get(cohort) ?? 0) + 1);
    }
    for (const [cohort, size] of sizes) {
      await tx.analyticsAggregate.upsert({
        where: { period_name: { period: cohort, name: "retention.size" } },
        create: { period: cohort, name: "retention.size", count: size },
        update: { count: { increment: size } },
      });
    }
    for (const [key, subjects] of returns) {
      const [cohort, week] = key.split("\0");
      await tx.analyticsAggregate.upsert({
        where: {
          period_name: { period: cohort, name: `retention.returned.${week}` },
        },
        create: {
          period: cohort,
          name: `retention.returned.${week}`,
          count: subjects.size,
        },
        update: { count: { increment: subjects.size } },
      });
    }
    // The deletion IS the feature.
    await tx.analyticsEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  });

  console.log(
    `Crushed ${stale.length} raw event(s) older than ${retentionDays}d into ` +
      `${daily.size} daily aggregate(s); cohort rows updated; raw rows deleted.`
  );
  await db.$disconnect();
}

main();
