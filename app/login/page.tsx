import { loginFace } from "@/app/actions";

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
      <p className="interim-note">
        New here? <a href="/verify">Create your True Self.</a> Already have
        a True Self? <a href="/alias">Create an Alias</a> for private
        participation.
      </p>
    </div>
  );
}
