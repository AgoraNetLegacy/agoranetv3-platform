import Link from "next/link";
import { notFound } from "next/navigation";
import { helpArticle } from "@/lib/helpContent";

export const dynamic = "force-dynamic";

export default async function SupportArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = helpArticle(slug);
  if (!article) notFound();

  return (
    <>
      <p>
        <Link href="/support">← Support</Link>
      </p>
      <h1>{article.title}</h1>
      <p className="lore">{article.category}</p>
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
    </>
  );
}
