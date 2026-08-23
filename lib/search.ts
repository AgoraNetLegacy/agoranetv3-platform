// Search (Phase 7; FEED_AND_SEARCH_SPEC §4): active lookup, "I know
// what I'm looking for." Nine entity types, visibility-scoped at the
// query; the deliberate exclusions are structural, not filtered
// after the fact: members'-room and DM content never enter a public
// query; moderator identity exists in no searchable surface; nothing
// cross-persona exists to leak.
//
// Rules (§4.2): free for everyone including signed-out readers; ranking
// is published (match quality + substance signals; never engagement,
// never personalization: same query, same results, for everyone);
// search history is per-profile, visible, deletable, never a ranking
// input.

import type { PrismaClient } from "@prisma/client";
import { HELP_ARTICLES } from "./helpContent";

export const ENTITY_TYPES = [
  "content",
  "souls",
  "fellow-souls",
  "places",
  "canon",
  "civic-records",
  "polls",
  "sources",
  "help",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const ENTITY_LABELS: Record<EntityType, string> = {
  content: "Content; Discussions, replies, Circle pages, Chamber storefronts",
  souls: "Souls; lookup by @handle or display name",
  "fellow-souls": "Fellow souls; within your own list",
  places: "Places; Circles working in a city or region",
  canon: "Pillars & canon; the 49 questions and 56 domains",
  "civic-records": "Civic records; governance results, the rulebook, treasury days",
  polls: "Polls; by status",
  sources: "Sources; every conversation citing a study or article",
  help: "Help; how the platform works, fees, rules",
};

export interface SearchHit {
  type: EntityType;
  title: string;
  href: string;
  snippet?: string;
  badge?: string;
  /** Published ranking: matchQuality (2 title / 1 body) + substance. */
  score: number;
}

export interface SearchFilters {
  types?: EntityType[];
  pillarSlug?: string;
  place?: string;
  permanence?: "permanent" | "deletable";
  hasSources?: boolean;
  pollStatus?: "open" | "closed";
  from?: Date;
  to?: Date;
}

const LIMIT_PER_TYPE = 12;

function want(filters: SearchFilters, type: EntityType): boolean {
  return !filters.types || filters.types.length === 0 || filters.types.includes(type);
}

function dateWhere(filters: SearchFilters) {
  const clause: { gte?: Date; lte?: Date } = {};
  if (filters.from) clause.gte = filters.from;
  if (filters.to) clause.lte = filters.to;
  return Object.keys(clause).length ? clause : undefined;
}

/** The whole public index, one query in. viewerProfileId personalizes
 *  NOTHING about ranking; it only unlocks the viewer's own private
 *  scopes (their fellow-souls list) and annotates relationships. */
export async function search(
  db: PrismaClient,
  query: string,
  filters: SearchFilters = {},
  viewerProfileId: string | null = null
): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  const soulQuery = q.replace(/^@/, "");
  const hits: SearchHit[] = [];
  const created = dateWhere(filters);

  // 1; Content: public Discussions + visible replies in them + public
  // Circle pages + Chamber STOREFRONTS (never workshop interiors;
  // FEED_AND_SEARCH §4.1: a soul searching inside a space they entered
  // is in-space search, on the workshop page). Members' rooms, workshops,
  // and DMs are structurally absent: the discussion and post queries
  // REQUIRE circleId AND chamberId null; the chamber query touches only
  // storefront fields, and a private chamber matches on its minimal
  // storefront (the title) alone.
  if (want(filters, "content")) {
    const [discussions, posts, circles, chambers] = await Promise.all([
      db.discussion.findMany({
        where: {
          circleId: null,
          chamberId: null,
          title: { contains: q },
          ...(filters.pillarSlug ? { pillar: { slug: filters.pillarSlug } } : {}),
          ...(filters.permanence === "permanent"
            ? { permanence: { startsWith: "permanent" } }
            : filters.permanence === "deletable"
              ? { permanence: "deletable" }
              : {}),
          ...(created ? { createdAt: created } : {}),
        },
        include: { pillar: true, posts: { select: { authorHandle: true } } },
        take: LIMIT_PER_TYPE,
      }),
      db.post.findMany({
        where: {
          status: "visible",
          body: { contains: q },
          discussion: {
            circleId: null,
            chamberId: null,
            ...(filters.pillarSlug ? { pillar: { slug: filters.pillarSlug } } : {}),
          },
          ...(filters.hasSources ? { sources: { some: {} } } : {}),
          ...(created ? { createdAt: created } : {}),
        },
        include: { discussion: { include: { pillar: true } }, sources: true },
        take: LIMIT_PER_TYPE,
      }),
      db.circle.findMany({
        where: {
          OR: [{ name: { contains: q } }, { purpose: { contains: q } }, { problem: { contains: q } }],
          ...(filters.pillarSlug ? { pillar: { slug: filters.pillarSlug } } : {}),
          ...(filters.place ? { placeTag: { contains: filters.place } } : {}),
        },
        include: { members: { where: { leftAt: null }, select: { id: true } } },
        take: LIMIT_PER_TYPE,
      }),
      db.chamber.findMany({
        where: {
          OR: [
            { title: { contains: q } },
            { isPublic: true, subject: { contains: q } },
            { isPublic: true, pitch: { contains: q } },
            { isPublic: true, whyCare: { contains: q } },
          ],
        },
        include: { members: { select: { id: true } } },
        take: LIMIT_PER_TYPE,
      }),
    ]);
    for (const d of discussions) {
      hits.push({
        type: "content",
        title: d.title,
        href: `/d/${d.id}`,
        badge: `${d.pillar.icon} ${d.pillar.name} · Discussion`,
        score: 2 + new Set(d.posts.map((p) => p.authorHandle)).size,
      });
    }
    for (const p of posts) {
      hits.push({
        type: "content",
        title: p.discussion.title,
        href: `/d/${p.discussion.id}`,
        snippet: p.body.slice(0, 180),
        badge: `${p.discussion.pillar.icon} reply by @${p.authorHandle}${p.sources.length ? " · sourced" : ""}`,
        score: 1 + p.sources.length,
      });
    }
    for (const c of circles) {
      hits.push({
        type: "content",
        title: c.name,
        href: `/circles/${c.id}`,
        snippet: c.purpose.slice(0, 180),
        badge: `⭕ Circle${c.placeTag ? ` · 📍 ${c.placeTag}` : ""}`,
        score: 2 + c.members.length,
      });
    }
    for (const c of chambers) {
      hits.push({
        type: "content",
        title: c.title,
        href: `/pollinator/${c.id}`,
        snippet: c.isPublic ? c.whyCare.slice(0, 180) : undefined,
        badge: c.isPublic
          ? `🐝 Chamber storefront · ${c.members.length} soul${c.members.length === 1 ? "" : "s"} inside`
          : "🐝 Chamber · private; invite-only",
        score: 2 + (c.isPublic ? c.members.length : 0),
      });
    }
  }

  // 2; Souls: lookup, not discovery-of-persons. Display names duplicate
  // freely; @handles disambiguate. Every active profile passed the gate
  // (verified human). NOTHING here derives from the other identity; no such
  // data exists to derive from.
  if (want(filters, "souls")) {
    const profiles = await db.profile.findMany({
      where: {
        status: "active",
        OR: [{ handle: { contains: soulQuery.toLowerCase() } }, { displayName: { contains: soulQuery } }],
      },
      take: LIMIT_PER_TYPE,
    });
    // The viewer's own bonds annotate their results; visible to them
    // alone (§4.1.2 "your own fellow-soul relationship if one exists").
    const bonds = viewerProfileId
      ? await db.fellowSoulBond.findMany({
          where: { OR: [{ aProfileId: viewerProfileId }, { bProfileId: viewerProfileId }] },
        })
      : [];
    const bonded = new Set(
      bonds.map((b) => (b.aProfileId === viewerProfileId ? b.bProfileId : b.aProfileId))
    );
    for (const p of profiles) {
      const exact = p.handle === soulQuery.toLowerCase();
      hits.push({
        type: "souls",
        title: `${p.displayName} @${p.handle}`,
        href: `/souls/${encodeURIComponent(p.handle)}`,
        badge: `verified human · joined ${p.joinedPeriod}${bonded.has(p.id) ? " · your fellow soul" : ""}`,
        score: exact ? 4 : 2,
      });
    }
  }

  // 3; Fellow souls: the viewer's own list, private to them, per-identity.
  if (want(filters, "fellow-souls") && viewerProfileId) {
    const bonds = await db.fellowSoulBond.findMany({
      where: { OR: [{ aProfileId: viewerProfileId }, { bProfileId: viewerProfileId }] },
    });
    const ids = bonds.map((b) => (b.aProfileId === viewerProfileId ? b.bProfileId : b.aProfileId));
    const matches = await db.profile.findMany({
      where: {
        id: { in: ids },
        OR: [{ handle: { contains: soulQuery.toLowerCase() } }, { displayName: { contains: soulQuery } }],
      },
      take: LIMIT_PER_TYPE,
    });
    for (const p of matches) {
      hits.push({
        type: "fellow-souls",
        title: `${p.displayName} @${p.handle}`,
        href: "/souls",
        badge: "your fellow soul; only you see this result",
        score: 3,
      });
    }
  }

  // 4; Places: Circles are place-aware; a city surfaces its initiatives.
  if (want(filters, "places")) {
    const circles = await db.circle.findMany({
      where: { placeTag: { contains: q } },
      include: { members: { where: { leftAt: null }, select: { id: true } } },
      take: LIMIT_PER_TYPE,
    });
    for (const c of circles) {
      hits.push({
        type: "places",
        title: c.name,
        href: `/circles/${c.id}`,
        snippet: c.purpose.slice(0, 180),
        badge: `📍 ${c.placeTag} · ${c.members.length} member${c.members.length === 1 ? "" : "s"}`,
        score: 2 + c.members.length,
      });
    }
  }

  // 5; Pillars & canon: the 49 questions, the 56 domains, the pillar
  // identities and their breakdown content.
  if (want(filters, "canon")) {
    const [pillars, questions, domains] = await Promise.all([
      db.pillar.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { classicalName: { contains: q } },
            { loreName: { contains: q } },
          ],
        },
      }),
      db.question.findMany({
        where: { text: { contains: q } },
        include: { pillar: true, discussion: { select: { id: true } } },
        take: LIMIT_PER_TYPE,
      }),
      db.domain.findMany({
        where: {
          OR: [
            { title: { contains: q } },
            { openingQuestion: { contains: q } },
            { reality: { contains: q } },
            { impactPoint: { contains: q } },
          ],
          ...(filters.pillarSlug ? { pillar: { slug: filters.pillarSlug } } : {}),
        },
        include: { pillar: true },
        take: LIMIT_PER_TYPE,
      }),
    ]);
    for (const p of pillars) {
      hits.push({
        type: "canon",
        title: `${p.icon} ${p.name}; ${p.classicalName}, ${p.loreName}`,
        href: `/pillars/${p.slug}`,
        badge: "pillar",
        score: 4,
      });
    }
    for (const question of questions) {
      hits.push({
        type: "canon",
        title: question.text,
        href: question.discussion ? `/d/${question.discussion.id}` : `/pillars/${question.pillar.slug}`,
        badge: `${question.pillar.icon} canonical question ${question.position}`,
        score: 3,
      });
    }
    for (const d of domains) {
      hits.push({
        type: "canon",
        title: `${d.position}. ${d.title}`,
        href: `/pillars/${d.pillar.slug}/domains/${d.position}`,
        snippet: d.openingQuestion,
        badge: `${d.pillar.icon} ${d.pillar.name} domain`,
        score: d.title.toLowerCase().includes(q.toLowerCase()) ? 3 : 2,
      });
    }
  }

  // 6; Civic records: governance results, the rulebook, treasury days.
  // Radical transparency means the record is SEARCHABLE.
  if (want(filters, "civic-records")) {
    const [govPolls, rules, snapshots] = await Promise.all([
      db.poll.findMany({
        where: {
          isGovernance: true,
          status: "closed",
          OR: [{ title: { contains: q } }, { description: { contains: q } }],
        },
        include: { pillar: true },
        take: LIMIT_PER_TYPE,
      }),
      db.rule.findMany({
        where: { OR: [{ title: { contains: q } }, { summary: { contains: q } }, { id: { contains: q } }] },
        take: LIMIT_PER_TYPE,
      }),
      /^\d{4}(-\d{2}){0,2}$/.test(q)
        ? db.treasurySnapshot.findMany({ where: { day: { contains: q } }, take: 5 })
        : Promise.resolve([]),
    ]);
    for (const p of govPolls) {
      hits.push({
        type: "civic-records",
        title: p.title,
        href: `/polls/${p.id}`,
        badge: `${p.pillar.icon} governance record · ${p.outcome ?? "closed"}`,
        score: 3,
      });
    }
    for (const r of rules) {
      hits.push({
        type: "civic-records",
        title: `${r.id}; ${r.title}`,
        href: `/moderation`,
        snippet: r.summary.slice(0, 180),
        badge: `rulebook · tier ${r.tier}`,
        score: 3,
      });
    }
    for (const s of snapshots) {
      hits.push({
        type: "civic-records",
        title: `Treasury snapshot; ${s.day}`,
        href: "/transparency",
        badge: "treasury dashboard",
        score: 2,
      });
    }
  }

  // 7; Polls by status.
  if (want(filters, "polls")) {
    const polls = await db.poll.findMany({
      where: {
        visibilityScope: "public",
        OR: [{ title: { contains: q } }, { description: { contains: q } }],
        ...(filters.pollStatus ? { status: filters.pollStatus } : {}),
        ...(filters.pillarSlug ? { pillar: { slug: filters.pillarSlug } } : {}),
        ...(created ? { createdAt: created } : {}),
      },
      include: { pillar: true },
      take: LIMIT_PER_TYPE,
    });
    for (const p of polls) {
      hits.push({
        type: "polls",
        title: p.title,
        href: `/polls/${p.id}`,
        badge: `${p.pillar.icon} ${p.status === "open" ? `open; closes ${p.nominalCloseAt.toLocaleDateString()}` : "closed"}${p.isGovernance ? " · governance" : ""}`,
        score: p.status === "open" ? 3 : 2,
      });
    }
  }

  // 8; Sources: find every conversation citing a given study/article;
  // the research capability.
  if (want(filters, "sources")) {
    const sources = await db.sourceObject.findMany({
      where: { url: { contains: q } },
      include: {
        usages: {
          include: { post: { include: { discussion: { include: { pillar: true } } } } },
        },
      },
      take: LIMIT_PER_TYPE,
    });
    for (const s of sources) {
      const publicUsages = s.usages.filter(
        (u) => u.post.discussion.circleId === null && u.post.discussion.chamberId === null
      );
      if (publicUsages.length === 0) continue;
      const discussions = [...new Map(publicUsages.map((u) => [u.post.discussion.id, u.post.discussion])).values()];
      hits.push({
        type: "sources",
        title: s.url,
        href: `/d/${discussions[0].id}`,
        snippet: `Cited in ${discussions.length} discussion${discussions.length === 1 ? "" : "s"}: ${discussions.map((d) => d.title).join(" · ").slice(0, 160)}`,
        badge: `source object · ${publicUsages.length} citation${publicUsages.length === 1 ? "" : "s"}`,
        score: 2 + publicUsages.length,
      });
    }
  }

  // 9; Help & platform docs: how things work, fees, rules; the rails
  // ARE the honest documentation of every number.
  if (want(filters, "help")) {
    const needle = q.toLowerCase();
    for (const article of HELP_ARTICLES) {
      const titleMatch = article.title.toLowerCase().includes(needle);
      const text = [
        article.summary,
        article.body.join(" "),
        (article.keywords ?? []).join(" "),
      ].join(" ");
      if (!titleMatch && !text.toLowerCase().includes(needle)) continue;
      hits.push({
        type: "help",
        title: article.title,
        href: `/support/${article.slug}`,
        snippet: article.summary,
        badge: `${article.category} · approved help article`,
        score: titleMatch ? 4 : 2,
      });
    }
    const rails = await db.rail.findMany({
      where: { OR: [{ key: { contains: q } }, { description: { contains: q } }] },
      take: LIMIT_PER_TYPE,
    });
    for (const r of rails) {
      hits.push({
        type: "help",
        title: `${r.key} = ${r.value} ${r.unit}`,
        href: "/transparency",
        snippet: r.description.slice(0, 200),
        badge: `platform rail (poll-adjustable ${r.boundMin}–${r.boundMax})`,
        score: 1,
      });
    }
  }

  // Published ranking: score desc, then title. No personalization.
  hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return hits;
}

/** Record a query in the soul's own history (§4.2): visible to them,
 *  deletable, never used to rank anything; including by us. */
export async function recordSearch(db: PrismaClient, profileId: string, query: string) {
  const q = query.trim();
  if (!q) return;
  await db.searchQuery.create({ data: { profileId, query: q } });
}
