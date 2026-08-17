import { completeOrientation } from "@/app/actions";
import { JourneySteps } from "@/components/JourneySteps";

export const dynamic = "force-dynamic";

// Stage 4.3; orientation: skippable, revisitable. The tour points, it
// doesn't lecture (ONBOARDING §2.4). This is also where Aliases are
// DISCOVERED; ambient documentation, never a campaign, and never a
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
          <strong>Seven pillars.</strong> Six examine the forces that hold us
          back: Compassion, Hope, Justice, Freedom, Unity, Harmony. The seventh,
          The Agora, examines the platform itself. Each carries seven
          founding questions; that's where Discussions live.
        </li>
        <li>
          <strong>Your identities use separate rooms.</strong> Each pillar
          allows only one of your identities at a time. If you enter a pillar
          as your True Self, your Alias must wait until you leave; the two can
          never appear there together. A blocked-entry message is the privacy
          protection working, not an error.
        </li>
        <li>
          <strong>Light Score</strong> is per identity and per pillar; never
          a single number, never global, and your two identities&rsquo; standings
          never touch.
        </li>
        <li>
          <strong>Everyone can have one Alias.</strong> Use it when you want
          to speak about something sensitive, share an experience privately,
          or make an argument without using your public name. You can create
          your Alias whenever you are ready.
        </li>
        <li>
          <strong>Permanent spaces preserve what you write.</strong> Look for
          the amber banner and composer badge before you post. They show that
          your words cannot be quietly changed or deleted.
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
