import { ALIAS_DISCLOSURES } from "@/lib/disclosures";
import { hatchAlias } from "@/app/actions";

export const dynamic = "force-dynamic";

// The Alias ceremony (ONBOARDING §3) — deliberately decoupled: initiated
// with the credential (the interim wallet-side path), never from inside
// a True Self session's settings. The §3.6 disclosures are blocking.
export default async function AliasPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  return (
    <div className="ceremony">
      <h2>Hatch an Alias</h2>
      <p>
        Your second face: for the argument you can't afford professionally,
        the report you can't sign, the struggle you won't wear publicly.
        One per human, enforced blind. This ceremony starts from your
        Humanity Credential — not from any logged-in session — so the
        platform only ever sees a fresh, unattributable registration
        arrive.
      </p>
      <h3>Read this first — it's the honest part</h3>
      <ol className="disclosure-list">
        {ALIAS_DISCLOSURES.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ol>
      {m && <div className="notice">{m}</div>}
      <form action={hatchAlias}>
        <label>
          Your Humanity Credential
          <input type="password" name="credential" required autoComplete="off" />
        </label>
        <label>
          Alias handle
          <input type="text" name="handle" required maxLength={40} />
        </label>
        <label>
          <input type="checkbox" name="disclosuresAccepted" required /> I have
          read the disclosures above and understand what is and isn't
          protected.
        </label>
        <p />
        <button type="submit">Hatch through the gate</button>
      </form>
    </div>
  );
}
