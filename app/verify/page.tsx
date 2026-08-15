import { GATE_INTRO } from "@/lib/disclosures";
import { beginVerification } from "@/app/actions";
import { db } from "@/lib/db";
import { recordEvent } from "@/lib/analytics";
import { JourneySteps } from "@/components/JourneySteps";

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
      <p className="notice">{GATE_INTRO.phaseA}</p>
      <p className="notice">{GATE_INTRO.interimIssuer}</p>
      <form action={beginVerification}>
        <input type="hidden" name="returnTo" value={returnTo ?? ""} />
        <button type="submit">Begin verification</button>
      </form>
      <p className="interim-note">
        Or just keep reading; everything public stays free to read, no
        account needed. This screen only reappears when you next try to act.
      </p>
    </div>
  );
}
