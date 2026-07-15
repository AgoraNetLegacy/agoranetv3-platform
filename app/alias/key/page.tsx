import { redirect } from "next/navigation";
import { peekOneTimeSecret } from "@/lib/webSession";
import { acknowledgeSecretSaved } from "@/app/actions";
import { SecretBox } from "@/components/SecretBox";

export const dynamic = "force-dynamic";

export default async function AliasKeyPage() {
  const accessKey = await peekOneTimeSecret();
  if (!accessKey) redirect("/alias");

  return (
    <div className="ceremony">
      <h2>Your Alias access key</h2>
      <p>
        <strong>Save it — shown exactly once, and deliberately hard to
        recover.</strong> A recovery path through your identity would be a
        linkage channel, so there isn't one; a lost key means hatching a
        successor.
      </p>
      {/* Deliberately the same generic filename as a True Self access
          key — a download named "alias" would be a small linkage
          artifact on disk. */}
      <SecretBox value={accessKey} downloadAs="agoranet-access-key.txt" />
      <p>
        Your Alias will activate at a random moment{" "}
        <strong>within the next few days</strong>, alongside a cohort of
        others. We never announce the exact time — not even to you — because
        a signal to your True Self about your Alias would itself be the
        link we promise never to create.{" "}
        <strong>How you&rsquo;ll know: try this key at sign-in — the day it
        works, your Alias is live.</strong> You&rsquo;ll sign it in once on
        each browser; after that, switching faces is one click in the top
        bar.
      </p>
      <form action={acknowledgeSecretSaved}>
        <input type="hidden" name="next" value="/" />
        <button type="submit">I saved it</button>
      </form>
    </div>
  );
}
