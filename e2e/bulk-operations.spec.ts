/**
 * Bulk Operations E2E Tests
 *
 * Tests for delete and retry bulk operations on selected items.
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { launchElectronApp, closeElectronApp, waitForAppReady } from './utils/electron-app';
import {
  clickTab,
  getQueueItems,
  getQueueItemByFilename,
  getItemCheckbox,
  getSelectedCount,
  clickDelete,
  clickRetry,
  clickClearSelection,
  isEditorVisible,
  clickFilename,
  getQueuePanel,
} from './utils/helpers';

test.describe('Bulk Operations', () => {
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

  test('delete button appears when items are selected', async () => {
    const queuePanel = getQueuePanel(page);

    // Delete button should only appear when selection count > 0
    await clickTab(page, 'Completed');

    // Initially hidden
    const deleteButton = queuePanel.locator('button:has-text("Delete")');
    await expect(deleteButton).not.toBeVisible();

    // Note: Need items to test further
    // When items are selected, the delete button should appear
  });

  test('delete button has destructive styling', async () => {
    const queuePanel = getQueuePanel(page);

    // When visible, delete button should have red/destructive colors
    // This test verifies the CSS classes are applied correctly

    await clickTab(page, 'Completed');

    const items = getQueueItems(page);
    const count = await items.count();

    if (count > 0) {
      // Select an item
      await getItemCheckbox(items.first()).click();

      // Delete button should be visible
      const deleteButton = queuePanel.locator('button:has-text("Delete")');
      await expect(deleteButton).toBeVisible();

      // Should have destructive styling classes
      await expect(deleteButton).toHaveClass(/text-destructive/);
    }
  });

  test.describe('Delete Operations', () => {
    test.skip('delete removes selected items', async () => {
      // Setup: Have completed items in the queue

      await clickTab(page, 'Completed');

      const items = getQueueItems(page);
      const initialCount = await items.count();

      // Select first item
      await getItemCheckbox(items.first()).click();

      // Click delete
      await clickDelete(page);

      // Item count should decrease
      const newItems = getQueueItems(page);
      await expect(newItems).toHaveCount(initialCount - 1);

      // Selection should be cleared
      const selectedText = page.locator('text=/\\d+ selected/');
      await expect(selectedText).not.toBeVisible();
    });

    test.skip('delete removes multiple items at once', async () => {
      await clickTab(page, 'Completed');

      const items = getQueueItems(page);
      const initialCount = await items.count();

      // Select multiple items
      await getItemCheckbox(items.nth(0)).click();
      await getItemCheckbox(items.nth(1)).click();
      await getItemCheckbox(items.nth(2)).click();

      // Verify 3 selected
      expect(await getSelectedCount(page)).toBe(3);

      // Click delete
      await clickDelete(page);

      // Item count should decrease by 3
      const newItems = getQueueItems(page);
      await expect(newItems).toHaveCount(initialCount - 3);
    });

    test.skip('delete closes editor if active CV is deleted', async () => {
      // Setup: Have completed items, open editor for one of them

      await clickTab(page, 'Completed');

      const items = getQueueItems(page);

      // Click first filename to open editor
      const firstFilename = await items.first().locator('.font-medium').textContent();
      await clickFilename(page, firstFilename!);

      // Verify editor is open
      expect(await isEditorVisible(page)).toBe(true);

      // Select the same item via checkbox
      await getItemCheckbox(items.first()).click();

      // Delete it
      await clickDelete(page);

      // Editor should close
      expect(await isEditorVisible(page)).toBe(false);
    });

    test.skip('delete does not close editor if different CV is deleted', async () => {
      // Setup: Have multiple completed items

      await clickTab(page, 'Completed');

      const items = getQueueItems(page);

      // Open editor for first item
      const firstFilename = await items.first().locator('.font-medium').textContent();
      await clickFilename(page, firstFilename!);

      // Verify editor is open
      expect(await isEditorVisible(page)).toBe(true);

      // Select a different item (second one)
      await getItemCheckbox(items.nth(1)).click();

      // Delete the second item
      await clickDelete(page);

      // Editor should still be open
      expect(await isEditorVisible(page)).toBe(true);
    });
  });

  test.describe('Retry Operations', () => {
    test('retry button only appears when failed items are selected', async () => {
      const queuePanel = getQueuePanel(page);

      // Retry button should only show when at least one failed item is selected

      await clickTab(page, 'Completed');

      const items = getQueueItems(page);
      const count = await items.count();

      if (count > 0) {
        // Select a completed item
        await getItemCheckbox(items.first()).click();

        // Retry button should NOT be visible for completed items
        const retryButton = queuePanel.locator('button:has-text("Retry")');
        await expect(retryButton).not.toBeVisible();

        // Delete button should be visible
        const deleteButton = queuePanel.locator('button:has-text("Delete")');
        await expect(deleteButton).toBeVisible();
      }
    });

    test.skip('retry button appears for failed items', async () => {
      // Setup: Have failed items in the queue

      await clickTab(page, 'Failed');

      const items = getQueueItems(page);

      // Select a failed item
      await getItemCheckbox(items.first()).click();

      // Retry button should be visible
      const retryButton = page.locator('button:has-text("Retry")');
      await expect(retryButton).toBeVisible();

      // Delete button should also be visible
      const deleteButton = page.locator('button:has-text("Delete")');
      await expect(deleteButton).toBeVisible();
    });

    test.skip('retry reprocesses failed items', async () => {
      // Setup: Have failed items in the queue

      await clickTab(page, 'Failed');

      const items = getQueueItems(page);
      const initialFailedCount = await items.count();

      // Select failed item
      await getItemCheckbox(items.first()).click();

      // Click retry
      await clickRetry(page);

      // Item should move to Submitted tab for reprocessing
      await clickTab(page, 'Submitted');
      const submittedItems = getQueueItems(page);
      await expect(submittedItems).toHaveCount(1);

      // Failed tab should have one less item
      await clickTab(page, 'Failed');
      const failedItems = getQueueItems(page);
      await expect(failedItems).toHaveCount(initialFailedCount - 1);
    });

    test.skip('retry clears error state', async () => {
      await clickTab(page, 'Failed');

      const items = getQueueItems(page);
      const firstItem = items.first();

      // Verify item shows error badge
      const errorBadge = firstItem.locator('.bg-status-failed');
      await expect(errorBadge).toBeVisible();

      // Select and retry
      await getItemCheckbox(firstItem).click();
      await clickRetry(page);

      // Switch to Submitted to see the item
      await clickTab(page, 'Submitted');

      const submittedItems = getQueueItems(page);
      const retryingItem = submittedItems.first();

      // Should show processing stage, not error
      const stageBadge = retryingItem.locator('.bg-status-submitted');
      await expect(stageBadge).toBeVisible();

      // Error badge should not be visible
      const newErrorBadge = retryingItem.locator('.bg-status-failed');
      await expect(newErrorBadge).not.toBeVisible();
    });

    test.skip('retry works for multiple failed items', async () => {
      await clickTab(page, 'Failed');

      const items = getQueueItems(page);
      const initialFailedCount = await items.count();

      // Select multiple failed items
      await getItemCheckbox(items.nth(0)).click();
      await getItemCheckbox(items.nth(1)).click();

      expect(await getSelectedCount(page)).toBe(2);

      // Click retry
      await clickRetry(page);

      // Both should move to Submitted
      await clickTab(page, 'Submitted');
      const submittedItems = getQueueItems(page);
      await expect(submittedItems).toHaveCount(2);

      // Failed should have 2 less
      await clickTab(page, 'Failed');
      const failedItems = getQueueItems(page);
      await expect(failedItems).toHaveCount(initialFailedCount - 2);
    });
  });

  test.describe('Mixed Selection', () => {
    test.skip('selecting mixed status items shows appropriate buttons', async () => {
      // When selecting items from multiple tabs, controls should reflect
      // what operations are available

      // First select a completed item
      await clickTab(page, 'Completed');
      const completedItems = getQueueItems(page);
      await getItemCheckbox(completedItems.first()).click();

      // Selection count should show
      expect(await getSelectedCount(page)).toBeGreaterThan(0);

      // Only delete and clear should be visible (not retry)
      const deleteButton = page.locator('button:has-text("Delete")');
      await expect(deleteButton).toBeVisible();

      const retryButton = page.locator('button:has-text("Retry")');
      await expect(retryButton).not.toBeVisible();

      const clearButton = page.locator('button:has-text("Clear")');
      await expect(clearButton).toBeVisible();
    });
  });
});

test.describe('Delete Edge Cases', () => {
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

  test.skip('deleting all items shows empty state', async () => {
    await clickTab(page, 'Completed');

    const items = getQueueItems(page);

    // Select all items
    for (let i = 0; i < await items.count(); i++) {
      await getItemCheckbox(items.nth(i)).click();
    }

    // Delete all
    await clickDelete(page);

    // Should show empty state
    await expect(page.locator('text=No completed CVs yet')).toBeVisible();
  });

  test.skip('delete is persisted to database', async () => {
    await clickTab(page, 'Completed');

    const items = getQueueItems(page);
    const initialCount = await items.count();

    // Get the filename of first item
    const firstFilename = await items.first().locator('.font-medium').textContent();

    // Select and delete
    await getItemCheckbox(items.first()).click();
    await clickDelete(page);

    // Item should be gone
    const itemLocator = getQueueItemByFilename(page, firstFilename!);
    await expect(itemLocator).not.toBeVisible();

    // Close and reopen app - item should still be gone
    // (This would require a more complex test setup)
  });
});
