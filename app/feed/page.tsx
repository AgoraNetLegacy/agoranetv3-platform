import Link from "next/link";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import { buildFeed, openLens } from "@/lib/feed";
import { markCaughtUp } from "@/app/actions";

export const dynamic = "force-dynamic";

// The feed (FEED_AND_SEARCH_SPEC): what a feed looks like when it
// optimizes FOR the person. Chosen sources + one open lens; every card
// says why it's there; the feed ends. No infinite scroll, no
// variable-reward mechanics, no red-dot economy.
export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const face = await activeFace();

  const lens = await openLens(db);

  if (!face) {
    return (
      <>
        <h1>The feed</h1>
        <p className="lore">
          Reading is free. Sign in and the backbone of this page becomes
          the sources <em>you</em> choose — until then, here is the open
          lens everyone sees: same formula, same results, for everyone.
        </p>
        <LensSection lens={lens} />
      </>
    );
  }

  const { cards, since } = await buildFeed(db, face.id);

  return (
    <>
      <h1>Your feed</h1>
      <p className="lore">
        This feed is yours — <Link href="/feed/sources">choose what feeds it</Link>.
        Assembled only from sources you chose; the machine never watches
        your behavior to guess. Per-face: your other face has its own.
      </p>
      {m && <div className="notice">{m}</div>}

      {cards.length === 0 ? (
        <div className="caught-up">
          <p>
            <strong>You&rsquo;re caught up.</strong>
            {since ? ` Nothing new from your sources since ${since.toLocaleString()}.` : " Your sources have no activity yet."}
          </p>
          <p className="lore">
            That&rsquo;s the design, not a failure: the feed ends. Browse
            the <Link href="/">pillars</Link>, or see what the open lens is
            carrying below.
          </p>
        </div>
      ) : (
        <>
          <ul className="discussions">
            {cards.map((c) => (
              <li key={c.discussionId}>
                <Link href={c.kind === "poll" ? `/polls/${c.discussionId}` : `/d/${c.discussionId}`}>
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
              from your chosen sources{since ? ` since ${since.toLocaleString()}` : ""}.
            </p>
            <form action={markCaughtUp}>
              <button type="submit">Mark read — next visit starts from now</button>
            </form>
          </div>
        </>
      )}

      <LensSection lens={lens} />
    </>
  );
}

function LensSection({ lens }: { lens: Awaited<ReturnType<typeof openLens>> }) {
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
            <span className="lore">score {c.score.toFixed(1)} = {c.scoreParts}</span>
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
