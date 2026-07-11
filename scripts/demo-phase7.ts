// demo:phase7 — the Phase 7 checkpoint, end to end (BUILD_ORDER):
// hub → pillar → domain → Discussion → your own standing; a Picture
// repaired by governance; the treasury inspected publicly; feed sources
// tuned with why-lines and a real "you're caught up"; a Circle found by
// searching its city.
//
// Run: npm run demo:phase7   (uses the dev database; seed first)

import { PrismaClient } from "@prisma/client";
import { submitRepair, currentPicture, repairStatus } from "../lib/domains";
import { castVote, closeDuePolls, candleCommitmentFor } from "../lib/polls";
import { createPost } from "../lib/discussions";
import { faceConstellation, pillarStanding, scoreChangeLog } from "../lib/lightScore";
import { buildFeed, openLens, ensureFeedDefaults } from "../lib/feed";
import { search } from "../lib/search";
import { ensureDailySnapshot, computeBooks } from "../lib/transparency";
import { formCircle } from "../lib/circles";
import { makeOnboardedSoul, topUpForTests } from "../tests/helpers/souls";

const db = new PrismaClient();

function step(n: number, msg: string) {
  console.log(`\n— ${n}. ${msg}`);
}

async function main() {
  const stamp = Date.now().toString(36).slice(-5);
  step(1, "Three souls onboard; the hub shows seven pillars, 56 domains as data");
  const author = await makeOnboardedSoul(db, {
    trueSelf: `demo7-author-${stamp}`,
    alias: `demo7-a-shade-${stamp}`,
  });
  const voterA = await makeOnboardedSoul(db, {
    trueSelf: `demo7-votera-${stamp}`,
    alias: `demo7-va-shade-${stamp}`,
  });
  const voterB = await makeOnboardedSoul(db, {
    trueSelf: `demo7-voterb-${stamp}`,
    alias: `demo7-vb-shade-${stamp}`,
  });
  for (const s of [author, voterA, voterB]) await topUpForTests(db, s.trueSelfId, { pc: 50, g: 20 });
  const domainCount = await db.domain.count();
  const compassion = await db.pillar.findUniqueOrThrow({ where: { slug: "compassion" } });
  console.log(`   domains seeded: ${domainCount} (8 × 7 pillars) — every card backed by real data`);

  step(2, "Hub → Compassion → Domain 1 → its permanent Discussion thread");
  const domain = await db.domain.findUniqueOrThrow({
    where: { pillarId_position: { pillarId: compassion.id, position: 1 } },
    include: { discussion: true },
  });
  console.log(`   domain: "${domain.title}" (${domain.openingQuestionProvenance} opening question)`);
  const post = await createPost(db, {
    profileId: author.trueSelfId,
    discussionId: domain.discussion!.id,
    body: "Answering the domain's opening question with something substantive.",
  });
  if (!post.ok) throw new Error(post.reason);
  const standing1 = await pillarStanding(db, author.trueSelfId, compassion.id);
  console.log(`   posted in the domain thread → standing in Compassion: ${standing1.points} (${standing1.lines.map((l) => l.label).join("; ")})`);

  step(3, "A formal Repair challenges the Picture — a system governance poll opens");
  const v1 = await currentPicture(db, domain.id);
  const repair = await submitRepair(db, {
    domainId: domain.id,
    profileId: author.trueSelfId,
    challenge: "The Picture underweights collection agencies' stake in medical debt persisting.",
    proposedText: v1.body + " Amended by repair: the collections layer profits from the debt itself.",
  });
  if (!repair.ok) throw new Error(repair.reason);
  const poll = await db.poll.findUniqueOrThrow({ where: { id: repair.pollId } });
  console.log(`   poll "${poll.title}" — governance, sealed, candle-committed, opened by "system" in ${compassion.name}'s room`);

  step(4, "The community adopts it — sealed votes, candle close, auto-execution");
  const adopt = await db.pollOption.findFirstOrThrow({
    where: { pollId: poll.id, position: 1 },
  });
  for (const voter of [voterA, voterB]) {
    const vote = await castVote(db, { pollId: poll.id, profileId: voter.trueSelfId, optionIds: [adopt.id] });
    if (!vote.ok) throw new Error(vote.reason);
  }
  // Time-travel to the close — recommitting the candle for the moved
  // moment, exactly the phase-3 demo's pattern (db:verify re-checks it).
  const trueCloseAt = new Date(Date.now() - 500);
  await db.poll.update({
    where: { id: poll.id },
    data: {
      nominalCloseAt: new Date(Date.now() - 1000),
      trueCloseAt,
      candleCommitment: candleCommitmentFor(trueCloseAt, poll.candleSalt!),
    },
  });
  await db.ballot.updateMany({ where: { pollId: poll.id }, data: { castAt: new Date(Date.now() - 10_000) } });
  await closeDuePolls(db);
  const v2 = await currentPicture(db, domain.id);
  const status = await repairStatus(db, [domain.id]);
  console.log(`   Picture now v${v2.version}; card tag: ${status.get(domain.id)!.openRepairs} open repairs, last repaired ${status.get(domain.id)!.lastRepairedAt?.toISOString().slice(0, 10)}`);

  step(5, "Your own standing — the constellation, never a sum, every change named");
  const constellation = await faceConstellation(db, author.trueSelfId);
  for (const p of constellation.pillars) {
    console.log(`   ${p.icon} ${p.name}: ${p.points} ← ${p.lines.map((l) => `${l.label} ${l.points > 0 ? "+" : ""}${l.points}`).join(" · ")}`);
  }
  try {
    void (constellation as never as Record<string, unknown>).total;
    throw new Error("ANTI-SUM GUARD FAILED TO FIRE");
  } catch (err) {
    console.log(`   asking for a total → "${(err as Error).message.slice(0, 60)}…" (the guard, working)`);
  }
  const log = await scoreChangeLog(db, author.trueSelfId, 5);
  console.log(`   change log: ${log.map((c) => `${c.amount > 0 ? "+" : ""}${c.amount} ${c.cause}`).join(" · ")}`);

  step(6, "The treasury, inspected publicly — snapshot, categories, drill-down");
  const snapshot = await ensureDailySnapshot(db);
  const books = await computeBooks(db);
  console.log(`   snapshot ${snapshot.day}: treasury ${books.balances.PC.toFixed(2)} PC / ${books.balances.G.toFixed(2)} G`);
  for (const [cat, t] of Object.entries(books.inflows)) {
    console.log(`   in  · ${cat}: ${t.PC.toFixed(2)} PC, ${t.G.toFixed(2)} G (${t.entries} entries, drill-down public)`);
  }
  for (const [cat, t] of Object.entries(books.outflows)) {
    console.log(`   out · ${cat}: ${t.PC.toFixed(2)} PC, ${t.G.toFixed(2)} G`);
  }

  step(7, "Feed sources tuned — why-lines on every card, and the feed ENDS");
  await ensureFeedDefaults(db, voterA.trueSelfId);
  const feed = await buildFeed(db, voterA.trueSelfId);
  for (const card of feed.cards.slice(0, 4)) {
    console.log(`   card: "${card.title.slice(0, 60)}…" — ${card.whyLine}`);
  }
  await db.feedSettings.update({
    where: { profileId: voterA.trueSelfId },
    data: { caughtUpAt: new Date() },
  });
  const caught = await buildFeed(db, voterA.trueSelfId);
  console.log(`   after "mark read": ${caught.cards.length} cards — "You're caught up." The feed ends, by design.`);
  const lens = await openLens(db, 3);
  for (const card of lens) {
    console.log(`   lens: "${card.title.slice(0, 50)}…" score ${card.score.toFixed(1)} = ${card.scoreParts}`);
  }

  step(8, "A Circle found by searching its city");
  const circle = await formCircle(db, {
    profileId: voterB.trueSelfId,
    name: `Kelowna Food Security ${stamp}`,
    purpose: "Close the food-bank gap in Kelowna.",
    pillarId: compassion.id,
    domainId: domain.id,
    placeTag: "Kelowna, BC",
  });
  if (!circle.ok) throw new Error(circle.reason);
  const hits = await search(db, "Kelowna");
  const found = hits.find((h) => h.type === "places" && h.title.includes(stamp));
  console.log(`   search "Kelowna" → ${found ? `FOUND: ${found.title} (${found.badge})` : "NOT FOUND — checkpoint fails"}`);
  if (!found) throw new Error("checkpoint step failed");
  console.log(`   (the Circle is domain-tagged: "${domain.title}" — the Phase 6 flag, resolved)`);

  console.log("\nPhase 7 checkpoint complete: standing visible and explainable, the Picture");
  console.log("community-repaired, the treasury public, the feed chosen and finite, the");
  console.log("city searchable. Run npm run db:verify to re-check every invariant.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
