import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import { getRail } from "@/lib/rails";
import { faceConstellation, scoreChangeLog } from "@/lib/lightScore";
import { updateDisplayName } from "@/app/actions";

export const dynamic = "force-dynamic";

// The face's own profile surface. Two-layer naming (2026-07-10): the
// display name changes here (rate-limited rail); the @handle never does.
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const face = await activeFace();
  if (!face) redirect("/login");
  const [cooldownDays, constellation, changes] = await Promise.all([
    getRail(db, "identity.displayNameCooldownDays"),
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
        {face.joinedPeriod}
      </p>
      {m && <div className="notice">{m}</div>}
      <p>
        Your <strong>@handle is forever</strong> — it is the attribution key
        on every record you sign, unique across the whole platform, never
        recycled. Your <strong>display name</strong> is yours to change
        (at most once every {cooldownDays} days): live surfaces update;
        anything in the permanent record keeps the name it was written
        under.
      </p>
      <form action={updateDisplayName}>
        <label>
          Display name
          <input
            type="text"
            name="displayName"
            defaultValue={face.displayName}
            required
            maxLength={60}
          />
        </label>
        <button type="submit">Change display name</button>
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
            {p.icon} <strong>{p.name}</strong>: {p.points}
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
