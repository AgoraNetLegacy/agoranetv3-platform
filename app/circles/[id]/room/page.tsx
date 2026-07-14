import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import { roomAccess } from "@/lib/circles";
import { PollForm } from "@/app/polls/PollForm";
import { submitOffer, submitOfferUpdate, submitStewardshipPoll } from "@/app/actions";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

// The members' room (CIRCLES §2.2): the working conversation (a
// Circle-scoped Discussion), the resource board (§5), and internal
// Polls (§7) — all reuse, nothing bespoke. Members only; a closed
// Circle's room stays readable for its former members (§8).

export default async function CircleRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string; q?: string }>;
}) {
  const { id } = await params;
  const { m, q } = await searchParams;
  const circle = await db.circle.findUnique({
    where: { id },
    include: {
      pillar: true,
      discussions: true,
      offers: { orderBy: { createdAt: "desc" } },
      members: { where: { leftAt: null }, orderBy: { joinedAt: "asc" } },
    },
  });
  if (!circle) notFound();

  const viewer = await activeFace();
  const access = await roomAccess(db, circle, viewer?.id ?? null);
  if (!access.read) {
    return (
      <>
        <h1>Members&apos; room</h1>
        <div className="notice">
          The working conversation belongs to {circle.name}&apos;s members.{" "}
          <Link href={`/circles/${circle.id}`}>The public page — purpose,
          log, membership — is open to everyone →</Link>
        </div>
      </>
    );
  }

  const room = circle.discussions.find((d) => d.circleId === circle.id);
  const polls = await db.poll.findMany({
    where: { visibilityScope: "circle", circleRef: circle.id },
    orderBy: { createdAt: "desc" },
  });
  const homePillarId =
    circle.pillarId ??
    (await db.pillar.findFirstOrThrow({ where: { isMeta: true } })).id;

  return (
    <>
      <p>
        <Link href={`/circles/${circle.id}`}>← <Icon name="circles" /> {circle.name} (public page)</Link>
      </p>
      <h1>🚪 Members&apos; room — {circle.name}</h1>
      {circle.status === "closed" && (
        <div className="notice">
          This Circle is closed: the room is read-only, preserved for its
          former members.
        </div>
      )}
      {m && <div className="notice">{m}</div>}

      <h3>The working conversation</h3>
      <p className="lore">
        Members-only and deletable — planning, coordination, disagreement.
        The action log on the public page is the permanent record; this is
        where the work gets argued out.
      </p>
      {room ? (
        <p>
          <Link href={`/d/${room.id}`}>Open the Circle Discussion →</Link>
        </p>
      ) : (
        <p className="lore">No room Discussion found.</p>
      )}

      {/* In-space search (FEED_AND_SEARCH §4.1, owner-resolved: ships at
          launch): members searching INSIDE their own room. Scoped to
          this space, member-gated above, never in the public index. */}
      {room && (
        <details open={Boolean(q)}>
          <summary className="lore">Search inside this room</summary>
          <form method="get" className="inline">
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search the working conversation…"
              style={{ width: "16rem" }}
            />{" "}
            <button type="submit">Search</button>
          </form>
          {q && (
            <RoomSearchResults roomId={room.id} query={q} />
          )}
        </details>
      )}

      <h3>Resource board</h3>
      <p className="lore">
        Offers of skills, tools, time, and pledges — living statements,
        editable and retractable, members-only. Money never transits the
        platform: pledges coordinate here and are fulfilled off-platform;
        an offer becomes part of the permanent record only when a logged
        action references it.
      </p>
      {circle.offers.map((o) => (
        <div className="post" key={o.id}>
          <div className="byline">
            <span className="pseudonym">@{o.memberHandle}</span> · {o.kind} ·{" "}
            {o.status === "retracted" ? (
              <span className="badge locked">Retracted</span>
            ) : (
              <span className="badge permanent">Offered</span>
            )}
          </div>
          <div className="body">{o.body}</div>
          {viewer && o.memberProfileId === viewer.id && o.status === "active" && access.write && (
            <details>
              <summary>Edit / retract</summary>
              <form action={submitOfferUpdate} className="composer">
                <input type="hidden" name="offerId" value={o.id} />
                <input type="hidden" name="circleId" value={circle.id} />
                <textarea name="body" defaultValue={o.body} />
                <button type="submit">Update</button>{" "}
                <button type="submit" name="retract" value="1">
                  Retract
                </button>
              </form>
            </details>
          )}
        </div>
      ))}
      {circle.offers.length === 0 && <p className="lore">Nothing offered yet.</p>}
      {access.write && (
        <details>
          <summary>Post an offer</summary>
          <form action={submitOffer} className="composer">
            <input type="hidden" name="circleId" value={circle.id} />
            <label>
              Kind{" "}
              <select name="kind" defaultValue="skill">
                <option value="skill">Skill — &quot;I can do electrical work&quot;</option>
                <option value="tool">Tool — &quot;I have a truck&quot;</option>
                <option value="time">Time — &quot;Saturdays&quot;</option>
                <option value="pledge">Pledge — &quot;$200 toward materials&quot; (fulfilled off-platform)</option>
              </select>
            </label>
            <textarea name="body" required placeholder="The offer, in your words." />
            <button type="submit">Post to the board</button>
          </form>
        </details>
      )}

      <h3>Internal polls — how this Circle decides</h3>
      <p className="lore">
        Circle-restricted Polls, exactly the platform&apos;s poll machinery
        — sealed by default, one vote per profile.{" "}
        <strong>Always per-profile, never per-human:</strong> inside a
        small membership, per-human duplicate rejection would let the group
        infer that two member profiles share a human. The privacy holds
        even here — especially here.
      </p>
      <ul className="discussions">
        {polls.map((p) => (
          <li key={p.id}>
            <Link href={`/polls/${p.id}`}>{p.title}</Link>{" "}
            {p.status === "open" ? (
              <span className="badge permanent">Open</span>
            ) : (
              <span className="badge locked">Closed{p.outcome === "passed" ? " · passed" : ""}</span>
            )}
            {p.circleAction && <span className="badge permanent"> Binding</span>}
          </li>
        ))}
        {polls.length === 0 && <li className="lore">No internal polls yet.</li>}
      </ul>
      {access.write && (
        <>
          <details>
            <summary>Open an internal poll</summary>
            <PollForm
              pillarId={homePillarId}
              isGovernance={false}
              backTo={`/circles/${circle.id}/room`}
              circleId={circle.id}
            />
          </details>
          <details>
            <summary>Stewardship decision (binding)</summary>
            <p className="interim-note">
              Member removal, closure, founder succession, and the
              attestation-threshold dial are member votes — consensus
              polls with Adopt/Decline, executed automatically if adopted.
              Removal runs at this Circle&apos;s bar
              ({Math.round(circle.removalBarPercent)}%; platform floor is a
              simple majority). The platform&apos;s moderation path stays
              available in parallel for actual rule-breaking — Circles
              decide membership, moderation decides conduct.
            </p>
            <form action={submitStewardshipPoll} className="composer">
              <input type="hidden" name="circleId" value={circle.id} />
              <label>
                Decision{" "}
                <select name="kind" defaultValue="remove-member">
                  <option value="remove-member">Remove a member</option>
                  <option value="appoint-founder">Appoint a founder (succession)</option>
                  <option value="close-circle">Close the Circle</option>
                  <option value="set-attestation-threshold">Set the attestation threshold</option>
                </select>
              </label>{" "}
              <label>
                Target (handle, or number for the threshold){" "}
                <input type="text" name="target" placeholder="@handle or 3" />
              </label>{" "}
              <label>
                Duration (hours){" "}
                <input type="number" name="durationHours" min={1} defaultValue={72} style={{ width: "5rem" }} />
              </label>
              <button type="submit">Open the binding poll</button>
            </form>
          </details>
        </>
      )}

      <h3>Members ({circle.members.length})</h3>
      <ul>
        {circle.members.map((mm) => (
          <li key={mm.id}>
            @{mm.handle}
            {mm.handle === circle.founderHandle ? " · founder" : ""}
          </li>
        ))}
      </ul>
    </>
  );
}

async function RoomSearchResults({ roomId, query }: { roomId: string; query: string }) {
  const posts = await db.post.findMany({
    where: { discussionId: roomId, status: "visible", body: { contains: query } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return (
    <ul className="discussions">
      {posts.map((p) => (
        <li key={p.id}>
          <Link href={`/d/${roomId}`}>@{p.authorHandle}</Link>
          <span className="lore"> · {p.createdAt.toLocaleString()}</span>
          <div className="meta">{p.body.slice(0, 200)}</div>
        </li>
      ))}
      {posts.length === 0 && (
        <li className="lore">Nothing in this room matches.</li>
      )}
    </ul>
  );
}
