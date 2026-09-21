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
  permanence: "v3",
  constitution: "founding-draft-2026-07-07-plain-v2",
  // v3 (owner walkthrough, 2026-08-15): separate the current guarantee
  // from the future testnet migration in plain language.
  "alias-disclosures": "phase-a-v4",
  // Profile imagery (PROFILE_PAGE_SPEC §4.5, owner-ruled 2026-07-22):
  // the Alias imagery warning; pixels out-fingerprint prose.
  "alias-imagery": "v2",
} as const;

/** The Alias imagery warning (PROFILE_PAGE_SPEC §4.5); blocking
 *  before an Alias's first upload, acknowledged once, ceremony-grade.
 *  The stylometry warning's precedent, applied to pixels: the platform
 *  cannot compare your two identities' images (and never will); this
 *  warning IS the protection. */
export const ALIAS_IMAGERY_WARNING = {
  items: [
    "A photograph identifies you far more reliably than your writing style does. Anyone who wants to can run it through a reverse image search in a few seconds, for free.",
    "We strip the hidden location and camera data out of every upload. What we cannot strip is whatever the picture actually shows, which may include your face, your home, the street outside it, or a pet somebody recognizes.",
    "For this identity, use artwork or something abstract. Do not use a photo of yourself or your surroundings, and do not reuse an image your other identity has posted anywhere, including a cropped or edited version of one.",
  ],
} as const;

export type ConsentKind = keyof typeof CONSENT_VERSIONS;

/** Stage 1; the gate introduces itself (ambient, not blocking).
 *
 * ONBOARDING §Stage 1 calls this "the platform's single most important
 * screen" and requires both halves: what you get AND what it costs. An
 * earlier draft carried only the cost, opening on a hedge and never
 * naming the payoff; a stranger read 280 words of qualification before
 * reaching a button. The Phase A honesty is specified as AMBIENT here
 * (acknowledged later, at Stage 2), so it is stated plainly in one line
 * and the full technical text sits one click away. Nothing is withheld;
 * the wall is. */
export const GATE_INTRO = {
  substance:
    "Acting here means proving once that you're a real human. What you " +
    "get: a voice that counts exactly once, in a place where nobody is " +
    "arguing with bots. What it costs: a few minutes, and a wallet. We " +
    "never ask for identity documents.",
  /** The Phase A operator-trust honesty, in one sentence a newcomer can
   *  actually read. The spec's own framing: trust us for now, verify it
   *  yourself later. The full disclosure follows it, on the same screen. */
  trustSummary:
    "One thing said plainly before you start: today, keeping your two " +
    "identities apart is our policy, enforced by our servers. It is not " +
    "yet cryptography you could check yourself. Trust us for now; verify " +
    "it yourself later. The details are worth reading.",
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
    "Some spaces on AgoraNet are permanent record: the platform's " +
    "founding question threads, and every Governance room. What you " +
    "post in one of those cannot be deleted afterwards, by you or by " +
    "us. There is a short grace window for fixing typos, with the edit " +
    "history left visible, and then your words lock. Deleting your " +
    "account will not remove them. If moderation takes down something " +
    "that broke a rule, a marker naming that rule stays where the " +
    "content was, so a removal is something you can see rather than " +
    "something that quietly happened. Permanent spaces are labeled at " +
    "the door and again in the composer, before you write in them.",
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
    "What we cannot protect you from is anything you give away " +
      "yourself. Writing style is the big one; stylometry is a mature " +
      "research field and it works. Posting at the same hours is " +
      "another. And if you mention something as your Alias that only " +
      "your True Self would know, nothing on our side can undo that.",
    "Your identities use separate rooms. Each pillar allows only one of " +
      "your identities at a time, so if you enter as your True Self, your " +
      "Alias has to wait until you leave. When you see a message saying " +
      "you cannot enter somewhere, that is the separation doing its job, " +
      "not something going wrong.",
    "Your True Self and Alias each have separate PollCoin and Gratium " +
      "balances. Alias activity uses the Alias balance; it never draws " +
      "from your True Self balance, and the balances are never merged.",
    "There is deliberately no recovery path for an Alias. Any such path " +
      "would have to run through your real identity, which would create " +
      "exactly the link this is built to prevent. So guard your Alias " +
      "access key. If it is lost or stolen, the remedy is hatching a " +
      "successor: that costs a fee, your Light Score carries over in " +
      "both directions, and the lineage stays visible.",
    // Naming amendment, verbatim (ONBOARDING Stage 3.4, 2026-07-10):
    "Choose an Alias handle AND display name with no relation to your " +
      "True Self's; name similarity is self-deanonymization no " +
      "architecture can undo.",
  ],
};
