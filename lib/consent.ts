// Consent records (ONBOARDING §4): blocking acknowledgments are recorded
// per-profile and enforced where they protect — a soul cannot post
// without having acknowledged permanence and the Constitution.

import type { PrismaClient } from "@prisma/client";
import { CONSENT_VERSIONS, type ConsentKind } from "./disclosures";

export async function recordAck(
  db: PrismaClient,
  input: { profileId: string; kind: ConsentKind }
): Promise<void> {
  await db.consentAck.upsert({
    where: {
      profileId_kind: { profileId: input.profileId, kind: input.kind },
    },
    create: {
      profileId: input.profileId,
      kind: input.kind,
      version: CONSENT_VERSIONS[input.kind],
    },
    update: { version: CONSENT_VERSIONS[input.kind], ackedAt: new Date() },
  });
}

/** The two Stage 4 blocking acks required before the first post. */
export async function hasPostingConsents(
  db: PrismaClient,
  profileId: string
): Promise<boolean> {
  const acks = await db.consentAck.findMany({
    where: { profileId, kind: { in: ["permanence", "constitution"] } },
  });
  return acks.length === 2;
}
