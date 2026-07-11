import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "child_process";
import { createTestDb, REPO_ROOT } from "./helpers/testDb";

const { url } = createTestDb("discussions");
process.env.DATABASE_URL = url;
process.env.GATE_OPERATOR_SECRET = "test-secret-for-discussion-tests";

import { PrismaClient } from "@prisma/client";
import { createPost, editPost, contentHash } from "../lib/discussions";
import { fileFlag } from "../lib/flags";
import { makeOnboardedSoul } from "./helpers/souls";

const db = new PrismaClient({ datasources: { db: { url } } });

let trueSelfId: string;
let aliasId: string;
let discussionId: string;

beforeAll(async () => {
  const seeded = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  if (seeded.status !== 0) throw new Error(`seed failed: ${seeded.stderr}`);

  const soul = await makeOnboardedSoul(db, {
    trueSelf: "steady-otter-7",
    alias: "amber-fox-31",
  });
  trueSelfId = soul.trueSelfId;
  aliasId = soul.aliasId;

  const discussion = await db.discussion.findFirstOrThrow({
    where: { permanence: "permanent-canonical" },
  });
  discussionId = discussion.id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("posting in a permanent space", () => {
  it("records the post on the ledger by content hash, pseudonymously", async () => {
    const result = await createPost(db, {
      discussionId,
      profileId: trueSelfId,
      body: "First words in the permanent record.",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const event = await db.ledgerEvent.findFirst({
      where: { eventType: "post.recorded" },
      orderBy: { seq: "desc" },
    });
    expect(event).not.toBeNull();
    const payload = JSON.parse(event!.payload);
    expect(payload.postRef).toBe(result.postId);
    expect(payload.contentHash).toBe(contentHash("First words in the permanent record."));
    expect(payload.handle).toBe("steady-otter-7");
    expect(event!.payload).not.toContain(trueSelfId);
  });

  it("threads replies under a parent", async () => {
    const top = await db.post.findFirstOrThrow({ where: { discussionId } });
    const result = await createPost(db, {
      discussionId,
      profileId: aliasId,
      body: "A reply from another soul.",
      parentId: top.id,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const reply = await db.post.findUniqueOrThrow({ where: { id: result.postId } });
    expect(reply.parentId).toBe(top.id);
  });

  it("rejects a parent from a different Discussion", async () => {
    const other = await db.discussion.findFirstOrThrow({
      where: { id: { not: discussionId } },
    });
    const foreign = await createPost(db, {
      discussionId: other.id,
      profileId: trueSelfId,
      body: "post in the other discussion",
    });
    expect(foreign.ok).toBe(true);
    if (!foreign.ok) return;
    const bad = await createPost(db, {
      discussionId,
      profileId: trueSelfId,
      body: "cross-thread reply",
      parentId: foreign.postId,
    });
    expect(bad.ok).toBe(false);
  });
});

describe("the grace window", () => {
  it("allows edits inside the window, with visible history and a ledger amendment", async () => {
    const created = await createPost(db, {
      discussionId,
      profileId: trueSelfId,
      body: "A post with a typoo.",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const edited = await editPost(db, {
      postId: created.postId,
      profileId: trueSelfId,
      body: "A post with a typo, repaired.",
    });
    expect(edited.ok).toBe(true);

    const revisions = await db.postRevision.findMany({
      where: { postId: created.postId },
    });
    expect(revisions).toHaveLength(1);
    expect(revisions[0].body).toBe("A post with a typoo.");

    const amend = await db.ledgerEvent.findFirst({
      where: { eventType: "post.amended" },
      orderBy: { seq: "desc" },
    });
    expect(amend).not.toBeNull();
    expect(JSON.parse(amend!.payload).contentHash).toBe(
      contentHash("A post with a typo, repaired.")
    );
  });

  it("refuses edits by anyone but the author", async () => {
    const post = await db.post.findFirstOrThrow({
      where: { authorProfileId: trueSelfId },
    });
    const result = await editPost(db, {
      postId: post.id,
      profileId: aliasId,
      body: "someone else's words",
    });
    expect(result.ok).toBe(false);
  });

  it("locks the record when the window closes", async () => {
    const created = await createPost(db, {
      discussionId,
      profileId: trueSelfId,
      body: "These words will lock.",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await db.post.update({
      where: { id: created.postId },
      data: { editableUntil: new Date(Date.now() - 1000) },
    });

    const result = await editPost(db, {
      postId: created.postId,
      profileId: trueSelfId,
      body: "trying to rewrite history",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("locked");
  });
});

describe("flag capture (queue only, private)", () => {
  it("files a flag citing a rulebook rule, with no ledger event", async () => {
    const post = await db.post.findFirstOrThrow({ where: { discussionId } });
    const before = await db.ledgerEvent.count();

    const result = await fileFlag(db, {
      postId: post.id,
      profileId: aliasId,
      ruleId: "R1.1",
      note: "looks like spam",
    });
    expect(result.ok).toBe(true);

    // The triangle of blindness: the public ledger learns nothing.
    expect(await db.ledgerEvent.count()).toBe(before);

    const flag = await db.flag.findFirstOrThrow({ where: { postId: post.id } });
    expect(flag.status).toBe("in-case"); // Phase 5: the flag met its adjudicators
    expect(flag.ruleId).toBe("R1.1");
    expect(flag.nullifier).toMatch(/^[a-f0-9]{64}$/);
  });

  it("refuses a second flag on the same content by the same profile", async () => {
    const post = await db.post.findFirstOrThrow({ where: { discussionId } });
    const result = await fileFlag(db, {
      postId: post.id,
      profileId: aliasId,
      ruleId: "R1.2",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("already flagged");
  });

  it("refuses a flag that cites no real rule", async () => {
    const post = await db.post.findFirstOrThrow({ where: { discussionId } });
    const result = await fileFlag(db, {
      postId: post.id,
      profileId: trueSelfId,
      ruleId: "R9.9",
    });
    expect(result.ok).toBe(false);
  });
});

describe("db:verify over the whole Phase 1 state", () => {
  function runVerify() {
    return spawnSync("npx", ["tsx", "scripts/verify.ts"], {
      cwd: REPO_ROOT,
      env: { ...process.env, DATABASE_URL: url },
      encoding: "utf8",
    });
  }

  it("passes with posts, edits, locks, and flags in play", () => {
    const result = runVerify();
    expect(result.stdout).toContain("ALL CHECKS PASSED");
    expect(result.status).toBe(0);
  });

  it("fails loudly if a LOCKED permanent record is altered in the database", async () => {
    const locked = await db.post.findFirstOrThrow({
      where: { body: "These words will lock." },
    });
    await db.post.update({
      where: { id: locked.id },
      data: { body: "History, quietly rewritten." },
    });

    const result = runVerify();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain("LOCKED RECORD ALTERED");

    await db.post.update({
      where: { id: locked.id },
      data: { body: "These words will lock." },
    });
  });
});
