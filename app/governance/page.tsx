import Link from "next/link";
import { db } from "@/lib/db";
import { PillarMark } from "@/components/Icon";
import { closeDuePolls } from "@/lib/polls";

export const dynamic = "force-dynamic";

// Polls & Governance, findable by name (PRESENTATION_SPEC §1.3): a
// direct index into the seven Governance rooms and the open public
// polls. Nothing here bypasses pillar parking or the sealed-tally
// rules — every link walks through the same doors as always.
export default async function GovernanceIndex() {
  await closeDuePolls(db);

  const [pillars, polls] = await Promise.all([
    db.pillar.findMany({ orderBy: { position: "asc" } }),
    db.poll.findMany({
      where: { visibilityScope: "public" },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { pillar: { select: { name: true, slug: true } } },
      take: 25,
    }),
  ]);

  return (
    <>
      <h1>Polls &amp; Governance</h1>
      <p>
        <em>Decide together, sealed until it&rsquo;s fair.</em> Ordinary
        polls take the commons&rsquo; temperature; governance polls bind.
        Governance tallies stay sealed until a candle-committed close
        nobody can time, one profile is one vote everywhere, and money
        never buys outcome weight.
      </p>

      <h3>The Governance rooms — one per pillar</h3>
      <p className="lore">
        Beyond each door, everything written is permanent public record.
        Permanence is a place you knowingly walk into.
      </p>
      <ul className="pillar-grid">
        {pillars.map((p) => (
          <li key={p.id} style={{ borderTop: `4px solid ${p.colorPrimary}` }}>
            <Link href={`/pillars/${p.slug}/governance`}>
              <PillarMark slug={p.slug} /> <strong>{p.name}</strong> governance
            </Link>
          </li>
        ))}
      </ul>

      <h3>Public polls</h3>
      <ul className="discussions">
        {polls.map((p) => (
          <li key={p.id}>
            <Link href={`/polls/${p.id}`}>{p.title}</Link>{" "}
            {p.isGovernance && <span className="badge permanent">Governance</span>}{" "}
            {p.status === "open" ? (
              <span className="badge permanent">
                {p.liveTally ? "Live tally" : "Sealed until close"}
              </span>
            ) : (
              <span className="badge locked">Closed</span>
            )}
            <div className="meta">
              <PillarMark slug={p.pillar.slug} /> {p.pillar.name} ·{" "}
              {p.mode === "public" ? "Public vote" : "Pseudonymous vote"}
            </div>
          </li>
        ))}
        {polls.length === 0 && <li className="lore">No public polls yet.</li>}
      </ul>
    </>
  );
}
