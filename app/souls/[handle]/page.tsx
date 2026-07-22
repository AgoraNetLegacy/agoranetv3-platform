import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import { SoulHeader } from "@/components/SoulHeader";
import { areFellowSouls } from "@/lib/fellowSouls";
import { faceConstellation } from "@/lib/lightScore";
import { submitFellowRequest, submitOpenThread } from "@/app/actions";
import { PillarMark } from "@/components/Icon";

type SoulTab = "posts" | "actions" | "about";
function asTab(v: string | undefined): SoulTab {
  return v === "actions" || v === "about" ? v : "posts";
}

export const dynamic = "force-dynamic";

// The public soul window (Phase 8.5, PRESENTATION_SPEC §5.2): what one
// face chooses to show — display name, @handle, face kind, coarse join
// period, and the live-surface bio. Nothing here is new information:
// every field is either already public or written by the soul for this
// exact window. Pending Aliases don't exist publicly, here or anywhere.
export default async function SoulWindow({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ tab?: string; m?: string }>;
}) {
  const { handle } = await params;
  const { tab: tabRaw, m } = await searchParams;
  const tab = asTab(tabRaw);
  const soul = await db.profile.findFirst({
    where: { handle: handle.toLowerCase(), status: "active" },
  });
  if (!soul) notFound();
  const viewer = await activeFace();
  const isOwn = viewer?.id === soul.id;

  const images = await db.profileImage.findMany({
    where: { profileId: soul.id },
    select: { updatedAt: true },
  });
  const bust = images
    .map((i) => i.updatedAt.getTime())
    .sort()
    .join("-");

  return (
    <div className="ceremony">
      <SoulHeader
        handle={soul.handle}
        displayName={soul.displayName}
        face={soul.face}
        joinedPeriod={soul.joinedPeriod}
        bioPlace={soul.bioPlace}
        cacheBust={bust || undefined}
      />
      {m && <div className="notice">{m}</div>}
      {soul.bio ? (
        <p style={{ whiteSpace: "pre-wrap" }}>{soul.bio}</p>
      ) : (
        <p className="lore">This soul hasn&rsquo;t written a window yet.</p>
      )}

      {/* The CTA row (PROFILE_PAGE_SPEC §1/§3): act on this soul —
          request a bond, open a conversation. Bond state is mutual
          knowledge only (your own pair); declines stay silent. */}
      {isOwn ? (
        <p className="lore">
          This is your window as others see it —{" "}
          <Link href="/profile">edit it here</Link>.
        </p>
      ) : viewer ? (
        <SoulActions viewerId={viewer.id} soul={soul} />
      ) : (
        <p className="lore">
          <Link href="/login">Sign in</Link> to reach out — requests wait
          quietly; nothing ticks at anyone.
        </p>
      )}

      {/* Standing — the constellation, public like the search lane's
          per-pillar standing. Never a sum (Invariant 3); the private
          why-breakdown stays on the soul's own page. */}
      <SoulConstellation profileId={soul.id} />

      <h3 className="lens-tabs" style={{ marginBottom: "0.4rem" }}>
        {tab === "posts" ? (
          <strong>Contributions</strong>
        ) : (
          <Link href={`/souls/${soul.handle}`}>Contributions</Link>
        )}{" "}
        ·{" "}
        {tab === "actions" ? (
          <strong>Actions</strong>
        ) : (
          <Link href={`/souls/${soul.handle}?tab=actions`}>Actions</Link>
        )}{" "}
        ·{" "}
        {tab === "about" ? (
          <strong>About</strong>
        ) : (
          <Link href={`/souls/${soul.handle}?tab=about`}>About</Link>
        )}
      </h3>
      {tab === "posts" && <SoulContributions soul={soul} />}
      {tab === "actions" && <SoulActionsLog soul={soul} />}
      {tab === "about" && (
        <div>
          <p style={{ whiteSpace: "pre-wrap" }}>
            {soul.bio || "Nothing written yet."}
          </p>
          <p className="lore">
            {soul.face === "TRUE_SELF" ? "◆ True Self" : "◇ Alias"} · joined{" "}
            {soul.joinedPeriod}
            {soul.bioPlace ? ` · 📍 ${soul.bioPlace}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}

async function SoulActions({
  viewerId,
  soul,
}: {
  viewerId: string;
  soul: { id: string; handle: string; displayName: string };
}) {
  const bonded = await areFellowSouls(db, viewerId, soul.id);
  return (
    <div className="soul-cta">
      {bonded ? (
        <span className="badge permanent">◆ Your fellow soul</span>
      ) : (
        <form action={submitFellowRequest} className="inline">
          <input type="hidden" name="handle" value={soul.handle} />
          <button type="submit">Ask to be fellow souls</button>
        </form>
      )}{" "}
      <details className="inline">
        <summary>Open a conversation</summary>
        <form action={submitOpenThread} className="composer">
          <input type="hidden" name="handle" value={soul.handle} />
          <textarea
            name="body"
            required
            placeholder={`Your first words to ${soul.displayName}.`}
          />
          <p className="interim-note">
            {bonded
              ? "Fellow souls receive this directly."
              : "Strangers receive this as a quiet request — reading costs them nothing; replying opens the thread."}
          </p>
          <button type="submit">Send</button>
        </form>
      </details>
    </div>
  );
}

async function SoulConstellation({ profileId }: { profileId: string }) {
  const constellation = await faceConstellation(db, profileId);
  if (constellation.pillars.length === 0) return null;
  return (
    <>
      <h3>Standing — the constellation</h3>
      <ul className="discussions">
        {constellation.pillars.map((p) => (
          <li key={p.pillarId}>
            <PillarMark slug={p.slug} /> <strong>{p.name}</strong>: {p.points}
          </li>
        ))}
      </ul>
    </>
  );
}

async function SoulContributions({
  soul,
}: {
  soul: { id: string; displayName: string };
}) {
  // Public spaces only — enclosed rooms never surface here, exactly as
  // everywhere else. Attribution is already public by design; this tab
  // is honest collation, nothing new.
  const posts = await db.post.findMany({
    where: {
      authorProfileId: soul.id,
      status: "visible",
      discussion: { circleId: null, chamberId: null },
    },
    include: {
      discussion: {
        select: {
          id: true,
          title: true,
          permanence: true,
          pillar: { select: { name: true, isMeta: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  if (posts.length === 0)
    return <p className="lore">No public contributions yet.</p>;
  return (
    <ul className="discussions">
      {posts.map((p) => (
        <li key={p.id}>
          <Link href={`/d/${p.discussion.id}#${p.id}`}>
            {p.discussion.title}
          </Link>{" "}
          {p.discussion.permanence.startsWith("permanent") ? (
            <span className="badge permanent">Permanent record</span>
          ) : (
            <span className="badge locked">Author-deletable</span>
          )}
          <div className="meta">
            {p.discussion.pillar.isMeta ? "General" : p.discussion.pillar.name}{" "}
            · {p.createdAt.toLocaleDateString()}
          </div>
          <div className="body">
            {p.body.length > 180 ? `${p.body.slice(0, 180)}…` : p.body}
          </div>
        </li>
      ))}
    </ul>
  );
}

async function SoulActionsLog({ soul }: { soul: { id: string } }) {
  // Attested Circle actions naming this handle — ledger-anchored,
  // provable work instead of follower counts (PROFILE_PAGE_SPEC §2).
  const entries = await db.actionEntry.findMany({
    where: { authorProfileId: soul.id, attestedAt: { not: null } },
    include: {
      circle: { select: { id: true, name: true, placeTag: true } },
      attestations: { select: { id: true } },
    },
    orderBy: { attestedAt: "desc" },
    take: 20,
  });
  if (entries.length === 0)
    return <p className="lore">No attested actions yet — the log fills from real work.</p>;
  return (
    <ul className="discussions">
      {entries.map((e) => (
        <li key={e.id}>
          <Link href={`/circles/${e.circle.id}`}>
            {e.circle.name}: {e.body.length > 120 ? `${e.body.slice(0, 120)}…` : e.body}
          </Link>{" "}
          <span className="badge permanent">Attested</span>
          <div className="meta">
            {e.attestations.length} co-signer
            {e.attestations.length === 1 ? "" : "s"}
            {e.circle.placeTag ? ` · 📍 ${e.circle.placeTag}` : ""} ·{" "}
            {e.attestedAt!.toLocaleDateString()}
          </div>
        </li>
      ))}
    </ul>
  );
}
