import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import { inboxFor, notifyClosingPolls } from "@/lib/notifications";
import { runModerationSweeps } from "@/lib/moderation";
import { markNotificationRead } from "@/app/actions";

export const dynamic = "force-dynamic";

// The inbox (NOTIFICATIONS §1/§3): time-sensitive first, the quiet tier
// below. Per-persona; this is the ACTIVE identity's inbox and nobody
// else's; nothing merges, previews, or counts across identities. No streaks,
// no nags, nothing manufactured.
export default async function InboxPage() {
  const face = await activeFace();
  if (!face) redirect("/login");

  await runModerationSweeps(db);
  await notifyClosingPolls(db);
  const inbox = await inboxFor(db, face.id);

  const renderItem = (n: (typeof inbox.timeSensitive)[number]) => (
    <div key={n.id} className={`post ${n.readAt ? "" : "unread"}`}>
      <div className="byline">
        {n.readAt ? "" : "● "}
        {n.updatedAt.toLocaleString()} · {n.category}
        {n.count > 1 ? ` · ${n.count} updates, one entry` : ""}
      </div>
      <strong>{n.title}</strong>
      <div className="body">{n.body}</div>
      <div className="byline">
        {n.refType === "poll" && n.refId && <Link href={`/polls/${n.refId}`}>open →</Link>}
        {n.refType === "post" && n.refId && <span className="lore">see the thread</span>}
        {n.category === "badge-offer" && <Link href="/moderation">to the workbench →</Link>}{" "}
        {!n.readAt && (
          <form action={markNotificationRead} className="inline">
            <input type="hidden" name="notificationId" value={n.id} />
            <button type="submit" className="linklike">
              mark read
            </button>
          </form>
        )}
      </div>
    </div>
  );

  return (
    <>
      <h1>Inbox; {face.displayName} @{face.handle}</h1>
      <p className="lore">
        This identity's inbox only. Time-sensitive first; the quiet tier waits
        for you; no streaks, no red-dot games, ever.
      </p>

      <h3>Time-sensitive</h3>
      {inbox.timeSensitive.length > 0 ? (
        inbox.timeSensitive.map(renderItem)
      ) : (
        <p className="lore">Nothing needs you right now.</p>
      )}

      <h3>Quiet inbox (daily digest by default)</h3>
      {inbox.quiet.length > 0 ? (
        inbox.quiet.map(renderItem)
      ) : (
        <p className="lore">All quiet.</p>
      )}
    </>
  );
}
