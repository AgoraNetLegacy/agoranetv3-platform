import { redirect } from "next/navigation";
import { peekOneTimeSecret } from "@/lib/webSession";
import { VERIFICATION_FRESHNESS } from "@/lib/disclosures";
import { acknowledgeSecretSaved } from "@/app/actions";

export const dynamic = "force-dynamic";

// Stage 2, completion — the "issuer" hands the Humanity Credential to
// the soul. Shown once; the platform keeps only a hash.
export default async function CredentialPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  const credential = await peekOneTimeSecret();
  if (!credential) redirect("/verify");

  const next = `/verify/trueself${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;
  return (
    <div className="ceremony">
      <h2>Your Humanity Credential</h2>
      <p>
        This is your credential — the interim stand-in for the wallet
        credential a real issuer will hold at Phase B.{" "}
        <strong>Save it somewhere safe. It is shown exactly once</strong>{" "}
        and AgoraNet keeps only a one-way hash. You will need it to create
        your True Self now, and your Alias whenever you choose to hatch one.
      </p>
      <div className="secret-box">{credential}</div>
      <p className="notice">{VERIFICATION_FRESHNESS}</p>
      <form action={acknowledgeSecretSaved}>
        <input type="hidden" name="next" value={next} />
        <button type="submit">I saved it — continue</button>
      </form>
    </div>
  );
}
