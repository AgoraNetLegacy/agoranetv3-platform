// Seed the platform's data-as-law: the canon (7 pillars × 7 lenses = 49
// questions), the 49 canonical Discussions (permanent spaces — the civic
// spine), the rails (every number as data), and the rulebook. Every
// seeding is written to the Civic Ledger. Idempotent per section:
// refuses to double-seed rather than duplicating (the ledger is
// append-only; there are no re-runs).

import { PrismaClient } from "@prisma/client";
import { PILLARS, LENSES } from "../lib/canon";
import { RAIL_DEFAULTS } from "../lib/rails";
import { RULEBOOK } from "../lib/rulebook";
import { appendEvent, GENESIS_HASH } from "../lib/ledger";

const db = new PrismaClient();

async function seedCanon() {
  const existing = await db.pillar.count();
  if (existing > 0) {
    console.log(`Canon already seeded (${existing} pillars) — skipping.`);
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

// The 49 canonical Discussions — platform-created permanent spaces,
// 1:1 with the canon questions ("Canonical question threads: Permanent —
// ratified (owner, 2026-07-07) … they're the civic spine", DISCUSSIONS §8).
async function seedCanonicalDiscussions() {
  const existing = await db.discussion.count();
  if (existing > 0) {
    console.log(`Discussions already seeded (${existing}) — skipping.`);
    return;
  }
  const questions = await db.question.findMany({
    orderBy: { position: "asc" },
    include: { pillar: true },
  });
  for (const q of questions) {
    const discussion = await db.discussion.create({
      data: {
        title: q.text,
        pillarId: q.pillarId,
        questionId: q.id,
        permanence: "permanent-canonical",
      },
    });
    await appendEvent(db, {
      actorType: "system",
      eventType: "discussion.seeded",
      payload: {
        discussionRef: discussion.id,
        pillar: q.pillar.slug,
        canonPosition: q.position,
        permanence: "permanent-canonical",
      },
    });
  }
  console.log(`Seeded ${questions.length} canonical Discussions (permanent spaces).`);
}

// Rails: every number as data (ECONOMIC_STARTING_DEFAULTS testing
// defaults; bounds [¼×, 4×] unless specified).
async function seedRails() {
  // Per-key idempotent: the rail list grows with each phase, and an
  // existing database must receive the new phase's rails without
  // touching values already in force (they're poll-adjustable data).
  let seeded = 0;
  for (const rail of RAIL_DEFAULTS) {
    const existing = await db.rail.findUnique({ where: { key: rail.key } });
    if (existing) continue;
    seeded++;
    await db.rail.create({
      data: {
        key: rail.key,
        value: rail.value,
        unit: rail.unit,
        boundMin: rail.boundMin ?? rail.value / 4,
        boundMax: rail.boundMax ?? rail.value * 4,
        description: rail.description,
      },
    });
    await appendEvent(db, {
      actorType: "system",
      eventType: "rail.seeded",
      payload: { key: rail.key, value: rail.value, unit: rail.unit },
    });
  }
  console.log(
    seeded > 0
      ? `Seeded ${seeded} new rail(s) (${RAIL_DEFAULTS.length} total defined).`
      : `Rails already seeded (${RAIL_DEFAULTS.length}) — nothing new.`
  );
}

// The rulebook: complete v1 legislation as data.
async function seedRulebook() {
  const existing = await db.rule.count();
  if (existing > 0) {
    console.log(`Rulebook already seeded (${existing} rules) — skipping.`);
    return;
  }
  for (const rule of RULEBOOK) {
    await db.rule.create({ data: rule });
    await appendEvent(db, {
      actorType: "system",
      eventType: "rule.seeded",
      payload: { rule: rule.id, tier: rule.tier, title: rule.title },
    });
  }
  console.log(`Seeded ${RULEBOOK.length} rulebook rules.`);
}

async function main() {
  await seedCanon();
  await seedCanonicalDiscussions();
  await seedRails();
  await seedRulebook();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
