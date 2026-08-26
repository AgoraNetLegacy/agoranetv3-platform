// Public Chamber storefront cover images.
//
// Upload law:
// - Originals never persist. Decode, auto-orient, crop to 16:9, strip
//   metadata, and re-encode WebP before anything reaches object storage.
// - The current image metadata lives on Chamber; every addition or
//   replacement is also an append-only civic-ledger event.
// - Authorization is per identity: only the Chamber creator may change it.

import { createHash } from "crypto";
import sharp from "sharp";
import type { PrismaClient } from "@prisma/client";
import { appendEvent } from "./ledger";

export const CHAMBER_COVER_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const CHAMBER_COVER_ALT_MAX = 160;
const ACCEPTED_INPUT = new Set(["image/jpeg", "image/png", "image/webp"]);

export function chamberCoversEnabled(): boolean {
  return process.env.CHAMBER_COVERS_ENABLED === "true";
}

export type PreparedChamberCover = {
  bytes: Buffer;
  altText: string;
  contentHash: string;
};

export type ChamberCoverResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; reason: string };

/** Validate and sanitize one cover before upload. */
export async function prepareChamberCover(input: {
  bytes: Buffer;
  declaredMime: string;
  altText: string;
}): Promise<ChamberCoverResult<{ cover: PreparedChamberCover }>> {
  const altText = input.altText.trim();
  if (altText.length > CHAMBER_COVER_ALT_MAX) {
    return {
      ok: false,
      reason: `Keep the image description to ${CHAMBER_COVER_ALT_MAX} characters or fewer.`,
    };
  }
  if (input.bytes.length === 0) {
    return { ok: false, reason: "That image file is empty." };
  }
  if (input.bytes.length > CHAMBER_COVER_MAX_UPLOAD_BYTES) {
    return { ok: false, reason: "Cover images must be 5 MB or smaller." };
  }
  if (!ACCEPTED_INPUT.has(input.declaredMime)) {
    return { ok: false, reason: "Cover images must be JPEG, PNG, or WebP." };
  }

  let bytes: Buffer;
  try {
    // The 12MP decode ceiling prevents decompression bombs. A fixed 16:9
    // WebP gives every storefront a predictable, metadata-free cover.
    bytes = await sharp(input.bytes, {
      animated: false,
      pages: 1,
      limitInputPixels: 12_000_000,
    })
      .rotate()
      .resize(1600, 900, { fit: "cover", position: "centre" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return { ok: false, reason: "That file couldn't be read as an image." };
  }

  return {
    ok: true,
    cover: {
      bytes,
      altText,
      contentHash: createHash("sha256").update(bytes).digest("hex"),
    },
  };
}

/** Persist uploaded metadata and its public accountability event together. */
export async function recordChamberCover(
  db: PrismaClient,
  input: {
    chamberId: string;
    profileId: string;
    imageUrl: string;
    altText: string;
    contentHash: string;
  }
): Promise<ChamberCoverResult> {
  let parsed: URL;
  try {
    parsed = new URL(input.imageUrl);
  } catch {
    return { ok: false, reason: "Image storage returned an invalid address." };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "Image storage must return a secure address." };
  }
  if (!/^[a-f0-9]{64}$/.test(input.contentHash)) {
    return { ok: false, reason: "Image integrity check failed." };
  }

  return db.$transaction(async (tx) => {
    const chamber = await tx.chamber.findUnique({ where: { id: input.chamberId } });
    if (!chamber) return { ok: false as const, reason: "No such chamber." };
    if (chamber.creatorProfileId !== input.profileId) {
      return { ok: false as const, reason: "Only the chamber creator can change its cover." };
    }

    const previousHash = chamber.coverImageHash;
    await tx.chamber.update({
      where: { id: chamber.id },
      data: {
        coverImageUrl: input.imageUrl,
        coverImageAlt: input.altText,
        coverImageHash: input.contentHash,
        coverImageUpdatedAt: new Date(),
      },
    });
    await appendEvent(tx, {
      actorType: "soul",
      actorId: chamber.creatorHandle,
      eventType: previousHash
        ? "chamber.cover-image.replaced"
        : "chamber.cover-image.added",
      payload: {
        chamberRef: chamber.id,
        imageUrl: input.imageUrl,
        altText: input.altText,
        sha256: input.contentHash,
        replacesSha256: previousHash ?? undefined,
      },
    });
    return { ok: true as const };
  });
}
