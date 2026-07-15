import { completeOrientation } from "@/app/actions";
import { JourneySteps } from "@/components/JourneySteps";

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
      <JourneySteps current="tour" />
      <h2>Sixty seconds of orientation</h2>
      <ul>
        <li>
          <strong>Seven pillars.</strong> Six diagnose what's broken —
          Compassion, Hope, Justice, Freedom, Unity, Harmony. The seventh,
          The Agora, examines the platform itself. Each carries seven
          founding questions; that's where Discussions live.
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
          you won't wear publicly — you can create one later, on your own
          schedule. It's deliberately not a button in settings; when the
          moment comes, the Alias page will ask for the credential you
          saved today.
        </li>
        <li>
          <strong>Permanent spaces are labeled at the door</strong> — the
          amber banner and the composer badge. You already consented to
          what that means.
        </li>
      </ul>
      <form action={completeOrientation}>
        <input type="hidden" name="returnTo" value={returnTo ?? ""} />
        <button type="submit" className="linklike">
          Continue to the values seed →
        </button>
      </form>
    </div>
  );
}
