// Test/demo fixture: mint a fully onboarded soul through the REAL
// ceremonies — verification, True Self registration, blocking consents,
// Alias hatch + immediate cohort release (activation time-travelled so
// tests don't wait days).

import type { PrismaClient } from "@prisma/client";
import {
  verifyHumanity,
  registerTrueSelf,
  registerAlias,
  activateDueAliases,
} from "../../lib/identity";
import { recordAck } from "../../lib/consent";

export async function makeOnboardedSoul(
  db: PrismaClient,
  names: {
    trueSelf: string;
    alias: string;
    trueSelfDisplayName?: string;
    aliasDisplayName?: string;
  }
) {
  const { credential } = await verifyHumanity(db);

  const trueSelf = await registerTrueSelf(db, {
    credential,
    handle: names.trueSelf,
    displayName: names.trueSelfDisplayName ?? names.trueSelf,
  });
  if (!trueSelf.ok) throw new Error(trueSelf.reason);
  await recordAck(db, { profileId: trueSelf.profileId, kind: "permanence" });
  await recordAck(db, { profileId: trueSelf.profileId, kind: "constitution" });

  const alias = await registerAlias(db, {
    credential,
    handle: names.alias,
    displayName: names.aliasDisplayName ?? names.alias,
    disclosuresAccepted: true,
  });
  if (!alias.ok) throw new Error(alias.reason);

  // Time-travel the activation and release the cohort.
  const aliasProfile = await db.profile.findUniqueOrThrow({
    where: { handle: names.alias },
  });
  await db.profile.update({
    where: { id: aliasProfile.id },
    data: { activateAt: new Date(Date.now() - 1000) },
  });
  await activateDueAliases(db);
  await recordAck(db, { profileId: aliasProfile.id, kind: "permanence" });
  await recordAck(db, { profileId: aliasProfile.id, kind: "constitution" });

  const human = await db.human.findFirstOrThrow({
    where: { profiles: { some: { id: trueSelf.profileId } } },
  });

  return {
    credential,
    humanId: human.id,
    trueSelfId: trueSelf.profileId,
    aliasId: aliasProfile.id,
    trueSelfAccessKey: trueSelf.accessKey,
    aliasAccessKey: alias.accessKey,
  };
}
