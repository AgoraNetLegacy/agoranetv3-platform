// Feed & Search (Phase 7; FEED_AND_SEARCH_SPEC) and the transparency
// books. The invariants under test: chosen-not-inferred with honest
// cold-start defaults; per-persona absolutely (a human's two faces have
// two disjoint reading worlds); the enclosed-space rule (rooms surface
// only to members, never in public search); the published lens formula;
// the feed ends; search history is the soul's own and never a ranking
// input; the snapshot re-derives and drift FAILS LOUDLY; the
// budgeted-categories guardrail throws on unmapped flows.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "child_process";
import { createTestDb, REPO_ROOT } from "./helpers/testDb";

const { url } = createTestDb("feedsearch");
process.env.DATABASE_URL = url;
process.env.GATE_OPERATOR_SECRET = "test-secret-for-feedsearch-tests";

import { PrismaClient } from "@prisma/client";
import { ensureFeedDefaults, chosenSources, buildFeed, openLens } from "../lib/feed";
import { search, recordSearch } from "../lib/search";
import {
  computeBooks,
  ensureDailySnapshot,
  kindInfo,
  moderationStats,
} from "../lib/transparency";
import { formCircle, joinCircle } from "../lib/circles";
import { createPost } from "../lib/discussions";
import { makeOnboardedSoul, topUpForTests } from "./helpers/souls";

const db = new PrismaClient({ datasources: { db: { url } } });

let humanTrueSelfId: string; // one human's two faces;
let humanAliasId: string; //   the per-persona separation cast
let otherSoulId: string;
let compassionId: string;

function runVerify() {
  return spawnSync("npx", ["tsx", "scripts/verify.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
}

beforeAll(async () => {
  const seeded = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  if (seeded.status !== 0) throw new Error(`seed failed: ${seeded.stderr}`);

  const a = await makeOnboardedSoul(db, { trueSelf: "dana", alias: "dana-veil" });
  const b = await makeOnboardedSoul(db, { trueSelf: "eryn", alias: "eryn-veil" });
  humanTrueSelfId = a.trueSelfId;
  humanAliasId = a.aliasId;
  otherSoulId = b.trueSelfId;
  for (const id of [humanTrueSelfId, humanAliasId, otherSoulId]) {
    await topUpForTests(db, id, { pc: 200, g: 200 });
  }
  compassionId = (await db.pillar.findUniqueOrThrow({ where: { slug: "compassion" } })).id;
}, 120_000);

afterAll(async () => {
  await db.$disconnect();
});

describe("the feed", () => {
  it("cold-starts every face with all seven pillars, the lens, and the diet", async () => {
    const settings = await ensureFeedDefaults(db, humanTrueSelfId);
    expect(settings.openLens).toBe(true);
    expect(settings.balancedDiet).toBe(true);
    const sources = await chosenSources(db, humanTrueSelfId);
    expect(sources.pillarIds.size).toBe(7);
    expect(sources.fellowSouls).toBe(false); // off by default, always
  });

  it("shows chosen-source cards with why-lines, then ends", async () => {
    const thread = await db.discussion.findFirstOrThrow({
      where: { pillarId: compassionId, questionId: { not: null } },
    });
    const post = await createPost(db, {
      profileId: otherSoulId,
      discussionId: thread.id,
      body: "Something worth surfacing.",
    });
    expect(post.ok).toBe(true);

    const { cards } = await buildFeed(db, humanTrueSelfId);
    const card = cards.find((c) => c.discussionId === thread.id);
    expect(card).toBeTruthy();
    expect(card!.whyLine).toContain("you follow Compassion");

    // The feed ends: mark caught up, and the same card is gone.
    await db.feedSettings.update({
      where: { profileId: humanTrueSelfId },
      data: { caughtUpAt: new Date() },
    });
    const after = await buildFeed(db, humanTrueSelfId);
    expect(after.cards.find((c) => c.discussionId === thread.id)).toBeUndefined();
  });

  it("keeps a human's two faces in two disjoint reading worlds", async () => {
    // The Alias tunes its sources down to one pillar; the True Self's
    // stay untouched; and vice versa.
    await ensureFeedDefaults(db, humanAliasId);
    await db.feedSource.deleteMany({
      where: { profileId: humanAliasId, kind: "pillar", refId: { not: compassionId } },
    });
    const aliasSources = await chosenSources(db, humanAliasId);
    const trueSources = await chosenSources(db, humanTrueSelfId);
    expect(aliasSources.pillarIds.size).toBe(1);
    expect(trueSources.pillarIds.size).toBe(7);
    // And nothing in the schema aggregates them: every row is one face's.
    const rows = await db.feedSource.findMany();
    for (const r of rows) expect([humanTrueSelfId, humanAliasId, otherSoulId]).toContain(r.profileId);
  });

  it("surfaces a members' room only to a member who chose it", async () => {
    const formed = await formCircle(db, {
      profileId: otherSoulId,
      name: "Kelowna Repair Crew",
      purpose: "Fix what the city won't.",
      pillarId: compassionId,
      placeTag: "Kelowna, BC",
    });
    if (!formed.ok) throw new Error(formed.reason);
    const room = await db.discussion.findFirstOrThrow({
      where: { circleId: formed.circleId },
    });
    const roomPost = await createPost(db, {
      profileId: otherSoulId,
      discussionId: room.id,
      body: "Members-only planning talk.",
    });
    expect(roomPost.ok).toBe(true);
    await db.feedSource.create({
      data: { profileId: otherSoulId, kind: "circle", refId: formed.circleId },
    });

    // The member founder sees the room card; the non-member; even one
    // who forges the source row; does not.
    const memberFeed = await buildFeed(db, otherSoulId);
    expect(memberFeed.cards.some((c) => c.discussionId === room.id)).toBe(true);

    await db.feedSource.create({
      data: { profileId: humanTrueSelfId, kind: "circle", refId: formed.circleId },
    });
    const outsiderFeed = await buildFeed(db, humanTrueSelfId);
    expect(outsiderFeed.cards.some((c) => c.discussionId === room.id)).toBe(false);
  });

  it("ranks the open lens by the published formula and excludes rooms", async () => {
    const lens = await openLens(db);
    for (const card of lens) {
      expect(card.whyLine).toContain("Open lens");
      // Room content never reaches the lens; every lens discussion is public.
      const d = await db.discussion.findUniqueOrThrow({ where: { id: card.discussionId } });
      expect(d.circleId).toBeNull();
    }
    // The formula's arithmetic is shown and reproducible.
    if (lens.length > 0) {
      expect(lens[0].scoreParts).toMatch(/\(\d+.*×.*\)/);
      expect([...lens].sort((a, b) => b.score - a.score)).toEqual(lens);
    }
  });
});

describe("search", () => {
  it("finds a Circle by searching its city (the checkpoint step)", async () => {
    const hits = await search(db, "Kelowna");
    const place = hits.find((h) => h.type === "places");
    expect(place?.title).toBe("Kelowna Repair Crew");
  });

  it("looks up registered souls by handle and display name", async () => {
    const hits = await search(db, "dana", { types: ["souls"] });
    expect(hits.some((h) => h.title.includes("@dana"))).toBe(true);
    const veil = await search(db, "dana-veil", { types: ["souls"] });
    expect(veil.some((h) => h.title.includes("@dana-veil"))).toBe(true);
    const visibleAlias = veil;

    // Both identities appear as separate public records when visible;
    // nothing marks them as related.
    for (const h of [...hits, ...visibleAlias]) {
      expect(h.badge ?? "").not.toContain("alias of");
    }
  });

  it("never returns members'-room content in public search", async () => {
    const hits = await search(db, "Members-only planning talk");
    expect(hits).toHaveLength(0);
  });

  it("searches canon, domains, rules, and rails", async () => {
    const canon = await search(db, "Decoupling Care", { types: ["canon"] });
    expect(canon.some((h) => h.href.includes("/domains/1"))).toBe(true);
    const rules = await search(db, "R1", { types: ["civic-records"] });
    expect(rules.length).toBeGreaterThan(0);
    const help = await search(db, "reply micro-fee", { types: ["help"] }, humanTrueSelfId);
    expect(help.length).toBeGreaterThan(0);
    const anonymousHelp = await search(db, "reply micro-fee", { types: ["help"] });
    expect(anonymousHelp).toHaveLength(0);
    const anonymousOnboarding = await search(db, "Verify once", { types: ["help"] });
    expect(anonymousOnboarding.some((hit) => hit.href === "/support/verify-once")).toBe(true);
  });

  it("keeps history per-face, visible, deletable; and never a ranking input", async () => {
    await recordSearch(db, humanTrueSelfId, "housing first");
    await recordSearch(db, humanAliasId, "different world");
    const mine = await db.searchQuery.findMany({ where: { profileId: humanTrueSelfId } });
    const aliasQs = await db.searchQuery.findMany({ where: { profileId: humanAliasId } });
    expect(mine.map((q) => q.query)).toContain("housing first");
    expect(mine.map((q) => q.query)).not.toContain("different world");
    expect(aliasQs.map((q) => q.query)).toContain("different world");

    // Identical results signed-in and signed-out (public types): no
    // personalization anywhere.
    const anon = await search(db, "Kelowna");
    const signedIn = await search(db, "Kelowna", {}, humanTrueSelfId);
    expect(anon.filter((h) => h.type !== "fellow-souls" && h.type !== "souls").map((h) => h.href))
      .toEqual(signedIn.filter((h) => h.type !== "fellow-souls" && h.type !== "souls").map((h) => h.href));

    await db.searchQuery.deleteMany({ where: { profileId: humanTrueSelfId } });
    expect(await db.searchQuery.count({ where: { profileId: humanTrueSelfId } })).toBe(0);
  });
});

describe("the transparency books", () => {
  it("computes the books, snapshots the day, and re-derives exactly", async () => {
    const snapshot = await ensureDailySnapshot(db);
    const again = await ensureDailySnapshot(db);
    expect(again.id).toBe(snapshot.id); // one per day

    const rederived = await computeBooks(db, snapshot.takenAt);
    const stored = JSON.parse(snapshot.balances);
    expect(Math.abs(rederived.balances.PC - stored.PC)).toBeLessThan(1e-6);
    expect(Math.abs(rederived.balances.G - stored.G)).toBeLessThan(1e-6);

    const verify = runVerify();
    expect(verify.status).toBe(0);
    expect(verify.stdout).toContain("Transparency books");
    expect(verify.stdout).toContain("Feed & search privacy");
    expect(verify.stdout).toContain("Domain & Picture integrity");
  });

  it("FAILS LOUDLY on snapshot drift (the dashboard is a view, not books)", async () => {
    const snapshot = await db.treasurySnapshot.findFirstOrThrow();
    const original = snapshot.balances;
    await db.treasurySnapshot.update({
      where: { id: snapshot.id },
      data: { balances: JSON.stringify({ PC: 999999, G: 0 }) },
    });
    const verify = runVerify();
    expect(verify.status).not.toBe(0);
    expect(verify.stdout + verify.stderr).toContain("SNAPSHOT DRIFT");
    await db.treasurySnapshot.update({
      where: { id: snapshot.id },
      data: { balances: original },
    });
  });

  it("THROWS on an uncategorized flow (the budgeted-categories guardrail)", () => {
    expect(() => kindInfo("fee.mystery")).toThrowError(/guardrail/);
  });

  it("publishes moderation stats as aggregates only", async () => {
    const stats = await moderationStats(db);
    // Shape only; this suite has no cases; the values are honest zeros.
    expect(stats).toHaveProperty("badgeTermsServed");
    expect(stats).toHaveProperty("casesByStatus");
    expect(JSON.stringify(stats)).not.toMatch(/profileId|handle/);
  });
});
