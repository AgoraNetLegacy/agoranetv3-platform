import Link from "next/link";

export const dynamic = "force-dynamic";

// Stage 4.3 — orientation: skippable, revisitable. The tour points, it
// doesn't lecture (ONBOARDING §2.4). This is also where Aliases are
// DISCOVERED — ambient documentation, never a campaign, and never a
// button inside a True Self session (§3.1–3.2).
export default async function TourPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
  return (
    <div className="ceremony">
      <h2>Sixty seconds of orientation</h2>
      <ul>
        <li>
          <strong>Seven pillars.</strong> Six diagnose what's broken —
          Compassion, Hope, Justice, Freedom, Unity, Harmony. The seventh,
          The Agora, examines the platform itself. Each carries seven
          canonical questions; that's where Discussions live.
        </li>
        <li>
          <strong>The parking rule protects you.</strong> One face per
          pillar at a time, enforced — your True Self and Alias can never
          appear in the same room together. Blocked entry isn't an error;
          it's the protection working.
        </li>
        <li>
          <strong>Light Score</strong> is per-face and per-pillar — never
          a single number, never global, and your two faces' standings
          never touch.
        </li>
        <li>
          <strong>Aliases exist.</strong> When you want a second face —
          for the argument you can't afford professionally, the struggle
          you won't wear publicly — you hatch it later, on your own
          schedule, with your credential. It is deliberately not a button
          in these settings: the ceremony starts from your credential, the
          way a wallet-side act should.
        </li>
        <li>
          <strong>Permanent spaces are labeled at the door</strong> — the
          amber banner and the composer badge. You already consented to
          what that means.
        </li>
      </ul>
      <Link href={`/verify/seed${query}`}>Continue to the values seed →</Link>
    </div>
  );
}
