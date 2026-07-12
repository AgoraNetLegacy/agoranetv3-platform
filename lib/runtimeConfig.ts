// Runtime config guard (DATABASE_SETUP.md, v2 reuse): a hosted
// environment REFUSES TO BOOT on unsafe configuration — a silent,
// hard-to-diagnose bug becomes an immediate startup failure. Enforced
// by scripts/check-runtime-config.ts (prestart + build:postgres).
//
// "Hosted" means NODE_ENV=production or DEPLOYMENT_ENV=staging|production.
// Local dev and the test suite never hit these checks.

const PLACEHOLDER_MARKERS = [
  "change-me",
  "replace-me",
  "replace-with",
  "random-characters",
  "generate-a-",
  "store-in-secret-manager",
  "pooled-runtime-connection",
  "direct-migration-connection",
  "insecure",
  "example",
  "placeholder",
];

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  const normalized = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker));
}

function isStrongSecret(value: string | undefined): boolean {
  if (!value || value.length < 32) return false;
  return !isPlaceholder(value);
}

function isPostgresUrl(value: string | undefined): boolean {
  if (!value || isPlaceholder(value)) return false;
  try {
    const url = new URL(value);
    return (
      ["postgresql:", "postgres:"].includes(url.protocol) &&
      !!url.hostname &&
      url.pathname.length > 1
    );
  } catch {
    return false;
  }
}

export function isHostedEnvironment(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return (
    env.NODE_ENV === "production" ||
    env.DEPLOYMENT_ENV === "staging" ||
    env.DEPLOYMENT_ENV === "production"
  );
}

export function validateRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): string[] {
  const errors: string[] = [];
  if (!isHostedEnvironment(env)) return errors;

  if (!isPostgresUrl(env.DATABASE_URL)) {
    errors.push(
      "Hosted DATABASE_URL must be a real PostgreSQL URL (DATABASE_SETUP.md)."
    );
  }
  if (env.DIRECT_DATABASE_URL && !isPostgresUrl(env.DIRECT_DATABASE_URL)) {
    errors.push("DIRECT_DATABASE_URL must be a PostgreSQL URL when configured.");
  }
  if (!["staging", "production"].includes(env.DEPLOYMENT_ENV ?? "")) {
    errors.push("Hosted environments require DEPLOYMENT_ENV=staging or production.");
  }
  // The two Phase A trust secrets. Weak or placeholder values would
  // silently undermine nullifier unlinkability and DM key escrow.
  if (!isStrongSecret(env.GATE_OPERATOR_SECRET)) {
    errors.push(
      "GATE_OPERATOR_SECRET must be at least 32 characters and not a placeholder."
    );
  }
  if (!isStrongSecret(env.DM_MASTER_SECRET)) {
    errors.push(
      "DM_MASTER_SECRET must be at least 32 characters and not a placeholder."
    );
  }
  // Rate limiting (Phase 8): identifiers are HMAC-hashed before they are
  // stored, and the client address is only read behind a declared proxy.
  if (!isStrongSecret(env.RATE_LIMIT_SECRET)) {
    errors.push(
      "RATE_LIMIT_SECRET must be at least 32 characters and not a placeholder."
    );
  }
  if (env.TRUST_PROXY !== "true") {
    errors.push(
      "Hosted environments require TRUST_PROXY=true behind the deployment proxy."
    );
  }
  return errors;
}

export function requireRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): void {
  const errors = validateRuntimeConfig(env);
  if (errors.length) {
    throw new Error(`Unsafe runtime configuration:\n- ${errors.join("\n- ")}`);
  }
}
