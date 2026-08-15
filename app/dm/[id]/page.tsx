import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import { readThread, DM_PHASE_A_DISCLOSURE } from "@/lib/dm";
import { getRail } from "@/lib/rails";
import {
  submitDmMessage,
  submitDmReport,
  submitThreadMute,
  submitThreadDelete,
  submitDeclineThread,
} from "@/app/actions";

export const dynamic = "force-dynamic";

// A DM thread (FELLOW_SOULS §5): private, encrypted, readable only by
// its two members; never rendered to anyone else, never public record.

export default async function DmThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const { id } = await params;
  const { m } = await searchParams;
  const viewer = await activeFace();
  if (!viewer) notFound();

  const result = await readThread(db, { threadId: id, profileId: viewer.id });
  if (!result.ok) notFound();
  const { thread, messages } = result;
  const [messageFee, rules] = await Promise.all([
    getRail(db, "dm.messageFee"),
    db.rule.findMany({ orderBy: { id: "asc" } }),
  ]);
  const isIncomingRequest = thread.status === "request" && !thread.viewerIsInitiator;
  const canReply = !(thread.status === "request" && thread.viewerIsInitiator);

  return (
    <>
      <p>
        <Link href="/souls">← Fellow souls &amp; messages</Link>
      </p>
      <h1>
        @{thread.otherHandle}; {thread.otherDisplayName}
      </h1>
      <div className="notice">🔐 {DM_PHASE_A_DISCLOSURE}</div>
      {m && <div className="notice">{m}</div>}
      {thread.status === "request" && (
        <div className="notice">
          {isIncomingRequest
            ? "A stranger's request: replying opens the thread; declining closes it quietly. Both are free."
            : "Your message waits with the request; one voice, once, until they answer."}
        </div>
      )}

      {messages.map((msg) => (
        <div className="post" key={msg.id}>
          <div className="byline">
            <span className="pseudonym">
              {msg.mine ? "You" : `@${thread.otherHandle}`}
            </span>{" "}
            · {msg.createdAt.toLocaleString()}
          </div>
          <div className="body">{msg.body}</div>
          {!msg.mine && (
            <details>
              <summary>Report this message</summary>
              <form action={submitDmReport} className="composer">
                <input type="hidden" name="messageId" value={msg.id} />
                <input type="hidden" name="threadId" value={thread.id} />
                <p className="interim-note">
                  Recipient-side reveal: this one message&apos;s words are
                  disclosed to a random adjudicator as evidence; nothing
                  else in the thread. The standard flag path applies:
                  refundable deposit, rule citation, anonymous ruling.
                </p>
                <select name="ruleId" required defaultValue="">
                  <option value="" disabled>
                    Which rule is alleged?
                  </option>
                  {rules.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id}; {r.title}
                    </option>
                  ))}
                </select>{" "}
                <input name="note" placeholder="Optional note for the reviewer" />{" "}
                <button type="submit">Reveal &amp; report</button>
              </form>
            </details>
          )}
        </div>
      ))}
      {messages.length === 0 && (
        <p className="lore">Nothing here (or deleted for you).</p>
      )}

      {canReply && (
        <>
          <h3>Reply{isIncomingRequest ? "; replying opens the thread" : ""}</h3>
          <form action={submitDmMessage} className="composer">
            <input type="hidden" name="threadId" value={thread.id} />
            <textarea name="body" required placeholder="Your words; encrypted at rest." />
            <button type="submit">Send · {messageFee} PC</button>
          </form>
        </>
      )}

      <div style={{ margin: "1rem 0" }}>
        <form action={submitThreadMute} className="inline">
          <input type="hidden" name="threadId" value={thread.id} />
          <input type="hidden" name="muted" value={thread.muted ? "0" : "1"} />
          <button type="submit">{thread.muted ? "Unmute" : "Mute"} thread</button>
        </form>{" "}
        <form action={submitThreadDelete} className="inline">
          <input type="hidden" name="threadId" value={thread.id} />
          <button type="submit">Delete for me (their copy is theirs)</button>
        </form>{" "}
        {isIncomingRequest && (
          <form action={submitDeclineThread} className="inline">
            <input type="hidden" name="threadId" value={thread.id} />
            <button type="submit">Decline request</button>
          </form>
        )}
      </div>
    </>
  );
}
