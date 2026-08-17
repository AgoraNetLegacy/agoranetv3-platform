import Link from "next/link";
import { db } from "@/lib/db";
import { activateDueAliases } from "@/lib/identity";
import { closeDuePolls } from "@/lib/polls";
import { editorialFor } from "@/lib/pillarContent";
import { activeFace } from "@/lib/webSession";
import { ChosenSourcesFeed, LensSection, PollinatorStrip, SavedAndStirring, CommonsNow, BeaconWellbeingMount, BeaconCards, PillarPulse, SourcesRadar, StoicWisdom } from "@/app/feed/FeedSections";
import { PillarAnatomy, asSortKey } from "@/app/pillars/PillarAnatomy";
import { PillarMark } from "@/components/Icon";

export const dynamic = "force-dynamic";

// THE PLATFORM DASHBOARD IS THE AGORA DASHBOARD (PRESENTATION_SPEC §1.1,
// owner-corrected 2026-07-13: one thing, not a home "flavored" like the
// Agora). It carries: the what-is-this-place framing for first arrivals,
// the feed (per-persona for signed-in souls; the open lens for readers),
// the Agora pillar's own anatomy, and doors to everything else. The
// thesis: six pillars examine what holds us back; The Agora equips us to act.
//
// Parking note (derived, flagged in DECISIONS_PENDING): this threshold
// parks nothing; the hub has always been where locks release (§3.3.5),
// and a homepage that could be blocked by your other identity would break
// that ratified rule. The Agora's interior doors (domains, governance,
// threads) park exactly as they always did.
export default async function AgoraDashboard({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; m?: string; welcome?: string }>;
}) {
  // Opportunistic jobs ride the highest-traffic page load.
  // These independent maintenance sweeps should not serialize the
  // dashboard's first response.
  await Promise.all([activateDueAliases(db), closeDuePolls(db)]);

  const { m, welcome, sort: sortParam } = await searchParams;
  const sort = asSortKey(sortParam);

  const [pillars, face] = await Promise.all([
    db.pillar.findMany({
      orderBy: { position: "asc" },
      include: { _count: { select: { discussions: true, domains: true } } },
    }),
    activeFace(),
  ]);
  const agora = pillars.find((p) => p.isMeta)!;
  const editorial = editorialFor(agora.slug);

  return (
    <>
      {/* The dashboard's own backdrop (owner directive: the starfield as
          the page background, not just the hero card). Fixed to the
          viewport; independent of <main>'s box model; and unmounted
          automatically when navigating away from this page. */}
      <div className="agora-dashboard-backdrop" aria-hidden="true" />

      {/* What is this place; the first arrival's framing (§1.1). */}
      <div
        className="why-banner agora-hero"
        style={{ borderLeft: `5px solid ${agora.colorPrimary}` }}
      >
        <h1 style={{ marginBottom: "0.1rem" }}>
          <PillarMark slug={agora.slug} /> {agora.name}
        </h1>
        <p className="lore" style={{ marginTop: 0 }}>
          {agora.classicalName}; {agora.loreName}
        </p>
        <p className="why-text">
          A purpose-built civic commons. Six pillars examine the forces that
          hold us back; The Agora; this room; holds the tools to address them
          together: permanent public discussion, sealed collective
          decisions, provable action. Reading is free, forever. Acting
          requires proving you're one real human, once.
        </p>
        <p className="lore">{editorial.whyBanner}</p>
      </div>

      {m && <div className="notice">{m}</div>}

      {/* The journey's arrival (owner directive 2026-07-14): the flow
          carries a new soul HERE, and the first three moves are named
          instead of implied. Shown once, by the URL the done page sends
; never a nag, gone on the next navigation. */}
      {welcome && face && (
        <div className="ceremony">
          <h3 style={{ marginTop: 0 }}>You&rsquo;re in. Three good first moves:</h3>
          <ol>
            <li>
              <strong>Read one Picture.</strong> Every domain states a
              settled position, plainly; pick a{" "}
              <Link href="/pillars">pillar that matters to you</Link> and
              open its first domain.
            </li>
            <li>
              <strong>Say one thing.</strong> Step through any{" "}
              <Link href="/discussions">Discussion door</Link>; your first
              post is what your Welcome Grant is for.
            </li>
            <li>
              <strong>Choose what feeds you.</strong>{" "}
              <Link href="/feed/sources">Pick your sources</Link>; this
              feed only ever carries what you chose.
            </li>
          </ol>
          <p className="lore" style={{ marginBottom: 0 }}>
            Whenever you want an Alias for the things you can&rsquo;t
            afford to sign, the Alias ceremony waits at{" "}
            <Link href="/alias">/alias</Link>; your own schedule, no
            pressure. And your two codes: wherever you saved them, make
            sure it&rsquo;s somewhere real.
          </p>
        </div>
      )}

      {/* The pillar-tile grid left this dashboard (owner directive
          2026-07-22): the sidebar already carries The Seven Pillars
          door, and the feed is this room's primary occupant. The full
          grid lives at /pillars. */}

      {/* The Beacon assembled (BEACON_FEED_SPEC §5.3): the chosen
          current first, then the memory current (saved & stirring),
          then the commons; and the feed still ends. */}
      {face ? (
        <>
          <h2>Your feed</h2>
          <p className="lore">
            Assembled only from sources you chose; {" "}
            <Link href="/feed/sources">choose what feeds it</Link>. The
            machine never watches your behavior to guess. Your True Self and
            Alias each have their own feed.
          </p>
          <ChosenSourcesFeed profileId={face.id} compactDoor />
          <SavedAndStirring profileId={face.id} />
          <BeaconWellbeingMount profileId={face.id} />
        </>
      ) : (
        <>
          <h2>What the commons is discussing</h2>
          <LensSection />
        </>
      )}
      <CommonsNow />
      <PillarPulse />
      <SourcesRadar />
      <BeaconCards />
      <StoicWisdom />
      <PollinatorStrip />

      {/* The Agora pillar's own anatomy (§1.1): domains, canon threads,
          its Governance door; this room's substance. */}
      <h2 style={{ marginTop: "2rem" }}>This room's anatomy</h2>
      <p className="lore">
        The Agora is a pillar like the six; with domains, canonical
        questions, Circles, and a Governance room; pointed at the
        platform itself: its structure, legitimacy, and survival.
      </p>
      <PillarAnatomy slug={agora.slug} sort={sort} sortBasePath="/" />
    </>
  );
}
