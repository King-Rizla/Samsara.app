/**
 * Queue E2E Tests
 *
 * Tests for the queue UI including tabs, empty states, and basic navigation.
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { launchElectronApp, closeElectronApp, waitForAppReady } from './utils/electron-app';
import { clickTab, getTabCount, getQueueItems, getQueuePanel, getDropZone } from './utils/helpers';

test.describe('Queue UI', () => {
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

  test('app launches and shows queue UI', async () => {
    // Verify the app header is visible
    await expect(page.locator('header h1')).toHaveText('Samsara');

    // Verify the main layout is present
    await expect(page.locator('main')).toBeVisible();

    // Verify the tab list is visible in the queue panel
    const queuePanel = getQueuePanel(page);
    await expect(queuePanel.locator('[role="tablist"]')).toBeVisible();
  });

  test('three tabs are visible with correct initial state', async () => {
    // Get all tab triggers in the queue panel
    const queuePanel = getQueuePanel(page);
    const tabs = queuePanel.locator('[role="tab"]');
    await expect(tabs).toHaveCount(3);

    // Verify tab names and initial counts
    // Completed tab should be active by default
    const completedTab = queuePanel.locator('[role="tab"]:has-text("Completed")');
    await expect(completedTab).toBeVisible();
    await expect(completedTab).toHaveAttribute('data-state', 'active');

    // Submitted tab
    const submittedTab = queuePanel.locator('[role="tab"]:has-text("Submitted")');
    await expect(submittedTab).toBeVisible();
    await expect(submittedTab).toHaveAttribute('data-state', 'inactive');

    // Failed tab
    const failedTab = queuePanel.locator('[role="tab"]:has-text("Failed")');
    await expect(failedTab).toBeVisible();
    await expect(failedTab).toHaveAttribute('data-state', 'inactive');

    // Verify counts are shown (initially 0)
    const completedCount = await getTabCount(page, 'Completed');
    expect(completedCount).toBe(0);

    const submittedCount = await getTabCount(page, 'Submitted');
    expect(submittedCount).toBe(0);

    const failedCount = await getTabCount(page, 'Failed');
    expect(failedCount).toBe(0);
  });

  test('tab switching works', async () => {
    const queuePanel = getQueuePanel(page);

    // Switch to Submitted tab
    await clickTab(page, 'Submitted');

    const submittedTab = queuePanel.locator('[role="tab"]:has-text("Submitted")');
    await expect(submittedTab).toHaveAttribute('data-state', 'active');

    // Completed should now be inactive
    const completedTab = queuePanel.locator('[role="tab"]:has-text("Completed")');
    await expect(completedTab).toHaveAttribute('data-state', 'inactive');

    // Switch to Failed tab
    await clickTab(page, 'Failed');

    const failedTab = queuePanel.locator('[role="tab"]:has-text("Failed")');
    await expect(failedTab).toHaveAttribute('data-state', 'active');

    // Submitted should now be inactive
    await expect(submittedTab).toHaveAttribute('data-state', 'inactive');

    // Switch back to Completed
    await clickTab(page, 'Completed');
    await expect(completedTab).toHaveAttribute('data-state', 'active');
  });

  test('empty states display correctly', async () => {
    const queuePanel = getQueuePanel(page);

    // Completed tab empty state
    await clickTab(page, 'Completed');
    await expect(queuePanel.locator('text=No completed CVs yet')).toBeVisible();

    // Submitted tab empty state
    await clickTab(page, 'Submitted');
    await expect(queuePanel.locator('text=No CVs processing')).toBeVisible();

    // Failed tab empty state
    await clickTab(page, 'Failed');
    await expect(queuePanel.locator('text=No failed CVs')).toBeVisible();
  });

  test('drop zone is visible and shows correct text', async () => {
    // Drop zone should always be visible at the bottom
    const dropZone = getDropZone(page);
    await expect(dropZone).toBeVisible();

    // Drop zone should contain the text and plus icon
    await expect(dropZone.locator('text=Drop CV files here or click to select')).toBeVisible();
    await expect(dropZone.locator('text=+')).toBeVisible();
  });

  test('drop zone has hover styling', async () => {
    const dropZone = getDropZone(page);

    // Hover over drop zone
    await dropZone.hover();

    // Drop zone should have cursor-pointer class
    await expect(dropZone).toHaveClass(/cursor-pointer/);
  });

  test('tab panels have correct aria attributes', async () => {
    const queuePanel = getQueuePanel(page);

    // Each tab panel should have proper accessibility attributes
    // Note: Radix only renders the active panel by default with forceMount=false
    const activePanel = queuePanel.locator('[role="tabpanel"][data-state="active"]');
    await expect(activePanel).toBeVisible();

    // The active panel should be associated with the active tab
    const activeTabId = await queuePanel.locator('[role="tab"][data-state="active"]').getAttribute('id');
    const panelAriaLabelledBy = await activePanel.getAttribute('aria-labelledby');
    expect(panelAriaLabelledBy).toBe(activeTabId);
  });

  test('app header shows correct branding', async () => {
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Samsara title
    const title = header.locator('h1');
    await expect(title).toHaveText('Samsara');
    await expect(title).toHaveClass(/text-primary/);

    // Header should have border at bottom
    await expect(header).toHaveClass(/border-b/);
  });

  test('main layout takes full height', async () => {
    // The main container should use flex to fill available space
    const mainContainer = page.locator('.h-screen.flex.flex-col');
    await expect(mainContainer).toBeVisible();

    // Main content area should be flex-1
    const main = page.locator('main.flex-1');
    await expect(main).toBeVisible();
  });
});
