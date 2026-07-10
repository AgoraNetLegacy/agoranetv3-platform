import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { LENS_INFO, type Lens } from "@/lib/canon";

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
        include: {
          question: true,
          posts: { select: { authorPseudonym: true, createdAt: true } },
        },
      },
    },
  });
  if (!pillar) notFound();

  const rows = pillar.discussions.map((d) => {
    const lastPost = d.posts.reduce<Date | null>(
      (latest, p) => (!latest || p.createdAt > latest ? p.createdAt : latest),
      null
    );
    return {
      discussion: d,
      lastActivity: lastPost ?? d.createdAt,
      participants: new Set(d.posts.map((p) => p.authorPseudonym)).size,
      posts: d.posts.length,
      canonPosition: d.question?.position ?? null,
      lens: d.question?.lens as Lens | undefined,
    };
  });

  rows.sort((a, b) => {
    if (sort === "newest") return b.discussion.createdAt.getTime() - a.discussion.createdAt.getTime();
    if (sort === "participants") return b.participants - a.participants;
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
          formula; more sorts arrive with their inputs.
        </div>
      </div>

      <ul className="discussions">
        {rows.map(({ discussion, participants, posts, canonPosition, lens }) => (
          <li key={discussion.id}>
            <Link href={`/d/${discussion.id}`}>{discussion.title}</Link>{" "}
            <span className="badge permanent">Permanent record</span>
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
    </>
  );
}
