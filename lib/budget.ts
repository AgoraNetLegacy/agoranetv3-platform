// Budget categories; the Constitution's must-guardrail, made structural
// (PHASE_8_7_SPEC.md §3, Slice 1).
//
// PLATFORM_CONSTITUTION Appendix A, must-guardrails: "The treasury MUST
// NOT spend outside budgeted categories." TREASURY_DASHBOARD_SPEC §1.3
// promises that rule is "rendered structurally: an outflow without a
// budget category cannot exist." Both were true as law and unbuilt as
// code until this module; outflows were hand-rolled at each call site,
// so there was nowhere for the rule to bind.
//
// The original shipped set is the three outflows TOKENOMICS_SPEC §3's
// treasury loop names:
//
//     moderation rewards · tribunal stipends · platform operations
//
// Nothing is invented here. "Cause funding" is deliberately ABSENT: the
// treasury has no such purpose in the ratified economics, and Fund
// Integrity's discretionary spending is sourced from the Community
// Endowment; a pool BESIDE the treasury (COMMUNITY_ENDOWMENT_SPEC),
// not a category inside it, and deliberately unratified pending counsel.
//
// The progressive token rail adds one mechanically constrained refund
// category. It can only unwind a failed Credit claim; it is not a new
// discretionary treasury purpose.

import type { DbOrTx, Tx } from "./db";

export const BUDGET_MODERATION_REWARDS = "moderation-rewards";
export const BUDGET_TRIBUNAL_STIPENDS = "tribunal-stipends";
export const BUDGET_PLATFORM_OPERATIONS = "platform-operations";
export const BUDGET_CREDIT_CLAIM_REFUNDS = "credit-claim-refunds";

/**
 * The shipped categories (TOKENOMICS §3's treasury loop plus the
 * mechanically constrained progressive-rail refund path).
 *
 * `cap: null` = uncapped. That is deliberate and not an oversight: these
 * three are service categories whose amounts are already rail-governed
 * per-action (a badge reward is priced by the rail, not by a budget).
 * FUND_INTEGRITY_SPEC §3.6 proposes promoting cap ceilings to Class 2;
 * that is a constitutional proposal, not ratified, and this phase does
 * not pre-empt it. The column exists so the guardrail has somewhere to
 * land without a migration; the rule does not exist yet. Flagged, not
 * invented (CLAUDE.md rule 1).
 */
export const SHIPPED_BUDGET_CATEGORIES = [
  {
    name: BUDGET_MODERATION_REWARDS,
    description:
      "Per-case Gratium for badge holders who resolve cases, and refunded flag deposits. The treasury's first funded public service: community self-governance paid by the protocol, not by any faction (TOKENOMICS §3).",
    cap: null,
  },
  {
    name: BUDGET_TRIBUNAL_STIPENDS,
    description:
      "Per-term Gratium for Tribunal members. Service to the platform is compensated, never charged (Constitution, Invariant 7).",
    cap: null,
  },
  {
    name: BUDGET_PLATFORM_OPERATIONS,
    description:
      "Running the commons: infrastructure, archival, and the costs of keeping the record permanent. No outflow exists under this category yet; it is seeded because TOKENOMICS §3 names it, so the table describes the ratified loop rather than only what code currently spends.",
    cap: null,
  },
  {
    name: BUDGET_CREDIT_CLAIM_REFUNDS,
    description:
      "Mechanical return of platform-held PC/G reserved for a testnet wallet transfer that reached a terminal failure. This cannot fund discretionary spending; it only unwinds the identity's own transfer reservation.",
    cap: null,
  },
] as const;

/**
 * Seed the ratified categories. Idempotent; safe on every boot and in
 * every test; updates descriptions in place so corpus edits propagate
 * without a migration, and never resurrects a category the community
 * has deactivated.
 */
export async function seedBudgetCategories(tx: Tx | DbOrTx): Promise<void> {
  for (const category of SHIPPED_BUDGET_CATEGORIES) {
    await (tx as Tx).budgetCategory.upsert({
      where: { name: category.name },
      create: {
        name: category.name,
        description: category.description,
        cap: category.cap,
      },
      // Deliberately does NOT touch `active`: deactivating a category is
      // a governance decision, and a redeploy must never quietly undo it.
      update: { description: category.description },
    });
  }
}
