/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root to this repo — a stray lockfile elsewhere on
  // the machine must never change what Next.js traces.
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
