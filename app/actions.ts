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
import {
  createChamber,
  enterChamber,
  editScaffold,
  inviteToChamber,
} from "@/lib/chambers";
import {
  sendFellowSoulRequest,
  respondToRequest,
  releaseBond,
  blockSoul,
  unblockSoul,
} from "@/lib/fellowSouls";
import {
  openThread,
  sendMessage,
  declineThread,
  setThreadMute,
  deleteThreadForMe,
  reportMessage,
} from "@/lib/dm";
import { Prisma } from "@prisma/client";
import { tip, grantOnce } from "@/lib/economy";
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
  clientAddress,
  markFaceFlip,
} from "@/lib/webSession";
import { enforceRateLimit, type RateLimitPolicyName } from "@/lib/rateLimit";
import { recordEvent, type AnalyticsEventName } from "@/lib/analytics";

function backTo(path: string, message?: string): never {
  const suffix = message ? `?m=${encodeURIComponent(message)}` : "";
  redirect(`${path}${suffix}`);
}

// Every write action passes a wall from the consolidated W4 schedule
// (lib/rateLimit.ts) plus the global backstop. Identifiers are HMAC-hashed
// before any bucket row exists — nothing here stores who acted.

// Feature vitals fall out of the same policy families the W4 schedule
// names: one count per family (never a query trail), plus the
// subject-keyed retention signal. Face-switching is a session mechanic,
// not a feature — deliberately unmeasured.
const MEASURED_FAMILIES = new Set<RateLimitPolicyName>([
  "posting", "votes", "economy", "creation", "flags",
  "moderation", "appeals", "social", "dmMessages", "settings",
]);

async function requireFace(policy?: RateLimitPolicyName) {
  const face = await activeFace();
  if (!face) throw new Error("No face is active in this session.");
  if (policy) await enforceRateLimit(db, policy, face.id);
  await enforceRateLimit(db, "global", face.id);
  if (policy && MEASURED_FAMILIES.has(policy)) {
    await recordEvent(db, `action.${policy}` as AnalyticsEventName);
    await recordEvent(db, "action.any", face.id);
  }
  return face;
}

/** Walls for surfaces that exist before any face does (verification,
 *  registration, sign-in): keyed on the browser session and — behind a
 *  declared proxy — the client address. */
async function limitArrival(policy: RateLimitPolicyName): Promise<void> {
  const sessionId = await ensureSessionId();
  await enforceRateLimit(db, policy, `session:${sessionId}`);
  const address = await clientAddress();
  if (address) await enforceRateLimit(db, policy, `addr:${address}`);
}

/** Session-keyed wall for face parking/switch controls. */
async function limitSession(policy: RateLimitPolicyName): Promise<void> {
  const session = await currentSession();
  if (session) await enforceRateLimit(db, policy, `session:${session.id}`);
}

// ---------------------------------------------------------------- posting

export async function submitPost(formData: FormData) {
  const discussionId = String(formData.get("discussionId") ?? "");
  const parentId = String(formData.get("parentId") ?? "") || null;
  const body = String(formData.get("body") ?? "");
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  const face = await requireFace("posting");

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
  const face = await requireFace("economy");

  const result = await tip(db, { postId, tipperProfileId: face.id, amount });
  revalidatePath(`/d/${discussionId}`);
  backTo(`/d/${discussionId}`, result.ok ? "Tip sent — appreciation that costs something means something." : result.reason);
}

export async function submitPermanenceUpgrade(formData: FormData) {
  const postId = String(formData.get("postId") ?? "");
  const discussionId = String(formData.get("discussionId") ?? "");
  const face = await requireFace("economy");

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
  const face = await requireFace("settings");
  // One-time orientation grant, minted atomically: the GrantClaim primary
  // key means concurrent completeOrientation requests can't double-mint —
  // exactly one wins the claim, the rest collide (P2002) and no-op.
  let granted = false;
  try {
    await db.$transaction(async (tx) => {
      await grantOnce(tx, {
        profileId: face.id,
        currency: "PC",
        amount: await getRail(tx, "grant.orientation.pc"),
        kind: "grant.orientation",
      });
    });
    granted = true;
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
      throw err;
    }
    // Already oriented (or a concurrent request won the claim) — not an error.
  }
  if (granted) await recordEvent(db, "funnel.oriented", face.id);
  redirect(`/verify/seed${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`);
}

export async function submitEdit(formData: FormData) {
  const discussionId = String(formData.get("discussionId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  const body = String(formData.get("body") ?? "");
  const face = await requireFace("posting");

  const result = await editPost(db, { postId, profileId: face.id, body });
  revalidatePath(`/d/${discussionId}`);
  backTo(`/d/${discussionId}`, result.ok ? undefined : result.reason);
}

export async function submitFlag(formData: FormData) {
  const discussionId = String(formData.get("discussionId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  const ruleId = String(formData.get("ruleId") ?? "");
  const note = String(formData.get("note") ?? "");
  const face = await requireFace("flags");

  const result = await fileFlag(db, { postId, profileId: face.id, ruleId, note });
  backTo(`/d/${discussionId}`, result.ok ? "Flag received." : result.reason);
}

// ------------------------------------------------------------------ polls

export async function submitPoll(formData: FormData) {
  const face = await requireFace("creation");
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
  const face = await requireFace("votes");
  const pollId = String(formData.get("pollId") ?? "");
  const optionIds = formData.getAll("optionIds").map(String).filter(Boolean);

  const result = await castVote(db, { pollId, profileId: face.id, optionIds });
  revalidatePath(`/polls/${pollId}`);
  backTo(`/polls/${pollId}`, result.ok ? "Your vote is in — one voice, counted once." : result.reason);
}

export async function startPollDiscussion(formData: FormData) {
  const face = await requireFace("creation");
  const pollId = String(formData.get("pollId") ?? "");
  const result = await createPollDiscussion(db, { pollId, profileId: face.id });
  if (!result.ok) backTo(`/polls/${pollId}`, result.reason);
  redirect(`/d/${result.postId}`);
}

// --------------------------------------------------------------- circles

export async function submitCircle(formData: FormData) {
  const face = await requireFace("creation");
  const result = await formCircle(db, {
    profileId: face.id,
    name: String(formData.get("name") ?? ""),
    purpose: String(formData.get("purpose") ?? ""),
    pillarId: String(formData.get("pillarId") ?? "") || null,
    domainId: String(formData.get("domainId") ?? "") || null,
    placeTag: String(formData.get("placeTag") ?? "") || null,
    problem: String(formData.get("problem") ?? "") || null,
  });
  if (!result.ok) backTo("/circles", result.reason);
  redirect(`/circles/${result.circleId}`);
}

// -------------------------------------------------------------- chambers

export async function submitChamber(formData: FormData) {
  const face = await requireFace("creation");
  const result = await createChamber(db, {
    profileId: face.id,
    title: String(formData.get("title") ?? ""),
    subject: String(formData.get("subject") ?? ""),
    pitch: String(formData.get("pitch") ?? ""),
    whyCare: String(formData.get("whyCare") ?? ""),
    isPublic: formData.get("visibility") !== "private",
    scaffold: {
      solving: String(formData.get("solving") ?? ""),
      needToKnow: String(formData.get("needToKnow") ?? ""),
      success: String(formData.get("success") ?? ""),
    },
  });
  if (!result.ok) backTo("/pollinator", result.reason);
  redirect(`/pollinator/${result.chamberId}`);
}

export async function submitEnterChamber(formData: FormData) {
  const chamberId = String(formData.get("chamberId") ?? "");
  const face = await requireFace("social");
  const result = await enterChamber(db, { chamberId, profileId: face.id });
  revalidatePath(`/pollinator/${chamberId}`);
  if (!result.ok) backTo(`/pollinator/${chamberId}`, result.reason);
  redirect(`/pollinator/${chamberId}/workshop`);
}

export async function submitScaffoldEdit(formData: FormData) {
  const chamberId = String(formData.get("chamberId") ?? "");
  const face = await requireFace("posting");
  const result = await editScaffold(db, {
    chamberId,
    profileId: face.id,
    solving: String(formData.get("solving") ?? ""),
    needToKnow: String(formData.get("needToKnow") ?? ""),
    success: String(formData.get("success") ?? ""),
  });
  revalidatePath(`/pollinator/${chamberId}/workshop`);
  backTo(
    `/pollinator/${chamberId}/workshop`,
    result.ok ? "Scaffold sharpened — the prior version stays in the history." : result.reason
  );
}

export async function submitChamberInvite(formData: FormData) {
  const chamberId = String(formData.get("chamberId") ?? "");
  const face = await requireFace("social");
  const result = await inviteToChamber(db, {
    chamberId,
    profileId: face.id,
    inviteeHandle: String(formData.get("handle") ?? ""),
  });
  revalidatePath(`/pollinator/${chamberId}/workshop`);
  backTo(
    `/pollinator/${chamberId}/workshop`,
    result.ok
      ? "Invited — they'll find it waiting on their Pollinator page."
      : result.reason
  );
}

// ------------------------------------------------------------------ feed

export async function markCaughtUp() {
  const face = await requireFace("settings");
  await db.feedSettings.upsert({
    where: { profileId: face.id },
    create: { profileId: face.id, caughtUpAt: new Date() },
    update: { caughtUpAt: new Date() },
  });
  revalidatePath("/feed");
  backTo("/feed");
}

export async function saveFeedSources(formData: FormData) {
  const face = await requireFace("settings");
  const pillarIds = formData.getAll("pillar").map(String);
  const circleIds = formData.getAll("circle").map(String);
  const chamberIds = formData.getAll("chamber").map(String);
  const domainIds = formData.getAll("domain").map(String);
  const pollIds = formData.getAll("poll").map(String);
  const fellowSouls = formData.get("fellowSouls") === "on";

  await db.$transaction(async (tx) => {
    // Replace this face's chosen sources with the submitted set —
    // one screen, adjustable anytime. (Domain/poll rows can only be
    // UNCHECKED here; they're added from their own pages.)
    await tx.feedSource.deleteMany({
      where: {
        profileId: face.id,
        OR: [
          { kind: "pillar" },
          { kind: "circle" },
          { kind: "chamber" },
          { kind: "fellow-souls" },
          { kind: "domain", refId: { notIn: domainIds } },
          { kind: "poll", refId: { notIn: pollIds } },
        ],
      },
    });
    for (const refId of pillarIds) {
      await tx.feedSource.create({ data: { profileId: face.id, kind: "pillar", refId } });
    }
    for (const refId of circleIds) {
      // Members only — a circle source you left does nothing, but keep
      // the choice honest at write time.
      const member = await tx.circleMember.findFirst({
        where: { circleId: refId, profileId: face.id, leftAt: null },
      });
      if (member) {
        await tx.feedSource.create({ data: { profileId: face.id, kind: "circle", refId } });
      }
    }
    for (const refId of chamberIds) {
      // Entered souls only — a workshop feeds no one who isn't inside.
      const member = await tx.chamberMember.findUnique({
        where: { chamberId_profileId: { chamberId: refId, profileId: face.id } },
      });
      if (member) {
        await tx.feedSource.create({ data: { profileId: face.id, kind: "chamber", refId } });
      }
    }
    if (fellowSouls) {
      await tx.feedSource.create({ data: { profileId: face.id, kind: "fellow-souls" } });
    }
    await tx.feedSettings.upsert({
      where: { profileId: face.id },
      create: {
        profileId: face.id,
        openLens: formData.get("openLens") === "on",
        balancedDiet: formData.get("balancedDiet") === "on",
      },
      update: {
        openLens: formData.get("openLens") === "on",
        balancedDiet: formData.get("balancedDiet") === "on",
      },
    });
  });
  revalidatePath("/feed");
  backTo("/feed/sources", "Sources saved — this feed is yours.");
}

export async function followInFeed(formData: FormData) {
  const face = await requireFace("settings");
  const kind = String(formData.get("kind") ?? "");
  const refId = String(formData.get("refId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/feed");
  if (!["domain", "poll", "discussion"].includes(kind) || !refId) backTo(returnTo);
  await db.feedSource.upsert({
    where: { profileId_kind_refId: { profileId: face.id, kind, refId } },
    create: { profileId: face.id, kind, refId },
    update: {},
  });
  backTo(returnTo, "Added to your feed's chosen sources.");
}

// ---------------------------------------------------------------- search

export async function deleteSearchQuery(formData: FormData) {
  const face = await requireFace("settings");
  const id = String(formData.get("id") ?? "");
  await db.searchQuery.deleteMany({ where: { id, profileId: face.id } });
  revalidatePath("/search/history");
  backTo("/search/history");
}

export async function clearSearchHistory() {
  const face = await requireFace("settings");
  await db.searchQuery.deleteMany({ where: { profileId: face.id } });
  revalidatePath("/search/history");
  backTo("/search/history");
}

// ---------------------------------------------------------------- repairs

export async function submitRepair(formData: FormData) {
  const domainId = String(formData.get("domainId") ?? "");
  const pillarSlug = String(formData.get("pillarSlug") ?? "");
  const position = String(formData.get("position") ?? "");
  const face = await requireFace("creation");

  const { submitRepair: submit } = await import("@/lib/domains");
  const result = await submit(db, {
    domainId,
    profileId: face.id,
    challenge: String(formData.get("challenge") ?? ""),
    proposedText: String(formData.get("proposedText") ?? ""),
  });
  const path = `/pillars/${pillarSlug}/domains/${position}`;
  revalidatePath(path);
  backTo(
    path,
    result.ok
      ? "Repair submitted — the governance poll deciding it is open in this pillar's room."
      : result.reason
  );
}

export async function submitPurposeEdit(formData: FormData) {
  const face = await requireFace("posting");
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
  const face = await requireFace("social");
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
  const face = await requireFace("social");
  const circleId = String(formData.get("circleId") ?? "");
  const result = await leaveCircle(db, { circleId, profileId: face.id });
  revalidatePath(`/circles/${circleId}`);
  backTo(`/circles/${circleId}`, result.ok ? "You left — logged as public record, like joining." : result.reason);
}

export async function submitOffer(formData: FormData) {
  const face = await requireFace("creation");
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
  const face = await requireFace("posting");
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
  const face = await requireFace("creation");
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
  const face = await requireFace("social");
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
  const face = await requireFace("creation");
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

// ------------------------------------------------- fellow souls & messages

export async function submitFellowRequest(formData: FormData) {
  const face = await requireFace("social");
  const result = await sendFellowSoulRequest(db, {
    fromProfileId: face.id,
    toHandle: String(formData.get("handle") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  backTo("/souls", result.ok ? "Request sent — it waits quietly; no clock ticks at them." : result.reason);
}

export async function submitRequestResponse(formData: FormData) {
  const face = await requireFace("social");
  const accept = formData.get("accept") === "1";
  const result = await respondToRequest(db, {
    requestId: String(formData.get("requestId") ?? ""),
    profileId: face.id,
    accept,
  });
  backTo(
    "/souls",
    result.ok
      ? accept
        ? "Fellow souls — DMs now land direct."
        : "Declined, quietly. They are not told."
      : result.reason
  );
}

export async function submitReleaseBond(formData: FormData) {
  const face = await requireFace("social");
  const result = await releaseBond(db, {
    profileId: face.id,
    otherProfileId: String(formData.get("otherProfileId") ?? ""),
  });
  backTo("/souls", result.ok ? "Bond released, quietly." : result.reason);
}

export async function submitBlock(formData: FormData) {
  const face = await requireFace("social");
  const result = await blockSoul(db, {
    blockerProfileId: face.id,
    blockedHandle: String(formData.get("handle") ?? ""),
  });
  backTo("/souls", result.ok ? "Blocked, quietly — they are never told." : result.reason);
}

export async function submitUnblock(formData: FormData) {
  const face = await requireFace("social");
  await unblockSoul(db, {
    blockerProfileId: face.id,
    blockedProfileId: String(formData.get("blockedProfileId") ?? ""),
  });
  backTo("/souls");
}

export async function submitOpenThread(formData: FormData) {
  const face = await requireFace("social");
  const result = await openThread(db, {
    fromProfileId: face.id,
    toHandle: String(formData.get("handle") ?? ""),
    body: String(formData.get("body") ?? ""),
  });
  if (!result.ok) backTo("/souls", result.reason);
  redirect(`/dm/${result.threadId}`);
}

export async function submitDmMessage(formData: FormData) {
  const face = await requireFace("dmMessages");
  const threadId = String(formData.get("threadId") ?? "");
  const result = await sendMessage(db, {
    threadId,
    senderProfileId: face.id,
    body: String(formData.get("body") ?? ""),
  });
  revalidatePath(`/dm/${threadId}`);
  backTo(`/dm/${threadId}`, result.ok ? undefined : result.reason);
}

export async function submitDeclineThread(formData: FormData) {
  const face = await requireFace("social");
  const result = await declineThread(db, {
    threadId: String(formData.get("threadId") ?? ""),
    profileId: face.id,
  });
  backTo("/souls", result.ok ? "Declined — the thread is closed, quietly." : result.reason);
}

export async function submitThreadMute(formData: FormData) {
  const face = await requireFace("settings");
  const threadId = String(formData.get("threadId") ?? "");
  await setThreadMute(db, {
    threadId,
    profileId: face.id,
    muted: formData.get("muted") === "1",
  });
  revalidatePath(`/dm/${threadId}`);
  backTo(`/dm/${threadId}`);
}

export async function submitThreadDelete(formData: FormData) {
  const face = await requireFace("settings");
  const result = await deleteThreadForMe(db, {
    threadId: String(formData.get("threadId") ?? ""),
    profileId: face.id,
  });
  backTo("/souls", result.ok ? "Deleted for you — their copy is theirs." : result.reason);
}

export async function submitDmReport(formData: FormData) {
  const face = await requireFace("flags");
  const threadId = String(formData.get("threadId") ?? "");
  const result = await reportMessage(db, {
    messageId: String(formData.get("messageId") ?? ""),
    profileId: face.id,
    ruleId: String(formData.get("ruleId") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  revalidatePath(`/dm/${threadId}`);
  backTo(
    `/dm/${threadId}`,
    result.ok
      ? "Reported — the excerpt goes to a random adjudicator; deposit rules apply as everywhere."
      : result.reason
  );
}

// ------------------------------------------------------------ moderation

export async function equipOffer(formData: FormData) {
  const face = await requireFace("moderation");
  const result = await equipBadge(db, {
    offerId: String(formData.get("offerId") ?? ""),
    profileId: face.id,
  });
  backTo("/moderation", result.ok ? "Badge equipped — 48 hours on the bench." : result.reason);
}

export async function passOffer(formData: FormData) {
  const face = await requireFace("moderation");
  await passBadge(db, {
    offerId: String(formData.get("offerId") ?? ""),
    profileId: face.id,
  });
  backTo("/moderation", "Passed, freely — the next draw is just as random.");
}

export async function submitCaseRuling(formData: FormData) {
  const face = await requireFace("moderation");
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
  const face = await requireFace("moderation");
  const result = await reviewSupervisedRuling(db, {
    rulingId: String(formData.get("rulingId") ?? ""),
    profileId: face.id,
    agree: String(formData.get("agree")) === "1",
  });
  backTo("/moderation", result.ok ? "Supervision recorded." : result.reason);
}

export async function submitTribunalCaseRuling(formData: FormData) {
  const face = await requireFace("moderation");
  const result = await submitTribunalRuling(db, {
    caseId: String(formData.get("caseId") ?? ""),
    profileId: face.id,
    verdict: String(formData.get("verdict") ?? "") as "uphold" | "decline",
    citedRuleId: String(formData.get("citedRuleId") ?? "") || undefined,
  });
  backTo("/moderation", result.ok ? "Tribunal ruling recorded." : result.reason);
}

export async function submitAppeal(formData: FormData) {
  const face = await requireFace("appeals");
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
  const face = await requireFace("appeals");
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
  const face = await requireFace("settings");
  await markRead(db, {
    profileId: face.id,
    notificationId: String(formData.get("notificationId") ?? ""),
  });
  redirect("/inbox");
}

// ------------------------------------------------------------- onboarding

export async function beginVerification(formData: FormData) {
  const returnTo = String(formData.get("returnTo") ?? "");
  await limitArrival("verify");
  await recordEvent(db, "funnel.gate");
  const { credential } = await verifyHumanity(db);
  // Phase A's interim issuer verifies instantly; the two funnel steps
  // separate for real when the Phase 9 issuer makes verification a trip.
  await recordEvent(db, "funnel.verified");
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
  await limitArrival("register");

  const result = await registerTrueSelf(db, { credential, handle, displayName });
  if (!result.ok) backTo(`/verify/trueself${query}`, result.reason);
  await recordEvent(db, "funnel.trueself", result.profileId);

  // Sign the new face in and make it active. The world turns from blue
  // to white here — becoming a participant is visible (§2.4).
  const sessionId = await ensureSessionId();
  await addFace(db, { sessionId, profileId: result.profileId });
  await switchFace(db, { sessionId, fromProfileId: null, toProfileId: result.profileId });
  await markFaceFlip();

  await setOneTimeSecret(result.accessKey);
  redirect(`/verify/key${query}`);
}

export async function acknowledgeConsent(formData: FormData) {
  const kind = String(formData.get("kind") ?? "") as ConsentKind;
  const next = String(formData.get("next") ?? "/verify/consents");
  if (kind !== "permanence" && kind !== "constitution") {
    throw new Error("Unknown consent kind.");
  }
  const face = await requireFace("settings");
  await recordAck(db, { profileId: face.id, kind });
  await recordEvent(db, "funnel.consents");
  redirect(next);
}

export async function submitSeedAnswer(formData: FormData) {
  const questionId = String(formData.get("questionId") ?? "");
  const body = String(formData.get("body") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "");
  const face = await requireFace("settings");
  await saveSeedAnswer(db, { profileId: face.id, questionId, body });
  await recordEvent(db, "funnel.seed");
  revalidatePath("/verify/seed");
  backTo(`/verify/seed${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`);
}

// ---------------------------------------------------------- alias ceremony

export async function hatchAlias(formData: FormData) {
  const credential = String(formData.get("credential") ?? "");
  const handle = String(formData.get("handle") ?? "");
  const displayName = String(formData.get("displayName") ?? "");
  const disclosuresAccepted = formData.get("disclosuresAccepted") === "on";
  await limitArrival("register");

  const result = await registerAlias(db, {
    credential,
    handle,
    displayName,
    disclosuresAccepted,
  });
  if (!result.ok) backTo("/alias", result.reason);
  // Count-only, deliberately: the hatch ceremony never surfaces the new
  // Alias's id, and analytics doesn't get what the ceremony withholds.
  await recordEvent(db, "funnel.alias");

  await setOneTimeSecret(result.accessKey);
  redirect("/alias/key");
}

export async function updateDisplayName(formData: FormData) {
  const displayName = String(formData.get("displayName") ?? "");
  const face = await requireFace("settings");
  const result = await changeDisplayName(db, { profileId: face.id, displayName });
  revalidatePath("/", "layout");
  backTo("/settings", result.ok ? "Display name updated (live surfaces only — permanent records keep the name they were written under)." : result.reason);
}

/** The profile window (Phase 8.5, PRESENTATION_SPEC §5.2): about-me is
 *  live-surface content — editable anytime, never permanent record. */
export async function updateProfileBio(formData: FormData) {
  const face = await requireFace("settings");
  const bio = String(formData.get("bio") ?? "").slice(0, 2000);
  const bioPlace = String(formData.get("bioPlace") ?? "").slice(0, 120);
  await db.profile.update({ where: { id: face.id }, data: { bio, bioPlace } });
  revalidatePath("/profile");
  backTo("/profile", "Saved — live surfaces only, never the permanent record.");
}

/** The testnet wallet link (Phase 8.6, TESTNET_RAILS_SPEC §6.3): the
 *  active face records which TESTNET address it connected. Mainnet is
 *  refused inside recordWalletLink — addr1… never enters the table. */
export async function submitWalletLink(formData: FormData) {
  const face = await requireFace("settings");
  const { recordWalletLink } = await import("@/lib/chain");
  const result = await recordWalletLink(db, {
    profileId: face.id,
    cardanoAddress: String(formData.get("cardanoAddress") ?? ""),
    network: String(formData.get("network") ?? ""),
  });
  revalidatePath("/settings");
  backTo("/settings", result.ok ? "Testnet wallet linked to this face." : result.reason);
}

/** §5.1 + §2.2: the switch animation is a per-face choice — flip
 *  (default), crossfade, or instant. By choice, never by detection. */
export async function setSwitchAnimation(formData: FormData) {
  const method = String(formData.get("method") ?? "flip");
  const face = await requireFace("settings");
  if (!["flip", "crossfade", "instant"].includes(method)) {
    backTo("/settings", "Unknown animation method.");
  }
  await db.profile.update({ where: { id: face.id }, data: { switchAnimation: method } });
  revalidatePath("/", "layout");
  backTo("/settings", "Switch animation set for this face.");
}

// ------------------------------------------------------------------ session

export async function loginFace(formData: FormData) {
  const accessKey = String(formData.get("accessKey") ?? "");
  await limitArrival("login");
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
  await markFaceFlip();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function switchToFace(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  await limitSession("faceSwitch");
  const session = await currentSession();
  if (!session) backTo("/", "Session expired.");
  const result = await switchFace(db, {
    sessionId: session.id,
    fromProfileId: session.activeProfileId,
    toProfileId: profileId,
  });
  if (result.ok) await markFaceFlip();
  revalidatePath("/", "layout");
  backTo("/", result.ok ? undefined : result.reason);
}

/** Returning to the hub ends the active face's pillar sessions (§3.3.5). */
export async function returnToHub() {
  await limitSession("faceSwitch");
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
  await limitSession("faceSwitch");
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
  await markFaceFlip();
  revalidatePath("/", "layout");
  redirect("/");
}
