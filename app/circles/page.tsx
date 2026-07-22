import Link from "next/link";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import { alignmentPillarsFor, lastAttestedAt, circleStatusLabel } from "@/lib/circles";
import { getRail } from "@/lib/rails";
import { submitCircle } from "@/app/actions";
import { Icon, PillarMark } from "@/components/Icon";

export const dynamic = "force-dynamic";

// Discovery v1 (CIRCLES §4): browse + filters + ONE transparent
// values-alignment signal. No matchmaking algorithm on day one — and
// every surfaced recommendation shows its reason in plain language. An
// opaque recommender is a narrative-capture surface; transparent-reason
// recommendation is a product-identity commitment.

export default async function CirclesPage({
  searchParams,
}: {
  searchParams: Promise<{
    m?: string;
    pillar?: string;
    domain?: string;
    place?: string;
    q?: string;
    status?: string;
  }>;
}) {
  const { m, pillar: pillarFilter, domain: domainFilter, place, q, status } = await searchParams;
  const [pillars, domains, viewer, creationFee] = await Promise.all([
    db.pillar.findMany({ orderBy: { position: "asc" } }),
    db.domain.findMany({
      orderBy: [{ pillarId: "asc" }, { position: "asc" }],
      include: { pillar: { select: { name: true, icon: true, position: true } } },
    }),
    activeFace(),
    getRail(db, "circle.creationFee"),
  ]);

  const circles = await db.circle.findMany({
    where: {
      ...(pillarFilter ? { pillar: { slug: pillarFilter } } : {}),
      ...(domainFilter ? { domainId: domainFilter } : {}),
      ...(place ? { placeTag: { contains: place } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { purpose: { contains: q } },
              { problem: { contains: q } },
            ],
          }
        : {}),
    },
    include: {
      pillar: true,
      domain: { select: { title: true, position: true } },
      members: { where: { leftAt: null }, select: { profileId: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const attested = await lastAttestedAt(db, circles.map((c) => c.id));
  const labels = new Map<string, "active" | "inactive" | "closed">();
  for (const c of circles) labels.set(c.id, await circleStatusLabel(db, c));
  const filtered = status
    ? circles.filter((c) => labels.get(c.id) === status)
    : circles;

  // Recency of last attested action orders the browse (§4/§6.3) —
  // active hands above old claims, formation date as the fallback.
  const ranked = [...filtered].sort(
    (a, b) =>
      (attested.get(b.id)?.getTime() ?? b.createdAt.getTime()) -
      (attested.get(a.id)?.getTime() ?? a.createdAt.getTime())
  );

  // The values-alignment signal, with its why (§4).
  const alignment = viewer ? await alignmentPillarsFor(db, viewer.id) : new Map<string, string>();
  const aligned = viewer
    ? ranked.filter(
        (c) =>
          c.pillarId &&
          alignment.has(c.pillarId) &&
          !c.members.some((mm) => mm.profileId === viewer.id) &&
          labels.get(c.id) !== "closed"
      )
    : [];

  return (
    <>
      <h1><Icon name="circles" /> Circles — the action layer</h1>
      <p>
        <em>Turn talk into proof you acted.</em>
      </p>
      <p className="lore">
        Where deliberation becomes provable action: a bounded group owns a
        problem, works it in their room, and logs what actually got done —
        attested, on the public record, forever.
      </p>
      {m && <div className="notice">{m}</div>}

      {aligned.length > 0 && (
        <>
          <h3>Surfaced for you — and exactly why</h3>
          <ul className="discussions">
            {aligned.slice(0, 5).map((c) => (
              <li key={c.id}>
                <Link href={`/circles/${c.id}`}>{c.name}</Link>
                <div className="meta">
                  Shown because {alignment.get(c.pillarId!)} and this Circle
                  works in {c.pillar!.name}
                  {c.placeTag ? ` (${c.placeTag})` : ""}. No hidden ranking —
                  this overlap is the whole formula.
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>Browse</h3>
      <form method="get" className="inline" style={{ marginBottom: "0.75rem" }}>
        <select name="pillar" defaultValue={pillarFilter ?? ""}>
          <option value="">Any pillar</option>
          {pillars.map((p) => (
            <option key={p.id} value={p.slug}>
              <PillarMark slug={p.slug} /> {p.name}
            </option>
          ))}
        </select>{" "}
        <input name="place" placeholder="Place (city/region)" defaultValue={place ?? ""} style={{ width: "11rem" }} />{" "}
        <input name="q" placeholder="Problem keywords" defaultValue={q ?? ""} style={{ width: "11rem" }} />{" "}
        <select name="status" defaultValue={status ?? ""}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="closed">Closed</option>
        </select>{" "}
        <button type="submit">Filter</button>
      </form>

      <ul className="discussions">
        {ranked.map((c) => {
          const label = labels.get(c.id)!;
          return (
            <li key={c.id}>
              <Link href={`/circles/${c.id}`}>{c.name}</Link>{" "}
              {label === "active" && <span className="badge permanent">Active</span>}
              {label === "inactive" && (
                <span className="badge locked" title="Quiet for a while — honestly labeled, still joinable.">
                  Inactive
                </span>
              )}
              {label === "closed" && <span className="badge locked">Closed — record preserved</span>}
              <div className="meta">
                {c.purpose.length > 140 ? `${c.purpose.slice(0, 140)}…` : c.purpose}
              </div>
              <div className="meta">
                {c.pillar ? <><PillarMark slug={c.pillar.slug} /> {c.pillar.name}</> : "No pillar tag"}
                {c.domain ? ` → ${c.domain.position}. ${c.domain.title}` : ""}
                {c.placeTag ? ` · 📍 ${c.placeTag}` : ""} · {c.members.length}{" "}
                member{c.members.length === 1 ? "" : "s"} ·{" "}
                {attested.get(c.id)
                  ? `last attested action ${attested.get(c.id)!.toLocaleDateString()}`
                  : "no attested actions yet"}
              </div>
            </li>
          );
        })}
        {ranked.length === 0 && (
          <li className="lore">
            No Circles match. Failed and fizzled Circles stay visible by
            design — none exist under this filter yet.
          </li>
        )}
      </ul>

      <h3>Start a Circle</h3>
      {viewer ? (
        <details>
          <summary>Form a new Circle — {creationFee} PC, live immediately, no approval queue</summary>
          <form action={submitCircle} className="composer">
            <label>
              Name
              <input type="text" name="name" required maxLength={80} />
            </label>
            <label>
              Purpose statement — short, plain language: what this Circle exists to do
              <textarea name="purpose" required maxLength={1000} />
            </label>
            <p className="interim-note">
              Focus tags — at least one. Place tags stay city/region level
              (the searchable index is never finer); inside the Circle,
              free text may name venues and meeting places — place
              yourself on the map, never someone else.
            </p>
            <label>
              Pillar{" "}
              <select name="pillarId" defaultValue="">
                <option value="">None</option>
                {pillars
                  .filter((p) => !p.isMeta)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      <PillarMark slug={p.slug} /> {p.name}
                    </option>
                  ))}
              </select>
            </label>{" "}
            <label>
              Domain within that pillar (optional){" "}
              <select name="domainId" defaultValue={domainFilter ?? ""}>
                <option value="">None — the whole pillar</option>
                {pillars
                  .filter((p) => !p.isMeta)
                  .map((p) => (
                    <optgroup key={p.id} label={p.name}>
                      {domains
                        .filter((d) => d.pillarId === p.id)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.position}. {d.title}
                          </option>
                        ))}
                    </optgroup>
                  ))}
              </select>
            </label>{" "}
            <label>
              Place <input type="text" name="placeTag" placeholder="e.g. Kelowna, BC" maxLength={80} />
            </label>
            <label>
              Problem statement{" "}
              <input type="text" name="problem" placeholder="e.g. the food bank gap" maxLength={200} />
            </label>
            <p className="interim-note">
              The founder role is deliberately thin: you'll edit the purpose
              statement and tags, and that's it. Within days of existing, a
              Circle belongs to its members — removals, closure, and
              succession are member votes, never founder powers.
            </p>
            <button type="submit">Form Circle · {creationFee} PC</button>
          </form>
        </details>
      ) : (
        <p className="interim-note">
          Reading is free.{" "}
          <Link href={`/verify?returnTo=${encodeURIComponent("/circles")}`}>
            Verify once to form or join →
          </Link>
        </p>
      )}
    </>
  );
}
