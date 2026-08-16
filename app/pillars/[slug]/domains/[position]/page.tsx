import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import { checkParking, BlockedPanel } from "@/app/parkingGate";
import { currentPicture } from "@/lib/domains";
import { submitRepair as submitRepairAction, followInFeed } from "@/app/actions";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

// The dedicated domain page (DASHBOARD §5.3 expanded; the spec allows
// in-place expansion or a dedicated page; a page keeps the permanent
// Picture history addressable). Everything the card promised: Reality,
// Impact Point, Forward Marker, Stoic Lens, the Picture as a living
// object with its full repair history, Open-for-Repair questions with a
// real submission control, and the doors onward; the domain's permanent
// thread and the Circles working its Impact Point.
export default async function DomainPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; position: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const { slug, position } = await params;
  const message = (await searchParams).m;

  const pillar = await db.pillar.findUnique({ where: { slug } });
  if (!pillar) notFound();

  const domain = await db.domain.findUnique({
    where: { pillarId_position: { pillarId: pillar.id, position: Number(position) } },
    include: {
      discussion: { include: { posts: { select: { authorHandle: true } } } },
      revisions: { orderBy: { version: "desc" }, include: { repair: true } },
      repairs: { orderBy: { createdAt: "desc" } },
      circles: {
        where: { status: "active" },
        include: { members: { where: { leftAt: null }, select: { id: true } } },
      },
    },
  });
  if (!domain) notFound();

  // A domain page is "in" its pillar (DASHBOARD §3.2).
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

  const viewer = await activeFace();
  const picture = await currentPicture(db, domain.id);
  const openForRepair: string[] = JSON.parse(domain.openForRepair);
  const extras: { label: string; body: string }[] = JSON.parse(domain.extras);
  const openRepairs = domain.repairs.filter((r) => r.status === "open");
  const resolvedRepairs = domain.repairs.filter((r) => r.status !== "open");
  const participants = new Set(domain.discussion?.posts.map((p) => p.authorHandle) ?? []).size;

  return (
    <>
      <p>
        <Link href={`/pillars/${pillar.slug}`}>← {pillar.name}</Link>
      </p>
      <h1>
        {domain.position}. {domain.title}
      </h1>
      {domain.subtitle && <p className="lore">{domain.subtitle}</p>}
      {domain.openingQuestionProvenance === "derived-draft" && (
        <p className="interim-note">
          This domain's opening question is a build-time draft awaiting
          owner ratification; the reference content below is the ratified
          corpus verbatim. Wording changes become ledger events.
        </p>
      )}

      <blockquote className="opening-question">{domain.openingQuestion}</blockquote>

      {/* §1.4: the door at the TOP too; the read-first layout stays,
          but the conversation stops being basement-only. */}
      {domain.discussion && (
        <div className="discussion-door">
          <Link href={`/d/${domain.discussion.id}`}>
            Join the Discussion; {participants} voice{participants === 1 ? "" : "s"}
          </Link>
        </div>
      )}

      <h3>The Reality</h3>
      <p>{domain.reality}</p>
      {extras.map((e) => (
        <div key={e.label}>
          <h3>{e.label}</h3>
          <p>{e.body}</p>
        </div>
      ))}

      <h3>The Impact Point</h3>
      <p>{domain.impactPoint}</p>

      <h3>Defined Forward Marker; what &ldquo;working&rdquo; looks like</h3>
      <p>{domain.forwardMarker}</p>

      <h3>Stoic Lens; {domain.stoicPrinciple}</h3>
      <p>{domain.stoicLens}</p>

      {domain.inService && (
        <>
          <h3>In service of the pillars</h3>
          <p>{domain.inService}</p>
        </>
      )}

      {/* The Picture as a living object (§6.5): current text, provenance,
          and the full dated history; claim, challenge, revision. */}
      <div className="picture-object">
        <h3 style={{ marginTop: 0 }}>
          The Picture{" "}
          <span className="badge permanent">
            version {picture.version}
            {picture.version === 1 ? "; as ratified" : "; community-repaired"}
          </span>
        </h3>
        <p className="lore">
          A settled position, stated plainly and kept honest by repair: if
          this analysis is wrong, it should be visibly wrong enough to be
          challenged and corrected.
        </p>
        <p className="why-text">{picture.body}</p>
        {domain.revisions.length > 1 && (
          <details>
            <summary>Revision history ({domain.revisions.length} versions)</summary>
            <ul>
              {domain.revisions.map((r) => (
                <li key={r.id}>
                  <strong>v{r.version}</strong>; {r.createdAt.toLocaleDateString()}
                  {r.repair
                    ? ` · accepted repair by @${r.repair.authorHandle}`
                    : " · the ratified original"}
                  {r.version !== picture.version && (
                    <details>
                      <summary>text as it stood</summary>
                      <p className="lore">{r.body}</p>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <h3>Open for Repair</h3>
      <p className="lore">
        Investigation, not agreement; these questions invite someone who
        disagrees with the Picture to test it, push back, or propose a
        better account.
      </p>
      <ul>
        {openForRepair.map((q, i) => (
          <li key={i}>{q}</li>
        ))}
      </ul>

      {openRepairs.length > 0 && (
        <>
          <h4>Repairs under consideration</h4>
          <ul className="discussions">
            {openRepairs.map((r) => (
              <li key={r.id}>
                <strong>@{r.authorHandle}</strong>: {r.challenge.slice(0, 160)}
                {r.challenge.length > 160 ? "…" : ""}
                <div className="meta">
                  submitted {r.createdAt.toLocaleDateString()} ·{" "}
                  {r.pollId ? (
                    <Link href={`/polls/${r.pollId}`}>
                      the governance poll deciding it →
                    </Link>
                  ) : (
                    "awaiting its poll"
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {resolvedRepairs.length > 0 && (
        <details>
          <summary>Past repairs ({resolvedRepairs.length})</summary>
          <ul className="discussions">
            {resolvedRepairs.map((r) => (
              <li key={r.id}>
                <strong>@{r.authorHandle}</strong>; {r.status}
                {r.resolvedAt ? ` ${r.resolvedAt.toLocaleDateString()}` : ""}
                <div className="meta">{r.challenge.slice(0, 160)}</div>
              </li>
            ))}
          </ul>
        </details>
      )}

      {viewer ? (
        <details className="ceremony" style={{ marginTop: "1rem" }}>
          <summary>Submit a formal Repair</summary>
          <p className="lore">
            A repair challenges the Picture and proposes its full corrected
            text. The community decides in a sealed governance poll in{" "}
            {pillar.name}&rsquo;s room; adopted repairs join the permanent
            revision history and credit your standing here. Declined repairs
            cost nothing; honest misses are safe. Submitting is free; one
            open repair per soul per domain.
          </p>
          <form action={submitRepairAction} className="composer">
            <input type="hidden" name="domainId" value={domain.id} />
            <input type="hidden" name="pillarSlug" value={pillar.slug} />
            <input type="hidden" name="position" value={domain.position} />
            <label>
              What does the current Picture get wrong?
              <textarea name="challenge" rows={3} required />
            </label>
            <label>
              The corrected Picture, in full (this text replaces the current
              version if adopted):
              <textarea name="proposedText" rows={8} required defaultValue={picture.body} />
            </label>
            <div className="composer-badge">
              <Icon name="infinity" /> Permanent public record; the challenge, the poll, and the
              outcome all enter the domain&rsquo;s dated history.
            </div>
            <button type="submit">Submit the repair</button>
          </form>
        </details>
      ) : (
        <p className="lore">Sign in with a verified identity to submit a repair.</p>
      )}

      {message && <p className="notice">{message}</p>}

      <h3>Take it further</h3>
      {domain.discussion && (
        <div className="discussion-door">
          <Link href={`/d/${domain.discussion.id}`}>
            Join the Discussion; {participants} voice{participants === 1 ? "" : "s"}
          </Link>
        </div>
      )}
      <ul>
        {!domain.discussion && (
          <li>
            <span className="lore">This domain&rsquo;s thread is not yet open.</span>
          </li>
        )}
        {viewer && (
          <li>
            <form action={followInFeed} className="inline">
              <input type="hidden" name="kind" value="domain" />
              <input type="hidden" name="refId" value={domain.id} />
              <input
                type="hidden"
                name="returnTo"
                value={`/pillars/${pillar.slug}/domains/${domain.position}`}
              />
              <button type="submit" className="linklike">
                Follow this domain in your feed →
              </button>
            </form>
          </li>
        )}
        <li>
          Circles working this Impact Point:{" "}
          {domain.circles.length === 0 ? (
            <span className="lore">none yet; </span>
          ) : (
            domain.circles.map((c, i) => (
              <span key={c.id}>
                {i > 0 && ", "}
                <Link href={`/circles/${c.id}`}>
                  {c.name} ({c.members.length})
                </Link>
              </span>
            ))
          )}{" "}
          <Link href={`/circles?domain=${domain.id}`}>
            browse or start one →
          </Link>
        </li>
      </ul>
    </>
  );
}
