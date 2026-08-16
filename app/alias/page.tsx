import { ALIAS_DISCLOSURES } from "@/lib/disclosures";
import { hatchAlias } from "@/app/actions";
import { db } from "@/lib/db";
import { getRail } from "@/lib/rails";

export const dynamic = "force-dynamic";

// The Alias ceremony (ONBOARDING §3); deliberately decoupled: initiated
// with the credential (the interim wallet-side path), never from inside
// a True Self session's settings. The §3.6 disclosures are blocking.
export default async function AliasPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  // Early-platform honesty (DUAL_IDENTITY §7.2, vector 5): a small crowd
  // thins anonymity, and the UX must say so rather than imply otherwise.
  const [activeSouls, smallPopulation] = await Promise.all([
    db.profile.count({ where: { status: "active" } }),
    getRail(db, "identity.smallPopulationThreshold"),
  ]);
  const early = activeSouls < smallPopulation;
  return (
    <div className="ceremony">
      <h2>Create an Alias</h2>
      <p>
        <em>Say what you can&rsquo;t afford to sign.</em>
      </p>
      {early && (
        <div className="notice">
          <strong>The platform is young; read this honestly.</strong> An
          Alias hides you in a crowd, and right now the crowd is small
          (fewer than {smallPopulation} active souls). In a small
          population, patterns identify people regardless of cryptography;
          &ldquo;the only soul active in both of two niche places&rdquo; is
          a signature. Your Alias is still unlinkable in every record we
          keep; the crowd it hides in simply hasn&rsquo;t arrived yet. This
          note lifts itself as the commons grows.
        </div>
      )}
      <p>
        Your second face: for the argument you can't afford professionally,
        the report you can't sign, the struggle you won't wear publicly.
        Every human gets exactly one; and the check that enforces this is
        blind: it can tell someone is trying twice without learning who.
        This ceremony asks for your Humanity Credential; not your
        signed-in account; so the platform only ever sees a fresh,
        unattributable registration arrive.
      </p>
      <h3>Read this first; it's the honest part</h3>
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
          Alias display name (no relation to your True Self's)
          <input type="text" name="displayName" required maxLength={60} />
        </label>
        <label>
          Alias @handle (unique, eternal; and unlike your True Self's)
          <input type="text" name="handle" required maxLength={30} />
        </label>
        <label>
          <input type="checkbox" name="disclosuresAccepted" required /> I have
          read the disclosures above and understand what is and isn't
          protected.
        </label>
        <p />
        <button type="submit">Create the Alias</button>
      </form>
    </div>
  );
}
