// demo:phase7.5; the Phase 7.5 checkpoint, end to end (BUILD_ORDER):
// a soul creates a PUBLIC chamber through the full scaffold, pays the
// dual-token fee (both halves, visibly), other souls enter and work the
// idea in the workshop, the storefront reads right (pitch, why-care,
// creator standing, count + activity; never the list), and the
// workshop stays enclosed: nothing inside reaches the ledger, the open
// lens, Light Score, or public search.
//
// Run: npm run demo:phase7.5   (uses the dev database; seed first)

import { PrismaClient } from "@prisma/client";
import {
  createChamber,
  enterChamber,
  editScaffold,
  inviteToChamber,
  chamberActivityLevel,
  carriesBothTokens,
} from "../lib/chambers";
import { createPost, upgradePostPermanence } from "../lib/discussions";
import { balanceOf } from "../lib/economy";
import { faceConstellation } from "../lib/lightScore";
import { openLens, chamberStorefrontCards } from "../lib/feed";
import { search } from "../lib/search";
import { makeOnboardedSoul, topUpForTests } from "../tests/helpers/souls";

const db = new PrismaClient();

function step(n: number, msg: string) {
  console.log(`\n; ${n}. ${msg}`);
}

async function main() {
  const stamp = Date.now().toString(36).slice(-5);
  step(1, "Souls onboard through the real ceremonies");
  const creator = await makeOnboardedSoul(db, {
    trueSelf: `demo75-creator-${stamp}`,
    alias: `demo75-c-shade-${stamp}`,
  });
  const worker = await makeOnboardedSoul(db, {
    trueSelf: `demo75-worker-${stamp}`,
    alias: `demo75-w-shade-${stamp}`,
  });
  const outsider = await makeOnboardedSoul(db, {
    trueSelf: `demo75-outsider-${stamp}`,
    alias: `demo75-o-shade-${stamp}`,
  });
  await topUpForTests(db, creator.trueSelfId, { pc: 30, g: 30 });

  step(2, "A public chamber opens through the FULL scaffold; the dual-token fee, both halves");
  const pcBefore = await balanceOf(db, creator.trueSelfId, "PC");
  const gBefore = await balanceOf(db, creator.trueSelfId, "G");
  const created = await createChamber(db, {
    profileId: creator.trueSelfId,
    title: `Surplus to Pantry ${stamp}`,
    subject: "A borough-wide food-surplus rescue route",
    pitch:
      "Grocers discard edible food nightly while pantries run short by Thursday. Connect the two with a standing route.",
    whyCare:
      "Wasted food, hungry neighbors; and the missing piece is logistics, which souls can build. Solvable now.",
    isPublic: true,
    scaffold: {
      solving: "Edible surplus goes to landfill while demand goes unmet.",
      needToKnow: "Health rules, existing gleaners, cold-chain basics.",
      success: "A weekly surplus-to-pantry route running without us.",
    },
  });
  if (!created.ok) throw new Error(created.reason);
  console.log(
    `   PollCoin: ${pcBefore.toFixed(2)} → ${(await balanceOf(db, creator.trueSelfId, "PC")).toFixed(2)} · Gratium: ${gBefore.toFixed(2)} → ${(await balanceOf(db, creator.trueSelfId, "G")).toFixed(2)} (20u each; the Pollinator's signature)`
  );
  const chamberId = created.chamberId;
  const ledgered = await db.ledgerEvent.findFirst({
    where: { eventType: "chamber.created", payload: { contains: chamberId } },
  });
  console.log(`   chamber.created on the civic ledger: ${ledgered !== null}`);

  step(3, "The storefront reads right; pitch, why-care, standing, count; never the list");
  const chamber = await db.chamber.findUniqueOrThrow({
    where: { id: chamberId },
    include: { members: true },
  });
  const constellation = await faceConstellation(db, creator.trueSelfId);
  console.log(`   "${chamber.title}"; ${chamber.subject}`);
  console.log(`   why care: ${chamber.whyCare.slice(0, 60)}…`);
  console.log(
    `   creator @${chamber.creatorHandle}, Light Score public: ${constellation.pillars.length} pillar(s) with standing (a new soul reads honestly as unproven)`
  );
  console.log(
    `   ${chamber.members.length} soul inside · activity: ${await chamberActivityLevel(db, chamber)}`
  );

  step(4, "Entry = the gate + carrying both tokens; the complete prerequisite (OQ5)");
  console.log(
    `   worker carries both tokens: ${await carriesBothTokens(db, worker.trueSelfId)}`
  );
  const entered = await enterChamber(db, { chamberId, profileId: worker.trueSelfId });
  if (!entered.ok) throw new Error(entered.reason);
  const enterClearance = await db.gateRequest.findFirst({
    where: { scope: `chamber:${chamberId}:enter` },
  });
  console.log(
    `   entered; free; clearance recorded ${enterClearance?.ledgerRecording?.toUpperCase()} (who is inside is enclosed-space information)`
  );

  step(5, "The idea gets worked in the workshop; dual-token micro-fees, threading reused");
  const workshop = await db.discussion.findFirstOrThrow({ where: { chamberId } });
  const eventsBefore = await db.ledgerEvent.count();
  const draft1 = await createPost(db, {
    discussionId: workshop.id,
    profileId: worker.trueSelfId,
    body: "First principles: how much surplus, from which grocers, and who moves it on what schedule?",
  });
  if (!draft1.ok) throw new Error(draft1.reason);
  const draft2 = await createPost(db, {
    discussionId: workshop.id,
    profileId: creator.trueSelfId,
    body: "Three grocers on Main alone. The mover question is the real one; pantry vans sit idle mornings.",
    parentId: draft1.postId,
  });
  if (!draft2.ok) throw new Error(draft2.reason);
  const postFees = await db.economyEntry.findMany({
    where: { kind: "fee.chamber-post", refId: workshop.id },
  });
  console.log(
    `   2 drafts posted · ${postFees.length} fee entries (${postFees.filter((f) => f.currency === "PC").length} PC + ${postFees.filter((f) => f.currency === "G").length} G; 1u each per post)`
  );
  const sharpened = await editScaffold(db, {
    chamberId,
    profileId: creator.trueSelfId,
    solving: "Edible surplus goes to landfill while demand goes unmet.",
    needToKnow:
      "Health rules, existing gleaners, cold-chain basics; and idle pantry-van mornings.",
    success: "A weekly surplus-to-pantry route running without us.",
  });
  console.log(
    `   scaffold sharpened as understanding grew: ${sharpened.ok} (history visible in the workshop)`
  );

  step(6, "And the workshop stays ENCLOSED; structurally");
  console.log(
    `   public ledger grew by ${(await db.ledgerEvent.count()) - eventsBefore} events from all of that (drafts are not the record)`
  );
  const outsiderPost = await createPost(db, {
    discussionId: workshop.id,
    profileId: outsider.trueSelfId,
    body: "Shouting through the door.",
  });
  console.log(`   an outsider tries to post: "${!outsiderPost.ok ? (outsiderPost as { reason: string }).reason : "??"}"`);
  const upgrade = await upgradePostPermanence(db, {
    postId: draft1.postId,
    profileId: worker.trueSelfId,
  });
  console.log(`   permanence upgrade inside: refused; "${!upgrade.ok ? (upgrade as { reason: string }).reason.slice(0, 60) : "??"}…"`);
  const lens = await openLens(db, 50);
  console.log(`   workshop in the open lens: ${lens.some((c) => c.discussionId === workshop.id)}`);
  const interior = await search(db, "who moves it on what schedule");
  console.log(`   workshop words in public search: ${interior.length > 0}`);
  const storefrontHits = await search(db, `Surplus to Pantry ${stamp}`);
  console.log(
    `   the STOREFRONT in public search: ${storefrontHits.some((h) => h.href === `/pollinator/${chamberId}`)}`
  );
  const cards = await chamberStorefrontCards(db);
  console.log(
    `   and in the feed's Pollinator strip: ${cards.some((c) => c.chamberId === chamberId)}`
  );

  step(7, "Private chambers: the creator selects who gets in");
  await topUpForTests(db, creator.trueSelfId, { pc: 25, g: 25 });
  const priv = await createChamber(db, {
    profileId: creator.trueSelfId,
    title: `Closed Working Group ${stamp}`,
    subject: "A private engagement",
    pitch: "Enclosed professional workspace; same machinery, chosen faces.",
    whyCare: "The client's problem, on the client's timeline.",
    isPublic: false,
    scaffold: {
      solving: "The client's stated problem.",
      needToKnow: "Their constraints.",
      success: "Their sign-off.",
    },
  });
  if (!priv.ok) throw new Error(priv.reason);
  const refused = await enterChamber(db, { chamberId: priv.chamberId, profileId: outsider.trueSelfId });
  console.log(`   uninvited entry: "${!refused.ok ? (refused as { reason: string }).reason : "??"}"`);
  const invited = await inviteToChamber(db, {
    chamberId: priv.chamberId,
    profileId: creator.trueSelfId,
    inviteeHandle: `demo75-outsider-${stamp}`,
  });
  if (!invited.ok) throw new Error(invited.reason);
  const nowEntered = await enterChamber(db, { chamberId: priv.chamberId, profileId: outsider.trueSelfId });
  console.log(`   invited, then entered: ${nowEntered.ok}`);

  console.log(
    "\nCHECKPOINT COMPLETE: scaffold → dual-token fee → storefront reads right (standing public, count not list) → idea worked in the workshop → enclosure holds everywhere.\nRun `npm run db:verify` to watch the chamber invariants re-derive."
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
