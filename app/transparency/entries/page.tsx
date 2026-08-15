import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { KIND_CATEGORIES } from "@/lib/transparency";

export const dynamic = "force-dynamic";

// Drill-down (TREASURY_DASHBOARD §6.1, owner-ratified): the individual
// pseudonymous entries behind every dashboard figure; verification is
// real rather than theatrical. NO actor renders here, ever: economy
// rows' profile ids are Phase A operator space, and the dashboard never
// creates a correlation surface beyond what the public ledger exposes.
// Aggregate-only categories (stipends, rewards) have no drill-down at
// all; moderator anonymity beats itemization (§2.2).
export default async function EntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string }>;
}) {
  const { category, page } = await searchParams;
  if (!category) notFound();

  const kinds = Object.entries(KIND_CATEGORIES)
    .filter(([, info]) => info.category === category && !info.aggregateOnly)
    .map(([kind]) => kind);
  if (kinds.length === 0) notFound();

  const pageNum = Math.max(1, Number(page) || 1);
  const PER_PAGE = 100;
  const [entries, total] = await Promise.all([
    db.economyEntry.findMany({
      where: { kind: { in: kinds } },
      orderBy: { createdAt: "desc" },
      take: PER_PAGE,
      skip: (pageNum - 1) * PER_PAGE,
      select: {
        id: true,
        kind: true,
        currency: true,
        amount: true,
        refType: true,
        createdAt: true,
        fromTreasury: true,
        toTreasury: true,
      },
    }),
    db.economyEntry.count({ where: { kind: { in: kinds } } }),
  ]);

  return (
    <>
      <p>
        <Link href="/transparency">← The transparency dashboard</Link>
      </p>
      <h1>{category}</h1>
      <p className="lore">
        {total} entr{total === 1 ? "y" : "ies"}; pseudonymized: what moved
        and when, never who. Social-action fees are additionally blinded at
        the source (no counterparty reference exists on the row at all).
      </p>
      <table className="books">
        <thead>
          <tr>
            <th>When</th>
            <th>Kind</th>
            <th>Amount</th>
            <th>Direction</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td>{e.createdAt.toLocaleString()}</td>
              <td>{e.kind}</td>
              <td>
                {e.amount.toFixed(2)} {e.currency}
              </td>
              <td>
                {e.toTreasury ? "→ treasury" : e.fromTreasury ? "treasury →" : "issuance →"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="lore">
        {pageNum > 1 && (
          <Link href={`/transparency/entries?category=${encodeURIComponent(category)}&page=${pageNum - 1}`}>
            ← newer
          </Link>
        )}{" "}
        {pageNum * PER_PAGE < total && (
          <Link href={`/transparency/entries?category=${encodeURIComponent(category)}&page=${pageNum + 1}`}>
            older →
          </Link>
        )}
      </p>
    </>
  );
}
