"use server";

import { db } from "@/lib/db";
import { faceConstellation } from "@/lib/lightScore";
import { activeFace } from "@/lib/webSession";

export type LightScoreMenuRow = {
  slug: string;
  name: string;
  points: number;
};

export type LightScoreMenuResult =
  | { ok: true; rows: LightScoreMenuRow[] }
  | { ok: false; reason: string };

/**
 * Read only the active identity's six pillar scores, and only when the
 * identity asks to see them. No profile identifier crosses the server
 * boundary, so a caller cannot request another identity's constellation.
 */
export async function loadActiveLightScores(): Promise<LightScoreMenuResult> {
  const face = await activeFace();
  if (!face) return { ok: false, reason: "Sign in to see your Light Score." };

  const [constellation, pillars] = await Promise.all([
    faceConstellation(db, face.id),
    db.pillar.findMany({
      where: { isMeta: false },
      select: { id: true, slug: true, name: true },
      orderBy: { position: "asc" },
    }),
  ]);

  return {
    ok: true,
    rows: pillars.map((pillar) => ({
      slug: pillar.slug,
      name: pillar.name,
      points: constellation.forPillar(pillar.id)?.points ?? 0,
    })),
  };
}
