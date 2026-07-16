// Phase 7.5 — Chambers (Pollinator v1). The invariants under test:
// the dual-token signature (creation and workshop posts charge BOTH
// currencies — both halves or neither), the ratified creation
// requirements (scaffold + "why should people care"), the entry
// prerequisites (gate + carrying both tokens — the complete definition,
// owner-resolved OQ5), private chambers as creator-invite-only, and the
// enclosure: workshop content never reaches the ledger, Light Score,
// the open lens, or public search — and db:verify FAILS LOUDLY when it
// does.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "child_process";
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
import { balanceOf, tip } from "../lib/economy";
import {
  chamberBalanceOf,
  creditMissionBalance,
  proposeRelease,
  attestRelease,
  freezeChamberReleases,
} from "../lib/escrow";
import { faceConstellation } from "../lib/lightScore";
import { buildFeed, openLens, chamberStorefrontCards } from "../lib/feed";
import { search } from "../lib/search";
import { makeOnboardedSoul, topUpForTests } from "./helpers/souls";

const db = new PrismaClient({ datasources: { db: { url } } });

let creatorId: string;
let workerId: string;
let strangerId: string;
let paupergId: string; // a soul drained of Gratium — fails "carrying both"
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

describe("creation — the dual-token signature", () => {
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

  it("refuses creation when EITHER token is short — both halves or neither", async () => {
    // Drain the pauper's Gratium below the 20u fee via a real tip
    // (accounted flow — conservation holds). Verified grant = 25 G.
    const seedPost = await db.post.findFirst({ where: { authorProfileId: { not: paupergId } } });
    // No posts exist yet — make one to tip, from the stranger.
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
      whyCare: "Wasted food, hungry neighbors, and the fix is logistics — solvable now, by us.",
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

describe("entry — gate + carrying both tokens, and nothing else", () => {
  it("refuses a soul carrying only one token, and admits them once they carry both", async () => {
    // The pauper spent Gratium down but still holds some (15 tipped of
    // 25) — drain to zero with one more tip, then assert refusal.
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

  it("admits any verified soul to a public chamber — no Light Score floor, no approval", async () => {
    const result = await enterChamber(db, { chamberId: publicChamberId, profileId: workerId });
    expect(result.ok).toBe(true);
    expect(await workshopAccess(db, publicChamberId, workerId)).toBe(true);
    // Entering is free — no fee entry of any chamber kind for entry.
    expect(await db.economyEntry.count({ where: { kind: "fee.chamber-post" } })).toBe(0);
  });

  it("rejects double entry", async () => {
    const again = await enterChamber(db, { chamberId: publicChamberId, profileId: workerId });
    expect(again.ok).toBe(false);
  });

  it("records entry PRIVATELY — membership is enclosed-space information", async () => {
    const clearances = await db.gateRequest.findMany({
      where: { scope: { startsWith: `chamber:${publicChamberId}:enter` } },
    });
    expect(clearances.length).toBeGreaterThan(0);
    for (const c of clearances) expect(c.ledgerRecording).toBe("private");
    // Aggregates are the public story: count, never the list.
    const memberEvents = await db.ledgerEvent.findMany({
      where: { eventType: { contains: "chamber" } },
    });
    expect(memberEvents.every((e) => e.eventType === "chamber.created")).toBe(true);
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

describe("the workshop — dual-token participation inside the enclosure", () => {
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

  it("blocks permanence upgrades — drafts stay drafts", async () => {
    const post = await db.post.findFirstOrThrow({ where: { discussionId: workshopId } });
    const result = await upgradePostPermanence(db, { postId: post.id, profileId: workerId });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("Workshop drafts stay in the workshop");
  });

  it("keeps workshop posts out of Light Score — a public number never derives from enclosed activity", async () => {
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

describe("private chambers — the creator selects who gets in", () => {
  it("creates a private chamber and refuses the uninvited", async () => {
    // The first chamber spent the creator down below a second dual fee —
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

describe("the hand-offs — feed and search meet the enclosure", () => {
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

  it("finds storefronts in search — never workshop interiors; private chambers by name only", async () => {
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

describe("db:verify — the enclosure fails loudly", () => {
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
// Circles — CIRCLES_SPEC Principle 4 forbids Circle custody ("the action
// layer does not quietly become a treasury"), and Chambers already have
// a ratified per-chamber balance (§9.1).
//
// THE THRESHOLD COUNTS CO-SIGNERS, NOT TOTAL VOICES — the Circle rule
// carried over exactly (CIRCLES_SPEC §6.1: the author is separate; the
// threshold counts attestations). So a default of 2 means the proposer
// plus TWO other members: three distinct humans before money moves.
// Its own dedicated chamber below, so open proposals from other tests
// can never pollute a balance assertion.
// ─────────────────────────────────────────────────────────────────────
describe("mission escrow — holding, attested release, and the freeze", () => {
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
    // where the balance came from — donations (souls → chamber) are
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

  it("refuses a release with no stated purpose — the purpose IS the claim attested", async () => {
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

  it("REFUSES self-attestation — 'attested' must mean more than one voice", async () => {
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
    // One co-signer, threshold 2 — proposer + one is not corroboration.
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

  it("★ pays AUTOMATICALLY at the threshold — no operator step exists (§3.7)", async () => {
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
    // The SECOND co-signature meets the threshold — and the very call
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

  it("★ freezes every unreleased proposal on a ruling — the real teeth (§3.4)", async () => {
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
    // A frozen release always cites its due process — never a quiet
    // decision someone made.
    expect(all.every((r) => r.frozenByRulingId === "ruling-test-misuse")).toBe(true);

    // You cannot claw back what is spent; the already-paid release stays
    // paid. Freeze stops what has NOT moved — that is the whole claim,
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
