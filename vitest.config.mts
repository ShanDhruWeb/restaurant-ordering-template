import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@config": path.resolve(import.meta.dirname, "restaurant.config.ts"),
      // server-only throws outside the React server runtime; tests run in plain Node.
      "server-only": path.resolve(import.meta.dirname, "tests/empty-module.ts"),
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    globalSetup: ["tests/globalSetup.ts"],
    // Integration tests share one database, so test files run one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
