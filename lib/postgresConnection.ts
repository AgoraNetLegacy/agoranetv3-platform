// Migrations and backups prefer the non-pooled connection when one is
// configured (DATABASE_SETUP.md: DIRECT_DATABASE_URL fronts a pooled
// production database for exactly these jobs).

export function selectPostgresConnectionUrl(
  env: Record<string, string | undefined> = process.env
): string {
  return env.DIRECT_DATABASE_URL?.trim() || env.DATABASE_URL?.trim() || "";
}
