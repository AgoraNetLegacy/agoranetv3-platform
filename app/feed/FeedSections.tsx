import Link from "next/link";
import { db } from "@/lib/db";
import { buildFeed, openLens, chamberStorefrontCards } from "@/lib/feed";
import { stirringSavesFor } from "@/lib/saved";
import { getRail } from "@/lib/rails";
import { beaconWellbeingFor } from "@/lib/wellbeing";
import { STOIC_LESSONS } from "@/lib/stoicContent.generated";
import { BeaconNudge } from "@/components/BeaconNudge";
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
        { posts: { some: { status: "visible", createdAt: { gte: cutoff } } } },
      ],
    },
    include: {
      pillar: { select: { name: true, slug: true, isMeta: true } },
      posts: {
        where: { status: "visible" },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: { select: { posts: { where: { status: "visible" } } } },
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

// Server shim: resolve the face's wellbeing thresholds and hand them
// to the client-side nudge (BEACON §7 — the browser does the timing;
// the server only knows the chosen numbers).
export async function BeaconWellbeingMount({ profileId }: { profileId: string }) {
  const wb = await beaconWellbeingFor(db, profileId);
  if (wb.nudgeAfterMin === null && wb.dailyCapMin === null) return null;
  return (
    <BeaconNudge
      faceId={profileId}
      nudgeAfterMin={wb.nudgeAfterMin}
      dailyCapMin={wb.dailyCapMin}
    />
  );
}

// Beacon cards — the open current's provable-good set (BEACON §6,
// v2's heart carried forward): a circle_story (attested, ledger-real
// action) and a question_prompt (a canon question inviting an answer).
// Deterministic and legible: newest attested story; the canon question
// with the fewest voices — every card says why, every card exits into
// the core loop.
export async function BeaconCards() {
  const [story, questions] = await Promise.all([
    db.actionEntry.findFirst({
      where: { attestedAt: { not: null } },
      orderBy: { attestedAt: "desc" },
      include: {
        circle: { select: { id: true, name: true, placeTag: true } },
        attestations: { select: { id: true } },
      },
    }),
    db.question.findMany({
      include: {
        pillar: { select: { name: true, isMeta: true } },
        discussion: {
          select: { id: true, _count: { select: { posts: true } } },
        },
      },
    }),
  ]);

  const prompt = questions
    .filter((q) => q.discussion && !q.pillar.isMeta)
    .sort(
      (a, b) =>
        (a.discussion?._count.posts ?? 0) - (b.discussion?._count.posts ?? 0)
    )[0];

  if (!story && !prompt) return null;
  return (
    <>
      <h3>From the Beacon</h3>
      <ul className="discussions">
        {story && (
          <li>
            <Link href={`/circles/${story.circle.id}`}>
              {story.circle.name}: {story.body.length > 90 ? `${story.body.slice(0, 90)}…` : story.body}
            </Link>{" "}
            <span className="badge permanent">Attested action</span>
            <div className="meta">
              {story.attestations.length} member
              {story.attestations.length === 1 ? "" : "s"} staked their names
              on this{story.circle.placeTag ? ` · 📍 ${story.circle.placeTag}` : ""} ·{" "}
              {story.attestedAt!.toLocaleDateString()}
            </div>
            <div className="why-line">
              Provable good: the newest ledger-attested Circle action — real
              hands, real record. Join them.
            </div>
          </li>
        )}
        {prompt && prompt.discussion && (
          <li>
            <Link href={`/d/${prompt.discussion.id}`}>{prompt.text}</Link>{" "}
            <span className="badge permanent">Canon question {prompt.position}</span>
            <div className="meta">
              {prompt.pillar.name} · {prompt.discussion._count.posts} post
              {prompt.discussion._count.posts === 1 ? "" : "s"} so far
            </div>
            <div className="why-line">
              The canon question with the fewest voices — yours would count
              double here.
            </div>
          </li>
        )}
      </ul>
    </>
  );
}

// The day's featured pillar (BEACON §3.4 community lanes): a
// deterministic date-keyed rotation over the six diagnostic pillars —
// same pillar for every soul, no personal signal, stated in the
// why-line.
async function featuredPillarOfTheDay(dbc: typeof db) {
  const outer = await dbc.pillar.findMany({
    where: { isMeta: false },
    orderBy: { position: "asc" },
  });
  if (outer.length === 0) return null;
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  return outer[dayIndex % outer.length];
}

// pillar-pulse: the open-lens formula scoped to the featured pillar.
export async function PillarPulse() {
  const pillar = await featuredPillarOfTheDay(db);
  if (!pillar) return null;
  const [cap] = await Promise.all([getRail(db, "feed.lane.pulseCards")]);
  const cards = (await openLens(db, Math.max(1, Math.round(cap)), pillar.slug));
  if (cards.length === 0) return null;
  return (
    <>
      <h3>Pillar pulse — {pillar.name} today</h3>
      <p className="lore">
        Today&rsquo;s featured pillar rotates on a fixed daily cycle —
        same pillar, same stream, for every soul. Ranked by the{" "}
        <Link href="/feed/formula">published formula</Link>, scoped to{" "}
        {pillar.name}.
      </p>
      <ul className="discussions">
        {cards.map((c) => (
          <li key={c.discussionId}>
            <Link href={`/d/${c.discussionId}`}>{c.title}</Link>
            <div className="meta">
              score {c.score.toFixed(1)} = {c.scoreParts}
            </div>
            <div className="why-line">{c.whyLine}</div>
          </li>
        ))}
      </ul>
    </>
  );
}

// sources-radar: the most-cited source objects in the featured
// pillar's public spaces within the commons window — the studies and
// articles the pillar is actually arguing about.
export async function SourcesRadar() {
  const pillar = await featuredPillarOfTheDay(db);
  if (!pillar) return null;
  const [cap, windowHours] = await Promise.all([
    getRail(db, "feed.lane.radarSources"),
    getRail(db, "feed.commons.windowHours"),
  ]);
  const cutoff = new Date(Date.now() - windowHours * 3_600_000);
  const usages = await db.postSource.findMany({
    where: {
      createdAt: { gte: cutoff },
      post: {
        status: "visible",
        discussion: { pillarId: pillar.id, circleId: null, chamberId: null },
      },
    },
    include: {
      source: { select: { id: true, url: true } },
      post: { select: { discussionId: true } },
    },
  });
  if (usages.length === 0) return null;
  const bySource = new Map<
    string,
    { url: string; count: number; discussionId: string }
  >();
  for (const u of usages) {
    const entry = bySource.get(u.source.id);
    if (entry) entry.count += 1;
    else
      bySource.set(u.source.id, {
        url: u.source.url,
        count: 1,
        discussionId: u.post.discussionId,
      });
  }
  const top = [...bySource.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, Math.max(1, Math.round(cap)));
  return (
    <>
      <h3>The sources radar — {pillar.name}</h3>
      <p className="lore">
        The most-cited sources in {pillar.name}&rsquo;s public spaces in
        the last {Math.round(windowHours)} hours — what the commons is
        actually reading. Citation counts only; nothing personal.
      </p>
      <ul className="discussions">
        {top.map((s) => (
          <li key={s.url}>
            <Link href={`/d/${s.discussionId}`}>
              {s.url.length > 80 ? `${s.url.slice(0, 80)}…` : s.url}
            </Link>
            <div className="meta">
              cited {s.count} time{s.count === 1 ? "" : "s"} this window
            </div>
            <div className="why-line">
              Sources radar: follow the citation into the room discussing it.
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

// stoic-wisdom (BEACON §3.4, owner-ruled 2026-07-22): a date-keyed
// deterministic rotation over the owner's Stoic teaching corpus —
// same passage for every soul on a given day, always cited to its
// lesson, always linking to the pillar it illuminates. Community-level
// by construction; the Inner Citadel room stays parked — this lane is
// feed-only.
export async function StoicWisdom() {
  if (STOIC_LESSONS.length === 0) return null;
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const lesson = STOIC_LESSONS[dayIndex % STOIC_LESSONS.length];
  const excerpt =
    lesson.excerpts[
      Math.floor(dayIndex / STOIC_LESSONS.length) % lesson.excerpts.length
    ];
  const pillar = lesson.pillarSlug
    ? await db.pillar.findUnique({ where: { slug: lesson.pillarSlug } })
    : null;
  return (
    <>
      <h3>Stoic wisdom for the commons</h3>
      <ul className="discussions">
        <li>
          <blockquote className="opening-question" style={{ margin: 0 }}>
            {excerpt.text}
          </blockquote>
          <div className="meta">
            From <em>{lesson.title}</em> — the platform&rsquo;s Stoic
            teaching corpus
            {pillar ? (
              <>
                {" "}· illuminates <Link href={`/pillars/${pillar.slug}`}>{pillar.name}</Link>
              </>
            ) : null}
          </div>
          <div className="why-line">
            One passage a day, the same for every soul — a fixed rotation,
            nothing personalized.
          </div>
        </li>
      </ul>
    </>
  );
}
