import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getRail } from "@/lib/rails";
import { activeFace } from "@/lib/webSession";
import { checkParking, BlockedPanel } from "@/app/parkingGate";
import { submitPost, submitEdit, submitFlag } from "@/app/actions";

export const dynamic = "force-dynamic";

type PostWithRevisions = Awaited<ReturnType<typeof loadPosts>>[number];

function loadPosts(discussionId: string) {
  return db.post.findMany({
    where: { discussionId },
    orderBy: { createdAt: "asc" },
    include: { revisions: { orderBy: { editedAt: "asc" } } },
  });
}

function Composer({
  discussionId,
  parentId,
  graceMinutes,
  label,
}: {
  discussionId: string;
  parentId?: string;
  graceMinutes: number;
  label: string;
}) {
  return (
    <form action={submitPost} className="composer">
      <span className="composer-badge">
        🏛 Permanent record — a {graceMinutes}-minute grace window for typo
        repair with visible edit history, then your words lock into the
        record.
      </span>
      <input type="hidden" name="discussionId" value={discussionId} />
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
      <textarea name="body" required placeholder="Speak deliberately — this space is permanent." />
      <button type="submit">{label}</button>
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
              {r.id} — {r.title}
            </option>
          ))}
        </select>{" "}
        <input name="note" placeholder="Optional note for the reviewer" />{" "}
        <button type="submit">File flag</button>
      </form>
    </details>
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
}: {
  post: PostWithRevisions;
  childrenByParent: Map<string | null, PostWithRevisions[]>;
  discussionId: string;
  viewerProfileId: string | null;
  graceMinutes: number;
  rules: { id: string; tier: number; title: string }[];
  now: Date;
}) {
  const locked = post.editableUntil <= now;
  const own = viewerProfileId === post.authorProfileId;
  const children = childrenByParent.get(post.id) ?? [];

  return (
    <div className="post" id={post.id}>
      <div className="byline">
        <span className="pseudonym">{post.authorPseudonym}</span> ·{" "}
        {post.createdAt.toLocaleString()} ·{" "}
        {locked ? (
          <span className="badge locked">🔒 Locked into the record</span>
        ) : (
          <span>grace window open until {post.editableUntil.toLocaleTimeString()}</span>
        )}
      </div>
      <div className="body">{post.body}</div>

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

      {viewerProfileId && (
        <>
          <details>
            <summary>Reply</summary>
            <Composer
              discussionId={discussionId}
              parentId={post.id}
              graceMinutes={graceMinutes}
              label="Post reply"
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
    include: { pillar: true, question: true },
  });
  if (!discussion) notFound();

  // A Discussion is inside its pillar — the parking rule applies here
  // exactly as on the dashboard (DASHBOARD §3.2).
  const parking = await checkParking(discussion.pillarId);
  if (parking.state === "blocked") {
    return (
      <BlockedPanel
        pillarName={discussion.pillar.name}
        pillarId={discussion.pillarId}
        pillarSlug={discussion.pillar.slug}
        heldByPseudonym={parking.heldByPseudonym}
        heldByFace={parking.heldByFace}
      />
    );
  }

  const [posts, rules, viewer, graceMinutes] = await Promise.all([
    loadPosts(discussion.id),
    db.rule.findMany({ orderBy: { id: "asc" } }),
    activeFace(),
    getRail(db, "discussion.graceWindowMinutes"),
  ]);

  const childrenByParent = new Map<string | null, PostWithRevisions[]>();
  for (const post of posts) {
    const key = post.parentId;
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key)!.push(post);
  }
  const now = new Date();

  return (
    <>
      <p>
        <Link href={`/pillars/${discussion.pillar.slug}`}>
          ← {discussion.pillar.icon} {discussion.pillar.name}
        </Link>
      </p>
      <h1>{discussion.title}</h1>
      {discussion.question && (
        <p className="lore">
          Canonical question {discussion.question.position} ·{" "}
          {discussion.question.lens}
        </p>
      )}

      <div className="door-banner">
        🏛 <strong>You are standing in a permanent space.</strong> Everything
        posted here becomes permanent record — a {graceMinutes}-minute grace
        window allows typo repair with visible edit history, then each post
        locks. Reading is free; participation clears the humanity gate.
      </div>

      {m && <div className="notice">{m}</div>}

      {(childrenByParent.get(null) ?? []).map((post) => (
        <PostNode
          key={post.id}
          post={post}
          childrenByParent={childrenByParent}
          discussionId={discussion.id}
          viewerProfileId={viewer?.id ?? null}
          graceMinutes={graceMinutes}
          rules={rules}
          now={now}
        />
      ))}
      {posts.length === 0 && <p>No souls have spoken here yet.</p>}

      <h3>Add your voice</h3>
      {viewer ? (
        <Composer
          discussionId={discussion.id}
          graceMinutes={graceMinutes}
          label={`Post as ${viewer.pseudonym}`}
        />
      ) : (
        <p className="interim-note">
          Reading is free for the world — this button is where the gate
          begins.{" "}
          <Link href={`/verify?returnTo=${encodeURIComponent(`/d/${discussion.id}`)}`}>
            Verify once to add your voice →
          </Link>
        </p>
      )}
    </>
  );
}
