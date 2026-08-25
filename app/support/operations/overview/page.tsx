import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import { getOwnerDashboardOperator } from "@/lib/supportOperations";
import { ownerDashboardMetrics, type OwnerDashboardWindow } from "@/lib/ownerDashboard";

export const dynamic = "force-dynamic";

const WINDOW_LABELS: Record<OwnerDashboardWindow, string> = {
  1: "24 hours",
  7: "7 days",
  30: "30 days",
  90: "90 days",
};

function pct(value: number, base: number): string {
  return base === 0 ? "—" : `${Math.round((value / base) * 100)}%`;
}

export default async function OwnerOperationsOverview() {
  const face = await activeFace();
  if (!face) redirect("/login");
  const operator = await getOwnerDashboardOperator(db, face.id);
  if (!operator) notFound();
  const metrics = await ownerDashboardMetrics(db, operator.profile.id);

  return (
    <main className="support-ops owner-dashboard">
      <div className="support-ops-heading">
        <div>
          <p className="eyebrow">Restricted owner operations</p>
          <h1>Growth & onboarding</h1>
          <p className="lore">
            Signed in as @{operator.profile.handle} · {operator.role} · {metrics.environment}
          </p>
        </div>
        <Link href="/support/operations">Support queue →</Link>
      </div>

      <div className="notice">
        Aggregate operational data only. No credentials, wallet secrets, private
        messages, IP data, or True Self/Alias links are shown.
      </div>

      <p className="lore">
        Generated {metrics.generatedAt.toLocaleString()}. Active identities are
        profiles, not unique people; one verified human may have a True Self and
        an Alias.
      </p>

      <h2>Population now</h2>
      <div className="stat-row">
        <div className="stat"><div className="stat-number">{metrics.population.verifiedHumans}</div><div className="stat-label">verified humans</div></div>
        <div className="stat"><div className="stat-number">{metrics.population.activeIdentities}</div><div className="stat-label">active identities</div></div>
        <div className="stat"><div className="stat-number">{metrics.population.activeTrueSelves}</div><div className="stat-label">active True Selves</div></div>
        <div className="stat"><div className="stat-number">{metrics.population.activeAliases}</div><div className="stat-label">active Aliases</div></div>
      </div>
      <div className="stat-row">
        <div className="stat"><div className="stat-number">{metrics.population.pendingIdentities}</div><div className="stat-label">pending identities</div></div>
        <div className="stat"><div className="stat-number">{metrics.population.walletLinkedProfiles}</div><div className="stat-label">wallet-linked profiles</div></div>
        <div className="stat"><div className="stat-number">{metrics.population.profilesWithFirstContribution}</div><div className="stat-label">profiles with first contribution</div></div>
      </div>

      <h2>Recent signup activity</h2>
      <table className="support-ops-table">
        <thead><tr><th>Window</th><th>Verified events</th><th>True Self registrations</th><th>Alias events</th></tr></thead>
        <tbody>
          {metrics.signupWindows.map((row) => (
            <tr key={row.days}>
              <td>Last {WINDOW_LABELS[row.days as OwnerDashboardWindow]}</td>
              <td>{row.humans}</td><td>{row.trueSelves}</td><td>{row.aliases}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="lore">
        Signup activity is event-based, not a list of people. Latest recorded
        registration: {metrics.latestRegistration?.toLocaleString() ?? "none"}.
      </p>

      <h2>Onboarding conversion</h2>
      <table className="support-ops-table">
        <thead><tr><th>Stage</th><th>All-time events</th><th>From first stage</th><th>From prior stage</th></tr></thead>
        <tbody>
          {metrics.funnel.map((row, index) => {
            const previous = index === 0 ? row.count : metrics.funnel[index - 1].count;
            const first = metrics.funnel[0].count;
            return <tr key={row.name}><td>{row.label}</td><td>{row.count}</td><td>{pct(row.count, first)}</td><td>{index === 0 ? "—" : pct(row.count, previous)}</td></tr>;
          })}
        </tbody>
      </table>
      <p className="lore">
        These are aggregate event counts. They are not guaranteed unique-user
        counts and may include repeated attempts.
      </p>

      <h2>Moderation capacity</h2>
      <div className="notice">
        Stage {metrics.moderation.stage}: {metrics.moderation.soloFallbackActive
          ? "@" + operator.profile.handle + " is the active bootstrap moderator for routine cases."
          : "Community moderation is the active path; solo bootstrap handling is not active."}
      </div>
      <div className="stat-row">
        <div className="stat"><div className="stat-number">{metrics.moderation.soloQueueCases}</div><div className="stat-label">routine cases in your queue</div></div>
        <div className="stat"><div className="stat-number">{metrics.moderation.openCases}</div><div className="stat-label">open cases overall</div></div>
        <div className="stat"><div className="stat-number">{metrics.moderation.awaitingReviewCases}</div><div className="stat-label">awaiting review</div></div>
        <div className="stat"><div className="stat-number">{metrics.moderation.heavyOrSevereQueued}</div><div className="stat-label">heavy/severe cases queued</div></div>
      </div>
      <table className="support-ops-table">
        <thead><tr><th>Community pool</th><th>Eligible profiles</th><th>Minimum</th><th>Willing profiles</th><th>Active terms</th><th>Pending offers</th></tr></thead>
        <tbody><tr>
          <td>{metrics.moderation.communityOffersEnabled ? "community offers enabled" : "bootstrap fallback"}</td>
          <td>{metrics.moderation.eligibleProfiles}</td>
          <td>{metrics.moderation.minimumProfiles}</td>
          <td>{metrics.moderation.willingProfiles}</td>
          <td>{metrics.moderation.activeTerms}</td>
          <td>{metrics.moderation.pendingOffers}</td>
        </tr></tbody>
      </table>
      <p className="lore">
        You receive a private, time-sensitive inbox notification when a new
        routine case enters your S0 queue. Heavy, severe, and Tribunal cases
        remain outside solo handling and are not silently treated as yours.
        Resolved cases: {metrics.moderation.resolvedCases}. Tribunal queue: {metrics.moderation.tribunalCases}.
      </p>
      <Link href="/moderation">Open moderation workbench →</Link>
    </main>
  );
}
