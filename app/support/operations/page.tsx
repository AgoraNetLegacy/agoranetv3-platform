import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import { SUPPORT_CATEGORIES, SUPPORT_SEVERITIES } from "@/lib/support";
import {
  getActiveSupportOperator,
  listSupportCasesForOperator,
  SUPPORT_CASE_STATUSES,
  supportCaseReference,
} from "@/lib/supportOperations";

export const dynamic = "force-dynamic";

export default async function SupportOperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; severity?: string; category?: string; assignment?: "mine" | "unassigned" | "all" }>;
}) {
  const face = await activeFace();
  if (!face) redirect("/login");
  const operator = await getActiveSupportOperator(db, face.id);
  if (!operator) notFound();
  const filters = await searchParams;
  const cases = await listSupportCasesForOperator(db, operator, filters);

  return (
    <main className="support-ops">
      <div className="support-ops-heading">
        <div>
          <p className="eyebrow">Restricted operations</p>
          <h1>Support queue</h1>
          <p className="lore">Signed in as @{operator.profile.handle} · {operator.role}. Access is scoped to this profile.</p>
        </div>
        <Link href="/support">Public help →</Link>
      </div>

      <div className="notice">
        Internal workspace. Never paste credentials, access keys, seed phrases, private keys, or unrelated identity data into a case.
      </div>

      <form method="get" className="support-ops-filters">
        <label>Status<select name="status" defaultValue={filters.status ?? ""}><option value="">All</option>{SUPPORT_CASE_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Severity<select name="severity" defaultValue={filters.severity ?? ""}><option value="">All</option>{SUPPORT_SEVERITIES.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Category<select name="category" defaultValue={filters.category ?? ""}><option value="">All</option>{SUPPORT_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Assignment<select name="assignment" defaultValue={filters.assignment ?? "all"}><option value="all">All</option><option value="mine">Mine</option><option value="unassigned">Unassigned</option></select></label>
        <button type="submit">Apply filters</button>
      </form>

      <p className="lore">{cases.length} visible case{cases.length === 1 ? "" : "s"}. Ordinary agents do not receive sensitive cases.</p>
      <div className="support-ops-table-wrap">
        <table className="support-ops-table">
          <thead><tr><th>Case</th><th>Status</th><th>Severity</th><th>Category</th><th>Assigned</th><th>Updated</th></tr></thead>
          <tbody>
            {cases.map((item) => (
              <tr key={item.id}>
                <td><Link href={`/support/operations/${item.id}`}><strong>{supportCaseReference(item.id)}</strong><span>{item.subject}</span></Link></td>
                <td>{item.status}</td><td>{item.severity}</td><td>{item.category}</td>
                <td>{item.assignedOperator ? `@${item.assignedOperator.profile.handle}` : "Unassigned"}</td>
                <td>{item.updatedAt.toLocaleString()} · {item._count.internalNotes} note{item._count.internalNotes === 1 ? "" : "s"}</td>
              </tr>
            ))}
            {cases.length === 0 && <tr><td colSpan={6}>No support cases match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
