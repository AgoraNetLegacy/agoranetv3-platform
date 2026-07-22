import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PillarMark } from "@/components/Icon";
import { closeDuePolls } from "@/lib/polls";
import { checkParking, BlockedPanel } from "@/app/parkingGate";
import { editorialFor } from "@/lib/pillarContent";
import { PillarAnatomy, asSortKey } from "../PillarAnatomy";

export const dynamic = "force-dynamic";

// The full pillar dashboard (DASHBOARD §5): Why banner with the pillar's
// full identity → the shared anatomy (stat row, domain cards, canon
// threads, Circles, the Governance door, mechanism deep-dive). The
// Agora's dashboard IS the platform dashboard (PRESENTATION_SPEC §1.1,
// owner-corrected: one thing, not two) — its slug redirects home.
export default async function PillarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { slug } = await params;
  const sort = asSortKey((await searchParams).sort);

  const pillar = await db.pillar.findUnique({ where: { slug } });
  if (!pillar) notFound();
  if (pillar.isMeta) redirect("/");

  const parking = await checkParking(pillar.id);
  if (parking.state === "blocked") {
    return (
      <BlockedPanel
        pillarName={pillar.name}
        pillarId={pillar.id}
        pillarSlug={pillar.slug}
        heldByHandle={parking.heldByHandle}
        heldByFace={parking.heldByFace}
      />
    );
  }

  await closeDuePolls(db);
  const editorial = editorialFor(pillar.slug);

  return (
    <>
      <p>
        <Link href="/pillars">← The Seven Pillars</Link>
      </p>

      {/* The Why banner (§5.1): emotional context + the pillar's full
          identity, shown once a soul has actually entered. */}
      <div
        className="why-banner"
        style={
          {
            borderLeft: `5px solid ${pillar.colorPrimary}`,
            // The tint rides a CSS variable so globals.css can compose
            // it into the frosted/sheen treatment instead of painting a
            // flat pastel.
            "--banner-tint": pillar.colorLight,
          } as React.CSSProperties
        }
      >
        <h1 style={{ marginBottom: "0.1rem" }}>
          <PillarMark slug={pillar.slug} /> {pillar.name}
        </h1>
        <p className="lore" style={{ marginTop: 0 }}>
          {pillar.classicalName} — {pillar.loreName}
        </p>
        <p className="why-text">{editorial.whyBanner}</p>
        <p className="lore">
          Flagship Stoic principle: <em>{editorial.stoicPrinciple}</em>
        </p>
      </div>

      <PillarAnatomy
        slug={pillar.slug}
        sort={sort}
        sortBasePath={`/pillars/${pillar.slug}`}
      />

      <p className="lore" style={{ marginTop: "1.5rem" }}>
        Read the Pictures. Challenge one with a repair. Join a domain's
        Discussion, or find a Circle already working the problem — this
        pillar is a place to act, not just to read.
      </p>
    </>
  );
}
