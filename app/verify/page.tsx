import { GATE_INTRO } from "@/lib/disclosures";
import { beginVerification } from "@/app/actions";
import { db } from "@/lib/db";
import { recordEvent } from "@/lib/analytics";
import { JourneySteps } from "@/components/JourneySteps";
import { LearnMore } from "@/components/LearnMore";
import { TurnstileField } from "@/components/TurnstileField";

export const dynamic = "force-dynamic";

// Stage 1; the decision moment: the gate introduces itself. The Reader
// can decline and keep reading; the gate never nags (ONBOARDING §2.1).
export default async function VerifyIntro({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  // The funnel's top: this doorway was seen. A count and a moment;
  // no cookie, no subject (the page is force-dynamic, so it's a real view).
  await recordEvent(db, "funnel.arrival");
  return (
    <div className="ceremony">
      <JourneySteps current="gate" />
      <h2>The gate</h2>
      <p>{GATE_INTRO.substance}</p>
      {/* Phase A honesty is AMBIENT at this stage (ONBOARDING §Stage 1;
          it is acknowledged at Stage 2, not here). Said plainly on the
          page, with the full disclosure one click away rather than three
          walls of it before the button. Nothing is hidden; it is ordered. */}
      <p className="notice">
        {GATE_INTRO.trustSummary}{" "}
        <LearnMore label="The full honesty notice; what you are trusting us with, and what replaces it">
          <h4>What unlinkability rests on today</h4>
          <p>{GATE_INTRO.phaseA}</p>
          <h4>Who issues your credential right now</h4>
          <p>{GATE_INTRO.interimIssuer}</p>
        </LearnMore>
      </p>
      <form action={beginVerification}>
        <input type="hidden" name="returnTo" value={returnTo ?? ""} />
        <TurnstileField siteKey={process.env.TURNSTILE_SITE_KEY} />
        <button type="submit">Begin verification</button>
      </form>
      <p className="interim-note">
        Or just keep reading; everything public stays free to read, no
        account needed. This screen only reappears when you next try to act.
      </p>
    </div>
  );
}
