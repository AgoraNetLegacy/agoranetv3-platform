import { redirect } from "next/navigation";
import { peekOneTimeSecret } from "@/lib/webSession";
import { VERIFICATION_FRESHNESS } from "@/lib/disclosures";
import { acknowledgeSecretSaved } from "@/app/actions";
import { SecretBox } from "@/components/SecretBox";
import { JourneySteps } from "@/components/JourneySteps";

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
      <JourneySteps current="credential" />
      <h2>Your Humanity Credential</h2>
      <p>
        This is your credential — the interim stand-in for the wallet
        credential a real issuer will hold at Phase B.{" "}
        <strong>Save it somewhere safe. It is shown exactly once</strong>{" "}
        and AgoraNet keeps only a one-way hash. You will need it to create
        your True Self now, and your Alias whenever you choose to hatch one.
      </p>
      <SecretBox value={credential} />
      <p className="notice">
        <strong>
          If you lose this credential, we cannot recover it — there is no
          support process, no exception.
        </strong>{" "}
        The interim issuer has no safe way to confirm a returning human
        without trusting an unverifiable claim. Real recovery already
        works on our test rails: a returning human who re-proves to the
        real issuer gets their SAME identity back, nothing orphaned. That
        arrives here with the issuer cutover — until it does, treat this
        credential as unrecoverable.
      </p>
      <p className="notice">{VERIFICATION_FRESHNESS}</p>
      <form action={acknowledgeSecretSaved}>
        <input type="hidden" name="next" value={next} />
        <button type="submit">I saved it — continue</button>
      </form>
    </div>
  );
}
