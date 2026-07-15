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
        <strong>Step 2 of 7 — the first of two secrets you&rsquo;ll save
        today.</strong> This one is your proof of being one real human —
        think of it as a passport. You&rsquo;ll present it at big moments
        only: creating your True Self in the next step, and creating your
        Alias if you ever choose to. (The second secret, two steps from
        now, is different: it&rsquo;s the everyday sign-in key for one
        profile — a house key, not a passport.)
      </p>
      <p>
        <strong>Save it now — Copy or Download. It is shown exactly
        once.</strong> AgoraNet keeps only a scrambled fingerprint of it,
        so we can recognize it but never read or resend it.
      </p>
      <SecretBox value={credential} downloadAs="agoranet-humanity-credential.txt" />
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
