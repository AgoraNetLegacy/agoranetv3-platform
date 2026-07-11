// DM encryption, Phase A (FELLOW_SOULS §5.1 / §9.1 — resolved at phase
// start, DECISIONS_PENDING #8: the spec's "simpler asymmetric scheme
// for v1", built from Signal-family primitives).
//
//   per-profile X25519 keypair
//     → ECDH shared secret per thread → HKDF-SHA256 thread key
//       → AES-256-GCM per message (random IV, thread-bound AAD)
//
// The honest part: in Phase A the private keys are held ENCRYPTED UNDER
// AN OPERATOR SECRET (DM_MASTER_SECRET) — the gate's exact trust
// posture. Messages are encrypted at rest and unreadable to anyone
// without the master secret, but the operator could read them; we
// disclose that verbatim (DM_PHASE_A_DISCLOSURE) instead of performing
// end-to-end theater in a server-rendered app. Phase 9 moves private
// keys into the soul's wallet (Lace) — true E2E on the same published
// schedule as the gate cutover. The INTERFACE (encrypt/decrypt per
// thread) is the contract that survives.

import {
  createCipheriv,
  createDecipheriv,
  createPublicKey,
  createPrivateKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
} from "crypto";
import type { DbOrTx } from "./db";

export const DM_PHASE_A_DISCLOSURE =
  "Messages are encrypted (X25519 + AES-256-GCM) and stored only as " +
  "ciphertext — but in this phase the keys are held in escrow by the " +
  "operator, the same trust you extend to the gate: we are structurally " +
  "honest, and you are trusting us not to look. When the wallet rail " +
  "arrives (Phase 9), your key moves to your side and reading your " +
  "messages becomes impossible for us, not just forbidden.";

function masterSecret(): Buffer {
  const secret = process.env.DM_MASTER_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("DM_MASTER_SECRET is required for Phase A DM key escrow.");
  }
  // Normalize to a 32-byte key.
  return Buffer.from(
    hkdfSync("sha256", Buffer.from(secret), Buffer.alloc(0), "dm-master", 32)
  );
}

function sealWithKey(key: Buffer, plaintext: Buffer, aad: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${ct.toString("base64")}:${tag.toString("base64")}`;
}

function openWithKey(key: Buffer, sealed: string, aad: string): Buffer {
  const [ivB64, ctB64, tagB64] = sealed.split(":");
  if (!ivB64 || !ctB64 || !tagB64) throw new Error("Malformed ciphertext.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
}

/** Ensure a profile has a DM keypair; returns the public key (base64). */
export async function ensureDmKeypair(db: DbOrTx, profileId: string): Promise<string> {
  const existing = await db.dmKeypair.findUnique({ where: { profileId } });
  if (existing) return existing.publicKey;

  const { publicKey, privateKey } = generateKeyPairSync("x25519");
  const pub = publicKey.export({ type: "spki", format: "der" }).toString("base64");
  const priv = privateKey.export({ type: "pkcs8", format: "der" });
  const created = await db.dmKeypair.create({
    data: {
      profileId,
      publicKey: pub,
      // Escrowed: encrypted under the master secret, bound to the profile.
      privateKeyEnc: sealWithKey(masterSecret(), priv, `dm-key:${profileId}`),
    },
  });
  return created.publicKey;
}

/** Derive the symmetric thread key from the two members' keypairs.
 *  Symmetric by construction: ECDH(a_priv, b_pub) = ECDH(b_priv, a_pub). */
export async function threadKeyFor(
  db: DbOrTx,
  thread: { id: string; initiatorProfileId: string; otherProfileId: string }
): Promise<Buffer> {
  const [aPair, bPair] = await Promise.all([
    db.dmKeypair.findUniqueOrThrow({ where: { profileId: thread.initiatorProfileId } }),
    db.dmKeypair.findUniqueOrThrow({ where: { profileId: thread.otherProfileId } }),
  ]);
  const privDer = openWithKey(
    masterSecret(),
    aPair.privateKeyEnc,
    `dm-key:${thread.initiatorProfileId}`
  );
  const privateKey = createPrivateKey({ key: privDer, type: "pkcs8", format: "der" });
  const publicKey = createPublicKey({
    key: Buffer.from(bPair.publicKey, "base64"),
    type: "spki",
    format: "der",
  });
  const shared = diffieHellman({ privateKey, publicKey });
  return Buffer.from(
    hkdfSync("sha256", shared, Buffer.alloc(0), `dm-thread:${thread.id}`, 32)
  );
}

/** Encrypt one message for its thread. AAD binds thread + sender, so a
 *  ciphertext can't be replayed into another thread or under another
 *  sender without failing authentication. */
export function sealMessage(
  threadKey: Buffer,
  threadId: string,
  senderProfileId: string,
  body: string
): string {
  return sealWithKey(threadKey, Buffer.from(body, "utf8"), `${threadId}|${senderProfileId}`);
}

/** Decrypt + authenticate one message. Throws on any tampering. */
export function openMessage(
  threadKey: Buffer,
  threadId: string,
  senderProfileId: string,
  ciphertext: string
): string {
  return openWithKey(threadKey, ciphertext, `${threadId}|${senderProfileId}`).toString("utf8");
}
