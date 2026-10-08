import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5273',
    viewport: { width: 1440, height: 1000 },
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  webServer: [
    {
      // The UI with the Express API mounted in the Vite dev server.
      command: 'pnpm run dev',
      url: 'http://localhost:5273/api/resumes',
      // Never reuse the user's dev API, which has their real database and email credentials.
      reuseExistingServer: false,
      env: {
        CV_STUDIO_DATA_DIR: 'test-results/data',
        CV_STUDIO_WEB_PORT: '5273',
      },
    },
    {
      command: 'pnpm run preview --port 4173',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
