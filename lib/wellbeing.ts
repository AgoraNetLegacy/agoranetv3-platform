// Beacon wellbeing (BEACON_FEED_SPEC §7, v2 decision 3 carried
// forward): calm pacing as a per-identity CHOICE. The platform measures
// nothing; the nudge and the cap run entirely in the soul's own
// browser; the server only stores the identity's chosen thresholds.

import type { DbOrTx } from "./db";
import { getRail } from "./rails";

export interface BeaconWellbeing {
  /** Minutes before the go-act nudge; null = the identity turned it off. */
  nudgeAfterMin: number | null;
  /** Daily feed-minutes budget; null = no cap (the default). */
  dailyCapMin: number | null;
}

/** Resolve the identity's wellbeing settings: an absent row means the
 *  nudge rail default applies; a row's null means explicitly OFF. */
export async function beaconWellbeingFor(
  db: DbOrTx,
  profileId: string
): Promise<BeaconWellbeing> {
  const row = await db.feedSettings.findUnique({ where: { profileId } });
  if (!row) {
    return {
      nudgeAfterMin: await getRail(db, "feed.nudge.defaultAfterMin"),
      dailyCapMin: null,
    };
  }
  return { nudgeAfterMin: row.nudgeAfterMin, dailyCapMin: row.dailyCapMin };
}
