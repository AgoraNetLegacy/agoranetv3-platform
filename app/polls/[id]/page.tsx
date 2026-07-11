import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { closeDuePolls, visibleTally, candleCommitmentFor } from "@/lib/polls";
import { activeFace } from "@/lib/webSession";
import { checkParking, BlockedPanel } from "@/app/parkingGate";
import { submitVote, startPollDiscussion } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function PollPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const { id } = await params;
  const { m } = await searchParams;

  await closeDuePolls(db);
  const poll = await db.poll.findUnique({
    where: { id },
    include: {
      pillar: true,
      options: { orderBy: { position: "asc" } },
      discussions: true,
      ballots: poll_ballots_include(),
    },
  });
  if (!poll) notFound();

  // Circle-restricted polls live inside the members' room: read access
  // is the room's (CIRCLES §7), and the parking rule does NOT apply —
  // a Circle is not a pillar surface, and both of a soul's faces may
  // legitimately be members (§7 accepts that cost by design).
  let circle: { id: string; name: string; status: string } | null = null;
  if (poll.visibilityScope === "circle" && poll.circleRef) {
    circle = await db.circle.findUnique({ where: { id: poll.circleRef } });
    const viewerFace = await activeFace();
    const { roomAccess } = await import("@/lib/circles");
    const access = circle
      ? await roomAccess(db, circle, viewerFace?.id ?? null)
      : { read: false };
    if (!circle || !access.read) notFound();
  } else {
    const parking = await checkParking(poll.pillarId);
    if (parking.state === "blocked") {
      return (
        <BlockedPanel
          pillarName={poll.pillar.name}
          pillarId={poll.pillarId}
          pillarSlug={poll.pillar.slug}
          heldByHandle={parking.heldByHandle}
          heldByFace={parking.heldByFace}
        />
      );
    }
  }

  const [viewer, tally] = await Promise.all([activeFace(), visibleTally(db, poll.id)]);
  const open = poll.status === "open";
  const countedTotal = poll.ballots.filter((b) => b.counted).length;
  const candleVerifies =
    poll.candleCommitment && !open
      ? candleCommitmentFor(poll.trueCloseAt, poll.candleSalt ?? "") === poll.candleCommitment
      : null;

  return (
    <>
      <p>
        {circle ? (
          <Link href={`/circles/${circle.id}/room`}>← Members&apos; room — {circle.name}</Link>
        ) : (
          <Link
            href={
              poll.isGovernance
                ? `/pillars/${poll.pillar.slug}/governance`
                : `/pillars/${poll.pillar.slug}`
            }
          >
            ← {poll.pillar.icon} {poll.pillar.name}
            {poll.isGovernance ? " · Governance room" : ""}
          </Link>
        )}
      </p>
      <h1>{poll.title}</h1>
      {circle && (
        <p>
          <span className="badge locked">
            Circle-restricted — visible to {circle.name}&apos;s members; per-profile
            vote, like every poll
          </span>{" "}
          {poll.circleAction && (
            <span className="badge permanent">
              Binding decision: executes at close if adopted
            </span>
          )}
        </p>
      )}
      {poll.description && <p>{poll.description}</p>}

      {/* The mode, stated plainly before anything else (POLLS §2). */}
      <p>
        {poll.mode === "public" ? (
          <span className="badge permanent">
            PUBLIC VOTE — your choice is visibly attached to this poll's
            record
          </span>
        ) : (
          <span className="badge locked">
            PSEUDONYMOUS VOTE — only the aggregate is ever visible, never
            who chose what
          </span>
        )}{" "}
        {poll.isGovernance && (
          <span className="badge permanent">Governance · permanent record</span>
        )}
      </p>

      {m && <div className="notice">{m}</div>}

      {open ? (
        <>
          <div className="door-banner">
            {poll.liveTally && !poll.isGovernance ? (
              <>Live tally enabled by the creator (ordinary poll).</>
            ) : (
              <>
                🔒 <strong>Sealed until close.</strong> No running tally is
                shown to anyone — gauge the room by its Discussion, not a
                scoreboard.
              </>
            )}{" "}
            {poll.isGovernance ? (
              <>
                Candle close: voting stays open until about{" "}
                {poll.nominalCloseAt.toLocaleString()}, but the true end was
                drawn at random inside the final stretch and committed in
                advance (
                <code>{poll.candleCommitment?.slice(0, 16)}…</code>). Votes
                cast after the hidden moment won't count — vote early.
              </>
            ) : (
              <>Voting until {poll.nominalCloseAt.toLocaleString()}.</>
            )}
          </div>

          {viewer ? (
            <form action={submitVote} className="composer">
              <input type="hidden" name="pollId" value={poll.id} />
              {poll.options.map((o) => (
                <label key={o.id} style={{ display: "block" }}>
                  <input
                    type={poll.type === "multi" ? "checkbox" : "radio"}
                    name="optionIds"
                    value={o.id}
                    required={poll.type !== "multi"}
                  />{" "}
                  {o.label}
                  {tally && ` — ${tally.get(o.id) ?? 0} so far`}
                </label>
              ))}
              <button type="submit">
                Cast vote as {viewer.displayName} @{viewer.handle}
              </button>
            </form>
          ) : (
            <p className="interim-note">
              Reading is free.{" "}
              <Link href={`/verify?returnTo=${encodeURIComponent(`/polls/${poll.id}`)}`}>
                Verify once to vote →
              </Link>
            </p>
          )}
        </>
      ) : (
        <>
          <h3>Results</h3>
          {poll.type === "consensus" && (
            <div className="notice">
              {poll.outcome === "passed"
                ? `Consensus reached: the leading option cleared the ${Math.round((poll.consensusThreshold ?? 0) * 100)}% threshold.`
                : `No consensus reached — the ${Math.round((poll.consensusThreshold ?? 0) * 100)}% threshold was not met. That isn't a dead end:`}
              {poll.outcome === "no-consensus" && viewer && !circle && (
                <form action={startPollDiscussion} className="inline">
                  <input type="hidden" name="pollId" value={poll.id} />
                  {" "}
                  <button type="submit" className="linklike">
                    open a Discussion to explore why →
                  </button>
                </form>
              )}
            </div>
          )}
          {poll.options.map((o) => {
            const count = o.tally ?? 0;
            const pct = countedTotal > 0 ? Math.round((count / countedTotal) * 100) : 0;
            return (
              <div key={o.id} style={{ margin: "0.4rem 0" }}>
                {o.label} — <strong>{count}</strong> ({pct}%)
                <div
                  style={{
                    background: "var(--accent)",
                    height: 8,
                    borderRadius: 4,
                    width: `${Math.max(pct, 2)}%`,
                    maxWidth: "100%",
                  }}
                />
              </div>
            );
          })}
          <p className="lore">
            {countedTotal} counted ballot(s)
            {poll.ballots.length > countedTotal
              ? ` · ${poll.ballots.length - countedTotal} arrived after the candle and did not count`
              : ""}
            {" · "}
            <a href={`/polls/${poll.id}/export`}>export results (JSON)</a>
          </p>

          {poll.candleCommitment && (
            <div className="notice">
              🕯 <strong>Candle reveal:</strong> the true close was{" "}
              {poll.trueCloseAt.toLocaleString()} — committed before any vote
              existed as <code>{poll.candleCommitment.slice(0, 16)}…</code>{" "}
              and now revealed.{" "}
              {candleVerifies
                ? "The reveal matches the commitment ✓ (verify it yourself: sha256(trueCloseAt|salt))."
                : "⚠ THE REVEAL DOES NOT MATCH THE COMMITMENT."}
            </div>
          )}

          {poll.mode === "public" ? (
            <>
              <h3>The public record — who voted how (this poll only)</h3>
              <ul>
                {poll.ballots
                  .filter((b) => b.counted)
                  .map((b) => (
                    <li key={b.id}>
                      {b.voterDisplayName} @{b.voterHandle} —{" "}
                      {b.choices
                        .map(
                          (c) => poll.options.find((o) => o.id === c.optionId)?.label
                        )
                        .join(", ")}
                    </li>
                  ))}
              </ul>
              <p className="interim-note">
                Public means public per-poll: this record lives here and on
                the ledger — the platform never compiles voting dossiers
                across polls.
              </p>
            </>
          ) : (
            <p className="interim-note">
              Pseudonymous vote: ballots are nullifier-keyed — the aggregate
              above is the whole story, and the ledger carries a
              tamper-evidence hash of the sealed ballots.
            </p>
          )}
        </>
      )}

      <h3>Deliberation</h3>
      {circle ? (
        <p className="lore">
          The deliberation is the members&apos; room — a Circle poll needs no
          public context space.
        </p>
      ) : (
        <>
          {poll.discussions.length > 0 ? (
            <ul className="discussions">
              {poll.discussions.map((d) => (
                <li key={d.id}>
                  <Link href={`/d/${d.id}`}>{d.title}</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="lore">No Discussion attached yet.</p>
          )}
          {viewer && poll.discussions.length === 0 && (
            <form action={startPollDiscussion}>
              <input type="hidden" name="pollId" value={poll.id} />
              <button type="submit">Start the Discussion for this poll</button>
            </form>
          )}
        </>
      )}
    </>
  );
}

function poll_ballots_include() {
  return { include: { choices: true } } as const;
}
