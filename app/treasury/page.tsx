import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// The raw treasury inspection page — the Phase 4 checkpoint surface
// (BUILD_ORDER: "watches the treasury fill on a raw inspection page;
// dashboard comes later"). Aggregates only: flows are grouped by kind,
// and no entry here ever names a soul — vote fees and flag deposits
// especially must not become who-did-what records.
export default async function TreasuryPage() {
  const [balances, entries] = await Promise.all([
    db.treasuryBalance.findMany(),
    db.economyEntry.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const byKind = new Map<string, { currency: string; total: number; count: number }>();
  for (const e of entries) {
    if (!e.toTreasury && !e.fromTreasury) {
      // profile↔profile (tips) and issuance→profile (grants) flows are
      // not treasury lines; grants show under issuance below.
      continue;
    }
    const key = `${e.kind}|${e.currency}`;
    const row = byKind.get(key) ?? { currency: e.currency, total: 0, count: 0 };
    row.total += e.toTreasury ? e.amount : -e.amount;
    row.count += 1;
    byKind.set(key, row);
  }
  const issuance = entries.filter((e) => !e.fromProfileId && !e.fromTreasury && e.toProfileId);
  const issuedByCurrency = new Map<string, number>();
  for (const e of issuance) {
    issuedByCurrency.set(e.currency, (issuedByCurrency.get(e.currency) ?? 0) + e.amount);
  }

  const pc = balances.find((b) => b.currency === "PC")?.amount ?? 0;
  const g = balances.find((b) => b.currency === "G")?.amount ?? 0;

  return (
    <>
      <h1>The Treasury — raw inspection</h1>
      <p className="lore">
        Every fee and penalty lands here; moderation and tribunal service
        are paid from here (TOKENOMICS §3). This is the raw view — the
        transparency dashboard arrives in Phase 7. Aggregates only: no
        line on this page names a soul.
      </p>

      <div className="pillar-grid" style={{ marginBottom: "1rem" }}>
        <div className="ceremony">
          <h2>{pc.toFixed(2)} PC</h2>
          <p className="lore">PollCoin held</p>
        </div>
        <div className="ceremony">
          <h2>{g.toFixed(2)} G</h2>
          <p className="lore">Gratium held</p>
        </div>
      </div>

      <h3>Inflows by kind</h3>
      <table style={{ width: "100%", fontSize: "0.9rem", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
            <th>Kind</th>
            <th>Currency</th>
            <th>Flows</th>
            <th>Net to treasury</th>
          </tr>
        </thead>
        <tbody>
          {Array.from(byKind.entries())
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([key, row]) => (
              <tr key={key} style={{ borderBottom: "1px solid var(--line)" }}>
                <td>{key.split("|")[0]}</td>
                <td>{row.currency}</td>
                <td>{row.count}</td>
                <td>{row.total.toFixed(2)}u</td>
              </tr>
            ))}
          {byKind.size === 0 && (
            <tr>
              <td colSpan={4} className="lore">
                No flows yet — the first fee fills the first row.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h3>Issuance (the internal era's accounted faucet)</h3>
      <ul className="lore">
        {Array.from(issuedByCurrency.entries()).map(([currency, total]) => (
          <li key={currency}>
            {total.toFixed(2)} {currency} issued as Welcome/hatch/milestone
            grants ({issuance.filter((e) => e.currency === currency).length}{" "}
            grant(s))
          </li>
        ))}
        {issuance.length === 0 && <li>No grants issued yet.</li>}
      </ul>
      <p className="interim-note">
        Conservation holds by construction and db:verify re-derives it:
        every balance equals the sum of its entries; the treasury equals
        the sum of what flowed in minus what flowed out. All amounts are
        the ratified v0 TEST SCHEDULE — rails, expiring at the Phase 9
        real-money re-review.
      </p>
    </>
  );
}
