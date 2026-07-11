import Link from "next/link";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import {
  myFellowSouls,
  requestsFor,
  expireStaleRequests,
} from "@/lib/fellowSouls";
import { threadsFor } from "@/lib/dm";
import { getRail } from "@/lib/rails";
import {
  submitFellowRequest,
  submitRequestResponse,
  submitReleaseBond,
  submitOpenThread,
  submitBlock,
  submitUnblock,
  submitDeclineThread,
} from "@/app/actions";

export const dynamic = "force-dynamic";

// The souls page (FELLOW_SOULS_AND_DM_SPEC) — per-persona, and PRIVATE:
// this list renders for its owner alone. No counts leave this page, no
// other soul's list exists anywhere, and there is no "people you may
// know" — ever. A permanent product commitment, not a missing feature.

export default async function SoulsPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const viewer = await activeFace();
  if (!viewer) {
    return (
      <>
        <h1>Fellow souls</h1>
        <p className="interim-note">
          The social layer is per-face.{" "}
          <Link href={`/verify?returnTo=${encodeURIComponent("/souls")}`}>
            Verify once to act →
          </Link>{" "}
          or <Link href="/login">sign in</Link>.
        </p>
      </>
    );
  }

  await expireStaleRequests(db);
  const [souls, requests, threads, requestFee, threadFee, messageFee, blocks] =
    await Promise.all([
      myFellowSouls(db, viewer.id),
      requestsFor(db, viewer.id),
      threadsFor(db, viewer.id),
      getRail(db, "social.requestFee"),
      getRail(db, "dm.threadFee"),
      getRail(db, "dm.messageFee"),
      db.block.findMany({ where: { blockerProfileId: viewer.id } }),
    ]);
  const blockedProfiles = await db.profile.findMany({
    where: { id: { in: blocks.map((b) => b.blockedProfileId) } },
    select: { id: true, handle: true },
  });

  return (
    <>
      <h1>Fellow souls & messages</h1>
      <p className="lore">
        Good people find each other. Bonds are mutual consent between two
        faces; your graph is yours alone — no public lists, no counts, no
        suggestions, ever.
      </p>
      {m && <div className="notice">{m}</div>}

      <h3>Requests</h3>
      {requests.length === 0 && threads.requests.length === 0 && (
        <p className="lore">Nothing waits. Requests expire quietly after their window.</p>
      )}
      {requests.map((r) => (
        <div className="post" key={r.id}>
          <div className="byline">
            <span className="pseudonym">{r.from?.displayName}</span>{" "}
            @{r.from?.handle} asks to be your fellow soul ·{" "}
            {r.createdAt.toLocaleDateString()}
          </div>
          {r.note && <div className="body">{r.note}</div>}
          <form action={submitRequestResponse} className="inline">
            <input type="hidden" name="requestId" value={r.id} />
            <button type="submit" name="accept" value="1">
              Accept (free)
            </button>{" "}
            <button type="submit" name="accept" value="0">
              Decline (free, quiet — they are not told)
            </button>
          </form>
        </div>
      ))}
      {threads.requests.map((t) => (
        <div className="post" key={t.id}>
          <div className="byline">
            <span className="pseudonym">{t.other?.displayName}</span>{" "}
            @{t.other?.handle} opened a conversation ·{" "}
            {t.lastMessageAt.toLocaleDateString()}
          </div>
          <div className="meta">
            A stranger&apos;s first message waits as a request — reading it
            costs nothing; replying opens the thread.
          </div>
          <Link href={`/dm/${t.id}`}>Read it →</Link>{" "}
          <form action={submitDeclineThread} className="inline">
            <input type="hidden" name="threadId" value={t.id} />
            <button type="submit">Decline (free, quiet)</button>
          </form>
        </div>
      ))}

      <h3>Threads</h3>
      <ul className="discussions">
        {threads.inbox.map((t) => (
          <li key={t.id}>
            <Link href={`/dm/${t.id}`}>
              @{t.other?.handle} — {t.other?.displayName}
            </Link>{" "}
            {t.status === "request" && (
              <span className="badge locked">Awaiting their answer</span>
            )}
            {t.muted && <span className="badge locked">Muted</span>}
            <div className="meta">last activity {t.lastMessageAt.toLocaleString()}</div>
          </li>
        ))}
        {threads.inbox.length === 0 && <li className="lore">No conversations yet.</li>}
      </ul>
      <details>
        <summary>Open a conversation</summary>
        <form action={submitOpenThread} className="composer">
          <label>
            To (@handle){" "}
            <input type="text" name="handle" required placeholder="@handle" />
          </label>
          <textarea name="body" required placeholder="Your first words." />
          <p className="interim-note">
            Strangers receive this as a request; fellow souls receive it
            directly. Opening costs {threadFee} PC + {messageFee} PC for the
            message — the initiator pays, so spam prices itself out.
            Receiving and replying are free to the other side.
          </p>
          <button type="submit">Send · {(threadFee + messageFee).toFixed(2)} PC</button>
        </form>
      </details>

      <h3>Your fellow souls ({souls.length})</h3>
      <p className="lore">
        Visible to you alone. The platform never counts, ranks, or
        suggests souls — a friend graph is a fingerprint, so yours is
        never computed against.
      </p>
      <ul>
        {souls.map((s) => (
          <li key={s.id}>
            <span className="pseudonym">{s.displayName}</span> @{s.handle}{" "}
            <form action={submitReleaseBond} className="inline">
              <input type="hidden" name="otherProfileId" value={s.id} />
              <button type="submit">Release bond (quiet)</button>
            </form>
          </li>
        ))}
        {souls.length === 0 && <li className="lore">None yet — send a request below.</li>}
      </ul>
      <details>
        <summary>Ask a soul to be your fellow soul</summary>
        <form action={submitFellowRequest} className="composer">
          <label>
            @handle <input type="text" name="handle" required placeholder="@handle" />
          </label>
          <input type="text" name="note" maxLength={200} placeholder="A short note (optional)" />
          <p className="interim-note">
            {requestFee} PC, initiator pays. They may accept, ignore, or
            decline — all free, and declines are silent. A declined or
            lapsed request holds a cooldown before you may ask again.
          </p>
          <button type="submit">Send request · {requestFee} PC</button>
        </form>
      </details>

      <h3>Blocked ({blockedProfiles.length})</h3>
      <p className="lore">
        One-way, per-face, quiet: a blocked soul cannot message or request
        you, and is never told.
      </p>
      <ul>
        {blockedProfiles.map((b) => (
          <li key={b.id}>
            @{b.handle}{" "}
            <form action={submitUnblock} className="inline">
              <input type="hidden" name="blockedProfileId" value={b.id} />
              <button type="submit">Unblock</button>
            </form>
          </li>
        ))}
        {blockedProfiles.length === 0 && <li className="lore">Nobody.</li>}
      </ul>
      <details>
        <summary>Block a soul</summary>
        <form action={submitBlock} className="inline">
          <input type="text" name="handle" required placeholder="@handle" />{" "}
          <button type="submit">Block (quiet)</button>
        </form>
      </details>
    </>
  );
}
