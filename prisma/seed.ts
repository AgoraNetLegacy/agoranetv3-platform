// Seed the canon: 7 pillars × 7 lenses = 49 questions, each seeding written
// to the Civic Ledger. Idempotent: refuses to double-seed rather than
// duplicating canon (the ledger is append-only; there are no re-runs).

import { PrismaClient } from "@prisma/client";
import { PILLARS, LENSES } from "../lib/canon";
import { appendEvent, GENESIS_HASH } from "../lib/ledger";

const db = new PrismaClient();

async function main() {
  const existing = await db.pillar.count();
  if (existing > 0) {
    console.log(`Canon already seeded (${existing} pillars) — nothing to do.`);
    return;
  }

  const hasGenesis = await db.ledgerEvent.findFirst({
    where: { prevHash: GENESIS_HASH },
  });
  if (!hasGenesis) {
    await appendEvent(db, {
      actorType: "system",
      eventType: "genesis",
      payload: {
        note: "AgoraNet v3 civic ledger begins. Append-only, hash-chained, pseudonym-only.",
      },
    });
  }

  let position = 0;
  for (const [pillarIndex, canon] of PILLARS.entries()) {
    const pillar = await db.pillar.create({
      data: {
        slug: canon.slug,
        name: canon.name,
        classicalName: canon.classicalName,
        loreName: canon.loreName,
        icon: canon.icon,
        colorPrimary: canon.colorPrimary,
        colorLight: canon.colorLight,
        colorDark: canon.colorDark,
        isMeta: canon.isMeta,
        position: pillarIndex + 1,
      },
    });
    await appendEvent(db, {
      actorType: "system",
      eventType: "pillar.seeded",
      payload: { slug: canon.slug, name: canon.name, position: pillarIndex + 1 },
    });

    for (const [lensIndex, text] of canon.questions.entries()) {
      position += 1;
      await db.question.create({
        data: {
          pillarId: pillar.id,
          lens: LENSES[lensIndex],
          position,
          text,
        },
      });
      await appendEvent(db, {
        actorType: "system",
        eventType: "question.seeded",
        payload: { pillar: canon.slug, lens: LENSES[lensIndex], position, text },
      });
    }
  }

  console.log(`Seeded ${PILLARS.length} pillars, ${position} questions — every seeding on the ledger.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
