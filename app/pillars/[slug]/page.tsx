import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { LENS_INFO, type Lens } from "@/lib/canon";
import { closeDuePolls } from "@/lib/polls";
import { activeFace } from "@/lib/webSession";
import { checkParking, BlockedPanel } from "@/app/parkingGate";
import { PollForm } from "@/app/polls/PollForm";
import { editorialFor } from "@/lib/pillarContent";
import { MECHANISM_DOCS } from "@/lib/mechanismDocs.generated";
import { repairStatus } from "@/lib/domains";
import { pillarStanding } from "@/lib/lightScore";

export const dynamic = "force-dynamic";

// The labeled sort menu (DISCUSSIONS §6.2): every sort names exactly what
// it measures; there is no hidden formula and no blended default.
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

// The full pillar dashboard (DASHBOARD §5): Why banner with the pillar's
// full identity → stat row → domain cards → canon threads → Circles →
// Governance door → mechanism deep-dive (deliberately secondary).
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
      domains: { orderBy: { position: "asc" } },
      discussions: {
        // Members' rooms are Circle-scoped and never surface on pillar
        // pages; domain threads get their own cards below.
        where: { circleId: null, domainId: null },
        include: {
          question: true,
          posts: {
            select: {
              authorHandle: true,
              authorProfileId: true,
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
  const editorial = editorialFor(pillar.slug);
  const [polls, viewer, circles, domainStatus] = await Promise.all([
    db.poll.findMany({
      where: { pillarId: pillar.id, isGovernance: false, visibilityScope: "public" },
      orderBy: { createdAt: "desc" },
    }),
    activeFace(),
    db.circle.findMany({
      where: { pillarId: pillar.id },
      include: { members: { where: { leftAt: null }, select: { profileId: true } } },
    }),
    repairStatus(db, (await db.domain.findMany({ where: { pillarId: pillar.id }, select: { id: true } })).map((d) => d.id)),
  ]);

  // The stat row (§5.2) — this pillar only, this face only; never a
  // cross-pillar or global number.
  const viewerCircleCount = viewer
    ? circles.filter((c) => c.members.some((m) => m.profileId === viewer.id)).length
    : 0;
  const domainThreads = await db.discussion.findMany({
    where: { pillarId: pillar.id, domainId: { not: null } },
    select: { id: true, domainId: true, posts: { select: { authorProfileId: true } } },
  });
  const liveThreads = pillar.discussions.length + domainThreads.length;
  const participatedThreads = viewer
    ? pillar.discussions.filter((d) => d.posts.some((p) => p.authorProfileId === viewer.id))
        .length +
      domainThreads.filter((d) => d.posts.some((p) => p.authorProfileId === viewer.id)).length
    : 0;
  const standing = viewer ? await pillarStanding(db, viewer.id, pillar.id) : null;

  const threadByDomain = new Map(domainThreads.map((d) => [d.domainId, d.id]));

  // Circles surfaced by recency of ATTESTED action (CIRCLES §6.3).
  const { lastAttestedAt } = await import("@/lib/circles");
  const attestedRecency = await lastAttestedAt(db, circles.map((c) => c.id));
  const rankedCircles = [...circles].sort(
    (a, b) =>
      (attestedRecency.get(b.id)?.getTime() ?? b.createdAt.getTime()) -
      (attestedRecency.get(a.id)?.getTime() ?? a.createdAt.getTime())
  );

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

  const mechanismDocs = MECHANISM_DOCS.filter((m) => m.pillarSlug === pillar.slug);

  return (
    <>
      <p>
        <Link href="/">← The hub</Link>
      </p>

      {/* The Why banner (§5.1): emotional context + the pillar's full
          identity, shown once a soul has actually entered. */}
      <div
        className="why-banner"
        style={{ borderLeft: `5px solid ${pillar.colorPrimary}`, background: pillar.colorLight }}
      >
        <h1 style={{ marginBottom: "0.1rem" }}>
          {pillar.icon} {pillar.name}
        </h1>
        <p className="lore" style={{ marginTop: 0 }}>
          {pillar.classicalName} — {pillar.loreName}
        </p>
        <p className="why-text">{editorial.whyBanner}</p>
        <p className="lore">
          Flagship Stoic principle: <em>{editorial.stoicPrinciple}</em>
        </p>
      </div>

      {/* The stat row (§5.2) — this pillar, this face, nothing global. */}
      <div className="stat-row">
        <div className="stat">
          <div className="stat-number">
            {viewer ? `${participatedThreads} / ${liveThreads}` : liveThreads}
          </div>
          <div className="stat-label">
            {viewer ? "Discussions you're in / live here" : "live Discussions"}
          </div>
        </div>
        <div className="stat">
          <div className="stat-number">{viewer ? viewerCircleCount : circles.length}</div>
          <div className="stat-label">
            {viewer ? `your Circles in ${pillar.name}` : "Circles working here"}
          </div>
        </div>
        <div className="stat">
          <div className="stat-number">{standing ? standing.points : "—"}</div>
          <div className="stat-label">
            your standing{" "}
            {viewer ? (
              <Link href="/profile">(why?)</Link>
            ) : (
              <span>(sign in)</span>
            )}
          </div>
        </div>
      </div>
      <p className="lore">
        Standing is per-face, per-pillar — insight over volume, positions
        never scored. No universal score exists, by design.
      </p>

      {/* Domain cards (§5.3): the second ring. Live repair status — real
          data, never decorative. */}
      <h3>The {pillar.domains.length} domains</h3>
      <ul className="domain-grid">
        {pillar.domains.map((d) => {
          const status = domainStatus.get(d.id);
          return (
            <li key={d.id}>
              <Link href={`/pillars/${pillar.slug}/domains/${d.position}`}>
                <strong>
                  {d.position}. {d.title}
                </strong>
              </Link>
              <div className="hook">{d.openingQuestion}</div>
              <div className="lore">
                {status?.openRepairs
                  ? `${status.openRepairs} open repair${status.openRepairs === 1 ? "" : "s"}`
                  : "no open repairs"}
                {status?.lastRepairedAt
                  ? ` · last repaired ${status.lastRepairedAt.toLocaleDateString()}`
                  : " · never repaired"}
                {threadByDomain.get(d.id) ? " · live thread" : ""}
              </div>
            </li>
          );
        })}
      </ul>

      <h3>The canonical questions</h3>
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

      {/* The Governance door (§5.5): a visibly marked threshold. */}
      <div className="door-banner">
        <h3 style={{ marginTop: 0 }}>
          🏛 <Link href={`/pillars/${pillar.slug}/governance`}>The Governance room</Link>
        </h3>
        <p style={{ marginBottom: 0 }}>
          Beyond this door, everything written is permanent public record,
          and governance votes carry the PollCoin micro-fee. Permanence is
          a place you knowingly walk into — this is the threshold.
        </p>
      </div>

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

      {/* Mechanism deep-dive (§5.4): deliberately secondary, opt-in. */}
      {mechanismDocs.length > 0 && (
        <details className="deep-dive">
          <summary>
            Mechanism deep-dive — the reference documents behind this pillar
          </summary>
          <p className="lore">
            Dense reference material, not everyday reading: the biology and
            psychology this pillar's diagnosis stands on.
          </p>
          <ul>
            {mechanismDocs.map((m) => (
              <li key={m.slug}>
                <Link href={`/pillars/${pillar.slug}/reference/${m.slug}`}>{m.title}</Link>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="lore" style={{ marginTop: "1.5rem" }}>
        Read the Pictures. Challenge one with a repair. Join a domain's
        Discussion, or find a Circle already working the problem — this
        pillar is a place to act, not just to read.
      </p>
    </>
  );
}
