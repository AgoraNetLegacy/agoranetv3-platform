// Seed the platform's data-as-law: the canon (7 pillars × 7 lenses = 49
// questions), the 49 canonical Discussions (permanent spaces; the civic
// spine), the rails (every number as data), and the rulebook. Every
// seeding is written to the Civic Ledger. Idempotent per section:
// refuses to double-seed rather than duplicating (the ledger is
// append-only; there are no re-runs).

import { PrismaClient } from "@prisma/client";
import { PILLARS, LENSES } from "../lib/canon";
import { RAIL_DEFAULTS } from "../lib/rails";
import { RULEBOOK } from "../lib/rulebook";
import { DOMAIN_CONTENT } from "../lib/domainContent.generated";
import { appendEvent, GENESIS_HASH } from "../lib/ledger";

const db = new PrismaClient();

async function seedCanon() {
  const existing = await db.pillar.count();
  if (existing > 0) {
    console.log(`Canon already seeded (${existing} pillars); skipping.`);
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

  console.log(`Seeded ${PILLARS.length} pillars, ${position} questions; every seeding on the ledger.`);
}

// The 49 canonical Discussions; platform-created permanent spaces,
// 1:1 with the canon questions ("Canonical question threads: Permanent;
// ratified (owner, 2026-07-07) … they're the civic spine", DISCUSSIONS §8).
async function seedCanonicalDiscussions() {
  const existing = await db.discussion.count();
  if (existing > 0) {
    console.log(`Discussions already seeded (${existing}); skipping.`);
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
      : `Rails already seeded (${RAIL_DEFAULTS.length}); nothing new.`
  );
}

// The rulebook: complete v1 legislation as data.
async function seedRulebook() {
  const existing = await db.rule.count();
  if (existing > 0) {
    console.log(`Rulebook already seeded (${existing} rules); skipping.`);
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

// The domain layer (Phase 7; the canon reconciliation's second ring):
// 56 domains, each with its Picture as revision 1 of a living content
// object (DASHBOARD §6.5) and its Opening-Question thread as a permanent
// platform Discussion. Every seeding on the ledger; the 16 derived-draft
// questions carry their provenance into the event (the flag is public).
async function seedDomains() {
  const existing = await db.domain.count();
  if (existing > 0) {
    console.log(`Domains already seeded (${existing}); skipping.`);
    return;
  }
  let domains = 0;
  for (const pillarContent of DOMAIN_CONTENT) {
    const pillar = await db.pillar.findUniqueOrThrow({
      where: { slug: pillarContent.pillarSlug },
    });
    for (const d of pillarContent.domains) {
      const domain = await db.domain.create({
        data: {
          pillarId: pillar.id,
          position: d.position,
          title: d.title,
          subtitle: d.subtitle,
          openingQuestion: d.openingQuestion,
          openingQuestionProvenance: d.openingQuestionProvenance,
          reality: d.reality,
          impactPoint: d.impactPoint,
          forwardMarker: d.forwardMarker,
          stoicPrinciple: d.stoicPrinciple,
          stoicLens: d.stoicLens,
          openForRepair: JSON.stringify(d.openForRepair),
          inService: d.inService,
          extras: JSON.stringify(d.extras),
        },
      });
      // The Picture, version 1; the corpus text, verbatim.
      await db.pictureRevision.create({
        data: { domainId: domain.id, version: 1, body: d.picture },
      });
      // The domain's permanent thread (second ring).
      const discussion = await db.discussion.create({
        data: {
          title: d.openingQuestion,
          pillarId: pillar.id,
          domainId: domain.id,
          permanence: "permanent-canonical",
        },
      });
      await appendEvent(db, {
        actorType: "system",
        eventType: "domain.seeded",
        payload: {
          domainRef: domain.id,
          discussionRef: discussion.id,
          pillar: pillar.slug,
          position: d.position,
          title: d.title,
          openingQuestion: d.openingQuestion,
          openingQuestionProvenance: d.openingQuestionProvenance,
          pictureVersion: 1,
          permanence: "permanent-canonical",
        },
      });
      domains += 1;
    }
  }
  // Reserve the platform's own name in the taken-list: system-opened
  // polls (repair acceptance) speak as "system", and that attribution
  // must never be claimable by a soul (anti-impersonation; build-time
  // rule, flagged in DECISIONS_PENDING).
  await db.handleTombstone.upsert({
    where: { handle: "system" },
    create: { handle: "system", reason: "abandoned" },
    update: {},
  });
  console.log(`Seeded ${domains} domains, their Pictures (v1), and their permanent threads.`);
}

async function main() {
  await seedCanon();
  await seedCanonicalDiscussions();
  await seedRails();
  await seedRulebook();
  await seedDomains();
  // The budget categories the treasury may spend within; TOKENOMICS §3's
  // three outflows plus the mechanically constrained Credit-claim refund.
  const { seedBudgetCategories, SHIPPED_BUDGET_CATEGORIES } = await import("../lib/budget");
  await seedBudgetCategories(db);
  console.log(`✓ Budget categories seeded (${SHIPPED_BUDGET_CATEGORIES.length})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
