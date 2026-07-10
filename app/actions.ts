"use server";

// Server actions for Phase 1. Every write goes through the gate inside
// the lib modules — nothing here touches identity or the ledger directly.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { createPost, editPost } from "@/lib/discussions";
import { fileFlag } from "@/lib/flags";
import { DEV_FACE_COOKIE, generatePseudonym } from "@/lib/devSession";

function backTo(discussionId: string, message?: string): never {
  const suffix = message ? `?m=${encodeURIComponent(message)}` : "";
  redirect(`/d/${discussionId}${suffix}`);
}

export async function selectDevFace(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  const jar = await cookies();
  if (profileId) jar.set(DEV_FACE_COOKIE, profileId, { httpOnly: true });
  else jar.delete(DEV_FACE_COOKIE);
  revalidatePath("/", "layout");
}

export async function createDevSouls() {
  await db.human.create({
    data: {
      profiles: {
        create: [
          { face: "TRUE_SELF", pseudonym: generatePseudonym() },
          { face: "ALIAS", pseudonym: generatePseudonym() },
        ],
      },
    },
  });
  revalidatePath("/", "layout");
}

async function requireFace(): Promise<string> {
  const jar = await cookies();
  const id = jar.get(DEV_FACE_COOKIE)?.value;
  if (!id) throw new Error("No face selected.");
  return id;
}

export async function submitPost(formData: FormData) {
  const discussionId = String(formData.get("discussionId") ?? "");
  const parentId = String(formData.get("parentId") ?? "") || null;
  const body = String(formData.get("body") ?? "");
  const profileId = await requireFace();

  const result = await createPost(db, { discussionId, profileId, body, parentId });
  revalidatePath(`/d/${discussionId}`);
  backTo(discussionId, result.ok ? undefined : result.reason);
}

export async function submitEdit(formData: FormData) {
  const discussionId = String(formData.get("discussionId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  const body = String(formData.get("body") ?? "");
  const profileId = await requireFace();

  const result = await editPost(db, { postId, profileId, body });
  revalidatePath(`/d/${discussionId}`);
  backTo(discussionId, result.ok ? undefined : result.reason);
}

export async function submitFlag(formData: FormData) {
  const discussionId = String(formData.get("discussionId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  const ruleId = String(formData.get("ruleId") ?? "");
  const note = String(formData.get("note") ?? "");
  const profileId = await requireFace();

  const result = await fileFlag(db, { postId, profileId, ruleId, note });
  backTo(discussionId, result.ok ? "Flag received." : result.reason);
}
