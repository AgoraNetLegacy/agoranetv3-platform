import { ALIAS_DISCLOSURES } from "@/lib/disclosures";
import { hatchAlias } from "@/app/actions";
import { TurnstileField } from "@/components/TurnstileField";

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
  return (
    <div className="ceremony">
      <h2>Create your Alias for private participation</h2>
      <p>
        <em>Say what you can&rsquo;t afford to sign.</em>
      </p>
      <p>
        An Alias protects honest participation in a world of doxxing,
        character assassination, retaliation, and cancel culture. Use it to
        discuss difficult experiences or sensitive topics without putting
        your public or professional identity at risk. Your
        Alias stays separate from your True Self; we do not store a link
        between them. You remain one verified person while choosing what you
        are ready to attach to your public name.
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
        <TurnstileField siteKey={process.env.TURNSTILE_SITE_KEY} />
        <button type="submit">Create the Alias</button>
      </form>
    </div>
  );
}
