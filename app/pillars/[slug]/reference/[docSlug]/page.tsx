import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { checkParking, BlockedPanel } from "@/app/parkingGate";
import { MECHANISM_DOCS } from "@/lib/mechanismDocs.generated";
import { Markdown } from "@/lib/markdown";

export const dynamic = "force-dynamic";

// A mechanism reference document (DASHBOARD §5.4): dense source material
// behind the pillar's diagnosis, rendered verbatim, deliberately
// secondary to the dashboard itself.
export default async function ReferencePage({
  params,
}: {
  params: Promise<{ slug: string; docSlug: string }>;
}) {
  const { slug, docSlug } = await params;
  const pillar = await db.pillar.findUnique({ where: { slug } });
  if (!pillar) notFound();
  const doc = MECHANISM_DOCS.find((m) => m.pillarSlug === slug && m.slug === docSlug);
  if (!doc) notFound();

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

  return (
    <>
      <p>
        <Link href={`/pillars/${pillar.slug}`}>← {pillar.name}</Link>
      </p>
      <h1>{doc.title}</h1>
      <p className="lore">
        Reference material; the mechanism behind {pillar.name}&rsquo;s
        diagnosis. Ported verbatim from the ratified corpus.
      </p>
      <Markdown source={doc.markdown} />
    </>
  );
}
