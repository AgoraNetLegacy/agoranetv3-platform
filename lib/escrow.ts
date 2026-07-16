// Mission escrow — money held on behalf of a stated purpose, released
// only when verified humans co-sign that the spend is legitimate.
// (NEURAL_POLLINATOR §9.1, owner-designed 2026-07-13; PHASE_8_7_SPEC §3
// Slice 2.)
//
// WHY CHAMBERS, NEVER CIRCLES (owner ruling, 2026-07-16). CIRCLES_SPEC
// Principle 4 is a ratified hard scope guard: "Circles list pledges;
// they never hold funds... the action layer does not quietly become a
// treasury." Chambers already have a ratified per-chamber balance
// (§9.1), and a Chamber already IS a stated mission that survived public
// dissection — which is what makes it the right container for a
// financial stake. Never add a balance to a Circle.
//
// THE ESCROW IS SOURCE-AGNOSTIC, deliberately. It does not care whether
// the balance behind it came from donations (§9.1, the only source
// Phase 8.7 ships), an endowment distribution (COMMUNITY_ENDOWMENT_SPEC,
// unratified and Phase-9-real), or a bounty (TOKENOMICS §6.2, greenlit).
// A new source arrives as an adapter, never a rewrite.
//
// RELEASE AND FREEZE ARE AUTOMATIC (FUND_INTEGRITY §3.7). Reaching the
// threshold pays out in the same transaction that latches the final
// attestation; an upheld Tribunal ruling freezes in the ruling's own
// transaction. There is no operator "execute" step to withhold a valid
// release, and none to freeze funds someone simply doesn't want paid.
// Both directions matter: an operator who can silently sit on approved
// money is as much a capture vector as one who can steal it, and that
// gap was unaudited until FUND_INTEGRITY §3.7 named it. The guarantee
// here is the ABSENCE of that code path — the same shape as ADMIN_OPS
// §1's allowlist, where safety is what the tooling cannot do.
//
// WHAT ATTESTATION PROVES, honestly (CIRCLES_SPEC §6.2's wording,
// carried over unchanged): N verified humans put their names to this
// claim, permanently — NOT "the platform verified this spend was
// legitimate." Fund Integrity raises the cost of lying. It does not make
// lying impossible, and the UI must never imply otherwise.

import { randomUUID } from "crypto";
import type { PrismaClient } from "@prisma/client";
import type { DbOrTx, Tx } from "./db";
import { appendEvent } from "./ledger";
import { clearGate } from "./gate";
import { balanceOf } from "./economy";

export type EscrowResult =
  | { ok: true; releaseId: string; released: boolean }
  | { ok: false; reason: string };

/** A chamber's mission balance in one currency. */
export async function chamberBalanceOf(
  db: DbOrTx,
  chamberId: string,
  currency: "PC" | "G"
): Promise<number> {
  const row = await db.chamberBalance.findUnique({
    where: { chamberId_currency: { chamberId, currency } },
  });
  return row?.amount ?? 0;
}

/**
 * Credit a chamber's mission balance. Source-agnostic: the caller names
 * where the money came from, and this module stays ignorant of it.
 *
 * Deliberately internal — Phase 8.7 ships exactly one caller (donations,
 * Slice 3). It exists as its own function so the endowment and bounty
 * adapters have somewhere to plug in without touching release logic.
 */
export async function creditMissionBalance(
  tx: Tx,
  input: {
    chamberId: string;
    currency: "PC" | "G";
    amount: number;
    sourceKind: string; // "donation" | (later) "endowment" | "bounty"
  }
): Promise<void> {
  if (input.amount <= 0) return;
  await tx.chamberBalance.upsert({
    where: { chamberId_currency: { chamberId: input.chamberId, currency: input.currency } },
    create: { chamberId: input.chamberId, currency: input.currency, amount: input.amount },
    update: { amount: { increment: input.amount } },
  });
}

/**
 * Declare (or withdraw) that a chamber is raising toward its mission
 * (§9.1: "A Chamber may optionally declare it's raising PollCoin toward
 * its stated mission").
 *
 * Creator-only. §9.1 says "a Chamber may declare" without naming who —
 * the creator is the reading consistent with the rest of the spec (they
 * author the scaffold and the storefront, §4.1), and it is the narrow
 * choice: widening later is a decision, un-widening is a migration.
 * Flagged as inference in DECISIONS_PENDING rather than passed off as
 * ratified.
 *
 * Withdrawing only stops new donations. It never touches money already
 * given: §9.1's donations are "genuine transfers — real cost, no
 * auto-return," and a chamber that could un-declare its way out of
 * accountability would make that sentence a lie.
 */
export async function declareRaising(
  db: PrismaClient,
  input: { chamberId: string; profileId: string; raising: boolean }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const chamber = await db.chamber.findUnique({ where: { id: input.chamberId } });
  if (!chamber) return { ok: false, reason: "No such chamber." };
  if (chamber.creatorProfileId !== input.profileId) {
    return { ok: false, reason: "Only the chamber's creator may declare its mission funding." };
  }
  await db.$transaction(async (tx) => {
    await tx.chamber.update({
      where: { id: input.chamberId },
      data: { raisingForMission: input.raising },
    });
    await appendEvent(tx, {
      actorType: "soul",
      actorId: chamber.creatorHandle,
      eventType: input.raising ? "mission.raising-declared" : "mission.raising-withdrawn",
      payload: { chamberRef: input.chamberId, handle: chamber.creatorHandle },
    });
  });
  return { ok: true };
}

/**
 * Donate PollCoin toward a chamber's declared mission (§9.1).
 *
 * **A genuine transfer — real cost, no auto-return.** This mechanic
 * exists because the owner killed its predecessor for the opposite
 * property: auto-returned poll support-staking was "cheap talk, a
 * costless signal carries no information" (POLLS §4.8, retired). The
 * money is gone from the donor the moment it lands, and it comes back
 * only if the chamber's own members release it back — which is the
 * whole point.
 *
 * PollCoin only, per §9.1. Straight from the internal balance: no
 * wallet, no chain call, same architecture as every other internal fee.
 */
export async function donateToMission(
  db: PrismaClient,
  input: { chamberId: string; profileId: string; amount: number }
): Promise<{ ok: true; balance: number } | { ok: false; reason: string }> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, reason: "A donation must be a positive amount." };
  }

  const chamber = await db.chamber.findUnique({ where: { id: input.chamberId } });
  if (!chamber) return { ok: false, reason: "No such chamber." };
  if (!chamber.raisingForMission) {
    return { ok: false, reason: "This chamber isn't raising toward its mission." };
  }

  const profile = await db.profile.findUnique({ where: { id: input.profileId } });
  if (!profile || profile.status !== "active") {
    return { ok: false, reason: "No active face." };
  }

  // Every write action clears the gate — no exceptions, even where
  // bypassing would be easy (CLAUDE.md rule 3). Per-donation scope: a
  // soul may give more than once.
  const gate = await clearGate(db, {
    profileId: profile.id,
    scope: `mission-donate:${randomUUID()}`,
    scopeKind: "per-profile",
  });
  if (gate.outcome !== "CLEARED") return { ok: false, reason: `Gate: ${gate.outcome}` };

  return await db.$transaction(async (tx) => {
    const balance = await balanceOf(tx, profile.id, "PC");
    if (balance < input.amount) {
      return {
        ok: false as const,
        reason: `Insufficient PollCoin (${balance.toFixed(2)}u of ${input.amount}u) — a donation is a real transfer, not a gesture.`,
      };
    }

    await tx.balance.update({
      where: { profileId_currency: { profileId: profile.id, currency: "PC" } },
      data: { amount: { decrement: input.amount } },
    });
    await creditMissionBalance(tx, {
      chamberId: input.chamberId,
      currency: "PC",
      amount: input.amount,
      sourceKind: "donation",
    });
    // Donor→chamber. NOT a treasury flow in either direction: the
    // treasury neither receives it nor spends it, so it carries no
    // budget category (that column is the Constitution's spending
    // guardrail, and this is not the treasury spending).
    await tx.economyEntry.create({
      data: {
        kind: "mission.donation",
        currency: "PC",
        amount: input.amount,
        fromProfileId: profile.id,
        refType: "chamber",
        refId: input.chamberId,
      },
    });

    // Public at the moment of giving. The chamber's funding is part of
    // its public storefront story — a mission asking for money answers
    // for what it raised, permanently.
    await appendEvent(tx, {
      actorType: "soul",
      actorId: profile.handle,
      eventType: "mission.donated",
      payload: {
        chamberRef: input.chamberId,
        handle: profile.handle,
        amount: input.amount,
        currency: "PC",
      },
    });

    return { ok: true as const, balance: await chamberBalanceOf(tx, input.chamberId, "PC") };
  });
}

/**
 * Propose a release (§9.1: "the chamber logs 'releasing Y PollCoin for
 * Z'"). The purpose is frozen at proposal — the claim being attested
 * must not move after signatures land on it.
 *
 * Refuses if the balance can't cover it, counting money already
 * committed to other open proposals: two proposals that each fit the
 * balance but together exceed it would otherwise both reach threshold
 * and overdraw the mission.
 */
export async function proposeRelease(
  db: PrismaClient,
  input: {
    chamberId: string;
    proposerProfileId: string;
    toProfileId: string;
    currency: "PC" | "G";
    amount: number;
    purpose: string;
  }
): Promise<EscrowResult> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, reason: "A release must be a positive amount." };
  }
  if (!input.purpose.trim()) {
    return { ok: false, reason: "A release must say what it's for — that's the claim members attest." };
  }

  const chamber = await db.chamber.findUnique({ where: { id: input.chamberId } });
  if (!chamber) return { ok: false, reason: "No such chamber." };

  const proposer = await db.chamberMember.findFirst({
    where: { chamberId: input.chamberId, profileId: input.proposerProfileId },
  });
  if (!proposer) {
    return { ok: false, reason: "Only chamber members may propose a release of the mission's funds." };
  }
  const recipient = await db.profile.findUnique({ where: { id: input.toProfileId } });
  if (!recipient) return { ok: false, reason: "No such recipient." };

  return await db.$transaction(async (tx) => {
    const balance = await chamberBalanceOf(tx, input.chamberId, input.currency);
    const committed = await openCommitments(tx, input.chamberId, input.currency);
    if (balance - committed < input.amount) {
      return {
        ok: false as const,
        reason: `The mission holds ${balance.toFixed(2)}u ${input.currency}${
          committed > 0 ? ` (${committed.toFixed(2)}u already committed to open proposals)` : ""
        } — not enough for ${input.amount.toFixed(2)}u.`,
      };
    }

    const proposerProfile = await tx.profile.findUniqueOrThrow({
      where: { id: input.proposerProfileId },
    });
    const release = await tx.missionRelease.create({
      data: {
        chamberId: input.chamberId,
        currency: input.currency,
        amount: input.amount,
        purpose: input.purpose.trim(),
        toProfileId: input.toProfileId,
        toHandle: recipient.handle,
        proposerProfileId: input.proposerProfileId,
        proposerHandle: proposerProfile.handle,
      },
    });

    // Public from the moment it's proposed: money moving toward a stated
    // purpose is exactly the kind of claim the civic ledger exists for.
    await appendEvent(tx, {
      actorType: "soul",
      actorId: proposerProfile.handle,
      eventType: "mission.release-proposed",
      payload: {
        chamberRef: input.chamberId,
        releaseRef: release.id,
        amount: input.amount,
        currency: input.currency,
        purpose: release.purpose,
        toHandle: recipient.handle,
        threshold: chamber.releaseThreshold,
      },
    });

    return { ok: true as const, releaseId: release.id, released: false };
  });
}

/** Money already spoken for by open proposals — never double-promised. */
async function openCommitments(
  tx: DbOrTx,
  chamberId: string,
  currency: "PC" | "G"
): Promise<number> {
  const open = await tx.missionRelease.findMany({
    where: { chamberId, currency, state: "proposed" },
  });
  return open.reduce((sum, r) => sum + r.amount, 0);
}

/**
 * Attest that a release is legitimate — and, at the threshold, PAY IT,
 * in this same transaction (FUND_INTEGRITY §3.7).
 *
 * The automatic payment is the point. There is no separate "execute"
 * step for anyone to withhold, which is why this function both attests
 * and pays: separating them would create exactly the discretionary gap
 * the spec forbids.
 */
export async function attestRelease(
  db: PrismaClient,
  input: { releaseId: string; attestorProfileId: string }
): Promise<EscrowResult> {
  const release = await db.missionRelease.findUnique({
    where: { id: input.releaseId },
    include: { chamber: true, attestations: true },
  });
  if (!release) return { ok: false, reason: "No such release." };
  if (release.state === "frozen") {
    return { ok: false, reason: "This release is frozen by a Tribunal ruling — it cannot be attested." };
  }
  if (release.state === "released") {
    return { ok: false, reason: "Already released." };
  }

  const member = await db.chamberMember.findFirst({
    where: { chamberId: release.chamberId, profileId: input.attestorProfileId },
  });
  if (!member) {
    return { ok: false, reason: "Only chamber members may attest a release." };
  }
  if (release.proposerProfileId === input.attestorProfileId) {
    // Self-attestation would make "attested" mean one voice — which is
    // precisely what the floor of 2 exists to prevent (CIRCLES_SPEC:
    // "so 'attested' always means more than one voice").
    return { ok: false, reason: "A proposer cannot attest their own release — attestation means more than one voice." };
  }
  if (release.attestations.some((a) => a.attestorProfileId === input.attestorProfileId)) {
    return { ok: false, reason: "You have already attested this release." };
  }

  return await db.$transaction(async (tx) => {
    const profile = await tx.profile.findUniqueOrThrow({
      where: { id: input.attestorProfileId },
    });
    await tx.releaseAttestation.create({
      data: {
        releaseId: release.id,
        attestorProfileId: input.attestorProfileId,
        attestorHandle: profile.handle,
      },
    });
    const count = release.attestations.length + 1;

    await appendEvent(tx, {
      actorType: "soul",
      actorId: profile.handle,
      eventType: "mission.release-attested",
      payload: {
        chamberRef: release.chamberId,
        releaseRef: release.id,
        handle: profile.handle,
        attestorCount: count,
        threshold: release.chamber.releaseThreshold,
      },
    });

    // The threshold: the proposer's own voice never counts toward it —
    // attestation is corroboration, not self-assertion.
    if (count < release.chamber.releaseThreshold) {
      return { ok: true as const, releaseId: release.id, released: false };
    }

    // Re-check the balance at payment time. It was checked at proposal,
    // but another release may have paid out since.
    const balance = await chamberBalanceOf(tx, release.chamberId, release.currency as "PC" | "G");
    if (balance < release.amount) {
      throw new Error(
        `Mission balance fell below this release (${balance.toFixed(2)}u < ${release.amount.toFixed(2)}u) — refusing to overdraw.`
      );
    }

    await tx.chamberBalance.update({
      where: {
        chamberId_currency: { chamberId: release.chamberId, currency: release.currency },
      },
      data: { amount: { decrement: release.amount } },
    });
    await tx.balance.upsert({
      where: {
        profileId_currency: { profileId: release.toProfileId, currency: release.currency },
      },
      create: { profileId: release.toProfileId, currency: release.currency, amount: release.amount },
      update: { amount: { increment: release.amount } },
    });
    // The mission's own ledger of money moved. NOT an EconomyEntry
    // outflow: this is not the treasury spending — it is a chamber
    // spending funds held on behalf of its mission, so it carries no
    // budget category (that would corrupt the treasury's utilization
    // figures) and must not trip db:verify's budgeted-categories check.
    await tx.economyEntry.create({
      data: {
        kind: "mission.release",
        currency: release.currency,
        amount: release.amount,
        toProfileId: release.toProfileId,
        refType: "chamber",
        refId: release.chamberId,
      },
    });
    await tx.missionRelease.update({
      where: { id: release.id },
      data: { state: "released", releasedAt: new Date() },
    });

    await appendEvent(tx, {
      actorType: "system",
      eventType: "mission.released",
      payload: {
        chamberRef: release.chamberId,
        releaseRef: release.id,
        amount: release.amount,
        currency: release.currency,
        purpose: release.purpose,
        toHandle: release.toHandle,
        attestorCount: count,
      },
    });

    return { ok: true as const, releaseId: release.id, released: true };
  });
}

/**
 * Freeze every unreleased tranche of a chamber's mission money on an
 * upheld ruling (FUND_INTEGRITY §3.4 — "the module's real teeth").
 *
 * You cannot claw back what is spent; you CAN stop what has not moved.
 * Called from the ruling's own transaction, never by an operator — the
 * mirror-image capture path (freezing funds someone doesn't want paid)
 * is closed by the same absence of a code path that closes withholding.
 *
 * Returns the number frozen, for the caller's ledger event.
 */
export async function freezeChamberReleases(
  tx: Tx,
  input: { chamberId: string; rulingId: string }
): Promise<number> {
  const open = await tx.missionRelease.findMany({
    where: { chamberId: input.chamberId, state: "proposed" },
  });
  if (open.length === 0) return 0;

  const now = new Date();
  for (const release of open) {
    await tx.missionRelease.update({
      where: { id: release.id },
      data: { state: "frozen", frozenAt: now, frozenByRulingId: input.rulingId },
    });
  }
  await appendEvent(tx, {
    actorType: "system",
    eventType: "mission.releases-frozen",
    payload: {
      chamberRef: input.chamberId,
      rulingRef: input.rulingId,
      frozenCount: open.length,
      frozenAmount: open.reduce((s, r) => s + r.amount, 0),
    },
  });
  return open.length;
}

/** The mission's public money story: held, committed, paid, frozen. */
export async function missionFundingSummary(db: DbOrTx, chamberId: string) {
  const [balances, releases] = await Promise.all([
    db.chamberBalance.findMany({ where: { chamberId } }),
    db.missionRelease.findMany({
      where: { chamberId },
      include: { attestations: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return {
    balances,
    releases,
    releasedTotal: releases
      .filter((r) => r.state === "released")
      .reduce((s, r) => s + r.amount, 0),
  };
}
