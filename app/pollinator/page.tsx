import Link from "next/link";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import {
  chamberActivityLevel,
  chamberCreationCost,
  pendingInvitesFor,
  workshopPostCost,
} from "@/lib/chambers";
import { submitChamber } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { LearnMore } from "@/components/LearnMore";
import { chamberCoversEnabled } from "@/lib/chamberCovers";
import {
  canAffordDualCost,
  dualBalanceOf,
  dualInsufficientFundsReason,
} from "@/lib/economy";
import { synchronizedWalletBalanceView } from "@/lib/synchronizedWalletBalance";
import { walletLinkFor, cardanoNetwork } from "@/lib/chain";
import { walletModeActivationReady } from "@/lib/progressiveEconomy";
import { WalletChamberComposer } from "@/components/WalletChamberComposer";
import {
  prepareWalletChamberAction,
  recordWalletChamberSubmissionAction,
  finalizeWalletChamberAction,
  rejectWalletChamberAction,
} from "@/app/actions";

export const dynamic = "force-dynamic";

// The Pollinator (Phase 7.5; NEURAL_POLLINATOR_SPEC, launch scope:
// Chambers only). Browsing is free; reading is free, platform-wide;
// there is no entry gate, no unlock fee, no membership wall (§3).
// Storefronts are the discovery surface (§4.3). The Leaderboard and
// Tournament of Ideas are post-launch by owner decision; nothing here
// depends on them.

export default async function PollinatorPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; q?: string }>;
}) {
  const { m, q } = await searchParams;
  const coversEnabled = chamberCoversEnabled();
  const [viewer, creationCost, postCost] = await Promise.all([
    activeFace(),
    chamberCreationCost(db),
    workshopPostCost(db),
  ]);
  // Pollinator fees settle from platform-held tokens. Wallet-held dPOLL/dGRA
  // cannot pay them yet (WALLET_CANONICAL_TOKEN_RAIL_SPEC §17), so wallet
  // holdings are reported separately and never folded into the figure the
  // create button is gated on.
  const platformHeld = viewer ? await dualBalanceOf(db, viewer.id) : null;
  const walletMode = viewer?.economyMode === "wallet" || viewer?.economyMode === "mixed";
  const walletBalance = viewer && walletMode
    ? (await synchronizedWalletBalanceView(viewer.id)).balances
    : { PC: "0", G: "0" };
  const walletHeldPc = Number(walletBalance.PC);
  const walletHeldG = Number(walletBalance.G);
  const canCreate = platformHeld ? canAffordDualCost(platformHeld, creationCost) : false;
  // Self-custody settlement: both tokens in one signed transaction. Offered
  // whenever this identity holds its own keys, so choosing self-custody never
  // costs a soul the ability to build here (DECISIONS_PENDING #28).
  const walletLink = viewer && walletMode ? await walletLinkFor(db, viewer.id) : null;
  const walletSettlementReady = Boolean(
    walletMode && walletModeActivationReady() && walletLink && walletLink.network === cardanoNetwork()
  );
  const walletCostLabel = `${creationCost.PC} dPOLL + ${creationCost.G} dGRA`;
  // Failures are placed in the query string. Do not replay any stale balance
  // rejection after the canonical PC/G check says the user can create;
  // otherwise an earlier failed submission makes the repaired page look broken.
  const staleBalanceNotice = Boolean(
    m &&
      (m.includes("Insufficient PollCoin") ||
        m.includes("both are required") ||
        m.includes("Insufficient platform-held") ||
        m.includes("earnable path covers committed souls"))
  );
  const noticeMessage = staleBalanceNotice
    ? canCreate
      ? null
      : platformHeld
        ? dualInsufficientFundsReason(platformHeld, creationCost)
        : null
    : m;

  const [chambers, enteredRows, invites] = await Promise.all([
    db.chamber.findMany({
      where: q
        ? {
            OR: [
              { title: { contains: q } },
              // Private storefronts are minimal (name + private marker):
              // only public chambers match on their pitch content.
              { isPublic: true, subject: { contains: q } },
              { isPublic: true, whyCare: { contains: q } },
            ],
          }
        : {},
      include: { members: { select: { id: true } } },
      orderBy: { lastActivityAt: "desc" },
    }),
    viewer
      ? db.chamberMember.findMany({
          where: { profileId: viewer.id },
          select: { chamberId: true },
        })
      : Promise.resolve([]),
    viewer ? pendingInvitesFor(db, viewer.id) : Promise.resolve([]),
  ]);

  const activity = new Map<string, "active" | "quiet">();
  for (const chamber of chambers) {
    activity.set(chamber.id, chamberActivityLevel(db, chamber));
  }

  const entered = new Set(enteredRows.map((membership) => membership.chamberId));

  const publicChambers = chambers.filter((c) => c.isPublic);
  const privateVisible = chambers.filter(
    (c) => !c.isPublic && (entered.has(c.id) || invites.some((i) => i.chamberId === c.id))
  );
  const privateOthers = chambers.filter(
    (c) => !c.isPublic && !entered.has(c.id) && !invites.some((i) => i.chamberId === c.id)
  );

  return (
    <>
      <h1>
        <Icon name="hive" /> Neural Pollinator
        <LearnMore label="About the Neural Pollinator; the idea incubator">
          <h4>The idea incubator</h4>
          <p>
            <em>Workshop an idea before you defend it in public.</em> A
            chamber is an enclosed pod dedicated to one idea: break it
            down to first principles, bring knowledge and debate, work
            it toward viability.
          </p>
          <p>
            Unlike Discussions (open-air), you enter a chamber to see
            what&rsquo;s inside; the <strong>storefront is public, the
            workshop is enclosed</strong>. Workshop conversation is
            deletable working material, never the permanent record, and
            never in the search index; the case a chamber eventually
            makes in public is what enters the record.
          </p>
          <p>
            Browsing is free; acting costs <strong>both PollCoin and
            Gratium</strong>. The Pollinator is the one surface that charges in
            both tokens, deliberately: building here means carrying a working
            stock of each, and neither substitutes for the other.
            After launch, the Leaderboard and the Tournament of Ideas
            arrive: the best public chambers compete to become the
            community&rsquo;s main mission.
          </p>
        </LearnMore>
      </h1>
      <p className="interim-note">
        The Leaderboard and the Tournament of Ideas; where the best
        public chambers compete to become the community&apos;s main
        mission; arrive after launch, once chambers have real usage.
      </p>
      {noticeMessage && <div className="notice">{noticeMessage}</div>}

      {invites.length > 0 && (
        <>
          <h3>Waiting for you; private invitations</h3>
          <ul className="discussions">
            {invites.map((i) => (
              <li key={i.id}>
                <Link href={`/pollinator/${i.chamber.id}`}>{i.chamber.title}</Link>{" "}
                <span className="badge permanent">Invited</span>
                <div className="meta">
                  The creator selected you; visible to you alone, here (no
                  notification category exists for invites yet, by design:
                  the list is exhaustive).
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>Find a chamber</h3>
      <form method="get" className="inline" style={{ marginBottom: "0.75rem" }}>
        <input
          name="q"
          placeholder="Search storefronts (never workshop interiors)"
          defaultValue={q ?? ""}
          style={{ width: "20rem" }}
        />{" "}
        <button type="submit">Search</button>
      </form>

      <h3>Public chambers; storefronts, free to read</h3>
      <ul className="discussions">
        {publicChambers.map((c) => (
          <li key={c.id}>
            {c.coverImageUrl && (
              <img
                className="storefront-card-image"
                src={c.coverImageUrl}
                alt={c.coverImageAlt ?? ""}
              />
            )}
            <Link href={`/pollinator/${c.id}`}>{c.title}</Link>{" "}
            {activity.get(c.id) === "active" ? (
              <span className="badge permanent">Active this week</span>
            ) : (
              <span className="badge locked">Quiet</span>
            )}{" "}
            {entered.has(c.id) && <span className="badge permanent">Entered</span>}
            <div className="meta">
              {c.subject.length > 120 ? `${c.subject.slice(0, 120)}…` : c.subject}
            </div>
            <div className="meta">
              Why care: {c.whyCare.length > 140 ? `${c.whyCare.slice(0, 140)}…` : c.whyCare}
            </div>
            <div className="meta">
              by @{c.creatorHandle} · {c.members.length} soul
              {c.members.length === 1 ? "" : "s"} inside
            </div>
          </li>
        ))}
        {publicChambers.length === 0 && (
          <li className="lore">No public chambers yet; the incubator awaits its first idea.</li>
        )}
      </ul>

      {privateVisible.length > 0 && (
        <>
          <h3>Your private chambers</h3>
          <ul className="discussions">
            {privateVisible.map((c) => (
              <li key={c.id}>
                <Link href={`/pollinator/${c.id}`}>{c.title}</Link>{" "}
                <span className="badge locked">Private</span>{" "}
                {entered.has(c.id) && <span className="badge permanent">Entered</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      {privateOthers.length > 0 && (
        <>
          <h3>Private chambers</h3>
          <p className="lore">
            Minimal storefronts by design; a name and a marker. Invite-only;
            never eligible for the tournament.
          </p>
          <ul className="discussions">
            {privateOthers.map((c) => (
              <li key={c.id}>
                <Link href={`/pollinator/${c.id}`}>{c.title}</Link>{" "}
                <span className="badge locked">Private; invite-only</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>Create a chamber</h3>
      {viewer ? (
        <details className="chamber-create">
          <summary className="chamber-create-summary">
            <span>
              <strong>Start creating a chamber</strong>
              <span className="chamber-create-hint">
                Fill out the idea brief; {creationCost.PC} PC and {creationCost.G} G, live immediately
              </span>
            </span>
          </summary>
          <form action={submitChamber} className="composer">
            <div className="chamber-field">
              <label htmlFor="chamber-title">
                <span className="field-label">Title; the short name</span>
              </label>
              <input
                id="chamber-title"
                type="text"
                name="title"
                required
                maxLength={80}
                placeholder="A clear name for your chamber"
              />
            </div>
            <div className="chamber-field">
              <label htmlFor="chamber-subject">
                <span className="field-label">
                  Subject; the specific idea, question, or proposal
                </span>
              </label>
              <input
                id="chamber-subject"
                type="text"
                name="subject"
                required
                maxLength={200}
                placeholder="What is this chamber exploring?"
              />
            </div>
            <label>
              Storefront pitch; the public profile of the idea
              <textarea name="pitch" required maxLength={2000} />
            </label>
            {coversEnabled && (
              <fieldset className="chamber-cover-fields">
                <legend>Optional storefront cover</legend>
                <label>
                  Cover image
                  <input
                    name="coverImage"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                  />
                  <span className="field-help">
                    JPEG, PNG, or WebP; up to 5 MB. We remove metadata and
                    prepare a consistent public cover.
                  </span>
                </label>
                <label>
                  Image description
                  <input
                    name="coverImageAlt"
                    type="text"
                    maxLength={160}
                    placeholder="People rebuilding something together"
                  />
                  <span className="field-help">
                    Optional; describe what the image communicates, or leave
                    blank if it is decorative.
                  </span>
                </label>
              </fieldset>
            )}
            <label>
              Why should people care; what problem, for whom, why now
              <textarea
                name="whyCare"
                required
                maxLength={1000}
                placeholder="A chamber that cannot answer this isn't ready to ask for attention."
              />
            </label>
            <p className="interim-note">
              <strong>The pre-convo scaffold</strong>; the platform&apos;s
              first-principles method, productized. Work starts oriented,
              not adrift; you can sharpen these as understanding grows
              (edit history stays visible in the workshop).
            </p>
            <label>
              1. What are we solving?; the goal statement
              <textarea name="solving" required maxLength={1000} />
            </label>
            <label>
              2. What do we need to know?; the information and expertise the work requires
              <textarea name="needToKnow" required maxLength={1000} />
            </label>
            <label>
              3. What does success look like?; the definition of done
              <textarea name="success" required maxLength={1000} />
            </label>
            <label>
              Visibility; fixed at creation{" "}
              <select name="visibility" defaultValue="public">
                <option value="public">
                  Public; anyone verified may enter; tournament-eligible later
                </option>
                <option value="private">
                  Private; you select who gets invited; never competes
                </option>
              </select>
            </label>
            <p className="interim-note">
              Workshop contents are deletable-class with due process;
              enclosed, not the permanent record. Participation inside
              costs {postCost.PC} PC and {postCost.G} G per post; both
              tokens, every time. Your Light Score is
              public on a public chamber&apos;s storefront: you can build
              in any standing, but never behind a curtain.
            </p>
            <p className="interim-note">
              This chamber costs {creationCost.PC.toFixed(2)} PC <em>and</em>{" "}
              {creationCost.G.toFixed(2)} G. The Pollinator is the one surface
              that charges in both tokens, so building here means carrying a
              working stock of each; neither substitutes for the other.
              You hold {(platformHeld?.PC ?? 0).toFixed(2)} PC and{" "}
              {(platformHeld?.G ?? 0).toFixed(2)} G in platform custody.
              {walletMode && (
                <>
                  {" "}Your linked wallet holds {walletHeldPc.toFixed(2)} PC and{" "}
                  {walletHeldG.toFixed(2)} G.{" "}
                  {walletSettlementReady
                    ? "This form spends platform-held tokens; to pay from the wallet you control, use the self-custody option below."
                    : "Wallet-held tokens cannot pay from here; connect this identity's Lace wallet to open a chamber from your own custody."}
                </>
              )}
            </p>
            <button type="submit" disabled={!canCreate}>
              Open the chamber · {creationCost.PC} PC + {creationCost.G} G
            </button>
            {!canCreate && platformHeld && (
              <p className="interim-note">
                {dualInsufficientFundsReason(platformHeld, creationCost)}
                {walletSettlementReady
                  ? " Your own wallet can pay this instead; see below."
                  : ""}
              </p>
            )}
          </form>
        </details>
      ) : null}
      {viewer && walletSettlementReady ? (
        <details className="chamber-create">
          <summary className="chamber-create-summary">
            <span>
              <strong>Open a chamber from your own wallet</strong>
              <span className="chamber-create-hint">
                Self-custody; {walletCostLabel}, approved once in Lace
              </span>
            </span>
          </summary>
          <WalletChamberComposer
            costLabel={walletCostLabel}
            prepare={prepareWalletChamberAction}
            recordSubmission={recordWalletChamberSubmissionAction}
            finalize={finalizeWalletChamberAction}
            reject={rejectWalletChamberAction}
          />
        </details>
      ) : null}
      {viewer ? null : (
        <p className="interim-note">
          Reading is free.{" "}
          <Link href={`/verify?returnTo=${encodeURIComponent("/pollinator")}`}>
          Create your True Self to create or enter →
          </Link>
        </p>
      )}
    </>
  );
}
