import Link from "next/link";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import { LearnMore } from "@/components/LearnMore";
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
    from?: string;
    to?: string;
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
    from: params.from ? new Date(params.from) : undefined,
    to: params.to ? new Date(`${params.to}T23:59:59Z`) : undefined,
  };

  const pillars = await db.pillar.findMany({ orderBy: { position: "asc" } });
  const hits = q ? await search(db, q, filters, viewer?.id ?? null) : [];
  if (q && viewer) await recordSearch(db, viewer.id, q);

  return (
    <>
      <h1>
        Search
        <LearnMore label="About search — what the one box can find">
          <h4>One box, nine kinds of thing</h4>
          <ul>
            <li>
              <strong>Content</strong> — Discussions, replies, Circle
              pages, Chamber storefronts.
            </li>
            <li>
              <strong>Souls</strong> — look up anyone by @handle or
              display name.
            </li>
            <li>
              <strong>Fellow souls</strong> — search within your own
              list.
            </li>
            <li>
              <strong>Places</strong> — Circles working in a city or
              region.
            </li>
            <li>
              <strong>Pillars &amp; canon</strong> — the 49 questions and
              56 domains.
            </li>
            <li>
              <strong>Civic records</strong> — governance results, the
              rulebook, treasury days.
            </li>
            <li>
              <strong>Polls</strong> — open now, or past results.
            </li>
            <li>
              <strong>Sources</strong> — every conversation citing a
              study or article. Paste a URL to find each room discussing
              it.
            </li>
            <li>
              <strong>Help</strong> — how the platform works, fees,
              rules.
            </li>
          </ul>
          <p>
            The filters narrow by kind, pillar, permanence, place, or
            date. Never here: direct messages, workshop interiors, and
            moderator identities — by law, not by ranking.
          </p>
        </LearnMore>
      </h1>
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
        <div className="search-hero">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="A topic, a @handle, a city, a study URL, a rule…"
          />
          <button type="submit">Search</button>
        </div>
        <div className="search-filters">
          <label className="search-filter">
            Type
            <select name="type" defaultValue={params.type ?? ""}>
              <option value="">Everything</option>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ENTITY_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="search-filter">
            Pillar
            <select name="pillar" defaultValue={params.pillar ?? ""}>
              <option value="">Any pillar</option>
              {pillars.map((p) => (
                <option key={p.id} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="search-filter">
            Permanence
            <select name="permanence" defaultValue={params.permanence ?? ""}>
              <option value="">Any</option>
              <option value="permanent">Permanent record</option>
              <option value="deletable">Author-deletable</option>
            </select>
          </label>
          <label className="search-filter">
            Polls
            <select name="pollStatus" defaultValue={params.pollStatus ?? ""}>
              <option value="">Any status</option>
              <option value="open">Open now</option>
              <option value="closed">Past results</option>
            </select>
          </label>
          <label className="search-filter">
            Place
            <input
              name="place"
              defaultValue={params.place ?? ""}
              placeholder="Anywhere"
            />
          </label>
          <label className="search-filter">
            From
            <input type="date" name="from" defaultValue={params.from ?? ""} />
          </label>
          <label className="search-filter">
            To
            <input type="date" name="to" defaultValue={params.to ?? ""} />
          </label>
          <label className="search-filter search-check">
            <input
              type="checkbox"
              name="hasSources"
              defaultChecked={params.hasSources === "on"}
            />
            sourced only
          </label>
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
