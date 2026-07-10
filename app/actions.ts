"use server";

// Server actions. Every identity step routes through lib/identity.ts
// ceremonies (which route through the gate); every write action checks
// the active face from the SoulSession. No dev backdoors remain.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createPost, editPost } from "@/lib/discussions";
import { fileFlag } from "@/lib/flags";
import {
  verifyHumanity,
  registerTrueSelf,
  registerAlias,
  profileForAccessKey,
  activateDueAliases,
} from "@/lib/identity";
import { addFace, switchFace, releaseLocks, releaseLock } from "@/lib/parking";
import { recordAck } from "@/lib/consent";
import { saveSeedAnswer } from "@/lib/valuesSeed";
import type { ConsentKind } from "@/lib/disclosures";
import {
  ensureSessionId,
  currentSession,
  activeFace,
  setOneTimeSecret,
  clearOneTimeSecret,
} from "@/lib/webSession";

function backTo(path: string, message?: string): never {
  const suffix = message ? `?m=${encodeURIComponent(message)}` : "";
  redirect(`${path}${suffix}`);
}

async function requireFace() {
  const face = await activeFace();
  if (!face) throw new Error("No face is active in this session.");
  return face;
}

// ---------------------------------------------------------------- posting

export async function submitPost(formData: FormData) {
  const discussionId = String(formData.get("discussionId") ?? "");
  const parentId = String(formData.get("parentId") ?? "") || null;
  const body = String(formData.get("body") ?? "");
  const face = await requireFace();

  const result = await createPost(db, {
    discussionId,
    profileId: face.id,
    body,
    parentId,
  });
  revalidatePath(`/d/${discussionId}`);
  backTo(`/d/${discussionId}`, result.ok ? undefined : result.reason);
}

export async function submitEdit(formData: FormData) {
  const discussionId = String(formData.get("discussionId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  const body = String(formData.get("body") ?? "");
  const face = await requireFace();

  const result = await editPost(db, { postId, profileId: face.id, body });
  revalidatePath(`/d/${discussionId}`);
  backTo(`/d/${discussionId}`, result.ok ? undefined : result.reason);
}

export async function submitFlag(formData: FormData) {
  const discussionId = String(formData.get("discussionId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  const ruleId = String(formData.get("ruleId") ?? "");
  const note = String(formData.get("note") ?? "");
  const face = await requireFace();

  const result = await fileFlag(db, { postId, profileId: face.id, ruleId, note });
  backTo(`/d/${discussionId}`, result.ok ? "Flag received." : result.reason);
}

// ------------------------------------------------------------- onboarding

export async function beginVerification(formData: FormData) {
  const returnTo = String(formData.get("returnTo") ?? "");
  await ensureSessionId();
  const { credential } = await verifyHumanity(db);
  await setOneTimeSecret(credential);
  redirect(`/verify/credential${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`);
}

export async function acknowledgeSecretSaved(formData: FormData) {
  const next = String(formData.get("next") ?? "/");
  await clearOneTimeSecret();
  redirect(next);
}

export async function createTrueSelf(formData: FormData) {
  const credential = String(formData.get("credential") ?? "");
  const handle = String(formData.get("handle") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "");
  const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";

  const result = await registerTrueSelf(db, { credential, handle });
  if (!result.ok) backTo(`/verify/trueself${query}`, result.reason);

  // Sign the new face in and make it active.
  const sessionId = await ensureSessionId();
  await addFace(db, { sessionId, profileId: result.profileId });
  await switchFace(db, { sessionId, fromProfileId: null, toProfileId: result.profileId });

  await setOneTimeSecret(result.accessKey);
  redirect(`/verify/key${query}`);
}

export async function acknowledgeConsent(formData: FormData) {
  const kind = String(formData.get("kind") ?? "") as ConsentKind;
  const next = String(formData.get("next") ?? "/verify/consents");
  if (kind !== "permanence" && kind !== "constitution") {
    throw new Error("Unknown consent kind.");
  }
  const face = await requireFace();
  await recordAck(db, { profileId: face.id, kind });
  redirect(next);
}

export async function submitSeedAnswer(formData: FormData) {
  const questionId = String(formData.get("questionId") ?? "");
  const body = String(formData.get("body") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "");
  const face = await requireFace();
  await saveSeedAnswer(db, { profileId: face.id, questionId, body });
  revalidatePath("/verify/seed");
  backTo(`/verify/seed${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`);
}

// ---------------------------------------------------------- alias ceremony

export async function hatchAlias(formData: FormData) {
  const credential = String(formData.get("credential") ?? "");
  const handle = String(formData.get("handle") ?? "");
  const disclosuresAccepted = formData.get("disclosuresAccepted") === "on";

  const result = await registerAlias(db, { credential, handle, disclosuresAccepted });
  if (!result.ok) backTo("/alias", result.reason);

  await setOneTimeSecret(result.accessKey);
  redirect("/alias/key");
}

// ------------------------------------------------------------------ session

export async function loginFace(formData: FormData) {
  const accessKey = String(formData.get("accessKey") ?? "");
  await activateDueAliases(db);

  const result = await profileForAccessKey(db, accessKey);
  if (!result.ok) backTo("/login", result.reason);

  const sessionId = await ensureSessionId();
  const session = await currentSession();
  await addFace(db, { sessionId, profileId: result.profile.id });
  const switched = await switchFace(db, {
    sessionId,
    fromProfileId: session?.activeProfileId ?? null,
    toProfileId: result.profile.id,
  });
  if (!switched.ok) backTo("/login", switched.reason);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function switchToFace(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  const session = await currentSession();
  if (!session) backTo("/", "Session expired.");
  const result = await switchFace(db, {
    sessionId: session.id,
    fromProfileId: session.activeProfileId,
    toProfileId: profileId,
  });
  revalidatePath("/", "layout");
  backTo("/", result.ok ? undefined : result.reason);
}

/** Returning to the hub ends the active face's pillar sessions (§3.3.5). */
export async function returnToHub() {
  const session = await currentSession();
  if (session?.activeProfileId) {
    await releaseLocks(db, {
      sessionId: session.id,
      profileId: session.activeProfileId,
    });
  }
  revalidatePath("/", "layout");
  redirect("/");
}

/** The blocked-entry path forward: end the other face's pillar session. */
export async function releasePillar(formData: FormData) {
  const pillarId = String(formData.get("pillarId") ?? "");
  const pillarSlug = String(formData.get("pillarSlug") ?? "");
  const session = await currentSession();
  if (!session) backTo("/", "Session expired.");
  await releaseLock(db, { sessionId: session.id, pillarId });
  revalidatePath(`/pillars/${pillarSlug}`);
  redirect(`/pillars/${pillarSlug}`);
}

export async function signOutSession() {
  const session = await currentSession();
  if (session) {
    await db.soulSession.delete({ where: { id: session.id } }).catch(() => {});
  }
  revalidatePath("/", "layout");
  redirect("/");
}
