import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import {
  chamberActivityLevel,
  chamberMembership,
  carriesBothTokens,
} from "@/lib/chambers";
import { faceConstellation } from "@/lib/lightScore";
import { submitEnterChamber } from "@/app/actions";
import { Icon, PillarMark } from "@/components/Icon";

export const dynamic = "force-dynamic";

// The storefront (POLLINATOR §4.3, layer 1); public, free to read, for
// every chamber. Public chambers show the full pitch: the idea, the
// required "why should people care" answer, the creator (WITH their
// per-pillar Light Score; public record here by owner ratification:
// a bad-standing creator can still build, but never behind a curtain),
// member count, and activity level. A private chamber's storefront is
// minimal; name + private marker (§10.6 interim, flagged).

export default async function StorefrontPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const { id } = await params;
  const { m } = await searchParams;

  const chamber = await db.chamber.findUnique({
    where: { id },
    include: { members: { select: { profileId: true } } },
  });
  if (!chamber) notFound();

  const viewer = await activeFace();
  const isMember = viewer
    ? (await chamberMembership(db, chamber.id, viewer.id)) !== null
    : false;
  const invited =
    viewer && !chamber.isPublic
      ? (await db.chamberInvite.findUnique({
          where: {
            chamberId_profileId: { chamberId: chamber.id, profileId: viewer.id },
          },
        })) !== null
      : false;

  // A private chamber's storefront is minimal: name + private marker.
  // Members and invitees see the door; everyone else sees the marker.
  if (!chamber.isPublic && !isMember && !invited) {
    return (
      <>
        <p>
          <Link href="/pollinator">← The Pollinator</Link>
        </p>
        <h1><Icon name="hive" /> {chamber.title}</h1>
        <p>
          <span className="badge locked">Private chamber; invite-only</span>
        </p>
        <p className="lore">
          An enclosed working space. The creator selects who gets invited;
          private chambers never compete in the tournament. That&apos;s the
          whole storefront, by design.
        </p>
        {m && <div className="notice">{m}</div>}
      </>
    );
  }

  const activity = await chamberActivityLevel(db, chamber);
  const creator = await db.profile.findUnique({
    where: { id: chamber.creatorProfileId },
    select: { displayName: true },
  });
  // The creator's Light Score; public record on public-chamber
  // storefronts (owner-ratified 2026-07-09): per-face, per-pillar, like
  // everywhere. Transparency instead of gatekeeping (OQ5): souls judge
  // standing with their own eyes; the platform never pre-filters.
  const constellation = chamber.isPublic
    ? await faceConstellation(db, chamber.creatorProfileId)
    : null;
  const canEnter =
    viewer && !isMember ? await carriesBothTokens(db, viewer.id) : false;

  return (
    <>
      <p>
        <Link href="/pollinator">← The Pollinator</Link>
      </p>
      <h1><Icon name="hive" /> {chamber.title}</h1>
      <p>
        {chamber.isPublic ? (
          <span className="badge permanent">Public chamber</span>
        ) : (
          <span className="badge locked">Private chamber; invite-only</span>
        )}{" "}
        {activity === "active" ? (
          <span className="badge permanent">Active this week</span>
        ) : (
          <span className="badge locked">Quiet</span>
        )}{" "}
        · {chamber.members.length} soul{chamber.members.length === 1 ? "" : "s"}{" "}
        inside · opened {chamber.createdAt.toLocaleDateString()}
      </p>
      {m && <div className="notice">{m}</div>}

      <h3>The idea</h3>
      <p>{chamber.subject}</p>

      <h3>The pitch</h3>
      <p>{chamber.pitch}</p>

      <h3>Why should people care</h3>
      <p>
        {chamber.whyCare}
      </p>
      <p className="lore">
        What problem, for whom, why now; required of every chamber; this
        is what prospective participants (and, post-launch, leaderboard
        voters) evaluate first.
      </p>

      <h3>The creator; standing on the record</h3>
      <p>
        {creator?.displayName} @{chamber.creatorHandle}
      </p>
      {constellation && (
        <>
          <p className="lore">
            The creator&apos;s Light Score is public record on a public
            chamber&apos;s storefront: per-pillar, never a sum. A
            bad-standing creator can still build; but never behind a
            curtain. Judge with your own eyes.
          </p>
          {constellation.pillars.length === 0 ? (
            <p className="lore">No standing yet; this face is new or quiet.</p>
          ) : (
            <ul className="discussions">
              {constellation.pillars.map((p) => (
                <li key={p.pillarId}>
                  <PillarMark slug={p.slug} /> <strong>{p.name}</strong>: {p.points}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <h3>The workshop; enter to see</h3>
      <p className="lore">
        The chamber&apos;s working contents live behind this door: threads,
        contributions, the developing idea. Enclosed by design; a safe
        space where half-formed thinking gets worked out without the open
        internet watching the drafts.
      </p>
      <div style={{ margin: "1rem 0" }}>
        {isMember ? (
          <Link href={`/pollinator/${chamber.id}/workshop`}>
            🚪 Enter the workshop →
          </Link>
        ) : viewer ? (
          canEnter ? (
            <form action={submitEnterChamber} className="inline">
              <input type="hidden" name="chamberId" value={chamber.id} />
              <button type="submit">
                Enter; free; posting inside costs both tokens
              </button>
            </form>
          ) : (
            <span className="interim-note">
              Entering asks only that you carry both tokens; participation
              inside charges PollCoin and Gratium together, and the
              earnable paths cover committed souls. Top up by
              participating, then come back.
            </span>
          )
        ) : (
          <Link
            href={`/verify?returnTo=${encodeURIComponent(`/pollinator/${chamber.id}`)}`}
          >
            Verify once to enter →
          </Link>
        )}
      </div>

      <p className="interim-note">
        Permanence, plainly: this storefront follows the chamber&apos;s
        lifecycle; workshop contents are deletable-class with due process
        (standard moderation applies as everywhere). When the Tournament
        arrives, Arena debates and Season records will be permanent public
        record; competitors will know the case they make is forever.
      </p>
    </>
  );
}
