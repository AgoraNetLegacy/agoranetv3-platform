const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://cardano-preprod.blockfrost.io https://cardano-preview.blockfrost.io https://challenges.cloudflare.com",
  "frame-src 'self' https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

// Development needs eval for Next's source maps/HMR and commonly runs over
// plain HTTP. Keep CSP and HSTS production-only so hardening cannot break the
// local workflow.
if (process.env.NODE_ENV === "production") {
  securityHeaders.push(
    { key: "Content-Security-Policy", value: contentSecurityPolicy },
    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root to this repo; a stray lockfile elsewhere on
  // the machine must never change what Next.js traces.
  outputFileTracingRoot: import.meta.dirname,
  poweredByHeader: false,
  // Profile-image uploads run through Server Actions; the default body
  // limit is 1 MB, which would reject the ratified 2 MB avatar / 5 MB
  // banner before the handler runs. 6 MB covers both with headroom;
  // lib/images.ts enforces the real per-kind limits (2026-07-22).
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
