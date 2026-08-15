// Phase 8; Deployment Hardening: the runtime config guard, the
// dual-provider parity discipline (DATABASE_SETUP.md), and the
// consolidated rate-limit schedule (ANTI_SYBIL_CONSOLIDATION §3 W4).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import { createTestDb, REPO_ROOT } from "./helpers/testDb";

const { url } = createTestDb("hardening");
process.env.DATABASE_URL = url;
process.env.GATE_OPERATOR_SECRET = "test-secret-for-hardening-tests";
process.env.RATE_LIMIT_SECRET = "test-rate-limit-secret-for-hardening";

import { PrismaClient } from "@prisma/client";
import {
  validateRuntimeConfig,
  requireRuntimeConfig,
  isHostedEnvironment,
} from "../lib/runtimeConfig";
import {
  checkRateLimit,
  enforceRateLimit,
  pruneRateLimitBuckets,
  RateLimitError,
  RATE_LIMIT_POLICIES,
} from "../lib/rateLimit";
import { RAIL_DEFAULTS } from "../lib/rails";

const db = new PrismaClient({ datasources: { db: { url } } });

// Tests that spawn seed/crush/verify as real subprocesses need CI-sized
// timeouts; the invariant suite grows every phase.
const SUBPROCESS_TIMEOUT = 120_000;

beforeAll(async () => {
  const seeded = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  if (seeded.status !== 0) throw new Error(`seed failed: ${seeded.stderr}`);
});

afterAll(async () => {
  await db.$disconnect();
});

const STRONG = "a".repeat(20) + "b".repeat(20);

function hostedEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: "production",
    DEPLOYMENT_ENV: "production",
    DATABASE_URL: "postgresql://user:pass@db.internal:5432/agoranet",
    GATE_OPERATOR_SECRET: STRONG,
    DM_MASTER_SECRET: STRONG,
    RATE_LIMIT_SECRET: STRONG,
    TRUST_PROXY: "true",
    ...overrides,
  } as NodeJS.ProcessEnv;
}

describe("runtime config guard (DATABASE_SETUP.md; refuse to boot unsafe)", () => {
  it("passes a fully configured hosted environment", () => {
    expect(validateRuntimeConfig(hostedEnv())).toEqual([]);
    expect(() => requireRuntimeConfig(hostedEnv())).not.toThrow();
  });

  it("is inert outside hosted environments (dev and tests)", () => {
    const dev = { NODE_ENV: "test", DATABASE_URL: "file:./dev.db" } as NodeJS.ProcessEnv;
    expect(isHostedEnvironment(dev)).toBe(false);
    expect(validateRuntimeConfig(dev)).toEqual([]);
  });

  it("refuses a SQLite URL in a hosted environment", () => {
    const errors = validateRuntimeConfig(hostedEnv({ DATABASE_URL: "file:./dev.db" }));
    expect(errors.some((e) => e.includes("PostgreSQL"))).toBe(true);
  });

  it("refuses placeholder connection strings", () => {
    const errors = validateRuntimeConfig(
      hostedEnv({ DATABASE_URL: "postgresql://change-me:5432/db" })
    );
    expect(errors.some((e) => e.includes("PostgreSQL"))).toBe(true);
  });

  it("refuses weak or placeholder trust secrets", () => {
    for (const key of [
      "GATE_OPERATOR_SECRET",
      "DM_MASTER_SECRET",
      "RATE_LIMIT_SECRET",
    ]) {
      expect(
        validateRuntimeConfig(hostedEnv({ [key]: "short" })).some((e) =>
          e.includes(key)
        )
      ).toBe(true);
      expect(
        validateRuntimeConfig(
          hostedEnv({ [key]: "placeholder-".padEnd(40, "x") })
        ).some((e) => e.includes(key))
      ).toBe(true);
    }
  });

  it("requires DEPLOYMENT_ENV and TRUST_PROXY when hosted", () => {
    expect(
      validateRuntimeConfig(hostedEnv({ DEPLOYMENT_ENV: undefined })).length
    ).toBeGreaterThan(0);
    expect(
      validateRuntimeConfig(hostedEnv({ TRUST_PROXY: undefined })).some((e) =>
        e.includes("TRUST_PROXY")
      )
    ).toBe(true);
  });

  it("throws with every error listed, not just the first", () => {
    const env = hostedEnv({
      DATABASE_URL: "file:./dev.db",
      GATE_OPERATOR_SECRET: "short",
    });
    expect(() => requireRuntimeConfig(env)).toThrowError(/PostgreSQL[\s\S]*GATE_OPERATOR_SECRET/);
  });
});

describe("dual-provider parity (DATABASE_SETUP.md)", () => {
  it("keeps the two schemas' model sections byte-identical", () => {
    const modelSection = (file: string) => {
      const schema = readFileSync(join(REPO_ROOT, file), "utf8");
      const match = schema.match(/^model /m);
      if (match?.index === undefined) throw new Error(`no models in ${file}`);
      return schema.slice(match.index).trim();
    };
    expect(modelSection("prisma/postgresql/schema.prisma")).toBe(
      modelSection("prisma/schema.prisma")
    );
  });

  it("keeps the postgres migration history consolidated and locked to postgresql", () => {
    const lock = readFileSync(
      join(REPO_ROOT, "prisma/postgresql/migrations/migration_lock.toml"),
      "utf8"
    );
    expect(lock).toContain('provider = "postgresql"');
    const init = readFileSync(
      join(REPO_ROOT, "prisma/postgresql/migrations/0_init/migration.sql"),
      "utf8"
    );
    // The init migration must create every model the schema declares.
    const schema = readFileSync(join(REPO_ROOT, "prisma/schema.prisma"), "utf8");
    const models = [...schema.matchAll(/^model (\w+) /gm)].map((m) => m[1]);
    expect(models.length).toBeGreaterThan(50);
    for (const model of models) {
      expect(init, `missing CREATE TABLE for ${model}`).toContain(
        `CREATE TABLE "${model}"`
      );
    }
  });
});

describe("minimal-log discipline guards (DUAL_IDENTITY §7.1 vector 4)", () => {
  const sourceFiles = (dir: string): string[] => {
    const { readdirSync, statSync } = require("fs") as typeof import("fs");
    const out: string[] = [];
    const walk = (d: string) => {
      for (const name of readdirSync(d)) {
        const full = join(d, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".generated.ts"))
          out.push(full);
      }
    };
    walk(join(REPO_ROOT, dir));
    return out;
  };

  it("no console output anywhere in application code (lib/ and app/)", () => {
    for (const file of [...sourceFiles("lib"), ...sourceFiles("app")]) {
      const src = readFileSync(file, "utf8");
      expect(
        /\bconsole\.(log|info|warn|error|debug|trace)\(/.test(src),
        `${file} writes a log line; the audit requires a reviewed exception`
      ).toBe(false);
    }
  });

  it("headers() is consumed ONLY at the audited clientAddress site", () => {
    for (const file of [...sourceFiles("lib"), ...sourceFiles("app")]) {
      const src = readFileSync(file, "utf8");
      const readsHeaders =
        /from ["']next\/headers["']/.test(src) && /\bheaders\b/.test(src);
      if (readsHeaders && !file.endsWith(join("lib", "webSession.ts"))) {
        throw new Error(
          `${file} reads request headers; extend docs/LOG_DISCIPLINE_AUDIT.md and this allowlist in the same commit`
        );
      }
    }
    const audited = readFileSync(join(REPO_ROOT, "lib/webSession.ts"), "utf8");
    expect(audited).toContain("x-forwarded-for");
  });

  it("the schema stores no network identity; no IP/UA/device/geo columns", () => {
    const schema = readFileSync(join(REPO_ROOT, "prisma/schema.prisma"), "utf8");
    const fieldNames = [...schema.matchAll(/^\s{2}(\w+)\s+\w/gm)].map((m) =>
      m[1].toLowerCase()
    );
    for (const field of fieldNames) {
      expect(
        /(^|_)ip($|[A-Z_])|ipaddress|useragent|fingerprint|deviceid|latitude|longitude|geoip/.test(
          field
        ),
        `schema field "${field}" looks like network identity`
      ).toBe(false);
    }
  });
});

describe("analytics discipline (ANALYTICS_SPEC; measure the product, never the person)", () => {
  it("analytics NEVER feeds ranking: feed and search cannot import the pipeline", () => {
    for (const file of ["lib/feed.ts", "lib/search.ts"]) {
      const src = readFileSync(join(REPO_ROOT, file), "utf8");
      expect(
        src.includes("analytics"),
        `${file} touches analytics; the published-formula law forbids hidden inputs`
      ).toBe(false);
    }
  });

  it("an event is a name and a moment; subject keys only where entitled, always HMAC", async () => {
    const { recordEvent } = await import("../lib/analytics");
    await recordEvent(db, "action.posting", "profile-raw-id"); // not entitled
    await recordEvent(db, "action.any", "profile-raw-id"); // entitled
    const bare = await db.analyticsEvent.findFirst({
      where: { name: "action.posting" },
      orderBy: { createdAt: "desc" },
    });
    const keyed = await db.analyticsEvent.findFirst({
      where: { name: "action.any" },
      orderBy: { createdAt: "desc" },
    });
    expect(bare?.subjectKey).toBeNull();
    expect(keyed?.subjectKey).toMatch(/^[0-9a-f]{64}$/);
    expect(keyed?.subjectKey).not.toContain("profile-raw-id");
  });

  it("analytics subject keys can never join to rate-limit keys (distinct derivations)", async () => {
    const { analyticsSubjectKey } = await import("../lib/analytics");
    const { bucketKey } = await import("../lib/rateLimit");
    expect(analyticsSubjectKey("p1")).not.toBe(bucketKey("posting", "p1", 0));
  });

  it("recordEvent swallows failure; measurement never breaks the product", async () => {
    const { recordEvent } = await import("../lib/analytics");
    const broken = {
      analyticsEvent: {
        create: () => Promise.reject(new Error("db down")),
      },
    } as never;
    await expect(recordEvent(broken, "action.posting")).resolves.toBeUndefined();
  });

  it("the crush: old events become aggregates and are DELETED; the young survive", async () => {
    const { analyticsSubjectKey } = await import("../lib/analytics");
    const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    const oldDay = old.toISOString().slice(0, 10);
    const subject = analyticsSubjectKey("cohort-soul");
    await db.analyticsEvent.createMany({
      data: [
        { name: "funnel.trueself", subjectKey: subject, createdAt: old },
        { name: "funnel.arrival", createdAt: old },
        { name: "funnel.arrival", createdAt: old },
        {
          name: "action.any",
          subjectKey: subject,
          createdAt: new Date(old.getTime() + 8 * 24 * 60 * 60 * 1000),
        },
        { name: "funnel.arrival" }, // young; must survive
      ],
    });
    const crush = spawnSync("npx", ["tsx", "scripts/crush-analytics.ts"], {
      cwd: REPO_ROOT,
      env: { ...process.env, DATABASE_URL: url },
      encoding: "utf8",
    });
    expect(crush.status, crush.stdout + crush.stderr).toBe(0);

    const oldRemaining = await db.analyticsEvent.count({
      where: { createdAt: { lt: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000) } },
    });
    expect(oldRemaining).toBe(0);
    const youngRemaining = await db.analyticsEvent.count({
      where: { name: "funnel.arrival" },
    });
    expect(youngRemaining).toBeGreaterThan(0);

    const arrivals = await db.analyticsAggregate.findUnique({
      where: { period_name: { period: oldDay, name: "funnel.arrival" } },
    });
    expect(arrivals?.count).toBe(2);
    // The cohort math: one soul joined, and returned in a later week.
    const size = await db.analyticsAggregate.findFirst({
      where: { name: "retention.size" },
    });
    expect(size?.count).toBe(1);
    const returned = await db.analyticsAggregate.findFirst({
      where: { name: { startsWith: "retention.returned." } },
    });
    expect(returned?.count).toBe(1);
  }, SUBPROCESS_TIMEOUT);

  it("check 26 FAILS LOUDLY on an unaudited event name", async () => {
    await db.analyticsEvent.create({
      data: { name: "dwell.time.ms" }, // the thing we swore never to measure
    });
    const verify = spawnSync("npx", ["tsx", "scripts/verify.ts"], {
      cwd: REPO_ROOT,
      env: { ...process.env, DATABASE_URL: url },
      encoding: "utf8",
    });
    expect(verify.status).not.toBe(0);
    expect(`${verify.stdout}${verify.stderr}`).toContain('unaudited event name "dwell.time.ms"');
    await db.analyticsEvent.deleteMany({ where: { name: "dwell.time.ms" } });
  }, SUBPROCESS_TIMEOUT);
});

describe("backup retention policy (BACKUP_DR §2; 30 daily / 12 monthly)", () => {
  const day = (d: string, n = 0) => `agoranet-${d}T0${n}-00-00-000Z.dump`;

  it("keeps everything inside the daily window", async () => {
    const { selectPrunable } = await import("../scripts/backup-postgres");
    const now = new Date("2026-07-11T12:00:00Z");
    const files = [day("2026-07-11"), day("2026-07-01"), day("2026-06-15")];
    expect(selectPrunable(files, now, 30, 12)).toEqual([]);
  });

  it("prunes old dailies but keeps each month's first backup", async () => {
    const { selectPrunable } = await import("../scripts/backup-postgres");
    const now = new Date("2026-07-11T12:00:00Z");
    const files = [
      day("2026-03-01"), // monthly keeper (first of March)
      day("2026-03-02"), // prunable daily
      day("2026-03-15"), // prunable daily
      day("2026-07-10"), // inside daily window
    ];
    expect(selectPrunable(files, now, 30, 12)).toEqual([
      day("2026-03-02"),
      day("2026-03-15"),
    ]);
  });

  it("prunes monthlies beyond the monthly window", async () => {
    const { selectPrunable } = await import("../scripts/backup-postgres");
    const now = new Date("2026-07-11T12:00:00Z");
    const files = [day("2025-05-01"), day("2025-08-01")];
    expect(selectPrunable(files, now, 30, 12)).toEqual([day("2025-05-01")]);
  });

  it("two same-day backups: only the first is the monthly keeper", async () => {
    const { selectPrunable } = await import("../scripts/backup-postgres");
    const now = new Date("2026-07-11T12:00:00Z");
    const files = [day("2026-03-01", 1), day("2026-03-01", 2)];
    expect(selectPrunable(files, now, 30, 12)).toEqual([day("2026-03-01", 2)]);
  });
});

describe("the consolidated rate-limit schedule (W4)", () => {
  it("seeds a rail for every policy in the table", () => {
    const railKeys = new Set(RAIL_DEFAULTS.map((r) => r.key));
    for (const policy of Object.values(RATE_LIMIT_POLICIES)) {
      expect(railKeys.has(`ratelimit.${policy.name}`), policy.name).toBe(true);
    }
  });

  it("allows under the wall and refuses over it, with a retry horizon", async () => {
    const now = new Date("2026-07-11T12:00:00Z");
    // register: 3/hour; small enough to walk over.
    for (let i = 1; i <= 3; i++) {
      const r = await checkRateLimit(db, "register", "soul-a", now);
      expect(r.allowed).toBe(true);
      expect(r.limit).toBe(3);
    }
    const fourth = await checkRateLimit(db, "register", "soul-a", now);
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
    expect(fourth.retryAfterSeconds).toBeGreaterThan(0);
    expect(fourth.retryAfterSeconds).toBeLessThanOrEqual(3600);
  });

  it("keys are per-identifier: one soul's flood never walls another", async () => {
    const now = new Date("2026-07-11T12:00:00Z");
    const r = await checkRateLimit(db, "register", "soul-b", now);
    expect(r.allowed).toBe(true);
  });

  it("a new window is a clean slate", async () => {
    const later = new Date("2026-07-11T13:00:01Z"); // next hour window
    const r = await checkRateLimit(db, "register", "soul-a", later);
    expect(r.allowed).toBe(true);
  });

  it("stores only HMAC keys; no raw identifier in any bucket row", async () => {
    const buckets = await db.rateLimitBucket.findMany();
    expect(buckets.length).toBeGreaterThan(0);
    for (const bucket of buckets) {
      expect(bucket.key).toMatch(/^[0-9a-f]{64}$/);
      expect(bucket.key).not.toContain("soul-a");
      expect(bucket.key).not.toContain("soul-b");
    }
  });

  it("the limit is a rail: adjusting it moves the wall", async () => {
    const now = new Date("2026-07-11T12:00:00Z");
    await db.rail.update({
      where: { key: "ratelimit.register" },
      data: { value: 5 },
    });
    const r = await checkRateLimit(db, "register", "soul-a", now); // 5th act
    expect(r.allowed).toBe(true);
    const sixth = await checkRateLimit(db, "register", "soul-a", now);
    expect(sixth.allowed).toBe(false);
    await db.rail.update({
      where: { key: "ratelimit.register" },
      data: { value: 3 },
    });
  });

  it("enforceRateLimit refuses in soul-facing words", async () => {
    const now = new Date("2026-07-11T12:00:00Z");
    await expect(
      enforceRateLimit(db, "register", "soul-a", now)
    ).rejects.toThrowError(RateLimitError);
    await expect(
      enforceRateLimit(db, "register", "soul-a", now)
    ).rejects.toThrowError(/Pace wall.*machine speed/s);
  });

  it("check 25 FAILS LOUDLY on a raw counter key or an unaudited ops payload", async () => {
    // Smuggle a raw identifier in as a bucket key, and an admin event
    // whose payload carries a field the audit never approved.
    const { appendEvent } = await import("../lib/ledger");
    await db.rateLimitBucket.create({
      data: {
        key: "session:raw-session-id-oops",
        policy: "posting",
        windowStart: new Date(),
        count: 1,
      },
    });
    const poisoned = await appendEvent(db, {
      actorType: "system",
      actorId: null,
      eventType: "admin.backup.created",
      payload: { operator: "tester", file: "x.dump", sourceIp: "203.0.113.7" },
    });

    const verify = spawnSync("npx", ["tsx", "scripts/verify.ts"], {
      cwd: REPO_ROOT,
      env: { ...process.env, DATABASE_URL: url },
      encoding: "utf8",
    });
    expect(verify.status).not.toBe(0);
    const output = `${verify.stdout}${verify.stderr}`;
    expect(output).toContain("COUNTER HYGIENE");
    expect(output).toContain('unaudited payload field "sourceIp"');

    // Remove the poison (the chain tail deletes cleanly) and re-verify.
    await db.rateLimitBucket.delete({ where: { key: "session:raw-session-id-oops" } });
    await db.ledgerEvent.delete({ where: { seq: poisoned.seq } });
    const clean = spawnSync("npx", ["tsx", "scripts/verify.ts"], {
      cwd: REPO_ROOT,
      env: { ...process.env, DATABASE_URL: url },
      encoding: "utf8",
    });
    expect(clean.status, clean.stdout + clean.stderr).toBe(0);
  }, SUBPROCESS_TIMEOUT);

  it("prunes buckets older than two day-cycles, keeps live ones", async () => {
    const ancient = new Date("2026-07-01T00:00:00Z");
    await checkRateLimit(db, "posting", "soul-old", ancient);
    const before = await db.rateLimitBucket.count();
    const removed = await pruneRateLimitBuckets(db, new Date("2026-07-11T12:00:00Z"));
    expect(removed).toBeGreaterThan(0);
    const after = await db.rateLimitBucket.count();
    expect(after).toBe(before - removed);
    // The current-window buckets from the tests above survive.
    expect(after).toBeGreaterThan(0);
  });
});
