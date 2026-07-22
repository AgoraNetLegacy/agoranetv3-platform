import Link from "next/link";
import { db } from "@/lib/db";
import { buildFeed, openLens, chamberStorefrontCards } from "@/lib/feed";
import { stirringSavesFor } from "@/lib/saved";
import { getRail } from "@/lib/rails";
import { markCaughtUp } from "@/app/actions";
import { Icon } from "@/components/Icon";

// Shared feed rendering (FEED_AND_SEARCH_SPEC), mounted in two places
// since Phase 8.5: the full /feed page and the platform dashboard —
// §1.1 of the Presentation spec puts the feed ON the Agora dashboard.
// One rendering, one set of rules: chosen sources + one open lens,
// every card says why it's there, the feed ends.

export async function ChosenSourcesFeed({
  profileId,
  compactDoor,
}: {
  profileId: string;
  compactDoor?: boolean;
}) {
  const { cards, since } = await buildFeed(db, profileId);
  return (
    <>
      {cards.length === 0 ? (
        <div className="caught-up">
          <p>
            <strong>You&rsquo;re caught up.</strong>
            {since
              ? ` Nothing new from your sources since ${since.toLocaleString()}.`
              : " Your sources have no activity yet."}
          </p>
          <p className="lore">
            That&rsquo;s the design, not a failure: the feed ends.{" "}
            <Link href="/feed/sources">Choose what feeds it</Link>, browse
            the <Link href="/pillars">pillars</Link>, or see what the open
            lens is carrying.
          </p>
        </div>
      ) : (
        <>
          <ul className="discussions">
            {cards.map((c) => (
              <li key={c.discussionId}>
                <Link
                  href={c.kind === "poll" ? `/polls/${c.discussionId}` : `/d/${c.discussionId}`}
                >
                  {c.title}
                </Link>{" "}
                {c.kind === "poll" ? (
                  <span className="badge permanent">Poll</span>
                ) : c.permanence.startsWith("permanent") ? (
                  <span className="badge permanent">Permanent record</span>
                ) : (
                  <span className="badge locked">Author-deletable</span>
                )}
                <div className="meta">
                  {c.pillarIcon} {c.pillarName}
                  {c.kind === "discussion"
                    ? ` · ${c.newPosts} new post${c.newPosts === 1 ? "" : "s"} · ${c.participants} participant${c.participants === 1 ? "" : "s"}`
                    : ""}{" "}
                  · {c.lastActivityAt.toLocaleString()}
                </div>
                <div className="why-line">{c.whyLine}</div>
              </li>
            ))}
          </ul>
          <div className="caught-up">
            <p>
              <strong>You&rsquo;re caught up</strong> — that was everything
              from your chosen sources
              {since ? ` since ${since.toLocaleString()}` : ""}.
            </p>
            <form action={markCaughtUp}>
              <button type="submit">Mark read — next visit starts from now</button>
            </form>
            {compactDoor && (
              <p className="lore">
                <Link href="/feed/sources">Choose what feeds this</Link> ·{" "}
                <Link href="/feed">the full feed page</Link>
              </p>
            )}
          </div>
        </>
      )}
    </>
  );
}

// Chamber storefront cards (FEED §2.3 — arriving with their Phase 7.5
// host): discovery of new/active PUBLIC chambers. The ordering rule is
// legible and stated; only the public storefront rides the card.
export async function PollinatorStrip() {
  const storefronts = await chamberStorefrontCards(db);
  if (storefronts.length === 0) return null;
  return (
    <>
      <h3>New in the Pollinator</h3>
      <ul className="discussions">
        {storefronts.map((c) => (
          <li key={c.chamberId}>
            <Link href={`/pollinator/${c.chamberId}`}><Icon name="hive" /> {c.title}</Link>{" "}
            <span className="badge permanent">Public chamber</span>
            <div className="meta">
              {c.subject.length > 100 ? `${c.subject.slice(0, 100)}…` : c.subject} · by @
              {c.creatorHandle} · {c.members} soul{c.members === 1 ? "" : "s"} inside
            </div>
            <div className="why-line">{c.whyLine}</div>
          </li>
        ))}
      </ul>
    </>
  );
}

export async function LensSection() {
  const lens = await openLens(db);
  return (
    <>
      <h3>Popular now — the open lens</h3>
      <p className="lore">
        One stream you didn&rsquo;t hand-pick, ranked by a{" "}
        <Link href="/feed/formula">published formula</Link> anyone can read:
        unique contributors weighted highest, plus tips and sourced posts,
        with recency decay. Views and dwell time are never inputs. Same
        results for everyone.
      </p>
      <ul className="discussions">
        {lens.map((c) => (
          <li key={c.discussionId}>
            <Link href={`/d/${c.discussionId}`}>{c.title}</Link>{" "}
            <span className="lore">
              score {c.score.toFixed(1)} = {c.scoreParts}
            </span>
            <div className="meta">
              {c.pillarIcon} {c.pillarName}
            </div>
            <div className="why-line">{c.whyLine}</div>
          </li>
        ))}
        {lens.length === 0 && (
          <li className="lore">Nothing in the lens window yet — quiet platform, honest lens.</li>
        )}
      </ul>
    </>
  );
}

// Saved & stirring — the Beacon's memory current (BEACON_FEED_SPEC
// §3.3/§5.3, owner-ratified 2026-07-21): the face's own saved threads,
// surfaced only when they've genuinely grown since that face last read
// them. Per-face and private; the resurfacing formula is published on
// /feed/formula. The section stays silent when nothing stirs — the
// feed still ends.
export async function SavedAndStirring({ profileId }: { profileId: string }) {
  const stirring = await stirringSavesFor(db, profileId);
  if (stirring.length === 0) return null;
  return (
    <>
      <h3>Saved &amp; stirring</h3>
      <p className="lore">
        Threads you saved, back only because they&rsquo;ve grown — never
        because a machine watched you. Private to this face.{" "}
        <Link href="/feed/formula">How resurfacing works</Link>.
      </p>
      <ul className="discussions">
        {stirring.map((s) => (
          <li key={s.discussion.id}>
            <Link href={`/d/${s.discussion.id}`}>{s.discussion.title}</Link>{" "}
            {s.discussion.permanence.startsWith("permanent") ? (
              <span className="badge permanent">Permanent record</span>
            ) : (
              <span className="badge locked">Author-deletable</span>
            )}
            <div className="meta">
              {s.discussion.pillar.isMeta ? "General" : s.discussion.pillar.name} ·{" "}
              {s.newPosts} new post{s.newPosts === 1 ? "" : "s"} ·{" "}
              {s.newVoices} new voice{s.newVoices === 1 ? "" : "s"} since you read it
            </div>
            <div className="why-line">
              You saved this — it stirred while you were away.
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

// The commons now (BEACON_FEED_SPEC §5.3): the platform-wide
// recently-active stream, rehomed from the old /discussions directory.
// Same for everyone, recency within a published rail window — no
// personalization, nothing hidden.
export async function CommonsNow() {
  const windowHours = await getRail(db, "feed.commons.windowHours");
  const cutoff = new Date(Date.now() - windowHours * 3_600_000);
  const recent = await db.discussion.findMany({
    where: {
      circleId: null,
      chamberId: null,
      OR: [
        { createdAt: { gte: cutoff } },
        { posts: { some: { createdAt: { gte: cutoff } } } },
      ],
    },
    include: {
      pillar: { select: { name: true, slug: true, isMeta: true } },
      posts: {
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: { select: { posts: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const ranked = recent
    .map((d) => ({ d, lastActivity: d.posts[0]?.createdAt ?? d.createdAt }))
    .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
    .slice(0, 10);
  if (ranked.length === 0) return null;
  return (
    <>
      <h3>The commons now</h3>
      <p className="lore">
        Everything recently active across the whole commons, newest
        first, within the last {Math.round(windowHours)} hours — same
        stream for every soul, nothing personalized.
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
              {d.pillar.isMeta ? "General" : d.pillar.name} · {d._count.posts}{" "}
              post{d._count.posts === 1 ? "" : "s"} · last activity{" "}
              {lastActivity.toLocaleString()}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
