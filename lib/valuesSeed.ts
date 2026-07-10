// The values seed (ONBOARDING Stage 5): one question per pillar — each
// pillar's OUSIA question, the "what is it, at its core?" lens (the
// spec's recommendation). Encouraged, never blocking; skipped seeds just
// mean weaker Circle matchmaking until real participation fills the gap.
// Answers are per-profile and MATCHMAKING-ONLY (the ratified conservative
// default) — never rendered publicly.

import type { PrismaClient } from "@prisma/client";
import { grant, grantAlreadyGiven } from "./economy";
import { getRail } from "./rails";

/** The seven OUSIA questions: canon positions 1, 8, 15, 22, 29, 36, 43. */
export async function seedQuestions(db: PrismaClient) {
  return db.question.findMany({
    where: { lens: "OUSIA" },
    orderBy: { position: "asc" },
    include: { pillar: true },
  });
}

export async function saveSeedAnswer(
  db: PrismaClient,
  input: { profileId: string; questionId: string; body: string }
): Promise<{ ok: boolean; reason?: string }> {
  const body = input.body.trim();
  if (!body) return { ok: false, reason: "Empty answer." };
  const question = await db.question.findUnique({
    where: { id: input.questionId },
  });
  if (!question || question.lens !== "OUSIA") {
    return { ok: false, reason: "Not a seed question." };
  }
  await db.valuesAnswer.upsert({
    where: {
      profileId_questionId: {
        profileId: input.profileId,
        questionId: input.questionId,
      },
    },
    create: { profileId: input.profileId, questionId: input.questionId, body },
    update: { body },
  });

  // Welcome Grant milestone: all seven answered (ECONOMIC §3) — once.
  const answered = await db.valuesAnswer.count({
    where: { profileId: input.profileId },
  });
  if (answered >= 7 && !(await grantAlreadyGiven(db, input.profileId, "grant.seed"))) {
    await db.$transaction(async (tx) => {
      await grant(tx, {
        profileId: input.profileId,
        currency: "PC",
        amount: await getRail(tx, "grant.valuesSeed.pc"),
        kind: "grant.seed",
      });
    });
  }
  return { ok: true };
}

export async function seedProgress(db: PrismaClient, profileId: string) {
  const answered = await db.valuesAnswer.count({ where: { profileId } });
  return { answered, total: 7 };
}
