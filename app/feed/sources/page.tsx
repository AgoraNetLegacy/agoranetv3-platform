import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import { ensureFeedDefaults } from "@/lib/feed";
import { saveFeedSources } from "@/app/actions";

export const dynamic = "force-dynamic";

// Source management (§2.1): one screen, adjustable anytime. Everything
// here is this face's own reading state — never public, never ledgered,
// never shared with the other face.
export default async function FeedSourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const face = await activeFace();
  if (!face) redirect("/login");

  const settings = await ensureFeedDefaults(db, face.id);
  const [pillars, sources, myCircles, myChambers, followedPolls, followedDomains, bondCount] =
    await Promise.all([
      db.pillar.findMany({ orderBy: { position: "asc" } }),
      db.feedSource.findMany({ where: { profileId: face.id } }),
      db.circleMember.findMany({
        where: { profileId: face.id, leftAt: null },
        include: { circle: { select: { id: true, name: true } } },
      }),
      db.chamberMember.findMany({
        where: { profileId: face.id },
        include: { chamber: { select: { id: true, title: true } } },
      }),
      db.feedSource.findMany({ where: { profileId: face.id, kind: "poll" } }),
      db.feedSource.findMany({ where: { profileId: face.id, kind: "domain" } }),
      db.fellowSoulBond.count({
        where: { OR: [{ aProfileId: face.id }, { bProfileId: face.id }] },
      }),
    ]);

  const followedPillarIds = new Set(
    sources.filter((s) => s.kind === "pillar").map((s) => s.refId)
  );
  const followedCircleIds = new Set(
    sources.filter((s) => s.kind === "circle").map((s) => s.refId)
  );
  const followedChamberIds = new Set(
    sources.filter((s) => s.kind === "chamber").map((s) => s.refId)
  );
  const fellowSoulsOn = sources.some((s) => s.kind === "fellow-souls");
  const polls = await db.poll.findMany({
    where: { id: { in: followedPolls.map((p) => p.refId!) } },
    select: { id: true, title: true },
  });
  const domains = await db.domain.findMany({
    where: { id: { in: followedDomains.map((d) => d.refId!) } },
    include: { pillar: { select: { name: true, icon: true, slug: true } } },
  });

  return (
    <>
      <p>
        <Link href="/feed">← Your feed</Link>
      </p>
      <h1>Choose what feeds it</h1>
      <p className="lore">
        Chosen, not inferred: the machine never watches your behavior to
        guess your interests. These choices belong to{" "}
        <strong>@{face.handle}</strong> alone — your other face has its own
        screen, and nothing crosses between them, ever.
      </p>
      {m && <div className="notice">{m}</div>}

      <form action={saveFeedSources} className="composer">
        <h3>Pillars</h3>
        {pillars.map((p) => (
          <label key={p.id} style={{ display: "block" }}>
            <input
              type="checkbox"
              name="pillar"
              value={p.id}
              defaultChecked={followedPillarIds.has(p.id)}
            />{" "}
            {p.icon} {p.name}
          </label>
        ))}

        <h3>Your Circles</h3>
        {myCircles.length === 0 ? (
          <p className="lore">You belong to no Circles with this face.</p>
        ) : (
          myCircles.map((mc) => (
            <label key={mc.circle.id} style={{ display: "block" }}>
              <input
                type="checkbox"
                name="circle"
                value={mc.circle.id}
                defaultChecked={followedCircleIds.has(mc.circle.id)}
              />{" "}
              ⭕ {mc.circle.name} <span className="lore">(members&rsquo;-room activity)</span>
            </label>
          ))
        )}

        <h3>Chambers you&rsquo;ve entered</h3>
        {myChambers.length === 0 ? (
          <p className="lore">You&rsquo;ve entered no chambers with this face.</p>
        ) : (
          myChambers.map((mc) => (
            <label key={mc.chamber.id} style={{ display: "block" }}>
              <input
                type="checkbox"
                name="chamber"
                value={mc.chamber.id}
                defaultChecked={followedChamberIds.has(mc.chamber.id)}
              />{" "}
              🐝 {mc.chamber.title} <span className="lore">(workshop activity)</span>
            </label>
          ))
        )}

        {domains.length > 0 && (
          <>
            <h3>Domains you follow</h3>
            {domains.map((d) => (
              <label key={d.id} style={{ display: "block" }}>
                <input type="checkbox" name="domain" value={d.id} defaultChecked />{" "}
                {d.pillar.icon} {d.pillar.name} → {d.position}. {d.title}
              </label>
            ))}
          </>
        )}

        {polls.length > 0 && (
          <>
            <h3>Polls you follow</h3>
            {polls.map((p) => (
              <label key={p.id} style={{ display: "block" }}>
                <input type="checkbox" name="poll" value={p.id} defaultChecked /> 🗳 {p.title}
              </label>
            ))}
          </>
        )}

        <h3>Fellow souls</h3>
        <label style={{ display: "block" }}>
          <input type="checkbox" name="fellowSouls" defaultChecked={fellowSoulsOn} /> Surface
          public Discussions where your fellow souls are active
          <span className="lore">
            {" "}
            (off by default; you have {bondCount} bond{bondCount === 1 ? "" : "s"} — only you
            ever see this)
          </span>
        </label>

        <h3>The lens &amp; the diet</h3>
        <label style={{ display: "block" }}>
          <input type="checkbox" name="openLens" defaultChecked={settings.openLens} /> Show the
          open lens (&ldquo;Popular now&rdquo; — published formula, same for everyone)
        </label>
        <label style={{ display: "block" }}>
          <input type="checkbox" name="balancedDiet" defaultChecked={settings.balancedDiet} />{" "}
          Balanced diet — interleave across pillars so one interest can&rsquo;t monopolize
          the stream <span className="lore">(default on; the default expresses the platform&rsquo;s values)</span>
        </label>

        <p className="lore">
          Discussions you post in follow automatically (join = follow) and
          surface under &ldquo;you joined this Discussion&rdquo;. Declared
          interests (Onboarding Stage 5.5) will appear here as an
          additional chosen source when that stage ships.
        </p>
        <button type="submit">Save sources</button>
      </form>
    </>
  );
}
