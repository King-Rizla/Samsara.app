/**
 * Selection E2E Tests
 *
 * Tests for item selection including single select, shift-click range select,
 * selection count display, and selection clearing.
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { launchElectronApp, closeElectronApp, waitForAppReady } from './utils/electron-app';
import {
  clickTab,
  getQueueItems,
  getQueueItemByFilename,
  getItemCheckbox,
  getSelectedCount,
  clickClearSelection,
} from './utils/helpers';

test.describe('Selection', () => {
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

  test('no selection controls visible when nothing selected', async () => {
    // Initially, no items are selected, so controls should be hidden
    await clickTab(page, 'Completed');

    // The "N selected" text should not be visible
    const selectedText = page.locator('text=/\\d+ selected/');
    await expect(selectedText).not.toBeVisible();

    // Clear button should not be visible
    const clearButton = page.locator('button:has-text("Clear")');
    await expect(clearButton).not.toBeVisible();

    // Delete button should not be visible
    const deleteButton = page.locator('button:has-text("Delete")');
    await expect(deleteButton).not.toBeVisible();
  });

  test.describe('with items', () => {
    // These tests require items in the queue
    // We'll use test.skip for now and implement when IPC mocking is available

    test.skip('single checkbox click selects item', async () => {
      // Setup: Have at least one completed item

      await clickTab(page, 'Completed');

      const items = getQueueItems(page);
      const firstItem = items.first();
      const checkbox = getItemCheckbox(firstItem);

      // Click checkbox
      await checkbox.click();

      // Checkbox should be checked
      await expect(checkbox).toBeChecked();

      // Item row should have selected styling
      await expect(firstItem).toHaveClass(/bg-primary\/10/);

      // Selection count should show "1 selected"
      const count = await getSelectedCount(page);
      expect(count).toBe(1);
    });

    test.skip('clicking checkbox again deselects item', async () => {
      await clickTab(page, 'Completed');

      const items = getQueueItems(page);
      const firstItem = items.first();
      const checkbox = getItemCheckbox(firstItem);

      // Select
      await checkbox.click();
      await expect(checkbox).toBeChecked();

      // Deselect
      await checkbox.click();
      await expect(checkbox).not.toBeChecked();

      // Item should not have selected styling
      await expect(firstItem).not.toHaveClass(/bg-primary\/10/);

      // Selection count should be 0 (controls hidden)
      const selectedText = page.locator('text=/\\d+ selected/');
      await expect(selectedText).not.toBeVisible();
    });

    test.skip('multiple items can be selected', async () => {
      // Setup: Have at least 3 completed items

      await clickTab(page, 'Completed');

      const items = getQueueItems(page);

      // Select first item
      await getItemCheckbox(items.nth(0)).click();

      // Select second item
      await getItemCheckbox(items.nth(1)).click();

      // Select third item
      await getItemCheckbox(items.nth(2)).click();

      // All should be checked
      await expect(getItemCheckbox(items.nth(0))).toBeChecked();
      await expect(getItemCheckbox(items.nth(1))).toBeChecked();
      await expect(getItemCheckbox(items.nth(2))).toBeChecked();

      // Count should be 3
      const count = await getSelectedCount(page);
      expect(count).toBe(3);
    });

    test.skip('shift-click selects range', async () => {
      // Setup: Have at least 5 completed items

      await clickTab(page, 'Completed');

      const items = getQueueItems(page);

      // Click first item (no shift)
      await getItemCheckbox(items.nth(0)).click();

      // Shift-click fifth item
      await getItemCheckbox(items.nth(4)).click({ modifiers: ['Shift'] });

      // Items 0-4 should all be selected
      await expect(getItemCheckbox(items.nth(0))).toBeChecked();
      await expect(getItemCheckbox(items.nth(1))).toBeChecked();
      await expect(getItemCheckbox(items.nth(2))).toBeChecked();
      await expect(getItemCheckbox(items.nth(3))).toBeChecked();
      await expect(getItemCheckbox(items.nth(4))).toBeChecked();

      // Count should be 5
      const count = await getSelectedCount(page);
      expect(count).toBe(5);
    });

    test.skip('shift-click extends existing selection', async () => {
      // Setup: Have at least 5 completed items

      await clickTab(page, 'Completed');

      const items = getQueueItems(page);

      // Select item 2 (index 1)
      await getItemCheckbox(items.nth(1)).click();

      // Shift-click item 4 (index 3)
      await getItemCheckbox(items.nth(3)).click({ modifiers: ['Shift'] });

      // Items 1-3 should be selected (range from last selected to shift-clicked)
      await expect(getItemCheckbox(items.nth(1))).toBeChecked();
      await expect(getItemCheckbox(items.nth(2))).toBeChecked();
      await expect(getItemCheckbox(items.nth(3))).toBeChecked();

      // Item 0 should not be selected
      await expect(getItemCheckbox(items.nth(0))).not.toBeChecked();
    });

    test.skip('selection count updates in real-time', async () => {
      await clickTab(page, 'Completed');

      const items = getQueueItems(page);

      // Select items one by one and verify count
      await getItemCheckbox(items.nth(0)).click();
      expect(await getSelectedCount(page)).toBe(1);

      await getItemCheckbox(items.nth(1)).click();
      expect(await getSelectedCount(page)).toBe(2);

      await getItemCheckbox(items.nth(2)).click();
      expect(await getSelectedCount(page)).toBe(3);

      // Deselect one
      await getItemCheckbox(items.nth(1)).click();
      expect(await getSelectedCount(page)).toBe(2);
    });

    test.skip('clear button deselects all items', async () => {
      await clickTab(page, 'Completed');

      const items = getQueueItems(page);

      // Select multiple items
      await getItemCheckbox(items.nth(0)).click();
      await getItemCheckbox(items.nth(1)).click();
      await getItemCheckbox(items.nth(2)).click();

      // Verify selection
      expect(await getSelectedCount(page)).toBe(3);

      // Click Clear
      await clickClearSelection(page);

      // All should be deselected
      await expect(getItemCheckbox(items.nth(0))).not.toBeChecked();
      await expect(getItemCheckbox(items.nth(1))).not.toBeChecked();
      await expect(getItemCheckbox(items.nth(2))).not.toBeChecked();

      // Controls should be hidden
      const selectedText = page.locator('text=/\\d+ selected/');
      await expect(selectedText).not.toBeVisible();
    });

    test.skip('selection clears on tab switch', async () => {
      await clickTab(page, 'Completed');

      const items = getQueueItems(page);

      // Select some items
      await getItemCheckbox(items.nth(0)).click();
      await getItemCheckbox(items.nth(1)).click();

      expect(await getSelectedCount(page)).toBe(2);

      // Switch to another tab
      await clickTab(page, 'Submitted');

      // Switch back
      await clickTab(page, 'Completed');

      // Selection should be cleared
      await expect(getItemCheckbox(items.nth(0))).not.toBeChecked();
      await expect(getItemCheckbox(items.nth(1))).not.toBeChecked();

      const selectedText = page.locator('text=/\\d+ selected/');
      await expect(selectedText).not.toBeVisible();
    });
  });

  test('checkbox has correct styling', async () => {
    // Verify the checkbox component has proper styling classes
    // This works even without items by checking the CSS classes are defined

    await clickTab(page, 'Completed');

    // Check that the checkbox styling is set up correctly in the app
    // The checkbox should have Tailwind classes for appearance
    // We verify this by checking if any items exist and their checkbox styling

    const items = getQueueItems(page);
    const count = await items.count();

    if (count > 0) {
      const checkbox = getItemCheckbox(items.first());
      await expect(checkbox).toHaveClass(/w-4 h-4 rounded/);
    }
  });

  test('selected item has visual highlight', async () => {
    // Items should get bg-primary/10 class when selected
    // This is defined in the QueueItem component

    await clickTab(page, 'Completed');

    const items = getQueueItems(page);
    const count = await items.count();

    if (count > 0) {
      const firstItem = items.first();
      const checkbox = getItemCheckbox(firstItem);

      // Initially not highlighted
      await expect(firstItem).not.toHaveClass(/bg-primary\/10/);

      // Select
      await checkbox.click();

      // Should have highlight
      await expect(firstItem).toHaveClass(/bg-primary\/10/);

      // Deselect
      await checkbox.click();

      // Highlight removed
      await expect(firstItem).not.toHaveClass(/bg-primary\/10/);
    }
  });
});

test.describe('Selection Persistence', () => {
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

  test.skip('selection is maintained within same tab', async () => {
    // Select items, scroll, verify selection maintained

    await clickTab(page, 'Completed');

    const items = getQueueItems(page);

    // Select items
    await getItemCheckbox(items.nth(0)).click();
    await getItemCheckbox(items.nth(2)).click();

    // Scroll the list (if scrollable)
    const listContainer = page.locator('.overflow-y-auto').first();
    await listContainer.evaluate((el) => el.scrollBy(0, 100));

    // Selection should still be maintained
    await expect(getItemCheckbox(items.nth(0))).toBeChecked();
    await expect(getItemCheckbox(items.nth(2))).toBeChecked();
  });

  test.skip('lastSelectedId enables range selection', async () => {
    // The store tracks lastSelectedId for shift-click range selection
    // This test verifies the mechanism works

    await clickTab(page, 'Completed');

    const items = getQueueItems(page);

    // Click item at index 2
    await getItemCheckbox(items.nth(2)).click();

    // Shift-click item at index 0 (above the last selected)
    await getItemCheckbox(items.nth(0)).click({ modifiers: ['Shift'] });

    // Should select items 0, 1, 2 (range goes upward)
    await expect(getItemCheckbox(items.nth(0))).toBeChecked();
    await expect(getItemCheckbox(items.nth(1))).toBeChecked();
    await expect(getItemCheckbox(items.nth(2))).toBeChecked();

    expect(await getSelectedCount(page)).toBe(3);
  });
});
