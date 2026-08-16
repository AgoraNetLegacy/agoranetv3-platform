// Light Score v3; the derivation layer (LIGHT_SCORE_EXTENSION_SPEC).
//
// Reputation is PER IDENTITY, PER PILLAR: a constellation, never one number.
// This module derives one identity's standing from four inputs:
//
//   1. Discussion contributions (v2's core input, carried forward);
//      posts in PUBLIC pillar Discussions. Members'-room posts never
//      feed standing: the room is not the record (CIRCLES §2.3), and a
//      public number must never derive from private activity.
//   2. Circle attested actions + 3. accepted Picture repairs; already
//      recorded as LightScoreAdjustment rows by their features, with
//      named causes for the explainable log (§6).
//   4. Moderation service; derived from resolved-case rulings,
//      quality-gated (overridden rulings accrue nothing, §5.3),
//      credited in each case's own pillar (cross-pillar work credits
//      the rooms actually served, §2), daily-capped.
//
// Violation deductions (§4) arrive as negative adjustments from Phase 5,
// decaying on the strike clock; expired deductions simply stop counting
// (the ROW is permanent record, the ACTIVE effect decays; the same
// redemption shape as strikes).
//
// THE ANTI-SUM GUARD (§1.2; a build requirement, ported from v2's
// invariant): the constellation this module returns has POISONED
// total/sum/overall/global accessors that throw. Any future code; a
// page, an export, a metric; that reaches for a universal score fails
// loudly at runtime, and tests hold the tripwire in place. Scores are
// also never compared across identities here: no leaderboard export exists
// in this module by design (Keystone's pillar leaderboards are a
// launch-footprint item with their own spec).

import type { PrismaClient } from "@prisma/client";
import type { DbOrTx } from "./db";
import { getRail } from "./rails";
import { scorePillar, type ScoreLine, type ScoreWeights } from "./score";

export interface PillarStanding {
  pillarId: string;
  slug: string;
  name: string;
  icon: string;
  points: number;
  lines: ScoreLine[];
}

export class ScoreConstellation {
  readonly pillars: PillarStanding[];
  constructor(pillars: PillarStanding[]) {
    this.pillars = pillars;
    for (const key of ["total", "sum", "overall", "global", "combined"]) {
      Object.defineProperty(this, key, {
        get() {
          throw new Error(
            `Anti-sum guard: Light Score is per-pillar, never ${key}. ` +
              "No universal score exists (LIGHT_SCORE invariant 2)."
          );
        },
      });
    }
  }
  forPillar(pillarId: string): PillarStanding | null {
    return this.pillars.find((p) => p.pillarId === pillarId) ?? null;
  }
}

async function scoreWeights(db: DbOrTx): Promise<ScoreWeights> {
  return {
    answer: await getRail(db, "lightScore.answerPoints"),
    debatePost: await getRail(db, "lightScore.debatePostPoints"),
    participationCapPerDiscussion: await getRail(
      db,
      "lightScore.participationCapPerDiscussion"
    ),
  };
}

/** The pillar a case's service credits: the room actually served;
 *  post cases credit the post's pillar; DM cases have no pillar and
 *  land in the meta pillar (the DECISIONS_PENDING #9 interim rule,
 *  applied consistently on the credit side). */
async function casePillarId(db: DbOrTx, caseId: string): Promise<string | null> {
  const modCase = await db.modCase.findUnique({ where: { id: caseId } });
  if (!modCase) return null;
  if (modCase.postId) {
    const post = await db.post.findUnique({
      where: { id: modCase.postId },
      select: { discussion: { select: { pillarId: true } } },
    });
    return post?.discussion.pillarId ?? null;
  }
  const meta = await db.pillar.findFirst({ where: { isMeta: true } });
  return meta?.id ?? null;
}

/** Moderation-service credit per pillar for one identity: per resolved case,
 *  quality-gated, daily-capped (LIGHT_SCORE §2, §5.3). */
async function moderationServiceByPillar(
  db: DbOrTx,
  profileId: string
): Promise<Map<string, { points: number; cases: number }>> {
  const credit = await getRail(db, "lightScore.moderationCaseCredit");
  const dailyCap = await getRail(db, "lightScore.moderationDailyCapPoints");

  const rulings = await db.ruling.findMany({
    where: {
      moderatorProfileId: profileId,
      // The quality gate: a ruling its supervisor overrode accrues
      // nothing. (Appeal-overturned consequences already unwind their
      // adjustments; the supervision gate is the service-credit filter.)
      supervision: { not: "overridden" },
      case: { status: "resolved" },
    },
    select: { caseId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Daily cap first (service is service, whatever the room), then credit
  // each counted case to its own pillar.
  const byDay = new Map<string, typeof rulings>();
  for (const r of rulings) {
    const day = r.createdAt.toISOString().slice(0, 10);
    const list = byDay.get(day) ?? [];
    list.push(r);
    byDay.set(day, list);
  }
  const counted: typeof rulings = [];
  for (const list of byDay.values()) {
    const maxCases = credit > 0 ? Math.floor(dailyCap / credit) : 0;
    counted.push(...list.slice(0, maxCases));
  }

  const out = new Map<string, { points: number; cases: number }>();
  for (const r of counted) {
    const pillarId = await casePillarId(db, r.caseId);
    if (!pillarId) continue;
    const cell = out.get(pillarId) ?? { points: 0, cases: 0 };
    cell.points += credit;
    cell.cases += 1;
    out.set(pillarId, cell);
  }
  return out;
}

/** One identity's full constellation; every pillar it has standing in. */
export async function faceConstellation(
  db: PrismaClient,
  profileId: string
): Promise<ScoreConstellation> {
  const [pillars, weights, posts, adjustments, service] = await Promise.all([
    db.pillar.findMany({
      select: { id: true, slug: true, name: true, icon: true },
      orderBy: { position: "asc" },
    }),
    scoreWeights(db),
    // Public Discussion contributions only: never members'-room posts
    // (the room is not the record), never hidden content.
    db.post.findMany({
      where: {
        authorProfileId: profileId,
        status: "visible",
        // Never members'-room posts, never workshop drafts (the
        // enclosed spaces are not the record; a public number must
        // never derive from private activity).
        discussion: { circleId: null, chamberId: null },
      },
      select: {
        discussionId: true,
        parentId: true,
        discussion: { select: { pillarId: true } },
      },
    }),
    db.lightScoreAdjustment.findMany({
      where: {
        profileId,
        OR: [{ decaysAt: null }, { decaysAt: { gt: new Date() } }],
      },
    }),
    moderationServiceByPillar(db, profileId),
  ]);

  // pillarId -> discussionId -> contribution
  const byPillar = new Map<string, Map<string, { answers: number; debatePosts: number }>>();
  for (const p of posts) {
    const pillarId = p.discussion.pillarId;
    let discussions = byPillar.get(pillarId);
    if (!discussions) byPillar.set(pillarId, (discussions = new Map()));
    let cell = discussions.get(p.discussionId);
    if (!cell) discussions.set(p.discussionId, (cell = { answers: 0, debatePosts: 0 }));
    if (p.parentId === null) cell.answers += 1;
    else cell.debatePosts += 1;
  }

  const standings: PillarStanding[] = [];
  for (const pillar of pillars) {
    const contributions = Array.from(
      (byPillar.get(pillar.id) ?? new Map()).entries()
    ).map(([discussionId, c]) => ({ discussionId, ...(c as { answers: number; debatePosts: number }) }));
    const base = scorePillar(contributions, weights);
    const lines = [...base.lines];
    let points = base.points;

    const credits = adjustments.filter((a) => a.pillarId === pillar.id && a.amount > 0);
    const deductions = adjustments.filter((a) => a.pillarId === pillar.id && a.amount < 0);
    const circleCredit = credits
      .filter((a) => a.refType === "circle-action" || a.refType === "circle-attest")
      .reduce((s, a) => s + a.amount, 0);
    const repairCredit = credits
      .filter((a) => a.refType === "picture-repair")
      .reduce((s, a) => s + a.amount, 0);
    const otherCredit = credits
      .filter(
        (a) =>
          a.refType !== "circle-action" &&
          a.refType !== "circle-attest" &&
          a.refType !== "picture-repair"
      )
      .reduce((s, a) => s + a.amount, 0);
    const deducted = deductions.reduce((s, a) => s + a.amount, 0);

    if (circleCredit) lines.push({ label: "Attested Circle actions", points: circleCredit });
    if (repairCredit) lines.push({ label: "Accepted Picture repairs", points: repairCredit });
    if (otherCredit) lines.push({ label: "Other credits", points: otherCredit });
    const svc = service.get(pillar.id);
    if (svc?.points) {
      lines.push({ label: `Moderation service (${svc.cases} case${svc.cases === 1 ? "" : "s"})`, points: svc.points });
    }
    if (deducted) lines.push({ label: "Active violation deductions", points: deducted });

    points += circleCredit + repairCredit + otherCredit + (svc?.points ?? 0) + deducted;
    if (points !== 0 || lines.length > 0) {
      standings.push({
        pillarId: pillar.id,
        slug: pillar.slug,
        name: pillar.name,
        icon: pillar.icon,
        points,
        lines,
      });
    }
  }
  return new ScoreConstellation(standings);
}

/** One identity's standing in ONE pillar; the dashboard stat-row number. */
export async function pillarStanding(
  db: PrismaClient,
  profileId: string,
  pillarId: string
): Promise<{ points: number; lines: ScoreLine[] }> {
  const constellation = await faceConstellation(db, profileId);
  const standing = constellation.forPillar(pillarId);
  return standing ?? { points: 0, lines: [] };
}

export interface ScoreChange {
  at: Date;
  pillarName: string;
  amount: number;
  cause: string;
}

/** The explainable score-change log (§6): visible to the profile OWNER
 *  only, every change with its named cause; no black-box reputation. */
export async function scoreChangeLog(
  db: PrismaClient,
  profileId: string,
  limit = 50
): Promise<ScoreChange[]> {
  const adjustments = await db.lightScoreAdjustment.findMany({
    where: { profileId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  const pillars = new Map(
    (await db.pillar.findMany({ select: { id: true, name: true } })).map((p) => [p.id, p.name])
  );

  const changes: ScoreChange[] = [];
  for (const a of adjustments) {
    let cause: string;
    if (a.refType === "circle-action" || a.refType === "circle-attest") {
      const entry = a.refId
        ? await db.actionEntry.findUnique({
            where: { id: a.refId },
            select: { circle: { select: { name: true } } },
          })
        : null;
      const circleName = entry?.circle.name ?? "a Circle";
      cause =
        a.refType === "circle-action"
          ? `Attested action in ${circleName}`
          : `Attested a fellow member's action in ${circleName}`;
    } else if (a.refType === "picture-repair") {
      const repair = a.refId
        ? await db.pictureRepair.findUnique({
            where: { id: a.refId },
            select: { domain: { select: { title: true } } },
          })
        : null;
      cause = `Accepted repair on ${repair?.domain.title ?? "a domain Picture"}`;
    } else if (a.caseId) {
      const expired = a.decaysAt && a.decaysAt <= new Date();
      cause = `Upheld moderation ruling; deduction${expired ? " (decayed; no longer active)" : a.decaysAt ? `, decays ${a.decaysAt.toLocaleDateString()}` : ""}`;
    } else {
      cause = "Adjustment";
    }
    changes.push({
      at: a.createdAt,
      pillarName: pillars.get(a.pillarId) ?? "?",
      amount: a.amount,
      cause,
    });
  }
  return changes;
}
