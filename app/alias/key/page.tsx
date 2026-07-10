import { redirect } from "next/navigation";
import { peekOneTimeSecret } from "@/lib/webSession";
import { acknowledgeSecretSaved } from "@/app/actions";

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
      <div className="secret-box">{accessKey}</div>
      <p>
        Your Alias will activate at a random moment{" "}
        <strong>within the next few days</strong>, alongside a cohort of
        others. We never announce the exact time — not even to you. Sign in
        with this key once it's active.
      </p>
      <form action={acknowledgeSecretSaved}>
        <input type="hidden" name="next" value="/" />
        <button type="submit">I saved it</button>
      </form>
    </div>
  );
}
