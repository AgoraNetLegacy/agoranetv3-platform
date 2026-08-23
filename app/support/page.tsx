import Link from "next/link";
import { HELP_CATEGORIES, helpArticlesForViewer } from "@/lib/helpContent";
import { activeFace } from "@/lib/webSession";
import { Helpdesk } from "@/components/Helpdesk";
import { findRelevantHelp } from "@/lib/support";

export const dynamic = "force-dynamic";

// The support library (owner directive 2026-07-21): how-tos and help
// documents, reached from the profile bubble. Free to read like
// everything else; support is reading too.
export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string; from?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim().toLowerCase() ?? "";
  const face = await activeFace();
  const availableArticles = helpArticlesForViewer(Boolean(face));
  const matching = q ? findRelevantHelp(q, availableArticles.length, availableArticles) : availableArticles;
  return (
    <>
      <div className="support-hero">
        <p className="eyebrow">Help &amp; Support</p>
        <h1>A clear next step when something goes wrong.</h1>
        <p className="lore">
          {face
            ? "Search complete platform guidance, ask the internal helpdesk, or open a request for human review."
            : "Account-creation and onboarding guidance is available before you join. Sign in for help with platform features and participation."}
        </p>
        <form method="get" className="support-search">
          <div className="search-hero">
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Search onboarding, wallets, fees, errors…"
              aria-label="Search help articles"
            />
            <button type="submit">Search help</button>
          </div>
        </form>
        <p className="support-trust-line">
          Never share a credential, access key, wallet seed phrase, private
          key, or password. AgoraNet Support will never ask for one.
        </p>
      </div>

      <Helpdesk
        signedIn={Boolean(face)}
        stage={params.stage?.slice(0, 80)}
        from={params.from?.slice(0, 120)}
      />

      {q && (
        <p className="lore support-result-count">
          {matching.length} help article{matching.length === 1 ? "" : "s"} for &ldquo;{params.q}&rdquo;.
          {matching.length === 0 && <> Ask the helpdesk above or open a request.</>}
        </p>
      )}

      {HELP_CATEGORIES.map((category) => {
        const articles = matching.filter((article) => article.category === category);
        return (
        articles.length === 0 ? null : (
          <section key={category}>
            <h2>{category}</h2>
            <ul className="help-article-grid">
              {articles.map((a) => (
                <li key={a.slug}>
                  <Link href={`/support/${a.slug}`}>{a.title}</Link>
                  <p>{a.summary}</p>
                  <span className="meta">Approved help article →</span>
                </li>
              ))}
            </ul>
          </section>
        ));
      })}

      <p className="lore support-footer">
        Published numbers live on <Link href="/transparency">Transparency</Link>;
        platform law lives in <Link href="/constitution">the Constitution</Link>;
        moderation rules live in <Link href="/rules">the Rulebook</Link>.
      </p>
    </>
  );
}
