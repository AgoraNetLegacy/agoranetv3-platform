import Link from "next/link";
import { db } from "@/lib/db";
import { getRail } from "@/lib/rails";
import { FEED_FORMULA_VERSION } from "@/lib/feed";

export const dynamic = "force-dynamic";

// The published formula (FEED_AND_SEARCH §1.1/§2.2): nothing on the feed
// is ranked by a formula a soul can't read. Human-readable, versioned,
// and rendered live from the rails — the page can never drift from the
// code because both read the same numbers.
export default async function FormulaPage() {
  const [wC, wT, wS, halfLife, resurfaceMin, maxCards] = await Promise.all([
    getRail(db, "feed.lensContributorWeight"),
    getRail(db, "feed.lensTipWeight"),
    getRail(db, "feed.lensSourcedWeight"),
    getRail(db, "feed.lensHalfLifeHours"),
    getRail(db, "feed.saved.resurfaceMinNewPosts"),
    getRail(db, "feed.saved.maxResurfacedCards"),
  ]);

  return (
    <>
      <p>
        <Link href="/feed">← The feed</Link>
      </p>
      <h1>The open lens formula — {FEED_FORMULA_VERSION}</h1>
      <p>
        The &ldquo;Popular now&rdquo; stream is ranked by exactly this, for
        everyone, with no personalization:
      </p>
      <blockquote className="opening-question">
        score = ({wC} × unique contributors + {wT} × unique tippers +{" "}
        {wS} × sourced posts) × 0.5<sup>(hours since last activity ÷ {halfLife})</sup>
      </blockquote>
      <ul>
        <li>
          <strong>Unique contributors</strong> (weighted highest, ×{wC}):
          distinct souls who posted in the discussion inside the activity
          window — breadth of real participation.
        </li>
        <li>
          <strong>Unique tippers</strong> (×{wT}): distinct souls who put
          real Gratium behind a post there — ten 1-Gratium tippers outrank
          one 50-Gratium whale, always.
        </li>
        <li>
          <strong>Sourced posts</strong> (×{wS}): posts carrying a typed,
          inspectable source object — evidence density.
        </li>
        <li>
          <strong>Recency decay</strong>: the whole score halves every{" "}
          {halfLife} hours since the discussion&rsquo;s last activity. The
          activity window is {4 * halfLife} hours ({(4 * halfLife) / 24}{" "}
          days); older activity doesn&rsquo;t count at all.
        </li>
      </ul>
      <h3>What is never an input</h3>
      <ul>
        <li>Views, impressions, dwell time, scroll depth — the platform does not measure them.</li>
        <li>Your identity, history, or behavior — same query, same results, for everyone.</li>
        <li>Payment — paid visibility is rejected on principle, by platform law.</li>
      </ul>
      <h3>The saved-current resurfacing formula — beacon-resurface-v1</h3>
      <p>
        &ldquo;Saved &amp; stirring&rdquo; surfaces a thread <em>you</em>{" "}
        saved only when it has genuinely grown since you last read it,
        ranked by exactly this:
      </p>
      <blockquote className="opening-question">
        priority = (new posts since your last read + new unique voices
        since your last read) × 0.5<sup>(hours since newest post ÷ 72)</sup>
      </blockquote>
      <ul>
        <li>
          A saved thread needs at least {resurfaceMin} new post
          {resurfaceMin === 1 ? "" : "s"} to resurface, and at most{" "}
          {maxCards} resurfaced threads ride one feed load — the feed
          still ends. (Both are rails.)
        </li>
        <li>
          The only personal signal is your own watermark — the moment
          you last read the thread. A time, and nothing else. Your saves
          are private to your face, never a ranking input for anyone
          else, and never counted or shown to authors.
        </li>
      </ul>
      <h3>Versioning &amp; governance</h3>
      <p className="lore">
        This is <strong>{FEED_FORMULA_VERSION}</strong>. Changes are
        announced, dated, and diffable — the weights above are rails
        (poll-adjustable within bounds), and the ratified future is
        community tunability by governance poll: new lenses are just new
        published formulas plugged into the same machinery. Exact starting
        weights are a flagged build-time derivation (the corpus defers
        final weights to real usage data); the inputs themselves are
        ratified law.
      </p>
    </>
  );
}
