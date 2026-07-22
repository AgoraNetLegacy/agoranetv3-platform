import Link from "next/link";
import { db } from "@/lib/db";
import { LearnMore } from "@/components/LearnMore";

export const dynamic = "force-dynamic";

// General Discussions (BEACON_FEED_SPEC §5.1, owner-directed
// 2026-07-21): this page carries the Agora-homed threads only —
// platform-itself topics and general conversation that belongs to no
// value pillar. Pillar conversations live in their pillars (each
// pillar page carries its own three lenses); the cross-pillar
// "recently active everywhere" stream moved home to the dashboard as
// The commons now. Chamber-scoped threads are homed in the meta pillar
// as an implementation detail and stay enclosed — never listed here.
export default async function GeneralDiscussions() {
  const agora = await db.pillar.findFirstOrThrow({ where: { isMeta: true } });

  const threads = await db.discussion.findMany({
    where: { pillarId: agora.id, circleId: null, chamberId: null },
    include: {
      posts: {
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: { select: { posts: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const ranked = threads
    .map((d) => ({ d, lastActivity: d.posts[0]?.createdAt ?? d.createdAt }))
    .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

  return (
    <>
      <h1>
        General Discussions
        <LearnMore label="About General Discussions">
          <h4>The conversation that belongs to no pillar</h4>
          <p>
            Platform-itself topics and general conversation live here,
            homed in The Agora. Value conversations live where their
            values live: every pillar page carries its own threads, plus
            your personal lenses — the ones you&rsquo;ve spoken in and
            the ones you&rsquo;ve saved.
          </p>
          <p>
            The platform-wide stream of everything recently active is on{" "}
            <Link href="/">the dashboard</Link> — The commons now, ranked
            by the same published formula for everyone.
          </p>
          <p>
            The permanence law is unchanged: posts lock after a grace
            window, and permanent threads hash-commit to the public
            ledger — silent edits are structurally impossible.
          </p>
        </LearnMore>
      </h1>
      <p>
        <em>Say it where it can&rsquo;t be quietly erased.</em>
      </p>

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
              {d._count.posts} post{d._count.posts === 1 ? "" : "s"} · last
              activity {lastActivity.toLocaleDateString()}
            </div>
          </li>
        ))}
        {ranked.length === 0 && (
          <li className="lore">
            No general threads yet. Pillar conversations live on their{" "}
            <Link href="/pillars">pillar pages</Link>; the platform-wide
            stream lives on <Link href="/">the dashboard</Link>.
          </li>
        )}
      </ul>
    </>
  );
}
