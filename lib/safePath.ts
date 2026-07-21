/**
 * Open-redirect guard (CWE-601): only same-origin relative paths are safe as
 * redirect or link targets. Rejects absolute URLs, protocol-relative
 * "//host", and "/\host" tricks that browsers normalize to off-origin.
 *
 * Pure and server-safe — deliberately NOT in a "use server" module, so it can
 * be imported anywhere (Server Actions, Server Components, unit tests). A
 * "use server" file may only export async functions; a sync export there
 * breaks the production build, which is why this lives on its own.
 */
export function safePath(candidate: string, fallback: string): string {
  return candidate.startsWith("/") &&
    !candidate.startsWith("//") &&
    !candidate.startsWith("/\\")
    ? candidate
    : fallback;
}
