import { db } from "@/lib/db";
import { computeBooks } from "@/lib/transparency";

export const dynamic = "force-dynamic";

// Standard-format export (TREASURY_DASHBOARD §3; the POLLS results
// export precedent): the current books plus the snapshot history, CSV.
export async function GET() {
  const books = await computeBooks(db);
  const snapshots = await db.treasurySnapshot.findMany({ orderBy: { day: "asc" } });

  const lines: string[] = [];
  lines.push("section,category,pc,g,entries");
  lines.push(`balances,treasury,${books.balances.PC},${books.balances.G},`);
  for (const [section, totals] of [
    ["inflow", books.inflows],
    ["outflow", books.outflows],
    ["issuance", books.issuance],
  ] as const) {
    for (const [category, t] of Object.entries(totals)) {
      lines.push(`${section},"${category.replace(/"/g, '""')}",${t.PC},${t.G},${t.entries}`);
    }
  }
  lines.push("");
  lines.push("snapshot_day,taken_at,treasury_pc,treasury_g");
  for (const s of snapshots) {
    const b = JSON.parse(s.balances) as { PC: number; G: number };
    lines.push(`${s.day},${s.takenAt.toISOString()},${b.PC},${b.G}`);
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=agoranet-transparency.csv",
    },
  });
}
