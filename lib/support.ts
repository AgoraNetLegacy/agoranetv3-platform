import type { PrismaClient } from "@prisma/client";
import { HELP_ARTICLES, type HelpArticle } from "./helpContent";
import { generateHelpdeskAnswer, type HelpdeskConfidence } from "./helpdeskProvider";

export const SUPPORT_CATEGORIES = [
  "onboarding",
  "verification",
  "identity-and-keys",
  "wallet-and-transactions",
  "technical",
  "privacy-and-safety",
  "moderation",
  "other",
] as const;

export const SUPPORT_SEVERITIES = ["informational", "normal", "high", "critical"] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];
export type SupportSeverity = (typeof SUPPORT_SEVERITIES)[number];

export interface SafeSupportContext {
  stage?: string;
  route?: string;
  errorCode?: string;
  clientVersion?: string;
}

export interface HelpdeskAnswer {
  answer: string;
  articles: Pick<HelpArticle, "slug" | "title" | "summary">[];
  escalate: boolean;
  severity: SupportSeverity;
  generated: boolean;
  confidence?: HelpdeskConfidence;
  secretRejected?: boolean;
}

const HIGH_RISK = [
  /compromis|hack|stolen|phish/i,
  /missing (fund|money|balance)|funds? (?:are |is )?missing|unexpected balance|duplicate transaction/i,
  /lost (key|credential|seed|wallet)/i,
  /harass|threat|unsafe|privacy (leak|exposure)/i,
  /verification (reject|denied)/i,
  /moderation appeal/i,
  /(?:show|find|reveal|identify).{0,50}(?:alias|true self).{0,50}(?:belongs|linked|owner)/i,
  /revers(?:e|ed|al).{0,30}transaction/i,
];

const CRITICAL = [
  /active compromise|currently being hacked|stolen wallet/i,
  /security vulnerab|private data (exposed|leak)/i,
  /missing funds|funds? (?:are |is )?missing/i,
];

// A question ABOUT a secret is allowed. A pasted secret is not. These
// patterns require a value-like delimiter or a private-key marker so the
// phrase "I lost my access key" remains answerable.
const PASTED_SECRET = [
  /(?:seed phrase|mnemonic|private key|access key|humanity credential)\s*[:=]\s*\S+/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9_-]{16,}\b/,
];

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "will", "not", "but",
  "your", "our", "from", "into", "after", "before", "what", "when",
  "where", "how", "why", "are", "was", "were", "have", "has", "had",
  "can", "could", "would", "should", "does", "did", "its", "you", "my",
]);

function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9@-]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

export function containsPastedSecret(value: string): boolean {
  return PASTED_SECRET.some((pattern) => pattern.test(value));
}

export function classifySupportQuestion(value: string): {
  escalate: boolean;
  severity: SupportSeverity;
} {
  if (CRITICAL.some((pattern) => pattern.test(value))) {
    return { escalate: true, severity: "critical" };
  }
  if (HIGH_RISK.some((pattern) => pattern.test(value))) {
    return { escalate: true, severity: "high" };
  }
  return { escalate: false, severity: "normal" };
}

export function findRelevantHelp(query: string, limit = 4): HelpArticle[] {
  const terms = new Set(words(query));
  return HELP_ARTICLES.map((article) => {
    const title = new Set(words(article.title));
    const summary = new Set(words(article.summary));
    const keywords = new Set(words((article.keywords ?? []).join(" ")));
    const errorCodes = new Set(article.errorCodes.map((code) => code.toLowerCase()));
    const stages = new Set(words(article.onboardingStages.join(" ")));
    const body = new Set(words(article.body.join(" ")));
    let score = 0;
    for (const term of terms) {
      if (title.has(term)) score += 6;
      if (keywords.has(term)) score += 5;
      if (summary.has(term)) score += 3;
      if (stages.has(term)) score += 4;
      if (body.has(term)) score += 1;
    }
    const phrase = query.trim().toLowerCase();
    for (const code of errorCodes) {
      if (phrase.includes(code)) score += 20;
    }
    if (phrase && (article.title.toLowerCase().includes(phrase) || article.keywords?.some((k) => k.includes(phrase)))) {
      score += 12;
    }
    return { article, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title))
    .slice(0, limit)
    .map((item) => item.article);
}

function fallbackAnswer(articles: HelpArticle[], escalate: boolean): string {
  if (articles.length === 0) {
    return "I can only answer questions about AgoraNet, and I couldn’t find an approved help article for this request. Rephrase it as an AgoraNet question, or open a support request if this is a platform problem.";
  }
  const lead = articles[0];
  const boundary = lead.escalateWhen ? ` Escalate when: ${lead.escalateWhen}` : "";
  return `${lead.summary} ${lead.body[0]}${boundary}${
    escalate ? " Because this may be consequential, please open a support request rather than relying on self-service alone." : ""
  }`;
}

export async function answerSupportQuestion(input: {
  question: string;
  context?: SafeSupportContext;
  safetyKey: string;
}): Promise<HelpdeskAnswer> {
  const question = input.question.trim().slice(0, 2_000);
  const classification = classifySupportQuestion(question);
  const articles = findRelevantHelp(question);
  const articleRefs = articles.map(({ slug, title, summary }) => ({ slug, title, summary }));

  if (containsPastedSecret(question)) {
    return {
      answer:
        "It looks like your message may contain a credential or private secret. I did not send it to the AI service or save it in a support case. Remove the secret, secure the affected key, and ask again using only the non-secret error message. If the secret may be exposed, open a critical support request.",
      articles: articleRefs,
      escalate: true,
      severity: "critical",
      generated: false,
      secretRejected: true,
    };
  }

  if (articles.length === 0) {
    return {
      answer: fallbackAnswer(articles, classification.escalate),
      articles: articleRefs,
      ...classification,
      generated: false,
    };
  }

  const generated = await generateHelpdeskAnswer({
    question,
    context: cleanContext(input.context),
    articles,
    deterministicEscalation: classification.escalate,
    safetyKey: input.safetyKey,
  });
  if (!generated) {
    return {
      answer: fallbackAnswer(articles, classification.escalate),
      articles: articleRefs,
      ...classification,
      generated: false,
    };
  }

  const cited = new Set(generated.citedArticleSlugs);
  const citedArticles = articles.filter((article) => cited.has(article.slug));
  const escalate = classification.escalate || generated.escalate;
  const severity = generated.escalate && classification.severity === "normal"
    ? "high"
    : classification.severity;
  const answer = [generated.answer, generated.followUpQuestion].filter(Boolean).join("\n\n");
  return {
    answer,
    articles: citedArticles.map(({ slug, title, summary }) => ({ slug, title, summary })),
    escalate,
    severity,
    generated: true,
    confidence: generated.confidence,
  };
}

function safeText(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function cleanContext(context: SafeSupportContext | undefined): SafeSupportContext {
  return {
    stage: safeText(context?.stage, 80) || undefined,
    route: safeText(context?.route, 120) || undefined,
    errorCode: safeText(context?.errorCode, 120) || undefined,
    clientVersion: safeText(context?.clientVersion, 80) || undefined,
  };
}

export async function createSupportCase(
  db: PrismaClient,
  input: {
    profileId?: string | null;
    contactEmail?: string;
    category: string;
    severity: string;
    subject: string;
    description: string;
    context?: SafeSupportContext;
    sourceArticle?: string;
  }
): Promise<{ id: string; reference: string }> {
  const description = safeText(input.description, 5_000);
  const subject = safeText(input.subject, 140);
  const contactEmail = safeText(input.contactEmail, 254).toLowerCase();
  if (description.length < 20) throw new Error("Please describe what happened in at least 20 characters.");
  if (!subject) throw new Error("Please add a short subject.");
  if (!input.profileId && !/^\S+@\S+\.\S+$/.test(contactEmail)) {
    throw new Error("Guests need a valid reply email so support can respond.");
  }
  if (containsPastedSecret(`${subject}\n${description}`)) {
    throw new Error("Remove credentials, access keys, seed phrases, and private keys before submitting.");
  }
  const category = SUPPORT_CATEGORIES.includes(input.category as SupportCategory)
    ? (input.category as SupportCategory)
    : "other";
  const severity = SUPPORT_SEVERITIES.includes(input.severity as SupportSeverity)
    ? (input.severity as SupportSeverity)
    : "normal";
  const supportCase = await db.supportCase.create({
    data: {
      profileId: input.profileId || null,
      contactEmail: contactEmail || null,
      category,
      severity,
      subject,
      description,
      safeContext: JSON.stringify(cleanContext(input.context)),
      sourceArticle: safeText(input.sourceArticle, 100) || null,
    },
  });
  return { id: supportCase.id, reference: `AN-${supportCase.id.slice(-8).toUpperCase()}` };
}
