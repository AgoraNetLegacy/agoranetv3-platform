import Link from "next/link";
import { db } from "@/lib/db";
import { LENS_INFO, type Lens } from "@/lib/canon";
import { activeFace } from "@/lib/webSession";
import { PollForm } from "@/app/polls/PollForm";
import { MECHANISM_DOCS } from "@/lib/mechanismDocs.generated";
import { repairStatus } from "@/lib/domains";
import { pillarStanding } from "@/lib/lightScore";

// The pillar dashboard's body (DASHBOARD §5: stat row → domain cards →
// canon threads → Circles → Governance door → mechanism deep-dive),
// extracted in Phase 8.5 so it mounts in TWO places that are ONE thing
// (PRESENTATION_SPEC §1.1): the platform dashboard at / (the Agora's
// anatomy) and /pillars/[slug] for the six diagnostic pillars. The
// mounting page owns parking and the Why banner; this component owns
// everything below them.

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

export type SortKey = keyof typeof SORTS;

export function asSortKey(raw: string | undefined): SortKey {
  return raw && raw in SORTS ? (raw as SortKey) : "active";
}

export async function PillarAnatomy({
  slug,
  sort,
  sortBasePath,
}: {
  slug: string;
  sort: SortKey;
  /** Where the sort-menu links point — "/" when mounted on the platform
   *  dashboard, the pillar's own path everywhere else. */
  sortBasePath: string;
}) {
  const pillar = await db.pillar.findUnique({
    where: { slug },
    include: {
      domains: { orderBy: { position: "asc" } },
      discussions: {
        // Members' rooms are Circle-scoped and never surface on pillar
        // pages; domain threads get their own cards below.
        where: { circleId: null, chamberId: null, domainId: null },
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
  if (!pillar) return null;

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
    select: {
      id: true,
      domainId: true,
      posts: { select: { authorProfileId: true, authorHandle: true } },
    },
  });
  const liveThreads = pillar.discussions.length + domainThreads.length;
  const participatedThreads = viewer
    ? pillar.discussions.filter((d) => d.posts.some((p) => p.authorProfileId === viewer.id))
        .length +
      domainThreads.filter((d) => d.posts.some((p) => p.authorProfileId === viewer.id)).length
    : 0;
  const standing = viewer ? await pillarStanding(db, viewer.id, pillar.id) : null;

  // §1.4: each domain card carries a visible Discussion door with its
  // voice count — the conversation stops hiding behind "live thread".
  const threadByDomain = new Map(
    domainThreads.map((d) => [
      d.domainId,
      { id: d.id, voices: new Set(d.posts.map((p) => p.authorHandle)).size },
    ])
  );

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
  const sortJoin = sortBasePath.includes("?") ? "&" : "?";

  return (
    <>
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
              </div>
              {threadByDomain.get(d.id) && (
                <div className="discussion-door">
                  <Link href={`/d/${threadByDomain.get(d.id)!.id}`}>
                    Join the Discussion — {threadByDomain.get(d.id)!.voices} voice
                    {threadByDomain.get(d.id)!.voices === 1 ? "" : "s"}
                  </Link>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <h3>The canonical questions</h3>
      <div className="sort-menu">
        {(Object.keys(SORTS) as SortKey[]).map((key) => (
          <Link
            key={key}
            href={`${sortBasePath}${sortJoin}sort=${key}`}
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
            backTo={sortBasePath}
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
    </>
  );
}
