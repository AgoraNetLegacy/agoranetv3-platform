// Chambers; the idea incubator (Phase 7.5, Neural Pollinator/
// NEURAL_POLLINATOR_SPEC.md, launch scope: Chambers ONLY; the
// Leaderboard and Tournament of Ideas are post-launch by owner
// decision, and nothing here depends on them existing).
//
// The owner's one-line framing: chambers are fancy discussion pods;
// unlike Discussions (open-air), you ENTER a chamber to see what's
// inside. Three visibility layers (§4.3): the storefront is public and
// free to read; the workshop is enter-to-see (a chamber-scoped
// Discussion; threading reuses the Discussions conventions, nothing
// bespoke); the Arena is post-launch. ⚠ v2's "chambers" ≠ these.
//
// Pollinator participation carries the dual-token signature (§3):
// creation and workshop posts each charge BOTH PollCoin and Gratium
// (rails), deliberately, so building here means holding a stock of both.
//
// Enclosure is structural, not cosmetic: membership and invites never
// touch the public ledger (entry clears the gate in PRIVATE recording;
// the spec publishes member COUNT and activity level, never the list);
// workshop posts never hash-commit, never upgrade to permanence, never
// feed Light Score, the open lens, or public search. db:verify hunts
// for every one of those leaks. Moderation, by contrast, is the
// standard platform path; chambers build no bespoke moderation (§7).

import { randomUUID } from "crypto";
import type { PrismaClient } from "@prisma/client";
import type { DbOrTx, Tx } from "./db";
import { clearGateTx, gateDuplicateConfirmed } from "./gate";
import { appendEvent } from "./ledger";
import { getRail } from "./rails";
import { hasPostingConsents } from "./consent";
import {
  chargeDualToTreasury,
  maybeFirstActionGrant,
  type DualTokenHoldings,
} from "./economy";
import { accrueForAction } from "./accrual";
import { transitionTokenIntent } from "./tokenIntents";
import { notify } from "./notifications";

class InsufficientFunds extends Error {}

/** The dual-token cost of opening a Chamber: both halves, both required
 * (NEURAL_POLLINATOR §3). Read here so the storefront, the composer, and
 * the charge can never quote different arithmetic. */
export async function chamberCreationCost(db: DbOrTx): Promise<DualTokenHoldings> {
  return {
    PC: await getRail(db, "chamber.creationFeePc"),
    G: await getRail(db, "chamber.creationFeeG"),
  };
}

/** The dual-token cost of one workshop contribution. */
export async function workshopPostCost(db: DbOrTx): Promise<DualTokenHoldings> {
  return {
    PC: await getRail(db, "chamber.postFeePc"),
    G: await getRail(db, "chamber.postFeeG"),
  };
}

export type ChamberResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; reason: string };

/** Fixed UI copy; the enclosure explained at the workshop door. */
export const WORKSHOP_ENCLOSURE_NOTE =
  "The workshop is enclosed by design: a safe space where half-formed " +
  "thinking gets worked out without the open internet watching the " +
  "drafts. Contents are deletable-class and stay inside; the public " +
  "storefront is the chamber's public profile.";

// ---------------------------------------------------------- membership

export async function chamberMembership(
  db: DbOrTx,
  chamberId: string,
  profileId: string
) {
  return db.chamberMember.findUnique({
    where: { chamberId_profileId: { chamberId, profileId } },
  });
}

/** Workshop access: entered souls only; reading included ("enter to
 *  see what's inside" IS the product). */
export async function workshopAccess(
  db: DbOrTx,
  chamberId: string,
  profileId: string | null
): Promise<boolean> {
  if (!profileId) return false;
  return (await chamberMembership(db, chamberId, profileId)) !== null;
}

/** The storefront's honest activity signal: coarse, aggregate; the
 *  spec publishes activity LEVEL, never who or what (§4.3). */
export function chamberActivityLevel(
  db: DbOrTx,
  chamber: { id: string; lastActivityAt: Date }
): "active" | "quiet" {
  void db;
  const weekAgo = Date.now() - 7 * 86_400_000;
  return chamber.lastActivityAt.getTime() > weekAgo ? "active" : "quiet";
}

async function touchActivity(tx: Tx, chamberId: string) {
  await tx.chamber.update({
    where: { id: chamberId },
    data: { lastActivityAt: new Date() },
  });
}

// -------------------------------------------------------- notifications

/**
 * "Chamber activity (chambers you've entered)"; the quiet category the
 * NOTIFICATIONS spec (§1) reserves for the NEURAL_POLLINATOR. Enclosed-
 * space discipline (§6): space name + event type only; content is
 * visible on entering. Aggregated per chamber. Workshop REPLIES
 * deliberately don't notify; NOTIFICATIONS §5 gives ambient activity
 * on followed things to the feed (the entered-chambers source).
 */
async function notifyChamberActivity(
  tx: Tx,
  chamber: { id: string; title: string },
  eventLabel: string,
  excludeProfileId: string
) {
  const members = await tx.chamberMember.findMany({
    where: { chamberId: chamber.id, profileId: { not: excludeProfileId } },
    select: { profileId: true },
  });
  for (const m of members) {
    await notify(tx, {
      profileId: m.profileId,
      tier: "quiet",
      category: "chamber-activity",
      title: `Chamber activity; ${chamber.title}`,
      body: `${eventLabel}. Details are in the workshop.`,
      refType: "chamber",
      refId: chamber.id,
      aggregationKey: `chamber-activity:${chamber.id}`,
    });
  }
}

// ------------------------------------------------------------- creation

/**
 * Creation (§4.1): gate-cleared + the dual-token participation cost
 * (both halves must clear atomically, or neither does). The creator
 * sets subject, title, the storefront pitch with its required "why
 * should people care" answer (what problem, for whom, why now), the
 * public/private setting (FIXED at creation), and completes the
 * pre-convo scaffold; the platform's first-principles method
 * productized: work starts oriented, not adrift.
 *
 * The workshop (a chamber-scoped Discussion, deletable class) is born
 * with the chamber; the creator is member #1. chamber.created is
 * public civic record; creating a public space is a public act; what
 * happens INSIDE stays enclosed.
 */
/** Bind a confirmed on-chain dual payment to this chamber creation.
 *
 * The wallet path never touches a platform balance, so the guard that a
 * platform charge gives for free (you cannot spend what you do not hold)
 * has to be made explicit here: the intent must belong to this soul, name
 * this draft, carry BOTH legs at the ratified rail amounts, and still be
 * unspent. TokenTransactionIntent.txHash is unique, so one testnet payment
 * can open exactly one chamber. */
async function settleChamberWalletFee(
  tx: Tx,
  profileId: string,
  cost: DualTokenHoldings,
  walletFee: { intentId: string; draftId: string; txHash: string }
) {
  const [intent, draft] = await Promise.all([
    tx.tokenTransactionIntent.findUnique({ where: { id: walletFee.intentId } }),
    tx.walletActionDraft.findUnique({ where: { id: walletFee.draftId } }),
  ]);
  const validIntent =
    intent?.profileId === profileId &&
    intent.kind === "fee.chamber" &&
    intent.status === "submitted" &&
    intent.txHash === walletFee.txHash &&
    intent.refType === "wallet-action-draft" &&
    intent.refId === walletFee.draftId &&
    intent.currency === "PC" &&
    intent.amount === String(cost.PC) &&
    intent.secondaryCurrency === "G" &&
    intent.secondaryAmount === String(cost.G);
  const validDraft =
    draft?.profileId === profileId &&
    draft.kind === "chamber.create" &&
    draft.status === "submitted" &&
    draft.transactionIntentId === walletFee.intentId;
  if (!validIntent || !validDraft) {
    throw new InsufficientFunds(
      "That wallet payment is not attached to this pending chamber. Reload and check its status."
    );
  }
  const confirmed = await transitionTokenIntent(tx, {
    id: intent.id,
    to: "confirmed",
    txHash: walletFee.txHash,
  });
  if (!confirmed.ok) throw new InsufficientFunds(confirmed.reason);
}

export type CreateChamberInput = {
  profileId: string;
  title: string;
  subject: string;
  pitch: string;
  whyCare: string;
  isPublic: boolean;
  scaffold: { solving: string; needToKnow: string; success: string };
  /** Set only when an on-chain dual-token payment already settled the fee. */
  walletFee?: { intentId: string; draftId: string; txHash: string };
};

/** Every requirement a chamber must meet BEFORE anyone is asked to pay.
 * Wallet settlement calls this first so Lace never opens for a request
 * that would be refused after the money moved. */
export async function validateChamberRequest(
  db: PrismaClient,
  input: Omit<CreateChamberInput, "walletFee">
) {
  const title = input.title.trim();
  const subject = input.subject.trim();
  const pitch = input.pitch.trim();
  const whyCare = input.whyCare.trim();
  const solving = input.scaffold.solving.trim();
  const needToKnow = input.scaffold.needToKnow.trim();
  const success = input.scaffold.success.trim();

  if (!title) return { ok: false as const, reason: "A chamber needs a title." };
  if (!subject) {
    return { ok: false as const, reason: "Name the idea; one chamber, one subject." };
  }
  if (!pitch) {
    return { ok: false as const, reason: "The storefront pitch is the chamber's public profile; it can't be empty." };
  }
  if (!whyCare) {
    return {
      ok: false as const,
      reason:
        "Why should people care; what problem, for whom, why now? A chamber that cannot answer it isn't ready to ask for attention.",
    };
  }
  if (!solving || !needToKnow || !success) {
    return {
      ok: false as const,
      reason:
        "The scaffold comes first: what are we solving, what do we need to know, and what does success look like. Work starts oriented, not adrift.",
    };
  }

  const profile = await db.profile.findUnique({ where: { id: input.profileId } });
  if (!profile || profile.status !== "active") {
    return { ok: false as const, reason: "No active identity." };
  }
  if (!(await hasPostingConsents(db, profile.id))) {
    return { ok: false as const, reason: "The permanence and Constitution acknowledgments come first." };
  }
  return {
    ok: true as const,
    profile,
    fields: { title, subject, pitch, whyCare, solving, needToKnow, success },
  };
}

export async function createChamber(
  db: PrismaClient,
  input: CreateChamberInput
): Promise<ChamberResult<{ chamberId: string }>> {
  const validated = await validateChamberRequest(db, input);
  if (!validated.ok) return { ok: false, reason: validated.reason };
  const { profile } = validated;
  const { title, subject, pitch, whyCare, solving, needToKnow, success } = validated.fields;

  // The workshop Discussion needs a pillar row; chambers aren't pillar
  // surfaces, so it homes in the meta pillar. Chamber scoping overrides
  // pillar surfaces everywhere; it never appears on pillar pages.
  const metaPillar = await db.pillar.findFirstOrThrow({ where: { isMeta: true } });

  // Gate spend + dual-token fee + chamber creation share one transaction (#25).
  try {
    return await db.$transaction(async (tx) => {
      const gate = await clearGateTx(tx, {
        profileId: profile.id,
        scope: `chamber-create:${randomUUID()}`,
        scopeKind: "per-profile",
      });
      if (gate.outcome !== "CLEARED") return { ok: false as const, reason: `Gate: ${gate.outcome}` };
      const cost = await chamberCreationCost(tx);
      if (input.walletFee) {
        // Self-custody: both tokens already moved on chain, in one
        // transaction the soul signed. Nothing debits a platform balance,
        // so no EconomyEntry is written; the confirmed intent IS the receipt.
        await settleChamberWalletFee(tx, profile.id, cost, input.walletFee);
      } else {
        const fee = await chargeDualToTreasury(tx, {
          profileId: profile.id,
          cost,
          kind: "fee.chamber",
          refType: "chamber",
        });
        if (!fee.ok) throw new InsufficientFunds(fee.reason);
      }
      await maybeFirstActionGrant(tx, profile.id);
      await accrueForAction(tx, profile.id);

      const created = await tx.chamber.create({
        data: {
          title,
          subject,
          pitch,
          whyCare,
          isPublic: input.isPublic,
          scaffoldSolving: solving,
          scaffoldNeedToKnow: needToKnow,
          scaffoldSuccess: success,
          creatorProfileId: profile.id,
          creatorHandle: profile.handle,
        },
      });
      // The creator is member #1; a chamber's workshop is never empty
      // of its own founder.
      await tx.chamberMember.create({
        data: { chamberId: created.id, profileId: profile.id, handle: profile.handle },
      });
      // The workshop, born with the chamber: enter-to-see, deletable
      // class (POLLINATOR §7); the drafts are not the record.
      await tx.discussion.create({
        data: {
          title: `Workshop; ${title}`,
          pillarId: metaPillar.id,
          chamberId: created.id,
          permanence: "deletable",
        },
      });
      // Creating a chamber is a civic act; the storefront basics ride
      // the event. The scaffold and everything after stay enclosed.
      await appendEvent(tx, {
        actorType: "soul",
        actorId: profile.handle,
        eventType: "chamber.created",
        payload: {
          chamberRef: created.id,
          title,
          subject,
          isPublic: input.isPublic,
          handle: profile.handle,
        },
      });
      if (input.walletFee) {
        const completed = await tx.walletActionDraft.updateMany({
          where: {
            id: input.walletFee.draftId,
            profileId: profile.id,
            transactionIntentId: input.walletFee.intentId,
            status: "submitted",
          },
          data: { status: "completed", resultRefId: created.id, completedAt: new Date() },
        });
        if (completed.count !== 1) {
          throw new InsufficientFunds(
            "This wallet request changed while the chamber was being opened. Reload its status."
          );
        }
      }
      return { ok: true as const, chamberId: created.id };
    });
  } catch (err) {
    if (err instanceof InsufficientFunds) return { ok: false, reason: err.message };
    throw err;
  }
}

// ------------------------------------------------------------- scaffold

/**
 * Scaffold edits (§4.1): creator-only, "as understanding sharpens,"
 * with edit history visible inside the workshop. Enclosed working
 * material; no ledger event, like everything else inside.
 */
export async function editScaffold(
  db: PrismaClient,
  input: {
    chamberId: string;
    profileId: string;
    solving: string;
    needToKnow: string;
    success: string;
  }
): Promise<ChamberResult> {
  const chamber = await db.chamber.findUnique({ where: { id: input.chamberId } });
  if (!chamber) return { ok: false, reason: "No such chamber." };
  if (chamber.creatorProfileId !== input.profileId) {
    return { ok: false, reason: "The scaffold is the creator's framing; only they sharpen it." };
  }
  const solving = input.solving.trim();
  const needToKnow = input.needToKnow.trim();
  const success = input.success.trim();
  if (!solving || !needToKnow || !success) {
    return { ok: false, reason: "All three scaffold questions stay answered." };
  }

  await db.$transaction(async (tx) => {
    // Keep the prior version; the history is part of how the idea
    // sharpened, visible to everyone working inside.
    await tx.chamberScaffoldRevision.create({
      data: {
        chamberId: chamber.id,
        solving: chamber.scaffoldSolving,
        needToKnow: chamber.scaffoldNeedToKnow,
        success: chamber.scaffoldSuccess,
      },
    });
    await tx.chamber.update({
      where: { id: chamber.id },
      data: {
        scaffoldSolving: solving,
        scaffoldNeedToKnow: needToKnow,
        scaffoldSuccess: success,
      },
    });
    await touchActivity(tx, chamber.id);
    await notifyChamberActivity(tx, chamber, "The scaffold was sharpened", input.profileId);
  });
  return { ok: true };
}

// ---------------------------------------------------------------- entry

/**
 * Entering (§4.2–4.3): free; there is no entry fee, no unlock, no
 * membership wall; acting (posting) costs, per platform law. Public
 * chambers: anyone meeting the prerequisites. Private chambers:
 * invited souls only. Entry clears the gate in PRIVATE recording;
 * who is inside a chamber is enclosed-space information (the
 * storefront publishes count and activity level, never the list).
 */
export async function enterChamber(
  db: PrismaClient,
  input: { chamberId: string; profileId: string }
): Promise<ChamberResult> {
  const chamber = await db.chamber.findUnique({ where: { id: input.chamberId } });
  if (!chamber) return { ok: false, reason: "No such chamber." };
  const profile = await db.profile.findUnique({ where: { id: input.profileId } });
  if (!profile || profile.status !== "active") {
    return { ok: false, reason: "No active identity." };
  }
  if (await chamberMembership(db, chamber.id, profile.id)) {
    return { ok: false, reason: "You have already entered this chamber." };
  }
  if (!chamber.isPublic && chamber.creatorProfileId !== profile.id) {
    const invite = await db.chamberInvite.findUnique({
      where: { chamberId_profileId: { chamberId: chamber.id, profileId: profile.id } },
    });
    if (!invite) {
      return {
        ok: false,
        reason: "This chamber is private; the creator selects who gets invited.",
      };
    }
  }
  // One entry per profile per chamber: the fixed scope IS the once.
  // PRIVATE recording; entry must not be observable from outside.
  // Gate spend + membership share one transaction (#25): a rollback no
  // longer strands the enter nullifier, so entering is retryable.
  try {
    return await db.$transaction(async (tx) => {
    const gate = await clearGateTx(tx, {
      profileId: profile.id,
      scope: `chamber:${chamber.id}:enter`,
      scopeKind: "per-profile",
      ledgerRecording: "private",
    });
    if (gate.outcome === "DUPLICATE") {
      return { ok: false as const, reason: "You have already entered this chamber." };
    }
    if (gate.outcome !== "CLEARED") return { ok: false as const, reason: `Gate: ${gate.outcome}` };
    await tx.chamberMember.create({
      data: { chamberId: chamber.id, profileId: profile.id, handle: profile.handle },
    });
    await touchActivity(tx, chamber.id);
    await accrueForAction(tx, profile.id);
    await notifyChamberActivity(tx, chamber, "A soul entered the workshop", profile.id);
    return { ok: true as const };
    });
  } catch (err) {
    if (await gateDuplicateConfirmed(db, err, { profileId: profile.id, scope: `chamber:${chamber.id}:enter`, scopeKind: "per-profile" })) {
      return { ok: false, reason: "You have already entered this chamber." };
    }
    throw err;
  }
}

// -------------------------------------------------------------- invites

/**
 * Private-chamber invites (§4.2): the creator selects who gets
 * invited; closed working groups, enclosed professional space. Public
 * chambers need no invites (anyone meeting the prerequisites enters);
 * fellow souls share those by link (FELLOW_SOULS §3 routes through
 * "the standard invite mechanics of those surfaces"; this is it).
 * Enclosed like membership: private gate recording, no ledger trace.
 * No notification rides the invite yet; the NOTIFICATIONS category
 * list is exhaustive by design; a chamber-invite category awaits the
 * owner's say (flagged). Pending invites surface on the Pollinator
 * page itself.
 */
export async function inviteToChamber(
  db: PrismaClient,
  input: { chamberId: string; profileId: string; inviteeHandle: string }
): Promise<ChamberResult> {
  const chamber = await db.chamber.findUnique({ where: { id: input.chamberId } });
  if (!chamber) return { ok: false, reason: "No such chamber." };
  if (chamber.isPublic) {
    return { ok: false, reason: "Public chambers need no invites; anyone meeting the prerequisites may enter. Share the storefront." };
  }
  if (chamber.creatorProfileId !== input.profileId) {
    return { ok: false, reason: "The creator selects who gets invited; that's what private means here." };
  }
  const handle = input.inviteeHandle.trim().toLowerCase().replace(/^@/, "");
  const invitee = await db.profile.findUnique({ where: { handle } });
  if (!invitee || invitee.status !== "active") {
    return { ok: false, reason: "No active soul by that handle." };
  }
  if (invitee.id === input.profileId) {
    return { ok: false, reason: "You are already inside; you built it." };
  }
  if (await chamberMembership(db, chamber.id, invitee.id)) {
    return { ok: false, reason: "That soul has already entered." };
  }
  const existing = await db.chamberInvite.findUnique({
    where: { chamberId_profileId: { chamberId: chamber.id, profileId: invitee.id } },
  });
  if (existing) return { ok: false, reason: "Already invited." };

  // Gate spend + invite row share one transaction (#25).
  return db.$transaction(async (tx) => {
    const gate = await clearGateTx(tx, {
      profileId: input.profileId,
      scope: `chamber:${chamber.id}:invite:${invitee.id}`,
      scopeKind: "per-profile",
      ledgerRecording: "private",
    });
    if (gate.outcome !== "CLEARED") return { ok: false as const, reason: `Gate: ${gate.outcome}` };
    await tx.chamberInvite.create({
      data: { chamberId: chamber.id, profileId: invitee.id, handle: invitee.handle },
    });
    return { ok: true as const };
  });
}

/** The viewer's pending invites; visible to them alone, on the
 *  Pollinator page (no notification category exists yet; flagged). */
export async function pendingInvitesFor(db: DbOrTx, profileId: string) {
  const invites = await db.chamberInvite.findMany({
    where: { profileId },
    include: { chamber: { select: { id: true, title: true, isPublic: true } } },
    orderBy: { createdAt: "desc" },
  });
  const entered = await db.chamberMember.findMany({
    where: { profileId },
    select: { chamberId: true },
  });
  const enteredIds = new Set(entered.map((m) => m.chamberId));
  return invites.filter((i) => !enteredIds.has(i.chamberId));
}

// ---------------------------------------------------- workshop plumbing

/**
 * The dual-token workshop participation micro-fee: both halves, both
 * required (NEURAL_POLLINATOR §3, the signature at micro scale).
 */
export async function chargeWorkshopPostFee(
  tx: Tx,
  input: { profileId: string; discussionId: string }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const fee = await chargeDualToTreasury(tx, {
    profileId: input.profileId,
    cost: await workshopPostCost(tx),
    kind: "fee.chamber-post",
    refType: "discussion",
    refId: input.discussionId,
  });
  if (!fee.ok) return fee;
  return { ok: true };
}

/** Touch activity from the posting path (storefront activity level +
 *  feed ordering are the only public shadows of workshop work). */
export async function touchChamberActivity(tx: Tx, chamberId: string) {
  await touchActivity(tx, chamberId);
}
