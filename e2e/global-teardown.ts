import path from 'path';
import fs from 'fs';

/**
 * Global teardown runs once after all tests complete.
 * Cleans up any test artifacts.
 */
async function globalTeardown(): Promise<void> {
  console.log('\n=== E2E Test Teardown ===\n');

  const projectRoot = path.resolve(__dirname, '..');

  // Clean up test database if it exists
  const testDbPath = path.join(projectRoot, 'e2e', 'fixtures', 'test.db');
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
      console.log('Cleaned up test database');
    } catch (error) {
      console.warn('Could not clean up test database:', error);
    }
  }

  // Clean up any temporary test files
  const tempDir = path.join(projectRoot, 'e2e', 'fixtures', 'temp');
  if (fs.existsSync(tempDir)) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('Cleaned up temporary test files');
    } catch (error) {
      console.warn('Could not clean up temp directory:', error);
    }
  }

  console.log('\n=== Teardown Complete ===\n');
}

export default globalTeardown;
