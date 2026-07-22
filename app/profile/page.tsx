import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import { faceConstellation, scoreChangeLog } from "@/lib/lightScore";
import { ALIAS_DISCLOSURES } from "@/lib/disclosures";
import { updateProfileBio } from "@/app/actions";
import { PillarMark } from "@/components/Icon";

export const dynamic = "force-dynamic";

// The face's own profile window (Phase 8.5, PRESENTATION_SPEC §5.2):
// about-me and optional fields, per face ALWAYS — an Alias bio and a
// True Self bio never share a database row or a writing surface. Bios
// are live-surface content (editable), never permanent-record. Display
// name and other controls moved to /settings (§5.1).
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const face = await activeFace();
  if (!face) redirect("/login");
  const [constellation, changes] = await Promise.all([
    faceConstellation(db, face.id),
    scoreChangeLog(db, face.id, 25),
  ]);

  return (
    <div className="ceremony">
      <h2>
        {face.displayName} <span className="lore">@{face.handle}</span>
      </h2>
      <p className="lore">
        {face.face === "TRUE_SELF" ? "True Self" : "Alias"} · joined{" "}
        {face.joinedPeriod} ·{" "}
        <Link href={`/souls/${face.handle}`}>see your public window</Link> ·{" "}
        <Link href="/settings">settings</Link>
      </p>
      {m && <div className="notice">{m}</div>}

      <h3>About you — this face&rsquo;s window</h3>
      <p className="lore">
        Live-surface content: editable anytime, shown on your public soul
        window, never part of the permanent record.
      </p>
      {face.face === "ALIAS" && (
        <div className="notice">
          From your hatch ceremony, still true here:{" "}
          <em>{ALIAS_DISCLOSURES.items[1]}</em>
        </div>
      )}
      <form action={updateProfileBio} className="composer">
        <label>
          About me
          <textarea
            name="bio"
            rows={5}
            maxLength={2000}
            defaultValue={face.bio}
            placeholder="Whatever you want fellow souls to know."
          />
        </label>
        <label>
          Place (optional)
          <input
            type="text"
            name="bioPlace"
            maxLength={120}
            defaultValue={face.bioPlace}
            placeholder="City or region, if you choose"
          />
        </label>
        <p className="lore">
          Place yourself on the map, never someone else — name your own
          city, neighborhood, or nothing at all; other people&rsquo;s
          information and residential addresses don&rsquo;t belong here.
        </p>
        <button type="submit">Save the window</button>
      </form>

      <h3>Your standing — the constellation</h3>
      <p>
        <em>Standing you earn, explained to the point.</em>
      </p>
      <p className="lore">
        Per-pillar, insight-weighted, disagreement-neutral. There is no
        total on purpose: no universal score exists, here or anywhere.
      </p>
      {constellation.pillars.length === 0 && (
        <p className="lore">
          No standing yet — it grows from substantive contributions:
          answers, attested Circle actions, accepted Picture repairs,
          moderation service.
        </p>
      )}
      <ul className="discussions">
        {constellation.pillars.map((p) => (
          <li key={p.pillarId}>
            <PillarMark slug={p.slug} /> <strong>{p.name}</strong>: {p.points}
            <details>
              <summary className="lore">why — the full breakdown</summary>
              <ul>
                {p.lines.map((l, i) => (
                  <li key={i} className="lore">
                    {l.label}: {l.points > 0 ? `+${l.points}` : l.points}
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>

      {changes.length > 0 && (
        <>
          <h3>Recent score changes — every one with its cause</h3>
          <ul className="discussions">
            {changes.map((c, i) => (
              <li key={i}>
                <span className="lore">{c.at.toLocaleDateString()}</span>{" "}
                {c.pillarName}: {c.amount > 0 ? `+${c.amount}` : c.amount} —{" "}
                {c.cause}
              </li>
            ))}
          </ul>
          <p className="lore">
            This log is visible to you alone. No black-box reputation:
            if a number moved, the reason is named.
          </p>
        </>
      )}
    </div>
  );
}
