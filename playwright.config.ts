import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : {
        command: process.platform === "win32" ? "pnpm.cmd dev" : "pnpm dev",
        url: "http://localhost:3000/login",
        reuseExistingServer: true,
      },
  reporter: "list",
});
