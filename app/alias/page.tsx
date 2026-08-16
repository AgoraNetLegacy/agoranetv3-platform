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
          <strong>The community is small.</strong> Fewer than {smallPopulation}
          active souls means patterns may identify you. Your Alias is
          technically separate, but privacy improves as the community grows.
        </div>
      )}
      <p>
        An Alias is a separate identity for participation you do not want
        tied to your True Self. We do not store a link between them. Your
        Humanity Credential proves that you may create one Alias without
        identifying you to the platform.
      </p>
      <h3>Before you create your Alias</h3>
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
