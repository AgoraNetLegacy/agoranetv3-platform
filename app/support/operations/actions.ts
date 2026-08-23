"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import {
  addSupportInternalNote,
  assignSupportCase,
  getActiveSupportOperator,
  linkSupportKnownIssue,
  updateSupportCaseSeverity,
  updateSupportCaseStatus,
} from "@/lib/supportOperations";

async function operatorContext() {
  const face = await activeFace();
  if (!face) throw new Error("Sign in with an authorized support profile.");
  const operator = await getActiveSupportOperator(db, face.id);
  if (!operator) throw new Error("This profile is not authorized for support operations.");
  return operator;
}

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

async function finish(caseId: string, work: () => Promise<unknown>) {
  let message = "Saved.";
  try {
    await work();
  } catch (error) {
    message = error instanceof Error ? error.message : "The support action could not be completed.";
  }
  revalidatePath("/support/operations");
  revalidatePath(`/support/operations/${caseId}`);
  redirect(`/support/operations/${caseId}?m=${encodeURIComponent(message)}`);
}

export async function assignCaseAction(formData: FormData) {
  const caseId = value(formData, "caseId");
  const operator = await operatorContext();
  await finish(caseId, () => assignSupportCase(db, operator, caseId, value(formData, "assignee") || null));
}

export async function changeCaseStatusAction(formData: FormData) {
  const caseId = value(formData, "caseId");
  const operator = await operatorContext();
  await finish(caseId, () => updateSupportCaseStatus(db, operator, caseId, value(formData, "status")));
}

export async function changeCaseSeverityAction(formData: FormData) {
  const caseId = value(formData, "caseId");
  const operator = await operatorContext();
  await finish(caseId, () => updateSupportCaseSeverity(db, operator, caseId, value(formData, "severity")));
}

export async function linkKnownIssueAction(formData: FormData) {
  const caseId = value(formData, "caseId");
  const operator = await operatorContext();
  await finish(caseId, () => linkSupportKnownIssue(db, operator, caseId, value(formData, "knownIssueId") || null));
}

export async function addInternalNoteAction(formData: FormData) {
  const caseId = value(formData, "caseId");
  const operator = await operatorContext();
  await finish(caseId, () => addSupportInternalNote(db, operator, caseId, value(formData, "body")));
}
