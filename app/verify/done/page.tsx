import Link from "next/link";
import { safePath } from "@/lib/safePath";

export const dynamic = "force-dynamic";

// Stage 6; onboarding ends by completing the action that triggered it.
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
      <h2>You&apos;re verified; one human, two identities</h2>
      {returnTo ? (
        <p>
          Now finish what you came to do:{" "}
          <Link href={safePath(returnTo, "/")}>return to where the gate met you →</Link>
        </p>
      ) : (
        <p>
          <Link href="/?welcome=1">Step into the Agora; your dashboard →</Link>
        </p>
      )}
      <p className="interim-note">
        You can use your True Self or create one Alias later. Both identities
        can speak, but they remain separate, and together they count as one
        verified human and one vote.
      </p>
    </div>
  );
}
