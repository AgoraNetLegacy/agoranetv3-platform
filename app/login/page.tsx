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
      <h2>Sign in a face</h2>
      <p>
        Each face signs in with its own access key; never with your
        credential, and never through the other face. Paste it; hand-typing
        64 characters is nobody&rsquo;s job. <strong>This is a one-time
        introduction per browser:</strong> once a face is signed in here,
        switching to it is one click in the top bar, keys never asked
        again.
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
        New here? <a href="/verify">Create your True Self.</a> Holding a
        credential and wanting a second face? Choose{" "}
        <a href="/alias">Create an Alias</a>.
      </p>
    </div>
  );
}
