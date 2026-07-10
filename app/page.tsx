import Link from "next/link";
import { db } from "@/lib/db";
import { activateDueAliases } from "@/lib/identity";

export const dynamic = "force-dynamic";

export default async function Hub() {
  // Opportunistic cohort release — due Aliases activate on hub traffic.
  await activateDueAliases(db);

  const pillars = await db.pillar.findMany({
    orderBy: { position: "asc" },
    include: { _count: { select: { discussions: true } } },
  });

  return (
    <>
      <h1>The Seven Pillars</h1>
      <p>
        Six pillars diagnose; The Agora equips. Every pillar carries seven
        canonical questions — read freely; verify to act. Entering a pillar
        parks your active face there (one face per pillar at a time).
      </p>
      <ul className="pillar-grid">
        {pillars.map((p) => (
          <li key={p.id}>
            <Link href={`/pillars/${p.slug}`}>
              {p.icon} <strong>{p.name}</strong>
            </Link>
            <div className="lore">
              {p.classicalName} — {p.loreName}
            </div>
            <div className="lore">
              {p._count.discussions} canonical Discussion{p._count.discussions === 1 ? "" : "s"}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
