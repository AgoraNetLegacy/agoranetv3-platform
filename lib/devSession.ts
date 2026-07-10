// INTERIM — Phase 1 dev session. Real onboarding (True Self ceremony,
// Alias ceremony, consent architecture) arrives in Phase 2 and replaces
// this entirely. Until then, acting on the platform means picking a dev
// face from a cookie — clearly labeled in the UI as interim scaffolding.

import { cookies } from "next/headers";
import { db } from "./db";

const COOKIE = "agoranet-dev-face";

export async function activeProfile() {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (!id) return null;
  return db.profile.findUnique({ where: { id } });
}

export const DEV_FACE_COOKIE = COOKIE;

const ADJECTIVES = ["bright", "quiet", "steady", "amber", "candid", "patient", "bold", "gentle"];
const CREATURES = ["heron", "cedar", "otter", "fox", "aspen", "wren", "birch", "lynx"];

export function generatePseudonym(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const c = CREATURES[Math.floor(Math.random() * CREATURES.length)];
  const n = Math.floor(Math.random() * 90) + 10;
  return `${a}-${c}-${n}`;
}
