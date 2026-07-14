import Link from "next/link";

export const dynamic = "force-dynamic";

// Stage 6 — onboarding ends by completing the action that triggered it.
// The original intent is preserved through the ceremony and fulfilled
// here (ONBOARDING §2.6).
export default async function DonePage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  return (
    <div className="ceremony">
      <h2>You're verified — one human, one voice</h2>
      {returnTo ? (
        <p>
          Now finish what you came to do:{" "}
          <Link href={returnTo}>return to where the gate met you →</Link>
        </p>
      ) : (
        <p>
          <Link href="/?welcome=1">Step into the Agora — your dashboard →</Link>
        </p>
      )}
      <p className="interim-note">
        A note kept deliberately out of your settings: whenever you want a
        second face, the Alias ceremony starts from your credential — see
        the orientation notes, or ask any soul where aliases hatch.
      </p>
    </div>
  );
}
