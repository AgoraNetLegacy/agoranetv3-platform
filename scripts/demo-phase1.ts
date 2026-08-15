// Phase 1 checkpoint demo (owner review); the full permanent-record
// lifecycle, compressed. Runs on the same self-contained demo database
// as demo:phase0 (prisma/demo.db), reset on every run:
//
//   1. Seed everything; two souls appear.
//   2. A soul posts in a canonical (permanent) Discussion; the ledger
//      records the clearance and the content hash, pseudonymously.
//   3. A grace-window edit; visible history + a ledger amendment.
//   4. The window closes (simulated; the real rail is 15 minutes) and
//      the record LOCKS: further edits are refused.
//   5. A database tamper of the locked body → db:verify fails loudly.
//   6. A flag is filed; queued for Phase 5, invisible on the ledger.
//   7. db:verify over the honest final state: all checks pass.
//
// The interactive version of this checkpoint: `npm run dev`, pick a dev
// face, and post in any canonical thread; badge, ledger (/ledger), and
// the lock after 15 real minutes.

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
    cwd: REPO_ROOT, env, stdio: "inherit",
  });
  return expectPass ? result.status === 0 : result.status === 1;
}

async function main() {
  banner("1. Fresh database, full seed, two souls");
  execSync("npx prisma db push --skip-generate --force-reset", {
    cwd: REPO_ROOT, env, stdio: "pipe",
  });
  execSync("npx tsx prisma/seed.ts", { cwd: REPO_ROOT, env, stdio: "inherit" });

  const db = new PrismaClient({ datasources: { db: { url: DEMO_DB_URL } } });
  const { createPost, editPost } = await import("../lib/discussions");
  const { fileFlag } = await import("../lib/flags");
  const { makeOnboardedSoul } = await import("../tests/helpers/souls");

  const soul = await makeOnboardedSoul(db, {
    trueSelf: "bright-heron-42",
    alias: "quiet-cedar-17",
  });
  const author = { id: soul.trueSelfId, handle: "bright-heron-42" };
  const flagger = { id: soul.aliasId, handle: "quiet-cedar-17" };
  console.log(`Souls: ${author.handle} (True Self), ${flagger.handle} (Alias)`);

  banner("2. Posting in a permanent space (canonical question 43)");
  const discussion = await db.discussion.findFirstOrThrow({
    where: { question: { position: 43 } },
    include: { question: true },
  });
  console.log(`Space: "${discussion.title.slice(0, 60)}…"`);
  console.log(`Composer badge: 🏛 Permanent record; 15-minute grace window,`);
  console.log(`then your words lock into the record.\n`);

  const posted = await createPost(db, {
    discussionId: discussion.id,
    profileId: author.id,
    body: "It should be the town square that keeps its promises.",
  });
  if (!posted.ok) throw new Error(posted.reason);
  const tail = await db.ledgerEvent.findMany({ orderBy: { seq: "desc" }, take: 2 });
  for (const ev of tail.reverse()) {
    console.log(`#${ev.seq} ${ev.eventType} actor=${ev.actorId}`);
    console.log(`     ${ev.payload.slice(0, 100)}…`);
  }

  banner("3. Grace-window edit; visible history + ledger amendment");
  const edited = await editPost(db, {
    postId: posted.postId,
    profileId: author.id,
    body: "It should be the town square that keeps its promises; and proves it.",
  });
  console.log(edited.ok ? "Edit accepted inside the window." : `UNEXPECTED: ${edited.reason}`);
  const revisions = await db.postRevision.count({ where: { postId: posted.postId } });
  const amendEvent = await db.ledgerEvent.findFirst({
    where: { eventType: "post.amended" }, orderBy: { seq: "desc" },
  });
  console.log(`Visible history: ${revisions} earlier version preserved.`);
  console.log(`#${amendEvent!.seq} post.amended → new contentHash on the ledger.`);

  banner("4. The window closes; the record locks");
  console.log("(Simulating the 15 minutes passing; the rail is data, the clock is real.)");
  await db.post.update({
    where: { id: posted.postId },
    data: { editableUntil: new Date(Date.now() - 1000) },
  });
  const late = await editPost(db, {
    postId: posted.postId,
    profileId: author.id,
    body: "second thoughts",
  });
  console.log(late.ok ? "UNEXPECTED: edit accepted!" : `Edit refused: "${late.reason}"`);

  banner("5. Attacking the locked record in the database");
  await db.post.update({
    where: { id: posted.postId },
    data: { body: "History, quietly rewritten." },
  });
  console.log("Tampered: locked post body changed via direct DB write. Running db:verify…\n");
  const caught = verify(false);
  await db.post.update({
    where: { id: posted.postId },
    data: { body: "It should be the town square that keeps its promises; and proves it." },
  });
  console.log(caught ? "\nCAUGHT; verify failed loudly ✓ (body restored)" : "\nNOT CAUGHT ✗");

  banner("6. A flag is filed; queued, and invisible to the public");
  const before = await db.ledgerEvent.count();
  const flagged = await fileFlag(db, {
    postId: posted.postId,
    profileId: flagger.id,
    ruleId: "R1.2",
    note: "demo flag",
  });
  const after = await db.ledgerEvent.count();
  console.log(flagged.ok ? "Flag queued for Phase 5's adjudicators." : `UNEXPECTED: ${flagged.reason}`);
  console.log(`Ledger events before: ${before}, after: ${after}; the public learns nothing.`);

  await db.$disconnect();

  banner("7. db:verify over the honest final state");
  const passed = verify(true);
  process.exit(passed && caught ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
