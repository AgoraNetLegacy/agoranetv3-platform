import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { LENS_INFO, type Lens } from "@/lib/canon";
import { closeDuePolls } from "@/lib/polls";
import { activeFace } from "@/lib/webSession";
import { checkParking, BlockedPanel } from "@/app/parkingGate";
import { PollForm } from "@/app/polls/PollForm";

export const dynamic = "force-dynamic";

// The labeled sort menu (DISCUSSIONS §6.2): every sort names exactly what
// it measures; there is no hidden formula and no blended default. The
// menu grows as its inputs arrive — unique tippers and sourced posts
// activate with Phase 4's economy.
const SORTS = {
  active: {
    label: "Recently active",
    measures: "latest movement in the conversation",
  },
  newest: {
    label: "Newest",
    measures: "chronology, just raw",
  },
  participants: {
    label: "Most participants",
    measures: "breadth of engagement — distinct souls who posted",
  },
  tippers: {
    label: "Most unique tippers",
    measures: "breadth of real appreciation — ten 1-Gratium tippers outrank one 50-Gratium whale",
  },
  sourced: {
    label: "Most sourced",
    measures: "evidence density — sources are visible, so inspectable",
  },
} as const;

type SortKey = keyof typeof SORTS;

export default async function PillarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { slug } = await params;
  const sortParam = (await searchParams).sort;
  const sort: SortKey = sortParam && sortParam in SORTS ? (sortParam as SortKey) : "active";

  const pillar = await db.pillar.findUnique({
    where: { slug },
    include: {
      discussions: {
        // Members' rooms are Circle-scoped and never surface on pillar
        // pages — the pillar surfaces the Circle itself, below.
        where: { circleId: null },
        include: {
          question: true,
          posts: {
            select: {
              authorHandle: true,
              createdAt: true,
              tips: { select: { tipperProfileId: true } },
              sources: { select: { id: true } },
            },
          },
        },
      },
    },
  });
  if (!pillar) notFound();

  const parking = await checkParking(pillar.id);
  if (parking.state === "blocked") {
    return (
      <BlockedPanel
        pillarName={pillar.name}
        pillarId={pillar.id}
        pillarSlug={pillar.slug}
        heldByHandle={parking.heldByHandle}
        heldByFace={parking.heldByFace}
      />
    );
  }

  await closeDuePolls(db);
  const [polls, viewer, circles] = await Promise.all([
    db.poll.findMany({
      // Circle-restricted polls belong to their members' rooms.
      where: { pillarId: pillar.id, isGovernance: false, visibilityScope: "public" },
      orderBy: { createdAt: "desc" },
    }),
    activeFace(),
    db.circle.findMany({
      where: { pillarId: pillar.id },
      include: { members: { where: { leftAt: null }, select: { profileId: true } } },
    }),
  ]);

  // Circles surfaced by recency of ATTESTED action — active hands rank
  // above old claims (CIRCLES §6.3); the stat counts the viewer's own
  // memberships in this pillar (§4).
  const { lastAttestedAt } = await import("@/lib/circles");
  const attestedRecency = await lastAttestedAt(db, circles.map((c) => c.id));
  const rankedCircles = [...circles].sort(
    (a, b) =>
      (attestedRecency.get(b.id)?.getTime() ?? b.createdAt.getTime()) -
      (attestedRecency.get(a.id)?.getTime() ?? a.createdAt.getTime())
  );
  const viewerCircleCount = viewer
    ? circles.filter((c) => c.members.some((m) => m.profileId === viewer.id)).length
    : 0;

  const rows = pillar.discussions.map((d) => {
    const lastPost = d.posts.reduce<Date | null>(
      (latest, p) => (!latest || p.createdAt > latest ? p.createdAt : latest),
      null
    );
    return {
      discussion: d,
      lastActivity: lastPost ?? d.createdAt,
      participants: new Set(d.posts.map((p) => p.authorHandle)).size,
      uniqueTippers: new Set(d.posts.flatMap((p) => p.tips.map((t) => t.tipperProfileId))).size,
      sourcedPosts: d.posts.filter((p) => p.sources.length > 0).length,
      posts: d.posts.length,
      canonPosition: d.question?.position ?? null,
      lens: d.question?.lens as Lens | undefined,
    };
  });

  rows.sort((a, b) => {
    if (sort === "newest") return b.discussion.createdAt.getTime() - a.discussion.createdAt.getTime();
    if (sort === "participants") return b.participants - a.participants;
    if (sort === "tippers") return b.uniqueTippers - a.uniqueTippers;
    if (sort === "sourced") return b.sourcedPosts - a.sourcedPosts;
    return b.lastActivity.getTime() - a.lastActivity.getTime();
  });

  return (
    <>
      <p>
        <Link href="/">← All pillars</Link>
      </p>
      <h1>
        {pillar.icon} {pillar.name}
      </h1>
      <p className="lore">
        {pillar.classicalName} — {pillar.loreName}
      </p>

      <div className="sort-menu">
        {(Object.keys(SORTS) as SortKey[]).map((key) => (
          <Link
            key={key}
            href={`/pillars/${pillar.slug}?sort=${key}`}
            className={key === sort ? "active" : ""}
          >
            {SORTS[key].label}
          </Link>
        ))}
        <div className="sort-note">
          Sorted by: {SORTS[sort].label} — {SORTS[sort].measures}. No hidden
          formula, ever.
        </div>
      </div>

      <ul className="discussions">
        {rows.map(({ discussion, participants, posts, canonPosition, lens }) => (
          <li key={discussion.id}>
            <Link href={`/d/${discussion.id}`}>{discussion.title}</Link>{" "}
            {discussion.permanence.startsWith("permanent") ? (
              <span className="badge permanent">Permanent record</span>
            ) : (
              <span className="badge locked">Author-deletable</span>
            )}
            <div className="meta">
              {canonPosition !== null && lens
                ? `Canonical question ${canonPosition} · ${lens} (${LENS_INFO[lens].label}) · `
                : ""}
              {posts} post{posts === 1 ? "" : "s"} · {participants} participant
              {participants === 1 ? "" : "s"}
            </div>
          </li>
        ))}
      </ul>

      <h3>⭕ Circles working in {pillar.name}</h3>
      <p className="lore">
        Deliberation becomes provable action — ordered by most recent
        attested action, so active hands rank above old claims.
        {viewer ? ` You belong to ${viewerCircleCount} Circle${viewerCircleCount === 1 ? "" : "s"} here.` : ""}{" "}
        <Link href="/circles">Browse all Circles →</Link>
      </p>
      <ul className="discussions">
        {rankedCircles.map((c) => (
          <li key={c.id}>
            <Link href={`/circles/${c.id}`}>{c.name}</Link>{" "}
            {c.status === "closed" && <span className="badge locked">Closed</span>}
            <div className="meta">
              {c.members.length} member{c.members.length === 1 ? "" : "s"}
              {attestedRecency.get(c.id)
                ? ` · last attested action ${attestedRecency.get(c.id)!.toLocaleDateString()}`
                : " · no attested actions yet"}
              {c.placeTag ? ` · ${c.placeTag}` : ""}
            </div>
          </li>
        ))}
        {rankedCircles.length === 0 && (
          <li className="lore">No Circles tagged to this pillar yet.</li>
        )}
      </ul>

      <h3>
        🏛 <Link href={`/pillars/${pillar.slug}/governance`}>Governance room</Link>
      </h3>
      <p className="lore">
        The permanent room: this pillar's governance polls and records.
      </p>

      <h3>Polls</h3>
      <ul className="discussions">
        {polls.map((p) => (
          <li key={p.id}>
            <Link href={`/polls/${p.id}`}>{p.title}</Link>{" "}
            {p.status === "open" ? (
              <span className="badge permanent">
                {p.liveTally ? "Live tally" : "Sealed until close"}
              </span>
            ) : (
              <span className="badge locked">Closed</span>
            )}
            <div className="meta">
              {p.mode === "public" ? "Public vote" : "Pseudonymous vote"}
            </div>
          </li>
        ))}
        {polls.length === 0 && <li className="lore">No ordinary polls yet.</li>}
      </ul>
      {viewer && (
        <details>
          <summary>Open an ordinary poll in {pillar.name}</summary>
          <PollForm
            pillarId={pillar.id}
            isGovernance={false}
            backTo={`/pillars/${pillar.slug}`}
          />
        </details>
      )}
    </>
  );
}
