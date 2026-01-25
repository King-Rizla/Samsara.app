import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Global setup runs once before all tests.
 * Builds the Electron app for testing.
 */
async function globalSetup(): Promise<void> {
  console.log('\n=== E2E Test Setup ===\n');

  // Ensure we're in the project root
  const projectRoot = path.resolve(__dirname, '..');
  process.chdir(projectRoot);

  const viteDir = path.join(projectRoot, '.vite');
  const mainJs = path.join(viteDir, 'build', 'index.js');
  const rendererDir = path.join(viteDir, 'renderer', 'main_window');

  // Check if we need to build
  const needsBuild = !fs.existsSync(mainJs) || !fs.existsSync(rendererDir);

  if (needsBuild) {
    console.log('Building app for E2E tests...\n');

    // Build main and preload
    console.log('1. Building main process...');
    execSync('npx vite build --config vite.main.config.ts', {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    console.log('2. Building preload...');
    execSync('npx vite build --config vite.preload.config.ts', {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    // Build renderer
    console.log('3. Building renderer...');
    execSync('npx vite build --config vite.renderer.config.ts', {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    // Copy renderer to expected location (main_window subfolder)
    console.log('4. Setting up renderer path...');
    const rendererSrc = path.join(viteDir, 'renderer');
    const rendererDest = path.join(rendererSrc, 'main_window');

    if (!fs.existsSync(rendererDest)) {
      fs.mkdirSync(rendererDest, { recursive: true });
    }

    // Copy index.html and assets
    const indexHtml = path.join(rendererSrc, 'index.html');
    const assetsDir = path.join(rendererSrc, 'assets');

    if (fs.existsSync(indexHtml)) {
      fs.copyFileSync(indexHtml, path.join(rendererDest, 'index.html'));
    }

    if (fs.existsSync(assetsDir)) {
      const destAssetsDir = path.join(rendererDest, 'assets');
      if (!fs.existsSync(destAssetsDir)) {
        fs.mkdirSync(destAssetsDir, { recursive: true });
      }
      // Copy all files in assets
      for (const file of fs.readdirSync(assetsDir)) {
        fs.copyFileSync(
          path.join(assetsDir, file),
          path.join(destAssetsDir, file)
        );
      }
    }

    console.log('\nBuild complete.');
  } else {
    console.log('Using existing build in .vite/');
  }

  // Clean up test user data from previous runs
  const testUserDataDir = path.join(projectRoot, 'e2e', 'fixtures', 'user-data');
  if (fs.existsSync(testUserDataDir)) {
    fs.rmSync(testUserDataDir, { recursive: true, force: true });
    console.log('Cleaned up previous test user data');
  }

  // Ensure fixtures directory exists
  const fixturesDir = path.join(projectRoot, 'e2e', 'fixtures');
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
    console.log('Created fixtures directory');
  }

  console.log('\n=== Setup Complete ===\n');
}

export default globalSetup;
