import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import {
  runModerationSweeps,
  activeTermFor,
  caseQueueFor,
  caseFileFor,
  supervisionQueueFor,
  myModerationRating,
  isTribunalMember,
  tribunalDocket,
} from "@/lib/moderation";
import {
  equipOffer,
  passOffer,
  submitCaseRuling,
  submitSupervision,
  submitTribunalCaseRuling,
} from "@/app/actions";

export const dynamic = "force-dynamic";

// The moderation workbench (MODERATION §3). The case file is minimal by
// law: content in context, the alleged rule, standing and history —
// never a person. Souls judge content; the ladder does the sentencing.
export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const face = await activeFace();
  if (!face) redirect("/login");

  await runModerationSweeps(db);

  const [offer, term, rules, tribunal] = await Promise.all([
    db.badgeOffer.findFirst({
      where: { profileId: face.id, status: "offered", expiresAt: { gt: new Date() } },
    }),
    activeTermFor(db, face.id),
    db.rule.findMany({ orderBy: { id: "asc" } }),
    isTribunalMember(db, face.id),
  ]);

  const queue = term ? await caseQueueFor(db, face.id) : [];
  const files = await Promise.all(queue.slice(0, 10).map((c) => caseFileFor(db, c.id)));
  const supervision = term ? await supervisionQueueFor(db, face.id) : [];
  const rating = await myModerationRating(db, face.id);
  const docket = tribunal ? await tribunalDocket(db) : [];
  const docketFiles = await Promise.all(docket.slice(0, 10).map((c) => caseFileFor(db, c.id)));

  return (
    <>
      <h1>The moderation workbench</h1>
      {m && <div className="notice">{m}</div>}

      {offer && (
        <div className="door-banner">
          🎗 <strong>You've been offered a moderation badge.</strong>{" "}
          Sortition chose this face; equip it or pass freely — passing
          concentrates nothing. Offer expires{" "}
          {offer.expiresAt.toLocaleString()}. Service is compensated, never
          charged.
          <p>
            <form action={equipOffer} className="inline">
              <input type="hidden" name="offerId" value={offer.id} />
              <button type="submit">Equip (48-hour term)</button>
            </form>{" "}
            <form action={passOffer} className="inline">
              <input type="hidden" name="offerId" value={offer.id} />
              <button type="submit">Pass</button>
            </form>
          </p>
        </div>
      )}

      {term ? (
        <>
          <p className="lore">
            Badge active until {term.endsAt.toLocaleString()} — hard cutoff,
            no carryover. Cases completed this term: {term.casesCompleted} ·
            Gratium earned: {term.gratiumEarned.toFixed(2)}.
          </p>

          <h3>Case queue ({files.length})</h3>
          {files.map((file) => (
            <div key={file.caseId} className="ceremony">
              <p>
                <span className="badge locked">
                  Alleged: {file.allegedRule} · Tier {file.tier}
                  {file.heavy ? " · HEAVY (permanent space — 3 rulings)" : ""}
                  {file.expedited ? " · EXPEDITED" : ""}
                </span>
              </p>
              {file.parentExcerpt && (
                <p className="lore">In reply to: “{file.parentExcerpt}”</p>
              )}
              <div className="body">“{file.content}”</div>
              <p className="lore">
                Pillar: {file.pillar} · Accused standing: {file.accusedActiveStrikes}{" "}
                active strike(s), {file.accusedPillarStanding} pillar adjustment.
                {file.flagNotes.length > 0 && ` Flag notes: ${file.flagNotes.join(" · ")}`}
              </p>
              <form action={submitCaseRuling}>
                <input type="hidden" name="caseId" value={file.caseId} />
                <select name="verdict" defaultValue="" required>
                  <option value="" disabled>
                    Does this content break the cited rule?
                  </option>
                  <option value="uphold">Uphold — it breaks the rule</option>
                  <option value="decline">Decline — it does not</option>
                  <option value="no-rule-fits">No rule fits (signal the legislature)</option>
                  <option value="escalate">Escalate to the Tribunal</option>
                </select>{" "}
                <select name="citedRuleId" defaultValue={file.allegedRule}>
                  {rules.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} — {r.title}
                    </option>
                  ))}
                </select>{" "}
                <label>
                  <input type="checkbox" name="badFaithFlag" /> flag was bad-faith
                </label>{" "}
                <button type="submit">Rule</button>
              </form>
            </div>
          ))}
          {files.length === 0 && <p className="lore">The queue is clear.</p>}

          {supervision.length > 0 && (
            <>
              <h3>Supervision queue</h3>
              {supervision.map((r) => (
                <div key={r.id} className="ceremony">
                  <p className="lore">
                    A newer moderator ruled “{r.verdict}
                    {r.citedRuleId ? ` (${r.citedRuleId})` : ""}” on case{" "}
                    {r.caseId.slice(0, 8)}… — confirm or override before it
                    takes effect.
                  </p>
                  <form action={submitSupervision} className="inline">
                    <input type="hidden" name="rulingId" value={r.id} />
                    <input type="hidden" name="agree" value="1" />
                    <button type="submit">Agree — confirm</button>
                  </form>{" "}
                  <form action={submitSupervision} className="inline">
                    <input type="hidden" name="rulingId" value={r.id} />
                    <input type="hidden" name="agree" value="0" />
                    <button type="submit">Disagree — escalate</button>
                  </form>
                </div>
              ))}
            </>
          )}

          <h3>My term & rating (visible to you alone)</h3>
          <p className="lore">
            Cases ruled: {rating.casesRuled} · resolved with outcome:{" "}
            {rating.resolvedWithOutcome} · supervision overrides:{" "}
            {rating.supervisionOverrides} · current reward multiplier:{" "}
            {rating.rewardMultiplier}× (inputs are public; the weights are
            not — the only way to raise it is to moderate well).
          </p>
        </>
      ) : (
        !offer && (
          <p className="lore">
            No badge on this face. Badges arrive by sortition when the queue
            needs hands — watch your inbox; offers expire in 12 hours.
          </p>
        )
      )}

      {tribunal && (
        <>
          <h2>⚖ The Tribunal (your seat is active)</h2>
          {docketFiles.map((file) => (
            <div key={file.caseId} className="ceremony">
              <p>
                <span className="badge permanent">
                  Tribunal docket · {file.allegedRule} · Tier {file.tier}
                </span>
              </p>
              <div className="body">“{file.content}”</div>
              <form action={submitTribunalCaseRuling}>
                <input type="hidden" name="caseId" value={file.caseId} />
                <select name="verdict" defaultValue="" required>
                  <option value="" disabled>
                    Verdict
                  </option>
                  <option value="uphold">Uphold</option>
                  <option value="decline">Decline</option>
                </select>{" "}
                <select name="citedRuleId" defaultValue={file.allegedRule}>
                  {rules.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} — {r.title}
                    </option>
                  ))}
                </select>{" "}
                <button type="submit">Rule (majority of seats resolves)</button>
              </form>
            </div>
          ))}
          {docketFiles.length === 0 && <p className="lore">The docket is clear.</p>}
        </>
      )}
    </>
  );
}
