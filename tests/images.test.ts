import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "child_process";
import { createTestDb, REPO_ROOT } from "./helpers/testDb";

const { url } = createTestDb("images");
process.env.DATABASE_URL = url;
process.env.GATE_OPERATOR_SECRET = "test-secret-for-image-tests";

import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import {
  ingestProfileImage,
  removeProfileImage,
  identiconSvg,
  IMAGE_LIMITS,
} from "../lib/images";
import { makeOnboardedSoul } from "./helpers/souls";

const db = new PrismaClient({ datasources: { db: { url } } });
let faceId: string;

beforeAll(async () => {
  const seeded = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  if (seeded.status !== 0) throw new Error(`seed failed: ${seeded.stderr}`);
  const soul = await makeOnboardedSoul(db, {
    trueSelf: "pictured-soul",
    alias: "pictured-shade",
  });
  faceId = soul.trueSelfId;
}, 60_000);

afterAll(async () => {
  await db.$disconnect();
});

describe("the imagery law (PROFILE_PAGE_SPEC §4)", () => {
  it("re-encodes to exact-size WebP and DESTROYS EXIF metadata", async () => {
    // A JPEG carrying EXIF (orientation flag lives in EXIF).
    const input = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 200, g: 40, b: 90 } },
    })
      .jpeg()
      .withMetadata({ orientation: 5 })
      .toBuffer();
    const inMeta = await sharp(input).metadata();
    expect(inMeta.exif).toBeDefined(); // proof the input HAD metadata

    const result = await ingestProfileImage(db, {
      profileId: faceId,
      kind: "avatar",
      bytes: input,
      declaredMime: "image/jpeg",
    });
    expect(result.ok).toBe(true);

    const row = await db.profileImage.findUniqueOrThrow({
      where: { profileId_kind: { profileId: faceId, kind: "avatar" } },
    });
    const outMeta = await sharp(Buffer.from(row.bytes)).metadata();
    expect(outMeta.format).toBe("webp");
    expect(outMeta.width).toBe(IMAGE_LIMITS.avatar.width);
    expect(outMeta.height).toBe(IMAGE_LIMITS.avatar.height);
    expect(outMeta.exif).toBeUndefined(); // the strip, proven
    expect(outMeta.orientation).toBeUndefined();
  });

  it("rejects oversize uploads, junk bytes, and disallowed mimes", async () => {
    const junk = Buffer.from("not an image at all");
    const tooBig = Buffer.alloc(IMAGE_LIMITS.avatar.maxUploadBytes + 1);
    expect(
      (await ingestProfileImage(db, { profileId: faceId, kind: "avatar", bytes: tooBig, declaredMime: "image/png" })).ok
    ).toBe(false);
    expect(
      (await ingestProfileImage(db, { profileId: faceId, kind: "avatar", bytes: junk, declaredMime: "image/png" })).ok
    ).toBe(false);
    expect(
      (await ingestProfileImage(db, { profileId: faceId, kind: "avatar", bytes: junk, declaredMime: "image/gif" })).ok
    ).toBe(false);
  });

  it("banner crops to 3:1 and removal is total", async () => {
    const input = await sharp({
      create: { width: 1000, height: 1000, channels: 3, background: { r: 10, g: 120, b: 200 } },
    })
      .png()
      .toBuffer();
    const result = await ingestProfileImage(db, {
      profileId: faceId,
      kind: "banner",
      bytes: input,
      declaredMime: "image/png",
    });
    expect(result.ok).toBe(true);
    const row = await db.profileImage.findUniqueOrThrow({
      where: { profileId_kind: { profileId: faceId, kind: "banner" } },
    });
    const meta = await sharp(Buffer.from(row.bytes)).metadata();
    expect(meta.width).toBe(1500);
    expect(meta.height).toBe(500);

    await removeProfileImage(db, { profileId: faceId, kind: "banner" });
    const gone = await db.profileImage.findUnique({
      where: { profileId_kind: { profileId: faceId, kind: "banner" } },
    });
    expect(gone).toBeNull(); // no tombstone, no archive
  });

  it("identicons are deterministic per handle and differ across handles", () => {
    expect(identiconSvg("brad")).toBe(identiconSvg("brad"));
    expect(identiconSvg("brad")).not.toBe(identiconSvg("joe"));
    expect(identiconSvg("brad", "banner")).toContain("viewBox=\"0 0 21 7\"");
  });
});
