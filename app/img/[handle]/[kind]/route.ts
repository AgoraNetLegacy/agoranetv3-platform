// Profile imagery serving (PROFILE_PAGE_SPEC §4/§6): handle-keyed —
// handles are the public attribution key; internal profile ids never
// ride a URL. Falls back to the deterministic identicon, so every
// surface can render <img src="/img/{handle}/avatar"> unconditionally
// and no soul is ever a blank. Same-origin only (CSP img-src 'self').

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { identiconSvg, IMAGE_KINDS, type ImageKind } from "@/lib/images";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ handle: string; kind: string }> }
) {
  const { handle, kind } = await params;
  if (!(IMAGE_KINDS as readonly string[]).includes(kind)) {
    return new NextResponse("unknown kind", { status: 404 });
  }
  // status: "active" — a PENDING alias is invisible everywhere else
  // (souls page, search, DM/fellow lookups). Without this filter the
  // route is an existence oracle (200 identicon vs 404) that would
  // defeat the cohort activation-delay unlinkability, and would serve a
  // pending profile's bytes. 404 exactly as for a nonexistent handle.
  const profile = await db.profile.findFirst({
    where: { handle: handle.toLowerCase(), status: "active" },
    select: { id: true, handle: true },
  });
  if (!profile) return new NextResponse("no such soul", { status: 404 });

  const image = await db.profileImage.findUnique({
    where: { profileId_kind: { profileId: profile.id, kind } },
  });
  if (image) {
    return new NextResponse(new Uint8Array(image.bytes), {
      headers: {
        "Content-Type": image.mime,
        // Live-surface content: short shared cache, revalidate cheap.
        "Cache-Control": "public, max-age=60",
      },
    });
  }
  return new NextResponse(identiconSvg(profile.handle, kind as ImageKind), {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
