// Public API for the governed Help & Support corpus. The canonical content
// lives under content/help_support; run `npm run corpus:build` after edits.
import {
  GENERATED_HELP_ARTICLES,
  GENERATED_HELP_CATEGORIES,
  GENERATED_HELP_RETRIEVAL_DOCUMENTS,
  HELP_CORPUS_VERSION,
} from "./helpContent.generated";

export { HELP_CORPUS_VERSION };

export const HELP_CATEGORIES = GENERATED_HELP_CATEGORIES;
export type HelpCategory = (typeof HELP_CATEGORIES)[number];
export type HelpRisk = "informational" | "normal" | "high" | "critical";
export type HelpAudience = "public" | "verified" | "operator" | "restricted";

export interface HelpArticle {
  id: string;
  slug: string;
  title: string;
  category: HelpCategory;
  categoryId: string;
  summary: string;
  body: readonly string[];
  keywords: readonly string[];
  errorCodes: readonly string[];
  onboardingStages: readonly string[];
  version: string;
  updatedAt: string;
  reviewBy: string;
  owner: string;
  risk: HelpRisk;
  sourceRefs: readonly string[];
  documentType: string;
  escalateWhen?: string;
  links?: readonly { href: string; label: string }[];
}

export interface HelpRetrievalDocument {
  id: string;
  slug?: string;
  title: string;
  summary: string;
  text: string;
  audience: HelpAudience;
  categoryId: string;
  documentType: string;
  risk: HelpRisk;
  version: string;
  effectiveAt: string;
  reviewBy: string;
  keywords: readonly string[];
  errorCodes: readonly string[];
  onboardingStages: readonly string[];
  sourceRefs: readonly string[];
  escalateWhen?: string;
}

export const HELP_ARTICLES: readonly HelpArticle[] = GENERATED_HELP_ARTICLES;
export const HELP_RETRIEVAL_DOCUMENTS: readonly HelpRetrievalDocument[] =
  GENERATED_HELP_RETRIEVAL_DOCUMENTS;

export function helpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.slug === slug);
}

export function helpByCategory(): Map<HelpCategory, HelpArticle[]> {
  const map = new Map<HelpCategory, HelpArticle[]>();
  for (const category of HELP_CATEGORIES) map.set(category, []);
  for (const article of HELP_ARTICLES) map.get(article.category)?.push(article);
  return map;
}
