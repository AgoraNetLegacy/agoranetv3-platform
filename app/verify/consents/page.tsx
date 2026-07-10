import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import { PERMANENCE_CONSENT, CONSTITUTION_ACK } from "@/lib/disclosures";
import { acknowledgeConsent } from "@/app/actions";

export const dynamic = "force-dynamic";

// Stage 4 — the two blocking acknowledgments, in order. Written plainly,
// not as legal wallpaper; they cannot be scrolled past (ONBOARDING §2.4).
export default async function ConsentsPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  const face = await activeFace();
  if (!face) redirect("/verify");

  const acks = await db.consentAck.findMany({ where: { profileId: face.id } });
  const hasPermanence = acks.some((a) => a.kind === "permanence");
  const hasConstitution = acks.some((a) => a.kind === "constitution");
  const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";

  if (hasPermanence && hasConstitution) {
    redirect(`/verify/tour${query}`);
  }

  if (!hasPermanence) {
    return (
      <div className="ceremony">
        <h2>Permanence — read before your first post</h2>
        <p>{PERMANENCE_CONSENT.text}</p>
        <form action={acknowledgeConsent}>
          <input type="hidden" name="kind" value="permanence" />
          <input type="hidden" name="next" value={`/verify/consents${query}`} />
          <button type="submit">I understand what permanence means here</button>
        </form>
      </div>
    );
  }

  return (
    <div className="ceremony">
      <h2>The Constitution — the rules of this space</h2>
      <p>{CONSTITUTION_ACK.summary}</p>
      <p className="interim-note">
        The full founding document is part of the public record; this
        acknowledgment names version {CONSTITUTION_ACK.version}.
      </p>
      <form action={acknowledgeConsent}>
        <input type="hidden" name="kind" value="constitution" />
        <input type="hidden" name="next" value={`/verify/tour${query}`} />
        <button type="submit">I acknowledge the Constitution</button>
      </form>
    </div>
  );
}
