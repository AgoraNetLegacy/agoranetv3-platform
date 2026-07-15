// The consent & disclosure architecture, single source of truth
// (ONBOARDING §4): every load-bearing disclosure has a named moment in
// the flow — nothing lives only in a document nobody reads. Blocking
// ones cannot be scrolled past; their acknowledgment is recorded
// (ConsentAck) and enforced where it matters (first post).
//
// Versions matter: an ack names the version it acknowledged. Bump a
// version and the flow re-presents it.

import { PHASE_A_DISCLOSURE } from "./gate";

export const CONSENT_VERSIONS = {
  permanence: "v1",
  constitution: "founding-draft-2026-07-07",
  // v2 (Phase 8.6 slice 4): the unlinkability item's language upgraded
  // honestly — the cryptographic enforcement now runs on public test
  // rails; the live ceremony's protection is still policy.
  "alias-disclosures": "phase-a-v2",
} as const;

export type ConsentKind = keyof typeof CONSENT_VERSIONS;

/** Stage 1 — the gate introduces itself (ambient, not blocking). */
export const GATE_INTRO = {
  substance:
    "Participation requires proving you're one real human — once. " +
    "AgoraNet never sees or stores your identity documents; verification " +
    "happens with an independent issuer and the proof lives on your " +
    "device. What you get: a voice that counts exactly once, in a " +
    "community with no bots. What it costs: a few minutes, and a wallet.",
  phaseA: PHASE_A_DISCLOSURE,
  interimIssuer:
    "INTERIM (Phase A): AgoraNet itself still plays the issuer's role " +
    "for the live gate — for now, you are trusting us with that too. " +
    "Two honest consequences: a lost credential cannot be recovered on " +
    "this interim path, and the interim issuer cannot detect a repeat " +
    "verification — nothing yet stops a soul from re-verifying into a " +
    "fresh start; a real identity partner closes that, and it gates " +
    "public launch. The real machinery is no longer a promise: an " +
    "Identus issuer runs on our test rails today (platform-operated, " +
    "test network) with the full credential ceremony working and " +
    "recovery proven. This notice steps down layer by layer as each " +
    "piece takes over the live path.",
};

/** Stage 2 — said plainly at verification (owner requirement 2026-07-07). */
export const VERIFICATION_FRESHNESS =
  "Humanity confirmation is not one-time. Periodic re-confirmation — " +
  "including occasional random prompts, always with the issuer, never " +
  "with the platform — keeps the promise that everyone here is a real, " +
  "current human. Governance voting requires a more recently confirmed " +
  "credential than ordinary participation.";

/** Stage 4.1 — permanence consent (BLOCKING, before the first post). */
export const PERMANENCE_CONSENT = {
  version: CONSENT_VERSIONS.permanence,
  text:
    "Some spaces on AgoraNet are permanent record. What you post in a " +
    "permanent space — the canonical question threads, every Governance " +
    "room — cannot be deleted, by you or by us. A short grace window " +
    "lets you repair typos, with the edit history visible; then your " +
    "words lock into the record. Your account can be deleted; your words " +
    "in permanent spaces cannot. If moderation removes rule-breaking " +
    "content, a tombstone naming the rule stays in its place — removal " +
    "is visible, never silent. Every permanent space is labeled at the " +
    "door and in the composer, so you always know which kind of room " +
    "you're standing in.",
};

/** Stage 4.2 — Constitution acknowledgment (BLOCKING). */
export const CONSTITUTION_ACK = {
  version: CONSENT_VERSIONS.constitution,
  summary:
    "The AgoraNet Constitution sets the rails this platform runs on: " +
    "seven invariants no vote can casually set aside (the pseudonym-only " +
    "ledger; one human, two unlinkable faces; no universal score; one " +
    "profile, one vote — never wealth; reading free, acting verified; " +
    "records that cannot be quietly rewritten; a community that inherits " +
    "the platform). Rules are enforced by randomly drawn moderators who " +
    "must cite a written rule, with appeals to a community Tribunal — " +
    "no rule, no punishment. By continuing you acknowledge the " +
    "Constitution as the terms of this space.",
};

/**
 * The Alias ceremony disclosures (BLOCKING at hatch — ONBOARDING §3.6,
 * DUAL_IDENTITY §7–8). The honest talk, at the exact moment it matters.
 */
export const ALIAS_DISCLOSURES = {
  version: CONSENT_VERSIONS["alias-disclosures"],
  items: [
    "What we guarantee: no database row, ledger entry, or public record " +
      "links your Alias to your True Self. During Phase A this is " +
      "operator policy, honestly disclosed — not yet math for the live " +
      "ceremony. The math itself is now real: a public Midnight testnet " +
      "contract enforces the same one-per-scope law with zero-knowledge " +
      "proofs; the ceremony cuts over when proving is consumer-ready.",
    "What we cannot protect you from: your own writing style " +
      "(stylometry is a mature research field), your own timing " +
      "patterns, and self-disclosure. If you say something as your " +
      "Alias that only your True Self would know, no system can help.",
    "The parking rule protects you: one face per pillar at a time, so " +
      "your two faces never appear side by side in the same room.",
    "The funding-trail rule: you never pay for Alias actions from " +
      "anything connected to your True Self. At launch, the platform " +
      "covers Alias-side fees entirely.",
    "Recovery is asymmetric, on purpose: a recovery path through your " +
      "identity would be a linkage channel. Guard your Alias access key " +
      "— if it's lost or stolen, the remedy is hatching a successor " +
      "(fee-gated, Light Score carries over in both directions, lineage " +
      "visible).",
    "Your Alias activates at a random moment in roughly the next few " +
      "days, alongside a cohort of others. Its profile will show only a " +
      "coarse join period. We never tell anyone — including you — the " +
      "exact moment in advance.",
    // Naming amendment, verbatim (ONBOARDING Stage 3.4, 2026-07-10):
    "Choose an Alias handle AND display name with no relation to your " +
      "True Self's — name similarity is self-deanonymization no " +
      "architecture can undo.",
  ],
};
