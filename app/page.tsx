import Link from "next/link";
import { db } from "@/lib/db";
import { activateDueAliases } from "@/lib/identity";
import { editorialFor } from "@/lib/pillarContent";
import { faceConstellation } from "@/lib/lightScore";
import { activeFace } from "@/lib/webSession";

export const dynamic = "force-dynamic";

// The hub (DASHBOARD §4): six outer pillar tiles + The Agora styled as
// the hub-within-the-hub (grid-with-Agora-set-apart — the spec's
// sanctioned fallback to the radial wheel). Each tile: the pillar's
// color, icon, Display Name, and one hook line; Classical and Lore names
// wait inside the pillar (§4.2). The cross-pillar glance for the active
// face shows per-pillar standing side by side — a constellation, never
// a sum.
export default async function Hub() {
  // Opportunistic cohort release — due Aliases activate on hub traffic.
  await activateDueAliases(db);

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
                {p.icon} <strong>{p.name}</strong>
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
        <Link href={`/pillars/${agora.slug}`} className="tile-title">
          {agora.icon} <strong>{agora.name}</strong>
        </Link>
        <div className="hook">{agoraEditorial.hookLine}</div>
        <div className="lore">
          The meta-pillar: the platform's own structure, legitimacy, and
          survival — cross-pillar by nature.
          {constellation?.forPillar(agora.id) &&
          constellation.forPillar(agora.id)!.points !== 0
            ? ` Your standing here: ${constellation.forPillar(agora.id)!.points}.`
            : ""}
        </div>
      </div>

      <p className="lore" style={{ marginTop: "1.2rem" }}>
        <Link href="/feed">Your feed</Link> · <Link href="/search">Search</Link> ·{" "}
        <Link href="/transparency">Transparency dashboard</Link> ·{" "}
        <Link href="/ledger">The civic ledger</Link>
      </p>
    </>
  );
}
