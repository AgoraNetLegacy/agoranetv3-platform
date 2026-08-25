import type { PrismaClient } from "@prisma/client";

export const OWNER_DASHBOARD_WINDOWS = [1, 7, 30, 90] as const;
export type OwnerDashboardWindow = (typeof OWNER_DASHBOARD_WINDOWS)[number];

export const OWNER_DASHBOARD_FUNNEL = [
  ["funnel.arrival", "Saw the account setup page"],
  ["funnel.gate", "Began verification"],
  ["funnel.verified", "Completed proof-of-humanity verification"],
  ["funnel.trueself", "Registered a True Self"],
  ["funnel.consents", "Accepted the founding consents"],
  ["funnel.seed", "Completed the values seed"],
  ["funnel.oriented", "Completed orientation"],
  ["funnel.alias", "Hatched an Alias"],
] as const;

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function sinceDays(days: OwnerDashboardWindow): Date {
  return new Date(Date.now() - days * 86_400_000);
}

/** Analytics is deliberately event-based. This helper combines the retained
 * raw window with already-crushed daily aggregates without exposing subjects. */
export async function analyticsCount(
  db: PrismaClient,
  name: string,
  days?: OwnerDashboardWindow
): Promise<number> {
  if (!days) {
    const [raw, crushed] = await Promise.all([
      db.analyticsEvent.count({ where: { name } }),
      db.analyticsAggregate.aggregate({ where: { name }, _sum: { count: true } }),
    ]);
    return raw + (crushed._sum.count ?? 0);
  }
  const start = sinceDays(days);
  const [raw, crushed] = await Promise.all([
    db.analyticsEvent.count({ where: { name, createdAt: { gte: start } } }),
    db.analyticsAggregate.aggregate({
      where: { name, period: { gte: utcDay(start) } },
      _sum: { count: true },
    }),
  ]);
  return raw + (crushed._sum.count ?? 0);
}

async function signupWindow(db: PrismaClient, days: OwnerDashboardWindow) {
  const [humans, trueSelves, aliases] = await Promise.all([
    analyticsCount(db, "funnel.verified", days),
    analyticsCount(db, "funnel.trueself", days),
    analyticsCount(db, "funnel.alias", days),
  ]);
  return { days, humans, trueSelves, aliases };
}

export function deploymentLabel(): "LOCAL" | "TESTNET / STAGING" | "PRODUCTION" {
  if (process.env.APP_ENVIRONMENT === "production" || process.env.VERCEL_ENV === "production") {
    return "PRODUCTION";
  }
  if (process.env.APP_ENVIRONMENT === "testnet" || process.env.VERCEL_ENV === "preview") {
    return "TESTNET / STAGING";
  }
  return "LOCAL";
}

export async function ownerDashboardMetrics(db: PrismaClient) {
  const [
    verifiedHumans,
    activeTrueSelves,
    activeAliases,
    activeIdentities,
    pendingIdentities,
    walletLinkedProfiles,
    firstContributionRows,
    funnel,
    signup1,
    signup7,
    signup30,
    signup90,
    latestRegistration,
  ] = await Promise.all([
    db.human.count(),
    db.profile.count({ where: { face: "TRUE_SELF", status: "active" } }),
    db.profile.count({ where: { face: "ALIAS", status: "active" } }),
    db.profile.count({ where: { status: "active" } }),
    db.profile.count({ where: { status: "pending" } }),
    db.testnetWalletLink.count(),
    db.post.groupBy({ by: ["authorProfileId"] }),
    Promise.all(
      OWNER_DASHBOARD_FUNNEL.map(async ([name, label]) => ({
        name,
        label,
        count: await analyticsCount(db, name),
      }))
    ),
    signupWindow(db, 1),
    signupWindow(db, 7),
    signupWindow(db, 30),
    signupWindow(db, 90),
    db.ledgerEvent.findFirst({
      where: { eventType: { in: ["trueself.registered", "alias.activated"] } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  return {
    generatedAt: new Date(),
    environment: deploymentLabel(),
    population: {
      verifiedHumans,
      activeTrueSelves,
      activeAliases,
      activeIdentities,
      pendingIdentities,
      walletLinkedProfiles,
      profilesWithFirstContribution: firstContributionRows.length,
    },
    signupWindows: [signup1, signup7, signup30, signup90],
    funnel,
    latestRegistration: latestRegistration?.createdAt ?? null,
  };
}
