import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import { SoulHeader } from "@/components/SoulHeader";

export const dynamic = "force-dynamic";

// The public soul window (Phase 8.5, PRESENTATION_SPEC §5.2): what one
// face chooses to show — display name, @handle, face kind, coarse join
// period, and the live-surface bio. Nothing here is new information:
// every field is either already public or written by the soul for this
// exact window. Pending Aliases don't exist publicly, here or anywhere.
export default async function SoulWindow({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const soul = await db.profile.findFirst({
    where: { handle: handle.toLowerCase(), status: "active" },
  });
  if (!soul) notFound();
  const viewer = await activeFace();
  const isOwn = viewer?.id === soul.id;

  const images = await db.profileImage.findMany({
    where: { profileId: soul.id },
    select: { updatedAt: true },
  });
  const bust = images
    .map((i) => i.updatedAt.getTime())
    .sort()
    .join("-");

  return (
    <div className="ceremony">
      <SoulHeader
        handle={soul.handle}
        displayName={soul.displayName}
        face={soul.face}
        joinedPeriod={soul.joinedPeriod}
        bioPlace={soul.bioPlace}
        cacheBust={bust || undefined}
      />
      {soul.bio ? (
        <p style={{ whiteSpace: "pre-wrap" }}>{soul.bio}</p>
      ) : (
        <p className="lore">This soul hasn&rsquo;t written a window yet.</p>
      )}
      {isOwn ? (
        <p className="lore">
          This is your window as others see it —{" "}
          <Link href="/profile">edit it here</Link>.
        </p>
      ) : (
        viewer && (
          <p className="lore">
            Find them in <Link href="/souls">Fellow Souls &amp; Messages</Link>{" "}
            to send a request — it waits quietly; nothing ticks at them.
          </p>
        )
      )}
    </div>
  );
}
