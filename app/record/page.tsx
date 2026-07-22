import Link from "next/link";
import { Icon } from "@/components/Icon";
import { LearnMore } from "@/components/LearnMore";

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
      <h1>
        The Public Record
        <LearnMore label="About the Public Record">
          <h4>The record nobody can rewrite — including us</h4>
          <p>
            Five doors into one promise: nothing that governs this
            platform, or accounts for it, is hidden behind a login.
            Reading every door is free, forever — no account needed.
          </p>
          <p>
            The <strong>ledger</strong> is the raw spine: every civic
            action, hash-chained and tamper-evident, anchored on-chain —
            a silent edit is structurally impossible, and corrections
            are new entries, never rewrites. <strong>Transparency</strong>{" "}
            shows where every unit of money went and what the operators
            did, including every rail the platform runs on — every
            number is data anyone can check, none of it a hidden
            constant. <strong>State of the Commons</strong> is the
            platform&rsquo;s health in numbers, with no behavioral
            profiles behind them — the platform doesn&rsquo;t have any.
          </p>
          <p>
            The <strong>Constitution</strong> holds the founding rails —
            what no ordinary vote can casually set aside — and{" "}
            <strong>the written rules</strong> are the moderation law:
            every ruling must cite a written rule; no rule, no penalty,
            ever. Radical transparency here means the record is not just
            published but <em>searchable</em> — civic records are one of
            search&rsquo;s nine lanes.
          </p>
        </LearnMore>
      </h1>
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
