// Flag capture — Phase 1 is queue-only: flags accumulate for Phase 5's
// adjudicators (BUILD_ORDER Phase 1). A flag cites a rulebook rule (the
// case category, MODERATION §3.1).
//
// A flag's existence is never public: the public sees only outcomes
// (triangle of blindness, MODERATION §3.2), so the gate runs in PRIVATE
// recording mode — humanity and one-flag-per-profile-per-content are
// enforced, but no ledger event exists. The flag is keyed by nullifier
// for Phase 5's nullifier-keyed handling; the reporter's profile id
// stays in Phase A operator space (deposit refunds will need it) and is
// never shown to moderators or anyone else.
//
// The flag deposit (rail "moderation.flagDeposit") wires up with Phase 4
// balances; flagging is never blocked by an empty balance (DISCUSSIONS §7).

import type { PrismaClient } from "@prisma/client";
import { clearGate } from "./gate";

export type FlagResult =
  | { ok: true; flagId: string }
  | { ok: false; reason: string };

export async function fileFlag(
  db: PrismaClient,
  input: {
    postId: string;
    profileId: string;
    ruleId: string;
    note?: string;
  }
): Promise<FlagResult> {
  const post = await db.post.findUnique({ where: { id: input.postId } });
  if (!post) return { ok: false, reason: "No such post." };

  const rule = await db.rule.findUnique({ where: { id: input.ruleId } });
  if (!rule) return { ok: false, reason: "Unknown rule — flags cite the rulebook." };

  const gate = await clearGate(db, {
    profileId: input.profileId,
    scope: `flag:post:${post.id}`,
    scopeKind: "per-profile",
    ledgerRecording: "private",
  });
  if (gate.outcome === "DUPLICATE") {
    return { ok: false, reason: "You have already flagged this content." };
  }
  if (gate.outcome !== "CLEARED" || !gate.nullifier) {
    return { ok: false, reason: `Gate: ${gate.outcome}` };
  }

  const flag = await db.flag.create({
    data: {
      postId: post.id,
      ruleId: rule.id,
      note: input.note?.trim() || null,
      reporterProfileId: input.profileId,
      nullifier: gate.nullifier,
    },
  });

  return { ok: true, flagId: flag.id };
}
