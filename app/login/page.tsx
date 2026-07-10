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
        Each face signs in with its own access key — never with your
        credential, and never through the other face.
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
        New here? <a href="/verify">Verify once, act forever.</a> Holding a
        credential and wanting a second face? The Alias ceremony lives at{" "}
        <a href="/alias">/alias</a> — ambient documentation, never a button
        in your settings.
      </p>
    </div>
  );
}
