// Server-side parking enforcement shared by every in-pillar page
// (DASHBOARD §3.2: a pillar's dashboard and every sub-page reached from
// it count as being "in" the pillar). Readers park nothing; an active
// face takes the lot or is blocked by its sibling; and the blocked
// message names the holder plainly, because this is the protection
// working, not an error.

import { db } from "@/lib/db";
import { activeFace, currentSession } from "@/lib/webSession";
import { enterPillar } from "@/lib/parking";
import { releasePillar } from "./actions";
import { Icon } from "@/components/Icon";

export type ParkingOutcome =
  | { state: "reader" }
  | { state: "parked"; profileId: string }
  | { state: "blocked"; heldByHandle: string; heldByFace: string };

export async function checkParking(pillarId: string): Promise<ParkingOutcome> {
  const [face, session] = await Promise.all([activeFace(), currentSession()]);
  if (!face || !session) return { state: "reader" };
  const result = await enterPillar(db, {
    sessionId: session.id,
    profileId: face.id,
    pillarId,
  });
  if (result.allowed) return { state: "parked", profileId: face.id };
  return {
    state: "blocked",
    heldByHandle: result.heldByHandle,
    heldByFace: result.heldByFace,
  };
}

export function BlockedPanel({
  pillarName,
  pillarId,
  pillarSlug,
  heldByHandle,
  heldByFace,
}: {
  pillarName: string;
  pillarId: string;
  pillarSlug: string;
  heldByHandle: string;
  heldByFace: string;
}) {
  return (
    <div className="blocked-panel">
      <h2><Icon name="parking" /> This pillar is parked by your other face</h2>
      <p>
        Your {heldByFace} (<strong>{heldByHandle}</strong>) currently
        holds the {pillarName} lot. One face per pillar at a time; this is
        the parking rule protecting you, not an error.
      </p>
      <p>The one path forward: end that face's session in this pillar, then re-enter.</p>
      <form action={releasePillar}>
        <input type="hidden" name="pillarId" value={pillarId} />
        <input type="hidden" name="pillarSlug" value={pillarSlug} />
        <button type="submit">
          End {heldByHandle}'s session in {pillarName}
        </button>
      </form>
    </div>
  );
}
