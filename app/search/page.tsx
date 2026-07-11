import Link from "next/link";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import {
  search,
  recordSearch,
  ENTITY_TYPES,
  ENTITY_LABELS,
  type EntityType,
  type SearchFilters,
} from "@/lib/search";

export const dynamic = "force-dynamic";

// Search (FEED_AND_SEARCH §4): free for everyone — search is reading.
// Same query, same results, for everyone: a legibility feature and a
// correlation-safety feature at once.
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    pillar?: string;
    place?: string;
    permanence?: string;
    hasSources?: string;
    pollStatus?: string;
  }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const viewer = await activeFace();

  const filters: SearchFilters = {
    types: params.type && ENTITY_TYPES.includes(params.type as EntityType)
      ? [params.type as EntityType]
      : undefined,
    pillarSlug: params.pillar || undefined,
    place: params.place || undefined,
    permanence:
      params.permanence === "permanent" || params.permanence === "deletable"
        ? params.permanence
        : undefined,
    hasSources: params.hasSources === "on" || undefined,
    pollStatus:
      params.pollStatus === "open" || params.pollStatus === "closed"
        ? params.pollStatus
        : undefined,
  };

  const pillars = await db.pillar.findMany({ orderBy: { position: "asc" } });
  const hits = q ? await search(db, q, filters, viewer?.id ?? null) : [];
  if (q && viewer) await recordSearch(db, viewer.id, q);

  return (
    <>
      <h1>Search</h1>
      <p className="lore">
        Nine kinds of thing, one box. Free for everyone — search is
        reading. <Link href="/search/about">How results are ranked →</Link>
        {viewer && (
          <>
            {" "}
            · <Link href="/search/history">Your search history →</Link>
          </>
        )}
      </p>

      <form method="get" className="composer">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="A topic, a @handle, a city, a study URL, a rule…"
          style={{ width: "100%", padding: "0.5rem" }}
        />
        <div style={{ margin: "0.5rem 0", fontSize: "0.85rem" }}>
          <select name="type" defaultValue={params.type ?? ""}>
            <option value="">Everything</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {ENTITY_LABELS[t]}
              </option>
            ))}
          </select>{" "}
          <select name="pillar" defaultValue={params.pillar ?? ""}>
            <option value="">Any pillar</option>
            {pillars.map((p) => (
              <option key={p.id} value={p.slug}>
                {p.icon} {p.name}
              </option>
            ))}
          </select>{" "}
          <select name="permanence" defaultValue={params.permanence ?? ""}>
            <option value="">Any permanence</option>
            <option value="permanent">Permanent record</option>
            <option value="deletable">Author-deletable</option>
          </select>{" "}
          <select name="pollStatus" defaultValue={params.pollStatus ?? ""}>
            <option value="">Polls: any status</option>
            <option value="open">Open now</option>
            <option value="closed">Past results</option>
          </select>{" "}
          <label>
            <input type="checkbox" name="hasSources" defaultChecked={params.hasSources === "on"} />{" "}
            sourced only
          </label>{" "}
          <input
            name="place"
            defaultValue={params.place ?? ""}
            placeholder="Place filter"
            style={{ width: "8rem" }}
          />{" "}
          <button type="submit">Search</button>
        </div>
      </form>

      {q && (
        <>
          <p className="lore">
            {hits.length} result{hits.length === 1 ? "" : "s"} for &ldquo;{q}&rdquo; — same
            results for every soul who searches this.
          </p>
          <ul className="discussions">
            {hits.map((h, i) => (
              <li key={i}>
                <Link href={h.href}>{h.title}</Link>
                {h.badge && <div className="meta">{h.badge}</div>}
                {h.snippet && <div className="meta">{h.snippet}</div>}
              </li>
            ))}
            {hits.length === 0 && (
              <li className="lore">
                Nothing found. Workshop and members&rsquo;-room interiors are
                never in this index (search inside a space you belong to from
                that space); moderator identities are structurally
                unsearchable.
              </li>
            )}
          </ul>
        </>
      )}
    </>
  );
}
