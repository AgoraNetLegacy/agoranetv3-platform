import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Integration tests share one SQLite file per worker; keep it simple
    // and deterministic in Phase 0 by running files sequentially.
    fileParallelism: false,
  },
});
