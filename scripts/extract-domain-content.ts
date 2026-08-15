// Extract the domain layer from the spec corpus (Phase 7).
//
// The dashboard spec's content inventory (§7) maps every dashboard element
// to its source document; this script performs that mapping mechanically;
// parsing each pillar's `_breakdown.md` domain sections VERBATIM into
// `lib/domainContent.generated.ts`, and the mechanism documents into
// `lib/mechanismDocs.generated.ts`. Content is ported, never paraphrased;
// the generator fails loudly on any structural surprise rather than
// guessing.
//
// Run (one-time per corpus change):
//   CORPUS="$HOME/Desktop/Agoranetv3" npx tsx scripts/extract-domain-content.ts
//
// The generated files are committed; the repo stays self-contained and
// the diff shows exactly what content the corpus contributed.
//
// PROVENANCE NOTE (flagged in DECISIONS_PENDING): the Compassion and Hope
// breakdowns predate the per-domain "Opening Question" template the other
// five carry. Their 16 questions are DRAFTED here in the ratified style
// (marked provenance "derived-draft"), pending owner ratification; canon
// law already provides the amendment path ("question wording may evolve
// later; every change becomes a ledger event", lib/canon.ts).

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CORPUS = process.env.CORPUS ?? join(process.env.HOME ?? "", "Desktop", "Agoranetv3");
const P7 = join(CORPUS, "7 Pillars");

interface SourceSpec {
  slug: string;
  breakdown: string;
  mechanisms: { slug: string; title: string; file: string }[];
}

const SOURCES: SourceSpec[] = [
  {
    slug: "compassion",
    breakdown: join(P7, "compassion", "compassion_breakdown.md"),
    mechanisms: [
      { slug: "fof", title: "Fight-or-Flight: The Biology of Co-Regulation", file: join(P7, "compassion", "FoF.md") },
      { slug: "trauma", title: "Trauma: The Psychology of Broken Safety", file: join(P7, "compassion", "Trauma.md") },
    ],
  },
  {
    slug: "hope",
    breakdown: join(P7, "Hope", "Hope_breakdown.md"),
    mechanisms: [
      { slug: "reward-engine", title: "The Reward Engine: Dopamine and Directed Effort", file: join(P7, "Hope", "RewardEngine.md") },
      { slug: "learned-helplessness", title: "Learned Helplessness: The Psychology of Surrendered Agency", file: join(P7, "Hope", "LearnedHelplessness.md") },
    ],
  },
  {
    slug: "justice",
    breakdown: join(P7, "Justice", "justice_breakdown.md"),
    mechanisms: [
      { slug: "fairness-sense", title: "The Fairness Sense: The Biology of Reciprocity", file: join(P7, "Justice", "FairnessSense.md") },
      { slug: "moral-injury", title: "Moral Injury: The Psychology of Betrayed Trust", file: join(P7, "Justice", "MoralInjury.md") },
    ],
  },
  {
    slug: "freedom",
    breakdown: join(P7, "Freedom", "freedom_breakdown.md"),
    mechanisms: [
      { slug: "reactance", title: "Reactance: The Biology of Resistance", file: join(P7, "Freedom", "Reactance.md") },
      { slug: "institutionalization", title: "Institutionalization: The Psychology of Dependency", file: join(P7, "Freedom", "Institutionalization.md") },
    ],
  },
  {
    slug: "unity",
    breakdown: join(P7, "Unity", "unity_breakdown.md"),
    mechanisms: [
      { slug: "group-bond", title: "The Group Bond: The Biology of Belonging", file: join(P7, "Unity", "GroupBond.md") },
      { slug: "scapegoating", title: "Scapegoating: The Psychology of Redirected Blame", file: join(P7, "Unity", "Scapegoating.md") },
    ],
  },
  {
    slug: "harmony",
    breakdown: join(P7, "Harmony", "harmony_breakdown.md"),
    mechanisms: [
      { slug: "allostasis", title: "Allostasis: The Biology of Continuous Correction", file: join(P7, "Harmony", "Allostasis.md") },
      { slug: "allostatic-overload", title: "Allostatic Overload: The Psychology of Accumulated Pressure", file: join(P7, "Harmony", "AllostaticOverload.md") },
    ],
  },
  {
    slug: "agoranet",
    breakdown: join(P7, "The Agora", "agora_breakdown.md"),
    mechanisms: [],
  },
];

// The 16 drafted Opening Questions (provenance "derived-draft"; see the
// header note). Keyed by pillar slug + domain position.
const DRAFTED_OPENING_QUESTIONS: Record<string, Record<number, string>> = {
  compassion: {
    1: "When you last needed care, did the system treat you as a person or as a billing event; and what would healthcare paid for health itself actually look like?",
    2: "When someone in your community has their worst hour, why is an armed response the default; and what would it take for the first person through the door to be trained to help?",
    3: "If everyone in the treatment chain is paid when a crisis repeats and no one is paid when it ends, how does recovery ever become the product?",
    4: "If the justice system were paid only when people never came back, what would it do differently on day one; and why isn't it doing that now?",
    5: "Why does growing old here mean disappearing from the neighborhood; and what would it take for our elders to remain neighbors instead of occupants?",
    6: "If housing people is provably cheaper than managing their homelessness, what exactly are we buying when we choose the more expensive cruelty?",
    7: "Why does pollution always land where resistance is cheapest; and what would clean air and water as a birthright, not a zip-code lottery, require of us?",
    8: "As essential life moves online, who around you is quietly being locked out; and what would technology built as an open elevator, not a gate, look like?",
  },
  hope: {
    1: "When did your vote last turn into something you could physically touch; and what would it take for that to be a normal experience instead of a memory?",
    2: "If wages alone can no longer buy a stake in the future, where does a person actually begin to own a piece of the value they create?",
    3: "Should a person's worst chapter be permanently searchable; and what would an automatic, earned clean slate change about who gets to try again?",
    4: "What did school actually measure about you; what you could build, or how well you complied; and which one has your life run on since?",
    5: "If despair and denial both end in doing nothing, what is the nearest piece of your own environment you could provably improve within a year?",
    6: "As world-changing capability concentrates in a few corporations, what tools would ordinary people need to stay creators instead of bystanders?",
    7: "Who outside your household tangibly showed up for you this month; and where, within walking distance, could that even happen?",
    8: "Your feed is paid for the seconds you spend, not for what you believe is possible afterward; what would you read differently if hope were the business model?",
  },
};

interface ParsedSection {
  label: string; // normalized
  rawLabel: string; // as it appears in the doc
  body: string; // paragraph text (verbatim words, unwrapped)
  items: string[]; // sub-bullets (Open for Repair questions)
}

interface ParsedDomain {
  position: number;
  title: string;
  subtitle: string | null;
  sections: ParsedSection[];
}

function normalizeLabel(raw: string): string {
  let l = raw.trim();
  l = l.replace(/\s*\(.*\)\s*$/, ""); // trailing parenthetical
  l = l.replace(/\s*; .*$/, ""); // em-dash suffix (Stoic Lens; Principle)
  l = l.replace(/^The\s+/, "");
  return l.trim();
}

function parseBreakdown(path: string): ParsedDomain[] {
  const text = readFileSync(path, "utf8");
  const rawLines = text.split("\n");

  // Bold bullet labels may wrap across lines ("- **The Picture (…staying\n
  // broken):** …"); join a bullet-opening line with its continuations
  // until the label's closing ":**" appears.
  const lines: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i];
    if (/^- \*\*/.test(line) && !/\*\*/.test(line.slice(4))) {
      while (i + 1 < rawLines.length && !/\*\*/.test(line.slice(4))) {
        i += 1;
        line = line + " " + rawLines[i].trim();
      }
    }
    lines.push(line);
  }

  // Domain sections are "### N. Title (Subtitle)"; "### Level N" and other
  // headings are not domains.
  const domains: ParsedDomain[] = [];
  let current: ParsedDomain | null = null;
  let section: ParsedSection | null = null;
  let inSubItem = false;

  const flushSection = () => {
    if (section && current) {
      section.body = section.body.trim();
      current.sections.push(section);
    }
    section = null;
    inSubItem = false;
  };
  const flushDomain = () => {
    flushSection();
    if (current) domains.push(current);
    current = null;
  };

  for (const line of lines) {
    const heading = line.match(/^### (\d+)\. (.+)$/);
    if (heading) {
      flushDomain();
      const titleRaw = heading[2].trim();
      const m = titleRaw.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
      current = {
        position: Number(heading[1]),
        title: m ? m[1].trim() : titleRaw,
        subtitle: m ? m[2].trim() : null,
        sections: [],
      };
      continue;
    }
    if (/^## /.test(line) || /^---\s*$/.test(line)) {
      flushDomain();
      continue;
    }
    if (!current) continue;

    const bullet = line.match(/^- \*\*(.+?):\*\*\s*(.*)$/);
    if (bullet) {
      flushSection();
      section = {
        label: normalizeLabel(bullet[1]),
        rawLabel: bullet[1].trim(),
        body: bullet[2].trim(),
        items: [],
      };
      continue;
    }
    if (!section) continue;

    const sub = line.match(/^ {2}- (.*)$/);
    if (sub) {
      section.items.push(sub[1].trim());
      inSubItem = true;
      continue;
    }
    const cont = line.match(/^ {2,}(\S.*)$/);
    if (cont) {
      if (inSubItem && /^ {4,}/.test(line) && section.items.length > 0) {
        section.items[section.items.length - 1] += " " + cont[1].trim();
      } else {
        section.body += (section.body ? " " : "") + cont[1].trim();
        inSubItem = false;
      }
      continue;
    }
    if (line.trim() === "") continue;
  }
  flushDomain();
  return domains;
}

function findSection(d: ParsedDomain, label: string): ParsedSection | undefined {
  return d.sections.find((s) => s.label === label);
}

/** Opening Questions arrive wrapped like *"…"*; store clean plain text. */
function cleanQuestion(body: string): string {
  let q = body.trim();
  q = q.replace(/^\*+/, "").replace(/\*+$/, "").trim();
  q = q.replace(/^[“"]/, "").replace(/[”"]$/, "").trim();
  return q;
}

const esc = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

// ------------------------------------------------------------ generate

let totalDomains = 0;
const pillarBlocks: string[] = [];
const REQUIRED = ["Reality", "Impact Point", "Defined Forward Marker", "Stoic Lens", "Picture", "Open for Repair"];

for (const src of SOURCES) {
  const domains = parseBreakdown(src.breakdown);
  if (domains.length !== 8) {
    throw new Error(`${src.slug}: expected 8 domains, parsed ${domains.length}`);
  }
  const domainBlocks: string[] = [];
  for (const d of domains) {
    for (const req of REQUIRED) {
      if (!findSection(d, req)) {
        throw new Error(`${src.slug} domain ${d.position} (${d.title}): missing "${req}"`);
      }
    }
    const oq = findSection(d, "Opening Question");
    const drafted = DRAFTED_OPENING_QUESTIONS[src.slug]?.[d.position];
    if (!oq && !drafted) {
      throw new Error(`${src.slug} domain ${d.position}: no Opening Question and no draft`);
    }
    if (oq && drafted) {
      throw new Error(`${src.slug} domain ${d.position}: has BOTH a ratified Opening Question and a draft; remove the draft`);
    }
    const stoic = findSection(d, "Stoic Lens")!;
    const principle = stoic.rawLabel.match(/; \s*(.+)$/)?.[1]?.trim() ?? "";
    const repair = findSection(d, "Open for Repair")!;
    if (repair.items.length === 0) {
      throw new Error(`${src.slug} domain ${d.position}: Open for Repair has no questions`);
    }
    const inService = findSection(d, "In Service of the Pillars");
    const extras = d.sections.filter(
      (s) =>
        ![...REQUIRED, "Opening Question", "In Service of the Pillars"].includes(s.label)
    );

    totalDomains += 1;
    domainBlocks.push(`    {
      position: ${d.position},
      title: \`${esc(d.title)}\`,
      subtitle: ${d.subtitle ? `\`${esc(d.subtitle)}\`` : "null"},
      openingQuestion: \`${esc(oq ? cleanQuestion(oq.body) : drafted!)}\`,
      openingQuestionProvenance: ${oq ? '"ratified"' : '"derived-draft"'},
      reality: \`${esc(findSection(d, "Reality")!.body)}\`,
      impactPoint: \`${esc(findSection(d, "Impact Point")!.body)}\`,
      forwardMarker: \`${esc(findSection(d, "Defined Forward Marker")!.body)}\`,
      stoicPrinciple: \`${esc(principle)}\`,
      stoicLens: \`${esc(stoic.body)}\`,
      picture: \`${esc(findSection(d, "Picture")!.body)}\`,
      openForRepair: [
${repair.items.map((q) => `        \`${esc(q)}\`,`).join("\n")}
      ],
      inService: ${inService ? `\`${esc(inService.body)}\`` : "null"},
      extras: [${extras
        .map((e) => `{ label: \`${esc(e.rawLabel)}\`, body: \`${esc(e.body)}\` }`)
        .join(", ")}],
    }`);
  }
  pillarBlocks.push(`  {
    pillarSlug: "${src.slug}",
    domains: [
${domainBlocks.join(",\n")},
    ],
  }`);
}

const domainFile = `// GENERATED by scripts/extract-domain-content.ts; do not hand-edit.
// Source: the spec corpus's seven pillar _breakdown.md documents
// (7 Pillars/, dashboard spec §7 content inventory). Domain prose is
// VERBATIM from the corpus. Opening questions marked "derived-draft"
// (Compassion + Hope; their breakdowns predate the Opening Question
// template) are build-time drafts pending owner ratification; wording
// changes are ledger-evented amendments, per canon law.

export interface DomainContent {
  position: number;
  title: string;
  subtitle: string | null;
  openingQuestion: string;
  openingQuestionProvenance: "ratified" | "derived-draft";
  reality: string;
  impactPoint: string;
  forwardMarker: string;
  stoicPrinciple: string;
  stoicLens: string;
  picture: string;
  openForRepair: string[];
  inService: string | null;
  extras: { label: string; body: string }[];
}

export interface PillarDomainContent {
  pillarSlug: string;
  domains: DomainContent[];
}

export const DOMAIN_CONTENT: PillarDomainContent[] = [
${pillarBlocks.join(",\n")},
];
`;

writeFileSync(join(__dirname, "..", "lib", "domainContent.generated.ts"), domainFile);
console.log(`Wrote lib/domainContent.generated.ts; ${totalDomains} domains across ${SOURCES.length} pillars.`);

// Mechanism documents; full verbatim markdown, reference material for the
// dashboard's deep-dive section (spec §5.4).
const mechBlocks: string[] = [];
let mechCount = 0;
for (const src of SOURCES) {
  for (const m of src.mechanisms) {
    const body = readFileSync(m.file, "utf8");
    mechCount += 1;
    mechBlocks.push(`  {
    pillarSlug: "${src.slug}",
    slug: "${m.slug}",
    title: \`${esc(m.title)}\`,
    markdown: \`${esc(body)}\`,
  }`);
  }
}
const mechFile = `// GENERATED by scripts/extract-domain-content.ts; do not hand-edit.
// The pillar mechanism documents, verbatim (dashboard spec §5.4:
// reference material, deliberately secondary).

export interface MechanismDoc {
  pillarSlug: string;
  slug: string;
  title: string;
  markdown: string;
}

export const MECHANISM_DOCS: MechanismDoc[] = [
${mechBlocks.join(",\n")},
];
`;
writeFileSync(join(__dirname, "..", "lib", "mechanismDocs.generated.ts"), mechFile);
console.log(`Wrote lib/mechanismDocs.generated.ts; ${mechCount} mechanism documents.`);
