// The support library (owner directive 2026-07-21): a growing shelf of
// help documents and how-tos, reached from the profile bubble's Support
// door. Content lives here as data; same pattern as pillar/domain
// editorial; so articles are versioned with the code, render without a
// CMS, and can later be fed to the search index's "help" lane.

export interface HelpArticle {
  slug: string;
  title: string;
  category: HelpCategory;
  /** One line under the title in the library list. */
  summary: string;
  /** Paragraphs, rendered in order. Keep each one plain prose. */
  body: string[];
  /** Search and helpdesk vocabulary, including common user phrasing. */
  keywords?: string[];
  /** Approved article revision shown to readers and the helpdesk. */
  version?: string;
  updatedAt?: string;
  /** A direct escalation boundary when self-service must stop. */
  escalateWhen?: string;
  /** Optional in-app doors this article should point at. */
  links?: { href: string; label: string }[];
}

export const HELP_CATEGORIES = [
  "Getting started",
  "Your two identities",
  "Using AgoraNet",
  "Money, fees & treasury",
  "Privacy, safety & rules",
  "Troubleshooting",
] as const;
export type HelpCategory = (typeof HELP_CATEGORIES)[number];

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "verify-once",
    title: "Verify once, act forever",
    category: "Getting started",
    summary: "Reading is free for everyone; acting requires proving you're one real human, once.",
    body: [
      "Everything on AgoraNet can be read without an account; search, Discussions, the Public Record, poll results. Reading is free, forever, and nobody watches you do it.",
      "Acting; posting, voting, joining Circles; requires passing the gate once: the ceremony at /verify proves you are one real human and hands you a Humanity Credential. That credential is the root of everything else; the platform stores only a hash of it, so it is shown to you exactly once.",
      "From the credential you register your True Self: your signed public identity, with its own @handle and access key. The access key is how this browser signs that identity in; also shown once, also unrecoverable if lost. Save both somewhere real.",
    ],
    links: [
      { href: "/verify", label: "The gate ceremony" },
      { href: "/constitution", label: "The constitution" },
    ],
  },
  {
    slug: "what-to-save",
    title: "Your two codes; what to save, and what loss means",
    category: "Getting started",
    summary: "The Humanity Credential and each identity's access key are shown once and never recoverable.",
    body: [
      "The platform never stores your secrets in a readable form; only hashes. That is a feature: nobody can take from the platform what the platform does not hold. The cost is honest and permanent: a lost secret is gone.",
      "You hold two kinds of secret. Your Humanity Credential is the passport; it proves one-real-human at ceremonies like hatching an Alias. Each identity's access key is a house key; it signs that identity into a browser.",
      "Losing an access key means that identity can never be signed in anywhere new. Losing the credential means no new ceremonies; though identities already signed in keep working. Write them down somewhere real the moment they are shown.",
    ],
  },
  {
    slug: "two-identities",
    title: "True Self and Alias; one human, two identities",
    category: "Your two identities",
    summary: "Every human gets exactly one of each; the platform never stores a link between them.",
    body: [
      "Your True Self is the identity you sign publicly. Every user can also have one Alias for sensitive conversations, personal experiences, or arguments they do not want tied to their public name.",
      "Every human gets exactly one Alias, enforced by a blind check: the platform can tell someone is trying twice without learning who. No record anywhere connects your two identities; not in the database, not in the ledger, not in search. That unlinkability is why the Alias ceremony asks for your Humanity Credential instead of your signed-in account.",
      "A new Alias is available immediately but starts invisible to the community. You decide when to make it public using the visibility control. The room's color always tells you whether you are using your True Self or Alias.",
    ],
    links: [{ href: "/alias", label: "The Alias ceremony" }],
  },
  {
    slug: "switching-identities",
    title: "Switching identities; the profile menu",
    category: "Your two identities",
    summary: "Sign each identity in once per browser; after that, switching is one click.",
    body: [
      "Your True Self and Alias each use their own access key at /login. Sign in to each one once per browser; after that, both identities appear in the profile bubble at the bottom-right.",
      "To switch identities, open the profile bubble and select True Self or Alias. Switching ends the current identity's pillar sessions, so it is always clear which identity is acting.",
    ],
    links: [{ href: "/login", label: "Sign in an identity" }],
  },
  {
    slug: "search",
    title: "Search; nine kinds of thing, one box",
    category: "Using AgoraNet",
    summary: "Content, souls, places, canon, records, polls, sources, help; same results for everyone.",
    body: [
      "The one box at /search finds nine kinds of thing: content (Discussions, replies, Circle pages, Chamber storefronts), souls by @handle or display name, your own fellow souls, places, the pillars and canon, civic records, polls, cited sources, and help.",
      "Ranking is published and identical for everyone: match quality plus substance signals like participants and citations. Never views, never dwell time, never personalization; same query, same results, for every soul. Your search history is stored per identity, visible to you alone, deletable one-by-one or all at once, and never used to rank anything.",
      "Never in the index: direct messages, workshop and members'-room interiors, moderator identities, and anything that could bridge a soul's two identities.",
    ],
    links: [
      { href: "/search", label: "Search" },
      { href: "/search/about", label: "How results are ranked" },
      { href: "/search/history", label: "Your search history" },
    ],
  },
  {
    slug: "your-feed",
    title: "Your feed; chosen sources only",
    category: "Using AgoraNet",
    summary: "Assembled only from sources you picked; the machine never watches you to guess.",
    body: [
      "The feed on your dashboard carries only what you chose to follow; pillars, Discussions, Circles. The machine never watches your behavior to guess what you want; if you didn't choose a source, it cannot appear.",
      "It is private to each identity: your True Self and your Alias each keep their own list, because a shared list would be a bridge between them. Signed-out readers see the open lens instead; one stream ranked by a published formula, the same for everyone.",
    ],
    links: [{ href: "/feed/sources", label: "Choose what feeds you" }],
  },
  {
    slug: "money",
    title: "PollCoin, Gratium, and fees",
    category: "Money, fees & treasury",
    summary: "Two currencies, published rails, and an economy that cannot sell attention.",
    body: [
      "The platform runs on two internal currencies: PollCoin (PC) and Gratium (G). New identities hatch with a grant of each, so nobody is born traceable by poverty and first actions are free.",
      "Fees and deposits are the platform's real throttle; they make floods expensive while a deliberating human never notices them. Every number is a rail: published, bounded, and poll-adjustable by the community. The full table lives on the transparency page; searching the help lane also surfaces individual rails.",
      "The economy cannot sell attention because it never captures attention: no views, no dwell time, no engagement metrics exist anywhere in the system.",
    ],
    links: [{ href: "/transparency", label: "Every rail, published" }],
  },
  {
    slug: "permanence",
    title: "Permanent record vs author-deletable",
    category: "Privacy, safety & rules",
    summary: "Some rooms are written in ink; the room always tells you before you speak.",
    body: [
      "Some spaces on AgoraNet are permanent: what you post there enters the public record by content hash, anchored on-chain, and nobody; including the platform; holds a pen that can rewrite it. Other spaces are author-deletable: you can remove your own words later.",
      "The permanence badge is a cross-theme constant; the same amber in every room, on every identity; because some truths outrank identity. You will always see it before you post, never after.",
      "Display names can change; the permanent record keeps the name a thing was written under. That, too, is the point: the record nobody can rewrite includes us.",
    ],
    links: [{ href: "/record", label: "The Public Record" }],
  },
  {
    slug: "verification-troubleshooting",
    title: "Verification is pending, rejected, or interrupted",
    category: "Troubleshooting",
    summary: "Resume safely, understand the current test-rail limits, and know when a human must review the issue.",
    keywords: ["verification failed", "verification pending", "stuck onboarding", "issuer", "proof of humanity"],
    body: [
      "Start from the gate again in the same browser. A page refresh or closed tab does not create a second identity; incomplete ceremonies simply return to the last safe boundary.",
      "If the gate reports an error, copy the non-secret error code and the stage where it happened. Never send your Humanity Credential, access key, wallet seed phrase, or private key to support.",
      "A verification decision that requires review cannot be changed by the helpdesk. Open a support case so a human can inspect the safe diagnostic record.",
    ],
    escalateWhen: "The same verification step fails twice, the issuer reports a rejection, or you suspect your credential was exposed.",
    links: [{ href: "/verify", label: "Return to the gate" }],
  },
  {
    slug: "onboarding-interrupted",
    title: "Onboarding was interrupted",
    category: "Getting started",
    summary: "Return to the journey without sharing or recreating secrets unnecessarily.",
    keywords: ["onboarding stuck", "continue onboarding", "closed browser", "resume", "start over"],
    body: [
      "Return to the gate in the same browser. AgoraNet will carry forward any completed server-side stage and will never ask support to reconstruct a secret that was shown once.",
      "If you already created an identity and saved its access key, use Sign in instead of beginning again. If a one-time secret was shown but not saved, read the recovery-boundary article before taking another action.",
    ],
    links: [
      { href: "/verify", label: "Resume onboarding" },
      { href: "/login", label: "Sign in" },
    ],
  },
  {
    slug: "values-seed",
    title: "The values seed and your first action",
    category: "Getting started",
    summary: "Seven small answers orient your experience; they are not a universal score.",
    keywords: ["values seed", "seven questions", "first action", "orientation"],
    body: [
      "The values seed asks one question from each pillar. It gives your new identity a starting orientation and helps relevant parts of the commons become visible.",
      "It is not a test, personality label, or cross-profile score. Each identity has its own answers. Completing onboarding carries you back to the action that brought you to the gate.",
    ],
  },
  {
    slug: "wallet-connection",
    title: "Wallet connection troubleshooting",
    category: "Troubleshooting",
    summary: "Check the selected network, wallet approval, and connector before opening a case.",
    keywords: ["wallet not connecting", "Lace", "CIP-30", "preprod", "wrong network", "wallet error"],
    body: [
      "AgoraNet's current chain features use Cardano test rails. Confirm that Lace is installed, unlocked, and set to the network shown by the platform. Then reload the page and approve the connection in the wallet window.",
      "A wallet address or transaction hash may be shared in a support case when needed. A seed phrase, spending password, signing key, or private key must never be shared.",
    ],
    escalateWhen: "The wallet remains unavailable after reload, the network is correct, and the wallet itself shows no pending approval.",
  },
  {
    slug: "lost-keys",
    title: "Lost keys and recovery boundaries",
    category: "Your two identities",
    summary: "Understand what can be recovered, what cannot, and how to report a suspected compromise.",
    keywords: ["lost key", "lost credential", "seed phrase", "recover account", "compromised", "stolen wallet"],
    body: [
      "AgoraNet cannot read or resend a Humanity Credential or identity access key because it stores only their hashes. An Alias deliberately has no True-Self-routed recovery path; creating one would become a correlation path.",
      "If you still have a signed-in browser, do not sign out until you understand the consequences. If you suspect compromise, stop using the affected key and open a critical support case. Support can explain and preserve evidence, but cannot promise to reverse an irreversible action.",
    ],
    escalateWhen: "A key may be compromised, funds may be at risk, or you are unsure whether an existing signed-in session can be preserved.",
  },
  {
    slug: "discussions",
    title: "Discussions, replies, and sources",
    category: "Using AgoraNet",
    summary: "Join a conversation, understand permanence, and attach sources honestly.",
    keywords: ["post", "reply", "discussion", "citation", "source", "permanent"],
    body: [
      "Public Discussions and replies can be read by everyone. Acting requires an active verified identity and passes through the same gate as every other write.",
      "Before posting, read the permanence badge. Source objects preserve the cited URL and let search find every public conversation using that source.",
    ],
    links: [{ href: "/discussions", label: "Browse Discussions" }],
  },
  {
    slug: "polls-voting",
    title: "Polls and voting",
    category: "Using AgoraNet",
    summary: "How ordinary and governance polls work, including fees and sealed closes.",
    keywords: ["poll", "vote", "ballot", "sealed tally", "candle close", "vote fee"],
    body: [
      "Polls use one-person rules enforced at the gate. A vote fee is a participation cost, never vote weight; paying more never creates more influence.",
      "Some polls conceal the live tally or use a candle close to reduce bandwagoning and last-second manipulation. The poll page states the applicable rules before a ballot is cast.",
    ],
    links: [{ href: "/governance", label: "Polls & Governance" }],
  },
  {
    slug: "circles",
    title: "Circles and membership",
    category: "Using AgoraNet",
    summary: "Public storefronts help discovery; members' rooms stay inside the Circle.",
    keywords: ["circle", "join circle", "members room", "place", "initiative"],
    body: [
      "A Circle is a place for coordinated work. Its public page can appear in search, while its members' room never enters the public index.",
      "Joining, leaving, offers, actions, and attestations are performed by the active identity. Check the identity theme before acting.",
    ],
    links: [{ href: "/circles", label: "Browse Circles" }],
  },
  {
    slug: "fellow-souls-dms",
    title: "Fellow souls and direct messages",
    category: "Using AgoraNet",
    summary: "Connections and messages are private to the active identity and absent from public search.",
    keywords: ["friend", "fellow soul", "dm", "message", "connection request", "inbox"],
    body: [
      "Fellow-soul relationships and direct-message threads belong to one identity. They never bridge to the other identity and never appear in public search.",
      "A stranger message begins as a request and carries the published opening cost. A recipient can report the relevant excerpt as evidence; the rest of the thread does not become public.",
    ],
    links: [{ href: "/souls", label: "Fellow Souls & Messages" }],
  },
  {
    slug: "report-content",
    title: "Report content or behavior",
    category: "Privacy, safety & rules",
    summary: "Use the in-product report path for moderation; use Support for technical or safety help.",
    keywords: ["report", "harassment", "abuse", "unsafe", "flag", "moderation"],
    body: [
      "Use the report control beside the content or message whenever possible. It preserves the exact item and sends only the evidence needed for review.",
      "For immediate safety, privacy exposure, or a report control that does not work, open a high-priority support case. Do not copy sensitive material into a public Discussion.",
    ],
    escalateWhen: "There is a safety threat, privacy exposure, account compromise, or the normal report path is unavailable.",
    links: [{ href: "/rules", label: "Read the moderation rules" }],
  },
  {
    slug: "moderation-appeals",
    title: "Moderation review and appeals",
    category: "Privacy, safety & rules",
    summary: "Support can explain the process, but only the authorized moderation path can change an outcome.",
    keywords: ["moderation", "appeal", "strike", "ruling", "case"],
    body: [
      "Moderation outcomes are made through the platform's rule-bound adjudication process. The helpdesk can explain a rule or help with a broken appeal form; it cannot change a ruling.",
      "Use the appeal control attached to the case when available. A support case may preserve a technical problem, but it does not replace the appeal itself.",
    ],
    escalateWhen: "The appeal control is unavailable or technically fails before its deadline.",
    links: [{ href: "/rules", label: "The rulebook" }],
  },
  {
    slug: "privacy-profile-boundaries",
    title: "Privacy and profile boundaries",
    category: "Privacy, safety & rules",
    summary: "Support remains scoped to the active identity and never uses help-seeking as a reputation signal.",
    keywords: ["privacy", "alias link", "cross persona", "support history", "search history"],
    body: [
      "A helpdesk conversation or case is scoped to the identity active when it is created. Support does not search for, infer, or reveal another persona.",
      "Help-seeking is never an input to Light Score, feed ranking, search ranking, moderation selection, or civic standing. Diagnostic context is limited to the current feature, stage, non-secret error code, and client version.",
    ],
  },
  {
    slug: "donations-treasury",
    title: "Donations and the treasury",
    category: "Money, fees & treasury",
    summary: "Follow public flows and understand the difference between internal balances and test-rail transactions.",
    keywords: ["donation", "treasury", "balance", "funds", "transaction", "dPOLL"],
    body: [
      "The transparency surface shows published rails and treasury records. Current internal balances and test-rail assets are labeled honestly; one must not be mistaken for the other.",
      "For a transaction problem, preserve the public transaction hash and the exact time. Never send a seed phrase or signing key. Missing-value reports require human review.",
    ],
    escalateWhen: "A confirmed transaction is absent from the platform, a balance changed unexpectedly, or compromise is suspected.",
    links: [
      { href: "/transparency", label: "Transparency" },
      { href: "/treasury", label: "Treasury" },
    ],
  },
  {
    slug: "transaction-pending",
    title: "A transaction is pending or failed",
    category: "Troubleshooting",
    summary: "Check network and chain status, then preserve the transaction hash for support.",
    keywords: ["transaction pending", "transaction failed", "tx hash", "chain", "balance missing"],
    body: [
      "Confirm that the wallet and platform are using the same test network. A submitted transaction may remain pending while the network confirms it; a wallet rejection means it was not submitted.",
      "If a transaction hash exists, keep it. If no hash exists, record the non-secret error text and the action you attempted. Never retry a value-moving action repeatedly without first checking whether the earlier transaction landed.",
    ],
    escalateWhen: "A confirmed transaction is not reflected, the balance is unexpected, or repeated attempts could duplicate the action.",
  },
  {
    slug: "browser-technical-help",
    title: "Browser and connection troubleshooting",
    category: "Troubleshooting",
    summary: "Safe first checks for loading, session, and feature errors.",
    keywords: ["page not loading", "technical help", "browser error", "session", "stuck", "network error"],
    body: [
      "Refresh once, confirm the browser is online, and retry the exact action once. If the issue involves a wallet, unlock the wallet and check its selected network.",
      "Do not clear cookies or sign out if you may have lost an access key; an existing signed-in session may be valuable. Open support first and describe the screen, action, and non-secret error code.",
    ],
    escalateWhen: "The same action fails twice, the page cannot load, or clearing local state could strand an identity.",
  },
  {
    slug: "known-issues",
    title: "Known issues and service status",
    category: "Troubleshooting",
    summary: "Check whether a platform or test-rail incident already explains the problem.",
    keywords: ["known issue", "outage", "status", "down", "service unavailable"],
    body: [
      "Known issues are published here when an active incident affects more than one soul. Each notice states the affected feature, first observed time, current workaround, and resolution status.",
      "No active incident is listed in this build. If you are seeing a repeatable failure, ask the helpdesk or open a support case so it can be compared with other reports.",
    ],
  },
  {
    slug: "contact-support",
    title: "Open a support request",
    category: "Troubleshooting",
    summary: "What to include, what never to send, and what happens after submission.",
    keywords: ["contact support", "support ticket", "help request", "human", "case"],
    body: [
      "Describe what you expected, what happened, the current screen or onboarding stage, and any non-secret error code. A screenshot is useful only after checking that it contains no credential, access key, seed phrase, private message, or unrelated personal information.",
      "You will receive a case reference. The case is scoped to the active identity; a guest provides a reply email explicitly. Support can investigate and explain, but consequential changes remain with the authorized identity, moderation, security, or treasury process.",
    ],
    escalateWhen: "Self-service did not resolve the issue or any high-risk condition applies.",
  },
];

export function helpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}

export function helpByCategory(): Map<HelpCategory, HelpArticle[]> {
  const map = new Map<HelpCategory, HelpArticle[]>();
  for (const cat of HELP_CATEGORIES) map.set(cat, []);
  for (const article of HELP_ARTICLES) map.get(article.category)!.push(article);
  return map;
}
