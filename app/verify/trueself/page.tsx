import { createTrueSelf } from "@/app/actions";
import { JourneySteps } from "@/components/JourneySteps";
import { TurnstileField } from "@/components/TurnstileField";

export const dynamic = "force-dynamic";

// Stage 3; True Self creation. A chosen handle: "true" means singular,
// durable, and accountable; not legal-name (owner-confirmed 2026-07-06).
export default async function TrueSelfPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; m?: string }>;
}) {
  const { returnTo, m } = await searchParams;
  return (
    <div className="ceremony">
      <JourneySteps current="trueself" />
      <h2>Create your True Self</h2>
      <p>
        Every human gets exactly one True Self; and the check that
        enforces this is blind: it can tell someone is trying twice
        without ever learning who they are. Naming has two layers: a{" "}
        <strong>display name</strong> (free-form; real names welcome,
        duplicates allowed, changeable) and a unique{" "}
        <strong>@handle</strong>; your permanent signature on every
        record, never recycled, never transferred.
      </p>
      {m && <div className="notice">{m}</div>}
      <form action={createTrueSelf}>
        <input type="hidden" name="returnTo" value={returnTo ?? ""} />
        <label>
          Your Humanity Credential
          <input type="password" name="credential" required autoComplete="off" />
        </label>
        <label>
          Display name
          <input type="text" name="displayName" required maxLength={60} />
        </label>
        <label>
          @handle (3–30 characters: letters, digits, _ or -)
          <input type="text" name="handle" required maxLength={30} />
        </label>
        <TurnstileField siteKey={process.env.TURNSTILE_SITE_KEY} />
        <button type="submit">Register through the gate</button>
      </form>
    </div>
  );
}
