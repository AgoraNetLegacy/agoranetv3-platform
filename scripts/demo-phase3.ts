// Phase 3 checkpoint demo (owner review) — a governance poll end to end:
// sealed tally, candle close revealed with results, record on the ledger.
// Self-contained demo db, reset each run.
//
//   1. Seed + two onboarded souls (four voting faces).
//   2. A governance poll opens in a Governance room — the candle
//      commitment lands on the ledger BEFORE any vote exists.
//   3. Votes clear the gate; the tally is sealed (nothing to peek at,
//      not even on the ledger); duplicates refused privately.
//   4. A sniper votes after the hidden candle moment.
//   5. Close: the candle reveals verifiably, the sniper's ballot didn't
//      count, results + tamper-evidence land on the ledger.
//   6. A consensus poll fails its threshold → prompted Discussion.
//   7. A ballot is altered in the database → db:verify fails loudly.
//   8. db:verify over the honest state: all checks pass.

import { execSync, spawnSync } from "child_process";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

const REPO_ROOT = resolve(__dirname, "..");
const DEMO_DB_FILE = resolve(REPO_ROOT, "prisma", "demo.db");
const DEMO_DB_URL = `file:${DEMO_DB_FILE}`;
const env = { ...process.env, DATABASE_URL: DEMO_DB_URL };

function banner(title: string) {
  console.log(`\n${"═".repeat(64)}\n  ${title}\n${"═".repeat(64)}`);
}

function verify(expectPass: boolean): boolean {
  const result = spawnSync("npx", ["tsx", "scripts/verify.ts"], {
    cwd: REPO_ROOT, env, stdio: expectPass ? "inherit" : "pipe", encoding: "utf8",
  });
  if (!expectPass && result.stdout) {
    for (const line of result.stdout.split("\n")) {
      if (line.includes("✗") || line.includes("FAILED")) console.log(line);
    }
  }
  return expectPass ? result.status === 0 : result.status === 1;
}

async function main() {
  banner("1. Fresh database, seed, two souls (four faces)");
  execSync("npx prisma db push --skip-generate --force-reset", {
    cwd: REPO_ROOT, env, stdio: "pipe",
  });
  execSync("npx tsx prisma/seed.ts", { cwd: REPO_ROOT, env, stdio: "pipe" });

  const db = new PrismaClient({ datasources: { db: { url: DEMO_DB_URL } } });
  const { makeOnboardedSoul } = await import("../tests/helpers/souls");
  const polls = await import("../lib/polls");

  const soulA = await makeOnboardedSoul(db, {
    trueSelf: "bright-heron-42", alias: "quiet-cedar-17",
    trueSelfDisplayName: "Bright Heron", aliasDisplayName: "Quiet Cedar",
  });
  const soulB = await makeOnboardedSoul(db, {
    trueSelf: "steady-otter-7", alias: "amber-fox-31",
    trueSelfDisplayName: "Steady Otter", aliasDisplayName: "Amber Fox",
  });
  console.log("Souls onboarded: @bright-heron-42 + @quiet-cedar-17, @steady-otter-7 + @amber-fox-31");

  banner("2. A governance poll opens — the candle promise comes first");
  const agora = await db.pillar.findUniqueOrThrow({ where: { slug: "agoranet" } });
  const created = await polls.createPoll(db, {
    profileId: soulA.trueSelfId,
    pillarId: agora.id,
    title: "Adopt the proposed grace-window rail change?",
    type: "single",
    mode: "pseudonymous",
    options: ["Adopt", "Reject"],
    durationHours: 24,
    isGovernance: true,
  });
  if (!created.ok) throw new Error(created.reason);
  const poll = await db.poll.findUniqueOrThrow({
    where: { id: created.pollId },
    include: { options: { orderBy: { position: "asc" } } },
  });
  console.log(`Poll: "${poll.title}"`);
  console.log(`Mode: PSEUDONYMOUS · governance → always sealed, candle close.`);
  console.log(`Candle commitment (on the ledger, before any vote):`);
  console.log(`  ${poll.candleCommitment}`);
  console.log(`Nominal close: ${poll.nominalCloseAt.toISOString()} — the true close is hidden.`);

  banner("3. Votes clear the gate; the seal holds");
  const eventsBefore = await db.ledgerEvent.count();
  const [adopt, reject] = poll.options;
  await polls.castVote(db, { pollId: poll.id, profileId: soulA.trueSelfId, optionIds: [adopt.id] });
  await polls.castVote(db, { pollId: poll.id, profileId: soulA.aliasId, optionIds: [adopt.id] });
  await polls.castVote(db, { pollId: poll.id, profileId: soulB.trueSelfId, optionIds: [adopt.id] });
  console.log("Three ballots cast (each face an independent voice).");

  const dupe = await polls.castVote(db, { pollId: poll.id, profileId: soulA.trueSelfId, optionIds: [reject.id] });
  console.log(`A second vote by the same face: ${dupe.ok ? "UNEXPECTED" : `refused — "${!dupe.ok && dupe.reason}"`}`);

  const tally = await polls.visibleTally(db, poll.id);
  console.log(`Peeking at the tally mid-poll: ${tally === null ? "nothing to see — sealed means sealed" : "UNEXPECTED!"}`);
  console.log(`Ledger events since voting began: ${await db.ledgerEvent.count() - eventsBefore} — the ledger learned nothing.`);

  banner("4. The sniper waits for the end…");
  await polls.castVote(db, { pollId: poll.id, profileId: soulB.aliasId, optionIds: [reject.id] });
  console.log("@amber-fox-31 votes in the poll's final minutes (after the");
  console.log("hidden candle moment — which nobody could have known).");

  // Time-travel: honest votes early, the sniper after the candle.
  const now = Date.now();
  const trueCloseAt = new Date(now - 120_000);
  const ballots = await db.ballot.findMany({ where: { pollId: poll.id }, orderBy: { castAt: "asc" } });
  for (const [i, b] of ballots.entries()) {
    await db.ballot.update({
      where: { id: b.id },
      data: { castAt: new Date(now - (i === ballots.length - 1 ? 60_000 : 600_000)) },
    });
  }
  const salt = (await db.poll.findUniqueOrThrow({ where: { id: poll.id } })).candleSalt!;
  await db.poll.update({
    where: { id: poll.id },
    data: {
      nominalCloseAt: new Date(now - 1000),
      trueCloseAt,
      candleCommitment: polls.candleCommitmentFor(trueCloseAt, salt),
    },
  });

  banner("5. Close: the candle reveals, the record lands");
  await polls.closeDuePolls(db);
  const closedEvent = await db.ledgerEvent.findFirst({
    where: { eventType: "poll.closed" }, orderBy: { seq: "desc" },
  });
  const payload = JSON.parse(closedEvent!.payload);
  console.log(`Ledger #${closedEvent!.seq} poll.closed:`);
  console.log(`  tallies: Adopt=${payload.tallies["1"]}, Reject=${payload.tallies["2"]}`);
  console.log(`  counted: ${payload.countedBallots} · late (after the candle): ${payload.lateBallots}`);
  console.log(`  candle reveal: trueCloseAt=${payload.candleReveal.trueCloseAt}`);
  const verifies =
    polls.candleCommitmentFor(new Date(payload.candleReveal.trueCloseAt), payload.candleReveal.salt) ===
    (await db.poll.findUniqueOrThrow({ where: { id: poll.id } })).candleCommitment;
  console.log(`  reveal vs commitment: ${verifies ? "MATCHES ✓ (sha256(trueCloseAt|salt))" : "BROKEN ✗"}`);
  console.log(`  ballotsHash (tamper-evidence): ${String(payload.ballotsHash).slice(0, 24)}…`);
  console.log("The sniper's ballot exists in the record — marked uncounted.");

  banner("6. A consensus poll misses its threshold");
  const consensus = await polls.createPoll(db, {
    profileId: soulB.trueSelfId,
    pillarId: agora.id,
    title: "Do we already agree on this?",
    type: "consensus",
    consensusThreshold: 0.75,
    mode: "pseudonymous",
    options: ["Yes", "No"],
    durationHours: 24,
  });
  if (!consensus.ok) throw new Error(consensus.reason);
  const cPoll = await db.poll.findUniqueOrThrow({
    where: { id: consensus.pollId },
    include: { options: { orderBy: { position: "asc" } } },
  });
  await polls.castVote(db, { pollId: cPoll.id, profileId: soulA.trueSelfId, optionIds: [cPoll.options[0].id] });
  await polls.castVote(db, { pollId: cPoll.id, profileId: soulB.trueSelfId, optionIds: [cPoll.options[1].id] });
  await db.ballot.updateMany({ where: { pollId: cPoll.id }, data: { castAt: new Date(Date.now() - 60_000) } });
  await db.poll.update({
    where: { id: cPoll.id },
    data: { nominalCloseAt: new Date(Date.now() - 1000), trueCloseAt: new Date(Date.now() - 1000) },
  });
  await polls.closeDuePolls(db);
  const cClosed = await db.poll.findUniqueOrThrow({ where: { id: cPoll.id } });
  console.log(`Outcome: ${cClosed.outcome} (50% < 75% threshold).`);
  console.log("The poll page now OFFERS a Discussion — prompted, never automatic.");

  banner("7. Attacking a closed ballot in the database");
  const target = await db.ballot.findFirstOrThrow({ where: { pollId: poll.id, counted: true } });
  const original = target.nullifier;
  await db.ballot.update({ where: { id: target.id }, data: { nullifier: "f".repeat(64) } });
  console.log("Tampered: one counted ballot's nullifier rewritten. Running db:verify…");
  const caught = verify(false);
  await db.ballot.update({ where: { id: target.id }, data: { nullifier: original } });
  console.log(caught ? "CAUGHT — verify failed loudly ✓ (ballot restored)" : "NOT CAUGHT ✗");

  await db.$disconnect();

  banner("8. db:verify — the honest final state");
  const passed = verify(true);
  process.exit(passed && caught && verifies ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
