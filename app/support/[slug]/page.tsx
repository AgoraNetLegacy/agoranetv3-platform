import Link from "next/link";
import { notFound } from "next/navigation";
import { helpArticle } from "@/lib/helpContent";
import { isPreAccountHelpArticle } from "@/lib/helpContent";
import { activeFace } from "@/lib/webSession";

export const dynamic = "force-dynamic";

export default async function SupportArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = helpArticle(slug);
  if (!article) notFound();
  const face = await activeFace();
  if (!face && !isPreAccountHelpArticle(article)) notFound();

  return (
    <>
      <p>
        <Link href="/support">← Support</Link>
      </p>
      <h1>{article.title}</h1>
      <p className="lore">
        {article.category} · Approved help article
        {article.updatedAt ? ` · reviewed ${article.updatedAt}` : ""}
      </p>
      {article.body.map((paragraph, i) => (
        <p key={i}>{paragraph}</p>
      ))}
      {article.links && article.links.length > 0 && (
        <p className="lore">
          {article.links.map((l, i) => (
            <span key={l.href}>
              {i > 0 && " · "}
              <Link href={l.href}>{l.label} →</Link>
            </span>
          ))}
        </p>
      )}
      {article.escalateWhen && (
        <div className="notice">
          <strong>Stop self-service and contact Support when:</strong>{" "}
          {article.escalateWhen}
        </div>
      )}
      <p className="support-article-help">
        Still stuck?{" "}
        <Link href={`/support?from=${encodeURIComponent(`/support/${article.slug}`)}`}>
          Ask the helpdesk or open a request →
        </Link>
      </p>
    </>
  );
}
