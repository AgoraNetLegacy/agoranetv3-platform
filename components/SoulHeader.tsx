// The profile header (PROFILE_PAGE_SPEC §3, owner-ruled 2026-07-22):
// the industry-standard grammar; banner, circular avatar overlapping
// its bottom edge, then name → @handle → chip → meta; with the
// platform's substitutions (no counts, no totals). Served handle-keyed
// from /img/, which falls back to the deterministic mark, so this
// renders for every soul from birth.

import { Icon } from "@/components/Icon";

export function SoulHeader({
  handle,
  displayName,
  face,
  joinedPeriod,
  bioPlace,
  cacheBust,
}: {
  handle: string;
  displayName: string;
  face: string;
  joinedPeriod: string;
  bioPlace?: string | null;
  /** updatedAt ticks from ProfileImage rows, so replacements show
   *  immediately despite the short shared cache. */
  cacheBust?: string;
}) {
  const chipClass = face === "TRUE_SELF" ? "true-self" : "alias";
  const v = cacheBust ? `?v=${encodeURIComponent(cacheBust)}` : "";
  return (
    <header className="soul-header">
      <div className="soul-banner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/img/${handle}/banner${v}`} alt="" />
      </div>
      <div className="soul-header-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="soul-avatar"
          src={`/img/${handle}/avatar${v}`}
          alt={`@${handle}'s mark`}
        />
        <div className="soul-identity">
          <h1>{displayName}</h1>
          <p className="lore">
            @{handle}{" "}
            <span className={`face-chip ${chipClass}`}>
              {face === "TRUE_SELF" ? "◆ True Self" : "◇ Alias"}
            </span>
          </p>
          <p className="lore soul-meta">
            <Icon name="record" /> joined {joinedPeriod}
            {bioPlace ? <> · 📍 {bioPlace}</> : null}
          </p>
        </div>
      </div>
    </header>
  );
}
