import { defineConfig } from '@playwright/test';
import path from 'path';

/**
 * Playwright configuration for Electron E2E testing.
 *
 * This configures Playwright to work with Electron apps built with Electron Forge + Vite.
 * Tests launch the actual Electron application and interact with it via the window.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests - Electron apps should run sequentially
  workers: 1,

  // Reporter configuration
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  // Global timeout for each test
  timeout: 60000,

  // Expect timeout
  expect: {
    timeout: 10000,
  },

  use: {
    // Trace on first retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',
  },

  // Projects - we only have one for Electron
  projects: [
    {
      name: 'electron',
      testDir: './e2e',
    },
  ],

  // Global setup to build the app before tests
  globalSetup: path.join(__dirname, 'e2e', 'global-setup.ts'),

  // Global teardown to clean up
  globalTeardown: path.join(__dirname, 'e2e', 'global-teardown.ts'),
});
