import { createHash } from "crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import path from "path";
import { parse } from "yaml";

const ROOT = process.cwd();
const CORPUS_ROOT = path.join(ROOT, "content", "help_support");
const CONTENT_OUTPUT = path.join(ROOT, "lib", "helpContent.generated.ts");
const PROMPT_OUTPUT = path.join(ROOT, "lib", "helpPrompts.generated.ts");
const CHECK_ONLY = process.argv.includes("--check");

const AUDIENCES = new Set(["public", "verified", "operator", "restricted"]);
const STATUSES = new Set(["draft", "approved", "deprecated", "superseded"]);
const DOCUMENT_TYPES = new Set([
  "concept",
  "procedure",
  "troubleshooting",
  "policy",
  "known-issue",
  "recovery-boundary",
  "capability-matrix",
  "error-catalog",
  "escalation-matrix",
  "troubleshooting-tree",
]);
const RISKS = new Set(["informational", "normal", "high", "critical"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SEMVER = /^\d+\.\d+\.\d+$/;
const SECRET_SHAPED = [
  /(?:seed phrase|mnemonic|private key|access key|humanity credential)\s*[:=]\s*\S+/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9_-]{16,}\b/,
];

type JsonObject = Record<string, unknown>;

type Manifest = {
  corpus: string;
  version: string;
  categories: Record<string, string>;
  allowed_routes: string[];
  source_registry: Record<string, { label: string; locator: string }>;
};

type CorpusDocument = {
  id: string;
  slug?: string;
  title: string;
  summary: string;
  category: string;
  categoryLabel: string;
  documentType: string;
  audience: string;
  status: string;
  version: string;
  effectiveAt: string;
  reviewBy: string;
  owner: string;
  reviewers: string[];
  risk: string;
  keywords: string[];
  errorCodes: string[];
  onboardingStages: string[];
  sourceRefs: string[];
  escalateWhen?: string;
  supersedes?: string;
  links: { href: string; label: string }[];
  body: string[];
  sourcePath: string;
};

function fail(message: string): never {
  throw new Error(`[help-corpus] ${message}`);
}

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object.`);
  return value as JsonObject;
}

function stringValue(data: JsonObject, key: string, source: string, required = true): string {
  const value = data[key];
  if (value === null || value === undefined || value === "") {
    if (required) fail(`${source}: missing ${key}.`);
    return "";
  }
  if (typeof value !== "string") fail(`${source}: ${key} must be a string.`);
  return value.trim();
}

function stringList(data: JsonObject, key: string, source: string): string[] {
  const value = data[key] ?? [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    fail(`${source}: ${key} must be a string array.`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function walkMarkdown(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .flatMap((entry) => {
      const target = path.join(directory, entry);
      if (statSync(target).isDirectory()) return walkMarkdown(target);
      return entry.endsWith(".md") && entry.toLowerCase() !== "readme.md" ? [target] : [];
    })
    .sort();
}

function parseFrontMatter(file: string): { metadata: JsonObject; body: string } {
  const relative = path.relative(ROOT, file);
  const raw = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) fail(`${relative}: expected YAML front matter.`);
  return { metadata: object(parse(match[1]), relative), body: match[2].trim() };
}

function bodyBlocks(markdown: string): string[] {
  return markdown
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => block.replace(/^#{1,6}\s+/, "").replace(/\n+/g, " "));
}

function dateValue(value: string, key: string, source: string): string {
  if (!ISO_DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    fail(`${source}: ${key} must be an ISO date.`);
  }
  return value;
}

function validateLinks(metadata: JsonObject, source: string, manifest: Manifest) {
  const value = metadata.links ?? [];
  if (!Array.isArray(value)) fail(`${source}: links must be an array.`);
  return value.map((item, index) => {
    const link = object(item, `${source}: links[${index}]`);
    const href = stringValue(link, "href", source);
    const label = stringValue(link, "label", source);
    if (!href.startsWith("/") || !manifest.allowed_routes.some((route) => href === route || href.startsWith(`${route}/`))) {
      fail(`${source}: unapproved or unresolved in-app link ${href}.`);
    }
    return { href, label };
  });
}

function parseDocument(file: string, manifest: Manifest): CorpusDocument {
  const source = path.relative(ROOT, file);
  const { metadata, body } = parseFrontMatter(file);
  const id = stringValue(metadata, "id", source);
  const audience = stringValue(metadata, "audience", source);
  const status = stringValue(metadata, "status", source);
  const documentType = stringValue(metadata, "document_type", source);
  const risk = stringValue(metadata, "risk", source);
  const category = stringValue(metadata, "category", source);
  const version = stringValue(metadata, "version", source);
  const effectiveAt = dateValue(stringValue(metadata, "effective_at", source), "effective_at", source);
  const reviewBy = dateValue(stringValue(metadata, "review_by", source), "review_by", source);
  const sourceRefs = stringList(metadata, "source_refs", source);
  const slug = stringValue(metadata, "slug", source, audience === "public") || undefined;

  if (!AUDIENCES.has(audience)) fail(`${source}: invalid audience ${audience}.`);
  if (!STATUSES.has(status)) fail(`${source}: invalid status ${status}.`);
  if (!DOCUMENT_TYPES.has(documentType)) fail(`${source}: invalid document_type ${documentType}.`);
  if (!RISKS.has(risk)) fail(`${source}: invalid risk ${risk}.`);
  if (!manifest.categories[category]) fail(`${source}: invalid category ${category}.`);
  if (!SEMVER.test(version)) fail(`${source}: version must use semantic versioning.`);
  if (sourceRefs.length === 0) fail(`${source}: source_refs cannot be empty.`);
  for (const reference of sourceRefs) {
    if (!manifest.source_registry[reference]) fail(`${source}: unresolved source reference ${reference}.`);
  }
  if (status === "approved" && reviewBy < new Date().toISOString().slice(0, 10)) {
    fail(`${source}: approved content review expired on ${reviewBy}.`);
  }
  if (audience === "public" && !file.includes(`${path.sep}public${path.sep}`)) {
    fail(`${source}: public documents must live under public/.`);
  }
  if (audience !== "public" && file.includes(`${path.sep}public${path.sep}`)) {
    fail(`${source}: non-public documents cannot live under public/.`);
  }
  if (!body) fail(`${source}: document body cannot be empty.`);

  const combined = `${JSON.stringify(metadata)}\n${body}`;
  if (SECRET_SHAPED.some((pattern) => pattern.test(combined))) {
    fail(`${source}: contains a secret-shaped value.`);
  }

  return {
    id,
    slug,
    title: stringValue(metadata, "title", source),
    summary: stringValue(metadata, "summary", source),
    category,
    categoryLabel: manifest.categories[category],
    documentType,
    audience,
    status,
    version,
    effectiveAt,
    reviewBy,
    owner: stringValue(metadata, "owner", source),
    reviewers: stringList(metadata, "reviewers", source),
    risk,
    keywords: stringList(metadata, "keywords", source),
    errorCodes: stringList(metadata, "error_codes", source),
    onboardingStages: stringList(metadata, "onboarding_stages", source),
    sourceRefs,
    escalateWhen: stringValue(metadata, "escalate_when", source, false) || undefined,
    supersedes: stringValue(metadata, "supersedes", source, false) || undefined,
    links: validateLinks(metadata, source, manifest),
    body: bodyBlocks(body),
    sourcePath: source,
  };
}

function validateKnownIssue(document: CorpusDocument, file: string) {
  if (document.documentType !== "known-issue") return;
  const { metadata } = parseFrontMatter(file);
  for (const key of ["incident_status", "affected_versions", "last_verified_at", "workaround_status", "next_update_at"]) {
    if (metadata[key] === undefined || metadata[key] === null || metadata[key] === "") {
      fail(`${document.sourcePath}: known issue missing ${key}.`);
    }
  }
}

function validateEvaluations() {
  const evalRoot = path.join(CORPUS_ROOT, "evals");
  const files = existsSync(evalRoot)
    ? readdirSync(evalRoot).filter((entry) => entry.endsWith(".jsonl")).sort()
    : [];
  const ids = new Set<string>();
  for (const entry of files) {
    const source = path.join(evalRoot, entry);
    const lines = readFileSync(source, "utf8").split(/\r?\n/).filter((line) => line.trim());
    for (const [index, line] of lines.entries()) {
      let parsed: JsonObject;
      try {
        parsed = object(JSON.parse(line), `${entry}:${index + 1}`);
      } catch (error) {
        fail(`${entry}:${index + 1}: invalid JSON: ${error instanceof Error ? error.message : error}`);
      }
      const id = stringValue(parsed, "id", `${entry}:${index + 1}`);
      stringValue(parsed, "question", `${entry}:${index + 1}`);
      object(parsed.expected, `${entry}:${index + 1}: expected`);
      if (ids.has(id)) fail(`duplicate evaluation id ${id}.`);
      ids.add(id);
      if (SECRET_SHAPED.some((pattern) => pattern.test(line))) fail(`${entry}:${index + 1}: contains a secret-shaped value.`);
    }
  }
}

function renderGenerated(manifest: Manifest, documents: CorpusDocument[]): string {
  const live = documents.filter(
    (document) => document.status === "approved" && document.effectiveAt <= new Date().toISOString().slice(0, 10)
  );
  const publicArticles = live
    .filter((document) => document.audience === "public" && document.slug)
    .map((document) => ({
      id: document.id,
      slug: document.slug,
      title: document.title,
      category: document.categoryLabel,
      categoryId: document.category,
      summary: document.summary,
      body: document.body,
      keywords: document.keywords,
      errorCodes: document.errorCodes,
      onboardingStages: document.onboardingStages,
      version: document.version,
      updatedAt: document.effectiveAt,
      reviewBy: document.reviewBy,
      owner: document.owner,
      risk: document.risk,
      sourceRefs: document.sourceRefs,
      documentType: document.documentType,
      ...(document.escalateWhen ? { escalateWhen: document.escalateWhen } : {}),
      ...(document.links.length ? { links: document.links } : {}),
    }));
  const retrievalDocuments = live.map((document) => ({
    id: document.id,
    slug: document.slug,
    title: document.title,
    summary: document.summary,
    text: document.body.join("\n\n"),
    audience: document.audience,
    categoryId: document.category,
    documentType: document.documentType,
    risk: document.risk,
    version: document.version,
    effectiveAt: document.effectiveAt,
    reviewBy: document.reviewBy,
    keywords: document.keywords,
    errorCodes: document.errorCodes,
    onboardingStages: document.onboardingStages,
    sourceRefs: document.sourceRefs,
    escalateWhen: document.escalateWhen,
  }));
  const digest = createHash("sha256").update(JSON.stringify({ manifest, documents })).digest("hex").slice(0, 16);
  return `// Generated by scripts/compile-help-corpus.ts. DO NOT EDIT.\n` +
    `export const HELP_CORPUS_VERSION = ${JSON.stringify(`${manifest.version}+${digest}`)} as const;\n` +
    `export const GENERATED_HELP_CATEGORIES = ${JSON.stringify(Object.values(manifest.categories), null, 2)} as const;\n` +
    `export const GENERATED_HELP_ARTICLES = ${JSON.stringify(publicArticles, null, 2)} as const;\n` +
    `export const GENERATED_HELP_RETRIEVAL_DOCUMENTS = ${JSON.stringify(retrievalDocuments, null, 2)} as const;\n`;
}

function renderPrompts(manifest: Manifest): string {
  const soul = readFileSync(path.join(CORPUS_ROOT, "prompts", "SOUL.md"), "utf8").trim();
  const agent = readFileSync(path.join(CORPUS_ROOT, "prompts", "AGENT.md"), "utf8").trim();
  return `// Generated by scripts/compile-help-corpus.ts. DO NOT EDIT.\n` +
    `export const HELP_SOUL_VERSION = ${JSON.stringify(manifest.version)} as const;\n` +
    `export const HELP_SOUL_PROMPT = ${JSON.stringify(soul)} as const;\n` +
    `export const HELP_AGENT_VERSION = ${JSON.stringify(manifest.version)} as const;\n` +
    `export const HELP_AGENT_PROMPT = ${JSON.stringify(agent)} as const;\n`;
}

function writeOrCheck(file: string, content: string) {
  if (CHECK_ONLY) {
    if (!existsSync(file) || readFileSync(file, "utf8") !== content) {
      fail(`${path.relative(ROOT, file)} is stale; run npm run corpus:build.`);
    }
    return;
  }
  writeFileSync(file, content);
}

function main() {
  const manifestPath = path.join(CORPUS_ROOT, "manifest.json");
  if (!existsSync(manifestPath)) fail("content/help_support/manifest.json is missing.");
  const manifest = object(JSON.parse(readFileSync(manifestPath, "utf8")), "manifest") as Manifest;
  if (manifest.corpus !== "help_support" || !SEMVER.test(manifest.version)) fail("manifest identity or version is invalid.");
  object(manifest.categories, "manifest.categories");
  object(manifest.source_registry, "manifest.source_registry");
  if (!Array.isArray(manifest.allowed_routes)) fail("manifest.allowed_routes must be an array.");

  const files = ["public", "internal", "policy"].flatMap((directory) =>
    walkMarkdown(path.join(CORPUS_ROOT, directory))
  );
  const documents = files.map((file) => {
    const document = parseDocument(file, manifest);
    validateKnownIssue(document, file);
    return document;
  });
  const ids = new Set<string>();
  const slugs = new Set<string>();
  for (const document of documents) {
    if (ids.has(document.id)) fail(`duplicate document id ${document.id}.`);
    ids.add(document.id);
    if (document.slug) {
      if (slugs.has(document.slug)) fail(`duplicate public slug ${document.slug}.`);
      slugs.add(document.slug);
    }
  }
  for (const document of documents) {
    if (document.supersedes && !ids.has(document.supersedes)) {
      fail(`${document.sourcePath}: supersedes unresolved document ${document.supersedes}.`);
    }
  }

  validateEvaluations();
  writeOrCheck(CONTENT_OUTPUT, renderGenerated(manifest, documents));
  writeOrCheck(PROMPT_OUTPUT, renderPrompts(manifest));
  console.log(`[help-corpus] ${CHECK_ONLY ? "validated" : "compiled"} ${documents.length} documents.`);
}

main();
