import { createTrueSelf } from "@/app/actions";

export const dynamic = "force-dynamic";

// Stage 3 — True Self creation. A chosen handle: "true" means singular,
// durable, and accountable — not legal-name (owner-confirmed 2026-07-06).
export default async function TrueSelfPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; m?: string }>;
}) {
  const { returnTo, m } = await searchParams;
  return (
    <div className="ceremony">
      <h2>Create your True Self</h2>
      <p>
        One per human — enforced blind by the registration nullifier: a
        second attempt fails without the platform ever learning who was
        refused. Your handle is chosen, not legal: singular, durable, and
        accountable. You may use your real name if you wish; nothing
        verifies or requires it.
      </p>
      {m && <div className="notice">{m}</div>}
      <form action={createTrueSelf}>
        <input type="hidden" name="returnTo" value={returnTo ?? ""} />
        <label>
          Your Humanity Credential
          <input type="password" name="credential" required autoComplete="off" />
        </label>
        <label>
          Handle
          <input type="text" name="handle" required maxLength={40} />
        </label>
        <button type="submit">Register through the gate</button>
      </form>
    </div>
  );
}
