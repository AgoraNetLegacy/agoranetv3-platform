import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import { workshopAccess, WORKSHOP_ENCLOSURE_NOTE } from "@/lib/chambers";
import { submitScaffoldEdit, submitChamberInvite } from "@/app/actions";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

// The workshop (POLLINATOR §4.3, layer 2): enter-to-see. The scaffold
// (the chamber's first-principles framing, with its visible edit
// history), the working Discussion (threading per the Discussions
// conventions; reuse, not reinvention), in-space search
// (FEED_AND_SEARCH §4.1, owner-resolved: ships at launch), who's
// inside, and; for private chambers; the creator's invite control.

export default async function WorkshopPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string; q?: string }>;
}) {
  const { id } = await params;
  const { m, q } = await searchParams;

  const chamber = await db.chamber.findUnique({
    where: { id },
    include: {
      members: { orderBy: { enteredAt: "asc" } },
      invites: true,
      scaffoldRevisions: { orderBy: { editedAt: "asc" } },
      discussions: true,
    },
  });
  if (!chamber) notFound();

  const viewer = await activeFace();
  if (!(await workshopAccess(db, chamber.id, viewer?.id ?? null))) {
    return (
      <>
        <h1>The workshop</h1>
        <div className="notice">
          You enter a chamber to see what&apos;s inside.{" "}
          <Link href={`/pollinator/${chamber.id}`}>
            Read the storefront →
          </Link>
        </div>
      </>
    );
  }

  const workshop = chamber.discussions.find((d) => d.chamberId === chamber.id);
  const isCreator = viewer!.id === chamber.creatorProfileId;
  const enteredInviteIds = new Set(chamber.members.map((mm) => mm.profileId));

  return (
    <>
      <p>
        <Link href={`/pollinator/${chamber.id}`}>
          ← <Icon name="hive" /> {chamber.title} (storefront)
        </Link>
      </p>
      <h1>🚪 The workshop; {chamber.title}</h1>
      <div className="notice">{WORKSHOP_ENCLOSURE_NOTE}</div>
      {m && <div className="notice">{m}</div>}

      <h3>The scaffold; work starts oriented, not adrift</h3>
      <p className="lore">
        The pre-convo framing every chamber opens with: the platform&apos;s
        first-principles method, productized. The creator sharpens it as
        understanding grows; the history stays visible here.
      </p>
      <div className="post">
        <div className="byline">1. What are we solving?</div>
        <div className="body">{chamber.scaffoldSolving}</div>
      </div>
      <div className="post">
        <div className="byline">2. What do we need to know?</div>
        <div className="body">{chamber.scaffoldNeedToKnow}</div>
      </div>
      <div className="post">
        <div className="byline">3. What does success look like?</div>
        <div className="body">{chamber.scaffoldSuccess}</div>
      </div>
      {chamber.scaffoldRevisions.length > 0 && (
        <details>
          <summary>
            Scaffold history ({chamber.scaffoldRevisions.length} earlier
            version{chamber.scaffoldRevisions.length === 1 ? "" : "s"});
            how the understanding sharpened
          </summary>
          {chamber.scaffoldRevisions.map((r) => (
            <div key={r.id} className="meta">
              <em>until {r.editedAt.toLocaleString()}:</em> solving:{" "}
              {r.solving} · need to know: {r.needToKnow} · success:{" "}
              {r.success}
            </div>
          ))}
        </details>
      )}
      {isCreator && (
        <details>
          <summary>Sharpen the scaffold (creator; versioned)</summary>
          <form action={submitScaffoldEdit} className="composer">
            <input type="hidden" name="chamberId" value={chamber.id} />
            <label>
              1. What are we solving?
              <textarea name="solving" defaultValue={chamber.scaffoldSolving} required maxLength={1000} />
            </label>
            <label>
              2. What do we need to know?
              <textarea name="needToKnow" defaultValue={chamber.scaffoldNeedToKnow} required maxLength={1000} />
            </label>
            <label>
              3. What does success look like?
              <textarea name="success" defaultValue={chamber.scaffoldSuccess} required maxLength={1000} />
            </label>
            <button type="submit">Sharpen (prior version stays visible)</button>
          </form>
        </details>
      )}

      <h3>The working conversation</h3>
      <p className="lore">
        Threading follows the Discussions conventions; nothing bespoke.
        Deletable-class, enclosed; posting costs 2 unified PC/G units.
        Standard moderation applies as everywhere:
        flag deposits, badge holders, the tribunal.
      </p>
      {workshop ? (
        <p>
          <Link href={`/d/${workshop.id}`}>Open the workshop Discussion →</Link>
        </p>
      ) : (
        <p className="lore">No workshop Discussion found.</p>
      )}

      {/* In-space search (FEED_AND_SEARCH §4.1, owner-resolved: ships at
          launch): souls searching INSIDE a workshop they entered. Scoped
          to this space, member-gated above, never in the public index. */}
      {workshop && (
        <details open={Boolean(q)}>
          <summary className="lore">Search inside this workshop</summary>
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
          {q && <WorkshopSearchResults workshopId={workshop.id} query={q} />}
        </details>
      )}

      <h3>Souls inside ({chamber.members.length})</h3>
      <p className="lore">
        Visible in here, not on the storefront; who works an idea is the
        workshop&apos;s business; the public sees the count.
      </p>
      <ul>
        {chamber.members.map((mm) => (
          <li key={mm.id}>
            @{mm.handle}
            {mm.handle === chamber.creatorHandle ? " · creator" : ""}
          </li>
        ))}
      </ul>

      {!chamber.isPublic && isCreator && (
        <>
          <h3>Invitations; you select who gets in</h3>
          <ul>
            {chamber.invites.map((i) => (
              <li key={i.id} className="lore">
                @{i.handle}; {" "}
                {enteredInviteIds.has(i.profileId) ? "entered" : "invited, not yet entered"}
              </li>
            ))}
            {chamber.invites.length === 0 && (
              <li className="lore">No invitations yet.</li>
            )}
          </ul>
          <form action={submitChamberInvite} className="inline">
            <input type="hidden" name="chamberId" value={chamber.id} />
            <input type="text" name="handle" placeholder="@handle" required />{" "}
            <button type="submit">Invite</button>
          </form>
          <p className="interim-note">
            Invited souls find it waiting on their Pollinator page; no
            notification rides an invite yet (the category list is
            exhaustive by design; flagged for the owner).
          </p>
        </>
      )}
    </>
  );
}

async function WorkshopSearchResults({
  workshopId,
  query,
}: {
  workshopId: string;
  query: string;
}) {
  const posts = await db.post.findMany({
    where: { discussionId: workshopId, status: "visible", body: { contains: query } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return (
    <ul className="discussions">
      {posts.map((p) => (
        <li key={p.id}>
          <Link href={`/d/${workshopId}`}>@{p.authorHandle}</Link>
          <span className="lore"> · {p.createdAt.toLocaleString()}</span>
          <div className="meta">{p.body.slice(0, 200)}</div>
        </li>
      ))}
      {posts.length === 0 && <li className="lore">Nothing in this workshop matches.</li>}
    </ul>
  );
}
