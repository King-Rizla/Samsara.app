/**
 * JD Matching E2E Tests
 *
 * Tests for Phase 4 JD Matching functionality:
 * - JD input and parsing
 * - JD list and selection
 * - CV-to-JD matching
 * - Ranked results display
 * - Match quality indicators
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { launchElectronApp, closeElectronApp, waitForAppReady } from './utils/electron-app';
import {
  clickTab,
  clickJDTab,
  getQueuePanel,
  getJDPanel,
  getJDInputTextarea,
  getJDSubmitButton,
  getJDItems,
  getJDItemByTitle,
  clickJDItem,
  getMatchResultItems,
  getMatchAllButton,
  getMatchSelectedButton,
  getMatchScore,
  getMatchQualityBadge,
  getQueueItems,
  getItemCheckbox,
} from './utils/helpers';
import {
  injectQueueItems,
  patchLoadCVForTesting,
  createMockQueueItemsForInjection,
  CV_ID_TO_MOCK_DATA,
  injectJDItems,
  patchSelectJDForTesting,
  patchMatchCVsForTesting,
  createMockJDSummaries,
  JD_ID_TO_MOCK_DATA,
  MOCK_MATCH_RESULTS_FULLSTACK,
} from './utils/ipc-mock';
import { getFixturesDir } from './fixtures/test-data';

test.describe('JD Panel UI', () => {
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

  test('JD panel is visible with three tabs', async () => {
    const jdPanel = getJDPanel(page);
    await expect(jdPanel).toBeVisible();

    // Check all three tabs exist
    const tabs = jdPanel.locator('[role="tab"]');
    await expect(tabs).toHaveCount(3);

    // Verify tab names
    await expect(jdPanel.locator('[role="tab"]:has-text("Job Descriptions")')).toBeVisible();
    await expect(jdPanel.locator('[role="tab"]:has-text("Add JD")')).toBeVisible();
    await expect(jdPanel.locator('[role="tab"]:has-text("Match Results")')).toBeVisible();
  });

  test('Job Descriptions tab is active by default', async () => {
    const jdPanel = getJDPanel(page);
    const jdsTab = jdPanel.locator('[role="tab"]:has-text("Job Descriptions")');
    await expect(jdsTab).toHaveAttribute('data-state', 'active');
  });

  test('empty state shows when no JDs exist', async () => {
    const jdPanel = getJDPanel(page);
    await expect(jdPanel.locator('text=No job descriptions yet')).toBeVisible();
  });

  test('Match Results tab is disabled when no JD is selected', async () => {
    const jdPanel = getJDPanel(page);
    const resultsTab = jdPanel.locator('[role="tab"]:has-text("Match Results")');
    await expect(resultsTab).toBeDisabled();
  });

  test('tab switching works in JD panel', async () => {
    const jdPanel = getJDPanel(page);

    // Switch to Add JD tab
    await clickJDTab(page, 'Add JD');
    const addTab = jdPanel.locator('[role="tab"]:has-text("Add JD")');
    await expect(addTab).toHaveAttribute('data-state', 'active');

    // Verify Job Descriptions tab is now inactive
    const jdsTab = jdPanel.locator('[role="tab"]:has-text("Job Descriptions")');
    await expect(jdsTab).toHaveAttribute('data-state', 'inactive');

    // Switch back to Job Descriptions
    await clickJDTab(page, 'Job Descriptions');
    await expect(jdsTab).toHaveAttribute('data-state', 'active');
  });
});

test.describe('JD Input', () => {
  let app: ElectronApplication;
  let page: Page;

  test.beforeEach(async () => {
    const context = await launchElectronApp();
    app = context.app;
    page = context.page;
    await waitForAppReady(page);
    await clickJDTab(page, 'Add JD');
  });

  test.afterEach(async () => {
    await closeElectronApp(app);
  });

  test('Add JD tab shows input form', async () => {
    const textarea = getJDInputTextarea(page);
    await expect(textarea).toBeVisible();

    const submitButton = getJDSubmitButton(page);
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toHaveText('Extract Requirements');
  });

  test('submit button is disabled when textarea is empty', async () => {
    const submitButton = getJDSubmitButton(page);
    await expect(submitButton).toBeDisabled();
  });

  test('typing in textarea enables submit button', async () => {
    const textarea = getJDInputTextarea(page);
    await textarea.fill('Senior Developer position...');

    const submitButton = getJDSubmitButton(page);
    await expect(submitButton).toBeEnabled();
  });

  test('clear button clears textarea', async () => {
    const textarea = getJDInputTextarea(page);
    await textarea.fill('Some JD text');

    const clearButton = page.locator('[data-testid="jd-clear-button"]');
    await clearButton.click();

    await expect(textarea).toHaveValue('');
  });

  test('upload button is visible', async () => {
    const uploadButton = page.locator('[data-testid="jd-upload-button"]');
    await expect(uploadButton).toBeVisible();
    await expect(uploadButton).toHaveText('Upload .txt File');
  });
});

test.describe('JD List', () => {
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

  test.describe('with mock JD data', () => {
    async function setupMockJDs() {
      const jdSummaries = createMockJDSummaries();
      await injectJDItems(page, jdSummaries);
      await patchSelectJDForTesting(page, JD_ID_TO_MOCK_DATA);
      await page.waitForTimeout(300);
    }

    test('JD items appear in list after injection', async () => {
      await setupMockJDs();

      const items = getJDItems(page);
      await expect(items).toHaveCount(4);
    });

    test('JD item shows title and company', async () => {
      await setupMockJDs();

      const item = getJDItemByTitle(page, 'Senior Full-Stack Developer');
      await expect(item).toBeVisible();
      await expect(item.locator('text=TechCorp')).toBeVisible();
    });

    test('JD item shows skill counts', async () => {
      await setupMockJDs();

      const item = getJDItemByTitle(page, 'Senior Full-Stack Developer');
      await expect(item.locator('text=7 required')).toBeVisible();
      await expect(item.locator('text=4 preferred')).toBeVisible();
    });

    test('clicking JD item selects it', async () => {
      await setupMockJDs();

      await clickJDItem(page, 'Senior Full-Stack Developer');

      // Selected item should have primary border
      const item = getJDItemByTitle(page, 'Senior Full-Stack Developer');
      await expect(item).toHaveClass(/border-primary/);
    });

    test('selecting JD enables Match Results tab', async () => {
      await setupMockJDs();

      // Initially disabled
      const jdPanel = getJDPanel(page);
      const resultsTab = jdPanel.locator('[role="tab"]:has-text("Match Results")');
      await expect(resultsTab).toBeDisabled();

      // Select a JD
      await clickJDItem(page, 'Senior Full-Stack Developer');

      // Now enabled
      await expect(resultsTab).toBeEnabled();
    });

    test('JD item has delete button', async () => {
      await setupMockJDs();

      const item = getJDItemByTitle(page, 'Senior Full-Stack Developer');
      const deleteButton = item.locator('button:has-text("Delete")');
      await expect(deleteButton).toBeVisible();
    });
  });
});

test.describe('Match Results', () => {
  let app: ElectronApplication;
  let page: Page;
  let fixturesDir: string;

  test.beforeEach(async () => {
    fixturesDir = getFixturesDir();
    const context = await launchElectronApp();
    app = context.app;
    page = context.page;
    await waitForAppReady(page);
  });

  test.afterEach(async () => {
    await closeElectronApp(app);
  });

  test.describe('with mock CV and JD data', () => {
    async function setupMockData() {
      // Inject CVs
      const mockItems = createMockQueueItemsForInjection(fixturesDir);
      await injectQueueItems(page, mockItems);
      await patchLoadCVForTesting(page, CV_ID_TO_MOCK_DATA);

      // Inject JDs
      const jdSummaries = createMockJDSummaries();
      await injectJDItems(page, jdSummaries);
      await patchSelectJDForTesting(page, JD_ID_TO_MOCK_DATA);
      await patchMatchCVsForTesting(page, MOCK_MATCH_RESULTS_FULLSTACK);

      await page.waitForTimeout(300);
    }

    test('Match Results shows JD info header', async () => {
      await setupMockData();

      // Select a JD and go to results
      await clickJDItem(page, 'Senior Full-Stack Developer');
      await clickJDTab(page, 'Match Results');

      // Check header shows JD title
      const jdPanel = getJDPanel(page);
      await expect(jdPanel.locator('h3:has-text("Senior Full-Stack Developer")')).toBeVisible();
    });

    test('Match All CVs button is visible', async () => {
      await setupMockData();

      await clickJDItem(page, 'Senior Full-Stack Developer');
      await clickJDTab(page, 'Match Results');

      const matchAllButton = getMatchAllButton(page);
      await expect(matchAllButton).toBeVisible();
    });

    test('Match Selected button shows count', async () => {
      await setupMockData();

      await clickJDItem(page, 'Senior Full-Stack Developer');
      await clickJDTab(page, 'Match Results');

      const matchSelectedButton = getMatchSelectedButton(page);
      await expect(matchSelectedButton).toBeVisible();
      await expect(matchSelectedButton).toHaveText(/Match Selected \(0\)/);
    });

    test('selecting CVs updates Match Selected count', async () => {
      await setupMockData();

      // Select a CV in the queue panel
      await clickTab(page, 'Completed');
      const queueItems = getQueueItems(page);
      await getItemCheckbox(queueItems.first()).click();

      // Select JD and check results
      await clickJDItem(page, 'Senior Full-Stack Developer');
      await clickJDTab(page, 'Match Results');

      const matchSelectedButton = getMatchSelectedButton(page);
      await expect(matchSelectedButton).toHaveText(/Match Selected \(1\)/);
    });

    test('Match All CVs shows results ranked by score', async () => {
      await setupMockData();

      await clickJDItem(page, 'Senior Full-Stack Developer');
      await clickJDTab(page, 'Match Results');

      // Click Match All
      const matchAllButton = getMatchAllButton(page);
      await matchAllButton.click();

      // Wait for results
      await page.waitForTimeout(500);

      // Results should appear
      const results = getMatchResultItems(page);
      const count = await results.count();
      expect(count).toBeGreaterThan(0);

      // First result should have highest score
      if (count >= 2) {
        const firstScore = await getMatchScore(results.first());
        const secondScore = await getMatchScore(results.nth(1));
        expect(firstScore).toBeGreaterThanOrEqual(secondScore);
      }
    });

    test('match results show score percentage', async () => {
      await setupMockData();

      await clickJDItem(page, 'Senior Full-Stack Developer');
      await clickJDTab(page, 'Match Results');
      await getMatchAllButton(page).click();
      await page.waitForTimeout(500);

      const results = getMatchResultItems(page);
      const firstResult = results.first();

      // Score should be visible and formatted as percentage
      // The score is in a span containing "%" text
      const scoreElement = firstResult.locator('span:has-text("%")').first();
      await expect(scoreElement).toBeVisible();
      const scoreText = await scoreElement.textContent();
      expect(scoreText).toMatch(/\d+%/);
    });

    test('match results show quality badge', async () => {
      await setupMockData();

      await clickJDItem(page, 'Senior Full-Stack Developer');
      await clickJDTab(page, 'Match Results');
      await getMatchAllButton(page).click();
      await page.waitForTimeout(500);

      const results = getMatchResultItems(page);
      const firstResult = results.first();

      // Quality badge should be visible (e.g., "Strong", "Good", "Partial", "Weak")
      const badge = await getMatchQualityBadge(firstResult);
      expect(badge).toBeTruthy();
      // Badge text might include "Match" suffix or just the quality label
      expect(badge?.trim()).toMatch(/Strong|Good|Partial|Weak/);
    });

    test('match results show matched skills preview', async () => {
      await setupMockData();

      await clickJDItem(page, 'Senior Full-Stack Developer');
      await clickJDTab(page, 'Match Results');
      await getMatchAllButton(page).click();
      await page.waitForTimeout(500);

      const results = getMatchResultItems(page);
      const firstResult = results.first();

      // Matched skills chips should be visible
      const skillChips = firstResult.locator('.bg-primary\\/20');
      const chipCount = await skillChips.count();
      expect(chipCount).toBeGreaterThan(0);
    });

    test('match results show ranking numbers', async () => {
      await setupMockData();

      await clickJDItem(page, 'Senior Full-Stack Developer');
      await clickJDTab(page, 'Match Results');
      await getMatchAllButton(page).click();
      await page.waitForTimeout(500);

      const results = getMatchResultItems(page);
      const count = await results.count();

      if (count > 0) {
        // First result should show #1
        await expect(results.first().locator('text=#1')).toBeVisible();
      }
    });

    test('clicking result opens CV in editor', async () => {
      await setupMockData();

      await clickJDItem(page, 'Senior Full-Stack Developer');
      await clickJDTab(page, 'Match Results');
      await getMatchAllButton(page).click();
      await page.waitForTimeout(500);

      const results = getMatchResultItems(page);
      await results.first().click();

      // Editor should open
      await expect(page.locator('h2:has-text("CV Editor")')).toBeVisible();
    });

    test('high score results have green color styling', async () => {
      await setupMockData();

      await clickJDItem(page, 'Senior Full-Stack Developer');
      await clickJDTab(page, 'Match Results');
      await getMatchAllButton(page).click();
      await page.waitForTimeout(500);

      const results = getMatchResultItems(page);
      const firstResult = results.first();

      // First result (92%) should have green styling
      const score = await getMatchScore(firstResult);
      if (score >= 80) {
        const scoreElement = firstResult.locator('span.text-lg.font-bold.text-green-500');
        await expect(scoreElement).toBeVisible();
      }
    });
  });
});

test.describe('CV Selection for Matching', () => {
  let app: ElectronApplication;
  let page: Page;
  let fixturesDir: string;

  test.beforeEach(async () => {
    fixturesDir = getFixturesDir();
    const context = await launchElectronApp();
    app = context.app;
    page = context.page;
    await waitForAppReady(page);
  });

  test.afterEach(async () => {
    await closeElectronApp(app);
  });

  test.describe('with mock data', () => {
    async function setupMockData() {
      const mockItems = createMockQueueItemsForInjection(fixturesDir);
      await injectQueueItems(page, mockItems);
      await patchLoadCVForTesting(page, CV_ID_TO_MOCK_DATA);

      const jdSummaries = createMockJDSummaries();
      await injectJDItems(page, jdSummaries);
      await patchSelectJDForTesting(page, JD_ID_TO_MOCK_DATA);
      await patchMatchCVsForTesting(page, MOCK_MATCH_RESULTS_FULLSTACK);

      await page.waitForTimeout(300);
    }

    test('queue checkboxes work for CV selection', async () => {
      await setupMockData();

      await clickTab(page, 'Completed');
      const queueItems = getQueueItems(page);

      // Select first CV
      await getItemCheckbox(queueItems.first()).click();

      // Checkbox should be checked
      await expect(getItemCheckbox(queueItems.first())).toBeChecked();
    });

    test('multiple CVs can be selected for matching', async () => {
      await setupMockData();

      await clickTab(page, 'Completed');
      const queueItems = getQueueItems(page);

      // Select multiple CVs
      await getItemCheckbox(queueItems.nth(0)).click();
      await getItemCheckbox(queueItems.nth(1)).click();

      // Both should be checked
      await expect(getItemCheckbox(queueItems.nth(0))).toBeChecked();
      await expect(getItemCheckbox(queueItems.nth(1))).toBeChecked();

      // Match Selected should show count of 2
      await clickJDItem(page, 'Senior Full-Stack Developer');
      await clickJDTab(page, 'Match Results');

      const matchSelectedButton = getMatchSelectedButton(page);
      await expect(matchSelectedButton).toHaveText(/Match Selected \(2\)/);
    });

    test('Match Selected only matches selected CVs', async () => {
      await setupMockData();

      // Select only one CV
      await clickTab(page, 'Completed');
      const queueItems = getQueueItems(page);
      await getItemCheckbox(queueItems.first()).click();

      // Go to match results and match selected
      await clickJDItem(page, 'Senior Full-Stack Developer');
      await clickJDTab(page, 'Match Results');

      const matchSelectedButton = getMatchSelectedButton(page);
      await matchSelectedButton.click();
      await page.waitForTimeout(500);

      // Should only have 1 result
      const results = getMatchResultItems(page);
      await expect(results).toHaveCount(1);
    });
  });
});
