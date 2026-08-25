import { loginFace } from "@/app/actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  return (
    <div className="ceremony">
      <h2>Sign in to AgoraNet</h2>
      <p>
        Use the access key for the identity you want to use. Your True Self
        and Alias have separate keys. Sign in once on each browser; after
        that, choose True Self or Alias from the profile menu.
      </p>
      {m && <div className="notice">{m}</div>}
      <form action={loginFace}>
        <label>
          Access key
          <input type="password" name="accessKey" required autoComplete="off" />
        </label>
        <button type="submit">Sign in</button>
      </form>
      <section className="login-next-step" aria-labelledby="alias-next-step">
        <h3 id="alias-next-step">Finished creating your True Self?</h3>
        <p>
          Create your Alias next for private participation. Your Alias is a
          separate identity and will receive its own access key.
        </p>
        <Link className="login-next-step-action" href="/alias">
          Create your Alias
        </Link>
      </section>
      <p className="login-first-step">
        Completely new to AgoraNet? <Link href="/verify">Create your True Self first.</Link>
      </p>
    </div>
  );
}
