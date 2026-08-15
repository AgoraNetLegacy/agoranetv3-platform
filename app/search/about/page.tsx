import Link from "next/link";

export const dynamic = "force-dynamic";

// The published search ranking (FEED_AND_SEARCH §4.2): like the lens;
// no formula a soul can't read.
export default async function SearchAboutPage() {
  return (
    <>
      <p>
        <Link href="/search">← Search</Link>
      </p>
      <h1>How search results are ranked</h1>
      <blockquote className="opening-question">
        score = match quality (exact @handle 4 · title/name 2–3 · body 1)
        + substance signals (participants, members, citations, sourced
        posts); sorted highest first, ties alphabetical.
      </blockquote>
      <ul>
        <li>
          <strong>Match quality:</strong> a hit in a title, name, or handle
          outranks a hit inside a body of text; an exact @handle match
          outranks everything.
        </li>
        <li>
          <strong>Substance signals:</strong> the platform&rsquo;s own
          currencies of quality; distinct participants, Circle members,
          citation counts, sourced posts. Never views, never dwell time,
          never engagement metrics: the platform does not measure them.
        </li>
        <li>
          <strong>No personalization:</strong> same query, same results, for
          everyone; a legibility feature and a correlation-safety feature
          at once. Your search history is never a ranking input.
        </li>
      </ul>
      <h3>What is never in the index</h3>
      <ul>
        <li>
          Workshop and members&rsquo;-room interiors; a member searching
          inside a space they belong to is in-space search, scoped to that
          space (the search box in the room itself).
        </li>
        <li>Direct messages, in any form.</li>
        <li>Moderator and badge-holder identity (anti-lobbying law).</li>
        <li>
          Anything cross-persona: search must never bridge a soul&rsquo;s
          two faces, and no data exists from which to bridge them.
        </li>
      </ul>
    </>
  );
}
