import Link from "next/link";
import { db } from "@/lib/db";
import { moderationStats } from "@/lib/transparency";

export const dynamic = "force-dynamic";

// Public moderation statistics (BUILD_ORDER Phase 7). Aggregates only:
// nothing on this page can identify a moderator, a reporter, or an
// accused — the triangle of blindness extends to the stats page.
function StatTable({ title, data }: { title: string; data: Record<string, number> }) {
  const rows = Object.entries(data);
  return (
    <>
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="lore">None yet.</p>
      ) : (
        <table className="books">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export default async function ModerationStatsPage() {
  const stats = await moderationStats(db);
  return (
    <>
      <p>
        <Link href="/transparency">← The transparency dashboard</Link>
      </p>
      <h1>Moderation, in public numbers</h1>
      <p className="lore">
        The judicial branch&rsquo;s throughput — aggregates only. Moderator
        identities are protected by ratified law (anti-lobbying,
        anti-retaliation); individual cases publish their outcomes as
        tombstones citing real rules, never their participants.
      </p>

      <div className="stat-row">
        <div className="stat">
          <div className="stat-number">{stats.badgeTermsServed}</div>
          <div className="stat-label">badge terms served</div>
        </div>
        <div className="stat">
          <div className="stat-number">{stats.appeals}</div>
          <div className="stat-label">appeals heard</div>
        </div>
        <div className="stat">
          <div className="stat-number">
            {stats.avgHoursToResolve === null ? "—" : stats.avgHoursToResolve.toFixed(1)}
          </div>
          <div className="stat-label">avg hours to ruling (target: the 48h SLA rail)</div>
        </div>
      </div>

      <StatTable title="Cases by status" data={stats.casesByStatus} />
      <StatTable title="Rulings by outcome" data={stats.casesByOutcome} />
      <StatTable title="Cases by severity tier" data={stats.casesByTier} />
      <StatTable title="Flags by status" data={stats.flagsByStatus} />

      <p className="lore">
        Tribunal seats currently filled: {stats.tribunalSeatsFilled}. Reward
        outflows to moderators appear on the{" "}
        <Link href="/transparency">treasury dashboard</Link> as aggregates —
        totals and counts, never recipients.
      </p>
    </>
  );
}
