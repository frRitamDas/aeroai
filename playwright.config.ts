import { defineConfig, devices } from "@playwright/test";

/**
 * Browser end-to-end suite. Playwright browsers are not installed by default
 * (`npx playwright install chromium`), so this config is intentionally separate
 * from `npm test` — run it with `npm run e2e` once the browsers are present.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    video: "off",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --port 3100",
        url: "http://127.0.0.1:3100",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
