import Link from "next/link";
import { Icon } from "@/components/Icon";

// The Public Record's own front door (owner walkthrough finding,
// 2026-07-15): "The Public Record" read as a clickable nav title but
// went nowhere, and its five sub-links were cramped into one small row.
// This page gives the title somewhere to go — five doors, each with a
// one-liner, in the same tile pattern /pillars already uses (pillar-grid
// + tile-title + hook) so the record shelf reads as one more room in the
// building, not a bolt-on.
export default function PublicRecordPage() {
  const doors = [
    {
      href: "/ledger",
      icon: "temple" as const,
      name: "The ledger",
      hook: "Every civic action, chained and tamper-evident — raw, unfiltered, live.",
    },
    {
      href: "/transparency",
      icon: "temple" as const,
      name: "Transparency",
      hook: "Where the money went, and what the operators did — checkable by anyone.",
    },
    {
      href: "/commons",
      icon: "sprout" as const,
      name: "State of the Commons",
      hook: "The platform's public health, in numbers — no behavioral profiles, ever.",
    },
    {
      href: "/constitution",
      icon: "temple" as const,
      name: "The Constitution",
      hook: "The founding rails — what no ordinary vote can casually set aside.",
    },
    {
      href: "/rules",
      icon: "badge" as const,
      name: "The written rules",
      hook: "What every ruling must cite — no rule, no penalty, ever.",
    },
  ];

  return (
    <>
      <h1>The Public Record</h1>
      <p>
        The record nobody can rewrite — including us. Five doors into the
        same promise: nothing that governs this platform, or accounts for
        it, is hidden behind a login.
      </p>
      <ul className="pillar-grid hub">
        {doors.map((d) => (
          <li key={d.href}>
            <Link href={d.href} className="tile-title">
              <Icon name={d.icon} /> <strong>{d.name}</strong>
            </Link>
            <div className="hook">{d.hook}</div>
          </li>
        ))}
      </ul>
    </>
  );
}
