import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import {
  activeMembership,
  joinNeedsAliasWarning,
  ALIAS_SMALL_COMMUNITY_WARNING,
} from "@/lib/circles";
import { submitJoinCircle } from "@/app/actions";

export const dynamic = "force-dynamic";

// The join gate (CIRCLES §5): one gate-cleared action — no application
// essays, no founder approval. When the joining face is an Alias and the
// Circle is small or place-tagged, the honest warning the dual-identity
// module commits us to is said OUT LOUD at the exact moment it matters
// (DUAL_IDENTITY §7.1 vector 5) — informed choice, never a wall.

export default async function JoinCirclePage({
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
    include: { members: { where: { leftAt: null } } },
  });
  if (!circle) notFound();
  if (circle.status === "closed") redirect(`/circles/${circle.id}`);

  const viewer = await activeFace();
  if (!viewer) {
    redirect(`/verify?returnTo=${encodeURIComponent(`/circles/${id}/join`)}`);
  }
  if (await activeMembership(db, circle.id, viewer.id)) {
    redirect(`/circles/${circle.id}`);
  }

  const needsWarning = await joinNeedsAliasWarning(db, circle.id, viewer.id);

  return (
    <>
      <p>
        <Link href={`/circles/${circle.id}`}>← {circle.name}</Link>
      </p>
      <h1>Join {circle.name}</h1>
      {m && <div className="notice">{m}</div>}
      <p>
        Joining is one gate-cleared action: the humanity gate plus your
        visible standing is the whole filter. Your membership —{" "}
        <strong>
          {viewer.displayName} @{viewer.handle}
        </strong>{" "}
        — joins the public member list, and the join event is public
        record, like leaving.
      </p>
      <p className="lore">
        Membership is per-face: this face joins; the platform neither knows
        nor asks about any other.
      </p>

      {needsWarning && (
        <div className="door-banner">
          ◇ <strong>You are joining as an Alias.</strong>{" "}
          {ALIAS_SMALL_COMMUNITY_WARNING}
          {circle.placeTag
            ? ` This Circle is place-tagged (${circle.placeTag}).`
            : ` This Circle is small (${circle.members.length} member${circle.members.length === 1 ? "" : "s"}).`}
        </div>
      )}

      <form action={submitJoinCircle} className="composer">
        <input type="hidden" name="circleId" value={circle.id} />
        {needsWarning && (
          <label>
            <input type="checkbox" name="acceptedAliasWarning" required /> I
            understand the small-community inference risk and choose to join
            as this face.
          </label>
        )}
        <button type="submit">Clear this join — become a member</button>
      </form>
    </>
  );
}
