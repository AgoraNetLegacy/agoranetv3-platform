import type { Prisma, PrismaClient, SupportCase, SupportOperator } from "@prisma/client";
import type { DbOrTx } from "./db";
import { HELP_RETRIEVAL_DOCUMENTS } from "./helpContent";
import { containsPastedSecret, SUPPORT_CATEGORIES, SUPPORT_SEVERITIES } from "./support";

export const SUPPORT_OPERATOR_ROLES = ["agent", "lead", "security"] as const;
export const SUPPORT_CASE_STATUSES = ["new", "assigned", "waiting", "resolved", "closed"] as const;
export type SupportOperatorRole = (typeof SUPPORT_OPERATOR_ROLES)[number];
export type SupportCaseStatus = (typeof SUPPORT_CASE_STATUSES)[number];

export type ActiveSupportOperator = SupportOperator & {
  profile: { id: string; handle: string; displayName: string };
};

export const SUPPORT_KNOWN_ISSUES = HELP_RETRIEVAL_DOCUMENTS
  .filter((document) => document.documentType === "known-issue" && document.slug)
  .map((document) => ({ id: document.slug as string, title: document.title }));

export function supportCaseReference(id: string): string {
  return `AN-${id.slice(-8).toUpperCase()}`;
}

export function isSensitiveSupportCase(item: Pick<SupportCase, "category" | "severity">): boolean {
  return item.severity === "critical" || ["privacy-and-safety", "identity-and-keys"].includes(item.category);
}

export function canViewSensitiveCases(operator: Pick<SupportOperator, "role">): boolean {
  return operator.role === "lead" || operator.role === "security";
}

export async function getActiveSupportOperator(
  db: DbOrTx,
  profileId: string
): Promise<ActiveSupportOperator | null> {
  return db.supportOperator.findFirst({
    where: { profileId, active: true },
    include: { profile: { select: { id: true, handle: true, displayName: true } } },
  });
}

function visibilityWhere(operator: Pick<SupportOperator, "role">): Prisma.SupportCaseWhereInput {
  if (canViewSensitiveCases(operator)) return {};
  return {
    AND: [
      { severity: { not: "critical" } },
      { category: { notIn: ["privacy-and-safety", "identity-and-keys"] } },
    ],
  };
}

export interface SupportQueueFilters {
  status?: string;
  severity?: string;
  category?: string;
  assignment?: "mine" | "unassigned" | "all";
}

export async function listSupportCasesForOperator(
  db: DbOrTx,
  operator: ActiveSupportOperator,
  filters: SupportQueueFilters = {}
) {
  const where: Prisma.SupportCaseWhereInput = {
    ...visibilityWhere(operator),
    ...(SUPPORT_CASE_STATUSES.includes(filters.status as SupportCaseStatus) ? { status: filters.status } : {}),
    ...(SUPPORT_SEVERITIES.includes(filters.severity as never) ? { severity: filters.severity } : {}),
    ...(SUPPORT_CATEGORIES.includes(filters.category as never) ? { category: filters.category } : {}),
    ...(filters.assignment === "mine"
      ? { assignedOperatorId: operator.profileId }
      : filters.assignment === "unassigned"
        ? { assignedOperatorId: null }
        : {}),
  };
  return db.supportCase.findMany({
    where,
    include: {
      assignedOperator: { include: { profile: { select: { handle: true, displayName: true } } } },
      _count: { select: { internalNotes: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
  });
}

export async function supportCaseForOperator(
  db: DbOrTx,
  operator: ActiveSupportOperator,
  caseId: string
) {
  const item = await db.supportCase.findFirst({
    where: { id: caseId, ...visibilityWhere(operator) },
    include: {
      assignedOperator: { include: { profile: { select: { handle: true, displayName: true } } } },
      internalNotes: {
        include: { authorOperator: { include: { profile: { select: { handle: true, displayName: true } } } } },
        orderBy: { createdAt: "asc" },
      },
      auditEvents: {
        include: { actorProfile: { select: { handle: true, displayName: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return item;
}

async function visibleCaseOrThrow(db: DbOrTx, operator: ActiveSupportOperator, caseId: string) {
  const item = await db.supportCase.findFirst({ where: { id: caseId, ...visibilityWhere(operator) } });
  if (!item) throw new Error("Support case not found or not available to this operator.");
  return item;
}

function auditDetails(details: Record<string, string | null>): string {
  return JSON.stringify(details);
}

export async function assignSupportCase(
  db: PrismaClient,
  operator: ActiveSupportOperator,
  caseId: string,
  assigneeProfileId: string | null
) {
  return db.$transaction(async (tx) => {
    const item = await visibleCaseOrThrow(tx, operator, caseId);
    const targetId = assigneeProfileId || null;
    if (operator.role !== "lead" && targetId !== operator.profileId) {
      throw new Error("Only a support lead can assign a case to another operator or unassign it.");
    }
    if (targetId) {
      const target = await tx.supportOperator.findFirst({ where: { profileId: targetId, active: true } });
      if (!target) throw new Error("The selected support operator is not active.");
      if (isSensitiveSupportCase(item) && !canViewSensitiveCases(target)) {
        throw new Error("Sensitive cases can only be assigned to a lead or security operator.");
      }
    }
    const nextStatus = targetId && item.status === "new" ? "assigned" : item.status;
    const updated = await tx.supportCase.update({
      where: { id: caseId },
      data: { assignedOperatorId: targetId, status: nextStatus },
    });
    await tx.supportAuditEvent.create({
      data: {
        caseId,
        actorProfileId: operator.profileId,
        action: "case.assignment.changed",
        details: auditDetails({ from: item.assignedOperatorId, to: targetId, status: nextStatus }),
      },
    });
    return updated;
  });
}

const TRANSITIONS: Record<SupportCaseStatus, SupportCaseStatus[]> = {
  new: ["assigned"],
  assigned: ["waiting", "resolved"],
  waiting: ["assigned", "resolved"],
  resolved: ["assigned", "closed"],
  closed: ["assigned"],
};

export async function updateSupportCaseStatus(
  db: PrismaClient,
  operator: ActiveSupportOperator,
  caseId: string,
  status: string
) {
  if (!SUPPORT_CASE_STATUSES.includes(status as SupportCaseStatus)) throw new Error("Unknown support status.");
  return db.$transaction(async (tx) => {
    const item = await visibleCaseOrThrow(tx, operator, caseId);
    const next = status as SupportCaseStatus;
    if (next === item.status) return item;
    if (!TRANSITIONS[item.status as SupportCaseStatus]?.includes(next)) throw new Error("That support status transition is not allowed.");
    if ((next === "closed" || item.status === "closed") && operator.role !== "lead") {
      throw new Error("Only a support lead can close or reopen a case.");
    }
    if (operator.role !== "lead" && item.assignedOperatorId !== operator.profileId) {
      throw new Error("Assign the case to yourself before changing its status.");
    }
    const updated = await tx.supportCase.update({
      where: { id: caseId },
      data: {
        status: next,
        resolvedAt: next === "resolved" ? new Date() : next === "assigned" ? null : item.resolvedAt,
        closedAt: next === "closed" ? new Date() : item.status === "closed" ? null : item.closedAt,
      },
    });
    await tx.supportAuditEvent.create({
      data: { caseId, actorProfileId: operator.profileId, action: "case.status.changed", details: auditDetails({ from: item.status, to: next }) },
    });
    return updated;
  });
}

export async function updateSupportCaseSeverity(
  db: PrismaClient,
  operator: ActiveSupportOperator,
  caseId: string,
  severity: string
) {
  if (operator.role !== "lead") throw new Error("Only a support lead can change severity.");
  if (!SUPPORT_SEVERITIES.includes(severity as never)) throw new Error("Unknown support severity.");
  return db.$transaction(async (tx) => {
    const item = await visibleCaseOrThrow(tx, operator, caseId);
    let assignedOperatorId = item.assignedOperatorId;
    if (severity === "critical" && assignedOperatorId) {
      const assignee = await tx.supportOperator.findUnique({ where: { profileId: assignedOperatorId } });
      if (assignee && !canViewSensitiveCases(assignee)) assignedOperatorId = null;
    }
    const updated = await tx.supportCase.update({ where: { id: caseId }, data: { severity, assignedOperatorId } });
    await tx.supportAuditEvent.create({
      data: {
        caseId,
        actorProfileId: operator.profileId,
        action: "case.severity.changed",
        details: auditDetails({
          from: item.severity,
          to: severity,
          assignment: assignedOperatorId === item.assignedOperatorId ? "unchanged" : "cleared-sensitive",
        }),
      },
    });
    return updated;
  });
}

export async function linkSupportKnownIssue(
  db: PrismaClient,
  operator: ActiveSupportOperator,
  caseId: string,
  knownIssueId: string | null
) {
  const normalized = knownIssueId?.trim() || null;
  if (normalized && !SUPPORT_KNOWN_ISSUES.some((issue) => issue.id === normalized)) {
    throw new Error("That known issue is not in the approved support corpus.");
  }
  return db.$transaction(async (tx) => {
    const item = await visibleCaseOrThrow(tx, operator, caseId);
    if (operator.role !== "lead" && item.assignedOperatorId !== operator.profileId) {
      throw new Error("Assign the case to yourself before linking a known issue.");
    }
    const updated = await tx.supportCase.update({ where: { id: caseId }, data: { knownIssueId: normalized } });
    await tx.supportAuditEvent.create({
      data: { caseId, actorProfileId: operator.profileId, action: "case.known_issue.changed", details: auditDetails({ from: item.knownIssueId, to: normalized }) },
    });
    return updated;
  });
}

export async function addSupportInternalNote(
  db: PrismaClient,
  operator: ActiveSupportOperator,
  caseId: string,
  body: string
) {
  const normalized = body.trim().slice(0, 4_000);
  if (normalized.length < 2) throw new Error("Add a note before saving.");
  if (containsPastedSecret(normalized)) throw new Error("Remove credentials, access keys, seed phrases, and private keys from the note.");
  return db.$transaction(async (tx) => {
    const item = await visibleCaseOrThrow(tx, operator, caseId);
    if (operator.role !== "lead" && item.assignedOperatorId !== operator.profileId) {
      throw new Error("Assign the case to yourself before adding an internal note.");
    }
    const note = await tx.supportInternalNote.create({ data: { caseId, authorOperatorId: operator.profileId, body: normalized } });
    await tx.supportAuditEvent.create({
      data: { caseId, actorProfileId: operator.profileId, action: "case.note.added", details: auditDetails({ noteId: note.id }) },
    });
    return note;
  });
}
