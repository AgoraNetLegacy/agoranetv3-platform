import { redirect } from "next/navigation";
import { peekOneTimeSecret } from "@/lib/webSession";
import { acknowledgeSecretSaved } from "@/app/actions";
import { SecretBox } from "@/components/SecretBox";
import { JourneySteps } from "@/components/JourneySteps";

export const dynamic = "force-dynamic";

// The face's access key; per-face login secret, shown once. Each face
// has its own key so signing in never routes through the human.
export default async function AccessKeyPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  const accessKey = await peekOneTimeSecret();
  if (!accessKey) redirect("/verify");

  const next = `/verify/consents${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;
  return (
    <div className="ceremony">
      <JourneySteps current="key" />
      <h2>Your access key</h2>
      <p>
        <strong>Step 4 of 7; the second of your two secrets, and the
        last.</strong> This is not the credential you saved two steps ago
; that one proves you&rsquo;re human; this one is simply how this
        profile signs in. Passport, then house key: the credential opens
        the big ceremonies, this key opens your everyday door.
      </p>
      <p>
        <strong>Save it; Copy or Download. It is shown exactly
        once.</strong> The good news: you rarely need it. You are already
        signed in on this browser, and each profile signs in{" "}
        <strong>once per browser, ever</strong>; after that, switching is
        one click in the top bar. You&rsquo;ll only reach for this key on
        a new browser or device.
      </p>
      <SecretBox value={accessKey} downloadAs="agoranet-access-key.txt" />
      <form action={acknowledgeSecretSaved}>
        <input type="hidden" name="next" value={next} />
        <button type="submit">I saved it; continue to consent</button>
      </form>
    </div>
  );
}
