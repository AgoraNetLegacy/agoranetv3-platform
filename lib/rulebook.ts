// The content moderation rulebook as data; complete v1 legislation
// (Moderation/CONTENT_MODERATION_RULEBOOK.md, all placeholders resolved
// by owner 2026-07-07/09). Flags cite a rule id; rulings (Phase 5) cite
// a rule id. Amendments happen through governance, as ledger events;
// this seed is the shipped law, summarized; the rulebook document is
// the authoritative text.

export interface RuleSeed {
  id: string;
  tier: 1 | 2 | 3;
  title: string;
  summary: string;
}

export const RULEBOOK: RuleSeed[] = [
  // Tier 1; Routine (single badge-holder ruling)
  { id: "R1.1", tier: 1, title: "Spam & flooding", summary: "Bulk, repetitive, or automated posting; unsolicited promotion; reply-flooding that drowns a conversation." },
  { id: "R1.2", tier: 1, title: "Deliberate disruption", summary: "Sustained derailing of a Discussion's stated topic; bad-faith noise intended to make a space unusable (disagreement is protected)." },
  { id: "R1.3", tier: 1, title: "Mechanic misuse", summary: "Abusing platform mechanics contrary to their labeled purpose: source-tag spam, tip-farming schemes, meaningless attestation marks." },
  // Tier 2; Serious (permanent-space removals need 3-moderator majority)
  { id: "R2.1", tier: 2, title: "Harassment & personal attacks", summary: "Targeting the person rather than the argument, sustained or repeated; dogpiling; following a soul across Discussions to attack them." },
  { id: "R2.2", tier: 2, title: "Impersonation", summary: "Presenting as another person, organization, or as a platform role (moderator, tribunal, official account)." },
  { id: "R2.3", tier: 2, title: "False human-made attestation", summary: "Marking substantially AI-generated content as human-made (DISCUSSIONS §10.1; the AI-assisted vs. AI-made boundary governs)." },
  { id: "R2.4", tier: 2, title: "Vouched-falsehood pattern", summary: "A pattern of staking one's reputation on content later removed as false or rule-breaking. Patterns only; a single wrong vouch is never an infraction." },
  { id: "R2.5", tier: 2, title: "Bad-faith flagging pattern", summary: "Repeatedly flagging rule-compliant content, especially against the same target. Patterns only, per the chilling-effect guard." },
  { id: "R2.6", tier: 2, title: "Coordinated inauthentic behavior", summary: "Organized brigading of flags, tips, polls, or discussions; astroturfing; engagement rings." },
  { id: "R2.7", tier: 2, title: "Attested-action fraud", summary: "Logging or co-signing a Circle action that did not occur; reputation-staked lying on the civic record." },
  { id: "R2.8", tier: 2, title: "Targeted dehumanization", summary: "Attacking people's humanity based on who they are. Harsh criticism of ideas, beliefs, institutions, and behaviors stays protected." },
  { id: "R2.9", tier: 2, title: "Scams & exploitation", summary: "Unsolicited commercial exploitation, pyramid/referral schemes, deceptive solicitation (outright fraud escalates to R3.4)." },
  { id: "R2.10", tier: 2, title: "Pornographic content", summary: "Sexually explicit material, platform-wide. Clinical, educational, or public-health discussion of sexuality is never removable under this rule; NCII and minors escalate to R3.3." },
  { id: "R2.11", tier: 2, title: "Gratuitous violence", summary: "Graphic violence for shock or celebration. Real-world documentation is protected with a blur-with-warning label." },
  // Tier 3; Severe (Tribunal or expedited multi-review; full-hide lane)
  { id: "R3.1", tier: 3, title: "Doxxing & de-anonymization", summary: "Publishing or hunting private/identifying information; including any attempt to link or speculate about which profiles share a human." },
  { id: "R3.2", tier: 3, title: "Credible threats & incitement", summary: "Threats of violence against identifiable people or groups; incitement to physical harm." },
  { id: "R3.3", tier: 3, title: "Illegal content", summary: "Content illegal in the operating jurisdiction; CSAM is removed immediately and reported, with no review-lane visibility. Criminal Activity Protocol applies." },
  { id: "R3.4", tier: 3, title: "Fraud & phishing", summary: "Active attempts to steal credentials, funds, or identities." },
  { id: "R3.5", tier: 3, title: "Vote & ledger manipulation", summary: "Technical or coordinated attacks on Polls, nullifier mechanics, attestation systems, or the civic ledger." },
  { id: "R3.6", tier: 3, title: "Badge abuse", summary: "Malicious rulings; using workbench access to fish for information; trading rulings for anything." },
  { id: "R3.7", tier: 3, title: "Ban evasion", summary: "Attempting to circumvent an active suspension or ban." },
  { id: "R3.8", tier: 3, title: "Platform attacks", summary: "Malware, exploits, denial-of-service behavior, security probing without authorization." },
];
