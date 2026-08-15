import Link from "next/link";
import { db } from "@/lib/db";
import { Icon } from "@/components/Icon";

// The published rulebook, readable by anyone (owner walkthrough finding,
// 2026-07-15): "published rules" must mean FINDABLE rules. Every
// moderation ruling on this platform cites one of these by number; no
// rule, no penalty; and only a governance poll can change them. Until
// now the full list rendered only inside the signed-in moderation
// workbench; the law a person answers to must be readable before they
// ever act.
export default async function RulesPage() {
  const rules = await db.rule.findMany({ orderBy: { id: "asc" } });
  const tiers: Record<number, { name: string; blurb: string }> = {
    1: {
      name: "Tier 1; Routine",
      blurb:
        "Handled by one randomly drawn community member citing the rule; consequences follow the published ladder.",
    },
    2: {
      name: "Tier 2; Serious",
      blurb:
        "Heavier consequences; permanent-space removals need a majority of drawn reviewers, never one person alone.",
    },
    3: {
      name: "Tier 3; Severe",
      blurb: "The gravest category; suspensions and bans can only come from the Tribunal.",
    },
  };
  return (
    <>
      <h1>
        <Icon name="badge" /> The written rules
      </h1>
      <p>
        Nobody on AgoraNet can be punished except under a rule on this
        page, and every ruling must cite the rule it enforces; no rule,
        no penalty. The people who apply these rules are community
        members drawn at random for short terms (there are no staff
        moderators), and the only way this list changes is a governance
        poll: the community writes its own law. The authority for all of
        it is <Link href="/constitution">the Constitution</Link>.
      </p>
      {[1, 2, 3].map((tier) => (
        <section key={tier}>
          <h3>{tiers[tier].name}</h3>
          <p className="lore">{tiers[tier].blurb}</p>
          <ul className="discussions">
            {rules
              .filter((r) => r.tier === tier)
              .map((r) => (
                <li key={r.id}>
                  <strong>
                    {r.id}; {r.title}
                  </strong>
                  <div className="meta">{r.summary}</div>
                </li>
              ))}
          </ul>
        </section>
      ))}
      <p className="lore">
        A reviewer who finds that no written rule fits an item cannot
        punish it; the case instead becomes a signal to the community
        that a rule may be missing. Rules are general or they are not
        rules: no rule may target a person or a case.
      </p>
    </>
  );
}
