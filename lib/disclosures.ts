// The consent & disclosure architecture, single source of truth
// (ONBOARDING §4): every load-bearing disclosure has a named moment in
// the flow; nothing lives only in a document nobody reads. Blocking
// ones cannot be scrolled past; their acknowledgment is recorded
// (ConsentAck) and enforced where it matters (first post).
//
// Versions matter: an ack names the version it acknowledged. Bump a
// version and the flow re-presents it.

import { PHASE_A_DISCLOSURE } from "./gate";

export const CONSENT_VERSIONS = {
  // v2 (owner walkthrough, 2026-07-15): plain-language pass; the
  // consent a person signs must be readable by a person who just
  // arrived. Version bumps re-present the screens, by design.
  permanence: "v2",
  constitution: "founding-draft-2026-07-07-plain-v2",
  // v3 (owner walkthrough, 2026-08-15): separate the current guarantee
  // from the future testnet migration in plain language.
  "alias-disclosures": "phase-a-v3",
  // Profile imagery (PROFILE_PAGE_SPEC §4.5, owner-ruled 2026-07-22):
  // the Alias imagery warning; pixels out-fingerprint prose.
  "alias-imagery": "v1",
} as const;

/** The Alias imagery warning (PROFILE_PAGE_SPEC §4.5); blocking
 *  before an Alias's first upload, acknowledged once, ceremony-grade.
 *  The stylometry warning's precedent, applied to pixels: the platform
 *  cannot compare your two identities' images (and never will); this
 *  warning IS the protection. */
export const ALIAS_IMAGERY_WARNING = {
  items: [
    "A photograph is a stronger fingerprint than writing style. Reverse image search exists, and it is free.",
    "We strip hidden location and camera data from every upload; but nothing can strip what the photo shows: your appearance, your room, your street, your cat.",
    "For this identity, use artwork or abstraction. Never a photo of yourself or your surroundings; and never an image related, even loosely, to anything your other identity has ever used anywhere.",
  ],
} as const;

export type ConsentKind = keyof typeof CONSENT_VERSIONS;

/** Stage 1; the gate introduces itself (ambient, not blocking). */
export const GATE_INTRO = {
  substance:
    "Participation starts with an interim humanity check. For now, " +
    "AgoraNet operates the issuer and stores only a scrambled fingerprint " +
    "of the credential; we do not collect identity documents. This phase " +
    "reduces automated abuse and prevents one credential from being reused, " +
    "but it is not yet independent proof that one real human gets one voice. " +
    "What it costs: a few minutes, and a wallet.",
  phaseA: PHASE_A_DISCLOSURE,
  interimIssuer:
    "INTERIM (Phase A): AgoraNet itself still plays the issuer's role " +
    "for the live gate; for now, you are trusting us with that too. " +
    "Two honest consequences: a lost credential cannot be recovered on " +
    "this interim path, and the interim issuer cannot detect a repeat " +
    "verification; nothing yet stops a soul from re-verifying into a " +
    "fresh start; a real identity partner closes that, and it gates " +
    "public launch. The real machinery is no longer a promise: an " +
    "Identus issuer runs on our test rails today (platform-operated, " +
    "test network) with the full credential ceremony working and " +
    "recovery proven. This notice steps down layer by layer as each " +
    "piece takes over the live path.",
};

/** Stage 2; said plainly at verification (owner requirement 2026-07-07). */
export const VERIFICATION_FRESHNESS =
  "Humanity confirmation is not one-time. Periodic re-confirmation; " +
  "including occasional random prompts, always with the issuer, never " +
  "with the platform; keeps the promise that everyone here is a real, " +
  "current human. Governance voting requires a more recently confirmed " +
  "credential than ordinary participation.";

/** Stage 4.1; permanence consent (BLOCKING, before the first post).
 *  Plain-language pass: owner walkthrough finding, 2026-07-15;
 *  "canonical" is insider vocabulary; a consent screen is the wrong
 *  place for jargon. */
export const PERMANENCE_CONSENT = {
  version: CONSENT_VERSIONS.permanence,
  text:
    "Some spaces on AgoraNet are permanent record. What you post in a " +
    "permanent space; the platform's founding question threads, every " +
    "Governance room; cannot be deleted, by you or by us. A short " +
    "grace window lets you repair typos, with the edit history visible; " +
    "then your words lock into the record. Your account can be deleted; " +
    "your words in permanent spaces cannot. If moderation removes " +
    "rule-breaking content, a marker naming the broken rule stays in " +
    "its place; removal is visible, never silent. Every permanent " +
    "space is labeled at the door and in the composer, so you always " +
    "know which kind of room you're standing in.",
};

/** Stage 4.2; Constitution acknowledgment (BLOCKING).
 *  Plain-language pass: owner walkthrough findings, 2026-07-15; no
 *  jargon in a consent, moderators must be understood as community
 *  members, and "no rule, no punishment" needed unambiguous phrasing.
 *  The full text is one click away at /constitution (same finding). */
export const CONSTITUTION_ACK = {
  version: CONSENT_VERSIONS.constitution,
  summary:
    "The Constitution sets the rules of this space. By continuing, you " +
    "agree to these core promises:",
  items: [
    "Your public record shows only the name you choose; never your legal identity.",
    "One human may use one True Self and one Alias; the platform keeps them cryptographically separate.",
    "Light Score is AgoraNet's version of reputation: it reflects your standing in each pillar, never as one global ranking; your True Self and Alias standings never touch.",
    "One profile gets one vote.",
    "Money cannot buy an outcome or paid visibility.",
    "Reading is free. Acting requires passing the current interim humanity check.",
    "Permanent records cannot be quietly rewritten.",
    "The community inherits governance of the platform over time.",
  ],
  enforcement:
    "Written rules are enforced by randomly selected community members, not " +
    "staff moderators. Every ruling must cite the rule it enforces, and each " +
    "case has one appeal to a community Tribunal.",
};

/**
 * The Alias ceremony disclosures (BLOCKING at hatch; ONBOARDING §3.6,
 * DUAL_IDENTITY §7–8). The honest talk, at the exact moment it matters.
 */
export const ALIAS_DISCLOSURES = {
  version: CONSENT_VERSIONS["alias-disclosures"],
  items: [
    "Your Alias is kept separate from your True Self. In the live system, " +
      "we do not store a link between them in the database, ledger, or " +
      "public record. This separation is enforced by the platform's " +
      "current server rules; a separate Midnight testnet contract shows " +
      "the future cryptographic version, but it is not part of this live " +
      "ceremony yet.",
    "What we cannot protect you from: your own writing style " +
      "(stylometry is a mature research field), your own timing " +
      "patterns, and self-disclosure. If you say something as your " +
      "Alias that only your True Self would know, no system can help.",
    "Your identities use separate rooms. Each pillar allows only one of " +
      "your identities at a time. If you enter as your True Self, your Alias " +
      "must wait until you leave; the two can never appear there together. " +
      "A blocked-entry message is the privacy protection working, not an " +
      "error.",
    "Your True Self and Alias each have separate PollCoin and Gratium " +
      "balances. Alias activity uses the Alias balance; it never draws " +
      "from your True Self balance, and the balances are never merged.",
    "Recovery is asymmetric, on purpose: a recovery path through your " +
      "identity would be a linkage channel. Guard your Alias access key " +
      "; if it's lost or stolen, the remedy is hatching a successor " +
      "(fee-gated, Light Score carries over in both directions, lineage " +
      "visible).",
    // Naming amendment, verbatim (ONBOARDING Stage 3.4, 2026-07-10):
    "Choose an Alias handle AND display name with no relation to your " +
      "True Self's; name similarity is self-deanonymization no " +
      "architecture can undo.",
  ],
};
