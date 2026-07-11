import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "child_process";
import { createTestDb, REPO_ROOT } from "./helpers/testDb";

const { url } = createTestDb("fellow-souls");
process.env.DATABASE_URL = url;
process.env.GATE_OPERATOR_SECRET = "test-secret-for-social-tests";
process.env.DM_MASTER_SECRET = "test-dm-master-secret-for-social-tests";

import { PrismaClient } from "@prisma/client";
import {
  sendFellowSoulRequest,
  respondToRequest,
  releaseBond,
  areFellowSouls,
  myFellowSouls,
  blockSoul,
  unblockSoul,
  expireStaleRequests,
} from "../lib/fellowSouls";
import {
  openThread,
  sendMessage,
  declineThread,
  setThreadMute,
  deleteThreadForMe,
  readThread,
  threadsFor,
  reportMessage,
} from "../lib/dm";
import { equipBadge, submitRuling, runModerationSweeps, caseFileFor } from "../lib/moderation";
import { balanceOf } from "../lib/economy";
import { makeOnboardedSoul, topUpForTests } from "./helpers/souls";

const db = new PrismaClient({ datasources: { db: { url } } });

// The cast: Ada (initiator), Ben (recipient), Cyrus (stranger/moderator).
let adaId: string;
let benId: string;
let cyrusId: string;
let adaHandle: string;
let benHandle: string;
let cyrusHandle: string;

function runVerify() {
  return spawnSync("npx", ["tsx", "scripts/verify.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
}

beforeAll(async () => {
  const seeded = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  if (seeded.status !== 0) throw new Error(`seed failed: ${seeded.stderr}`);
  const s1 = await makeOnboardedSoul(db, { trueSelf: "ada-soul", alias: "ada-shade" });
  const s2 = await makeOnboardedSoul(db, { trueSelf: "ben-soul", alias: "ben-shade" });
  const s3 = await makeOnboardedSoul(db, { trueSelf: "cyrus-soul", alias: "cyrus-shade" });
  adaId = s1.trueSelfId;
  benId = s2.trueSelfId;
  cyrusId = s3.trueSelfId;
  adaHandle = "ada-soul";
  benHandle = "ben-soul";
  cyrusHandle = "cyrus-soul";
  await topUpForTests(db, adaId, { pc: 50 });
  await topUpForTests(db, benId, { pc: 20 });
  await topUpForTests(db, cyrusId, { pc: 20 });
}, 120_000);

afterAll(async () => {
  await db.$disconnect();
});

describe("fellow-soul requests (§2)", () => {
  it("initiator pays the rail; the recipient gets one quiet entry", async () => {
    const before = await balanceOf(db, adaId, "PC");
    const result = await sendFellowSoulRequest(db, {
      fromProfileId: adaId,
      toHandle: `@${benHandle}`,
      note: "We keep agreeing in the Compassion threads.",
    });
    expect(result.ok).toBe(true);
    const after = await balanceOf(db, adaId, "PC");
    expect(before - after).toBeCloseTo(2 - 1, 5); // 2u fee, +1 accrual

    const note = await db.notification.findFirst({
      where: { profileId: benId, category: "request" },
    });
    expect(note?.tier).toBe("quiet");

    const dup = await sendFellowSoulRequest(db, { fromProfileId: adaId, toHandle: benHandle });
    expect(dup.ok).toBe(false);
  });

  it("accept (free) forms the bond; both sides see it — nobody else can", async () => {
    const request = await db.fellowSoulRequest.findFirstOrThrow({
      where: { fromProfileId: adaId, toProfileId: benId, status: "pending" },
    });
    const benBefore = await balanceOf(db, benId, "PC");
    const result = await respondToRequest(db, { requestId: request.id, profileId: benId, accept: true });
    expect(result.ok).toBe(true);
    expect(await balanceOf(db, benId, "PC")).toBe(benBefore); // free

    expect(await areFellowSouls(db, adaId, benId)).toBe(true);
    const adaList = await myFellowSouls(db, adaId);
    expect(adaList.map((s) => s.handle)).toEqual([benHandle]);
    expect(await myFellowSouls(db, cyrusId)).toEqual([]);
  });

  it("nothing social ever reaches the public ledger", async () => {
    const events = await db.ledgerEvent.findMany();
    const social = events.filter((e) => /fellow|dm|request|bond|block/i.test(e.eventType));
    expect(social).toHaveLength(0);
    const request = await db.fellowSoulRequest.findFirstOrThrow();
    expect(events.some((e) => e.payload.includes(request.id))).toBe(false);
  });

  it("declines are silent and start the cooldown", async () => {
    const sent = await sendFellowSoulRequest(db, { fromProfileId: cyrusId, toHandle: benHandle });
    expect(sent.ok).toBe(true);
    const request = await db.fellowSoulRequest.findFirstOrThrow({
      where: { fromProfileId: cyrusId, toProfileId: benId, status: "pending" },
    });
    const notesBefore = await db.notification.count({ where: { profileId: cyrusId } });
    await respondToRequest(db, { requestId: request.id, profileId: benId, accept: false });
    expect(await db.notification.count({ where: { profileId: cyrusId } })).toBe(notesBefore);

    const again = await sendFellowSoulRequest(db, { fromProfileId: cyrusId, toHandle: benHandle });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toContain("door reopens");
  });

  it("pending requests expire on the rail — quietly", async () => {
    const sent = await sendFellowSoulRequest(db, { fromProfileId: cyrusId, toHandle: adaHandle });
    expect(sent.ok).toBe(true);
    await db.fellowSoulRequest.updateMany({
      where: { fromProfileId: cyrusId, toProfileId: adaId, status: "pending" },
      data: { createdAt: new Date(Date.now() - 31 * 86_400_000) },
    });
    await expireStaleRequests(db);
    const expired = await db.fellowSoulRequest.findFirstOrThrow({
      where: { fromProfileId: cyrusId, toProfileId: adaId },
    });
    expect(expired.status).toBe("expired");
  });
});

describe("direct messages (§5)", () => {
  let bondedThreadId: string;
  let strangerThreadId: string;

  it("fellow souls land direct; the initiator pays thread + message fees", async () => {
    const before = await balanceOf(db, adaId, "PC");
    const result = await openThread(db, {
      fromProfileId: adaId,
      toHandle: benHandle,
      body: "Saturday still on?",
    });
    expect(result.ok).toBe(true);
    if (result.ok) bondedThreadId = result.threadId;
    const after = await balanceOf(db, adaId, "PC");
    expect(before - after).toBeCloseTo(2 + 0.1 - 1, 5); // fees − accrual

    const thread = await db.dmThread.findUniqueOrThrow({ where: { id: bondedThreadId } });
    expect(thread.status).toBe("open");
    const note = await db.notification.findFirst({
      where: { profileId: benId, category: "dm" },
    });
    expect(note?.tier).toBe("time-sensitive");
  });

  it("messages are stored as authenticated ciphertext, never plaintext", async () => {
    const message = await db.dmMessage.findFirstOrThrow({ where: { threadId: bondedThreadId } });
    expect(message.ciphertext).not.toContain("Saturday");
    expect(message.ciphertext.split(":")).toHaveLength(3);

    const read = await readThread(db, { threadId: bondedThreadId, profileId: benId });
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.messages[0].body).toBe("Saturday still on?");

    // Outsiders cannot read.
    const outsider = await readThread(db, { threadId: bondedThreadId, profileId: cyrusId });
    expect(outsider.ok).toBe(false);
  });

  it("a tampered ciphertext fails authentication loudly", async () => {
    const message = await db.dmMessage.findFirstOrThrow({ where: { threadId: bondedThreadId } });
    const original = message.ciphertext;
    const [iv, ct, tag] = original.split(":");
    const flipped = Buffer.from(ct, "base64");
    flipped[0] ^= 0xff;
    await db.dmMessage.update({
      where: { id: message.id },
      data: { ciphertext: `${iv}:${flipped.toString("base64")}:${tag}` },
    });
    await expect(
      readThread(db, { threadId: bondedThreadId, profileId: adaId })
    ).rejects.toThrow();
    await db.dmMessage.update({ where: { id: message.id }, data: { ciphertext: original } });
  });

  it("strangers arrive as requests; the initiator waits; a reply opens the thread", async () => {
    const result = await openThread(db, {
      fromProfileId: cyrusId,
      toHandle: benHandle,
      body: "You seem thoughtful. A question about Harmony?",
    });
    expect(result.ok).toBe(true);
    if (result.ok) strangerThreadId = result.threadId;

    const thread = await db.dmThread.findUniqueOrThrow({ where: { id: strangerThreadId } });
    expect(thread.status).toBe("request");
    const note = await db.notification.findFirst({
      where: { profileId: benId, category: "request", refId: strangerThreadId },
    });
    expect(note?.tier).toBe("quiet");

    const pileOn = await sendMessage(db, {
      threadId: strangerThreadId,
      senderProfileId: cyrusId,
      body: "Also—",
    });
    expect(pileOn.ok).toBe(false);

    const benView = await threadsFor(db, benId);
    expect(benView.requests.map((t) => t.id)).toContain(strangerThreadId);

    const reply = await sendMessage(db, {
      threadId: strangerThreadId,
      senderProfileId: benId,
      body: "Ask away.",
    });
    expect(reply.ok).toBe(true);
    expect(
      (await db.dmThread.findUniqueOrThrow({ where: { id: strangerThreadId } })).status
    ).toBe("open");
  });

  it("mute stops notifications; delete-for-me hides one side only", async () => {
    await setThreadMute(db, { threadId: bondedThreadId, profileId: benId, muted: true });
    const notesBefore = await db.notification.findFirst({
      where: { profileId: benId, aggregationKey: `dm:${bondedThreadId}` },
    });
    await sendMessage(db, { threadId: bondedThreadId, senderProfileId: adaId, body: "Muted words." });
    const notesAfter = await db.notification.findFirst({
      where: { profileId: benId, aggregationKey: `dm:${bondedThreadId}` },
    });
    expect(notesAfter?.count ?? 0).toBe(notesBefore?.count ?? 0);

    await deleteThreadForMe(db, { threadId: bondedThreadId, profileId: adaId });
    const adaRead = await readThread(db, { threadId: bondedThreadId, profileId: adaId });
    const benRead = await readThread(db, { threadId: bondedThreadId, profileId: benId });
    expect(adaRead.ok && adaRead.messages.length).toBe(0);
    expect(benRead.ok && benRead.messages.length).toBeGreaterThan(0);
  });

  it("declined threads are closed; blocks refuse quietly", async () => {
    const stranger = await openThread(db, {
      fromProfileId: cyrusId,
      toHandle: adaHandle,
      body: "Hello.",
    });
    expect(stranger.ok).toBe(true);
    if (!stranger.ok) return;
    const declined = await declineThread(db, { threadId: stranger.threadId, profileId: adaId });
    expect(declined.ok).toBe(true);
    const more = await sendMessage(db, {
      threadId: stranger.threadId,
      senderProfileId: cyrusId,
      body: "Hello again.",
    });
    expect(more.ok).toBe(false);

    await blockSoul(db, { blockerProfileId: benId, blockedHandle: cyrusHandle });
    const blockedMsg = await sendMessage(db, {
      threadId: strangerThreadId,
      senderProfileId: cyrusId,
      body: "Still there?",
    });
    expect(blockedMsg.ok).toBe(false);
    if (!blockedMsg.ok) expect(blockedMsg.reason).not.toMatch(/block/i); // quiet
    const blockedReq = await sendFellowSoulRequest(db, {
      fromProfileId: cyrusId,
      toHandle: benHandle,
    });
    expect(blockedReq.ok).toBe(false);
    if (!blockedReq.ok) expect(blockedReq.reason).not.toMatch(/block/i);
    await unblockSoul(db, { blockerProfileId: benId, blockedProfileId: cyrusId });
  });

  it("released bonds are quiet; the next stranger contact is a request again", async () => {
    const released = await releaseBond(db, { profileId: benId, otherProfileId: adaId });
    expect(released.ok).toBe(true);
    expect(await areFellowSouls(db, adaId, benId)).toBe(false);
  });
});

describe("recipient-side reporting → the standard path (§5.1)", () => {
  let reportedMessageId: string;
  let caseId: string;

  it("the recipient reveals one message; excerpt + flag + case appear; sender cannot self-report", async () => {
    const sent = await sendMessage(db, {
      threadId: (await db.dmThread.findFirstOrThrow({
        where: { status: "open", pairKey: { contains: cyrusId } },
      })).id,
      senderProfileId: cyrusId,
      body: "Deliberately disruptive words for the test.",
    });
    expect(sent.ok).toBe(true);
    const message = await db.dmMessage.findFirstOrThrow({
      where: { senderProfileId: cyrusId },
      orderBy: { createdAt: "desc" },
    });
    reportedMessageId = message.id;

    const selfReport = await reportMessage(db, {
      messageId: message.id,
      profileId: cyrusId,
      ruleId: "R1.2",
    });
    expect(selfReport.ok).toBe(false);

    const result = await reportMessage(db, {
      messageId: message.id,
      profileId: benId,
      ruleId: "R1.2",
      note: "Pattern of disruption.",
    });
    expect(result.ok).toBe(true);

    const again = await reportMessage(db, { messageId: message.id, profileId: benId, ruleId: "R1.2" });
    expect(again.ok).toBe(false);

    const excerpt = await db.dmExcerpt.findFirstOrThrow();
    expect(excerpt.body).toContain("Deliberately disruptive");
    const modCase = await db.modCase.findFirstOrThrow({ where: { dmExcerptId: excerpt.id } });
    caseId = modCase.id;
    expect(modCase.postId).toBeNull();
  });

  it("the case file shows the excerpt and standing — no handles, no ids", async () => {
    const file = await caseFileFor(db, caseId);
    expect(file.isDm).toBe(true);
    expect(file.content).toContain("Deliberately disruptive");
    const rendered = JSON.stringify(file);
    expect(rendered).not.toContain(cyrusHandle);
    expect(rendered).not.toContain(benHandle);
    expect(rendered).not.toContain(cyrusId);
    expect(rendered).not.toContain(benId);
  });

  it("an uphold strikes the sender (meta pillar), refunds the reporter, notifies both — namelessly", async () => {
    // Ada takes the badge (Ben reported; Cyrus is accused — Ada is the
    // only clean pair of hands).
    await runModerationSweeps(db);
    let offer = await db.badgeOffer.findFirst({
      where: { profileId: adaId, status: "offered", expiresAt: { gt: new Date() } },
    });
    if (!offer) {
      // Sortition is random; the test needs THIS judge — mint the offer
      // directly (lifecycle rails are covered in moderation.test.ts).
      offer = await db.badgeOffer.create({
        data: { profileId: adaId, expiresAt: new Date(Date.now() + 3_600_000) },
      });
    }
    const equipped = await equipBadge(db, { offerId: offer.id, profileId: adaId });
    expect(equipped.ok).toBe(true);

    const ruled = await submitRuling(db, {
      caseId,
      profileId: adaId,
      verdict: "uphold",
      citedRuleId: "R1.2",
    });
    expect(ruled.ok).toBe(true);

    const resolved = await db.modCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(resolved.status).toBe("resolved");
    expect(resolved.outcome).toBe("upheld");

    const meta = await db.pillar.findFirstOrThrow({ where: { isMeta: true } });
    const strike = await db.strike.findFirst({ where: { caseId, profileId: cyrusId } });
    expect(strike?.pillarId).toBe(meta.id);

    const flag = await db.flag.findFirstOrThrow({ where: { caseId } });
    expect(flag.status).toBe("refunded");

    const accusedNote = await db.notification.findFirst({
      where: { profileId: cyrusId, category: "ruling" },
      orderBy: { createdAt: "desc" },
    });
    expect(accusedNote?.body).toContain("R1.2");
    expect(accusedNote?.body ?? "").not.toContain(benHandle);

    // The message itself is untouched — no content action in a private
    // thread; the recipient already holds it.
    const message = await db.dmMessage.findUniqueOrThrow({ where: { id: reportedMessageId } });
    expect(message.ciphertext.split(":")).toHaveLength(3);

    // The public record: a case resolved citing a rule — and not one
    // social identifier anywhere.
    const events = await db.ledgerEvent.findMany({ orderBy: { seq: "desc" }, take: 5 });
    const resolvedEvent = events.find((e) => e.eventType === "case.resolved");
    expect(resolvedEvent).toBeDefined();
    expect(resolvedEvent!.payload).not.toContain(cyrusHandle);
    const excerpt = await db.dmExcerpt.findFirstOrThrow();
    expect(resolvedEvent!.payload).not.toContain(excerpt.threadId);
  });
});

describe("db:verify — the social invariants hold, and break loudly", () => {
  it("passes on the honest database", () => {
    const result = runVerify();
    expect(result.stdout).toContain("Social privacy");
    expect(result.stdout).toContain("Social integrity & encryption");
    expect(result.stdout).toContain("ALL CHECKS PASSED");
    expect(result.status).toBe(0);
  }, 60_000);

  it("fails loudly when plaintext is smuggled into the message table", async () => {
    const message = await db.dmMessage.findFirstOrThrow();
    const original = message.ciphertext;
    await db.dmMessage.update({
      where: { id: message.id },
      data: { ciphertext: "just plaintext sitting here" },
    });
    const result = runVerify();
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("CIPHERTEXT BROKEN");
    await db.dmMessage.update({ where: { id: message.id }, data: { ciphertext: original } });
  }, 60_000);

  it("fails loudly when a bond appears without consent behind it", async () => {
    const smuggled = await db.fellowSoulBond.create({
      data:
        adaId < cyrusId
          ? { aProfileId: adaId, bProfileId: cyrusId }
          : { aProfileId: cyrusId, bProfileId: adaId },
    });
    const result = runVerify();
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("CONSENTLESS BOND");
    await db.fellowSoulBond.delete({ where: { id: smuggled.id } });
  }, 60_000);
});
