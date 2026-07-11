import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import { roomAccess } from "@/lib/circles";

// Results export in a standard format (POLLS §6) — closed polls only;
// sealed means sealed while open. Public mode includes the per-ballot
// record; pseudonymous mode exports the aggregate, nothing else.
// Circle-restricted polls export only inside the members' room.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const poll = await db.poll.findUnique({
    where: { id },
    include: {
      pillar: true,
      options: { orderBy: { position: "asc" } },
      ballots: { where: { counted: true }, include: { choices: true } },
    },
  });
  if (!poll) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (poll.status !== "closed") {
    return NextResponse.json({ error: "sealed until close" }, { status: 403 });
  }
  if (poll.visibilityScope === "circle" && poll.circleRef) {
    const circle = await db.circle.findUnique({ where: { id: poll.circleRef } });
    const viewer = await activeFace();
    const access = circle
      ? await roomAccess(db, circle, viewer?.id ?? null)
      : { read: false };
    if (!access.read) {
      return NextResponse.json(
        { error: "restricted to this Circle's members" },
        { status: 403 }
      );
    }
  }

  return NextResponse.json({
    poll: poll.title,
    pillar: poll.pillar.slug,
    type: poll.type,
    mode: poll.mode,
    governance: poll.isGovernance,
    outcome: poll.outcome,
    closedAt: poll.closedAt,
    candle: poll.candleCommitment
      ? {
          commitment: poll.candleCommitment,
          trueCloseAt: poll.trueCloseAt,
          salt: poll.candleSalt,
        }
      : undefined,
    results: poll.options.map((o) => ({
      position: o.position,
      label: o.label,
      votes: o.tally ?? 0,
    })),
    countedBallots: poll.ballots.length,
    publicRecord:
      poll.mode === "public"
        ? poll.ballots.map((b) => ({
            handle: b.voterHandle,
            displayName: b.voterDisplayName,
            options: b.choices.map((c) => c.optionId),
          }))
        : undefined,
  });
}
