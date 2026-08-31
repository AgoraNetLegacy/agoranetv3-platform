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
import { publicSoulDirectory } from "@/lib/soulDirectory";
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

// Public profile discovery and private social state share one front door.
// The directory exposes only fields already published on each soul window.
// Bonds, requests, blocks, and message threads remain per-persona and private.

export default async function SoulsPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; q?: string; page?: string }>;
}) {
  const { m, q, page: pageRaw } = await searchParams;
  const directory = await publicSoulDirectory(db, {
    query: q,
    page: Number(pageRaw) || 1,
  });
  const viewer = await activeFace();
  if (!viewer) {
    return (
      <>
        <SoulDirectory directory={directory} />
        <p className="interim-note">
          The directory is public. Sign in to connect or send a private message.{" "}
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
      <SoulDirectory directory={directory} />
      <hr style={{ margin: "2rem 0" }} />
      <h1>Fellow souls & messages</h1>
      <p>
        <em>Find your people; nobody watches you do it.</em>
      </p>
      <p className="lore">
        Profiles are discoverable in the public directory above. Bonds are
        mutual consent between two identities; your connection graph, requests,
        blocks, and messages remain yours alone.
      </p>
      {m && <div className="notice">{m}</div>}

      <h3>Requests</h3>
      {requests.length === 0 && threads.requests.length === 0 && (
        <p className="lore">Nothing waits. Requests expire quietly after their window.</p>
      )}
      {requests.map((r) => (
        <div className="post souls-item" key={r.id}>
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
              Decline (free, quiet; they are not told)
            </button>
          </form>
        </div>
      ))}
      {threads.requests.map((t) => (
        <div className="post souls-item" key={t.id}>
          <div className="byline">
            <span className="pseudonym">{t.other?.displayName}</span>{" "}
            @{t.other?.handle} opened a conversation ·{" "}
            {t.lastMessageAt.toLocaleDateString()}
          </div>
          <div className="meta">
            A stranger&apos;s first message waits as a request; reading it
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
      <ul className="discussions souls-thread-list">
        {threads.inbox.map((t) => (
          <li key={t.id}>
            <Link href={`/dm/${t.id}`}>
              @{t.other?.handle}; {t.other?.displayName}
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
            message; the initiator pays, so spam prices itself out.
            Receiving and replying are free to the other side.
          </p>
          <button type="submit">Send · {(threadFee + messageFee).toFixed(2)} PC</button>
        </form>
      </details>

      <h3>Your fellow souls ({souls.length})</h3>
      <p className="lore">
        Visible to you alone. The platform never counts, ranks, or
        suggests souls; a friend graph is a fingerprint, so yours is
        never computed against.
      </p>
      <ul className="souls-list">
        {souls.map((s) => {
          const unseen = s.spiritActive;
          return (
            <li
              key={s.id}
              className={`soul-card${unseen ? " soul-unseen" : ""}`}
            >
              <span
                className={`presence-dot${unseen ? " unseen" : ""}`}
                aria-hidden="true"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="avatar-sm" src={`/img/${s.handle}/avatar`} alt="" />
              <Link href={`/souls/${s.handle}`} className="pseudonym">{s.displayName}</Link> @{s.handle}{" "}
              {unseen && <span className="lore">· offline</span>}{" "}
              <form action={submitReleaseBond} className="inline">
                <input type="hidden" name="otherProfileId" value={s.id} />
                <button type="submit">Release bond (quiet)</button>
              </form>
            </li>
          );
        })}
        {souls.length === 0 && <li className="lore">None yet; send a request below.</li>}
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
            decline; all free, and declines are silent. A declined or
            lapsed request holds a cooldown before you may ask again.
          </p>
          <button type="submit">Send request · {requestFee} PC</button>
        </form>
      </details>

      <h3>Blocked ({blockedProfiles.length})</h3>
      <p className="lore">
        One-way and private: a blocked soul cannot message or request
        you, and is never told.
      </p>
      <ul className="souls-list compact">
        {blockedProfiles.map((b) => (
          <li key={b.id} className="soul-card">
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

type DirectoryData = Awaited<ReturnType<typeof publicSoulDirectory>>;

function SoulDirectory({ directory }: { directory: DirectoryData }) {
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (directory.query) params.set("q", directory.query);
    if (page > 1) params.set("page", String(page));
    const suffix = params.toString();
    return `/souls${suffix ? `?${suffix}` : ""}`;
  };
  return (
    <section>
      <h1>Platform Souls Directory</h1>
      <p className="lore">
        Discover registered True Self and Alias profiles by name, @handle, location,
        or public bio. Presence, private connections, and messages never appear here.
      </p>
      <form method="get" className="inline" style={{ marginBottom: "1rem" }}>
        <input
          type="search"
          name="q"
          defaultValue={directory.query}
          placeholder="Find a soul by name, @handle, place, or interest"
          aria-label="Search the Platform Souls Directory"
          style={{ width: "min(32rem, 100%)" }}
        />{" "}
        <button type="submit">Search souls</button>
      </form>
      <p className="meta">
        {directory.total} discoverable profile{directory.total === 1 ? "" : "s"}
        {directory.query ? ` matching “${directory.query}”` : ""}
      </p>
      <ul className="souls-list soul-directory-grid">
        {directory.profiles.map((soul) => (
          <li key={soul.id} className="soul-card soul-directory-card">
            <img className="avatar-sm" src={`/img/${soul.handle}/avatar`} alt="" />
            <div>
              <Link href={`/souls/${soul.handle}`} className="pseudonym">
                {soul.displayName}
              </Link>{" "}
              <span className="lore">@{soul.handle}</span>
              <div className="meta">
                {soul.face === "TRUE_SELF" ? "◆ True Self" : "◇ Alias"}
                {soul.bioPlace ? ` · 📍 ${soul.bioPlace}` : ""}
              </div>
              {soul.bio && (
                <div className="meta soul-directory-bio">
                  {soul.bio.length > 150 ? `${soul.bio.slice(0, 150)}…` : soul.bio}
                </div>
              )}
            </div>
          </li>
        ))}
        {directory.profiles.length === 0 && (
          <li className="lore">No discoverable profiles match that search.</li>
        )}
      </ul>
      {directory.pageCount > 1 && (
        <nav className="sort-menu" aria-label="Platform Souls Directory pages">
          {directory.page > 1 && <Link href={pageHref(directory.page - 1)}>← Previous</Link>}
          <span>
            Page {directory.page} of {directory.pageCount}
          </span>
          {directory.page < directory.pageCount && (
            <Link href={pageHref(directory.page + 1)}>Next →</Link>
          )}
        </nav>
      )}
    </section>
  );
}
