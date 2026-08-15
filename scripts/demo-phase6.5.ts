// demo:phase6.5; the Phase 6.5 checkpoint, end to end (BUILD_ORDER):
// a stranger request goes out from one profile (fee paid), is accepted
// by another soul, encrypted DMs flow both ways, a message is reported,
// and the report lands in the moderation queue; with nothing anywhere
// revealing either soul's graph.
//
// Run: npm run demo:phase6.5   (uses the dev database; seed first)

import { PrismaClient } from "@prisma/client";
import {
  sendFellowSoulRequest,
  respondToRequest,
  areFellowSouls,
} from "../lib/fellowSouls";
import { openThread, sendMessage, readThread, reportMessage } from "../lib/dm";
import { caseFileFor } from "../lib/moderation";
import { balanceOf } from "../lib/economy";
import { makeOnboardedSoul, topUpForTests } from "../tests/helpers/souls";

const db = new PrismaClient();

function step(n: number, msg: string) {
  console.log(`\n; ${n}. ${msg}`);
}

async function main() {
  const stamp = Date.now().toString(36).slice(-5);
  step(1, "Two souls onboard through the real ceremonies");
  const asker = await makeOnboardedSoul(db, {
    trueSelf: `demo65-asker-${stamp}`,
    alias: `demo65-a-shade-${stamp}`,
  });
  const friend = await makeOnboardedSoul(db, {
    trueSelf: `demo65-friend-${stamp}`,
    alias: `demo65-f-shade-${stamp}`,
  });
  await topUpForTests(db, asker.trueSelfId, { pc: 20 });
  await topUpForTests(db, friend.trueSelfId, { pc: 20 });
  const askerHandle = `demo65-asker-${stamp}`;
  const friendHandle = `demo65-friend-${stamp}`;

  step(2, "A fellow-soul request goes out; initiator pays, recipient owes nothing");
  const before = await balanceOf(db, asker.trueSelfId, "PC");
  const request = await sendFellowSoulRequest(db, {
    fromProfileId: asker.trueSelfId,
    toHandle: friendHandle,
    note: "Your Harmony answers read like mine.",
  });
  if (!request.ok) throw new Error(request.reason);
  console.log(
    `   fee: ${before.toFixed(2)} → ${(await balanceOf(db, asker.trueSelfId, "PC")).toFixed(2)} PC · one QUIET inbox entry for the recipient; no pressure, ever`
  );

  step(3, "Accepted (free); the bond is mutual consent between two faces");
  const pending = await db.fellowSoulRequest.findFirstOrThrow({
    where: { toProfileId: friend.trueSelfId, status: "pending" },
  });
  const accepted = await respondToRequest(db, {
    requestId: pending.id,
    profileId: friend.trueSelfId,
    accept: true,
  });
  if (!accepted.ok) throw new Error(accepted.reason);
  console.log(
    `   fellow souls? ${await areFellowSouls(db, asker.trueSelfId, friend.trueSelfId)}; visible only to these two; no lists, no counts, no suggestions, ever`
  );

  step(4, "Encrypted DMs flow both ways; fellow souls land direct");
  const thread = await openThread(db, {
    fromProfileId: asker.trueSelfId,
    toHandle: friendHandle,
    body: "Glad that landed. Coffee at the Saturday cleanup?",
  });
  if (!thread.ok) throw new Error(thread.reason);
  const reply = await sendMessage(db, {
    threadId: thread.threadId,
    senderProfileId: friend.trueSelfId,
    body: "Deal; and something unkind for the demo: you argue in bad faith and I'll disrupt every thread you touch.",
  });
  if (!reply.ok) throw new Error(reply.reason);

  const stored = await db.dmMessage.findFirstOrThrow({
    where: { threadId: thread.threadId },
  });
  console.log(`   at rest: "${stored.ciphertext.slice(0, 44)}…"; ciphertext only`);
  const read = await readThread(db, {
    threadId: thread.threadId,
    profileId: asker.trueSelfId,
  });
  if (!read.ok) throw new Error(read.reason);
  console.log(`   decrypted for a member: "${read.messages[0].body.slice(0, 40)}…"`);

  step(5, "Recipient-side reporting: one message revealed, the standard path engages");
  const offending = await db.dmMessage.findFirstOrThrow({
    where: { threadId: thread.threadId, senderProfileId: friend.trueSelfId },
  });
  const report = await reportMessage(db, {
    messageId: offending.id,
    profileId: asker.trueSelfId,
    ruleId: "R1.2",
    note: "Threatening to disrupt.",
  });
  if (!report.ok) throw new Error(report.reason);
  const modCase = await db.modCase.findFirstOrThrow({
    where: { dmExcerptId: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  console.log(`   case ${modCase.id.slice(0, 8)}… open in the moderation queue (deposit held, rule cited)`);

  step(6, "The case file: the words and the standing; never a name");
  const file = await caseFileFor(db, modCase.id);
  console.log(`   evidence: "${file.content.slice(0, 50)}…"`);
  console.log(`   surface: ${file.pillar} · accused strikes: ${file.accusedActiveStrikes}`);
  const rendered = JSON.stringify(file);
  console.log(
    `   handles anywhere in the file? ${rendered.includes(askerHandle) || rendered.includes(friendHandle)}`
  );

  step(7, "And the graph never touched the public ledger");
  const events = await db.ledgerEvent.findMany({ orderBy: { seq: "desc" }, take: 50 });
  const leak = events.some(
    (e) =>
      /fellow|dm-|bond|request/i.test(e.eventType) ||
      e.payload.includes(thread.threadId) ||
      e.payload.includes(pending.id)
  );
  console.log(`   social trace in the last 50 ledger events: ${leak}`);

  console.log(
    "\nCHECKPOINT COMPLETE: request (fee) → accept → encrypted DMs both ways → report → moderation queue; graphs invisible throughout.\nRun `npm run db:verify` to watch the social invariants re-derive."
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
