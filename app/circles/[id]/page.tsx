import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import {
  activeMembership,
  circleStatusLabel,
  HONEST_CLAIM,
} from "@/lib/circles";
import {
  submitActionEntry,
  submitAttest,
  submitLeaveCircle,
  submitPurposeEdit,
} from "@/app/actions";
import { Icon, PillarMark } from "@/components/Icon";

export const dynamic = "force-dynamic";

// The public page (CIRCLES §2.1) — visible to everyone, including
// Readers: purpose (versioned), focus tags, the action log (§6) with the
// honest-claim copy fixed in the UI, the membership list, and status.
// Deliberation lives in the members' room; this page is the record.

export default async function CirclePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const { id } = await params;
  const { m } = await searchParams;

  const circle = await db.circle.findUnique({
    where: { id },
    include: {
      pillar: true,
      purposeRevisions: { orderBy: { editedAt: "asc" } },
      members: { orderBy: { joinedAt: "asc" } },
      actions: {
        orderBy: { createdAt: "desc" },
        include: {
          attestations: { orderBy: { createdAt: "asc" } },
          pledges: true,
          correctionOf: { select: { id: true, body: true } },
          corrections: { select: { id: true } },
        },
      },
      offers: { where: { status: "active" } },
    },
  });
  if (!circle) notFound();

  const viewer = await activeFace();
  const membership = viewer ? await activeMembership(db, circle.id, viewer.id) : null;
  const label = await circleStatusLabel(db, circle);
  const activeMembers = circle.members.filter((mm) => mm.leftAt === null);
  const isFounder = viewer?.id === circle.founderProfileId;
  const pillars = await db.pillar.findMany({
    where: { isMeta: false },
    orderBy: { position: "asc" },
  });

  return (
    <>
      <p>
        <Link href="/circles">← All Circles</Link>
      </p>
      <h1><Icon name="circles" /> {circle.name}</h1>
      <p>
        {label === "active" && <span className="badge permanent">Active</span>}
        {label === "inactive" && (
          <span className="badge locked">
            Inactive — quiet for a while, honestly labeled; still joinable
          </span>
        )}
        {label === "closed" && (
          <span className="badge locked">
            Closed by member vote — this record is preserved forever
          </span>
        )}{" "}
        {circle.pillar && (
          <Link href={`/pillars/${circle.pillar.slug}`}>
            <PillarMark slug={circle.pillar.slug} /> {circle.pillar.name}
          </Link>
        )}
        {circle.placeTag && <> · 📍 {circle.placeTag}</>}
      </p>

      {m && <div className="notice">{m}</div>}

      <h3>Purpose</h3>
      <p>{circle.purpose}</p>
      {circle.problem && (
        <p className="lore">The problem it owns: {circle.problem}</p>
      )}
      {circle.purposeRevisions.length > 0 && (
        <details>
          <summary>
            Purpose history ({circle.purposeRevisions.length} earlier
            version{circle.purposeRevisions.length === 1 ? "" : "s"}) — a
            Circle can&apos;t quietly rewrite what it claimed to be
          </summary>
          {circle.purposeRevisions.map((r) => (
            <div key={r.id} className="meta">
              <em>until {r.editedAt.toLocaleString()}:</em> {r.purpose}
              {r.problem ? ` · problem: ${r.problem}` : ""}
              {r.placeTag ? ` · place: ${r.placeTag}` : ""}
            </div>
          ))}
        </details>
      )}
      {isFounder && circle.status === "active" && (
        <details>
          <summary>Edit purpose &amp; tags (founder&apos;s only power — versioned)</summary>
          <form action={submitPurposeEdit} className="composer">
            <input type="hidden" name="circleId" value={circle.id} />
            <textarea name="purpose" defaultValue={circle.purpose} required maxLength={1000} />
            <label>
              Pillar{" "}
              <select name="pillarId" defaultValue={circle.pillarId ?? ""}>
                <option value="">None</option>
                {pillars.map((p) => (
                  <option key={p.id} value={p.id}>
                    <PillarMark slug={p.slug} /> {p.name}
                  </option>
                ))}
              </select>
            </label>{" "}
            <label>
              Place <input type="text" name="placeTag" defaultValue={circle.placeTag ?? ""} maxLength={80} />
            </label>{" "}
            <label>
              Problem <input type="text" name="problem" defaultValue={circle.problem ?? ""} maxLength={200} />
            </label>
            <button type="submit">Amend (prior version stays public)</button>
          </form>
        </details>
      )}

      {/* Membership actions — a div, not a <p>: a form may not descend
          from a paragraph, and the hydration remount breaks submits. */}
      <div style={{ margin: "1rem 0" }}>
        {membership ? (
          <>
            <Link href={`/circles/${circle.id}/room`}>
              🚪 Enter the members&apos; room →
            </Link>{" "}
            <form action={submitLeaveCircle} className="inline">
              <input type="hidden" name="circleId" value={circle.id} />
              <button type="submit">Leave (one tap; public record)</button>
            </form>
          </>
        ) : circle.status === "closed" ? (
          <span className="lore">Closed — no longer joinable.</span>
        ) : viewer ? (
          <Link href={`/circles/${circle.id}/join`}>Join this Circle →</Link>
        ) : (
          <Link href={`/verify?returnTo=${encodeURIComponent(`/circles/${circle.id}`)}`}>
            Verify once to join →
          </Link>
        )}
      </div>

      <h3>The action log — the permanent public record</h3>
      <div className="notice">{HONEST_CLAIM}</div>
      {membership && circle.status === "active" && (
        <details>
          <summary>Log an action</summary>
          <form action={submitActionEntry} className="composer">
            <input type="hidden" name="circleId" value={circle.id} />
            <span className="composer-badge">
              <Icon name="infinity" /> Permanent public record — no edit, no delete, ever. A
              mistake is corrected by a later entry that references it.
              Free text may name meeting places for coordination — place
              yourself on the map, never someone else, and never a
              residential address.
            </span>
            <textarea name="body" required placeholder="What was done." />
            <label>
              When (coarse){" "}
              <input type="text" name="didAt" placeholder="e.g. Saturday morning" maxLength={80} />
            </label>{" "}
            <label>
              Where (coarse){" "}
              <input type="text" name="place" placeholder="e.g. downtown Kelowna" maxLength={80} />
            </label>
            {circle.offers.length > 0 && (
              <details>
                <summary>This action drew on pledged resources</summary>
                {circle.offers.map((o) => (
                  <label key={o.id} style={{ display: "block" }}>
                    <input type="checkbox" name="drewOn" value={o.id} /> {o.kind}: {o.body} (@{o.memberHandle})
                    — referencing it makes it part of the permanent record
                  </label>
                ))}
              </details>
            )}
            <button type="submit">Log it — forever</button>
          </form>
        </details>
      )}

      {circle.actions.map((entry) => {
        const attested = entry.attestedAt !== null;
        const canAttest =
          membership &&
          circle.status === "active" &&
          viewer &&
          entry.authorProfileId !== viewer.id &&
          !entry.attestations.some((a) => a.attestorProfileId === viewer.id);
        return (
          <div className="post" key={entry.id} id={entry.id}>
            <div className="byline">
              <span className="pseudonym">{entry.authorDisplayName}</span>{" "}
              <span>@{entry.authorHandle}</span> · logged{" "}
              {entry.createdAt.toLocaleString()} ·{" "}
              {attested ? (
                <span className="badge permanent">
                  ✓ ATTESTED — {entry.attestations.length} co-signer
                  {entry.attestations.length === 1 ? "" : "s"}
                </span>
              ) : (
                <span className="badge locked">
                  Logged — {entry.attestations.length}/{circle.attestationThreshold}{" "}
                  attestations
                </span>
              )}
            </div>
            {entry.correctionOf && (
              <div className="meta">
                ↩ Correction of an earlier entry (
                <a href={`#${entry.correctionOf.id}`}>see it</a> — the
                mistaken record stands, corrected, like a ledger, because it
                is one).
              </div>
            )}
            <div className="body">{entry.body}</div>
            <div className="meta">
              {entry.didAt ? `When: ${entry.didAt}` : ""}
              {entry.didAt && entry.place ? " · " : ""}
              {entry.place ? `Where: ${entry.place}` : ""}
            </div>
            {entry.pledges.length > 0 && (
              <div className="meta">
                Drew on:{" "}
                {entry.pledges.map((p) => `${p.kind} — ${p.body}`).join(" · ")}{" "}
                (snapshots at logging time; now part of the record)
              </div>
            )}
            {entry.attestations.length > 0 && (
              <div className="meta">
                Attested by:{" "}
                {entry.attestations.map((a) => `@${a.attestorHandle}`).join(", ")}
              </div>
            )}
            {entry.corrections.length > 0 && (
              <div className="meta">⚠ A later entry corrects this one.</div>
            )}
            {canAttest && (
              <form action={submitAttest} className="inline">
                <input type="hidden" name="entryId" value={entry.id} />
                <input type="hidden" name="circleId" value={circle.id} />
                <button type="submit">
                  Attest — put your name to this claim, permanently
                </button>
              </form>
            )}
          </div>
        );
      })}
      {circle.actions.length === 0 && (
        <p className="lore">
          No actions logged yet — the log is what separates &quot;we talked
          about it&quot; from &quot;here&apos;s proof we did it.&quot;
        </p>
      )}

      <h3>Members ({activeMembers.length})</h3>
      <p className="lore">
        Public by default: provable good requires visible humans behind it.
        Join and leave events are public record.
      </p>
      <ul>
        {activeMembers.map((mm) => (
          <li key={mm.id}>
            @{mm.handle}
            {mm.handle === circle.founderHandle ? " · founder (purpose steward)" : ""}
          </li>
        ))}
      </ul>
      {circle.members.some((mm) => mm.leftAt !== null) && (
        <details>
          <summary>Former members</summary>
          <ul>
            {circle.members
              .filter((mm) => mm.leftAt !== null)
              .map((mm) => (
                <li key={mm.id} className="lore">
                  @{mm.handle} — left {mm.leftAt!.toLocaleDateString()}
                </li>
              ))}
          </ul>
        </details>
      )}
    </>
  );
}
