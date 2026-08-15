// Phase 5 checkpoint demo (owner review); a flag travels the whole
// road: filed → blurred → offered → ruled with citation → consequences
// auto-applied → tombstone → appeal → reversal; triangle of blindness
// intact, every resolution on the ledger, notifications in their tiers.

import { execSync, spawnSync } from "child_process";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

const REPO_ROOT = resolve(__dirname, "..");
const DEMO_DB_URL = `file:${resolve(REPO_ROOT, "prisma", "demo.db")}`;
const env = { ...process.env, DATABASE_URL: DEMO_DB_URL };

function banner(title: string) {
  console.log(`\n${"═".repeat(64)}\n  ${title}\n${"═".repeat(64)}`);
}

function verify(): boolean {
  const result = spawnSync("npx", ["tsx", "scripts/verify.ts"], {
    cwd: REPO_ROOT, env, stdio: "inherit",
  });
  return result.status === 0;
}

async function main() {
  banner("1. A soul posts; another soul flags");
  execSync("npx prisma db push --skip-generate --force-reset", { cwd: REPO_ROOT, env, stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { cwd: REPO_ROOT, env, stdio: "pipe" });

  const db = new PrismaClient({ datasources: { db: { url: DEMO_DB_URL } } });
  const { makeOnboardedSoul, topUpForTests } = await import("../tests/helpers/souls");
  const { createPost } = await import("../lib/discussions");
  const { fileFlag } = await import("../lib/flags");
  const mod = await import("../lib/moderation");
  const { inboxFor } = await import("../lib/notifications");
  const { balanceOf } = await import("../lib/economy");

  const author = await makeOnboardedSoul(db, { trueSelf: "accused-heron", alias: "ah-a" });
  const flagger = await makeOnboardedSoul(db, { trueSelf: "watchful-otter", alias: "wo-a" });
  await topUpForTests(db, author.trueSelfId, { pc: 50, g: 10 });

  const canon = await db.discussion.findFirstOrThrow({ where: { permanence: "permanent-canonical" } });
  const posted = await createPost(db, {
    discussionId: canon.id, profileId: author.trueSelfId,
    body: "Persistently derailing noise (for the demo's sake).",
  });
  if (!posted.ok) throw new Error(posted.reason);

  const flagged = await fileFlag(db, {
    postId: posted.postId, profileId: flagger.trueSelfId, ruleId: "R1.2",
    note: "sustained derailing",
  });
  if (!flagged.ok) throw new Error(flagged.reason);
  const post1 = await db.post.findUniqueOrThrow({ where: { id: posted.postId } });
  console.log(`Flag filed (5 PC deposit held). Content is now: ${post1.status.toUpperCase()}`);
  console.log("; blurred, not erased: a flag is never an instant censor button.");

  banner("2. Sortition offers badges; the inbox rings (time-sensitive)");
  await mod.runModerationSweeps(db);
  const offers = await db.badgeOffer.count({ where: { status: "offered" } });
  console.log(`${offers} badge offer(s) drawn at random from eligible faces (12h to answer).`);
  // The demo needs specific judges; three fresh souls, offered directly.
  const judges = [];
  for (const name of ["judge-wren", "judge-lynx", "judge-birch"]) {
    const soul = await makeOnboardedSoul(db, { trueSelf: name, alias: `${name}-a` });
    const offer = await db.badgeOffer.create({
      data: { profileId: soul.trueSelfId, expiresAt: new Date(Date.now() + 3_600_000) },
    });
    const equipped = await mod.equipBadge(db, { offerId: offer.id, profileId: soul.trueSelfId });
    if (!equipped.ok) throw new Error(equipped.reason);
    judges.push(soul);
  }
  const judgeInbox = await inboxFor(db, judges[0].trueSelfId);
  console.log(`A judge's inbox (time-sensitive): ${judgeInbox.timeSensitive.map((n) => n.category).join(", ") || "; "}`);

  banner("3. The minimal case file; content, never a person");
  const modCase = await db.modCase.findFirstOrThrow({ where: { postId: posted.postId } });
  const file = await mod.caseFileFor(db, modCase.id);
  console.log(`Alleged: ${file.allegedRule} (tier ${file.tier}) · pillar: ${file.pillar}${file.heavy ? " · HEAVY: permanent space → 3 independent rulings" : ""}`);
  console.log(`Content: “${file.content}”`);
  console.log(`Accused shown as: ${file.accusedActiveStrikes} active strike(s), ${file.accusedPillarStanding} standing; no handle, no history, no identity.`);
  const leaked = JSON.stringify(file).includes("accused-heron") || JSON.stringify(file).includes("watchful-otter");
  console.log(`Case file names anyone? ${leaked ? "LEAKED ✗" : "no; the triangle holds ✓"}`);

  banner("4. Three rulings, one citation; consequences apply themselves");
  for (const judge of judges) {
    const ruled = await mod.submitRuling(db, {
      caseId: modCase.id, profileId: judge.trueSelfId,
      verdict: "uphold", citedRuleId: "R1.2",
    });
    if (!ruled.ok) throw new Error(ruled.reason);
  }
  const resolved = await db.modCase.findUniqueOrThrow({ where: { id: modCase.id } });
  const post2 = await db.post.findUniqueOrThrow({ where: { id: posted.postId } });
  console.log(`Case ${resolved.outcome?.toUpperCase()}; content is now: ${post2.status.toUpperCase()} (the tombstone).`);
  console.log(`Strikes on the accused: ${await mod.activeStrikeCount(db, author.trueSelfId)} (ladder auto-applied: Gratium penalty + pillar-scoped deduction).`);

  const tombstone = await db.ledgerEvent.findFirst({ where: { eventType: "content.removed" }, orderBy: { seq: "desc" } });
  const resolution = await db.ledgerEvent.findFirst({ where: { eventType: "case.resolved" }, orderBy: { seq: "desc" } });
  console.log(`Ledger #${tombstone!.seq} content.removed; cites ${JSON.parse(tombstone!.payload).rule}.`);
  console.log(`Ledger #${resolution!.seq} case.resolved; rulings appear as nullifiers only: ${resolution!.payload.includes("judge-wren") ? "LEAKED ✗" : "no names ✓"}`);

  const refund = await db.economyEntry.findFirst({ where: { kind: "refund.flag" } });
  console.log(`Flagger's deposit: ${refund ? "refunded (upheld)" : "MISSING ✗"}. Judges paid per case resolved, treasury-funded.`);

  const accusedInbox = await inboxFor(db, author.trueSelfId);
  const flaggerInbox = await inboxFor(db, flagger.trueSelfId);
  console.log(`Accused notified (time-sensitive): "${accusedInbox.timeSensitive[0]?.title}"`);
  console.log(`Flagger notified (time-sensitive): "${flaggerInbox.timeSensitive[0]?.title}"`);

  banner("5. The appeal; fresh eyes reverse it");
  const appealed = await mod.appealCase(db, { caseId: modCase.id, profileId: author.trueSelfId });
  if (!appealed.ok) throw new Error(appealed.reason);
  console.log("Appeal filed (25 PC deposit; returned only if the ruling changes).");
  const stale = await mod.submitRuling(db, {
    caseId: appealed.appealCaseId, profileId: judges[0].trueSelfId, verdict: "decline",
  });
  console.log(`An original judge tries to rule the appeal: ${stale.ok ? "ALLOWED ✗" : `refused; "${!stale.ok && stale.reason}"`}`);
  for (const name of ["fresh-aspen", "fresh-cedar", "fresh-fox"]) {
    const soul = await makeOnboardedSoul(db, { trueSelf: name, alias: `${name}-a` });
    const offer = await db.badgeOffer.create({
      data: { profileId: soul.trueSelfId, expiresAt: new Date(Date.now() + 3_600_000) },
    });
    await mod.equipBadge(db, { offerId: offer.id, profileId: soul.trueSelfId });
    await mod.submitRuling(db, {
      caseId: appealed.appealCaseId, profileId: soul.trueSelfId, verdict: "decline",
    });
  }
  const post3 = await db.post.findUniqueOrThrow({ where: { id: posted.postId } });
  const appealRefund = await db.economyEntry.findFirst({ where: { kind: "refund.appeal" } });
  console.log(`Appeal succeeded: content is ${post3.status.toUpperCase()} again, strike unwound, deposit ${appealRefund ? "refunded" : "MISSING ✗"}.`);
  console.log(`Author's PC balance: ${(await balanceOf(db, author.trueSelfId, "PC")).toFixed(2)}.`);

  banner("6. Severe lane: the Tribunal, seated from badge-completers");
  const severePost = await createPost(db, {
    discussionId: canon.id, profileId: author.trueSelfId,
    body: "Severe-category content (demo).",
  });
  if (!severePost.ok) throw new Error(severePost.reason);
  await fileFlag(db, { postId: severePost.postId, profileId: flagger.trueSelfId, ruleId: "R3.2" });
  await mod.seatTribunal(db);
  const seats = await db.tribunalSeat.findMany({ where: { termEnd: { gt: new Date() } } });
  console.log(`Tribunal seated: ${seats.length} member(s), drawn from badge-completers (interim rule), stipend paid from the treasury.`);
  const severeCase = await db.modCase.findFirstOrThrow({ where: { postId: severePost.postId } });
  for (const seat of seats) {
    await mod.submitTribunalRuling(db, {
      caseId: severeCase.id, profileId: seat.profileId,
      verdict: "uphold", citedRuleId: "R3.2",
    });
  }
  const severeResolved = await db.modCase.findUniqueOrThrow({ where: { id: severeCase.id } });
  console.log(`Tribunal verdict by majority of seats: ${severeResolved.outcome?.toUpperCase()}.`);

  await db.$disconnect();

  banner("7. db:verify; 20 checks over the honest final state");
  process.exit(verify() ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
