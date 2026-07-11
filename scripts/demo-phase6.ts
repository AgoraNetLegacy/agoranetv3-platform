// demo:phase6 — the Phase 6 checkpoint, end to end (BUILD_ORDER):
// a Circle forms (25u fee, thin founder), souls join (Alias warned at a
// small, place-tagged community), the members' room deliberates, a
// Circle-restricted poll decides, an action is logged, attested by 2+
// members, and the attested action lands on the public ledger — with
// Light Score credits recorded for the Phase 7 engine.
//
// Run: npm run demo:phase6   (uses the dev database; seed first)

import { PrismaClient } from "@prisma/client";
import {
  formCircle,
  joinCircle,
  joinNeedsAliasWarning,
  postOffer,
  logAction,
  attestAction,
  alignmentPillarsFor,
  ALIAS_SMALL_COMMUNITY_WARNING,
} from "../lib/circles";
import { createPoll, castVote, closeDuePolls } from "../lib/polls";
import { createPost } from "../lib/discussions";
import { balanceOf } from "../lib/economy";
import { makeOnboardedSoul, topUpForTests } from "../tests/helpers/souls";

const db = new PrismaClient();

function step(n: number, msg: string) {
  console.log(`\n— ${n}. ${msg}`);
}

async function main() {
  const stamp = Date.now().toString(36).slice(-5);
  step(1, "Three souls onboard through the real ceremonies");
  const founder = await makeOnboardedSoul(db, {
    trueSelf: `demo6-founder-${stamp}`,
    alias: `demo6-f-shade-${stamp}`,
  });
  const helper = await makeOnboardedSoul(db, {
    trueSelf: `demo6-helper-${stamp}`,
    alias: `demo6-h-shade-${stamp}`,
  });
  const witness = await makeOnboardedSoul(db, {
    trueSelf: `demo6-witness-${stamp}`,
    alias: `demo6-w-shade-${stamp}`,
  });
  await topUpForTests(db, founder.trueSelfId, { pc: 50 });
  await topUpForTests(db, helper.trueSelfId, { pc: 10 });
  await topUpForTests(db, witness.trueSelfId, { pc: 10 });
  await topUpForTests(db, witness.aliasId, { pc: 10 });

  const pillar = await db.pillar.findFirstOrThrow({ where: { isMeta: false } });

  step(2, `Formation: 25u fee, live immediately, thin founder`);
  const before = await balanceOf(db, founder.trueSelfId, "PC");
  const formed = await formCircle(db, {
    profileId: founder.trueSelfId,
    name: `Fix the Food Bank Gap (${stamp})`,
    purpose: "Close the weekend gap in Kelowna's food bank coverage.",
    pillarId: pillar.id,
    placeTag: "Kelowna, BC",
    problem: "the weekend food bank gap",
  });
  if (!formed.ok) throw new Error(formed.reason);
  const circleId = formed.circleId;
  console.log(
    `   fee paid: ${before.toFixed(2)} → ${(await balanceOf(db, founder.trueSelfId, "PC")).toFixed(2)} PC · circle.formed on the ledger`
  );

  step(3, "Discovery: transparent values-alignment — the why is shown, always");
  const reasons = await alignmentPillarsFor(db, helper.trueSelfId);
  console.log(
    reasons.has(pillar.id)
      ? `   surfaced to the helper because ${reasons.get(pillar.id)}`
      : "   (helper has no alignment yet — browse/filter still finds the circle)"
  );

  step(4, "Joining: True Self joins plainly; the Alias face gets the §5 warning");
  const joined = await joinCircle(db, { circleId, profileId: helper.trueSelfId });
  if (!joined.ok) throw new Error(joined.reason);
  const warned = await joinNeedsAliasWarning(db, circleId, witness.aliasId);
  console.log(`   alias join needs the warning? ${warned}`);
  console.log(`   the warning, verbatim: "${ALIAS_SMALL_COMMUNITY_WARNING}"`);
  const refusedQuietly = await joinCircle(db, { circleId, profileId: witness.aliasId });
  console.log(`   without acceptance: refused (${!refusedQuietly.ok}) — informed choice, never a wall`);
  // The witness chooses their True Self instead — the warning did its job.
  const witnessJoin = await joinCircle(db, { circleId, profileId: witness.trueSelfId });
  if (!witnessJoin.ok) throw new Error(witnessJoin.reason);
  console.log("   witness joined as True Self instead — 3 members");

  step(5, "The members' room deliberates (Circle-scoped Discussion, members-only)");
  const room = await db.discussion.findFirstOrThrow({ where: { circleId } });
  const post = await createPost(db, {
    discussionId: room.id,
    profileId: helper.trueSelfId,
    body: "Saturday plan: meet at the Rutland community centre, 9am. I can drive.",
  });
  if (!post.ok) throw new Error(post.reason);
  console.log("   member posted; the room never touches the public ledger");

  step(6, "Resource board: a pledge, members-only until an action references it");
  const offer = await postOffer(db, {
    circleId,
    profileId: witness.trueSelfId,
    kind: "pledge",
    body: "$200 toward hamper supplies (fulfilled off-platform).",
  });
  if (!offer.ok) throw new Error(offer.reason);

  step(7, "The Circle decides by restricted poll (sealed, per-profile, hash-committed)");
  const poll = await createPoll(db, {
    profileId: founder.trueSelfId,
    pillarId: pillar.id,
    title: "Adopt the Saturday hamper route?",
    type: "consensus",
    mode: "pseudonymous",
    options: ["Adopt", "Decline"],
    durationHours: 1,
    consensusThreshold: 0.6,
    circle: { circleId },
  });
  if (!poll.ok) throw new Error(poll.reason);
  const adopt = await db.pollOption.findFirstOrThrow({
    where: { pollId: poll.pollId, position: 1 },
  });
  for (const voter of [founder.trueSelfId, helper.trueSelfId, witness.trueSelfId]) {
    const v = await castVote(db, { pollId: poll.pollId, profileId: voter, optionIds: [adopt.id] });
    if (!v.ok) throw new Error(v.reason);
  }
  await db.ballot.updateMany({
    where: { pollId: poll.pollId },
    data: { castAt: new Date(Date.now() - 60_000) },
  });
  await db.poll.update({
    where: { id: poll.pollId },
    data: { nominalCloseAt: new Date(Date.now() - 1000), trueCloseAt: new Date(Date.now() - 1000) },
  });
  await closeDuePolls(db);
  const closed = await db.poll.findUniqueOrThrow({ where: { id: poll.pollId } });
  console.log(`   outcome: ${closed.outcome} — and the ledger holds only a contentHash, never the question`);

  step(8, "THE ACTION LOG: logged → attested (2+) → the public civic ledger");
  const logged = await logAction(db, {
    circleId,
    profileId: helper.trueSelfId,
    body: "Delivered 40 hampers covering the weekend gap.",
    didAt: "Saturday morning",
    place: "downtown Kelowna",
    drewOnOfferIds: offer.ok ? [offer.offerId] : [],
  });
  if (!logged.ok) throw new Error(logged.reason);
  let entry = await db.actionEntry.findUniqueOrThrow({ where: { id: logged.entryId } });
  console.log(`   logged (permanence badge shown at composition) · attested? ${entry.attestedAt !== null}`);

  const a1 = await attestAction(db, { entryId: logged.entryId, profileId: founder.trueSelfId });
  if (!a1.ok) throw new Error(a1.reason);
  const a2 = await attestAction(db, { entryId: logged.entryId, profileId: witness.trueSelfId });
  if (!a2.ok) throw new Error(a2.reason);
  entry = await db.actionEntry.findUniqueOrThrow({ where: { id: logged.entryId } });
  console.log(`   two co-signers → ATTESTED at ${entry.attestedAt?.toISOString()}`);

  const selfAttest = await attestAction(db, { entryId: logged.entryId, profileId: helper.trueSelfId });
  console.log(`   author self-attestation refused: ${!selfAttest.ok}`);

  step(9, "The ledger holds the whole story, pseudonym-only");
  const evidence = await db.ledgerEvent.findMany({
    where: {
      OR: [
        { eventType: { in: ["circle.formed", "circle.joined", "action.logged", "action.attested"] } },
      ],
      payload: { contains: circleId },
    },
    orderBy: { seq: "asc" },
  });
  for (const ev of evidence) {
    console.log(`   seq ${ev.seq} · ${ev.eventType} · ${ev.actorId ?? "system"}`);
  }

  step(10, "Light Score crediting — recorded for the Phase 7 engine");
  const credits = await db.lightScoreAdjustment.findMany({
    where: { refId: logged.entryId },
  });
  for (const c of credits) {
    console.log(
      `   +${c.amount} points · ${c.refType} · pillar ${pillar.slug} (explainable cause: "attested action in the Circle")`
    );
  }

  console.log(
    "\nCHECKPOINT COMPLETE: formed → aligned discovery → warned join → room deliberation → restricted poll → logged → attested (2+) → public ledger, with standing recorded.\nRun `npm run db:verify` to watch every invariant re-derive."
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
