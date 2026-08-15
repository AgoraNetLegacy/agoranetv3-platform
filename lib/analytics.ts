// Analytics; the deliberately-dumb pipeline (ANALYTICS_SPEC,
// owner-ratified: self-hosted, event-level, profile-free). An event is
// a name and a moment. Nothing else exists to collect.
//
// The correlation constraint is the design (§ Executive Summary):
// behavioral analytics is a correlation engine, so this one measures
// the PRODUCT, never the person; no per-soul profiles, no dwell time,
// no fingerprints, no cross-persona anything. subjectKey is an HMAC'd
// per-profile key recorded ONLY where a metric is impossible without
// it (retention cohorts, funnel completion), crushed with everything
// else at the 90-day rail.
//
// Tool selection (OPEN_ITEMS #30, resolved at build): in-house minimal
// over deploying an Umami/Plausible instance; the ratified constraints
// are STRICTER than those tools' defaults (they retain hashed-IP
// visitor keys and user-agents; we retain nothing), and one database
// keeps analytics inside the same backup, verify, and access
// discipline as everything else. Flagged in DECISIONS_PENDING.

import { createHmac } from "crypto";
import type { DbOrTx } from "./db";

// The measured vocabulary; closed by design (db:verify check 26 fails
// on any name outside it; adding one is a conscious, audited act).
export const FUNNEL_EVENTS = [
  "funnel.arrival", // the verification doorway was seen
  "funnel.gate", // verification begun
  "funnel.verified", // credential issued and acknowledged
  "funnel.trueself", // True Self registered
  "funnel.consents", // blocking acknowledgments complete
  "funnel.seed", // a values-seed answer saved
  "funnel.oriented", // orientation complete (grant claimed)
  "funnel.alias", // Alias hatched
] as const;

export const ACTION_EVENTS = [
  // One per rate-limit policy family; feature vitals fall out of the
  // same families the W4 schedule already names (counts, never queries).
  "action.posting",
  "action.votes",
  "action.economy",
  "action.creation",
  "action.flags",
  "action.moderation",
  "action.appeals",
  "action.social",
  "action.dmMessages",
  "action.settings",
  // The retention signal: any write action (subject-keyed).
  "action.any",
] as const;

export type AnalyticsEventName =
  | (typeof FUNNEL_EVENTS)[number]
  | (typeof ACTION_EVENTS)[number];

export const MEASURED_EVENTS: ReadonlySet<string> = new Set([
  ...FUNNEL_EVENTS,
  ...ACTION_EVENTS,
]);

// Only these names may carry a subject key (cohort/funnel math needs
// them; everything else is a bare count).
export const SUBJECT_KEYED_EVENTS: ReadonlySet<string> = new Set([
  "action.any",
  "funnel.trueself",
  "funnel.oriented",
  // funnel.alias is deliberately absent: the hatch ceremony never
  // surfaces the new Alias's id, and analytics doesn't get what the
  // ceremony withholds.
]);

/** HMAC the profile id before it can touch an analytics row. The label
 *  differs from the rate-limit derivation so the two stores can never
 *  be joined even with both tables in hand. */
export function analyticsSubjectKey(profileId: string): string {
  const secret =
    process.env.RATE_LIMIT_SECRET ?? process.env.GATE_OPERATOR_SECRET ?? "";
  if (!secret) throw new Error("A platform secret is required for analytics keying.");
  return createHmac("sha256", secret)
    .update(`analytics\0${profileId}`)
    .digest("hex");
}

/**
 * Count that a thing happened. Fire-and-forget by contract: analytics
 * failing must NEVER break the product act it observes; errors are
 * swallowed (the one deliberate exception to fail-loudly, because the
 * alternative is the measurement tail wagging the product dog).
 */
export async function recordEvent(
  db: DbOrTx,
  name: AnalyticsEventName,
  subjectProfileId?: string
): Promise<void> {
  try {
    await db.analyticsEvent.create({
      data: {
        name,
        subjectKey:
          subjectProfileId && SUBJECT_KEYED_EVENTS.has(name)
            ? analyticsSubjectKey(subjectProfileId)
            : null,
      },
    });
  } catch {
    // Swallowed by design; see contract above.
  }
}
