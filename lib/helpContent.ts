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
  /** Optional in-app doors this article should point at. */
  links?: { href: string; label: string }[];
}

export const HELP_CATEGORIES = [
  "Getting started",
  "Your two faces",
  "Finding things",
  "Money & fees",
  "The record",
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
      "From the credential you register your True Self: your signed public face, with its own @handle and access key. The access key is how this browser signs your face in; also shown once, also unrecoverable if lost. Save both somewhere real.",
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
    summary: "The Humanity Credential and each face's access key are shown once and never recoverable.",
    body: [
      "The platform never stores your secrets in a readable form; only hashes. That is a feature: nobody can take from the platform what the platform does not hold. The cost is honest and permanent: a lost secret is gone.",
      "You hold two kinds of secret. Your Humanity Credential is the passport; it proves one-real-human at ceremonies like hatching an Alias. Each face's access key is a house key; it signs that face into a browser.",
      "Losing an access key means that face can never be signed in anywhere new. Losing the credential means no new ceremonies; though faces already signed in keep working. Write them down somewhere real the moment they are shown.",
    ],
  },
  {
    slug: "two-faces",
    title: "True Self and Alias; one human, two faces",
    category: "Your two faces",
    summary: "Every human gets exactly one of each; the platform never stores a link between them.",
    body: [
      "Your True Self is the face you sign; your Alias is for what you can't afford to sign; the argument that could cost you professionally, the report you can't put your name to, the struggle you won't wear publicly.",
      "Every human gets exactly one Alias, enforced by a blind check: the platform can tell someone is trying twice without learning who. No record anywhere connects your two faces; not in the database, not in the ledger, not in search. That unlinkability is why the Alias ceremony asks for your Humanity Credential instead of your signed-in account.",
      "A new Alias is available immediately but starts invisible to the community. You decide when to make it public using the visibility control. The room's color always tells you whether you are using your True Self or Alias.",
    ],
    links: [{ href: "/alias", label: "The Alias ceremony" }],
  },
  {
    slug: "switching-faces",
    title: "Switching faces; the bubble",
    category: "Your two faces",
    summary: "Sign each face in once per browser; after that, switching is one click.",
    body: [
      "Your True Self and Alias each use their own access key at /login. Sign in to each one once per browser; after that, both identities appear in the profile bubble at the bottom-right.",
      "To switch identities, open the profile bubble and select True Self or Alias. Switching ends the current identity's pillar sessions, so it is always clear which identity is acting.",
    ],
    links: [{ href: "/login", label: "Sign in a face" }],
  },
  {
    slug: "search",
    title: "Search; nine kinds of thing, one box",
    category: "Finding things",
    summary: "Content, souls, places, canon, records, polls, sources, help; same results for everyone.",
    body: [
      "The one box at /search finds nine kinds of thing: content (Discussions, replies, Circle pages, Chamber storefronts), souls by @handle or display name, your own fellow souls, places, the pillars and canon, civic records, polls, cited sources, and help.",
      "Ranking is published and identical for everyone: match quality plus substance signals like participants and citations. Never views, never dwell time, never personalization; same query, same results, for every soul. Your search history is stored per-face, visible to you alone, deletable one-by-one or all at once, and never used to rank anything.",
      "Never in the index: direct messages, workshop and members'-room interiors, moderator identities, and anything that could bridge a soul's two faces.",
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
    category: "Finding things",
    summary: "Assembled only from sources you picked; the machine never watches you to guess.",
    body: [
      "The feed on your dashboard carries only what you chose to follow; pillars, Discussions, Circles. The machine never watches your behavior to guess what you want; if you didn't choose a source, it cannot appear.",
      "It is per-face: your True Self and your Alias each keep their own list, because a shared list would be a bridge between them. Signed-out readers see the open lens instead; one stream ranked by a published formula, the same for everyone.",
    ],
    links: [{ href: "/feed/sources", label: "Choose what feeds you" }],
  },
  {
    slug: "money",
    title: "PollCoin, Gratium, and fees",
    category: "Money & fees",
    summary: "Two currencies, published rails, and an economy that cannot sell attention.",
    body: [
      "The platform runs on two internal currencies: PollCoin (PC) and Gratium (G). New faces hatch with a grant of each, so nobody is born traceable by poverty and first actions are free.",
      "Fees and deposits are the platform's real throttle; they make floods expensive while a deliberating human never notices them. Every number is a rail: published, bounded, and poll-adjustable by the community. The full table lives on the transparency page; searching the help lane also surfaces individual rails.",
      "The economy cannot sell attention because it never captures attention: no views, no dwell time, no engagement metrics exist anywhere in the system.",
    ],
    links: [{ href: "/transparency", label: "Every rail, published" }],
  },
  {
    slug: "permanence",
    title: "Permanent record vs author-deletable",
    category: "The record",
    summary: "Some rooms are written in ink; the room always tells you before you speak.",
    body: [
      "Some spaces on AgoraNet are permanent: what you post there enters the public record by content hash, anchored on-chain, and nobody; including the platform; holds a pen that can rewrite it. Other spaces are author-deletable: you can remove your own words later.",
      "The permanence badge is a cross-theme constant; the same amber in every room, on every face; because some truths outrank identity. You will always see it before you post, never after.",
      "Display names can change; the permanent record keeps the name a thing was written under. That, too, is the point: the record nobody can rewrite includes us.",
    ],
    links: [{ href: "/record", label: "The Public Record" }],
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
