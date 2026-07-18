// Domains & the Picture repair loop (Phase 7 — DASHBOARD §5.3/§6.5).
//
// The Picture is a living content object: a settled position, stated
// plainly, kept honest by a public, dated revision history. Any verified
// soul may submit a formal Repair; acceptance is decided the way the
// platform decides everything it governs — a poll (DASHBOARD §6.3: this
// spec "assumes Polls, not juries, are the resolution mechanism"). The
// repair opens a SYSTEM-created governance poll in the domain's pillar
// (consensus-typed at the platform bar, sealed + candle like all
// governance); at close, Adopt-passing repairs append a new Picture
// revision and credit the author's Light Score in that pillar.
//
// Pricing, reading the ratified fee lattice strictly: repair submission
// is FREE (it is not a priced action; flagged). The anti-spam guard is
// structural instead — one open repair per soul per domain, and the
// standard strike-ladder consequences apply. Honest misses stay safe:
// declined repairs cost nothing (LIGHT_SCORE §5.2).

import { createHash, randomBytes } from "crypto";
import type { PrismaClient } from "@prisma/client";
import type { DbOrTx } from "./db";
import { clearGateTx } from "./gate";
import { appendEvent, canonicalJson } from "./ledger";
import { getRail } from "./rails";
import { hasPostingConsents } from "./consent";
import { candleCommitmentFor } from "./polls";

export type RepairResult =
  | { ok: true; repairId: string; pollId: string }
  | { ok: false; reason: string };

/** The Picture's current text = its highest revision. */
export async function currentPicture(db: PrismaClient, domainId: string) {
  return db.pictureRevision.findFirstOrThrow({
    where: { domainId },
    orderBy: { version: "desc" },
  });
}

/** The domain card's live status tag (§5.3 — real data, never
 *  decorative): open repair count + last repaired date. */
export async function repairStatus(db: PrismaClient, domainIds: string[]) {
  const [open, revisions] = await Promise.all([
    db.pictureRepair.groupBy({
      by: ["domainId"],
      where: { domainId: { in: domainIds }, status: "open" },
      _count: true,
    }),
    db.pictureRevision.findMany({
      where: { domainId: { in: domainIds }, version: { gt: 1 } },
      orderBy: { createdAt: "asc" },
      select: { domainId: true, createdAt: true },
    }),
  ]);
  const status = new Map<string, { openRepairs: number; lastRepairedAt: Date | null }>();
  for (const id of domainIds) status.set(id, { openRepairs: 0, lastRepairedAt: null });
  for (const g of open) status.get(g.domainId)!.openRepairs = g._count;
  for (const r of revisions) status.get(r.domainId)!.lastRepairedAt = r.createdAt;
  return status;
}

export function repairContentHash(challenge: string, proposedText: string): string {
  return createHash("sha256")
    .update(canonicalJson({ challenge, proposedText }))
    .digest("hex");
}

export async function submitRepair(
  db: PrismaClient,
  input: {
    domainId: string;
    profileId: string;
    challenge: string;
    proposedText: string;
  }
): Promise<RepairResult> {
  const challenge = input.challenge.trim();
  const proposedText = input.proposedText.trim();
  if (!challenge) return { ok: false, reason: "Say what the current Picture gets wrong." };
  if (!proposedText) return { ok: false, reason: "A repair proposes the full corrected Picture text." };

  const profile = await db.profile.findUnique({ where: { id: input.profileId } });
  if (!profile || profile.status !== "active") return { ok: false, reason: "No active face." };
  if (!(await hasPostingConsents(db, profile.id))) {
    return { ok: false, reason: "The permanence and Constitution acknowledgments come first." };
  }
  const now = new Date();
  if (profile.readOnlyUntil && profile.readOnlyUntil > now) {
    return { ok: false, reason: `Read-only until ${profile.readOnlyUntil.toLocaleString()}.` };
  }
  if (profile.rateLimitedUntil && profile.rateLimitedUntil > now) {
    return { ok: false, reason: `Rate-limited until ${profile.rateLimitedUntil.toLocaleString()}.` };
  }

  const domain = await db.domain.findUnique({
    where: { id: input.domainId },
    include: { pillar: true },
  });
  if (!domain) return { ok: false, reason: "No such domain." };

  // Structural anti-spam: one open repair per soul per domain.
  const alreadyOpen = await db.pictureRepair.findFirst({
    where: { domainId: domain.id, authorProfileId: profile.id, status: "open" },
  });
  if (alreadyOpen) {
    return { ok: false, reason: "You already have an open repair on this domain — one at a time." };
  }

  const [durationHours, consensusPercent, windowPercent] = await Promise.all([
    getRail(db, "repair.pollDurationHours"),
    getRail(db, "repair.consensusPercent"),
    getRail(db, "poll.candleWindowPercent"),
  ]);

  // A repair is a public civic contribution: gate-cleared, pseudonymous.
  // Gate spend + poll + repair share one transaction (#25), so a rollback
  // leaves no orphan spend.
  const result = await db.$transaction(async (tx) => {
    const gate = await clearGateTx(tx, {
      profileId: profile.id,
      scope: `repair-submit:${randomBytes(8).toString("hex")}`,
      scopeKind: "per-profile",
    });
    if (gate.outcome !== "CLEARED") return { ok: false as const, reason: `Gate: ${gate.outcome}` };
    const nominalCloseAt = new Date(Date.now() + durationHours * 3_600_000);
    // Governance polls close by candle — same law, system-opened or not.
    const windowMs = (durationHours * 3_600_000 * windowPercent) / 100;
    const trueCloseAt = new Date(
      nominalCloseAt.getTime() - windowMs + Math.random() * windowMs
    );
    const candleSalt = randomBytes(16).toString("hex");

    const poll = await tx.poll.create({
      data: {
        pillarId: domain.pillarId,
        // System-opened: the platform is the poll's operator, not any
        // soul ("system" is tombstoned in the taken-list — never
        // claimable). The repair's author is attributed on the repair
        // itself, by handle, like every civic contribution.
        creatorProfileId: "system",
        creatorHandle: "system",
        title: `Repair the Picture: ${domain.title}`,
        description:
          `@${profile.handle} challenges this domain's Picture.\n\n` +
          `THE CHALLENGE\n${challenge}\n\n` +
          `THE PROPOSED PICTURE\n${proposedText}`,
        type: "consensus",
        consensusThreshold: consensusPercent / 100,
        mode: "pseudonymous",
        isGovernance: true,
        liveTally: false,
        nominalCloseAt,
        trueCloseAt,
        candleSalt,
        candleCommitment: candleCommitmentFor(trueCloseAt, candleSalt),
        options: {
          create: [
            { label: "Adopt the repair", position: 1 },
            { label: "Decline", position: 2 },
          ],
        },
      },
    });

    const repair = await tx.pictureRepair.create({
      data: {
        domainId: domain.id,
        authorProfileId: profile.id,
        authorHandle: profile.handle,
        authorDisplayName: profile.displayName,
        challenge,
        proposedText,
        pollId: poll.id,
      },
    });

    await appendEvent(tx, {
      actorType: "soul",
      actorId: profile.handle,
      eventType: "repair.submitted",
      payload: {
        repairRef: repair.id,
        domainRef: domain.id,
        pillar: domain.pillar.slug,
        domain: domain.title,
        pollRef: poll.id,
        contentHash: repairContentHash(challenge, proposedText),
        candleCommitment: poll.candleCommitment ?? undefined,
        nominalCloseAt: nominalCloseAt.toISOString(),
        handle: profile.handle,
      },
    });
    return { ok: true as const, repairId: repair.id, pollId: poll.id };
  });
  return result;
}

/** Called by closeDuePolls for every closed poll: if a repair rides this
 *  poll, execute the community's decision — Adopt leading + consensus
 *  passed appends the revision and credits the author; anything else
 *  declines, costing the author nothing. */
export async function executeRepairPoll(
  tx: DbOrTx,
  poll: { id: string },
  outcome: string,
  tallies: Record<string, number>
): Promise<void> {
  const repair = await tx.pictureRepair.findUnique({
    where: { pollId: poll.id },
    include: { domain: { include: { pillar: true } } },
  });
  if (!repair || repair.status !== "open") return;

  const adoptTally = tallies["1"] ?? 0;
  const top = Math.max(0, ...Object.values(tallies));
  const adopted = outcome === "passed" && adoptTally === top && adoptTally > 0;

  if (!adopted) {
    await tx.pictureRepair.update({
      where: { id: repair.id },
      data: { status: "declined", resolvedAt: new Date() },
    });
    await appendEvent(tx, {
      actorType: "system",
      eventType: "repair.declined",
      payload: {
        repairRef: repair.id,
        domainRef: repair.domainId,
        pillar: repair.domain.pillar.slug,
        pollRef: poll.id,
      },
    });
    return;
  }

  const latest = await tx.pictureRevision.findFirstOrThrow({
    where: { domainId: repair.domainId },
    orderBy: { version: "desc" },
  });
  const revision = await tx.pictureRevision.create({
    data: {
      domainId: repair.domainId,
      version: latest.version + 1,
      body: repair.proposedText,
      repairId: repair.id,
    },
  });
  await tx.pictureRepair.update({
    where: { id: repair.id },
    data: { status: "accepted", resolvedAt: new Date() },
  });

  // Accepted repairs credit Light Score in the domain's pillar
  // (LIGHT_SCORE §2) — recorded with its named cause for the
  // explainable log (§6). Accepted-only is the anti-gaming filter
  // (§5.2); no decay (v2 credit behavior carries, §OQ4).
  const credit = await getRail(tx, "lightScore.repairAcceptedCredit");
  await tx.lightScoreAdjustment.create({
    data: {
      profileId: repair.authorProfileId,
      pillarId: repair.domain.pillarId,
      amount: credit,
      refType: "picture-repair",
      refId: repair.id,
    },
  });

  await appendEvent(tx, {
    actorType: "soul",
    actorId: repair.authorHandle,
    eventType: "picture.repaired",
    payload: {
      repairRef: repair.id,
      domainRef: repair.domainId,
      pillar: repair.domain.pillar.slug,
      domain: repair.domain.title,
      version: revision.version,
      pollRef: poll.id,
      handle: repair.authorHandle,
    },
  });
}
