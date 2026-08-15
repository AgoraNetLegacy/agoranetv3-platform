import Link from "next/link";
import { activeFace } from "@/lib/webSession";
import { ChosenSourcesFeed, LensSection, PollinatorStrip } from "./FeedSections";

export const dynamic = "force-dynamic";

// The feed (FEED_AND_SEARCH_SPEC): what a feed looks like when it
// optimizes FOR the person. Chosen sources + one open lens; every card
// says why it's there; the feed ends. No infinite scroll, no
// variable-reward mechanics, no red-dot economy. Since Phase 8.5 the
// feed's primary home is the Agora dashboard (/); this page remains
// as the full, focused view.
export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const face = await activeFace();

  if (!face) {
    return (
      <>
        <h1>The feed</h1>
        <p className="lore">
          Reading is free. Sign in and the backbone of this page becomes
          the sources <em>you</em> choose; until then, here is the open
          lens everyone sees: same formula, same results, for everyone.
        </p>
        <LensSection />
        <PollinatorStrip />
      </>
    );
  }

  return (
    <>
      <h1>Your feed</h1>
      <p className="lore">
        This feed is yours; <Link href="/feed/sources">choose what feeds it</Link>.
        Assembled only from sources you chose; the machine never watches
        your behavior to guess. Per-face: your other face has its own.
      </p>
      {m && <div className="notice">{m}</div>}
      <ChosenSourcesFeed profileId={face.id} />
      <LensSection />
      <PollinatorStrip />
    </>
  );
}
