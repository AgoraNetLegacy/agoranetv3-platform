// Phase 4 checkpoint demo (owner review) — the internal economy:
// tips, paid permanence, and the treasury filling. Self-contained demo
// db, reset each run.
//
//   1. Two souls onboard — the Welcome Grant funds them (issuance,
//      accounted).
//   2. Fees collect: replies, a poll, votes — the treasury fills.
//   3. A tip moves Gratium reader→author with the 5% treasury cut.
//   4. Paid permanence: an own post in a deletable space becomes
//      permanent record for 15 G, hash-committed.
//   5. Attestation: a human-made mark + a vouched source object.
//   6. The treasury statement — and conservation re-derived by
//      db:verify (a balance inflated from thin air is caught loudly).

import { execSync, spawnSync } from "child_process";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

const REPO_ROOT = resolve(__dirname, "..");
const DEMO_DB_URL = `file:${resolve(REPO_ROOT, "prisma", "demo.db")}`;
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

async function treasuryLine(db: PrismaClient): Promise<string> {
  const rows = await db.treasuryBalance.findMany();
  const pc = rows.find((r) => r.currency === "PC")?.amount ?? 0;
  const g = rows.find((r) => r.currency === "G")?.amount ?? 0;
  return `TREASURY: ${pc.toFixed(2)} PC · ${g.toFixed(2)} G`;
}

async function main() {
  banner("1. Fresh database; two souls onboard; the Welcome Grant lands");
  execSync("npx prisma db push --skip-generate --force-reset", { cwd: REPO_ROOT, env, stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { cwd: REPO_ROOT, env, stdio: "pipe" });

  const db = new PrismaClient({ datasources: { db: { url: DEMO_DB_URL } } });
  const { makeOnboardedSoul } = await import("../tests/helpers/souls");
  const economy = await import("../lib/economy");
  const discussions = await import("../lib/discussions");
  const polls = await import("../lib/polls");

  const a = await makeOnboardedSoul(db, { trueSelf: "bright-heron-42", alias: "quiet-cedar-17" });
  const b = await makeOnboardedSoul(db, { trueSelf: "steady-otter-7", alias: "amber-fox-31" });
  console.log(`@bright-heron-42: ${(await economy.balanceOf(db, a.trueSelfId, "PC")).toFixed(2)} PC · ${(await economy.balanceOf(db, a.trueSelfId, "G")).toFixed(2)} G  (verification grant)`);
  console.log(`@quiet-cedar-17:  ${(await economy.balanceOf(db, a.aliasId, "PC")).toFixed(2)} PC · ${(await economy.balanceOf(db, a.aliasId, "G")).toFixed(2)} G  (hatch grant — born funded, not traceable-by-poverty)`);
  console.log(await treasuryLine(db));

  banner("2. Acting costs — the treasury fills");
  const canon = await db.discussion.findFirstOrThrow({ where: { permanence: "permanent-canonical" } });
  const post1 = await discussions.createPost(db, {
    discussionId: canon.id, profileId: a.trueSelfId,
    body: "A reply that cost one PollCoin — skin in the game.",
  });
  if (!post1.ok) throw new Error(post1.reason);
  console.log("Reply posted: −1 PC fee, +1 PC participation accrual (net-free for a genuine soul), +5 G first-action milestone.");

  const pillar = await db.pillar.findFirstOrThrow();
  const poll = await polls.createPoll(db, {
    profileId: b.trueSelfId, pillarId: pillar.id, title: "Fund the town square?",
    type: "single", mode: "pseudonymous", options: ["Yes", "No"], durationHours: 24,
  });
  if (!poll.ok) throw new Error(poll.reason);
  const option = await db.pollOption.findFirstOrThrow({ where: { pollId: poll.pollId } });
  await polls.castVote(db, { pollId: poll.pollId, profileId: a.trueSelfId, optionIds: [option.id] });
  await polls.castVote(db, { pollId: poll.pollId, profileId: b.trueSelfId, optionIds: [option.id] });
  console.log("Poll created (−10 PC) and two votes cast (−0.25 PC each).");
  console.log(await treasuryLine(db));

  banner("3. A tip — appreciation that costs something");
  const post = await db.post.findFirstOrThrow({ where: { authorProfileId: a.trueSelfId } });
  const authorBefore = await economy.balanceOf(db, a.trueSelfId, "G");
  const tipped = await economy.tip(db, { postId: post.id, tipperProfileId: b.trueSelfId, amount: 2 });
  if (!tipped.ok) throw new Error(tipped.reason);
  const authorAfter = await economy.balanceOf(db, a.trueSelfId, "G");
  console.log(`@steady-otter-7 tips 2 G → author receives ${(authorAfter - authorBefore).toFixed(2)} G, treasury takes the 5% cut.`);
  const stats = await economy.tipStats(db, post.id);
  console.log(`Public appreciation on the post: ${stats.total.toFixed(2)} G from ${stats.uniqueTippers} unique tipper(s) — breadth, never names.`);
  console.log(await treasuryLine(db));

  banner("4. Paid permanence — 15 G to lock your own words into the record");
  const context = await discussions.createPollDiscussion(db, { pollId: poll.pollId, profileId: b.trueSelfId });
  if (!context.ok) throw new Error(context.reason);
  const deletablePost = await discussions.createPost(db, {
    discussionId: context.postId, profileId: b.trueSelfId,
    body: "These words choose to be permanent.",
  });
  if (!deletablePost.ok) throw new Error(deletablePost.reason);
  const upgraded = await discussions.upgradePostPermanence(db, {
    postId: deletablePost.postId, profileId: b.trueSelfId,
  });
  console.log(upgraded.ok
    ? "Upgraded: hash-committed to the ledger; the caveat was shown — the thread around it may still be deleted."
    : `UNEXPECTED: ${upgraded.reason}`);
  console.log(await treasuryLine(db));

  banner("5. Attestation — a human mark and a vouched source");
  const attested = await discussions.createPost(db, {
    discussionId: canon.id, profileId: b.trueSelfId,
    body: "Human-made, and sourced.",
    humanMade: true,
    source: { url: "https://example.org/report", kind: "primary", vouch: "vouched" },
  });
  console.log(attested.ok
    ? "Posted with 'Human-made — my reputation on it' + a vouched source object."
    : `UNEXPECTED: ${attested.reason}`);

  banner("6. Conservation — and the attack");
  console.log(await treasuryLine(db));
  const entries = await db.economyEntry.count();
  console.log(`${entries} economy entries; every balance re-derives from them.`);
  console.log("\nNow a balance is inflated by 1000 PC out of thin air…");
  await db.balance.update({
    where: { profileId_currency: { profileId: a.trueSelfId, currency: "PC" } },
    data: { amount: { increment: 1000 } },
  });
  const caught = verify(false);
  await db.balance.update({
    where: { profileId_currency: { profileId: a.trueSelfId, currency: "PC" } },
    data: { amount: { decrement: 1000 } },
  });
  console.log(caught ? "CAUGHT — conservation broken, verify failed loudly ✓ (restored)" : "NOT CAUGHT ✗");

  await db.$disconnect();

  banner("7. db:verify — the honest final state (17 checks)");
  const passed = verify(true);
  process.exit(passed && caught ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
