// The Feed (Phase 7; FEED_AND_SEARCH_SPEC §§1–3, §5–6).
//
// The law of this surface: published formula or no formula; show the why,
// everywhere; the feed ENDS; chosen, not inferred; per-persona,
// absolutely; substance signals only (never views, never dwell).
//
// Two parts (§2): the backbone is what the soul explicitly chose;
// pillars, domains, Discussions (join = follow), Circles, polls, fellow
// souls (OFF by default); and one open lens ("Popular now") ranked by
// the published participation formula, identical for everyone.
//
// Everything here is per-profile reading state: none of it is ledgered,
// none of it crosses identities, none of it feeds ranking anywhere.

import type { PrismaClient } from "@prisma/client";
import { getRail } from "./rails";

export const FEED_FORMULA_VERSION = "v1; 2026-07-11";

export interface FeedCard {
  /** Discussion cards link to /d/:id; poll cards to /polls/:id. */
  kind: "discussion" | "poll";
  discussionId: string;
  title: string;
  pillarSlug: string;
  pillarName: string;
  pillarIcon: string;
  permanence: string;
  newPosts: number;
  participants: number;
  lastActivityAt: Date;
  whyLine: string;
}

export interface LensCard extends FeedCard {
  score: number;
  scoreParts: string;
}

/** Cold start (§5): day one, every new profile's feed = all seven
 *  pillars + the open lens + balanced diet. Idempotent; called when the
 *  feed is first visited by an identity. */
export async function ensureFeedDefaults(db: PrismaClient, profileId: string) {
  const settings = await db.feedSettings.findUnique({ where: { profileId } });
  if (settings) return settings;
  const pillars = await db.pillar.findMany({ select: { id: true } });
  return db.$transaction(async (tx) => {
    const again = await tx.feedSettings.findUnique({ where: { profileId } });
    if (again) return again;
    for (const p of pillars) {
      await tx.feedSource.upsert({
        where: { profileId_kind_refId: { profileId, kind: "pillar", refId: p.id } },
        create: { profileId, kind: "pillar", refId: p.id },
        update: {},
      });
    }
    return tx.feedSettings.create({ data: { profileId } });
  });
}

interface SourceSet {
  pillarIds: Set<string>;
  domainIds: Set<string>;
  discussionIds: Set<string>; // explicit + implicit (join = follow)
  circleIds: Set<string>;
  chamberIds: Set<string>; // entered chambers (Phase 7.5, §2.1)
  pollIds: Set<string>;
  fellowSouls: boolean;
}

export async function chosenSources(db: PrismaClient, profileId: string): Promise<SourceSet> {
  const [rows, authored] = await Promise.all([
    db.feedSource.findMany({ where: { profileId } }),
    // Join = follow (DISCUSSIONS §3): participating follows the thread.
    db.post.findMany({
      where: { authorProfileId: profileId },
      select: { discussionId: true },
      distinct: ["discussionId"],
    }),
  ]);
  const set: SourceSet = {
    pillarIds: new Set(),
    domainIds: new Set(),
    discussionIds: new Set(authored.map((a) => a.discussionId)),
    circleIds: new Set(),
    chamberIds: new Set(),
    pollIds: new Set(),
    fellowSouls: false,
  };
  for (const r of rows) {
    if (r.kind === "pillar" && r.refId) set.pillarIds.add(r.refId);
    else if (r.kind === "domain" && r.refId) set.domainIds.add(r.refId);
    else if (r.kind === "discussion" && r.refId) set.discussionIds.add(r.refId);
    else if (r.kind === "circle" && r.refId) set.circleIds.add(r.refId);
    else if (r.kind === "chamber" && r.refId) set.chamberIds.add(r.refId);
    else if (r.kind === "poll" && r.refId) set.pollIds.add(r.refId);
    else if (r.kind === "fellow-souls") set.fellowSouls = true;
  }
  return set;
}

/** The chosen-sources backbone: Discussion cards (the launch card type,
 *  §2.3) with activity since the soul's read position, each carrying its
 *  why-line. The feed is finite by design. */
export async function buildFeed(
  db: PrismaClient,
  profileId: string
): Promise<{ cards: FeedCard[]; since: Date | null }> {
  const settings = await ensureFeedDefaults(db, profileId);
  const sources = await chosenSources(db, profileId);
  const since = settings.caughtUpAt;

  // Fellow-souls source (§2.1, Phase 6.5 hand-off; OFF by default):
  // discussions where a bonded profile recently posted PUBLICLY. Your
  // bond list renders for you alone; naming them to their owner is the
  // private graph working as designed.
  const fellowHandles = new Map<string, string>(); // discussionId -> handle
  if (sources.fellowSouls) {
    const bonds = await db.fellowSoulBond.findMany({
      where: { OR: [{ aProfileId: profileId }, { bProfileId: profileId }] },
    });
    const bondedIds = bonds.map((b) => (b.aProfileId === profileId ? b.bProfileId : b.aProfileId));
    if (bondedIds.length > 0) {
      const posts = await db.post.findMany({
        where: {
          authorProfileId: { in: bondedIds },
          status: "visible",
          discussion: { circleId: null, chamberId: null },
          ...(since ? { createdAt: { gt: since } } : {}),
        },
        select: { discussionId: true, authorHandle: true },
        orderBy: { createdAt: "desc" },
      });
      for (const p of posts) {
        if (!fellowHandles.has(p.discussionId)) fellowHandles.set(p.discussionId, p.authorHandle);
      }
    }
  }

  // Candidate discussions from every chosen source. Members'-room
  // discussions surface ONLY through a circle-membership source and only
  // to a current member (checked below); the enclosed-space rule.
  const memberships = await db.circleMember.findMany({
    where: { profileId, leftAt: null },
    select: { circleId: true },
  });
  const memberCircleIds = new Set(memberships.map((m) => m.circleId));
  const followedCircleIds = [...sources.circleIds].filter((id) => memberCircleIds.has(id));
  // Entered chambers (Phase 7.5): workshops surface ONLY through a
  // chamber source and only to a soul who entered; the enclosed-space
  // rule, chamber edition. The card carries space-level facts only.
  const chamberMemberships = await db.chamberMember.findMany({
    where: { profileId },
    select: { chamberId: true },
  });
  const memberChamberIds = new Set(chamberMemberships.map((m) => m.chamberId));
  const followedChamberIds = [...sources.chamberIds].filter((id) => memberChamberIds.has(id));

  const discussions = await db.discussion.findMany({
    where: {
      OR: [
        { circleId: null, chamberId: null, pillarId: { in: [...sources.pillarIds] } },
        { circleId: null, chamberId: null, domainId: { in: [...sources.domainIds] } },
        { circleId: null, chamberId: null, id: { in: [...sources.discussionIds, ...fellowHandles.keys()] } },
        { circleId: { in: followedCircleIds } },
        { chamberId: { in: followedChamberIds } },
      ],
    },
    include: {
      pillar: { select: { slug: true, name: true, icon: true } },
      domain: { select: { id: true, title: true } },
      circle: { select: { id: true, name: true } },
      chamber: { select: { id: true, title: true } },
      posts: {
        where: { status: "visible", ...(since ? { createdAt: { gt: since } } : {}) },
        select: { authorHandle: true, createdAt: true },
      },
    },
  });

  const cards: FeedCard[] = [];
  for (const d of discussions) {
    if (d.posts.length === 0) continue; // nothing new = nothing to show
    const lastActivityAt = d.posts.reduce(
      (latest, p) => (p.createdAt > latest ? p.createdAt : latest),
      new Date(0)
    );
    // The why-line (§1.2): the most specific chosen source wins.
    let whyLine: string;
    if (d.chamber && sources.chamberIds.has(d.chamber.id)) {
      whyLine = `In your feed: a chamber you've entered; ${d.chamber.title} (workshop)`;
    } else if (d.circle && sources.circleIds.has(d.circle.id)) {
      whyLine = `In your feed: your Circle ${d.circle.name} (members' room)`;
    } else if (fellowHandles.has(d.id)) {
      whyLine = `In your feed: your fellow soul @${fellowHandles.get(d.id)} is active here (source you switched on)`;
    } else if (sources.discussionIds.has(d.id)) {
      whyLine = "In your feed: you joined this Discussion (join = follow)";
    } else if (d.domain && sources.domainIds.has(d.domain.id)) {
      whyLine = `In your feed: you follow the domain "${d.domain.title}"`;
    } else {
      whyLine = `In your feed: you follow ${d.pillar.name}`;
    }
    cards.push({
      kind: "discussion",
      discussionId: d.id,
      title: d.title,
      pillarSlug: d.pillar.slug,
      pillarName: d.pillar.name,
      pillarIcon: d.pillar.icon,
      permanence: d.permanence,
      newPosts: d.posts.length,
      participants: new Set(d.posts.map((p) => p.authorHandle)).size,
      lastActivityAt,
      whyLine,
    });
  }

  // Poll cards for explicitly followed polls (§2.1 makes the source
  // launch scope; the fuller card-type rollout order is the spec's §9.3
  // owner item, flagged): status changes only; closing soon or results
  // published; never a tally while sealed.
  if (sources.pollIds.size > 0) {
    const polls = await db.poll.findMany({
      where: { id: { in: [...sources.pollIds] }, visibilityScope: "public" },
      include: { pillar: { select: { slug: true, name: true, icon: true } } },
    });
    for (const p of polls) {
      const changedAt = p.status === "closed" ? (p.closedAt ?? p.nominalCloseAt) : p.createdAt;
      if (since && changedAt <= since && p.status === "closed") continue;
      if (p.status === "open" && since && p.createdAt <= since) continue;
      cards.push({
        kind: "poll",
        discussionId: p.id,
        title: p.title,
        pillarSlug: p.pillar.slug,
        pillarName: p.pillar.name,
        pillarIcon: p.pillar.icon,
        permanence: p.isGovernance ? "permanent-governance" : "poll",
        newPosts: 0,
        participants: 0,
        lastActivityAt: changedAt,
        whyLine:
          p.status === "closed"
            ? "In your feed: a poll you follow published its results"
            : `In your feed: a poll you follow closes ${p.nominalCloseAt.toLocaleString()}`,
      });
    }
  }

  cards.sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());

  // Balanced diet (§3, default-on): interleave across pillars so one
  // interest can't monopolize the stream. Round-robin by pillar,
  // recency within each.
  if (settings.balancedDiet) {
    const byPillar = new Map<string, FeedCard[]>();
    for (const c of cards) {
      const list = byPillar.get(c.pillarSlug) ?? [];
      list.push(c);
      byPillar.set(c.pillarSlug, list);
    }
    const queues = [...byPillar.values()];
    const interleaved: FeedCard[] = [];
    let added = true;
    while (added) {
      added = false;
      for (const q of queues) {
        const next = q.shift();
        if (next) {
          interleaved.push(next);
          added = true;
        }
      }
    }
    return { cards: interleaved, since };
  }
  return { cards, since };
}

export interface StorefrontCard {
  chamberId: string;
  title: string;
  subject: string;
  whyCare: string;
  creatorHandle: string;
  members: number;
  createdAt: Date;
  lastActivityAt: Date;
  whyLine: string;
}

/** Chamber storefront cards (§2.3; a launch-host hand-off): new and
 *  active PUBLIC chambers, most recent workshop activity first; a
 *  legible rule stated on every card, identical for everyone. Only the
 *  storefront rides the card; workshop contents never leave the
 *  workshop. */
export async function chamberStorefrontCards(
  db: PrismaClient,
  limit = 5
): Promise<StorefrontCard[]> {
  const chambers = await db.chamber.findMany({
    where: { isPublic: true },
    include: { members: { select: { id: true } } },
    orderBy: { lastActivityAt: "desc" },
    take: limit,
  });
  return chambers.map((c) => ({
    chamberId: c.id,
    title: c.title,
    subject: c.subject,
    whyCare: c.whyCare,
    creatorHandle: c.creatorHandle,
    members: c.members.length,
    createdAt: c.createdAt,
    lastActivityAt: c.lastActivityAt,
    whyLine:
      "New & active public chambers; most recent workshop activity first, same for everyone",
  }));
}

/** The open lens (§2.2): "Popular now", ranked by the PUBLISHED
 *  participation formula; identical for everyone, over public
 *  Discussions only. Views and dwell time are never inputs.
 *
 *  score = (Wc × unique contributors + Wt × unique tippers
 *           + Ws × sourced posts) × 0.5^(hours since last activity / H)
 *
 *  computed over the activity window (4 × H hours). Weights and
 *  half-life are rails; the formula page renders them live. */
export async function openLens(
  db: PrismaClient,
  limit = 10,
  // Community lanes (BEACON §3.4): the same published formula, scoped
  // to one pillar; the pillar-pulse lane. No new math, no new inputs.
  pillarSlug?: string
): Promise<LensCard[]> {
  const [wC, wT, wS, halfLife] = await Promise.all([
    getRail(db, "feed.lensContributorWeight"),
    getRail(db, "feed.lensTipWeight"),
    getRail(db, "feed.lensSourcedWeight"),
    getRail(db, "feed.lensHalfLifeHours"),
  ]);
  const windowStart = new Date(Date.now() - 4 * halfLife * 3_600_000);

  const discussions = await db.discussion.findMany({
    where: {
      circleId: null,
      chamberId: null,
      ...(pillarSlug ? { pillar: { slug: pillarSlug } } : {}),
      posts: { some: { createdAt: { gt: windowStart } } },
    },
    include: {
      pillar: { select: { slug: true, name: true, icon: true } },
      posts: {
        where: { status: "visible", createdAt: { gt: windowStart } },
        select: {
          authorHandle: true,
          createdAt: true,
          tips: { select: { tipperProfileId: true } },
          sources: { select: { id: true } },
        },
      },
    },
  });

  const cards: LensCard[] = [];
  for (const d of discussions) {
    if (d.posts.length === 0) continue;
    const contributors = new Set(d.posts.map((p) => p.authorHandle)).size;
    const tippers = new Set(d.posts.flatMap((p) => p.tips.map((t) => t.tipperProfileId))).size;
    const sourced = d.posts.filter((p) => p.sources.length > 0).length;
    const lastActivityAt = d.posts.reduce(
      (latest, p) => (p.createdAt > latest ? p.createdAt : latest),
      new Date(0)
    );
    const ageHours = (Date.now() - lastActivityAt.getTime()) / 3_600_000;
    const decay = Math.pow(0.5, ageHours / halfLife);
    const raw = wC * contributors + wT * tippers + wS * sourced;
    const score = raw * decay;
    if (score <= 0) continue;
    cards.push({
      kind: "discussion",
      discussionId: d.id,
      title: d.title,
      pillarSlug: d.pillar.slug,
      pillarName: d.pillar.name,
      pillarIcon: d.pillar.icon,
      permanence: d.permanence,
      newPosts: d.posts.length,
      participants: contributors,
      lastActivityAt,
      whyLine: `Open lens: ${contributors} unique contributor${contributors === 1 ? "" : "s"}${
        tippers ? `, ${tippers} unique tipper${tippers === 1 ? "" : "s"}` : ""
      }${sourced ? `, ${sourced} sourced post${sourced === 1 ? "" : "s"}` : ""} this window; published formula, same for everyone`,
      score,
      scoreParts: `(${wC}×${contributors} + ${wT}×${tippers} + ${wS}×${sourced}) × ${decay.toFixed(2)}`,
    });
  }
  cards.sort((a, b) => b.score - a.score);
  return cards.slice(0, limit);
}
