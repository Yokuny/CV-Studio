import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5273',
    viewport: { width: 1440, height: 1000 },
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  webServer: [
    {
      // The UI and the Express API; the URL answers through the Vite proxy only when both are up.
      command: 'pnpm run dev',
      url: 'http://127.0.0.1:5273/api/resumes',
      // Never reuse the user's dev API, which has their real database and email credentials.
      reuseExistingServer: false,
      env: {
        CV_STUDIO_DATA_DIR: 'test-results/data',
        CV_STUDIO_API_PORT: '5274',
        CV_STUDIO_WEB_PORT: '5273',
        CV_STUDIO_WEB_ORIGIN: 'http://127.0.0.1:5273',
      },
    },
    {
      command: 'pnpm run preview --port 4173',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
