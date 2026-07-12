import Link from "next/link";
import { db } from "@/lib/db";
import { FUNNEL_EVENTS } from "@/lib/analytics";

export const dynamic = "force-dynamic";

// State of the Commons (ANALYTICS_SPEC §4, owner-ratified): radical
// transparency applied to growth itself. Aggregate-only, public, no
// account — growth is public whether it's fast or slow, the same
// honesty the treasury page applies to money. Placement: its own page,
// linked from the transparency dashboard (flagged as cosmetic in
// DECISIONS_PENDING).

const FUNNEL_LABELS: Record<string, string> = {
  "funnel.arrival": "Saw the gate",
  "funnel.gate": "Began verification",
  "funnel.verified": "Verified a credential",
  "funnel.trueself": "Registered a True Self",
  "funnel.consents": "Acknowledged the founding consents",
  "funnel.seed": "Answered values-seed questions",
  "funnel.oriented": "Completed orientation",
  "funnel.alias": "Hatched an Alias",
};

export default async function CommonsPage() {
  const [
    souls,
    humans,
    discussions,
    posts,
    ballots,
    actionsLogged,
    actionsAttested,
    circles,
    chambers,
    pollsCount,
  ] = await Promise.all([
    db.profile.count({ where: { status: "active" } }),
    db.human.count(),
    db.discussion.count(),
    db.post.count(),
    db.ballot.count(),
    db.actionEntry.count(),
    db.actionEntry.count({ where: { attestedAt: { not: null } } }),
    db.circle.count(),
    db.chamber.count(),
    db.poll.count(),
  ]);

  // The live funnel: raw-window counts + everything already crushed.
  const funnel = await Promise.all(
    FUNNEL_EVENTS.map(async (name) => {
      const [raw, crushed] = await Promise.all([
        db.analyticsEvent.count({ where: { name } }),
        db.analyticsAggregate.aggregate({
          where: { name },
          _sum: { count: true },
        }),
      ]);
      return { name, total: raw + (crushed._sum.count ?? 0) };
    })
  );

  return (
    <>
      <h1>🌱 State of the Commons</h1>
      <p>
        Is the platform working? The honest numbers, public whether they
        flatter or not — the same transparency the{" "}
        <Link href="/transparency">treasury page</Link> applies to money,
        applied to growth. Everything here is an aggregate: the platform
        measures its <em>product</em>, never its <em>people</em>.
      </p>

      <h3>The commons today</h3>
      <div className="stat-row">
        <div className="stat">
          <div className="stat-number">{souls}</div>
          <div className="stat-label">Active souls (faces)</div>
        </div>
        <div className="stat">
          <div className="stat-number">{humans}</div>
          <div className="stat-label">Verified humans</div>
        </div>
        <div className="stat">
          <div className="stat-number">{discussions}</div>
          <div className="stat-label">Discussions</div>
        </div>
        <div className="stat">
          <div className="stat-number">{posts}</div>
          <div className="stat-label">Contributions</div>
        </div>
      </div>
      <div className="stat-row">
        <div className="stat">
          <div className="stat-number">{ballots}</div>
          <div className="stat-label">Ballots cast</div>
        </div>
        <div className="stat">
          <div className="stat-number">{pollsCount}</div>
          <div className="stat-label">Polls opened</div>
        </div>
        <div className="stat">
          <div className="stat-number">
            {actionsAttested}/{actionsLogged}
          </div>
          <div className="stat-label">Circle actions attested/logged</div>
        </div>
        <div className="stat">
          <div className="stat-number">
            {circles}+{chambers}
          </div>
          <div className="stat-label">Circles + Chambers working</div>
        </div>
      </div>

      <h3>The doorway — onboarding funnel</h3>
      <table className="books">
        <thead>
          <tr>
            <th>Stage</th>
            <th>Count (all time)</th>
          </tr>
        </thead>
        <tbody>
          {funnel.map((f) => (
            <tr key={f.name}>
              <td>{FUNNEL_LABELS[f.name]}</td>
              <td>{f.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="lore">
        Counts, not people: an event here is a name and a moment — no
        profiles, no trails, nothing to join. Raw events are crushed into
        these aggregates and deleted on a 90-day cycle (
        <em>shortening</em> that window is always allowed; lengthening it
        is structurally capped). Analytics never feeds ranking — the feed
        formula is <Link href="/feed/formula">published</Link> and this
        pipeline is forbidden to touch it.
      </p>
    </>
  );
}
