import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PillarMark } from "@/components/Icon";
import { closeDuePolls } from "@/lib/polls";
import { activeFace } from "@/lib/webSession";
import { checkParking, BlockedPanel } from "@/app/parkingGate";
import { PollForm } from "@/app/polls/PollForm";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

// The Governance room; one per pillar, the flagship permanent space
// (DISCUSSIONS §8). Everything in this room is permanent record;
// governance polls are always sealed and close by candle (POLLS §8).
export default async function GovernanceRoom({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pillar = await db.pillar.findUnique({ where: { slug } });
  if (!pillar) notFound();

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

  await closeDuePolls(db);
  const [polls, discussions, viewer] = await Promise.all([
    db.poll.findMany({
      where: { pillarId: pillar.id, isGovernance: true },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { ballots: true } } },
    }),
    db.discussion.findMany({
      where: { pillarId: pillar.id, permanence: "permanent-governance" },
      orderBy: { createdAt: "desc" },
    }),
    activeFace(),
  ]);

  return (
    <>
      <p>
        <Link href={`/pillars/${pillar.slug}`}>
          ← <PillarMark slug={pillar.slug} /> {pillar.name}
        </Link>
      </p>
      <h1><Icon name="temple" /> {pillar.name}; Governance room</h1>
      <div className="door-banner">
        <Icon name="temple" /> <strong>You are standing in the permanent room.</strong>{" "}
        Everything here is permanent record. Governance polls are always
        sealed; no running tally for anyone; and close by candle: the
        true end is drawn at random inside the final stretch, committed in
        advance, revealed with the results.
      </div>

      <h3>Governance polls</h3>
      <ul className="discussions">
        {polls.map((p) => (
          <li key={p.id}>
            <Link href={`/polls/${p.id}`}>{p.title}</Link>{" "}
            {p.status === "open" ? (
              <span className="badge permanent">Sealed · candle close</span>
            ) : (
              <span className="badge locked">
                Closed · {p.outcome === "passed" ? "passed" : p.outcome === "no-consensus" ? "no consensus" : "results in"}
              </span>
            )}
            <div className="meta">
              {p.mode === "public" ? "Public vote" : "Pseudonymous vote"} ·{" "}
              {p.status === "open"
                ? `voting until ~${p.nominalCloseAt.toLocaleString()}`
                : `${p._count.ballots} ballot(s)`}
            </div>
          </li>
        ))}
        {polls.length === 0 && <li>No governance polls yet; open the first.</li>}
      </ul>

      {discussions.length > 0 && (
        <>
          <h3>Governance discussions</h3>
          <ul className="discussions">
            {discussions.map((d) => (
              <li key={d.id}>
                <Link href={`/d/${d.id}`}>{d.title}</Link>{" "}
                <span className="badge permanent">Permanent record</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>Open a governance poll</h3>
      {viewer ? (
        <PollForm
          pillarId={pillar.id}
          isGovernance={true}
          backTo={`/pillars/${pillar.slug}/governance`}
        />
      ) : (
        <p className="interim-note">
          Reading is free.{" "}
          <Link href={`/verify?returnTo=${encodeURIComponent(`/pillars/${pillar.slug}/governance`)}`}>
            Verify once to act →
          </Link>
        </p>
      )}
    </>
  );
}
