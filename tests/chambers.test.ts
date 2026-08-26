// Phase 7.5; Chambers (Pollinator v1). The invariants under test:
// the dual-token signature (creation and workshop posts charge BOTH
// currencies; both halves or neither), the ratified creation
// requirements (scaffold + "why should people care"), the entry
// prerequisites (gate + carrying both tokens; the complete definition,
// owner-resolved OQ5), private chambers as creator-invite-only, and the
// enclosure: workshop content never reaches the ledger, Light Score,
// the open lens, or public search; and db:verify FAILS LOUDLY when it
// does.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "child_process";
import sharp from "sharp";
import { createTestDb, REPO_ROOT } from "./helpers/testDb";

const { url } = createTestDb("chambers");
process.env.DATABASE_URL = url;
process.env.GATE_OPERATOR_SECRET = "test-secret-for-chamber-tests";

import { PrismaClient } from "@prisma/client";
import {
  createChamber,
  enterChamber,
  editScaffold,
  inviteToChamber,
  chamberMembership,
  workshopAccess,
  carriesBothTokens,
  pendingInvitesFor,
} from "../lib/chambers";
import { createPost, upgradePostPermanence } from "../lib/discussions";
import { createPoll, castVote, closeDuePolls } from "../lib/polls";
import { fileReleaseFlag } from "../lib/flags";
import { resolveCase, caseFileFor, appealCase } from "../lib/moderation";
import { balanceOf, tip } from "../lib/economy";
import {
  chamberBalanceOf,
  creditMissionBalance,
  proposeRelease,
  attestRelease,
  freezeChamberReleases,
  declareRaising,
  donateToMission,
  reviseFundingPlan,
  sentinelMissionSweep,
} from "../lib/escrow";
import {
  offerFundAudits,
  acceptFundAudit,
  completeFundAudit,
} from "../lib/fundAudit";
import { faceConstellation } from "../lib/lightScore";
import { buildFeed, openLens, chamberStorefrontCards } from "../lib/feed";
import { search } from "../lib/search";
import { makeOnboardedSoul, topUpForTests } from "./helpers/souls";
import { prepareChamberCover, recordChamberCover } from "../lib/chamberCovers";

const db = new PrismaClient({ datasources: { db: { url } } });

let creatorId: string;
let workerId: string;
let strangerId: string;
let paupergId: string; // a soul drained of Gratium; fails "carrying both"
let publicChamberId: string;
let privateChamberId: string;
let workshopId: string;

function runVerify() {
  return spawnSync("npx", ["tsx", "scripts/verify.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
}

const SCAFFOLD = {
  solving: "Neighborhood food waste: edible surplus goes to landfill.",
  needToKnow: "Local health rules, who already gleans, cold-chain basics.",
  success: "A weekly surplus-to-pantry route running without us.",
};

// The funding plan (FUND_INTEGRITY §3.1, Tier 0): the three answers a
// chamber owes before it may ask anyone for money.
const PLAN = {
  recipient: "The chamber's own members, reimbursed for costs they front.",
  evidence: "Receipts posted to the workshop; our attested action log is public.",
  breakdown: "40u coats · 30u transport · 30u storage totes.",
};

beforeAll(async () => {
  const seeded = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  if (seeded.status !== 0) throw new Error(`seed failed: ${seeded.stderr}`);

  const s1 = await makeOnboardedSoul(db, { trueSelf: "chamber-creator", alias: "cc-shade" });
  const s2 = await makeOnboardedSoul(db, { trueSelf: "chamber-worker", alias: "cw-shade" });
  const s3 = await makeOnboardedSoul(db, { trueSelf: "chamber-stranger", alias: "cs-shade" });
  const s4 = await makeOnboardedSoul(db, { trueSelf: "chamber-pauper", alias: "cp-shade" });
  creatorId = s1.trueSelfId;
  workerId = s2.trueSelfId;
  strangerId = s3.trueSelfId;
  paupergId = s4.trueSelfId;
}, 120_000);

afterAll(async () => {
  await db.$disconnect();
});

describe("creation; the dual-token signature", () => {
  it("refuses a chamber without the scaffold or the why-care answer", async () => {
    const noWhy = await createChamber(db, {
      profileId: creatorId,
      title: "Half-formed",
      subject: "An idea",
      pitch: "A pitch",
      whyCare: "   ",
      isPublic: true,
      scaffold: SCAFFOLD,
    });
    expect(noWhy.ok).toBe(false);
    if (!noWhy.ok) expect(noWhy.reason).toContain("Why should people care");

    const noScaffold = await createChamber(db, {
      profileId: creatorId,
      title: "Adrift",
      subject: "An idea",
      pitch: "A pitch",
      whyCare: "Because reasons",
      isPublic: true,
      scaffold: { ...SCAFFOLD, success: "" },
    });
    expect(noScaffold.ok).toBe(false);
    if (!noScaffold.ok) expect(noScaffold.reason).toContain("scaffold");
    expect(await db.chamber.count()).toBe(0);
  });

  it("refuses creation when EITHER token is short; both halves or neither", async () => {
    // Drain the pauper's Gratium below the 20u fee via a real tip
    // (accounted flow; conservation holds). Verified grant = 25 G.
    const seedPost = await db.post.findFirst({ where: { authorProfileId: { not: paupergId } } });
    // No posts exist yet; make one to tip, from the stranger.
    const canon = await db.discussion.findFirstOrThrow({ where: { questionId: { not: null } } });
    const posted = await createPost(db, {
      discussionId: canon.id,
      profileId: strangerId,
      body: "A substantive first voice, so a tip has a destination.",
    });
    expect(posted.ok).toBe(true);
    if (!posted.ok) return;
    expect(seedPost).toBeNull();
    const tipped = await tip(db, { postId: posted.postId, tipperProfileId: paupergId, amount: 15 });
    expect(tipped.ok).toBe(true);

    const gBefore = await balanceOf(db, paupergId, "G");
    expect(gBefore).toBeLessThan(20);
    const pcBefore = await balanceOf(db, paupergId, "PC");
    expect(pcBefore).toBeGreaterThanOrEqual(20);

    const result = await createChamber(db, {
      profileId: paupergId,
      title: "Underfunded",
      subject: "An idea",
      pitch: "A pitch",
      whyCare: "It matters",
      isPublic: true,
      scaffold: SCAFFOLD,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("Gratium");
    // The transaction rolled back whole: no chamber, and the PC half
    // was not kept.
    expect(await db.chamber.count()).toBe(0);
    expect(await balanceOf(db, paupergId, "PC")).toBe(pcBefore);
    expect(await db.economyEntry.count({ where: { kind: "fee.chamber" } })).toBe(0);
  });

  it("creates a public chamber: dual fee to the treasury, workshop born deletable, creator inside, civic record", async () => {
    const treasuryPcBefore = (await db.treasuryBalance.findUnique({ where: { currency: "PC" } }))?.amount ?? 0;
    const treasuryGBefore = (await db.treasuryBalance.findUnique({ where: { currency: "G" } }))?.amount ?? 0;

    const result = await createChamber(db, {
      profileId: creatorId,
      title: "Surplus to Pantry",
      subject: "A borough-wide food-surplus rescue route",
      pitch: "Grocers discard edible food nightly; pantries run short by Thursday. Connect them.",
      whyCare: "Wasted food, hungry neighbors, and the fix is logistics; solvable now, by us.",
      isPublic: true,
      scaffold: SCAFFOLD,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    publicChamberId = result.chamberId;

    // Both halves reached the treasury (creation is the only fee so far).
    const treasuryPc = (await db.treasuryBalance.findUnique({ where: { currency: "PC" } }))!.amount;
    const treasuryG = (await db.treasuryBalance.findUnique({ where: { currency: "G" } }))!.amount;
    expect(treasuryPc - treasuryPcBefore).toBeCloseTo(20);
    // 15-G tip above paid a 5% cut (0.75) into the treasury before this.
    expect(treasuryG - treasuryGBefore).toBeCloseTo(20);
    const feeEntries = await db.economyEntry.findMany({ where: { kind: "fee.chamber" } });
    expect(feeEntries.map((e) => e.currency).sort()).toEqual(["G", "PC"]);

    // The workshop: exactly one, chamber-scoped, deletable, meta-homed.
    const workshop = await db.discussion.findFirstOrThrow({
      where: { chamberId: publicChamberId },
      include: { pillar: true },
    });
    workshopId = workshop.id;
    expect(workshop.permanence).toBe("deletable");
    expect(workshop.pillar.isMeta).toBe(true);

    // Creator is member #1; creating is a public civic act.
    expect(await chamberMembership(db, publicChamberId, creatorId)).not.toBeNull();
    const created = await db.ledgerEvent.findFirst({ where: { eventType: "chamber.created" } });
    expect(created).not.toBeNull();
    expect(created!.payload).toContain("Surplus to Pantry");
  });
});

describe("public storefront covers", () => {
  it("sanitizes an image, enforces creator ownership, and records every change", async () => {
    const onePixelPng = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: { r: 24, g: 135, b: 157 },
      },
    }).png().toBuffer();
    const prepared = await prepareChamberCover({
      bytes: onePixelPng,
      declaredMime: "image/png",
      altText: "Neighbors carrying rescued food into a community pantry",
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.cover.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(prepared.cover.bytes.subarray(0, 4).toString("hex")).toBe("52494646"); // WebP RIFF

    const refused = await recordChamberCover(db, {
      chamberId: publicChamberId,
      profileId: workerId,
      imageUrl: "https://example.public.blob.vercel-storage.com/refused.webp",
      altText: prepared.cover.altText,
      contentHash: prepared.cover.contentHash,
    });
    expect(refused.ok).toBe(false);

    const added = await recordChamberCover(db, {
      chamberId: publicChamberId,
      profileId: creatorId,
      imageUrl: "https://example.public.blob.vercel-storage.com/first.webp",
      altText: prepared.cover.altText,
      contentHash: prepared.cover.contentHash,
    });
    expect(added.ok).toBe(true);
    const chamber = await db.chamber.findUniqueOrThrow({ where: { id: publicChamberId } });
    expect(chamber.coverImageUrl).toContain("first.webp");
    expect(chamber.coverImageAlt).toBe(prepared.cover.altText);

    const replacementHash = "b".repeat(64);
    const replaced = await recordChamberCover(db, {
      chamberId: publicChamberId,
      profileId: creatorId,
      imageUrl: "https://example.public.blob.vercel-storage.com/second.webp",
      altText: "Volunteers sorting fresh food around a shared table",
      contentHash: replacementHash,
    });
    expect(replaced.ok).toBe(true);
    const events = await db.ledgerEvent.findMany({
      where: { eventType: { startsWith: "chamber.cover-image." } },
      orderBy: { seq: "asc" },
    });
    expect(events.map((event) => event.eventType)).toEqual([
      "chamber.cover-image.added",
      "chamber.cover-image.replaced",
    ]);
    expect(events[1].payload).toContain(prepared.cover.contentHash);
    expect(events.every((event) => !event.payload.includes(creatorId))).toBe(true);
  });

  it("rejects unsupported or inaccessible image input", async () => {
    const onePixelPng = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: { r: 24, g: 135, b: 157 },
      },
    }).png().toBuffer();
    const rejected = await prepareChamberCover({
      bytes: Buffer.from("<svg><script>alert(1)</script></svg>"),
      declaredMime: "image/svg+xml",
      altText: "Unsafe vector",
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.reason).toContain("JPEG, PNG, or WebP");

    const blankAlt = await prepareChamberCover({
      bytes: onePixelPng,
      declaredMime: "image/png",
      altText: " ",
    });
    expect(blankAlt.ok).toBe(true);
    if (blankAlt.ok) expect(blankAlt.cover.altText).toBe("");
  });
});

describe("entry; gate + carrying both tokens, and nothing else", () => {
  it("refuses a soul carrying only one token, and admits them once they carry both", async () => {
    // The pauper spent Gratium down but still holds some (15 tipped of
    // 25); drain to zero with one more tip, then assert refusal.
    const post = await db.post.findFirstOrThrow({ where: { authorProfileId: strangerId } });
    const g = await balanceOf(db, paupergId, "G");
    if (g > 0) {
      const drained = await tip(db, { postId: post.id, tipperProfileId: paupergId, amount: g });
      expect(drained.ok).toBe(true);
    }
    expect(await carriesBothTokens(db, paupergId)).toBe(false);

    const refused = await enterChamber(db, { chamberId: publicChamberId, profileId: paupergId });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toContain("both tokens");

    await topUpForTests(db, paupergId, { g: 5 });
    const admitted = await enterChamber(db, { chamberId: publicChamberId, profileId: paupergId });
    expect(admitted.ok).toBe(true);
  });

  it("admits any verified soul to a public chamber; no Light Score floor, no approval", async () => {
    const result = await enterChamber(db, { chamberId: publicChamberId, profileId: workerId });
    expect(result.ok).toBe(true);
    expect(await workshopAccess(db, publicChamberId, workerId)).toBe(true);
    // Entering is free; no fee entry of any chamber kind for entry.
    expect(await db.economyEntry.count({ where: { kind: "fee.chamber-post" } })).toBe(0);
  });

  it("rejects double entry", async () => {
    const again = await enterChamber(db, { chamberId: publicChamberId, profileId: workerId });
    expect(again.ok).toBe(false);
  });

  it("records entry PRIVATELY; membership is enclosed-space information", async () => {
    const clearances = await db.gateRequest.findMany({
      where: { scope: { startsWith: `chamber:${publicChamberId}:enter` } },
    });
    expect(clearances.length).toBeGreaterThan(0);
    for (const c of clearances) expect(c.ledgerRecording).toBe("private");
    // Aggregates are the public story: count, never the list.
    const memberEvents = await db.ledgerEvent.findMany({
      where: { eventType: { contains: "chamber" } },
    });
    expect(
      memberEvents.every(
        (e) =>
          !e.eventType.includes("entered") &&
          !e.eventType.includes("member") &&
          !e.eventType.includes("joined")
      )
    ).toBe(true);
  });

  it("notifies existing members quietly, aggregated, space-name-only", async () => {
    const note = await db.notification.findFirst({
      where: { profileId: creatorId, category: "chamber-activity" },
    });
    expect(note).not.toBeNull();
    expect(note!.tier).toBe("quiet");
    expect(note!.aggregationKey).toBe(`chamber-activity:${publicChamberId}`);
    // Two entries so far collapsed into one updating row.
    expect(note!.count).toBeGreaterThanOrEqual(2);
  });
});

describe("the workshop; dual-token participation inside the enclosure", () => {
  it("refuses a non-member's post: enter to see, enter to speak", async () => {
    const result = await createPost(db, {
      discussionId: workshopId,
      profileId: strangerId,
      body: "Shouting through the door.",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("Enter the chamber");
  });

  it("charges a member BOTH tokens per post and leaves no public trace", async () => {
    const pcBefore = await balanceOf(db, workerId, "PC");
    const gBefore = await balanceOf(db, workerId, "G");
    const eventsBefore = await db.ledgerEvent.count();

    const result = await createPost(db, {
      discussionId: workshopId,
      profileId: workerId,
      body: "First principles: how much surplus, where, and who moves it?",
    });
    expect(result.ok).toBe(true);

    // −1 PC fee +1 PC accrual = net 0; −1 G, +5 G first-action grant
    // already spent elsewhere? No: worker's first fee-bearing action IS
    // this post → +5 G. Assert the fee entries, not the noisy balances.
    const feePc = await db.economyEntry.findMany({
      where: { kind: "fee.chamber-post", currency: "PC" },
    });
    const feeG = await db.economyEntry.findMany({
      where: { kind: "fee.chamber-post", currency: "G" },
    });
    expect(feePc.length).toBe(1);
    expect(feeG.length).toBe(1);
    expect(feePc[0].amount).toBe(1);
    expect(feeG[0].amount).toBe(1);
    // Sanity: the soul actually paid (fee > accrual leaves PC ≤ before + 0).
    expect(await balanceOf(db, workerId, "PC")).toBeLessThanOrEqual(pcBefore);
    expect(await balanceOf(db, workerId, "G")).toBeGreaterThanOrEqual(gBefore - 1);

    // No public ledger growth from a workshop post: no post.recorded,
    // no gate.cleared (private recording), nothing.
    expect(await db.ledgerEvent.count()).toBe(eventsBefore);
  });

  it("blocks permanence upgrades; drafts stay drafts", async () => {
    const post = await db.post.findFirstOrThrow({ where: { discussionId: workshopId } });
    const result = await upgradePostPermanence(db, { postId: post.id, profileId: workerId });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("Workshop drafts stay in the workshop");
  });

  it("keeps workshop posts out of Light Score; a public number never derives from enclosed activity", async () => {
    const constellation = await faceConstellation(db, workerId);
    // The worker's only post is the workshop draft; standing must be
    // untouched by it (no pillar line from the meta-homed workshop).
    for (const pillar of constellation.pillars) {
      expect(pillar.lines.every((l) => !l.label.includes("answer"))).toBe(true);
    }
    const meta = await db.pillar.findFirstOrThrow({ where: { isMeta: true } });
    expect(constellation.forPillar(meta.id)?.points ?? 0).toBe(0);
  });

  it("lets the creator sharpen the scaffold, versioned; nobody else", async () => {
    const denied = await editScaffold(db, {
      chamberId: publicChamberId,
      profileId: workerId,
      ...SCAFFOLD,
    });
    expect(denied.ok).toBe(false);

    const sharpened = await editScaffold(db, {
      chamberId: publicChamberId,
      profileId: creatorId,
      solving: SCAFFOLD.solving,
      needToKnow: SCAFFOLD.needToKnow + " Also: refrigerated transport costs.",
      success: SCAFFOLD.success,
    });
    expect(sharpened.ok).toBe(true);
    const revisions = await db.chamberScaffoldRevision.findMany({
      where: { chamberId: publicChamberId },
    });
    expect(revisions.length).toBe(1);
    expect(revisions[0].needToKnow).toBe(SCAFFOLD.needToKnow);
  });
});

describe("private chambers; the creator selects who gets in", () => {
  it("creates a private chamber and refuses the uninvited", async () => {
    // The first chamber spent the creator down below a second dual fee;
    // the accounted test faucet stands in for earned balance.
    await topUpForTests(db, creatorId, { pc: 40, g: 40 });
    const result = await createChamber(db, {
      profileId: creatorId,
      title: "Closed Working Group",
      subject: "A private engagement",
      pitch: "Enclosed professional workspace.",
      whyCare: "The client's problem, the client's timeline, now.",
      isPublic: false,
      scaffold: SCAFFOLD,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    privateChamberId = result.chamberId;

    const refused = await enterChamber(db, { chamberId: privateChamberId, profileId: strangerId });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toContain("private");
  });

  it("only the creator invites; public chambers refuse invites", async () => {
    const notCreator = await inviteToChamber(db, {
      chamberId: privateChamberId,
      profileId: workerId,
      inviteeHandle: "chamber-stranger",
    });
    expect(notCreator.ok).toBe(false);

    const wrongKind = await inviteToChamber(db, {
      chamberId: publicChamberId,
      profileId: creatorId,
      inviteeHandle: "chamber-stranger",
    });
    expect(wrongKind.ok).toBe(false);

    const invited = await inviteToChamber(db, {
      chamberId: privateChamberId,
      profileId: creatorId,
      inviteeHandle: "@Chamber-Stranger", // case/@ tolerant
    });
    expect(invited.ok).toBe(true);
  });

  it("shows the invite on the invitee's Pollinator page and admits them", async () => {
    const pending = await pendingInvitesFor(db, strangerId);
    expect(pending.map((i) => i.chamber.title)).toContain("Closed Working Group");

    const entered = await enterChamber(db, { chamberId: privateChamberId, profileId: strangerId });
    expect(entered.ok).toBe(true);
    expect(await pendingInvitesFor(db, strangerId)).toHaveLength(0);
  });
});

describe("the hand-offs; feed and search meet the enclosure", () => {
  it("keeps workshops out of the open lens and pillar-sourced feeds", async () => {
    const lens = await openLens(db);
    expect(lens.every((c) => c.discussionId !== workshopId)).toBe(true);

    // The stranger follows all pillars by default (cold start) but never
    // entered... the stranger DID enter the private chamber. The pauper
    // entered the public one; use a pillar-only feed: the worker with
    // chamber source OFF sees no workshop card either.
    const { cards } = await buildFeed(db, strangerId);
    expect(cards.every((c) => c.discussionId !== workshopId)).toBe(true);
  });

  it("surfaces an entered chamber's workshop ONLY through its chosen source, with the why-line", async () => {
    await db.feedSource.create({
      data: { profileId: creatorId, kind: "chamber", refId: publicChamberId },
    });
    // New activity for the card: the worker's draft is already there;
    // reset the creator's read position to see it.
    const { cards } = await buildFeed(db, creatorId);
    const card = cards.find((c) => c.discussionId === workshopId);
    expect(card).toBeDefined();
    expect(card!.whyLine).toContain("a chamber you've entered");

    // A forged chamber source for a non-member feeds nothing.
    await db.feedSource.create({
      data: { profileId: strangerId, kind: "chamber", refId: publicChamberId },
    });
    const forged = await buildFeed(db, strangerId);
    expect(forged.cards.every((c) => c.discussionId !== workshopId)).toBe(true);
  });

  it("carries public storefronts as feed cards with a legible ordering rule", async () => {
    const cards = await chamberStorefrontCards(db);
    expect(cards.map((c) => c.title)).toContain("Surplus to Pantry");
    expect(cards.every((c) => c.title !== "Closed Working Group")).toBe(true);
    expect(cards[0].whyLine).toContain("same for everyone");
  });

  it("finds storefronts in search; never workshop interiors; private chambers by name only", async () => {
    const storefront = await search(db, "Surplus to Pantry");
    expect(storefront.some((h) => h.href === `/pollinator/${publicChamberId}`)).toBe(true);

    // The workshop draft's distinctive words are not in the public index.
    const interior = await search(db, "who moves it");
    expect(interior).toHaveLength(0);

    // Private chamber: findable by title, with the private marker, no pitch.
    const priv = await search(db, "Closed Working Group");
    const hit = priv.find((h) => h.href === `/pollinator/${privateChamberId}`);
    expect(hit).toBeDefined();
    expect(hit!.badge).toContain("private");
    expect(hit!.snippet).toBeUndefined();
    // ...but not by its pitch content.
    const byPitch = await search(db, "client's timeline");
    expect(byPitch.every((h) => h.href !== `/pollinator/${privateChamberId}`)).toBe(true);
  });
});

describe("db:verify; the enclosure fails loudly", () => {
  it("passes clean on the exercised database", () => {
    const result = runVerify();
    expect(result.stdout).toContain("Chamber integrity");
    expect(result.stdout).toContain("Workshop enclosure");
    expect(result.status).toBe(0);
  }, 60_000);

  it("fails loudly when a workshop draft is permanence-upgraded behind the API's back", async () => {
    const post = await db.post.findFirstOrThrow({ where: { discussionId: workshopId } });
    await db.post.update({ where: { id: post.id }, data: { permanentUpgraded: true } });
    const result = runVerify();
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("WORKSHOP PERMANENCE");
    await db.post.update({ where: { id: post.id }, data: { permanentUpgraded: false } });
  }, 60_000);

  it("fails loudly when a soul is smuggled into a private chamber without an invite", async () => {
    const smuggled = await db.chamberMember.create({
      data: { chamberId: privateChamberId, profileId: paupergId, handle: "chamber-pauper" },
    });
    const result = runVerify();
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("UNINVITED ENTRY");
    await db.chamberMember.delete({ where: { id: smuggled.id } });
  }, 60_000);

  it("fails loudly when a chamber kept only one half of the dual fee", async () => {
    const half = await db.economyEntry.findFirstOrThrow({
      where: { kind: "fee.chamber", currency: "G" },
    });
    await db.economyEntry.update({ where: { id: half.id }, data: { kind: "fee.chamber-halved" } });
    const result = runVerify();
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("HALF-PAID CHAMBER");
    await db.economyEntry.update({ where: { id: half.id }, data: { kind: "fee.chamber" } });
  }, 60_000);

  it("passes again once the tampering is reverted", () => {
    const result = runVerify();
    expect(result.status).toBe(0);
  }, 60_000);
});


// ─────────────────────────────────────────────────────────────────────
// Mission escrow (NEURAL_POLLINATOR §9.1; PHASE_8_7_SPEC §3 Slice 2).
//
// Money held on behalf of a stated mission, released only when verified
// humans co-sign the spend is legitimate. Recipients are CHAMBERS, never
// Circles; CIRCLES_SPEC Principle 4 forbids Circle custody ("the action
// layer does not quietly become a treasury"), and Chambers already have
// a ratified per-chamber balance (§9.1).
//
// THE THRESHOLD COUNTS CO-SIGNERS, NOT TOTAL VOICES; the Circle rule
// carried over exactly (CIRCLES_SPEC §6.1: the author is separate; the
// threshold counts attestations). So a default of 2 means the proposer
// plus TWO other members: three distinct humans before money moves.
// Its own dedicated chamber below, so open proposals from other tests
// can never pollute a balance assertion.
// ─────────────────────────────────────────────────────────────────────
describe("mission escrow; holding, attested release, and the freeze", () => {
  let missionChamberId: string;
  let attestorAId: string;
  let attestorBId: string;
  let outsiderId: string;

  beforeAll(async () => {
    const a = await makeOnboardedSoul(db, { trueSelf: "mission-a", alias: "ma-shade" });
    const b = await makeOnboardedSoul(db, { trueSelf: "mission-b", alias: "mb-shade" });
    const o = await makeOnboardedSoul(db, { trueSelf: "mission-out", alias: "mo-shade" });
    attestorAId = a.trueSelfId;
    attestorBId = b.trueSelfId;
    outsiderId = o.trueSelfId;

    const made = await createChamber(db, {
      profileId: creatorId,
      title: "Kelowna Food Security",
      subject: "A funded surplus-rescue route",
      pitch: "The mission raises toward its own stated purpose.",
      whyCare: "Wasted food, hungry neighbors, and the fix is logistics.",
      isPublic: true,
      scaffold: SCAFFOLD,
    });
    if (!made.ok) throw new Error(`mission chamber: ${made.reason}`);
    missionChamberId = made.chamberId;

    await enterChamber(db, { chamberId: missionChamberId, profileId: attestorAId });
    await enterChamber(db, { chamberId: missionChamberId, profileId: attestorBId });
    await db.chamber.update({
      where: { id: missionChamberId },
      data: { raisingForMission: true },
    });
    // Slice 2 owns holding and release, and is deliberately ignorant of
    // where the balance came from; donations (souls → chamber) are
    // Slice 3's adapter.
    await db.$transaction((tx) =>
      creditMissionBalance(tx, {
        chamberId: missionChamberId,
        currency: "PC",
        amount: 100,
        sourceKind: "donation",
      })
    );
  }, 120_000);

  it("holds a per-chamber balance, shaped like the treasury's (§9.1)", async () => {
    expect(await chamberBalanceOf(db, missionChamberId, "PC")).toBeCloseTo(100, 5);
  });

  it("refuses a release proposed by a non-member", async () => {
    const result = await proposeRelease(db, {
      chamberId: missionChamberId,
      proposerProfileId: outsiderId,
      toProfileId: attestorAId,
      currency: "PC",
      amount: 10,
      purpose: "Reimburse the venue deposit",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("members");
  });

  it("refuses a release the mission cannot cover", async () => {
    const result = await proposeRelease(db, {
      chamberId: missionChamberId,
      proposerProfileId: creatorId,
      toProfileId: attestorAId,
      currency: "PC",
      amount: 500,
      purpose: "More than we hold",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("not enough");
  });

  it("refuses a release with no stated purpose; the purpose IS the claim attested", async () => {
    const result = await proposeRelease(db, {
      chamberId: missionChamberId,
      proposerProfileId: creatorId,
      toProfileId: attestorAId,
      currency: "PC",
      amount: 10,
      purpose: "   ",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("what it's for");
  });

  it("REFUSES self-attestation; 'attested' must mean more than one voice", async () => {
    const proposed = await proposeRelease(db, {
      chamberId: missionChamberId,
      proposerProfileId: creatorId,
      toProfileId: attestorAId,
      currency: "PC",
      amount: 5,
      purpose: "Printing costs",
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    const self = await attestRelease(db, {
      releaseId: proposed.releaseId,
      attestorProfileId: creatorId,
    });
    expect(self.ok).toBe(false);
    if (!self.ok) expect(self.reason).toContain("more than one voice");
    await db.missionRelease.delete({ where: { id: proposed.releaseId } });
  });

  it("holds at one co-signer: below threshold, nothing moves", async () => {
    const before = await chamberBalanceOf(db, missionChamberId, "PC");
    const proposed = await proposeRelease(db, {
      chamberId: missionChamberId,
      proposerProfileId: creatorId,
      toProfileId: attestorAId,
      currency: "PC",
      amount: 10,
      purpose: "Cold-chain totes",
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;

    const first = await attestRelease(db, {
      releaseId: proposed.releaseId,
      attestorProfileId: attestorAId,
    });
    expect(first.ok).toBe(true);
    // One co-signer, threshold 2; proposer + one is not corroboration.
    if (first.ok) expect(first.released).toBe(false);
    expect(await chamberBalanceOf(db, missionChamberId, "PC")).toBeCloseTo(before, 5);

    const dup = await attestRelease(db, {
      releaseId: proposed.releaseId,
      attestorProfileId: attestorAId,
    });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.reason).toContain("already attested");
    await db.releaseAttestation.deleteMany({ where: { releaseId: proposed.releaseId } });
    await db.missionRelease.delete({ where: { id: proposed.releaseId } });
  });

  it("★ pays AUTOMATICALLY at the threshold; no operator step exists (§3.7)", async () => {
    const chamberBefore = await chamberBalanceOf(db, missionChamberId, "PC");
    const recipientBefore = await balanceOf(db, attestorAId, "PC");

    const proposed = await proposeRelease(db, {
      chamberId: missionChamberId,
      proposerProfileId: creatorId,
      toProfileId: attestorAId,
      currency: "PC",
      amount: 12,
      purpose: "Bulk food purchase for the drive",
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;

    await attestRelease(db, { releaseId: proposed.releaseId, attestorProfileId: attestorAId });
    // The SECOND co-signature meets the threshold; and the very call
    // that latches it pays. There is no separate execute for anyone to
    // withhold; that absence IS the guarantee.
    const second = await attestRelease(db, {
      releaseId: proposed.releaseId,
      attestorProfileId: attestorBId,
    });
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.released).toBe(true);

    expect(await chamberBalanceOf(db, missionChamberId, "PC")).toBeCloseTo(chamberBefore - 12, 5);
    expect(await balanceOf(db, attestorAId, "PC")).toBeCloseTo(recipientBefore + 12, 5);

    const release = await db.missionRelease.findUniqueOrThrow({
      where: { id: proposed.releaseId },
    });
    expect(release.state).toBe("released");
    expect(release.releasedAt).not.toBeNull();

    const event = await db.ledgerEvent.findFirst({
      where: { eventType: "mission.released" },
      orderBy: { seq: "desc" },
    });
    expect(event).not.toBeNull();
    expect(JSON.parse(event!.payload).releaseRef).toBe(proposed.releaseId);
  });

  it("never double-promises: open proposals commit the balance", async () => {
    // Two proposals that each fit the balance but together exceed it
    // would otherwise both reach threshold and overdraw the mission.
    const available = await chamberBalanceOf(db, missionChamberId, "PC");
    const first = await proposeRelease(db, {
      chamberId: missionChamberId,
      proposerProfileId: creatorId,
      toProfileId: attestorAId,
      currency: "PC",
      amount: available - 1,
      purpose: "Nearly everything",
    });
    expect(first.ok).toBe(true);

    const second = await proposeRelease(db, {
      chamberId: missionChamberId,
      proposerProfileId: creatorId,
      toProfileId: attestorAId,
      currency: "PC",
      amount: available - 1,
      purpose: "Nearly everything, again",
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toContain("already committed");

    if (first.ok) await db.missionRelease.delete({ where: { id: first.releaseId } });
  });

  it("★ freezes every unreleased proposal on a ruling; the real teeth (§3.4)", async () => {
    const releasedBefore = await db.missionRelease.count({
      where: { chamberId: missionChamberId, state: "released" },
    });

    const a = await proposeRelease(db, {
      chamberId: missionChamberId,
      proposerProfileId: creatorId,
      toProfileId: attestorAId,
      currency: "PC",
      amount: 3,
      purpose: "Pending one",
    });
    const b = await proposeRelease(db, {
      chamberId: missionChamberId,
      proposerProfileId: creatorId,
      toProfileId: attestorBId,
      currency: "PC",
      amount: 4,
      purpose: "Pending two",
    });
    expect(a.ok && b.ok).toBe(true);

    const frozen = await db.$transaction((tx) =>
      freezeChamberReleases(tx, {
        chamberId: missionChamberId,
        rulingId: "ruling-test-misuse",
      })
    );
    expect(frozen).toBe(2);

    const all = await db.missionRelease.findMany({
      where: { chamberId: missionChamberId, state: "frozen" },
    });
    expect(all.length).toBe(2);
    // A frozen release always cites its due process; never a quiet
    // decision someone made.
    expect(all.every((r) => r.frozenByRulingId === "ruling-test-misuse")).toBe(true);

    // You cannot claw back what is spent; the already-paid release stays
    // paid. Freeze stops what has NOT moved; that is the whole claim,
    // and the spec says so plainly rather than overselling it.
    const releasedAfter = await db.missionRelease.count({
      where: { chamberId: missionChamberId, state: "released" },
    });
    expect(releasedAfter).toBe(releasedBefore);
    expect(releasedAfter).toBeGreaterThan(0);
  });

  it("a frozen release cannot be attested back to life", async () => {
    const frozen = await db.missionRelease.findFirstOrThrow({
      where: { chamberId: missionChamberId, state: "frozen" },
    });
    const result = await attestRelease(db, {
      releaseId: frozen.id,
      attestorProfileId: attestorAId,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("frozen");
  });

  it("db:verify still passes with escrow state on the books", () => {
    const result = runVerify();
    expect(result.status).toBe(0);
  }, 60_000);
});

// Mission funding donations (NEURAL_POLLINATOR §9.1; PHASE_8_7_SPEC
// Slice 3). The mechanic that replaced auto-returned poll
// support-staking, killed by the owner's own critique: "auto-returned
// staking is cheap talk, a costless signal carries no information."
// Everything here tests that donations COST; because that's the point.
describe("mission donations; genuine transfers, no auto-return (§9.1)", () => {
  let fundedChamberId: string;
  let donorId: string;

  beforeAll(async () => {
    const d = await makeOnboardedSoul(db, { trueSelf: "mission-donor", alias: "md-shade" });
    donorId = d.trueSelfId;
    // The creator has spent their PollCoin on earlier chambers in this
    // file; top up through the accounted test faucet so conservation
    // still holds (never a raw balance write; db:verify would catch it).
    await topUpForTests(db, creatorId, { pc: 60, g: 60 });
    const made = await createChamber(db, {
      profileId: creatorId,
      title: "Winter Coat Drive",
      subject: "A funded coat drive",
      pitch: "Raising toward a stated mission.",
      whyCare: "Cold neighbors, solvable now.",
      isPublic: true,
      scaffold: SCAFFOLD,
    });
    if (!made.ok) throw new Error(`funded chamber: ${made.reason}`);
    fundedChamberId = made.chamberId;
  }, 60_000);

  it("refuses donations until the chamber declares it's raising", async () => {
    const result = await donateToMission(db, {
      chamberId: fundedChamberId,
      profileId: donorId,
      amount: 5,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("isn't raising");
  });

  it("only the creator may declare the mission is raising", async () => {
    const notCreator = await declareRaising(db, {
      chamberId: fundedChamberId,
      profileId: donorId,
      raising: true,
      plan: PLAN,
    });
    expect(notCreator.ok).toBe(false);
    if (!notCreator.ok) expect(notCreator.reason).toContain("creator");

    const declared = await declareRaising(db, {
      chamberId: fundedChamberId,
      profileId: creatorId,
      raising: true,
      plan: PLAN,
    });
    expect(declared.ok).toBe(true);
  });

  it("★ a donation actually COSTS; the money leaves the donor for good", async () => {
    const donorBefore = await balanceOf(db, donorId, "PC");
    const result = await donateToMission(db, {
      chamberId: fundedChamberId,
      profileId: donorId,
      amount: 8,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.balance).toBeCloseTo(8, 5);

    // Gone from the donor; no auto-return, no escrow-back-to-me. It
    // returns only if the chamber's own members release it.
    expect(await balanceOf(db, donorId, "PC")).toBeCloseTo(donorBefore - 8, 5);
    expect(await chamberBalanceOf(db, fundedChamberId, "PC")).toBeCloseTo(8, 5);

    const entry = await db.economyEntry.findFirst({
      where: { kind: "mission.donation", fromProfileId: donorId },
    });
    expect(entry?.refId).toBe(fundedChamberId);
    // Never a treasury flow in either direction; so no budget category,
    // which is the Constitution's TREASURY spending guardrail.
    expect(entry?.toTreasury).toBe(false);
    expect(entry?.fromTreasury).toBe(false);
    expect(entry?.budgetCategory).toBeNull();
  });

  it("refuses a donation the donor cannot afford", async () => {
    const balance = await balanceOf(db, donorId, "PC");
    const result = await donateToMission(db, {
      chamberId: fundedChamberId,
      profileId: donorId,
      amount: balance + 100,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("not a gesture");
  });

  it("withdrawing the declaration stops new donations but never claws back given money", async () => {
    const held = await chamberBalanceOf(db, fundedChamberId, "PC");
    expect(held).toBeGreaterThan(0);

    const withdrawn = await declareRaising(db, {
      chamberId: fundedChamberId,
      profileId: creatorId,
      raising: false,
    });
    expect(withdrawn.ok).toBe(true);

    const blocked = await donateToMission(db, {
      chamberId: fundedChamberId,
      profileId: donorId,
      amount: 1,
    });
    expect(blocked.ok).toBe(false);

    // A chamber that could un-declare its way out of accountability
    // would make "genuine transfer, no auto-return" a lie.
    expect(await chamberBalanceOf(db, fundedChamberId, "PC")).toBeCloseTo(held, 5);
  });

  it("the giving is on the public record", async () => {
    const event = await db.ledgerEvent.findFirst({
      where: { eventType: "mission.donated" },
      orderBy: { seq: "desc" },
    });
    expect(event).not.toBeNull();
    const payload = JSON.parse(event!.payload);
    expect(payload.chamberRef).toBe(fundedChamberId);
    expect(payload.amount).toBe(8);
  });

  it("db:verify passes with donations on the books", () => {
    const result = runVerify();
    expect(result.status).toBe(0);
  }, 60_000);
});

// The funding plan (FUND_INTEGRITY §3.1; Tier 0, "procurement due
// diligence"). Tier 0 is not a gate bolted onto Chambers; it IS what a
// Chamber already is; the scaffold and the public workshop are the
// dissection. These three fields only point that machinery at money.
describe("the funding plan; Tier 0 diligence (FUND_INTEGRITY §3.1)", () => {
  let planChamberId: string;
  let planDonorId: string;

  beforeAll(async () => {
    const d = await makeOnboardedSoul(db, { trueSelf: "plan-donor", alias: "pd-shade" });
    planDonorId = d.trueSelfId;
    await topUpForTests(db, creatorId, { pc: 60, g: 60 });
    const made = await createChamber(db, {
      profileId: creatorId,
      title: "Community Fridge",
      subject: "A funded community fridge",
      pitch: "Raising toward a stated mission.",
      whyCare: "Food access, block by block.",
      isPublic: true,
      scaffold: SCAFFOLD,
    });
    if (!made.ok) throw new Error(`plan chamber: ${made.reason}`);
    planChamberId = made.chamberId;
  }, 60_000);

  it("★ refuses to raise without answering all three; no plan, no money", async () => {
    const noPlan = await declareRaising(db, {
      chamberId: planChamberId,
      profileId: creatorId,
      raising: true,
    });
    expect(noPlan.ok).toBe(false);
    if (!noPlan.ok) expect(noPlan.reason).toContain("who is funded");

    const partial = await declareRaising(db, {
      chamberId: planChamberId,
      profileId: creatorId,
      raising: true,
      plan: { ...PLAN, breakdown: "   " },
    });
    expect(partial.ok).toBe(false);

    // Refused means it never started raising; so nobody can donate.
    const chamber = await db.chamber.findUniqueOrThrow({ where: { id: planChamberId } });
    expect(chamber.raisingForMission).toBe(false);
    const blocked = await donateToMission(db, {
      chamberId: planChamberId,
      profileId: planDonorId,
      amount: 5,
    });
    expect(blocked.ok).toBe(false);
  });

  it("declaring stores the plan and starts its history at v1", async () => {
    const declared = await declareRaising(db, {
      chamberId: planChamberId,
      profileId: creatorId,
      raising: true,
      plan: PLAN,
    });
    expect(declared.ok).toBe(true);

    const chamber = await db.chamber.findUniqueOrThrow({ where: { id: planChamberId } });
    expect(chamber.fundingRecipient).toBe(PLAN.recipient);
    expect(chamber.fundingEvidence).toBe(PLAN.evidence);
    expect(chamber.fundingBreakdown).toBe(PLAN.breakdown);
    expect(chamber.raisingDeclaredAt).not.toBeNull();

    // v1 exists from the first moment; the history records what souls
    // donated against, not only what changed later.
    const revisions = await db.chamberFundingRevision.findMany({
      where: { chamberId: planChamberId },
    });
    expect(revisions.length).toBe(1);
    expect(revisions[0].breakdown).toBe(PLAN.breakdown);
  });

  it("★ a revised plan keeps every version; donors gave against a specific one", async () => {
    await donateToMission(db, {
      chamberId: planChamberId,
      profileId: planDonorId,
      amount: 6,
    });

    const revised = await reviseFundingPlan(db, {
      chamberId: planChamberId,
      profileId: creatorId,
      recipient: PLAN.recipient,
      evidence: "Receipts posted to the workshop; plus the pantry's own confirmation.",
      breakdown: "50u coats · 30u transport · 20u storage totes.",
    });
    expect(revised.ok).toBe(true);

    // The plan sharpened; that's the workshop working. But the version
    // the donor gave against survives, so a silent bait-and-switch is
    // impossible rather than merely forbidden.
    const revisions = await db.chamberFundingRevision.findMany({
      where: { chamberId: planChamberId },
      orderBy: { editedAt: "asc" },
    });
    expect(revisions.length).toBe(2);
    expect(revisions[0].breakdown).toBe(PLAN.breakdown);
    expect(revisions[1].breakdown).toContain("50u coats");

    const chamber = await db.chamber.findUniqueOrThrow({ where: { id: planChamberId } });
    expect(chamber.fundingBreakdown).toContain("50u coats");

    // And the change is public; a donor deserves to see it.
    const event = await db.ledgerEvent.findFirst({
      where: { eventType: "mission.plan-revised" },
      orderBy: { seq: "desc" },
    });
    expect(event).not.toBeNull();
    expect(JSON.parse(event!.payload).chamberRef).toBe(planChamberId);
  });

  it("only the creator sharpens the plan", async () => {
    const notCreator = await reviseFundingPlan(db, {
      chamberId: planChamberId,
      profileId: planDonorId,
      recipient: "Me, actually",
      evidence: "Trust me",
      breakdown: "100u me",
    });
    expect(notCreator.ok).toBe(false);
    if (!notCreator.ok) expect(notCreator.reason).toContain("creator");
  });

  it("db:verify passes with funding plans on the books", () => {
    const result = runVerify();
    expect(result.status).toBe(0);
  }, 60_000);
});

// The binding vote for LARGE releases (NEURAL_POLLINATOR §9.1: "above a
// size threshold or when contested; a binding stewardship-style poll
// authorizes it... members vote, auto-executes on passage").
//
// Two co-signers are corroboration for a reimbursement. They are not a
// mandate for the mission's whole purse; which is the entire reason
// §9.1 has a second door.
describe("large releases ride a binding vote, not attestation (§9.1)", () => {
  let bigChamberId: string;
  let voterAId: string;
  let voterBId: string;

  beforeAll(async () => {
    const a = await makeOnboardedSoul(db, { trueSelf: "vote-a", alias: "va-shade" });
    const b = await makeOnboardedSoul(db, { trueSelf: "vote-b", alias: "vb-shade" });
    voterAId = a.trueSelfId;
    voterBId = b.trueSelfId;
    await topUpForTests(db, creatorId, { pc: 80, g: 80 });
    const made = await createChamber(db, {
      profileId: creatorId,
      title: "Big Ticket Mission",
      subject: "A mission with a real purse",
      pitch: "Raising toward something that costs.",
      whyCare: "Because the fix isn't cheap.",
      isPublic: true,
      scaffold: SCAFFOLD,
    });
    if (!made.ok) throw new Error(`big chamber: ${made.reason}`);
    bigChamberId = made.chamberId;
    await enterChamber(db, { chamberId: bigChamberId, profileId: voterAId });
    await enterChamber(db, { chamberId: bigChamberId, profileId: voterBId });
    await declareRaising(db, {
      chamberId: bigChamberId,
      profileId: creatorId,
      raising: true,
      plan: PLAN,
    });
    await db.$transaction((tx) =>
      creditMissionBalance(tx, {
        chamberId: bigChamberId,
        currency: "PC",
        amount: 200,
        sourceKind: "donation",
      })
    );
  }, 120_000);

  it("routes a large release to the binding-vote door, and says so at proposal", async () => {
    const big = await proposeRelease(db, {
      chamberId: bigChamberId,
      proposerProfileId: creatorId,
      toProfileId: voterAId,
      currency: "PC",
      amount: 100, // > the 25u serious-stake threshold
      purpose: "The whole winter buy",
    });
    expect(big.ok).toBe(true);
    if (!big.ok) return;
    expect(big.authorization).toBe("binding-vote");

    // Which door it must go through is published BEFORE anyone signs or
    // votes; never chosen after the fact.
    const event = await db.ledgerEvent.findFirst({
      where: { eventType: "mission.release-proposed" },
      orderBy: { seq: "desc" },
    });
    expect(JSON.parse(event!.payload).authorization).toBe("binding-vote");
  });

  it("★ REFUSES to attest a large release onto the cheap path", async () => {
    const big = await db.missionRelease.findFirstOrThrow({
      where: { chamberId: bigChamberId, state: "proposed" },
    });
    const sneak = await attestRelease(db, {
      releaseId: big.id,
      attestorProfileId: voterAId,
    });
    expect(sneak.ok).toBe(false);
    if (!sneak.ok) expect(sneak.reason).toContain("binding vote");
    // Still unpaid; the cheap path cannot authorize the mission's purse.
    const after = await db.missionRelease.findUniqueOrThrow({ where: { id: big.id } });
    expect(after.state).toBe("proposed");
  });

  it("a routine release still rides attestation; the two doors coexist", async () => {
    const small = await proposeRelease(db, {
      chamberId: bigChamberId,
      proposerProfileId: creatorId,
      toProfileId: voterBId,
      currency: "PC",
      amount: 10,
      purpose: "Petty cash for totes",
    });
    expect(small.ok).toBe(true);
    if (!small.ok) return;
    expect(small.authorization).toBe("attestation");
  });

  it("★ a passed binding vote PAYS on close; no operator step, again", async () => {
    const big = await db.missionRelease.findFirstOrThrow({
      where: { chamberId: bigChamberId, state: "proposed", amount: 100 },
    });
    const chamberBefore = await chamberBalanceOf(db, bigChamberId, "PC");

    const meta = await db.pillar.findFirstOrThrow({ where: { isMeta: true } });
    const poll = await createPoll(db, {
      profileId: creatorId,
      pillarId: meta.id,
      title: `Release 100u: ${big.purpose}`,
      type: "consensus",
      mode: "pseudonymous",
      options: ["Adopt", "Decline"],
      durationHours: 1,
      consensusThreshold: 0.6,
      chamber: { chamberId: bigChamberId, action: `release:${big.id}` },
    });
    expect(poll.ok).toBe(true);
    if (!poll.ok) return;

    // Members only; the ballot box sits inside the workshop.
    const adoptOption = await db.pollOption.findFirstOrThrow({
      where: { pollId: poll.pollId, position: 1 },
    });
    const outsider = await castVote(db, {
      pollId: poll.pollId,
      profileId: strangerId,
      optionIds: [adoptOption.id],
    });
    expect(outsider.ok).toBe(false);
    if (!outsider.ok) expect(outsider.reason).toContain("chamber's members");

    for (const voter of [creatorId, voterAId, voterBId]) {
      const cast = await castVote(db, {
        pollId: poll.pollId,
        profileId: voter,
        optionIds: [adoptOption.id], // Adopt
      });
      expect(cast.ok).toBe(true);
    }

    // Snapshot AFTER voting: the recipient is also a voter here, and
    // voting moves their balance (fee out, accrual in). Measuring the
    // release means measuring only the release.
    const recipientBefore = await balanceOf(db, voterAId, "PC");

    // Close it: the poll closing IS the payment (§3.7). Time-travel the
    // ballots first; the candle only counts votes cast before the true
    // close, and that rule is doing its job here, not getting in the way.
    await db.ballot.updateMany({
      where: { pollId: poll.pollId },
      data: { castAt: new Date(Date.now() - 60_000) },
    });
    await db.poll.update({
      where: { id: poll.pollId },
      data: { nominalCloseAt: new Date(Date.now() - 1000), trueCloseAt: new Date(Date.now() - 1000) },
    });
    await closeDuePolls(db);

    const paid = await db.missionRelease.findUniqueOrThrow({ where: { id: big.id } });
    expect(paid.state).toBe("released");
    expect(await chamberBalanceOf(db, bigChamberId, "PC")).toBeCloseTo(chamberBefore - 100, 5);
    expect(await balanceOf(db, voterAId, "PC")).toBeCloseTo(recipientBefore + 100, 5);

    // Both doors land in the same payment path; the ledger says which
    // one authorized it.
    const event = await db.ledgerEvent.findFirst({
      where: { eventType: "mission.released" },
      orderBy: { seq: "desc" },
    });
    const payload = JSON.parse(event!.payload);
    expect(payload.releaseRef).toBe(big.id);
    expect(payload.via).toBe("binding-vote");
    expect(payload.pollRef).toBe(poll.pollId);
  }, 60_000);

  it("a vote that passes on Decline adopts nothing", async () => {
    const rel = await proposeRelease(db, {
      chamberId: bigChamberId,
      proposerProfileId: creatorId,
      toProfileId: voterAId,
      currency: "PC",
      amount: 50,
      purpose: "A spend the chamber doesn't want",
    });
    expect(rel.ok).toBe(true);
    if (!rel.ok) return;

    const meta = await db.pillar.findFirstOrThrow({ where: { isMeta: true } });
    const poll = await createPoll(db, {
      profileId: creatorId,
      pillarId: meta.id,
      title: "Release 50u?",
      type: "consensus",
      mode: "pseudonymous",
      options: ["Adopt", "Decline"],
      durationHours: 1,
      consensusThreshold: 0.6,
      chamber: { chamberId: bigChamberId, action: `release:${rel.releaseId}` },
    });
    if (!poll.ok) return;
    const declineOption = await db.pollOption.findFirstOrThrow({
      where: { pollId: poll.pollId, position: 2 },
    });
    for (const voter of [creatorId, voterAId, voterBId]) {
      await castVote(db, { pollId: poll.pollId, profileId: voter, optionIds: [declineOption.id] });
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

    // The poll "passed" (consensus reached); on Decline. Nothing moves.
    const after = await db.missionRelease.findUniqueOrThrow({ where: { id: rel.releaseId } });
    expect(after.state).toBe("proposed");
  }, 60_000);

  it("db:verify passes with both release doors exercised", () => {
    const result = runVerify();
    expect(result.status).toBe(0);
  }, 60_000);
});

// Fund Auditors; Tier 4 (FUND_INTEGRITY §3.5). The answer to "who
// watches the watchers" only works if the watcher cannot punish, and
// cannot profit from finding fault. Both properties are tested here,
// because both are the whole point.
describe("Fund Auditors; sampling released money (FUND_INTEGRITY §3.5)", () => {
  let auditChamberId: string;
  let auditorId: string;
  let memberId: string;
  let releaseId: string;

  beforeAll(async () => {
    // An auditor must be a proven badge-completer; someone the platform
    // has already watched do real service.
    const aud = await makeOnboardedSoul(db, { trueSelf: "fund-auditor", alias: "fa-shade" });
    auditorId = aud.trueSelfId;
    const offer = await db.badgeOffer.create({
      data: {
        profileId: auditorId,
        expiresAt: new Date(Date.now() + 86_400_000),
        status: "equipped",
      },
    });
    await db.badgeTerm.create({
      data: {
        offerId: offer.id,
        profileId: auditorId,
        endsAt: new Date(Date.now() + 86_400_000),
        casesCompleted: 3,
      },
    });

    const m = await makeOnboardedSoul(db, { trueSelf: "audit-member", alias: "am-shade" });
    memberId = m.trueSelfId;
    await topUpForTests(db, creatorId, { pc: 80, g: 80 });
    const made = await createChamber(db, {
      profileId: creatorId,
      title: "Audited Mission",
      subject: "A mission whose money gets read",
      pitch: "Raising, and expecting to be checked.",
      whyCare: "Because money deserves eyes.",
      isPublic: true,
      scaffold: SCAFFOLD,
    });
    if (!made.ok) throw new Error(`audit chamber: ${made.reason}`);
    auditChamberId = made.chamberId;
    await enterChamber(db, { chamberId: auditChamberId, profileId: memberId });
    await enterChamber(db, { chamberId: auditChamberId, profileId: workerId });
    await db.$transaction((tx) =>
      creditMissionBalance(tx, {
        chamberId: auditChamberId,
        currency: "PC",
        amount: 50,
        sourceKind: "donation",
      })
    );
    const rel = await proposeRelease(db, {
      chamberId: auditChamberId,
      proposerProfileId: creatorId,
      toProfileId: memberId,
      currency: "PC",
      amount: 8,
      purpose: "Tarps and rope",
    });
    if (!rel.ok) throw new Error(`release: ${rel.reason}`);
    releaseId = rel.releaseId;
    await attestRelease(db, { releaseId, attestorProfileId: memberId });
    await attestRelease(db, { releaseId, attestorProfileId: workerId });
  }, 120_000);

  it("draws auditors by lot over released money, excluding anyone party to it", async () => {
    // Sample everything for the test; the rail is the dial, not the law.
    await db.rail.update({ where: { key: "fundAudit.samplePercent" }, data: { value: 100 } });
    const offered = await offerFundAudits(db);
    expect(offered).toBeGreaterThan(0);

    const audit = await db.fundAudit.findFirstOrThrow({ where: { releaseId } });
    // Conflict exclusion: never the proposer, the recipient, or a member
    // of the chamber. An auditor auditing their own mission is not an
    // audit.
    expect([creatorId, memberId, workerId]).not.toContain(audit.auditorProfileId);
    expect(audit.auditorProfileId).toBe(auditorId);

    // The offer is public; but never names the auditor. An auditor
    // whose identity is known before they rule can be lobbied.
    const event = await db.ledgerEvent.findFirst({
      where: { eventType: "fund-audit.offered" },
      orderBy: { seq: "desc" },
    });
    expect(event).not.toBeNull();
    expect(event!.payload).not.toContain(auditorId);
    expect(event!.payload).toContain(releaseId);
  }, 60_000);

  it("an audit drawn for someone else can't be taken", async () => {
    const audit = await db.fundAudit.findFirstOrThrow({ where: { releaseId } });
    const notYours = await acceptFundAudit(db, { auditId: audit.id, profileId: creatorId });
    expect(notYours.ok).toBe(false);
    if (!notYours.ok) expect(notYours.reason).toContain("drawn for someone else");
  });

  it("a finding needs its reasoning; an unexplained verdict is not an audit", async () => {
    const audit = await db.fundAudit.findFirstOrThrow({ where: { releaseId } });
    await acceptFundAudit(db, { auditId: audit.id, profileId: auditorId });
    const blank = await completeFundAudit(db, {
      auditId: audit.id,
      profileId: auditorId,
      finding: "clean",
      note: "   ",
    });
    expect(blank.ok).toBe(false);
    if (!blank.ok) expect(blank.reason).toContain("reasoning");
  });

  it("★ pays PER CASE, never per finding; clean and concern earn identically", async () => {
    const audit = await db.fundAudit.findFirstOrThrow({ where: { releaseId } });
    const before = await balanceOf(db, auditorId, "G");
    const done = await completeFundAudit(db, {
      auditId: audit.id,
      profileId: auditorId,
      finding: "clean",
      note: "Receipts match the stated purpose; attestors are unrelated to the recipient.",
    });
    expect(done.ok).toBe(true);

    const reward = (await db.rail.findUniqueOrThrow({ where: { key: "fundAudit.caseRewardG" } })).value;
    expect(await balanceOf(db, auditorId, "G")).toBeCloseTo(before + reward, 5);

    // The pay is for LOOKING. An auditor paid for finding problems will
    // find problems; so a clean verdict earns exactly what a concern
    // does, and that is the whole anti-incentive.
    const row = await db.fundAudit.findUniqueOrThrow({ where: { id: audit.id } });
    expect(row.finding).toBe("clean");
    expect(row.gratiumEarned).toBeCloseTo(reward, 5);

    // Rides the moderation-rewards budget: same kind of spending; the
    // treasury paying souls for civic service.
    const entry = await db.economyEntry.findFirstOrThrow({
      where: { kind: "reward.fund-audit", toProfileId: auditorId },
    });
    expect(entry.budgetCategory).toBe("moderation-rewards");
    expect(entry.fromTreasury).toBe(true);
  }, 60_000);

  it("★ a finding is a SIGNAL, not a penalty; and says so on the record", async () => {
    const event = await db.ledgerEvent.findFirst({
      where: { eventType: "fund-audit.completed" },
      orderBy: { seq: "desc" },
    });
    expect(event).not.toBeNull();
    const payload = JSON.parse(event!.payload);
    expect(payload.finding).toBe("clean");
    expect(payload.consequence).toBe("none");

    // The release is untouched by the audit; an auditor who could move
    // money would be an operator with extra steps.
    const release = await db.missionRelease.findUniqueOrThrow({ where: { id: releaseId } });
    expect(release.state).toBe("released");
  });

  it("Sentinel flags a self-dealing PATTERN; never a single reimbursement", async () => {
    // One member reimbursing themselves is the most ordinary use of a
    // mission's money. Forbidding it would push real spending off the
    // record; Sentinel watches instead.
    await db.rail.update({ where: { key: "sentinel.selfDealReleaseThreshold" }, data: { value: 2 } });

    const before = await sentinelMissionSweep(db);
    expect(before).toBe(0); // no self-directed releases yet

    for (const purpose of ["Self reimbursement one", "Self reimbursement two"]) {
      const rel = await proposeRelease(db, {
        chamberId: auditChamberId,
        proposerProfileId: memberId,
        toProfileId: memberId, // to themselves; allowed, and watched
        currency: "PC",
        amount: 2,
        purpose,
      });
      if (!rel.ok) throw new Error(rel.reason);
      await attestRelease(db, { releaseId: rel.releaseId, attestorProfileId: creatorId });
      await attestRelease(db, { releaseId: rel.releaseId, attestorProfileId: workerId });
    }

    const flagged = await sentinelMissionSweep(db);
    expect(flagged).toBe(1);

    const event = await db.ledgerEvent.findFirst({
      where: { eventType: "sentinel.mission-pattern" },
      orderBy: { seq: "desc" },
    });
    const payload = JSON.parse(event!.payload);
    expect(payload.pattern).toBe("self-directed-releases");
    expect(payload.consequence).toContain("never punish");
    // A machine flag that reads like a verdict IS a verdict; so it says
    // plainly that this is a question, not an accusation.
    expect(payload.note).toContain("not an accusation");

    // Anomalies never punish: the releases stand.
    const stillPaid = await db.missionRelease.count({
      where: { chamberId: auditChamberId, state: "released" },
    });
    expect(stillPaid).toBe(3);

    // And it doesn't re-flag the same pattern on every sweep.
    expect(await sentinelMissionSweep(db)).toBe(0);
  }, 60_000);

  it("db:verify passes with audits and machine flags on the books", () => {
    const result = runVerify();
    expect(result.status).toBe(0);
  }, 60_000);
});

// ★ THE FREEZE, WIRED (FUND_INTEGRITY §3.4; owner-ruled 2026-07-16).
//
// The mechanism was built in Slice 2 and left deliberately unwired: the
// spec never said how a case STARTS, and a release couldn't be flagged
// at all. Both answers came from the owner; yes, payments are
// reportable; the rule is R3.4 (Fraud & phishing: "attempts to steal
// credentials, FUNDS, or identities").
//
// The narrowness is the design. Over-triggering is not a smaller error
// than under-triggering: "any upheld ruling freezes" would mean a rude
// sentence in a payment's stated purpose could freeze a mission's whole
// purse; a censorship mechanism in an anti-fraud costume.
describe("the freeze, wired to a real ruling (§3.4)", () => {
  let fChamberId: string;
  let fMemberId: string;
  let fWitnessId: string;
  let reporterId: string;

  beforeAll(async () => {
    const m = await makeOnboardedSoul(db, { trueSelf: "freeze-member", alias: "fm-shade" });
    const w = await makeOnboardedSoul(db, { trueSelf: "freeze-witness", alias: "fw-shade" });
    const r = await makeOnboardedSoul(db, { trueSelf: "freeze-reporter", alias: "fr-shade" });
    fMemberId = m.trueSelfId;
    fWitnessId = w.trueSelfId;
    reporterId = r.trueSelfId;
    await topUpForTests(db, creatorId, { pc: 120, g: 120 });
    const made = await createChamber(db, {
      profileId: creatorId,
      title: "Freeze Test Mission",
      subject: "A mission that gets caught",
      pitch: "Raising toward a stated mission.",
      whyCare: "It matters.",
      isPublic: true,
      scaffold: SCAFFOLD,
    });
    if (!made.ok) throw new Error(made.reason);
    fChamberId = made.chamberId;
    await enterChamber(db, { chamberId: fChamberId, profileId: fMemberId });
    await enterChamber(db, { chamberId: fChamberId, profileId: fWitnessId });
    await db.$transaction((tx) =>
      creditMissionBalance(tx, {
        chamberId: fChamberId,
        currency: "PC",
        amount: 60,
        sourceKind: "donation",
      })
    );
  }, 120_000);

  it("a payment can be reported; the door that didn't exist", async () => {
    const rel = await proposeRelease(db, {
      chamberId: fChamberId,
      proposerProfileId: creatorId,
      toProfileId: fMemberId,
      currency: "PC",
      amount: 10,
      purpose: "Supplies that were never bought",
    });
    if (!rel.ok) throw new Error(rel.reason);
    await attestRelease(db, { releaseId: rel.releaseId, attestorProfileId: fMemberId });
    await attestRelease(db, { releaseId: rel.releaseId, attestorProfileId: fWitnessId });

    const filed = await fileReleaseFlag(db, {
      releaseId: rel.releaseId,
      profileId: reporterId,
      ruleId: "R3.4",
      note: "The stated purpose never happened; no receipts in the workshop.",
    });
    expect(filed.ok).toBe(true);

    // Same deposit, same rulebook, same triangle of blindness as any
    // other flag; a payment is not a special kind of accusation.
    const flag = await db.flag.findFirstOrThrow({ where: { releaseId: rel.releaseId } });
    expect(flag.ruleId).toBe("R3.4");
    expect(flag.caseId).not.toBeNull();

    const modCase = await db.modCase.findFirstOrThrow({ where: { releaseId: rel.releaseId } });
    expect(modCase.tier).toBe(3); // R3.4 is severe → Tribunal lane
  }, 60_000);

  it("★ an upheld FRAUD ruling freezes what hasn't moved; automatically", async () => {
    // Two payments still pending when the ruling lands.
    const pendingA = await proposeRelease(db, {
      chamberId: fChamberId,
      proposerProfileId: creatorId,
      toProfileId: fMemberId,
      currency: "PC",
      amount: 5,
      purpose: "Pending one",
    });
    const pendingB = await proposeRelease(db, {
      chamberId: fChamberId,
      proposerProfileId: creatorId,
      toProfileId: fWitnessId,
      currency: "PC",
      amount: 6,
      purpose: "Pending two",
    });
    expect(pendingA.ok && pendingB.ok).toBe(true);
    const paidBefore = await db.missionRelease.count({
      where: { chamberId: fChamberId, state: "released" },
    });

    const modCase = await db.modCase.findFirstOrThrow({
      where: { releaseId: { not: null }, ruleId: "R3.4", status: { not: "resolved" } },
    });
    await resolveCase(db, {
      caseId: modCase.id,
      outcome: "upheld",
      citedRuleId: "R3.4",
      badFaith: false,
    });

    const frozen = await db.missionRelease.findMany({
      where: { chamberId: fChamberId, state: "frozen" },
    });
    expect(frozen.length).toBe(2);
    expect(frozen.every((r) => r.frozenByRulingId === modCase.id)).toBe(true);

    // The limit, proven rather than promised: money already paid stays
    // paid. The platform cannot claw it back, and says so.
    const paidAfter = await db.missionRelease.count({
      where: { chamberId: fChamberId, state: "released" },
    });
    expect(paidAfter).toBe(paidBefore);

    const event = await db.ledgerEvent.findFirst({
      where: { eventType: "mission.freeze-ordered" },
      orderBy: { seq: "desc" },
    });
    expect(event).not.toBeNull();
    const payload = JSON.parse(event!.payload);
    expect(payload.rule).toBe("R3.4");
    expect(payload.note).toContain("cannot be recovered");
  }, 60_000);

  it("★ does NOT over-trigger: a non-fraud ruling moves no money", async () => {
    // A rude sentence in a payment's purpose is a rule violation. It is
    // NOT a reason to freeze a mission's purse; that would be a
    // censorship mechanism wearing an anti-fraud costume.
    const rel = await proposeRelease(db, {
      chamberId: fChamberId,
      proposerProfileId: creatorId,
      toProfileId: fMemberId,
      currency: "PC",
      amount: 4,
      purpose: "Totes; and a rude aside about a neighbour",
    });
    if (!rel.ok) throw new Error(rel.reason);

    const filed = await fileReleaseFlag(db, {
      releaseId: rel.releaseId,
      profileId: reporterId,
      ruleId: "R2.1", // harassment; real, but not fraud
      note: "The purpose line attacks someone.",
    });
    expect(filed.ok).toBe(true);
    const modCase = await db.modCase.findFirstOrThrow({ where: { releaseId: rel.releaseId } });

    await resolveCase(db, {
      caseId: modCase.id,
      outcome: "upheld",
      citedRuleId: "R2.1",
      badFaith: false,
    });

    // Upheld; the accused takes the strike. But the payment stands: no
    // freeze, because the rule wasn't fraud.
    const after = await db.missionRelease.findUniqueOrThrow({ where: { id: rel.releaseId } });
    expect(after.state).toBe("proposed");
    expect(after.frozenByRulingId).toBeNull();
  }, 60_000);

  it("db:verify passes with the freeze wired", () => {
    const result = runVerify();
    expect(result.status).toBe(0);
  }, 60_000);
});

// ★ THE AUDIT'S CATCH (2026-07-16). Adding a third evidence type left
// three shared moderation paths still knowing only two. None were caught
// by the freeze tests, because those called resolveCase() directly and
// never walked the road a real moderator walks. These tests walk it.
describe("a release case survives the whole moderation road", () => {
  let rChamberId: string;
  let rReleaseId: string;
  let rMemberId: string;
  let rWitnessId: string;
  let rReporterId: string;

  beforeAll(async () => {
    const m = await makeOnboardedSoul(db, { trueSelf: "road-member", alias: "rm-shade" });
    const w = await makeOnboardedSoul(db, { trueSelf: "road-witness", alias: "rw-shade" });
    const r = await makeOnboardedSoul(db, { trueSelf: "road-reporter", alias: "rr-shade" });
    rMemberId = m.trueSelfId;
    rWitnessId = w.trueSelfId;
    rReporterId = r.trueSelfId;
    await topUpForTests(db, creatorId, { pc: 120, g: 120 });
    const made = await createChamber(db, {
      profileId: creatorId,
      title: "Road Test Mission",
      subject: "A mission whose case travels",
      pitch: "Raising toward a stated mission.",
      whyCare: "It matters.",
      isPublic: true,
      scaffold: SCAFFOLD,
    });
    if (!made.ok) throw new Error(made.reason);
    rChamberId = made.chamberId;
    await enterChamber(db, { chamberId: rChamberId, profileId: rMemberId });
    await enterChamber(db, { chamberId: rChamberId, profileId: rWitnessId });
    await db.$transaction((tx) =>
      creditMissionBalance(tx, {
        chamberId: rChamberId,
        currency: "PC",
        amount: 40,
        sourceKind: "donation",
      })
    );
    const rel = await proposeRelease(db, {
      chamberId: rChamberId,
      proposerProfileId: creatorId,
      toProfileId: rMemberId,
      currency: "PC",
      amount: 9,
      purpose: "Materials for the build day",
    });
    if (!rel.ok) throw new Error(rel.reason);
    rReleaseId = rel.releaseId;
    await attestRelease(db, { releaseId: rReleaseId, attestorProfileId: rMemberId });
    await attestRelease(db, { releaseId: rReleaseId, attestorProfileId: rWitnessId });
    await fileReleaseFlag(db, {
      releaseId: rReleaseId,
      profileId: rReporterId,
      ruleId: "R3.4",
      note: "No receipts; the build day never happened.",
    });
  }, 120_000);

  it("★ a moderator can actually OPEN the case (it crashed before the audit)", async () => {
    const modCase = await db.modCase.findFirstOrThrow({ where: { releaseId: rReleaseId } });
    const file = await caseFileFor(db, modCase.id);
    expect(file).not.toBeNull();

    // The payment's own claim is the evidence under judgment.
    expect(file!.content).toContain("Materials for the build day");
    expect(file!.content).toContain("9u PC");
    expect(file!.content).toContain("Co-signers: 2");
    expect(file!.pillar).toContain("Road Test Mission");

    // The triangle holds identically: no handles, no names, no ids.
    const blob = JSON.stringify(file);
    expect(blob).not.toContain(creatorId);
    expect(blob).not.toContain(rMemberId);
    expect(blob).not.toContain(rReporterId);
  }, 60_000);

  it("★ an APPEAL carries the evidence forward (it was silently dropped)", async () => {
    const modCase = await db.modCase.findFirstOrThrow({ where: { releaseId: rReleaseId } });
    await resolveCase(db, {
      caseId: modCase.id,
      outcome: "upheld",
      citedRuleId: "R3.4",
      badFaith: false,
    });

    await topUpForTests(db, creatorId, { pc: 60, g: 60 });
    const appealed = await appealCase(db, {
      caseId: modCase.id,
      profileId: creatorId, // the accused proposer
    });
    expect(appealed.ok).toBe(true);

    // An appeal with no evidence is not an appeal; and db:verify's
    // evidence-shape check would fail the case outright.
    const appeal = await db.modCase.findFirstOrThrow({ where: { appealOfId: modCase.id } });
    expect(appeal.releaseId).toBe(rReleaseId);
    expect(appeal.postId).toBeNull();
    expect(appeal.dmExcerptId).toBeNull();

    // And the appealed case's file opens too.
    const file = await caseFileFor(db, appeal.id);
    expect(file!.content).toContain("Materials for the build day");
  }, 60_000);

  it("db:verify passes with a release case and its appeal on the books", () => {
    const result = runVerify();
    expect(result.status).toBe(0);
  }, 60_000);
});
