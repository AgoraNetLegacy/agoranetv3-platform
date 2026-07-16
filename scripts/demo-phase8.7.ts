// demo:phase8.7 — The Treasury's Other Half, end to end.
//
// THE STORY THIS TELLS, and why it's the one worth telling: every part
// of this pipeline is a composition of machinery that already runs. The
// Chamber and its scaffold, attestation, the Tribunal, Sentinel, the
// civic ledger anchored to Cardano preprod — none of it was invented for
// fund integrity. That is the claim that cannot be faked, and it is why
// a working demo beats a specification.
//
// A mission asks for money and must answer three questions in public →
// souls give, and it costs them for real → a release is proposed saying
// what it's for → two OTHER members co-sign and the money moves in that
// same instant, untouched by any operator → a large release can't take
// that cheap door and needs a binding vote → a ruling freezes what
// hasn't moved → an auditor drawn by lot reads the books and gets paid
// the same whatever they find → and every step of it is on a ledger
// whose head hash is witnessed by a public blockchain.
//
// HONEST THROUGHOUT (OWNERS_GUIDE §2 — "say this honestly, always"):
// the units are internal, valueless points. The MECHANISM is what's
// real. Phase 9 changes the value, not the machinery.
//
// Run: npm run demo:phase8.7   (uses the dev database; seed first)

import { PrismaClient } from "@prisma/client";
import { createChamber, enterChamber } from "../lib/chambers";
import {
  declareRaising,
  donateToMission,
  proposeRelease,
  attestRelease,
  freezeChamberReleases,
  chamberBalanceOf,
  missionFundingSummary,
  sentinelMissionSweep,
} from "../lib/escrow";
import { offerFundAudits, acceptFundAudit, completeFundAudit } from "../lib/fundAudit";
import { createPoll, castVote, closeDuePolls } from "../lib/polls";
import { balanceOf } from "../lib/economy";
import { SHIPPED_BUDGET_CATEGORIES } from "../lib/budget";
import { makeOnboardedSoul, topUpForTests } from "../tests/helpers/souls";

const db = new PrismaClient();

function step(n: string, msg: string) {
  console.log(`\n— ${n}. ${msg}`);
}
function note(msg: string) {
  console.log(`     ${msg}`);
}

async function main() {
  const stamp = Date.now().toString(36).slice(-5);
  console.log("\n=== Phase 8.7 — The Treasury's Other Half ===");
  console.log("Internal points, no real value. The mechanism is what's real.");

  // ── 1 ──────────────────────────────────────────────────────────────
  step("1", "The guardrail that had no code: budgeted categories");
  const categories = await db.budgetCategory.findMany({ orderBy: { name: "asc" } });
  note(`The Constitution (Appendix A): "the treasury MUST NOT spend outside budgeted categories."`);
  note(`Until this phase that was law with nothing to enforce it — no category model, no`);
  note(`field, and no shared door for money to leave by. Now there is exactly one door,`);
  note(`and it refuses anything uncategorized.`);
  for (const c of categories) note(`  · ${c.name}${c.active ? "" : " (inactive)"}`);
  note(`These three are exactly TOKENOMICS §3's treasury loop — nothing invented.`);
  note(`Note what's ABSENT: "cause funding." The treasury has no such purpose in the`);
  note(`ratified economics, so this phase didn't give it one.`);
  if (categories.length !== SHIPPED_BUDGET_CATEGORIES.length) {
    throw new Error("budget categories missing — run npm run db:seed");
  }

  // ── 2 ──────────────────────────────────────────────────────────────
  step("2", "A mission asks for money — and must answer three questions first");
  const founder = await makeOnboardedSoul(db, {
    trueSelf: `d87-founder-${stamp}`,
    alias: `d87-f-shade-${stamp}`,
  });
  const neighbour = await makeOnboardedSoul(db, {
    trueSelf: `d87-neighbour-${stamp}`,
    alias: `d87-n-shade-${stamp}`,
  });
  const witness = await makeOnboardedSoul(db, {
    trueSelf: `d87-witness-${stamp}`,
    alias: `d87-w-shade-${stamp}`,
  });
  const donor = await makeOnboardedSoul(db, {
    trueSelf: `d87-donor-${stamp}`,
    alias: `d87-d-shade-${stamp}`,
  });
  await topUpForTests(db, founder.trueSelfId, { pc: 200, g: 200 });
  await topUpForTests(db, donor.trueSelfId, { pc: 200, g: 200 });

  const made = await createChamber(db, {
    profileId: founder.trueSelfId,
    title: `Kelowna Food Security ${stamp}`,
    subject: "A funded surplus-rescue route",
    pitch: "Grocers discard edible food nightly; pantries run short by Thursday.",
    whyCare: "Wasted food, hungry neighbors, and the fix is logistics — solvable now, by us.",
    isPublic: true,
    scaffold: {
      solving: "Edible surplus goes to landfill while pantries run dry.",
      needToKnow: "Health rules, who already gleans, cold-chain basics.",
      success: "A weekly surplus-to-pantry route running without us.",
    },
  });
  if (!made.ok) throw new Error(made.reason);
  const chamberId = made.chamberId;
  await enterChamber(db, { chamberId, profileId: neighbour.trueSelfId });
  await enterChamber(db, { chamberId, profileId: witness.trueSelfId });

  const blank = await declareRaising(db, {
    chamberId,
    profileId: founder.trueSelfId,
    raising: true,
  });
  note(`Asking with no plan → REFUSED:`);
  note(`  "${!blank.ok ? blank.reason.slice(0, 96) : "??"}…"`);
  note(`This is Tier 0, and it isn't a gate bolted on: a Chamber ALREADY is a stated`);
  note(`mission that survived public dissection. The three answers just point that`);
  note(`existing machinery at money.`);

  await declareRaising(db, {
    chamberId,
    profileId: founder.trueSelfId,
    raising: true,
    plan: {
      recipient: "Our own members, reimbursed for costs they front.",
      evidence: "Receipts posted to the workshop; our attested action log is public.",
      breakdown: "40u totes · 30u transport · 30u cold-chain.",
    },
  });
  note(`Answered → now raising. The plan is v1 in a history that keeps every version.`);

  // ── 3 ──────────────────────────────────────────────────────────────
  step("3", "Souls give — and it costs them for real");
  const donorBefore = await balanceOf(db, donor.trueSelfId, "PC");
  await donateToMission(db, { chamberId, profileId: donor.trueSelfId, amount: 100 });
  const donorAfter = await balanceOf(db, donor.trueSelfId, "PC");
  note(`Donor: ${donorBefore.toFixed(2)}u → ${donorAfter.toFixed(2)}u PollCoin. Gone.`);
  note(`Mission holds: ${(await chamberBalanceOf(db, chamberId, "PC")).toFixed(2)}u`);
  note(`No auto-return, ever. This mechanic replaced poll support-staking on the owner's`);
  note(`own critique: "auto-returned staking is cheap talk — a costless signal carries no`);
  note(`information." It comes back only if the chamber's members release it.`);

  // ── 4 ──────────────────────────────────────────────────────────────
  step("4", "A release is proposed — and the proposer cannot wave it through");
  const small = await proposeRelease(db, {
    chamberId,
    proposerProfileId: founder.trueSelfId,
    toProfileId: neighbour.trueSelfId,
    currency: "PC",
    amount: 12,
    purpose: "Cold-chain totes for the Thursday route",
  });
  if (!small.ok) throw new Error(small.reason);
  note(`Proposed 12u — "${"Cold-chain totes for the Thursday route"}"`);
  note(`Door: ${small.authorization} (published at proposal, never chosen after the fact)`);

  const selfSign = await attestRelease(db, {
    releaseId: small.releaseId,
    attestorProfileId: founder.trueSelfId,
  });
  note(`The proposer tries to co-sign their own release → REFUSED:`);
  note(`  "${!selfSign.ok ? selfSign.reason : "??"}"`);

  // ── 5 ──────────────────────────────────────────────────────────────
  step("5", "★ Two other members co-sign — and the money moves in that instant");
  const chamberBefore = await chamberBalanceOf(db, chamberId, "PC");
  const recipientBefore = await balanceOf(db, neighbour.trueSelfId, "PC");

  const first = await attestRelease(db, {
    releaseId: small.releaseId,
    attestorProfileId: neighbour.trueSelfId,
  });
  note(`Co-signer 1 → paid: ${first.ok && first.released}  (threshold is 2 OTHER voices)`);
  const second = await attestRelease(db, {
    releaseId: small.releaseId,
    attestorProfileId: witness.trueSelfId,
  });
  note(`Co-signer 2 → paid: ${second.ok && second.released}`);
  note(``);
  note(`Mission:   ${chamberBefore.toFixed(2)}u → ${(await chamberBalanceOf(db, chamberId, "PC")).toFixed(2)}u`);
  note(`Recipient: ${recipientBefore.toFixed(2)}u → ${(await balanceOf(db, neighbour.trueSelfId, "PC")).toFixed(2)}u`);
  note(``);
  note(`THE POINT: the call that recorded the second signature IS the call that paid.`);
  note(`There is no "execute" step. Not for an admin, not for the founder, not for`);
  note(`anyone — the code path does not exist. An operator who can silently sit on`);
  note(`approved money is as much a capture vector as one who can steal it.`);

  // ── 6 ──────────────────────────────────────────────────────────────
  step("6", "A large release cannot take the cheap door");
  const big = await proposeRelease(db, {
    chamberId,
    proposerProfileId: founder.trueSelfId,
    toProfileId: neighbour.trueSelfId,
    currency: "PC",
    amount: 60,
    purpose: "The whole winter buy",
  });
  if (!big.ok) throw new Error(big.reason);
  note(`Proposed 60u (over the 25u serious-stake threshold)`);
  note(`Door: ${big.authorization}`);
  const sneak = await attestRelease(db, {
    releaseId: big.releaseId,
    attestorProfileId: neighbour.trueSelfId,
  });
  note(`Trying to co-sign it through anyway → REFUSED:`);
  note(`  "${!sneak.ok ? sneak.reason : "??"}"`);
  note(`Two co-signers are corroboration for a reimbursement. They are not a mandate`);
  note(`for the mission's whole purse — so §9.1 gives the purse a second door.`);

  const meta = await db.pillar.findFirstOrThrow({ where: { isMeta: true } });
  const poll = await createPoll(db, {
    profileId: founder.trueSelfId,
    pillarId: meta.id,
    title: `Release 60u: the whole winter buy`,
    type: "consensus",
    mode: "pseudonymous",
    options: ["Adopt", "Decline"],
    durationHours: 1,
    consensusThreshold: 0.6,
    chamber: { chamberId, action: `release:${big.releaseId}` },
  });
  if (!poll.ok) throw new Error(poll.reason);
  const adopt = await db.pollOption.findFirstOrThrow({
    where: { pollId: poll.pollId, position: 1 },
  });
  for (const soul of [founder, neighbour, witness]) {
    await castVote(db, {
      pollId: poll.pollId,
      profileId: soul.trueSelfId,
      optionIds: [adopt.id],
    });
  }
  await db.ballot.updateMany({
    where: { pollId: poll.pollId },
    data: { castAt: new Date(Date.now() - 60_000) },
  });
  await db.poll.update({
    where: { id: poll.pollId },
    data: { nominalCloseAt: new Date(Date.now() - 1000), trueCloseAt: new Date(Date.now() - 1000) },
  });
  const bigRecipientBefore = await balanceOf(db, neighbour.trueSelfId, "PC");
  await closeDuePolls(db);
  const paidBig = await db.missionRelease.findUniqueOrThrow({ where: { id: big.releaseId } });
  note(`Binding vote closes → release is "${paidBig.state}"`);
  note(`Recipient: ${bigRecipientBefore.toFixed(2)}u → ${(await balanceOf(db, neighbour.trueSelfId, "PC")).toFixed(2)}u`);
  note(`Again: the poll closing IS the payment. Both doors, one payment path.`);

  // ── 7 ──────────────────────────────────────────────────────────────
  step("7", "★ A ruling freezes what hasn't moved — the real teeth");
  const pendingA = await proposeRelease(db, {
    chamberId,
    proposerProfileId: founder.trueSelfId,
    toProfileId: neighbour.trueSelfId,
    currency: "PC",
    amount: 5,
    purpose: "Pending: fuel",
  });
  const pendingB = await proposeRelease(db, {
    chamberId,
    proposerProfileId: founder.trueSelfId,
    toProfileId: witness.trueSelfId,
    currency: "PC",
    amount: 6,
    purpose: "Pending: printing",
  });
  if (!pendingA.ok || !pendingB.ok) throw new Error("proposals failed");
  const frozen = await db.$transaction((tx) =>
    freezeChamberReleases(tx, { chamberId, rulingId: `demo-ruling-${stamp}` })
  );
  note(`An upheld ruling of misuse → ${frozen} unreleased proposals frozen, automatically,`);
  note(`inside the ruling's own transaction. No operator pressed anything.`);
  note(``);
  note(`Said honestly: you CANNOT claw back what is already spent. The 12u and the 60u`);
  note(`stay spent. Freeze stops what has not moved — that is the whole claim, and`);
  note(`overselling it would be the easiest lie in this demo.`);

  // ── 8 ──────────────────────────────────────────────────────────────
  step("8", "An auditor is drawn by lot — and paid the same whatever they find");
  const auditor = await makeOnboardedSoul(db, {
    trueSelf: `d87-auditor-${stamp}`,
    alias: `d87-au-shade-${stamp}`,
  });
  const offer = await db.badgeOffer.create({
    data: {
      profileId: auditor.trueSelfId,
      expiresAt: new Date(Date.now() + 86_400_000),
      status: "equipped",
    },
  });
  await db.badgeTerm.create({
    data: {
      offerId: offer.id,
      profileId: auditor.trueSelfId,
      endsAt: new Date(Date.now() + 86_400_000),
      casesCompleted: 3,
    },
  });
  await db.rail.update({ where: { key: "fundAudit.samplePercent" }, data: { value: 100 } });
  const offered = await offerFundAudits(db);
  note(`${offered} released payment(s) drawn for audit, by lot.`);
  const audit = await db.fundAudit.findFirst({
    where: { auditorProfileId: auditor.trueSelfId, status: "offered" },
  });
  if (audit) {
    const auditorBefore = await balanceOf(db, auditor.trueSelfId, "G");
    await acceptFundAudit(db, { auditId: audit.id, profileId: auditor.trueSelfId });
    await completeFundAudit(db, {
      auditId: audit.id,
      profileId: auditor.trueSelfId,
      finding: "clean",
      note: "Purpose matches the funding plan; co-signers unrelated to the recipient.",
    });
    note(`Finding: clean. Auditor paid ${(await balanceOf(db, auditor.trueSelfId, "G")) - auditorBefore}u G.`);
    note(`A "concern" would have paid EXACTLY the same. An auditor paid for finding`);
    note(`problems will find problems — so the pay is for looking.`);
    note(`Never the proposer, the recipient, or a chamber member: an auditor auditing`);
    note(`their own mission is not an audit.`);
  }

  // ── 9 ──────────────────────────────────────────────────────────────
  step("9", "Sentinel watches patterns — and never punishes");
  await db.rail.update({
    where: { key: "sentinel.selfDealReleaseThreshold" },
    data: { value: 2 },
  });
  for (const purpose of ["Self reimbursement A", "Self reimbursement B"]) {
    const r = await proposeRelease(db, {
      chamberId,
      proposerProfileId: neighbour.trueSelfId,
      toProfileId: neighbour.trueSelfId,
      currency: "PC",
      amount: 2,
      purpose,
    });
    if (!r.ok) continue;
    await attestRelease(db, { releaseId: r.releaseId, attestorProfileId: founder.trueSelfId });
    await attestRelease(db, { releaseId: r.releaseId, attestorProfileId: witness.trueSelfId });
  }
  const flagged = await sentinelMissionSweep(db);
  note(`Self-directed release pattern flagged: ${flagged}`);
  note(`ONE member reimbursing themselves is the most ordinary use of a mission's`);
  note(`money — forbidding it would push real spending off the record where nobody`);
  note(`can see it. So it's allowed, and watched. The flag says on its face: "a`);
  note(`question, not an accusation." Anomalies never punish.`);

  // ── 10 ─────────────────────────────────────────────────────────────
  step("10", "★ All of it is on a ledger a public blockchain witnesses");
  const summary = await missionFundingSummary(db, chamberId);
  note(`Mission holds ${summary.balances.map((b) => `${b.amount.toFixed(2)}u ${b.currency}`).join(", ")}`);
  note(`Released to date: ${summary.releasedTotal.toFixed(2)}u across ${summary.releases.filter((r) => r.state === "released").length} payment(s)`);

  const events = await db.ledgerEvent.findMany({
    where: {
      OR: [
        { eventType: { startsWith: "mission." } },
        { eventType: { startsWith: "fund-audit." } },
        { eventType: { startsWith: "sentinel.mission" } },
      ],
    },
    orderBy: { seq: "asc" },
  });
  note(``);
  note(`${events.length} civic-ledger events from this story:`);
  const counts = new Map<string, number>();
  for (const e of events) counts.set(e.eventType, (counts.get(e.eventType) ?? 0) + 1);
  for (const [type, n] of counts) note(`  · ${type} × ${n}`);

  const anchor = await db.ledgerEvent.findFirst({
    where: { eventType: "ledger.anchored" },
    orderBy: { seq: "desc" },
  });
  note(``);
  if (anchor) {
    const payload = JSON.parse(anchor.payload);
    note(`The ledger's head hash is witnessed on Cardano preprod:`);
    note(`  tx ${payload.txHash ?? payload.anchorRef ?? "(see /transparency)"}`);
    note(`Rewriting any of the above now means beating a public blockchain.`);
  } else {
    note(`No anchor in this database yet — run: npm run chain:anchor`);
    note(`(The cadence is live on preprod; see /transparency for the latest tx.)`);
  }
  note(``);
  note(`Every step above is composition, not invention: Chambers, attestation, polls,`);
  note(`the Tribunal, Sentinel, the ledger, the anchor — all of it already ran. That`);
  note(`is the claim worth making, and it's the one that can't be faked.`);

  console.log(`\n=== The honest part ===`);
  console.log(`The units are internal points with no value. The MECHANISM is what's real.`);
  console.log(`Phase 9 changes the value, not the machinery.`);
  console.log(`Attestation proves N verified humans staked their names — never that the`);
  console.log(`platform verified the spend. Fund Integrity raises the cost of lying; it`);
  console.log(`does not make lying impossible.\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
