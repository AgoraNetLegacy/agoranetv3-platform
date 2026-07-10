import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import { getRail } from "@/lib/rails";
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
  const cooldownDays = await getRail(db, "identity.displayNameCooldownDays");

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
    </div>
  );
}
