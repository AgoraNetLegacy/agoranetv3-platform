import Link from "next/link";
import { db } from "@/lib/db";
import { editorialFor } from "@/lib/pillarContent";
import { faceConstellation } from "@/lib/lightScore";
import { activeFace } from "@/lib/webSession";
import { PillarMark } from "@/components/Icon";

export const dynamic = "force-dynamic";

// The Seven Pillars index (DASHBOARD §4, rehomed by PRESENTATION_SPEC
// §1.3): six diagnostic tiles + The Agora set apart — which since Phase
// 8.5 IS the platform dashboard, so its tile points home. Each tile:
// the pillar's color, icon, Display Name, one hook line, and the active
// face's standing side by side — a constellation, never a sum.
export default async function SevenPillars() {
  const [pillars, face] = await Promise.all([
    db.pillar.findMany({
      orderBy: { position: "asc" },
      include: { _count: { select: { discussions: true, domains: true } } },
    }),
    activeFace(),
  ]);
  const constellation = face ? await faceConstellation(db, face.id) : null;

  const outer = pillars.filter((p) => !p.isMeta);
  const agora = pillars.find((p) => p.isMeta)!;
  const agoraEditorial = editorialFor(agora.slug);

  return (
    <>
      <h1>The Seven Pillars</h1>
      <p>
        Six pillars diagnose; The Agora equips. Read freely; verify to
        act. Entering a pillar parks your active face there — one face per
        pillar at a time.
      </p>
      <ul className="pillar-grid hub">
        {outer.map((p) => {
          const editorial = editorialFor(p.slug);
          const standing = constellation?.forPillar(p.id);
          return (
            <li key={p.id} style={{ borderTop: `4px solid ${p.colorPrimary}` }}>
              <Link href={`/pillars/${p.slug}`} className="tile-title">
                <PillarMark slug={p.slug} /> <strong>{p.name}</strong>
              </Link>
              <div className="hook">{editorial.hookLine}</div>
              <div className="lore">
                {p._count.domains} domains · {p._count.discussions} Discussions
                {standing && standing.points !== 0
                  ? ` · your standing ${standing.points}`
                  : ""}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="agora-tile" style={{ borderColor: agora.colorPrimary }}>
        <Link href="/" className="tile-title">
          <PillarMark slug={agora.slug} /> <strong>{agora.name}</strong>
        </Link>
        <div className="hook">{agoraEditorial.hookLine}</div>
        <div className="lore">
          The meta-pillar: the platform's own structure, legitimacy, and
          survival — cross-pillar by nature. Its dashboard is the
          platform's front door.
          {constellation?.forPillar(agora.id) &&
          constellation.forPillar(agora.id)!.points !== 0
            ? ` Your standing here: ${constellation.forPillar(agora.id)!.points}.`
            : ""}
        </div>
      </div>
    </>
  );
}
