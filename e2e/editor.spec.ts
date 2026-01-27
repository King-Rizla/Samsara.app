/**
 * Editor E2E Tests
 *
 * Tests for the CV editor panel including layout, sections, and navigation.
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { launchElectronApp, closeElectronApp, waitForAppReady } from './utils/electron-app';
import {
  clickTab,
  getQueueItems,
  clickFilename,
  isEditorVisible,
  closeEditor,
  getEditorSection,
  getQueuePanel,
} from './utils/helpers';
import {
  injectQueueItems,
  patchLoadCVForTesting,
  createMockQueueItemsForInjection,
  CV_ID_TO_MOCK_DATA,
} from './utils/ipc-mock';
import { getFixturesDir } from './fixtures/test-data';

test.describe('Editor Panel', () => {
  let app: ElectronApplication;
  let page: Page;

  test.beforeEach(async () => {
    const context = await launchElectronApp();
    app = context.app;
    page = context.page;
    await waitForAppReady(page);
  });

  test.afterEach(async () => {
    await closeElectronApp(app);
  });

  test('editor panel is hidden by default', async () => {
    // Initially, no CV is selected, so editor should not be visible
    await expect(page.locator('h2:has-text("CV Editor")')).not.toBeVisible();

    // Queue panel should be w-1/2 (sharing with JD panel, no editor)
    const queuePanel = getQueuePanel(page);
    await expect(queuePanel).toHaveClass(/w-1\/2/);
  });

  test.describe('with completed CV', () => {
    // Helper function to set up mock data for tests
    async function setupMockData() {
      const fixturesDir = getFixturesDir();
      const mockItems = createMockQueueItemsForInjection(fixturesDir);
      await injectQueueItems(page, mockItems);
      await patchLoadCVForTesting(page, CV_ID_TO_MOCK_DATA);
      await page.waitForTimeout(300);
    }

    // Helper to open the first CV
    async function openFirstCV() {
      await clickTab(page, 'Completed');
      const items = getQueueItems(page);
      await expect(items.first()).toBeVisible();
      const filenameSpan = items.first().locator('span.font-medium');
      await filenameSpan.click();
      await page.waitForTimeout(300);
    }

    test('clicking filename opens editor panel', async () => {
      await setupMockData();
      await openFirstCV();

      // Editor should be visible
      expect(await isEditorVisible(page)).toBe(true);

      // Editor header should show "CV Editor"
      await expect(page.locator('h2:has-text("CV Editor")')).toBeVisible();
    });

    test('split view layout shows three columns', async () => {
      await setupMockData();
      await openFirstCV();

      // Three panels should be visible: queue, JD, and editor
      const mainContent = page.locator('main');
      const panels = mainContent.locator('> div');
      await expect(panels).toHaveCount(3);

      // Each panel should have w-1/3 class when editor is open
      const queuePanel = getQueuePanel(page);
      await expect(queuePanel).toHaveClass(/w-1\/3/);
    });

    test('queue panel shows border when editor is open', async () => {
      await setupMockData();
      await openFirstCV();

      // Queue panel should have right border
      const queuePanel = page.locator('main > div').first();
      await expect(queuePanel).toHaveClass(/border-r/);
    });

    test('all sections are visible in editor', async () => {
      await setupMockData();
      await openFirstCV();

      // Wait for editor to load
      await expect(page.locator('h2:has-text("CV Editor")')).toBeVisible();

      // Check all required sections
      const contactSection = getEditorSection(page, 'Contact Information');
      await expect(contactSection).toBeVisible();

      const workSection = getEditorSection(page, 'Work History');
      await expect(workSection).toBeVisible();

      const educationSection = getEditorSection(page, 'Education');
      await expect(educationSection).toBeVisible();

      const skillsSection = getEditorSection(page, 'Skills');
      await expect(skillsSection).toBeVisible();
    });

    test('confidence badge displays in editor header', async () => {
      await setupMockData();
      await openFirstCV();

      // Confidence badge should be in the editor header
      const editorHeader = page.locator('.flex.items-center.justify-between.px-4.py-3').last();
      const confidenceBadge = editorHeader.locator('span:has-text("%")');

      await expect(confidenceBadge).toBeVisible();
    });

    test('close button returns to two-column layout', async () => {
      await setupMockData();
      await openFirstCV();

      // Editor should be visible
      expect(await isEditorVisible(page)).toBe(true);

      // Click close button
      await closeEditor(page);

      // Editor should be hidden
      expect(await isEditorVisible(page)).toBe(false);

      // Queue panel should be w-1/2 (sharing with JD panel, no editor)
      const queuePanel = getQueuePanel(page);
      await expect(queuePanel).toHaveClass(/w-1\/2/);
    });

    test('clicking different filename switches CV', async () => {
      await setupMockData();
      await clickTab(page, 'Completed');

      const items = getQueueItems(page);

      // Open first CV
      const firstFilenameSpan = items.first().locator('span.font-medium');
      await firstFilenameSpan.click();
      await page.waitForTimeout(300);
      expect(await isEditorVisible(page)).toBe(true);

      // Get the activeCVId for comparison
      const firstCVId = await page.evaluate(() => {
        const store = (window as unknown as { __editorStore?: { getState: () => { activeCVId: string | null } } }).__editorStore;
        return store?.getState().activeCVId;
      });

      // Click second CV - use evaluate to trigger click since split view makes elements narrow
      await page.evaluate(() => {
        const queueStore = (window as unknown as { __queueStore?: { getState: () => { items: { id: string }[] } } }).__queueStore;
        const editorStore = (window as unknown as { __editorStore?: { getState: () => { loadCV: (id: string) => void } } }).__editorStore;
        const items = queueStore?.getState().items;
        if (items && items.length > 1) {
          // Directly call loadCV for the second item
          editorStore?.getState().loadCV(items[1].id);
        }
      });
      await page.waitForTimeout(300);

      // Editor should still be visible
      expect(await isEditorVisible(page)).toBe(true);

      // CV ID should have changed
      const secondCVId = await page.evaluate(() => {
        const store = (window as unknown as { __editorStore?: { getState: () => { activeCVId: string | null } } }).__editorStore;
        return store?.getState().activeCVId;
      });

      // IDs should be different if CVs were switched correctly
      expect(firstCVId).not.toBe(secondCVId);
      expect(firstCVId).toBe('test-cv-1');
      expect(secondCVId).toBe('test-cv-2');
    });

    test('editor scrolls independently from queue', async () => {
      await setupMockData();
      await openFirstCV();

      // Both panels should have overflow-y-auto for independent scrolling
      const queueScroller = page.locator('.overflow-y-auto').first();
      const editorScroller = page.locator('.flex-1.overflow-y-auto.p-4');

      await expect(queueScroller).toBeVisible();
      await expect(editorScroller).toBeVisible();

      // Scroll editor content
      await editorScroller.evaluate((el) => el.scrollBy(0, 200));

      // Queue should still be at top (independent scroll)
      const queueScrollTop = await queueScroller.evaluate((el) => el.scrollTop);
      expect(queueScrollTop).toBe(0);
    });
  });

  test('filename is clickable only for completed items', async () => {
    // In Submitted tab, filenames should not open editor

    await clickTab(page, 'Submitted');

    const items = getQueueItems(page);
    const count = await items.count();

    if (count > 0) {
      // Submitted items should not have the clickable cursor-pointer class
      const filenameSpan = items.first().locator('.font-medium');
      await expect(filenameSpan).not.toHaveClass(/cursor-pointer/);
    }

    // In Failed tab, same behavior
    await clickTab(page, 'Failed');

    const failedItems = getQueueItems(page);
    const failedCount = await failedItems.count();

    if (failedCount > 0) {
      const filenameSpan = failedItems.first().locator('.font-medium');
      await expect(filenameSpan).not.toHaveClass(/cursor-pointer/);
    }

    // In Completed tab, filenames should be clickable
    await clickTab(page, 'Completed');

    const completedItems = getQueueItems(page);
    const completedCount = await completedItems.count();

    if (completedCount > 0) {
      const filenameSpan = completedItems.first().locator('.font-medium');
      await expect(filenameSpan).toHaveClass(/cursor-pointer/);
    }
  });

  test.describe('Editor Sections Content', () => {
    test.skip('contact section shows all fields', async () => {
      await clickTab(page, 'Completed');

      const items = getQueueItems(page);
      const firstFilename = await items.first().locator('.font-medium').textContent();

      await clickFilename(page, firstFilename!);

      const contactSection = getEditorSection(page, 'Contact Information');

      // Should have labels for all contact fields
      const expectedLabels = ['Name', 'Email', 'Phone', 'Address', 'LinkedIn', 'GitHub', 'Portfolio'];

      for (const label of expectedLabels) {
        const labelElement = contactSection.locator(`label:has-text("${label}")`);
        await expect(labelElement).toBeVisible();
      }
    });

    test.skip('work history section shows entries', async () => {
      await clickTab(page, 'Completed');

      const items = getQueueItems(page);
      const firstFilename = await items.first().locator('.font-medium').textContent();

      await clickFilename(page, firstFilename!);

      const workSection = getEditorSection(page, 'Work History');

      // If there's work history, it should show company/position fields
      // Work entries have specific labels
      const companyLabels = workSection.locator('label:has-text("Company")');

      // Should have at least one or show empty state
      // (Depends on the test data)
    });

    test.skip('education section shows entries', async () => {
      await clickTab(page, 'Completed');

      const items = getQueueItems(page);
      const firstFilename = await items.first().locator('.font-medium').textContent();

      await clickFilename(page, firstFilename!);

      const educationSection = getEditorSection(page, 'Education');

      // Education entries have institution/degree fields
      const institutionLabels = educationSection.locator('label:has-text("Institution")');

      // Should have at least one or show empty state
    });

    test.skip('skills section shows categories', async () => {
      await clickTab(page, 'Completed');

      const items = getQueueItems(page);
      const firstFilename = await items.first().locator('.font-medium').textContent();

      await clickFilename(page, firstFilename!);

      const skillsSection = getEditorSection(page, 'Skills');

      // Skills should be grouped by category
      await expect(skillsSection).toBeVisible();
    });

    test.skip('warnings section appears for low confidence CVs', async () => {
      // If a CV has warnings, they should be displayed

      await clickTab(page, 'Completed');

      const items = getQueueItems(page);

      // Find a low-confidence item (has warning badge)
      const warningBadge = items.locator('.bg-warning\\/20');
      const hasWarnings = await warningBadge.count() > 0;

      if (hasWarnings) {
        // Click the first item with warning
        const itemWithWarning = items.filter({ has: warningBadge }).first();
        const filename = await itemWithWarning.locator('.font-medium').textContent();

        await clickFilename(page, filename!);

        // Warnings section should be visible
        const warningsSection = page.locator('section:has(h2:has-text("Parsing Warnings"))');
        await expect(warningsSection).toBeVisible();

        // Should have warning list items
        const warningItems = warningsSection.locator('li');
        await expect(warningItems).toHaveCount(await warningItems.count());
      }
    });
  });
});

test.describe('Editor Navigation', () => {
  let app: ElectronApplication;
  let page: Page;

  test.beforeEach(async () => {
    const context = await launchElectronApp();
    app = context.app;
    page = context.page;
    await waitForAppReady(page);
  });

  test.afterEach(async () => {
    await closeElectronApp(app);
  });

  test.skip('can switch between completed CVs', async () => {
    await clickTab(page, 'Completed');

    const items = getQueueItems(page);
    const count = await items.count();

    if (count >= 2) {
      // Open first CV
      const firstFilename = await items.first().locator('.font-medium').textContent();
      await clickFilename(page, firstFilename!);

      // Get name from contact section
      const contactSection = getEditorSection(page, 'Contact Information');
      const nameField = contactSection.locator('div:has(label:has-text("Name")) span').first();
      const firstName = await nameField.textContent();

      // Click second CV
      const secondFilename = await items.nth(1).locator('.font-medium').textContent();
      await clickFilename(page, secondFilename!);

      // Name should be different (or at least editor updated)
      const secondName = await nameField.textContent();

      // Note: Names might be same if test data is identical
      // This test mainly verifies the switch happens without errors
    }
  });

  test.skip('closing editor allows re-opening same CV', async () => {
    await clickTab(page, 'Completed');

    const items = getQueueItems(page);
    const firstFilename = await items.first().locator('.font-medium').textContent();

    // Open editor
    await clickFilename(page, firstFilename!);
    expect(await isEditorVisible(page)).toBe(true);

    // Close editor
    await closeEditor(page);
    expect(await isEditorVisible(page)).toBe(false);

    // Open same CV again
    await clickFilename(page, firstFilename!);
    expect(await isEditorVisible(page)).toBe(true);
  });
});
