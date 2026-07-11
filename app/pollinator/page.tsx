import Link from "next/link";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import { chamberActivityLevel, pendingInvitesFor } from "@/lib/chambers";
import { getRail } from "@/lib/rails";
import { submitChamber } from "@/app/actions";

export const dynamic = "force-dynamic";

// The Pollinator (Phase 7.5 — NEURAL_POLLINATOR_SPEC, launch scope:
// Chambers only). Browsing is free — reading is free, platform-wide;
// there is no entry gate, no unlock fee, no membership wall (§3).
// Storefronts are the discovery surface (§4.3). The Leaderboard and
// Tournament of Ideas are post-launch by owner decision — nothing here
// depends on them.

export default async function PollinatorPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; q?: string }>;
}) {
  const { m, q } = await searchParams;
  const [viewer, feePc, feeG, postPc, postG] = await Promise.all([
    activeFace(),
    getRail(db, "chamber.creationFeePc"),
    getRail(db, "chamber.creationFeeG"),
    getRail(db, "chamber.postFeePc"),
    getRail(db, "chamber.postFeeG"),
  ]);

  const chambers = await db.chamber.findMany({
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
  });

  const activity = new Map<string, "active" | "quiet">();
  for (const c of chambers) activity.set(c.id, await chamberActivityLevel(db, c));

  const entered = viewer
    ? new Set(
        (
          await db.chamberMember.findMany({
            where: { profileId: viewer.id },
            select: { chamberId: true },
          })
        ).map((mm) => mm.chamberId)
      )
    : new Set<string>();
  const invites = viewer ? await pendingInvitesFor(db, viewer.id) : [];

  const publicChambers = chambers.filter((c) => c.isPublic);
  const privateVisible = chambers.filter(
    (c) => !c.isPublic && (entered.has(c.id) || invites.some((i) => i.chamberId === c.id))
  );
  const privateOthers = chambers.filter(
    (c) => !c.isPublic && !entered.has(c.id) && !invites.some((i) => i.chamberId === c.id)
  );

  return (
    <>
      <h1>🐝 The Pollinator — the idea incubator</h1>
      <p className="lore">
        A chamber is an enclosed pod dedicated to one idea: break it down
        to first principles, bring knowledge and debate, work it toward
        viability. Unlike Discussions (open-air), you enter a chamber to
        see what&apos;s inside — the storefront is public, the workshop is
        enclosed. Browsing is free; acting costs, in <strong>both
        tokens</strong> — the Pollinator is the first surface priced in
        PollCoin and Gratium together, so its souls carry a working stock
        of both.
      </p>
      <p className="interim-note">
        The Leaderboard and the Tournament of Ideas — where the best
        public chambers compete to become the community&apos;s main
        mission — arrive after launch, once chambers have real usage.
      </p>
      {m && <div className="notice">{m}</div>}

      {invites.length > 0 && (
        <>
          <h3>Waiting for you — private invitations</h3>
          <ul className="discussions">
            {invites.map((i) => (
              <li key={i.id}>
                <Link href={`/pollinator/${i.chamber.id}`}>{i.chamber.title}</Link>{" "}
                <span className="badge permanent">Invited</span>
                <div className="meta">
                  The creator selected you — visible to you alone, here (no
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

      <h3>Public chambers — storefronts, free to read</h3>
      <ul className="discussions">
        {publicChambers.map((c) => (
          <li key={c.id}>
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
          <li className="lore">No public chambers yet — the incubator awaits its first idea.</li>
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
            Minimal storefronts by design — a name and a marker. Invite-only;
            never eligible for the tournament.
          </p>
          <ul className="discussions">
            {privateOthers.map((c) => (
              <li key={c.id}>
                <Link href={`/pollinator/${c.id}`}>{c.title}</Link>{" "}
                <span className="badge locked">Private — invite-only</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>Create a chamber</h3>
      {viewer ? (
        <details>
          <summary>
            Open a new chamber — {feePc} PC + {feeG} G (the dual-token
            signature), live immediately
          </summary>
          <form action={submitChamber} className="composer">
            <label>
              Title
              <input type="text" name="title" required maxLength={80} />
            </label>
            <label>
              The subject — one idea: a topic, question, inquiry, initiative, or proposal
              <input type="text" name="subject" required maxLength={200} />
            </label>
            <label>
              Storefront pitch — the public face of the idea
              <textarea name="pitch" required maxLength={2000} />
            </label>
            <label>
              Why should people care — what problem, for whom, why now
              <textarea
                name="whyCare"
                required
                maxLength={1000}
                placeholder="A chamber that cannot answer this isn't ready to ask for attention."
              />
            </label>
            <p className="interim-note">
              <strong>The pre-convo scaffold</strong> — the platform&apos;s
              first-principles method, productized. Work starts oriented,
              not adrift; you can sharpen these as understanding grows
              (edit history stays visible in the workshop).
            </p>
            <label>
              1. What are we solving? — the goal statement
              <textarea name="solving" required maxLength={1000} />
            </label>
            <label>
              2. What do we need to know? — the information and expertise the work requires
              <textarea name="needToKnow" required maxLength={1000} />
            </label>
            <label>
              3. What does success look like? — the definition of done
              <textarea name="success" required maxLength={1000} />
            </label>
            <label>
              Visibility — fixed at creation{" "}
              <select name="visibility" defaultValue="public">
                <option value="public">
                  Public — anyone verified carrying both tokens may enter; tournament-eligible later
                </option>
                <option value="private">
                  Private — you select who gets invited; never competes
                </option>
              </select>
            </label>
            <p className="interim-note">
              Workshop contents are deletable-class with due process —
              enclosed, not the permanent record. Participation inside
              costs {postPc} PC + {postG} G per post. Your Light Score is
              public on a public chamber&apos;s storefront: you can build
              in any standing, but never behind a curtain.
            </p>
            <button type="submit">
              Open the chamber · {feePc} PC + {feeG} G
            </button>
          </form>
        </details>
      ) : (
        <p className="interim-note">
          Reading is free.{" "}
          <Link href={`/verify?returnTo=${encodeURIComponent("/pollinator")}`}>
            Verify once to create or enter →
          </Link>
        </p>
      )}
    </>
  );
}
