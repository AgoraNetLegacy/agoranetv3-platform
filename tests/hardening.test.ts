// Phase 8 — Deployment Hardening: the runtime config guard and the
// dual-provider parity discipline (DATABASE_SETUP.md).

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  validateRuntimeConfig,
  requireRuntimeConfig,
  isHostedEnvironment,
} from "../lib/runtimeConfig";
import { REPO_ROOT } from "./helpers/testDb";

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

describe("runtime config guard (DATABASE_SETUP.md — refuse to boot unsafe)", () => {
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
