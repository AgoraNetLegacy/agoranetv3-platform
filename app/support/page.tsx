import Link from "next/link";
import { helpByCategory } from "@/lib/helpContent";

export const dynamic = "force-dynamic";

// The support library (owner directive 2026-07-21): how-tos and help
// documents, reached from the profile bubble. Free to read like
// everything else; support is reading too.
export default async function SupportPage() {
  const shelves = helpByCategory();
  return (
    <>
      <h1>Support</h1>
      <p className="lore">
        How the platform works, in plain words; a growing library. Free
        for everyone; no account needed to read it. Numbers and limits
        live on <Link href="/transparency">the transparency page</Link>;
        the law lives in <Link href="/constitution">the constitution</Link>.
      </p>
      {[...shelves.entries()].map(([category, articles]) =>
        articles.length === 0 ? null : (
          <section key={category}>
            <h2>{category}</h2>
            <ul className="discussions">
              {articles.map((a) => (
                <li key={a.slug}>
                  <Link href={`/support/${a.slug}`}>{a.title}</Link>
                  <div className="meta">{a.summary}</div>
                </li>
              ))}
            </ul>
          </section>
        )
      )}
      <p className="lore">
        Didn&rsquo;t find it? Contact us; {" "}
        <a href="mailto:info@agoranet.ai">info@agoranet.ai</a>
      </p>
    </>
  );
}
