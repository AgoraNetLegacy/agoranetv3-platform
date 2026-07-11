"use server";

// Server actions. Every identity step routes through lib/identity.ts
// ceremonies (which route through the gate); every write action checks
// the active face from the SoulSession. No dev backdoors remain.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  createPost,
  editPost,
  createPollDiscussion,
  upgradePostPermanence,
} from "@/lib/discussions";
import { createPoll, castVote } from "@/lib/polls";
import {
  formCircle,
  editPurpose,
  joinCircle,
  leaveCircle,
  postOffer,
  updateOffer,
  logAction,
  attestAction,
} from "@/lib/circles";
import { tip, grant, grantAlreadyGiven } from "@/lib/economy";
import { getRail } from "@/lib/rails";
import { fileFlag } from "@/lib/flags";
import {
  equipBadge,
  passBadge,
  submitRuling,
  reviewSupervisedRuling,
  submitTribunalRuling,
  appealCase,
  acceptRestorative,
} from "@/lib/moderation";
import { markRead } from "@/lib/notifications";
import {
  verifyHumanity,
  registerTrueSelf,
  registerAlias,
  profileForAccessKey,
  activateDueAliases,
  changeDisplayName,
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
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  const face = await requireFace();

  const result = await createPost(db, {
    discussionId,
    profileId: face.id,
    body,
    parentId,
    humanMade: formData.get("humanMade") === "on",
    source: sourceUrl
      ? {
          url: sourceUrl,
          kind: String(formData.get("sourceKind") ?? "other"),
          vouch: formData.get("sourceVouch") === "vouched" ? "vouched" : "unverified",
        }
      : undefined,
  });
  revalidatePath(`/d/${discussionId}`);
  backTo(`/d/${discussionId}`, result.ok ? undefined : result.reason);
}

export async function submitTip(formData: FormData) {
  const postId = String(formData.get("postId") ?? "");
  const discussionId = String(formData.get("discussionId") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const face = await requireFace();

  const result = await tip(db, { postId, tipperProfileId: face.id, amount });
  revalidatePath(`/d/${discussionId}`);
  backTo(`/d/${discussionId}`, result.ok ? "Tip sent — appreciation that costs something means something." : result.reason);
}

export async function submitPermanenceUpgrade(formData: FormData) {
  const postId = String(formData.get("postId") ?? "");
  const discussionId = String(formData.get("discussionId") ?? "");
  const face = await requireFace();

  const result = await upgradePostPermanence(db, { postId, profileId: face.id });
  revalidatePath(`/d/${discussionId}`);
  backTo(
    `/d/${discussionId}`,
    result.ok
      ? "Your words are now permanent record — hash-committed to the ledger."
      : result.reason
  );
}

export async function completeOrientation(formData: FormData) {
  const returnTo = String(formData.get("returnTo") ?? "");
  const face = await requireFace();
  if (!(await grantAlreadyGiven(db, face.id, "grant.orientation"))) {
    await db.$transaction(async (tx) => {
      await grant(tx, {
        profileId: face.id,
        currency: "PC",
        amount: await getRail(tx, "grant.orientation.pc"),
        kind: "grant.orientation",
      });
    });
  }
  redirect(`/verify/seed${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`);
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

// ------------------------------------------------------------------ polls

export async function submitPoll(formData: FormData) {
  const face = await requireFace();
  const pillarId = String(formData.get("pillarId") ?? "");
  const isGovernance = formData.get("isGovernance") === "1";
  const type = String(formData.get("type") ?? "single") as "single" | "multi" | "consensus";
  const thresholdRaw = Number(formData.get("thresholdPercent") ?? "");
  const circleId = String(formData.get("circleId") ?? "");

  const result = await createPoll(db, {
    profileId: face.id,
    pillarId,
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    type,
    mode: String(formData.get("mode") ?? "pseudonymous") as "public" | "pseudonymous",
    options: String(formData.get("options") ?? "").split("\n"),
    durationHours: Number(formData.get("durationHours") ?? 0),
    consensusThreshold: type === "consensus" ? thresholdRaw / 100 : undefined,
    isGovernance,
    liveTally: formData.get("liveTally") === "on",
    circle: circleId ? { circleId } : undefined,
  });
  if (!result.ok) {
    const back = String(formData.get("backTo") ?? "/");
    backTo(back, result.reason);
  }
  redirect(`/polls/${result.pollId}`);
}

export async function submitVote(formData: FormData) {
  const face = await requireFace();
  const pollId = String(formData.get("pollId") ?? "");
  const optionIds = formData.getAll("optionIds").map(String).filter(Boolean);

  const result = await castVote(db, { pollId, profileId: face.id, optionIds });
  revalidatePath(`/polls/${pollId}`);
  backTo(`/polls/${pollId}`, result.ok ? "Your vote is in — one voice, counted once." : result.reason);
}

export async function startPollDiscussion(formData: FormData) {
  const face = await requireFace();
  const pollId = String(formData.get("pollId") ?? "");
  const result = await createPollDiscussion(db, { pollId, profileId: face.id });
  if (!result.ok) backTo(`/polls/${pollId}`, result.reason);
  redirect(`/d/${result.postId}`);
}

// --------------------------------------------------------------- circles

export async function submitCircle(formData: FormData) {
  const face = await requireFace();
  const result = await formCircle(db, {
    profileId: face.id,
    name: String(formData.get("name") ?? ""),
    purpose: String(formData.get("purpose") ?? ""),
    pillarId: String(formData.get("pillarId") ?? "") || null,
    placeTag: String(formData.get("placeTag") ?? "") || null,
    problem: String(formData.get("problem") ?? "") || null,
  });
  if (!result.ok) backTo("/circles", result.reason);
  redirect(`/circles/${result.circleId}`);
}

export async function submitPurposeEdit(formData: FormData) {
  const face = await requireFace();
  const circleId = String(formData.get("circleId") ?? "");
  const result = await editPurpose(db, {
    circleId,
    profileId: face.id,
    purpose: String(formData.get("purpose") ?? ""),
    pillarId: String(formData.get("pillarId") ?? "") || null,
    placeTag: String(formData.get("placeTag") ?? "") || null,
    problem: String(formData.get("problem") ?? "") || null,
  });
  revalidatePath(`/circles/${circleId}`);
  backTo(`/circles/${circleId}`, result.ok ? "Purpose amended — the prior version stays on the record." : result.reason);
}

export async function submitJoinCircle(formData: FormData) {
  const face = await requireFace();
  const circleId = String(formData.get("circleId") ?? "");
  const result = await joinCircle(db, {
    circleId,
    profileId: face.id,
    acceptedAliasWarning: formData.get("acceptedAliasWarning") === "on",
  });
  if (!result.ok && result.aliasWarning) {
    backTo(`/circles/${circleId}/join`, result.reason);
  }
  revalidatePath(`/circles/${circleId}`);
  backTo(`/circles/${circleId}`, result.ok ? "You are in — the Circle is its members." : result.reason);
}

export async function submitLeaveCircle(formData: FormData) {
  const face = await requireFace();
  const circleId = String(formData.get("circleId") ?? "");
  const result = await leaveCircle(db, { circleId, profileId: face.id });
  revalidatePath(`/circles/${circleId}`);
  backTo(`/circles/${circleId}`, result.ok ? "You left — logged as public record, like joining." : result.reason);
}

export async function submitOffer(formData: FormData) {
  const face = await requireFace();
  const circleId = String(formData.get("circleId") ?? "");
  const result = await postOffer(db, {
    circleId,
    profileId: face.id,
    kind: String(formData.get("kind") ?? ""),
    body: String(formData.get("body") ?? ""),
  });
  revalidatePath(`/circles/${circleId}/room`);
  backTo(`/circles/${circleId}/room`, result.ok ? undefined : result.reason);
}

export async function submitOfferUpdate(formData: FormData) {
  const face = await requireFace();
  const circleId = String(formData.get("circleId") ?? "");
  const result = await updateOffer(db, {
    offerId: String(formData.get("offerId") ?? ""),
    profileId: face.id,
    body: String(formData.get("body") ?? "") || undefined,
    retract: formData.get("retract") === "1",
  });
  revalidatePath(`/circles/${circleId}/room`);
  backTo(`/circles/${circleId}/room`, result.ok ? undefined : result.reason);
}

export async function submitActionEntry(formData: FormData) {
  const face = await requireFace();
  const circleId = String(formData.get("circleId") ?? "");
  const result = await logAction(db, {
    circleId,
    profileId: face.id,
    body: String(formData.get("body") ?? ""),
    didAt: String(formData.get("didAt") ?? ""),
    place: String(formData.get("place") ?? ""),
    correctionOfId: String(formData.get("correctionOfId") ?? "") || undefined,
    drewOnOfferIds: formData.getAll("drewOn").map(String).filter(Boolean),
  });
  revalidatePath(`/circles/${circleId}`);
  backTo(
    `/circles/${circleId}`,
    result.ok
      ? "Logged — permanent public record, awaiting co-signers."
      : result.reason
  );
}

export async function submitAttest(formData: FormData) {
  const face = await requireFace();
  const circleId = String(formData.get("circleId") ?? "");
  const result = await attestAction(db, {
    entryId: String(formData.get("entryId") ?? ""),
    profileId: face.id,
  });
  revalidatePath(`/circles/${circleId}`);
  backTo(
    `/circles/${circleId}`,
    result.ok ? "Attested — your pseudonymous reputation is on it, permanently." : result.reason
  );
}

/** Binding stewardship polls (CIRCLES §7): the form picks the decision,
 *  this action composes the poll — consensus type, Adopt/Decline, the
 *  Circle's own bar. */
export async function submitStewardshipPoll(formData: FormData) {
  const face = await requireFace();
  const circleId = String(formData.get("circleId") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const target = String(formData.get("target") ?? "").trim().replace(/^@/, "");
  const back = `/circles/${circleId}/room`;

  const circle = await db.circle.findUnique({ where: { id: circleId } });
  if (!circle) backTo(back, "No such Circle.");

  let action: string;
  let title: string;
  let threshold = circle.removalBarPercent / 100;
  switch (kind) {
    case "remove-member":
      action = `remove-member:${target}`;
      title = `Remove @${target} from this Circle?`;
      break;
    case "appoint-founder":
      action = `appoint-founder:${target}`;
      title = `Appoint @${target} as founder (purpose-statement steward)?`;
      threshold = 0.5;
      break;
    case "close-circle":
      action = "close-circle";
      title = "Close this Circle? Its page and log remain public forever; the room goes read-only.";
      threshold = 0.5;
      break;
    case "set-attestation-threshold":
      action = `set-attestation-threshold:${target}`;
      title = `Set the attestation threshold to ${target} co-signers?`;
      threshold = 0.5;
      break;
    default:
      backTo(back, "Unknown stewardship decision.");
  }

  const result = await createPoll(db, {
    profileId: face.id,
    pillarId: circle.pillarId ?? (await db.pillar.findFirstOrThrow({ where: { isMeta: true } })).id,
    title,
    type: "consensus",
    mode: "pseudonymous",
    options: ["Adopt", "Decline"],
    durationHours: Number(formData.get("durationHours") ?? 72),
    consensusThreshold: threshold,
    circle: { circleId, action },
  });
  if (!result.ok) backTo(back, result.reason);
  redirect(`/polls/${result.pollId}`);
}

// ------------------------------------------------------------ moderation

export async function equipOffer(formData: FormData) {
  const face = await requireFace();
  const result = await equipBadge(db, {
    offerId: String(formData.get("offerId") ?? ""),
    profileId: face.id,
  });
  backTo("/moderation", result.ok ? "Badge equipped — 48 hours on the bench." : result.reason);
}

export async function passOffer(formData: FormData) {
  const face = await requireFace();
  await passBadge(db, {
    offerId: String(formData.get("offerId") ?? ""),
    profileId: face.id,
  });
  backTo("/moderation", "Passed, freely — the next draw is just as random.");
}

export async function submitCaseRuling(formData: FormData) {
  const face = await requireFace();
  const result = await submitRuling(db, {
    caseId: String(formData.get("caseId") ?? ""),
    profileId: face.id,
    verdict: String(formData.get("verdict") ?? "") as
      | "uphold"
      | "decline"
      | "no-rule-fits"
      | "escalate",
    citedRuleId: String(formData.get("citedRuleId") ?? "") || undefined,
    badFaithFlag: formData.get("badFaithFlag") === "on",
  });
  backTo("/moderation", result.ok ? "Ruled. Consequences, if any, apply themselves." : result.reason);
}

export async function submitSupervision(formData: FormData) {
  const face = await requireFace();
  const result = await reviewSupervisedRuling(db, {
    rulingId: String(formData.get("rulingId") ?? ""),
    profileId: face.id,
    agree: String(formData.get("agree")) === "1",
  });
  backTo("/moderation", result.ok ? "Supervision recorded." : result.reason);
}

export async function submitTribunalCaseRuling(formData: FormData) {
  const face = await requireFace();
  const result = await submitTribunalRuling(db, {
    caseId: String(formData.get("caseId") ?? ""),
    profileId: face.id,
    verdict: String(formData.get("verdict") ?? "") as "uphold" | "decline",
    citedRuleId: String(formData.get("citedRuleId") ?? "") || undefined,
  });
  backTo("/moderation", result.ok ? "Tribunal ruling recorded." : result.reason);
}

export async function submitAppeal(formData: FormData) {
  const face = await requireFace();
  const discussionId = String(formData.get("discussionId") ?? "");
  const result = await appealCase(db, {
    caseId: String(formData.get("caseId") ?? ""),
    profileId: face.id,
  });
  backTo(
    `/d/${discussionId}`,
    result.ok
      ? "Appeal filed — fresh eyes (or the Tribunal) will review. Deposit returns if the ruling changes."
      : result.reason
  );
}

export async function submitRestorative(formData: FormData) {
  const face = await requireFace();
  const discussionId = String(formData.get("discussionId") ?? "");
  const result = await acceptRestorative(db, {
    caseId: String(formData.get("caseId") ?? ""),
    profileId: face.id,
    correction: String(formData.get("correction") ?? ""),
  });
  backTo(
    `/d/${discussionId}`,
    result.ok ? "Correction appended where the harm happened — strike reduced." : result.reason
  );
}

export async function markNotificationRead(formData: FormData) {
  const face = await requireFace();
  await markRead(db, {
    profileId: face.id,
    notificationId: String(formData.get("notificationId") ?? ""),
  });
  redirect("/inbox");
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
  const displayName = String(formData.get("displayName") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "");
  const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";

  const result = await registerTrueSelf(db, { credential, handle, displayName });
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
  const displayName = String(formData.get("displayName") ?? "");
  const disclosuresAccepted = formData.get("disclosuresAccepted") === "on";

  const result = await registerAlias(db, {
    credential,
    handle,
    displayName,
    disclosuresAccepted,
  });
  if (!result.ok) backTo("/alias", result.reason);

  await setOneTimeSecret(result.accessKey);
  redirect("/alias/key");
}

export async function updateDisplayName(formData: FormData) {
  const displayName = String(formData.get("displayName") ?? "");
  const face = await requireFace();
  const result = await changeDisplayName(db, { profileId: face.id, displayName });
  revalidatePath("/", "layout");
  backTo("/profile", result.ok ? "Display name updated (live surfaces only — permanent records keep the name they were written under)." : result.reason);
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
