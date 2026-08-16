import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getRail } from "@/lib/rails";
import { activeFace } from "@/lib/webSession";
import { checkParking, BlockedPanel } from "@/app/parkingGate";
import { submitPost, submitEdit, submitFlag, submitTip, submitPermanenceUpgrade, submitAppeal, submitRestorative, submitSaveDiscussion, submitUnsaveDiscussion } from "@/app/actions";
import { isSaved, touchSavedWatermark } from "@/lib/saved";
import { Icon, PillarMark } from "@/components/Icon";

export const dynamic = "force-dynamic";

type PostWithRevisions = Awaited<ReturnType<typeof loadPosts>>[number];

function loadPosts(discussionId: string) {
  return db.post.findMany({
    where: { discussionId },
    orderBy: { createdAt: "asc" },
    include: {
      revisions: { orderBy: { editedAt: "asc" } },
      tips: true,
      sources: { include: { source: true } },
    },
  });
}

function Composer({
  discussionId,
  parentId,
  graceMinutes,
  label,
  permanent,
  feeLabel = "1 PC",
}: {
  discussionId: string;
  parentId?: string;
  graceMinutes: number;
  label: string;
  permanent: boolean;
  feeLabel?: string;
}) {
  return (
    <form action={submitPost} className="composer">
      <span className="composer-badge">
        {permanent ? (
          <>
            <Icon name="infinity" /> Permanent record; a {graceMinutes}-minute grace window for
            typo repair with visible edit history, then your words lock
            into the record.
          </>
        ) : (
          <>
            Author-deletable space; the creator may remove it later
            (tombstones preserve reply context). Same {graceMinutes}-minute
            grace window for edits.
          </>
        )}
      </span>
      <input type="hidden" name="discussionId" value={discussionId} />
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
      <textarea
        name="body"
        required
        placeholder={permanent ? "Speak deliberately; this space is permanent." : "Add your voice."}
      />
      <div style={{ fontSize: "0.8rem", margin: "0.3rem 0" }}>
        <label>
          <input type="checkbox" name="humanMade" /> Human-made; my
          reputation on it (falsely marking AI work is rule R2.3)
        </label>
        <details>
          <summary>Attach a source</summary>
          <input type="text" name="sourceUrl" placeholder="https://…" style={{ width: "60%" }} />{" "}
          <select name="sourceKind" defaultValue="other">
            <option value="study">Study</option>
            <option value="news">News article</option>
            <option value="primary">Primary document</option>
            <option value="book">Book</option>
            <option value="experience">Personal experience</option>
            <option value="other">Other</option>
          </select>{" "}
          <select name="sourceVouch" defaultValue="unverified">
            <option value="vouched">I vouch for this</option>
            <option value="unverified">Sharing unverified</option>
          </select>
        </details>
      </div>
      <button type="submit">{label} · {feeLabel}</button>
    </form>
  );
}

function FlagForm({
  discussionId,
  postId,
  rules,
}: {
  discussionId: string;
  postId: string;
  rules: { id: string; tier: number; title: string }[];
}) {
  return (
    <details>
      <summary>Flag</summary>
      <form action={submitFlag}>
        <input type="hidden" name="discussionId" value={discussionId} />
        <input type="hidden" name="postId" value={postId} />
        <select name="ruleId" required defaultValue="">
          <option value="" disabled>
            Which rule is alleged?
          </option>
          {rules.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id}; {r.title}
            </option>
          ))}
        </select>{" "}
        <input name="note" placeholder="Optional note for the reviewer" />{" "}
        <button type="submit">File flag</button>
      </form>
    </details>
  );
}

async function RemovedControls({
  postId,
  discussionId,
}: {
  postId: string;
  discussionId: string;
}) {
  const resolved = await db.modCase.findFirst({
    where: { postId, status: { in: ["resolved", "appealed"] }, outcome: "upheld" },
    include: { appealedBy: true },
  });
  if (!resolved) return null;
  return (
    <div className="byline">
      Ruled under the cited rule (see the ledger).{" "}
      {!resolved.appealedBy && resolved.status === "resolved" && (
        <details>
          <summary>Appeal (once; 25 PC deposit, returned if the ruling changes)</summary>
          <form action={submitAppeal} className="inline">
            <input type="hidden" name="caseId" value={resolved.id} />
            <input type="hidden" name="discussionId" value={discussionId} />
            <button type="submit">File appeal</button>
          </form>
        </details>
      )}
      {resolved.tier <= 2 && (
        <details>
          <summary>Restorative option; acknowledge & append a correction for a reduced strike</summary>
          <form action={submitRestorative} className="composer">
            <input type="hidden" name="caseId" value={resolved.id} />
            <input type="hidden" name="discussionId" value={discussionId} />
            <textarea name="correction" required placeholder="The correction, appended where the harm happened. Offered, never forced." />
            <button type="submit">Acknowledge & append</button>
          </form>
        </details>
      )}
    </div>
  );
}

function PostNode({
  post,
  childrenByParent,
  discussionId,
  viewerProfileId,
  graceMinutes,
  rules,
  now,
  permanent,
  feeLabel,
}: {
  post: PostWithRevisions;
  childrenByParent: Map<string | null, PostWithRevisions[]>;
  discussionId: string;
  viewerProfileId: string | null;
  graceMinutes: number;
  rules: { id: string; tier: number; title: string }[];
  now: Date;
  permanent: boolean;
  feeLabel?: string;
}) {
  const locked = post.editableUntil <= now;
  const own = viewerProfileId === post.authorProfileId;
  const children = childrenByParent.get(post.id) ?? [];

  return (
    <div className="post" id={post.id}>
      <div className="byline">
        {/* Permanent record: display name frozen at composition + the
            eternal @handle (naming ruling 2026-07-10). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="avatar-sm" src={`/img/${post.authorHandle}/avatar`} alt="" />
        <Link href={`/souls/${post.authorHandle}`} className="pseudonym">
          {post.authorDisplayName}
        </Link>{" "}
        <span>@{post.authorHandle}</span> · {post.createdAt.toLocaleString()} ·{" "}
        {locked ? (
          <span className="badge locked">🔒 Locked into the record</span>
        ) : (
          <span>grace window open until {post.editableUntil.toLocaleTimeString()}</span>
        )}{" "}
        {post.humanMade && (
          <span className="badge permanent">Human-made; reputation staked</span>
        )}{" "}
        {post.permanentUpgraded && (
          <span className="badge permanent">Permanent; creator-designated</span>
        )}
      </div>
      {post.status === "removed" ? (
        <div className="notice">
          🪦 <strong>Removed by moderation</strong>; rule cited on the
          public record; the tombstone preserves the fact of removal,
          forever.
        </div>
      ) : post.status === "hidden" ? (
        <div className="notice">
          Hidden pending expedited review (severe category); not
          click-viewable by design.
        </div>
      ) : post.status === "blurred" ? (
        <details>
          <summary className="lore">
            ⚠ Under review; blurred, not erased. Click to view.
          </summary>
          <div className="body">{post.body}</div>
        </details>
      ) : (
        <div className="body">{post.body}</div>
      )}
      {post.sources.length > 0 && (
        <div className="byline">
          {post.sources.map((s) => (
            <div key={s.id}>
              📎 <a href={s.source.url} rel="noreferrer nofollow">{s.source.url}</a>{" "}
              ({s.kind}); {" "}
              {s.vouch === "vouched"
                ? `vouched by @${s.sharerHandle}`
                : "shared unverified"}
            </div>
          ))}
        </div>
      )}
      {post.tips.length > 0 && (
        <div className="byline">
          ✨ {post.tips.reduce((sum, t) => sum + t.amount, 0).toFixed(2)} G from{" "}
          {new Set(post.tips.map((t) => t.tipperProfileId)).size} unique tipper(s)
        </div>
      )}

      {post.revisions.length > 0 && (
        <details>
          <summary>
            Edited during the grace window ({post.revisions.length} earlier
            version{post.revisions.length === 1 ? "" : "s"})
          </summary>
          {post.revisions.map((r) => (
            <div key={r.id}>
              <em>until {r.editedAt.toLocaleTimeString()}:</em> {r.body}
            </div>
          ))}
        </details>
      )}

      {own && post.status === "removed" && (
        <RemovedControls postId={post.id} discussionId={discussionId} />
      )}
      {viewerProfileId && post.status !== "removed" && post.status !== "hidden" && (
        <>
          <details>
            <summary>Reply</summary>
            <Composer
              discussionId={discussionId}
              parentId={post.id}
              graceMinutes={graceMinutes}
              label="Post reply"
              permanent={permanent}
              feeLabel={feeLabel}
            />
          </details>
          {own && !locked && (
            <details>
              <summary>Edit (grace window)</summary>
              <form action={submitEdit} className="composer">
                <input type="hidden" name="discussionId" value={discussionId} />
                <input type="hidden" name="postId" value={post.id} />
                <textarea name="body" defaultValue={post.body} required />
                <button type="submit">Save repair</button>
              </form>
            </details>
          )}
          {!own && (
            <details>
              <summary>Tip</summary>
              <form action={submitTip} className="inline">
                <input type="hidden" name="postId" value={post.id} />
                <input type="hidden" name="discussionId" value={discussionId} />
                <input type="number" name="amount" min={0.25} step={0.25} defaultValue={1} style={{ width: "4.5rem" }} /> G{" "}
                <button type="submit">Send tip (5% to treasury)</button>
              </form>
            </details>
          )}
          {own && !permanent && !post.permanentUpgraded && (
            <details>
              <summary>Make this post permanent</summary>
              <form action={submitPermanenceUpgrade} className="inline">
                <input type="hidden" name="postId" value={post.id} />
                <input type="hidden" name="discussionId" value={discussionId} />
                <span className="interim-note">
                  15 G. Caveat: the surrounding thread may be deleted later,
                  leaving your permanent post standing amid tombstones.{" "}
                </span>
                <button type="submit">Pay 15 G; permanent record</button>
              </form>
            </details>
          )}
          <FlagForm discussionId={discussionId} postId={post.id} rules={rules} />
        </>
      )}

      {children.map((child) => (
        <PostNode
          key={child.id}
          post={child}
          childrenByParent={childrenByParent}
          discussionId={discussionId}
          viewerProfileId={viewerProfileId}
          graceMinutes={graceMinutes}
          rules={rules}
          now={now}
          permanent={permanent}
          feeLabel={feeLabel}
        />
      ))}
    </div>
  );
}

export default async function DiscussionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const { id } = await params;
  const { m } = await searchParams;

  const discussion = await db.discussion.findUnique({
    where: { id },
    include: { pillar: true, question: true, circle: true, chamber: true },
  });
  if (!discussion) notFound();

  // The members' room (CIRCLES §2.2): a Circle-scoped Discussion is
  // members-only; reading included; and exempt from the parking rule
  // (a Circle is not a pillar surface; both of a soul's identities may be
  // members, §7). Everything else keeps the pillar parking check.
  let roomWrite = true;
  if (discussion.circle) {
    const { roomAccess } = await import("@/lib/circles");
    const viewerFace = await activeFace();
    const access = await roomAccess(db, discussion.circle, viewerFace?.id ?? null);
    if (!access.read) {
      return (
        <>
          <h1>Members&apos; room</h1>
          <div className="notice">
            The working conversation belongs to the Circle&apos;s members
            (its purpose and action log are public).{" "}
            <Link href={`/circles/${discussion.circle.id}`}>
              Visit the Circle&apos;s public page →
            </Link>
          </div>
        </>
      );
    }
    roomWrite = access.write;
  } else if (discussion.chamber) {
    // The workshop (POLLINATOR §4.3): a chamber-scoped Discussion is
    // enter-to-see; READING included; that enclosure is the point.
    // Exempt from the parking rule like the members' room (a chamber is
    // not a pillar surface; it homes in the meta pillar only because a
    // Discussion needs a pillar row).
    const { workshopAccess } = await import("@/lib/chambers");
    const viewerFace = await activeFace();
    if (!(await workshopAccess(db, discussion.chamber.id, viewerFace?.id ?? null))) {
      return (
        <>
          <h1>The workshop</h1>
          <div className="notice">
            You enter a chamber to see what&apos;s inside; the workshop
            belongs to the souls working the idea.{" "}
            <Link href={`/pollinator/${discussion.chamber.id}`}>
              Read the chamber&apos;s storefront →
            </Link>
          </div>
        </>
      );
    }
  } else {
    // A Discussion is inside its pillar; the parking rule applies here
    // exactly as on the dashboard (DASHBOARD §3.2).
    const parking = await checkParking(discussion.pillarId);
    if (parking.state === "blocked") {
      return (
        <BlockedPanel
          pillarName={discussion.pillar.name}
          pillarId={discussion.pillarId}
          pillarSlug={discussion.pillar.slug}
          heldByHandle={parking.heldByHandle}
          heldByFace={parking.heldByFace}
        />
      );
    }
  }

  const [posts, rules, viewer, graceMinutes, replyFee] = await Promise.all([
    loadPosts(discussion.id),
    db.rule.findMany({ orderBy: { id: "asc" } }),
    activeFace(),
    getRail(db, "discussion.graceWindowMinutes"),
    getRail(db, "discussion.replyFee"),
  ]);

  // The save (BEACON §4): private to this identity. Reading a saved thread
  // advances its resurfacing watermark; a time and nothing else.
  const saved = viewer
    ? await isSaved(db, { profileId: viewer.id, discussionId: discussion.id })
    : false;
  if (viewer && saved) {
    await touchSavedWatermark(db, {
      profileId: viewer.id,
      discussionId: discussion.id,
    });
  }

  const childrenByParent = new Map<string | null, PostWithRevisions[]>();
  for (const post of posts) {
    const key = post.parentId;
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key)!.push(post);
  }
  const now = new Date();
  const permanent = discussion.permanence.startsWith("permanent");
  const interactive = viewer && (!discussion.circle || roomWrite);
  // The dual-token signature at micro scale (POLLINATOR §3): workshop
  // posts price in both currencies; the composer says so up front.
  const feeLabel = discussion.chamber ? "1 PC + 1 G" : `${replyFee} PC`;

  return (
    <>
      <p>
        {discussion.circle ? (
          <Link href={`/circles/${discussion.circle.id}`}>
            ← <Icon name="circles" /> {discussion.circle.name}
          </Link>
        ) : discussion.chamber ? (
          <Link href={`/pollinator/${discussion.chamber.id}/workshop`}>
            ← <Icon name="hive" /> {discussion.chamber.title} (workshop)
          </Link>
        ) : (
          <Link href={`/pillars/${discussion.pillar.slug}`}>
            ← <PillarMark slug={discussion.pillar.slug} /> {discussion.pillar.name}
          </Link>
        )}
      </p>
      <h1>{discussion.title}</h1>
      {viewer && (
        <form
          action={saved ? submitUnsaveDiscussion : submitSaveDiscussion}
          className="inline"
        >
          <input type="hidden" name="discussionId" value={discussion.id} />
          <button
            type="submit"
            className="linklike"
            title="Private to this identity; nobody else ever sees your saves."
          >
            {saved ? "★ Saved · unsave" : "☆ Save for later"}
          </button>
        </form>
      )}
      {discussion.question && (
        <p className="lore">
          Canonical question {discussion.question.position} ·{" "}
          {discussion.question.lens}
        </p>
      )}

      {discussion.circle ? (
        <div className="notice">
          🚪 <strong>The members&apos; room.</strong> Working conversation,
          members-only, deletable; this is NOT the permanent record; the
          Circle&apos;s action log is.{" "}
          {discussion.circle.status === "closed" &&
            "This Circle is closed: the room is read-only, kept for its former members."}
        </div>
      ) : discussion.chamber ? (
        <div className="notice">
          <Icon name="hive" /> <strong>The workshop.</strong> Enter-to-see and deletable-class
; half-formed thinking gets worked out here without the open
          internet watching the drafts. Standard moderation applies as
          everywhere. Posting charges both tokens (the Pollinator&apos;s
          dual-token signature).
        </div>
      ) : permanent ? (
        <div className="door-banner">
          <Icon name="temple" /> <strong>You are standing in a permanent space.</strong> Everything
          posted here becomes permanent record; a {graceMinutes}-minute grace
          window allows typo repair with visible edit history, then each post
          locks. Reading is free; participation clears the humanity gate.
        </div>
      ) : (
        <div className="notice">
          Author-deletable space: the creator may remove it later, leaving a
          tombstone so replies keep context. Reading is free; participation
          clears the humanity gate.
        </div>
      )}

      {m && <div className="notice">{m}</div>}

      {(childrenByParent.get(null) ?? []).map((post) => (
        <PostNode
          key={post.id}
          post={post}
          childrenByParent={childrenByParent}
          discussionId={discussion.id}
          viewerProfileId={interactive ? viewer.id : null}
          graceMinutes={graceMinutes}
          rules={rules}
          now={now}
          permanent={permanent}
          feeLabel={feeLabel}
        />
      ))}
      {posts.length === 0 && <p>No souls have spoken here yet.</p>}

      {interactive ? (
        <>
          <h3>Add your voice</h3>
          <Composer
            discussionId={discussion.id}
            graceMinutes={graceMinutes}
            label={`Post as ${viewer.displayName} @${viewer.handle}`}
            permanent={permanent}
            feeLabel={feeLabel}
          />
        </>
      ) : discussion.circle || discussion.chamber ? null : (
        <>
          <h3>Add your voice</h3>
          <p className="interim-note">
            Reading is free for the world; this button is where the gate
            begins.{" "}
            <Link href={`/verify?returnTo=${encodeURIComponent(`/d/${discussion.id}`)}`}>
              Verify once to add your voice →
            </Link>
          </p>
        </>
      )}
    </>
  );
}
