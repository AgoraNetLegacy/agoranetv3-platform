// The Poll engine (POLLS_SPEC.md, fully ratified).
//
// One profile, one vote; the gate's per-poll nullifier IS the ballot
// key, and nothing (stake, tenure, fees) ever weights a vote. Sealed
// means sealed: while a poll is open, no tally exists anywhere public;
// votes clear the gate in PRIVATE recording mode, ballots live in the
// primary database, and the ledger learns everything at close, at once:
// the results, the candle reveal, and (public mode) the per-ballot
// records. Tamper-evidence (§9 integrity condition): the close writes
// recomputable commitments; anyone can re-derive the tallies from the
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
import { clearGateTx, gateDuplicateConfirmed } from "./gate";
import { appendEvent, canonicalJson } from "./ledger";
import { getRail } from "./rails";
import { hasPostingConsents } from "./consent";
import { chargeToTreasury, maybeFirstActionGrant } from "./economy";
import { accrueForAction } from "./accrual";

class InsufficientFunds extends Error {}

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

/** Circle-restricted polls commit their question to the public ledger by
 *  hash (disclosure stays in the members' room); verify.ts re-derives. */
export function circlePollContentHash(title: string, options: string[]): string {
  return createHash("sha256")
    .update(canonicalJson({ title, options }))
    .digest("hex");
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
    /** Circle-restricted visibility (POLLS §4.5, consumed by CIRCLES §7):
     *  scoped to the Circle's membership. `action` makes it a binding
     *  stewardship poll, executed at close if it passes. Never
     *  governance; scope is per-profile like every vote (the sharp
     *  rule holds by construction). */
    circle?: { circleId: string; action?: string };
    // Chamber-restricted (NEURAL_POLLINATOR §9.1): the binding vote that
    // authorizes a LARGE mission release. Same shape as `circle` above;
    // §9.1 asked for "the Circle binding-poll pattern," so it gets that
    // pattern rather than a parallel one.
    chamber?: { chamberId: string; action?: string };
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

  // Circle-restricted polls: members only, never governance, and a
  // binding stewardship action must clear its minimum consensus bar.
  let circleAction: string | null = null;
  if (input.circle) {
    if (input.isGovernance) {
      return { ok: false, reason: "Circle polls are never governance polls; different rooms, different law." };
    }
    const { activeMembership, validateCircleAction } = await import("./circles");
    const circle = await db.circle.findUnique({ where: { id: input.circle.circleId } });
    if (!circle) return { ok: false, reason: "No such Circle." };
    if (circle.status === "closed") return { ok: false, reason: "This Circle is closed." };
    if (!(await activeMembership(db, circle.id, profile.id))) {
      return { ok: false, reason: "Members only; Circle decisions belong to the Circle." };
    }
    if (input.circle.action) {
      const check = await validateCircleAction(db, circle, input.circle.action);
      if (!check.ok) return { ok: false, reason: check.reason };
      if (input.type !== "consensus") {
        return { ok: false, reason: "Binding stewardship decisions are consensus polls (CIRCLES §7)." };
      }
      if ((input.consensusThreshold ?? 0) < check.minThreshold) {
        return {
          ok: false,
          reason: `This decision's bar is ${Math.round(check.minThreshold * 100)}%; never lower (platform bounds).`,
        };
      }
      circleAction = input.circle.action;
    }
  }

  // Chamber-restricted polls (§9.1): the binding vote for a large
  // mission release. Members only, never governance; same law as
  // Circle polls, for the same reason: different rooms, different law.
  let chamberAction: string | null = null;
  if (input.chamber) {
    if (input.isGovernance) {
      return { ok: false, reason: "Chamber polls are never governance polls; different rooms, different law." };
    }
    if (input.circle) {
      return { ok: false, reason: "A poll belongs to one room: a Circle or a Chamber, never both." };
    }
    const chamber = await db.chamber.findUnique({ where: { id: input.chamber.chamberId } });
    if (!chamber) return { ok: false, reason: "No such chamber." };
    const member = await db.chamberMember.findFirst({
      where: { chamberId: chamber.id, profileId: profile.id },
    });
    if (!member) {
      return { ok: false, reason: "Members only; a chamber's decisions belong to the chamber." };
    }
    if (input.chamber.action) {
      // A binding release vote is a consensus poll at the chamber's own
      // bar, mirroring CIRCLES §7: money decisions are never a plurality
      // shrug.
      if (input.type !== "consensus") {
        return { ok: false, reason: "A binding release is a consensus poll (§9.1, reusing CIRCLES §7)." };
      }
      chamberAction = input.chamber.action;
    }
  }

  const isGovernance = input.isGovernance ?? false;
  // Governance polls are always sealed; no live-tally option, ever.
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

  // Creating a poll is its own gated action instance; the gate spend and
  // the creation share one transaction (#25), so a rollback leaves no orphan
  // spend behind.
  try {
  return await db.$transaction(async (tx) => {
    const gate = await clearGateTx(tx, {
      profileId: profile.id,
      scope: `poll-create:${randomBytes(8).toString("hex")}`,
      scopeKind: "per-profile",
    });
    if (gate.outcome !== "CLEARED") return { ok: false as const, reason: `Gate: ${gate.outcome}` };
    const fee = await chargeToTreasury(tx, {
      profileId: profile.id,
      currency: "PC",
      amount: await getRail(tx, "poll.creationFee"),
      kind: "fee.poll",
      refType: "poll",
    });
    if (!fee.ok) throw new InsufficientFunds(fee.reason);
    await maybeFirstActionGrant(tx, profile.id);
    await accrueForAction(tx, profile.id);

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
        visibilityScope: input.circle ? "circle" : input.chamber ? "chamber" : "public",
        circleRef: input.circle?.circleId ?? null,
        circleAction,
        chamberRef: input.chamber?.chamberId ?? null,
        chamberAction,
        nominalCloseAt,
        trueCloseAt,
        candleSalt,
        candleCommitment,
        options: {
          create: options.map((label, i) => ({ label, position: i + 1 })),
        },
      },
    });
    if (input.circle) {
      // Members'-room content stays in the members' room: the public
      // event hash-commits the question (tamper-evidence without
      // disclosure; the post.recorded precedent), and the tallies at
      // close are numbers by position, option text never leaving the
      // room. The enclosed-space rule, applied to the ledger.
      await appendEvent(tx, {
        actorType: "soul",
        actorId: profile.handle,
        eventType: "poll.created",
        payload: {
          pollRef: created.id,
          circle: input.circle.circleId,
          contentHash: circlePollContentHash(title, options),
          type: input.type,
          mode: input.mode,
          governance: false,
          binding: circleAction !== null || undefined,
          nominalCloseAt: nominalCloseAt.toISOString(),
          handle: profile.handle,
        },
      });
      const circleRow = await tx.circle.findUniqueOrThrow({
        where: { id: input.circle.circleId },
      });
      await tx.circle.update({
        where: { id: circleRow.id },
        data: { lastActivityAt: new Date() },
      });
      // Quiet, aggregated, space-name-and-event-type-only (NOTIFICATIONS §6).
      const { notify } = await import("./notifications");
      const members = await tx.circleMember.findMany({
        where: { circleId: circleRow.id, leftAt: null, profileId: { not: profile.id } },
        select: { profileId: true },
      });
      for (const m of members) {
        await notify(tx, {
          profileId: m.profileId,
          tier: "quiet",
          category: "circle-activity",
          title: `Circle activity; ${circleRow.name}`,
          body: "An internal poll opened. Details are in the Circle.",
          refType: "circle",
          refId: circleRow.id,
          aggregationKey: `circle-activity:${circleRow.id}`,
        });
      }
    } else {
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
    }
    return { ok: true as const, pollId: created.id };
  });
  } catch (err) {
    if (err instanceof InsufficientFunds) return { ok: false, reason: err.message };
    throw err;
  }
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

  // Circle-restricted visibility (§4.5): the ballot box sits inside the
  // members' room. Scope stays per-profile; the CIRCLES §7 sharp rule.
  // A closed Circle's room is read-only (createPost enforces the same);
  // the ballot box closes with it, so a poll still inside its window can't
  // be voted after the Circle closes.
  if (poll.visibilityScope === "circle" && poll.circleRef) {
    const { activeMembership } = await import("./circles");
    const circle = await db.circle.findUniqueOrThrow({ where: { id: poll.circleRef } });
    if (circle.status === "closed") {
      return { ok: false, reason: "This Circle is closed; its ballot box is read-only, like its room." };
    }
    if (!(await activeMembership(db, poll.circleRef, profile.id))) {
      return { ok: false, reason: "This poll is restricted to its Circle's members." };
    }
  }

  // Chamber-restricted (§9.1): the ballot box sits inside the workshop.
  // Scope stays per-profile, like everywhere.
  if (poll.visibilityScope === "chamber" && poll.chamberRef) {
    const member = await db.chamberMember.findFirst({
      where: { chamberId: poll.chamberRef, profileId: profile.id },
    });
    if (!member) {
      return { ok: false, reason: "This poll is restricted to its chamber's members." };
    }
  }

  // The vote micro-fee; checked BEFORE the gate so an underfunded
  // attempt never spends the one-per-poll nullifier. (Identical fee for
  // everyone, ordinary and governance alike; a fee to cast is not
  // weight.)
  const voteFee = await getRail(db, "poll.voteFee");
  const { balanceOf } = await import("./economy");
  if ((await balanceOf(db, profile.id, "PC")) < voteFee) {
    return {
      ok: false,
      reason: "Insufficient PollCoin for the vote micro-fee; the earnable path covers committed souls.",
    };
  }

  // One vote per profile: the per-poll scope makes a second attempt a
  // DUPLICATE; refused privately (visible only to the soul). PRIVATE
  // recording: sealed means sealed; the ledger learns nothing mid-poll.
  // Gate spend + fee + ballot share ONE transaction (#25): if the ballot
  // write rolls back, the poll nullifier rolls back with it, so the vote is
  // retryable instead of being lost forever as a phantom DUPLICATE.
  try {
    return await db.$transaction(async (tx) => {
    const gate = await clearGateTx(tx, {
      profileId: profile.id,
      scope: `poll:${poll.id}`,
      scopeKind: "per-profile",
      ledgerRecording: "private",
    });
    if (gate.outcome === "DUPLICATE") {
      return { ok: false as const, reason: "You have already voted in this poll." };
    }
    if (gate.outcome !== "CLEARED" || !gate.nullifier) {
      return { ok: false as const, reason: `Gate: ${gate.outcome}` };
    }
    const fee = await chargeToTreasury(tx, {
      profileId: profile.id,
      currency: "PC",
      amount: voteFee,
      kind: "fee.vote",
      // Deliberately no refId while polls can be open: a fee entry
      // naming (voter, poll) would be a who-voted record. The treasury
      // sees the amount; the poll reference is omitted for votes.
      refType: "poll-vote",
    });
    if (!fee.ok) throw new Error(fee.reason);
    await maybeFirstActionGrant(tx, profile.id);
    await accrueForAction(tx, profile.id);
    await tx.ballot.create({
      data: {
        pollId: poll.id,
        nullifier: gate.nullifier,
        // Public mode attaches the face by design; pseudonymous mode is
        // nullifier-keyed only; no profile, ever (DUAL_IDENTITY §4.3).
        voterProfileId: poll.mode === "public" ? profile.id : null,
        voterHandle: poll.mode === "public" ? profile.handle : null,
        voterDisplayName: poll.mode === "public" ? profile.displayName : null,
        choices: { create: optionIds.map((optionId) => ({ optionId })) },
      },
    });
    return { ok: true as const };
    });
  } catch (err) {
    if (await gateDuplicateConfirmed(db, err, { profileId: profile.id, scope: `poll:${poll.id}`, scopeKind: "per-profile" })) {
      return { ok: false, reason: "You have already voted in this poll." };
    }
    throw err;
  }
}

/** The live tally; exists ONLY for ordinary polls whose creator enabled
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
          // The candle reveal; verifiable against the commitment
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

      // A binding Circle stewardship decision executes itself at close;
      // if consensus passed AND "Adopt" (position 1) is the leading
      // option (a poll can "pass" on Decline; that adopts nothing).
      if (poll.circleAction && outcome === "passed") {
        const adoptTally = tallies["1"] ?? 0;
        const top = Math.max(0, ...Object.values(tallies));
        if (adoptTally === top && adoptTally > 0) {
          const { executeCircleAction } = await import("./circles");
          await executeCircleAction(tx, poll);
        }
      }

      // A large mission release rides its binding vote (§9.1: "members
      // vote, auto-executes on passage"). Same Adopt-must-lead rule as
      // the Circle path; and the same automaticity as attested release:
      // the poll closing IS the payment, with no operator step between
      // (FUND_INTEGRITY §3.7).
      if (poll.chamberAction && outcome === "passed") {
        const adoptTally = tallies["1"] ?? 0;
        const top = Math.max(0, ...Object.values(tallies));
        if (adoptTally === top && adoptTally > 0) {
          const { executeChamberAction } = await import("./escrow");
          await executeChamberAction(tx, poll);
        }
      }

      // A Picture repair rides its acceptance poll (Phase 7): execute
      // the community's decision; adopt appends a revision, anything
      // else declines quietly.
      {
        const { executeRepairPoll } = await import("./domains");
        await executeRepairPoll(tx, poll, outcome, tallies);
      }

      // Results published → the voters' quiet inboxes.
      const { notifyPollResults } = await import("./notifications");
      await notifyPollResults(tx, poll.id, poll.title);

      // Public mode: the per-ballot records become public at close;
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
