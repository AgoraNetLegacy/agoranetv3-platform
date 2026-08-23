import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import { SUPPORT_SEVERITIES } from "@/lib/support";
import {
  getActiveSupportOperator,
  SUPPORT_CASE_STATUSES,
  SUPPORT_KNOWN_ISSUES,
  supportCaseForOperator,
  supportCaseReference,
} from "@/lib/supportOperations";
import {
  addInternalNoteAction,
  assignCaseAction,
  changeCaseSeverityAction,
  changeCaseStatusAction,
  linkKnownIssueAction,
} from "../actions";

export const dynamic = "force-dynamic";

function safeContext(raw: string | null): Record<string, string> {
  try {
    const parsed = JSON.parse(raw ?? "{}");
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export default async function SupportCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const face = await activeFace();
  if (!face) redirect("/login");
  const operator = await getActiveSupportOperator(db, face.id);
  if (!operator) notFound();
  const { id } = await params;
  const item = await supportCaseForOperator(db, operator, id);
  if (!item) notFound();
  const { m } = await searchParams;
  const context = safeContext(item.safeContext);
  const operators = await db.supportOperator.findMany({
    where: { active: true },
    include: { profile: { select: { handle: true, displayName: true } } },
    orderBy: [{ role: "asc" }, { profile: { handle: "asc" } }],
  });

  return (
    <main className="support-ops">
      <p><Link href="/support/operations">← Support queue</Link></p>
      <div className="support-ops-heading">
        <div><p className="eyebrow">{supportCaseReference(item.id)}</p><h1>{item.subject}</h1></div>
        <div className="support-ops-badges"><span>{item.status}</span><span>{item.severity}</span><span>{item.category}</span></div>
      </div>
      {m && <div className="notice">{m}</div>}

      <section className="support-ops-card">
        <h2>Request</h2>
        <dl className="support-ops-meta">
          <div><dt>Opened</dt><dd>{item.createdAt.toLocaleString()}</dd></div>
          <div><dt>Identity scope</dt><dd>{item.profileId ? "One signed-in profile" : "Guest"}</dd></div>
          <div><dt>Reply address</dt><dd>{item.contactEmail ?? "Not provided"}</dd></div>
          <div><dt>Source article</dt><dd>{item.sourceArticle ?? "None"}</dd></div>
        </dl>
        <p className="support-ops-description">{item.description}</p>
        {Object.keys(context).length > 0 && <div><h3>Allowlisted context</h3><dl className="support-ops-meta">{Object.entries(context).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></div>}
      </section>

      <section className="support-ops-controls">
        <form action={assignCaseAction} className="support-ops-card"><input type="hidden" name="caseId" value={item.id} /><h3>Assignment</h3><select name="assignee" defaultValue={item.assignedOperatorId ?? ""}><option value="">Unassigned</option>{operators.map((entry) => <option key={entry.profileId} value={entry.profileId}>@{entry.profile.handle} · {entry.role}</option>)}</select><button type="submit">Save assignment</button></form>
        <form action={changeCaseStatusAction} className="support-ops-card"><input type="hidden" name="caseId" value={item.id} /><h3>Status</h3><select name="status" defaultValue={item.status}>{SUPPORT_CASE_STATUSES.map((status) => <option key={status}>{status}</option>)}</select><button type="submit">Change status</button></form>
        <form action={changeCaseSeverityAction} className="support-ops-card"><input type="hidden" name="caseId" value={item.id} /><h3>Severity <small>lead only</small></h3><select name="severity" defaultValue={item.severity}>{SUPPORT_SEVERITIES.map((severity) => <option key={severity}>{severity}</option>)}</select><button type="submit">Change severity</button></form>
        <form action={linkKnownIssueAction} className="support-ops-card"><input type="hidden" name="caseId" value={item.id} /><h3>Known issue</h3><select name="knownIssueId" defaultValue={item.knownIssueId ?? ""}><option value="">None</option>{SUPPORT_KNOWN_ISSUES.map((issue) => <option key={issue.id} value={issue.id}>{issue.title}</option>)}</select><button type="submit">Save link</button></form>
      </section>

      <section className="support-ops-card">
        <h2>Internal notes</h2>
        <p className="lore">Operators only. Note contents remain separate from the audit event.</p>
        <div className="support-ops-notes">{item.internalNotes.map((note) => <article key={note.id}><p>{note.body}</p><small>@{note.authorOperator.profile.handle} · {note.createdAt.toLocaleString()}</small></article>)}{item.internalNotes.length === 0 && <p>No internal notes yet.</p>}</div>
        <form action={addInternalNoteAction}><input type="hidden" name="caseId" value={item.id} /><label>Add internal note<textarea name="body" required minLength={2} maxLength={4000} /></label><button type="submit">Add note</button></form>
      </section>

      <section className="support-ops-card">
        <h2>Audit trail</h2>
        <ol className="support-ops-audit">{item.auditEvents.map((event) => <li key={event.id}><strong>{event.action}</strong> · {event.actorProfile ? `@${event.actorProfile.handle}` : "system"} · {event.createdAt.toLocaleString()}<code>{event.details}</code></li>)}{item.auditEvents.length === 0 && <li>No operator actions yet.</li>}</ol>
      </section>
    </main>
  );
}
