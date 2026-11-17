import { defineConfig, devices } from "@playwright/test";
import { ROUND_TIMERS } from "./e2e/timers";

process.loadEnvFile(".env.local");

// Parallel worktrees each pick their own port so they never reuse another checkout's dev server.
const port = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  workers: 1,
  use: { baseURL },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: `${baseURL}/sign-in`,
    reuseExistingServer: true,
    env: {
      PROVIDERS: process.env.PROVIDERS ?? "fake",
      ROUND_DEADLINE_S: String(ROUND_TIMERS.deadlineS),
      RETRY_WAIT_S: String(ROUND_TIMERS.retryWaitS),
      STALE_QUEUED_S: String(ROUND_TIMERS.staleQueuedS),
    },
  },
});
