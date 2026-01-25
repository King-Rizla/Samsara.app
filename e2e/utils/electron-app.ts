import { _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * Electron app instance and its window page.
 */
export interface ElectronAppContext {
  app: ElectronApplication;
  page: Page;
}

/**
 * Options for launching the Electron app.
 */
export interface LaunchOptions {
  /** Additional environment variables */
  env?: Record<string, string>;
  /** Path to a custom test database */
  testDbPath?: string;
  /** Whether to enable debug mode (slower timeouts) */
  debug?: boolean;
}

/**
 * Get the path to the Electron executable for the current platform.
 */
function getElectronPath(): string {
  const projectRoot = path.resolve(__dirname, '..', '..');
  const electronPath = path.join(
    projectRoot,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'electron.cmd' : 'electron'
  );

  if (!fs.existsSync(electronPath)) {
    throw new Error(`Electron executable not found at: ${electronPath}`);
  }

  return electronPath;
}

/**
 * Get the path to the main process entry point.
 */
function getMainEntry(): string {
  const projectRoot = path.resolve(__dirname, '..', '..');
  return path.join(projectRoot, '.vite', 'build', 'index.js');
}

/**
 * Launch the Electron application for testing.
 *
 * Uses electron from node_modules with the Vite build.
 * The renderer should be served from the Vite dev server (start npm start first)
 * or use the production build.
 *
 * @param options - Launch configuration options
 * @returns The Electron app context with app and page references
 */
export async function launchElectronApp(
  options: LaunchOptions = {}
): Promise<ElectronAppContext> {
  const projectRoot = path.resolve(__dirname, '..', '..');
  const electronPath = getElectronPath();
  const mainEntry = getMainEntry();

  if (!fs.existsSync(mainEntry)) {
    throw new Error(
      `Main entry not found at ${mainEntry}.\n` +
      'Ensure the app is built. The tests expect a running Vite dev server.\n' +
      'Run `npm start` in a separate terminal before running tests.'
    );
  }

  // Set up environment for testing
  const testEnv: Record<string, string> = {
    ...process.env,
    NODE_ENV: 'test',
    ELECTRON_IS_E2E_TEST: 'true',
    // Use a test-specific user data directory to isolate test data
    ELECTRON_USER_DATA_PATH: options.testDbPath
      ? path.dirname(options.testDbPath)
      : path.join(projectRoot, 'e2e', 'fixtures', 'user-data'),
    ...(options.env || {}),
  };

  // Ensure user data directory exists
  const userDataPath = testEnv.ELECTRON_USER_DATA_PATH;
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  console.log('Launching Electron app...');
  console.log('  Electron:', electronPath);
  console.log('  Main entry:', mainEntry);
  console.log('  User data:', userDataPath);

  // Launch Electron with Playwright
  console.log('  Calling electron.launch...');
  const app = await electron.launch({
    executablePath: electronPath,
    args: [mainEntry],
    cwd: projectRoot,
    env: testEnv,
    timeout: options.debug ? 60000 : 30000,
  });
  console.log('  electron.launch completed');

  // Get the first window
  console.log('  Waiting for first window...');
  const page = await app.firstWindow();
  console.log('  Got first window');

  // Wait for the app to be ready
  console.log('  Waiting for DOM content loaded...');
  await page.waitForLoadState('domcontentloaded');
  console.log('  DOM content loaded');

  console.log('Electron app launched successfully');

  return { app, page };
}

/**
 * Close the Electron application gracefully.
 *
 * @param app - The Electron application instance
 */
export async function closeElectronApp(app: ElectronApplication): Promise<void> {
  try {
    await app.close();
    console.log('Electron app closed');
  } catch (error) {
    console.warn('Error closing Electron app:', error);
  }
}

/**
 * Wait for the app to be fully ready.
 * This waits for the main UI elements to be visible.
 *
 * @param page - The Playwright page instance
 */
export async function waitForAppReady(page: Page): Promise<void> {
  // Wait for the main header to be visible
  await page.waitForSelector('header h1:has-text("Samsara")', {
    state: 'visible',
    timeout: 30000,
  });

  // Wait for the tabs to be visible
  await page.waitForSelector('[role="tablist"]', {
    state: 'visible',
    timeout: 10000,
  });

  // Wait for the drop zone to be visible
  await page.waitForSelector('text=Drop CV files here or click to select', {
    state: 'visible',
    timeout: 10000,
  });

  console.log('App is ready');
}

/**
 * Take a screenshot for debugging purposes.
 *
 * @param page - The Playwright page instance
 * @param name - Name for the screenshot file
 */
export async function takeDebugScreenshot(
  page: Page,
  name: string
): Promise<void> {
  const screenshotDir = path.resolve(__dirname, '..', 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const screenshotPath = path.join(
    screenshotDir,
    `${name}-${Date.now()}.png`
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Screenshot saved: ${screenshotPath}`);
}
