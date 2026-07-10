// The Poll engine (POLLS_SPEC.md, fully ratified).
//
// One profile, one vote — the gate's per-poll nullifier IS the ballot
// key, and nothing (stake, tenure, fees) ever weights a vote. Sealed
// means sealed: while a poll is open, no tally exists anywhere public —
// votes clear the gate in PRIVATE recording mode, ballots live in the
// primary database, and the ledger learns everything at close, at once:
// the results, the candle reveal, and (public mode) the per-ballot
// records. Tamper-evidence (§9 integrity condition): the close writes
// recomputable commitments — anyone can re-derive the tallies from the
// published records, and db:verify does, loudly.
//
// The candle (governance, §8): the true close is drawn randomly inside
// the final stretch and committed at creation as sha256(trueCloseAt|salt).
// Voting stays open to the nominal end; only ballots cast before the
// hidden moment count. Snipers are blind and the finish line is
// unpredictable; honest voters never notice.
//
// Vote + creation fees are designated (rails) and wire at Phase 4.

import { createHash, randomBytes } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { clearGate } from "./gate";
import { appendEvent, canonicalJson } from "./ledger";
import { getRail } from "./rails";
import { hasPostingConsents } from "./consent";

export type PollType = "single" | "multi" | "consensus";
export type PollMode = "public" | "pseudonymous";

export function candleCommitmentFor(trueCloseAt: Date, salt: string): string {
  return createHash("sha256")
    .update(`${trueCloseAt.toISOString()}|${salt}`)
    .digest("hex");
}

/** Deterministic ballot commitment for pseudonymous polls: re-derivable
 *  from the stored ballots, publishable without exposing anything new. */
export function ballotsHashFor(
  ballots: Array<{ nullifier: string; counted: boolean; optionPositions: number[] }>
): string {
  const canonical = canonicalJson(
    [...ballots]
      .sort((a, b) => (a.nullifier < b.nullifier ? -1 : 1))
      .map((b) => ({
        nullifier: b.nullifier,
        counted: b.counted,
        options: [...b.optionPositions].sort((x, y) => x - y),
      }))
  );
  return createHash("sha256").update(canonical).digest("hex");
}

export type PollResult<T = object> = ({ ok: true } & T) | { ok: false; reason: string };

export async function createPoll(
  db: PrismaClient,
  input: {
    profileId: string;
    pillarId: string;
    title: string;
    description?: string;
    type: PollType;
    mode: PollMode;
    options: string[];
    durationHours: number;
    consensusThreshold?: number;
    isGovernance?: boolean;
    liveTally?: boolean;
  }
): Promise<PollResult<{ pollId: string }>> {
  const title = input.title.trim();
  if (!title) return { ok: false, reason: "A poll needs a question." };
  const options = input.options.map((o) => o.trim()).filter(Boolean);
  if (options.length < 2) return { ok: false, reason: "At least two options." };
  if (!Number.isFinite(input.durationHours) || input.durationHours < 1) {
    return { ok: false, reason: "Duration must be at least one hour." };
  }
  if (input.type === "consensus") {
    const t = input.consensusThreshold;
    if (t === undefined || t < 0.5 || t > 1) {
      return { ok: false, reason: "Consensus polls set a threshold between 50% and 100%." };
    }
  }

  const profile = await db.profile.findUnique({ where: { id: input.profileId } });
  if (!profile || profile.status !== "active") {
    return { ok: false, reason: "No active face." };
  }
  if (!(await hasPostingConsents(db, profile.id))) {
    return { ok: false, reason: "The permanence and Constitution acknowledgments come first." };
  }
  const pillar = await db.pillar.findUnique({ where: { id: input.pillarId } });
  if (!pillar) return { ok: false, reason: "No such pillar." };

  const isGovernance = input.isGovernance ?? false;
  // Governance polls are always sealed — no live-tally option, ever.
  const liveTally = isGovernance ? false : (input.liveTally ?? false);

  const now = Date.now();
  const nominalCloseAt = new Date(now + input.durationHours * 3_600_000);

  let trueCloseAt = nominalCloseAt;
  let candleSalt: string | null = null;
  let candleCommitment: string | null = null;
  if (isGovernance) {
    const windowPercent = await getRail(db, "poll.candleWindowPercent");
    const windowMs = (input.durationHours * 3_600_000 * windowPercent) / 100;
    const candleStart = nominalCloseAt.getTime() - windowMs;
    trueCloseAt = new Date(candleStart + Math.random() * windowMs);
    candleSalt = randomBytes(16).toString("hex");
    candleCommitment = candleCommitmentFor(trueCloseAt, candleSalt);
  }

  // Creating a poll is its own gated action instance.
  const gate = await clearGate(db, {
    profileId: profile.id,
    scope: `poll-create:${randomBytes(8).toString("hex")}`,
    scopeKind: "per-profile",
  });
  if (gate.outcome !== "CLEARED") return { ok: false, reason: `Gate: ${gate.outcome}` };

  const poll = await db.$transaction(async (tx) => {
    const created = await tx.poll.create({
      data: {
        pillarId: pillar.id,
        creatorProfileId: profile.id,
        creatorHandle: profile.handle,
        title,
        description: input.description?.trim() || null,
        type: input.type,
        consensusThreshold: input.type === "consensus" ? input.consensusThreshold : null,
        mode: input.mode,
        isGovernance,
        liveTally,
        nominalCloseAt,
        trueCloseAt,
        candleSalt,
        candleCommitment,
        options: {
          create: options.map((label, i) => ({ label, position: i + 1 })),
        },
      },
    });
    await appendEvent(tx, {
      actorType: "soul",
      actorId: profile.handle,
      eventType: "poll.created",
      payload: {
        pollRef: created.id,
        pillar: pillar.slug,
        title,
        type: input.type,
        mode: input.mode,
        governance: isGovernance,
        options,
        nominalCloseAt: nominalCloseAt.toISOString(),
        // The candle promise, made in public before a single vote exists.
        candleCommitment: candleCommitment ?? undefined,
        handle: profile.handle,
      },
    });
    return created;
  });

  return { ok: true, pollId: poll.id };
}

export async function castVote(
  db: PrismaClient,
  input: { pollId: string; profileId: string; optionIds: string[] }
): Promise<PollResult> {
  const poll = await db.poll.findUnique({
    where: { id: input.pollId },
    include: { options: true },
  });
  if (!poll) return { ok: false, reason: "No such poll." };
  if (poll.status !== "open" || new Date() >= poll.nominalCloseAt) {
    return { ok: false, reason: "This poll is closed." };
  }

  const optionIds = Array.from(new Set(input.optionIds));
  const valid = optionIds.every((id) => poll.options.some((o) => o.id === id));
  if (!valid || optionIds.length === 0) {
    return { ok: false, reason: "Choose from this poll's options." };
  }
  if (poll.type !== "multi" && optionIds.length !== 1) {
    return { ok: false, reason: "This poll takes exactly one choice." };
  }

  const profile = await db.profile.findUnique({ where: { id: input.profileId } });
  if (!profile || profile.status !== "active") {
    return { ok: false, reason: "No active face." };
  }

  // One vote per profile: the per-poll scope makes a second attempt a
  // DUPLICATE — refused privately (visible only to the soul). PRIVATE
  // recording: sealed means sealed; the ledger learns nothing mid-poll.
  const gate = await clearGate(db, {
    profileId: profile.id,
    scope: `poll:${poll.id}`,
    scopeKind: "per-profile",
    ledgerRecording: "private",
  });
  if (gate.outcome === "DUPLICATE") {
    return { ok: false, reason: "You have already voted in this poll." };
  }
  if (gate.outcome !== "CLEARED" || !gate.nullifier) {
    return { ok: false, reason: `Gate: ${gate.outcome}` };
  }

  await db.ballot.create({
    data: {
      pollId: poll.id,
      nullifier: gate.nullifier,
      // Public mode attaches the face by design; pseudonymous mode is
      // nullifier-keyed only — no profile, ever (DUAL_IDENTITY §4.3).
      voterProfileId: poll.mode === "public" ? profile.id : null,
      voterHandle: poll.mode === "public" ? profile.handle : null,
      voterDisplayName: poll.mode === "public" ? profile.displayName : null,
      choices: { create: optionIds.map((optionId) => ({ optionId })) },
    },
  });

  return { ok: true };
}

/** The live tally — exists ONLY for ordinary polls whose creator enabled
 *  it. Everywhere else, null while open: sealed means sealed. */
export async function visibleTally(
  db: PrismaClient,
  pollId: string
): Promise<Map<string, number> | null> {
  const poll = await db.poll.findUnique({ where: { id: pollId } });
  if (!poll) return null;
  if (poll.status === "open" && !(poll.liveTally && !poll.isGovernance)) {
    return null;
  }
  const choices = await db.ballotChoice.findMany({
    where: {
      option: { pollId },
      ...(poll.status === "closed" ? { ballot: { counted: true } } : {}),
    },
    select: { optionId: true },
  });
  const tally = new Map<string, number>();
  for (const c of choices) tally.set(c.optionId, (tally.get(c.optionId) ?? 0) + 1);
  return tally;
}

/** Close every poll whose nominal end has passed. The candle decides
 *  which ballots count; the ledger receives the whole story at once. */
export async function closeDuePolls(db: PrismaClient): Promise<number> {
  const due = await db.poll.findMany({
    where: { status: "open", nominalCloseAt: { lte: new Date() } },
    include: { options: { orderBy: { position: "asc" } }, ballots: { include: { choices: true } } },
  });

  for (const poll of due) {
    await db.$transaction(async (tx) => {
      // The candle: only ballots cast before the hidden true close count.
      const counted = poll.ballots.filter((b) => b.castAt <= poll.trueCloseAt);
      const late = poll.ballots.length - counted.length;

      for (const ballot of poll.ballots) {
        await tx.ballot.update({
          where: { id: ballot.id },
          data: { counted: ballot.castAt <= poll.trueCloseAt },
        });
      }

      const tallies: Record<string, number> = {};
      for (const option of poll.options) tallies[String(option.position)] = 0;
      const positionByOptionId = new Map(poll.options.map((o) => [o.id, o.position]));
      for (const ballot of counted) {
        for (const choice of ballot.choices) {
          const pos = String(positionByOptionId.get(choice.optionId));
          tallies[pos] = (tallies[pos] ?? 0) + 1;
        }
      }
      for (const option of poll.options) {
        await tx.pollOption.update({
          where: { id: option.id },
          data: { tally: tallies[String(option.position)] ?? 0 },
        });
      }

      // Consensus: does the leading option's share of counted ballots
      // clear the creator-set threshold?
      let outcome = "completed";
      if (poll.type === "consensus") {
        const top = Math.max(0, ...Object.values(tallies));
        outcome =
          counted.length > 0 && top / counted.length >= (poll.consensusThreshold ?? 1)
            ? "passed"
            : "no-consensus";
      }

      const ballotsHash = ballotsHashFor(
        poll.ballots.map((b) => ({
          nullifier: b.nullifier,
          counted: b.castAt <= poll.trueCloseAt,
          optionPositions: b.choices.map(
            (c) => positionByOptionId.get(c.optionId) ?? -1
          ),
        }))
      );

      await tx.poll.update({
        where: { id: poll.id },
        data: { status: "closed", closedAt: new Date(), outcome },
      });

      await appendEvent(tx, {
        actorType: "system",
        eventType: "poll.closed",
        payload: {
          pollRef: poll.id,
          tallies,
          countedBallots: counted.length,
          lateBallots: late,
          outcome,
          // The candle reveal — verifiable against the commitment
          // published in poll.created before any vote existed.
          candleReveal: poll.candleCommitment
            ? {
                trueCloseAt: poll.trueCloseAt.toISOString(),
                salt: poll.candleSalt,
              }
            : undefined,
          // Pseudonymous tamper-evidence: recomputable from the stored
          // ballots; alteration after the fact is publicly detectable.
          ballotsHash,
        },
      });

      // Public mode: the per-ballot records become public at close —
      // on this poll's record only, never compiled across polls.
      if (poll.mode === "public") {
        for (const ballot of counted) {
          await appendEvent(tx, {
            actorType: "soul",
            actorId: ballot.voterHandle,
            eventType: "vote.recorded",
            payload: {
              pollRef: poll.id,
              handle: ballot.voterHandle,
              displayName: ballot.voterDisplayName,
              options: ballot.choices
                .map((c) => positionByOptionId.get(c.optionId))
                .sort(),
            },
          });
        }
      }
    });
  }
  return due.length;
}
