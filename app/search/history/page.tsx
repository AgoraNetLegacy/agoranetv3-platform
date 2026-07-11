import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import { deleteSearchQuery, clearSearchHistory } from "@/app/actions";

export const dynamic = "force-dynamic";

// Search history (§4.2): stored per profile, visible to the soul,
// deletable, never used to rank anything.
export default async function SearchHistoryPage() {
  const face = await activeFace();
  if (!face) redirect("/login");

  const queries = await db.searchQuery.findMany({
    where: { profileId: face.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <>
      <p>
        <Link href="/search">← Search</Link>
      </p>
      <h1>Your search history</h1>
      <p className="lore">
        Visible to you alone, per-face, deletable — and never used to rank
        anything. @{face.handle}&rsquo;s searches; your other face has its
        own page.
      </p>
      {queries.length === 0 ? (
        <p className="lore">No searches recorded for this face.</p>
      ) : (
        <>
          <form action={clearSearchHistory}>
            <button type="submit">Delete all {queries.length}</button>
          </form>
          <ul className="discussions">
            {queries.map((sq) => (
              <li key={sq.id}>
                <Link href={`/search?q=${encodeURIComponent(sq.query)}`}>{sq.query}</Link>
                <span className="lore"> · {sq.createdAt.toLocaleString()}</span>{" "}
                <form action={deleteSearchQuery} className="inline">
                  <input type="hidden" name="id" value={sq.id} />
                  <button type="submit" className="linklike">
                    delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
