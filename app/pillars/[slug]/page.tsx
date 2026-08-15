import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PillarMark } from "@/components/Icon";
import { activeFace } from "@/lib/webSession";
import { savedThreadsFor } from "@/lib/saved";
import { submitUnsaveDiscussion } from "@/app/actions";
import { closeDuePolls } from "@/lib/polls";
import { checkParking, BlockedPanel } from "@/app/parkingGate";
import { editorialFor } from "@/lib/pillarContent";
import { PillarAnatomy, asSortKey } from "../PillarAnatomy";

export const dynamic = "force-dynamic";

// The full pillar dashboard (DASHBOARD §5): Why banner with the pillar's
// full identity → the shared anatomy (stat row, domain cards, canon
// threads, Circles, the Governance door, mechanism deep-dive). The
// Agora's dashboard IS the platform dashboard (PRESENTATION_SPEC §1.1,
// owner-corrected: one thing, not two); its slug redirects home.
type Lens = "here" | "mine" | "saved";
function asLens(value: string | undefined): Lens {
  return value === "mine" || value === "saved" ? value : "here";
}

async function DiscussionLenses({
  pillarId,
  slug,
  lens,
}: {
  pillarId: string;
  slug: string;
  lens: Lens;
}) {
  const face = await activeFace();

  // Enclosed rooms (Circle members' rooms, chamber workshops) never
  // surface in any lens; including "mine" echoes (BEACON §5.2).
  const publicHere = { pillarId, circleId: null, chamberId: null } as const;

  let threads: {
    id: string;
    title: string;
    permanence: string;
    posts: { createdAt: Date }[];
    _count: { posts: number };
    savedAt?: Date;
  }[] = [];

  if (lens === "here") {
    threads = await db.discussion.findMany({
      where: publicHere,
      include: {
        posts: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { posts: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    });
  } else if (lens === "mine" && face) {
    threads = await db.discussion.findMany({
      where: { ...publicHere, posts: { some: { authorProfileId: face.id } } },
      include: {
        posts: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { posts: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  } else if (lens === "saved" && face) {
    const saves = await savedThreadsFor(db, face.id, { pillarId });
    threads = saves
      .filter((s) => !s.discussion.circleId && !s.discussion.chamberId)
      .map((s) => ({
        id: s.discussion.id,
        title: s.discussion.title,
        permanence: s.discussion.permanence,
        posts: s.discussion.posts,
        _count: s.discussion._count,
        savedAt: s.savedAt,
      }));
  }

  const tab = (key: Lens, label: string) =>
    lens === key ? (
      <strong key={key}>{label}</strong>
    ) : (
      <Link key={key} href={`/pillars/${slug}${key === "here" ? "" : `?lens=${key}`}`}>
        {label}
      </Link>
    );

  return (
    <>
      <h2 style={{ marginTop: "2rem" }}>Discussions here</h2>
      <p className="lens-tabs">
        {tab("here", "All in this pillar")} · {tab("mine", "My Discussions")} ·{" "}
        {tab("saved", "Saved")}
      </p>
      {(lens === "mine" || lens === "saved") && !face ? (
        <p className="lore">
          This lens is per-face. <Link href="/login">Sign in</Link> to see{" "}
          {lens === "mine" ? "the threads you've spoken in" : "your saved threads"};
          your other face has its own.
        </p>
      ) : (
        <ul className="discussions">
          {threads.map((d) => (
            <li key={d.id}>
              <Link href={`/d/${d.id}`}>{d.title}</Link>{" "}
              {d.permanence.startsWith("permanent") ? (
                <span className="badge permanent">Permanent record</span>
              ) : (
                <span className="badge locked">Author-deletable</span>
              )}
              <div className="meta">
                {d._count.posts} post{d._count.posts === 1 ? "" : "s"}
                {d.posts[0]
                  ? ` · last activity ${d.posts[0].createdAt.toLocaleDateString()}`
                  : ""}
                {d.savedAt ? ` · saved ${d.savedAt.toLocaleDateString()}` : ""}
              </div>
              {lens === "saved" && face && (
                <form action={submitUnsaveDiscussion} className="inline">
                  <input type="hidden" name="discussionId" value={d.id} />
                  <input
                    type="hidden"
                    name="returnTo"
                    value={`/pillars/${slug}?lens=saved`}
                  />
                  <button type="submit" className="linklike">
                    unsave
                  </button>
                </form>
              )}
            </li>
          ))}
          {threads.length === 0 && (
            <li className="lore">
              {lens === "here" && "No public threads live here yet."}
              {lens === "mine" &&
                "This face hasn't spoken in this pillar yet; every thread you post in gathers here."}
              {lens === "saved" &&
                "Nothing saved in this pillar yet; the ☆ on any thread keeps it here, visible to this face alone."}
            </li>
          )}
        </ul>
      )}
    </>
  );
}

export default async function PillarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; lens?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const sort = asSortKey(sp.sort);
  const lens = asLens(sp.lens);

  const pillar = await db.pillar.findUnique({ where: { slug } });
  if (!pillar) notFound();
  if (pillar.isMeta) redirect("/");

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

  return (
    <>
      <p>
        <Link href="/pillars">← The Seven Pillars</Link>
      </p>

      {/* The Why banner (§5.1): emotional context + the pillar's full
          identity, shown once a soul has actually entered. */}
      <div
        className="why-banner"
        style={
          {
            borderLeft: `5px solid ${pillar.colorPrimary}`,
            // The tint rides a CSS variable so globals.css can compose
            // it into the frosted/sheen treatment instead of painting a
            // flat pastel.
            "--banner-tint": pillar.colorLight,
          } as React.CSSProperties
        }
      >
        <h1 style={{ marginBottom: "0.1rem" }}>
          <PillarMark slug={pillar.slug} /> {pillar.name}
        </h1>
        <p className="lore" style={{ marginTop: 0 }}>
          {pillar.classicalName}; {pillar.loreName}
        </p>
        <p className="why-text">{editorial.whyBanner}</p>
        <p className="lore">
          Flagship Stoic principle: <em>{editorial.stoicPrinciple}</em>
        </p>
      </div>

      <PillarAnatomy
        slug={pillar.slug}
        sort={sort}
        sortBasePath={`/pillars/${pillar.slug}`}
      />

      {/* The three lenses (BEACON_FEED_SPEC §5.2, owner-directed
          2026-07-21): one room, three views of its conversations;
          everything living here, the ones this face has spoken in, and
          the ones this face saved. Per-face by construction. */}
      <DiscussionLenses pillarId={pillar.id} slug={pillar.slug} lens={lens} />

      <p className="lore" style={{ marginTop: "1.5rem" }}>
        Read the Pictures. Challenge one with a repair. Join a domain's
        Discussion, or find a Circle already working the problem; this
        pillar is a place to act, not just to read.
      </p>
    </>
  );
}
