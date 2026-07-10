import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Raw inspection page for the Civic Ledger — the public record, shown as
// it is. Not a dashboard (those arrive in Phase 7); a window. The ledger
// speaks only in pseudonyms and nullifiers, so showing it raw is safe by
// construction — and db:verify proves it stays that way.
export default async function LedgerPage() {
  const events = await db.ledgerEvent.findMany({
    orderBy: { seq: "desc" },
    take: 200,
  });
  const total = await db.ledgerEvent.count();

  return (
    <>
      <h1>The Civic Ledger</h1>
      <p className="lore">
        Append-only, hash-chained from GENESIS, pseudonym-only. {total} events;
        showing the most recent {events.length}. Raw inspection view — the
        transparency dashboards arrive in Phase 7.
      </p>
      {events.map((ev) => (
        <div className="post" key={ev.seq}>
          <div className="byline">
            <span className="pseudonym">#{ev.seq}</span> · {ev.eventType} ·{" "}
            {ev.actorType}
            {ev.actorId ? ` (${ev.actorId})` : ""} ·{" "}
            {ev.createdAt.toLocaleString()}
          </div>
          <div className="body" style={{ fontSize: "0.78rem", wordBreak: "break-all" }}>
            {ev.payload}
          </div>
          <div className="byline" style={{ wordBreak: "break-all" }}>
            hash {ev.entryHash.slice(0, 24)}… ← prev {ev.prevHash.slice(0, 24)}…
          </div>
        </div>
      ))}
    </>
  );
}
