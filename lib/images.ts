// Profile imagery ingest & law (PROFILE_PAGE_SPEC §4, owner-ruled
// 2026-07-22). The platform's first user-uploaded binary content, and
// its sharpest correlation surface — every rule here is load-bearing:
//   - strip & re-encode ALWAYS: decode → auto-orient → resize → WebP.
//     sharp discards EXIF/metadata (GPS, device ids) unless explicitly
//     asked to keep it; we never ask. Originals are never stored.
//   - upload only, never fetch; serving is same-origin (CSP img-src
//     'self' already enforces the read side).
//   - live-surface class: replace destroys the old bytes, no archive.
//   - per-face, no cross-face anything — the Alias imagery warning
//     (consent ack, ceremony-grade) is the protection, not detection.

import sharp from "sharp";
import type { DbOrTx } from "./db";

export const IMAGE_KINDS = ["avatar", "banner"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

export const IMAGE_LIMITS: Record<
  ImageKind,
  { maxUploadBytes: number; width: number; height: number }
> = {
  avatar: { maxUploadBytes: 2 * 1024 * 1024, width: 512, height: 512 },
  banner: { maxUploadBytes: 5 * 1024 * 1024, width: 1500, height: 500 },
};

const ACCEPTED_INPUT = new Set(["image/jpeg", "image/png", "image/webp"]);

export type IngestResult =
  | { ok: true }
  | { ok: false; reason: string };

/** Decode, orient, crop-cover, re-encode WebP — and store. The only
 *  write path for profile imagery. */
export async function ingestProfileImage(
  db: DbOrTx,
  input: {
    profileId: string;
    kind: ImageKind;
    bytes: Buffer;
    declaredMime: string;
  }
): Promise<IngestResult> {
  const limits = IMAGE_LIMITS[input.kind];
  if (input.bytes.length === 0) return { ok: false, reason: "Empty upload." };
  if (input.bytes.length > limits.maxUploadBytes) {
    return {
      ok: false,
      reason: `Too large — the ${input.kind} limit is ${Math.round(limits.maxUploadBytes / 1024 / 1024)} MB.`,
    };
  }
  if (!ACCEPTED_INPUT.has(input.declaredMime)) {
    return { ok: false, reason: "JPEG, PNG, or WebP only." };
  }
  let out: Buffer;
  try {
    const img = sharp(input.bytes, { animated: false, pages: 1 });
    const meta = await img.metadata();
    if (!meta.width || !meta.height) throw new Error("undecodable");
    // rotate() applies EXIF orientation THEN the pipeline drops the
    // EXIF itself (no withMetadata call — that's the strip).
    out = await img
      .rotate()
      .resize(limits.width, limits.height, { fit: "cover", position: "centre" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return { ok: false, reason: "That file couldn't be read as an image." };
  }
  await db.profileImage.upsert({
    where: { profileId_kind: { profileId: input.profileId, kind: input.kind } },
    create: {
      profileId: input.profileId,
      kind: input.kind,
      mime: "image/webp",
      bytes: out,
    },
    update: { mime: "image/webp", bytes: out },
  });
  return { ok: true };
}

export async function removeProfileImage(
  db: DbOrTx,
  input: { profileId: string; kind: ImageKind }
): Promise<void> {
  await db.profileImage.deleteMany({
    where: { profileId: input.profileId, kind: input.kind },
  });
}

/** Deterministic identicon (PROFILE_PAGE_SPEC §3.2): a geometric mark
 *  generated from the handle — every soul has a mark from birth, no
 *  blank silhouettes, no third-party avatar service, ever. */
export function identiconSvg(handle: string, kind: ImageKind = "avatar"): string {
  let h = 2166136261;
  for (const c of handle) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const palette = ["#db2777", "#d97706", "#2563eb", "#059669", "#0891b2", "#dc2626", "#7c3aed"];
  const bg = ["#10181c", "#0f2530", "#1a1430", "#0c2b22", "#2b1a10", "#101c38"][h % 6];
  const fg = palette[(h >>> 3) % palette.length];
  const fg2 = palette[(h >>> 7) % palette.length];
  // 4x4 grid mirrored to 7 columns — classic identicon symmetry.
  let cells = "";
  const size = 7;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < Math.ceil(size / 2); x++) {
      const bit = (h >>> ((y * 4 + x) % 31)) & 1;
      if (!bit) continue;
      const color = ((h >>> ((y + x) % 29)) & 1) ? fg : fg2;
      cells += `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`;
      const mx = size - 1 - x;
      if (mx !== x) cells += `<rect x="${mx}" y="${y}" width="1" height="1" fill="${color}"/>`;
    }
  }
  if (kind === "banner") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 7" preserveAspectRatio="xMidYMid slice"><rect width="21" height="7" fill="${bg}"/><g opacity="0.55" transform="translate(7,0)">${cells}</g><g opacity="0.25">${cells}</g><g opacity="0.25" transform="translate(14,0)">${cells}</g></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 9 9"><rect x="-1" y="-1" width="9" height="9" fill="${bg}"/>${cells}</svg>`;
}
