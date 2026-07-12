// Rate limiting — the consolidated per-surface schedule (Phase 8;
// ANTI_SYBIL_CONSOLIDATION §3 watch-item W4: "the single build-time
// table"). The v2 platform's proven limiter is the anchor, ported
// deliberately — the same way the Light Score weights were.
//
// Design:
// - Walls sit at MACHINE speed, never deliberation speed. Fees and
//   deposits are the platform's real throttle (incentive design);
//   these limits are the outer wall against automation and floods.
// - Every limit is a rail (`ratelimit.*`, seeded in lib/rails.ts),
//   poll-adjustable within bounds. Windows are structural: each policy
//   counts within the platform's rhythm units — the 10-minute burst
//   window, the hour, and the 24h day-cycle.
// - Minimal-log discipline (DUAL_IDENTITY §7.1 vector 4): identifiers
//   are HMAC-hashed with RATE_LIMIT_SECRET before persistence. No raw
//   IP, session id, or profile id ever lands in a bucket row, and
//   buckets carry no payload — a subpoenaed bucket table names nobody.
// - Fixed windows aligned to the epoch; the window index is folded into
//   the bucket key, so increments are single atomic upserts and expired
//   windows are simply old rows (pruned by scripts/prune-rate-limits.ts).
// - NOT a face-switch cooldown: the owner resolved that to NONE
//   (2026-07-11) — `faceSwitch` here is an anti-automation wall two
//   orders of magnitude above human switching, not a timing mitigation.

import { createHmac } from "crypto";
import { Prisma } from "@prisma/client";
import type { DbOrTx } from "./db";
import { getRail } from "./rails";

const MINUTE = 60_000;
const BURST = 10 * MINUTE; // the burst window
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR; // the platform's day-cycle

export interface RateLimitPolicy {
  /** Rail key suffix: the limit lives at `ratelimit.<name>`. */
  name: string;
  windowMs: number;
  /** Human words for the refusal message and the schedule table. */
  surface: string;
}

// The consolidated schedule (W4). Limits live in rails; this table fixes
// each policy's window and scope. Keyed per-profile once a face exists;
// pre-identity surfaces key on the browser session + (behind a declared
// proxy) the client address.
export const RATE_LIMIT_POLICIES = {
  // --- pre-identity surfaces (identity multiplication, surface #1)
  verify: { name: "verify", windowMs: HOUR, surface: "verification attempts" },
  register: { name: "register", windowMs: HOUR, surface: "registration ceremonies" },
  login: { name: "login", windowMs: BURST, surface: "sign-in attempts" },
  // --- per-profile write families
  posting: { name: "posting", windowMs: BURST, surface: "posts and edits" },
  votes: { name: "votes", windowMs: BURST, surface: "ballots" },
  economy: { name: "economy", windowMs: BURST, surface: "tips and upgrades" },
  creation: { name: "creation", windowMs: HOUR, surface: "space and poll creations" },
  flags: { name: "flags", windowMs: HOUR, surface: "flags and reports" },
  moderation: { name: "moderation", windowMs: HOUR, surface: "moderation acts" },
  appeals: { name: "appeals", windowMs: DAY, surface: "appeals" },
  social: { name: "social", windowMs: BURST, surface: "social acts" },
  dmMessages: { name: "dmMessages", windowMs: BURST, surface: "direct messages" },
  settings: { name: "settings", windowMs: BURST, surface: "preference changes" },
  faceSwitch: { name: "faceSwitch", windowMs: BURST, surface: "face switches" },
  // --- the backstop over every write action
  global: { name: "global", windowMs: BURST, surface: "actions" },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;

export class RateLimitError extends Error {
  readonly retryAfterSeconds: number;
  constructor(surface: string, retryAfterSeconds: number) {
    const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
    super(
      `Pace wall: too many ${surface} in a short time. Try again in about ` +
        `${minutes} minute${minutes === 1 ? "" : "s"}. Walls are set at machine ` +
        `speed — a soul deliberating never meets them.`
    );
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function rateLimitSecret(): string {
  const secret = process.env.RATE_LIMIT_SECRET ?? process.env.GATE_OPERATOR_SECRET;
  if (!secret) {
    throw new Error("RATE_LIMIT_SECRET is required for rate-limit key hashing.");
  }
  return secret;
}

/** Hash (policy, identifier, window) before persistence — raw identifiers
 *  never reach the database (DUAL_IDENTITY §7.1 vector 4). */
export function bucketKey(
  policyName: string,
  identifier: string,
  windowIndex: number
): string {
  return createHmac("sha256", rateLimitSecret())
    .update(`${policyName}\0${identifier}\0${windowIndex}`)
    .digest("hex");
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

// SQLite occasionally surfaces write contention as retryable errors under
// concurrent upserts; Postgres upserts can race the same way (P2002).
const RETRYABLE_CODES = new Set(["P1008", "P2002", "P2034"]);
const MAX_ATTEMPTS = 4;

/**
 * Count this act against its policy's current window. One atomic upsert:
 * the window index lives in the key, so a new window is simply a new row.
 */
export async function checkRateLimit(
  db: DbOrTx,
  policyName: RateLimitPolicyName,
  identifier: string,
  now: Date = new Date()
): Promise<RateLimitResult> {
  const policy = RATE_LIMIT_POLICIES[policyName];
  const limit = Math.max(1, Math.round(await getRail(db, `ratelimit.${policy.name}`)));
  const windowIndex = Math.floor(now.getTime() / policy.windowMs);
  const windowStart = new Date(windowIndex * policy.windowMs);
  const resetAt = new Date((windowIndex + 1) * policy.windowMs);
  const key = bucketKey(policy.name, identifier, windowIndex);

  let count = 0;
  for (let attempt = 1; ; attempt++) {
    try {
      const bucket = await db.rateLimitBucket.upsert({
        where: { key },
        create: { key, policy: policy.name, windowStart, count: 1 },
        update: { count: { increment: 1 } },
      });
      count = bucket.count;
      break;
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        RETRYABLE_CODES.has(error.code);
      if (!retryable || attempt >= MAX_ATTEMPTS) throw error;
      await new Promise((r) => setTimeout(r, 10 * attempt));
    }
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((resetAt.getTime() - now.getTime()) / 1000)
  );
  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds,
  };
}

/** Check and refuse loudly. The message is soul-facing. */
export async function enforceRateLimit(
  db: DbOrTx,
  policyName: RateLimitPolicyName,
  identifier: string,
  now: Date = new Date()
): Promise<void> {
  const result = await checkRateLimit(db, policyName, identifier, now);
  if (!result.allowed) {
    throw new RateLimitError(
      RATE_LIMIT_POLICIES[policyName].surface,
      result.retryAfterSeconds
    );
  }
}

/** Buckets older than the longest window (the day-cycle) are dead rows;
 *  keep a safety margin, then delete. Short retention is the point. */
export async function pruneRateLimitBuckets(
  db: DbOrTx,
  now: Date = new Date()
): Promise<number> {
  const cutoff = new Date(now.getTime() - 2 * DAY);
  const result = await db.rateLimitBucket.deleteMany({
    where: { windowStart: { lt: cutoff } },
  });
  return result.count;
}
