import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Discussions, findable by name (PRESENTATION_SPEC §1.3: this page
// exists because the owner couldn't find "discussions" by name — it is
// a direct alias into the pillar discussion sections, not a new
// surface). Nothing here bypasses pillar parking: every link walks
// through the same doors as always.
export default async function DiscussionsIndex() {
  const pillars = await db.pillar.findMany({
    orderBy: { position: "asc" },
    include: {
      _count: {
        select: { discussions: { where: { circleId: null, chamberId: null } } },
      },
    },
  });

  // Recently active across all PUBLIC pillar spaces (members' rooms and
  // workshops are enclosed and never surface here — same rule as
  // pillar dashboards).
  const recent = await db.discussion.findMany({
    where: { circleId: null, chamberId: null },
    include: {
      pillar: { select: { name: true, icon: true, slug: true } },
      posts: { select: { createdAt: true, authorHandle: true }, orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { posts: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const ranked = recent
    .map((d) => ({
      d,
      lastActivity: d.posts[0]?.createdAt ?? d.createdAt,
    }))
    .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
    .slice(0, 15);

  return (
    <>
      <h1>Discussions</h1>
      <p>
        <em>Say it where it can&rsquo;t be quietly erased.</em> Every
        pillar carries permanent, threaded conversations: seven canonical
        questions each, one living thread per domain, and the ones souls
        open themselves. Posts lock after a grace window and permanent
        threads hash-commit to the public ledger — silent edits are
        structurally impossible.
      </p>

      <h3>By pillar</h3>
      <ul className="pillar-grid">
        {pillars.map((p) => (
          <li key={p.id} style={{ borderTop: `4px solid ${p.colorPrimary}` }}>
            <Link href={p.isMeta ? "/" : `/pillars/${p.slug}`}>
              {p.icon} <strong>{p.name}</strong>
            </Link>
            <div className="lore">
              {p._count.discussions} Discussion{p._count.discussions === 1 ? "" : "s"}
              {p.isMeta ? " · on the platform dashboard" : ""}
            </div>
          </li>
        ))}
      </ul>

      <h3>Recently active everywhere</h3>
      <ul className="discussions">
        {ranked.map(({ d, lastActivity }) => (
          <li key={d.id}>
            <Link href={`/d/${d.id}`}>{d.title}</Link>{" "}
            {d.permanence.startsWith("permanent") ? (
              <span className="badge permanent">Permanent record</span>
            ) : (
              <span className="badge locked">Author-deletable</span>
            )}
            <div className="meta">
              {d.pillar.icon} {d.pillar.name} · {d._count.posts} post
              {d._count.posts === 1 ? "" : "s"} · last activity{" "}
              {lastActivity.toLocaleString()}
            </div>
          </li>
        ))}
        {ranked.length === 0 && <li className="lore">No discussions yet.</li>}
      </ul>
    </>
  );
}
