import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // Integration tests share one SQLite file per worker; keep it simple
    // and deterministic in Phase 0 by running files sequentially.
    fileParallelism: false,
  },
});
