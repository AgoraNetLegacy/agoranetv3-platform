import { redirect } from "next/navigation";
import { peekOneTimeSecret } from "@/lib/webSession";
import { acknowledgeSecretSaved } from "@/app/actions";

export const dynamic = "force-dynamic";

// The face's access key — per-face login secret, shown once. Each face
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
      <h2>Your access key</h2>
      <p>
        This key signs this face in — it is separate from your credential,
        and each face gets its own. <strong>Save it; it is shown exactly
        once.</strong> You are now signed in on this browser.
      </p>
      <div className="secret-box">{accessKey}</div>
      <form action={acknowledgeSecretSaved}>
        <input type="hidden" name="next" value={next} />
        <button type="submit">I saved it — continue to consent</button>
      </form>
    </div>
  );
}
