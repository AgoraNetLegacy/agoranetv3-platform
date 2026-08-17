import { randomInt } from "crypto";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult =
  | { ok: true; skipped: boolean }
  | { ok: false; reason: string };

export function turnstileEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.TURNSTILE_ENABLED === "true";
}

/**
 * Server-side escalation for ceremony retries. The widget is rendered on
 * the form whenever enabled, but the server decides whether this attempt
 * must present a valid token. Rate limits remain the backstop; this random
 * draw is deliberately not a client-visible field or a replacement for
 * Turnstile verification.
 */
export function randomTurnstileEscalation(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (!turnstileEnabled(env)) return false;
  const percent = Number(env.TURNSTILE_ESCALATION_PERCENT ?? "35");
  const bounded = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 35;
  return randomInt(100) < bounded;
}

/**
 * Turnstile is an anti-bot control, not proof of humanity or uniqueness.
 * The token is always verified server-side before the protected action runs.
 */
export async function verifyTurnstile(
  token: string,
  remoteIp?: string | null,
  env: NodeJS.ProcessEnv = process.env
): Promise<TurnstileResult> {
  if (!turnstileEnabled(env)) return { ok: true, skipped: true };

  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: false, reason: "Turnstile is not configured." };
  if (!token) return { ok: false, reason: "Please complete the human check and try again." };

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, reason: "The human check is temporarily unavailable; try again." };
    }
    const result = (await response.json()) as { success?: boolean };
    return result.success
      ? { ok: true, skipped: false }
      : { ok: false, reason: "The human check did not pass; try again." };
  } catch {
    return { ok: false, reason: "The human check is temporarily unavailable; try again." };
  }
}
