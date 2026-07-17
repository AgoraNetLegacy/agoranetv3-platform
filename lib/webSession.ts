// Web plumbing for SoulSessions: one cookie names the browser's session
// row; the session knows which faces are signed in and which is active.
// Secrets (credential, access keys) are handed to the soul through
// one-time httpOnly cookies rendered exactly once — never query strings,
// which leak into history and logs (DUAL_IDENTITY §7.1 vector 4).

import { cookies, headers } from "next/headers";
import { db } from "./db";
import { createSession, getSession } from "./parking";

const SESSION_COOKIE = "agoranet-session";
const ONE_TIME_COOKIE = "agoranet-once";
const FLIP_COOKIE = "agoranet-flip";

// In production (HTTPS) the cookies carrying the session bearer token and
// one-time secrets must never travel over plaintext HTTP. Off in dev so
// local http://localhost still works.
const SECURE_COOKIE = process.env.NODE_ENV === "production";

export async function ensureSessionId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(SESSION_COOKIE)?.value;
  if (existing) {
    const session = await getSession(db, existing);
    if (session) return session.id;
  }
  const id = await createSession(db);
  jar.set(SESSION_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: SECURE_COOKIE });
  return id;
}

export async function currentSession() {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  return getSession(db, id);
}

/** The active face in this browser session, or null (reader). */
export async function activeFace() {
  const session = await currentSession();
  if (!session?.activeProfileId) return null;
  const isSignedIn = session.faces.some(
    (f) => f.profileId === session.activeProfileId
  );
  if (!isSignedIn) return null;
  return db.profile.findUnique({ where: { id: session.activeProfileId } });
}

/** Every face signed into this browser session (for the switch control). */
export async function sessionFaces() {
  const session = await currentSession();
  if (!session) return [];
  return db.profile.findMany({
    where: { id: { in: session.faces.map((f) => f.profileId) } },
    orderBy: { createdAt: "asc" },
  });
}

/** The client address for rate-limit keying, ONLY behind a declared
 *  proxy (TRUST_PROXY=true) where x-forwarded-for is trustworthy. The
 *  value feeds an HMAC and is never stored or logged raw — minimal-log
 *  discipline (DUAL_IDENTITY §7.1 vector 4). */
export async function clientAddress(): Promise<string | null> {
  if (process.env.TRUST_PROXY !== "true") return null;
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip")?.trim() || null;
}

/** Stash a secret for one short-lived display (call from an action). */
export async function setOneTimeSecret(value: string): Promise<void> {
  const jar = await cookies();
  jar.set(ONE_TIME_COOKIE, value, { httpOnly: true, sameSite: "lax", secure: SECURE_COOKIE, maxAge: 300 });
}

/** Read the pending secret (safe in a server component render). */
export async function peekOneTimeSecret(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(ONE_TIME_COOKIE)?.value ?? null;
}

/** Destroy the pending secret (call from the "I saved it" action). */
export async function clearOneTimeSecret(): Promise<void> {
  const jar = await cookies();
  jar.delete(ONE_TIME_COOKIE);
}

/** Mark that the next page load is a change of face: the page arrives
 *  as the card flip (PRESENTATION_SPEC §2.2). Short-lived by design —
 *  it self-expires so a refresh moments later doesn't replay the turn. */
export async function markFaceFlip(): Promise<void> {
  const jar = await cookies();
  jar.set(FLIP_COOKIE, "1", { httpOnly: true, sameSite: "lax", secure: SECURE_COOKIE, maxAge: 3 });
}

/** Is a face change landing on this render? (safe in a layout render) */
export async function faceFlipPending(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(FLIP_COOKIE)?.value === "1";
}
