import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Engine verification suite. Unlike `npm test` (fast, hermetic unit tests)
 * this runs the full local pipeline — real rasterisation, real OCR, real
 * healing — and writes before/after PNGs to /artifacts so the result can be
 * inspected by eye.
 *
 *   npm run verify
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    include: ["verify/**/*.test.ts"],
    testTimeout: 300_000,
    hookTimeout: 300_000,
    fileParallelism: false,
  },
});
