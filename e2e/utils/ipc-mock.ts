/**
 * IPC Mock Utilities for E2E Testing
 *
 * Provides utilities to mock Electron IPC handlers for testing scenarios
 * where we need to simulate file processing, database operations, etc.
 */

import { Page } from '@playwright/test';
import {
  MOCK_CV_JOHN_DOE,
  MOCK_CV_JANE_SMITH,
  MOCK_CV_ALEX_CHEN,
  MOCK_CV_MARIA_GARCIA,
  MOCK_CV_LOW_CONFIDENCE,
  MockCVData,
  MockQueueItem,
} from '../fixtures/test-data';

// Legacy alias
const MOCK_CV_HIGH_CONFIDENCE = MOCK_CV_JOHN_DOE;

/**
 * Mock the extractCV IPC handler to return test data.
 *
 * This injects a mock into the renderer process that intercepts
 * window.api.extractCV calls.
 *
 * @param page - The Playwright page instance
 * @param mockData - The CV data to return
 * @param shouldFail - Whether the extraction should fail
 * @param errorMessage - Error message if shouldFail is true
 */
export async function mockExtractCV(
  page: Page,
  mockData: MockCVData = MOCK_CV_HIGH_CONFIDENCE,
  shouldFail = false,
  errorMessage = 'Mock extraction failed'
): Promise<void> {
  await page.evaluate(
    ({ mockData, shouldFail, errorMessage }) => {
      // Store original function
      const originalExtractCV = window.api.extractCV;

      // Override with mock
      window.api.extractCV = async (filePath: string) => {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (shouldFail) {
          return {
            success: false,
            error: errorMessage,
          };
        }

        return {
          success: true,
          data: mockData,
          id: crypto.randomUUID(),
          totalTime: 1234,
        };
      };

      // Store original for potential restoration
      (window as unknown as { __originalExtractCV: typeof originalExtractCV }).__originalExtractCV =
        originalExtractCV;
    },
    { mockData, shouldFail, errorMessage }
  );
}

/**
 * Restore the original extractCV IPC handler.
 *
 * @param page - The Playwright page instance
 */
export async function restoreExtractCV(page: Page): Promise<void> {
  await page.evaluate(() => {
    const original = (window as unknown as { __originalExtractCV: typeof window.api.extractCV })
      .__originalExtractCV;
    if (original) {
      window.api.extractCV = original;
    }
  });
}

/**
 * Mock the getAllCVs IPC handler to return pre-populated data.
 *
 * @param page - The Playwright page instance
 * @param cvs - Array of CV summaries to return
 */
export async function mockGetAllCVs(
  page: Page,
  cvs: Array<{
    id: string;
    file_name: string;
    file_path: string;
    parse_confidence: number;
    created_at: string;
  }>
): Promise<void> {
  await page.evaluate(
    ({ cvs }) => {
      const original = window.api.getAllCVs;

      window.api.getAllCVs = async () => ({
        success: true,
        data: cvs.map((cv) => ({
          ...cv,
          contact_json: '{}',
        })),
      });

      (window as unknown as { __originalGetAllCVs: typeof original }).__originalGetAllCVs = original;
    },
    { cvs }
  );
}

/**
 * Mock the getCV IPC handler to return specific CV data.
 *
 * @param page - The Playwright page instance
 * @param cvDataMap - Map of CV ID to CV data
 */
export async function mockGetCV(
  page: Page,
  cvDataMap: Record<string, MockCVData>
): Promise<void> {
  await page.evaluate(
    ({ cvDataMap }) => {
      // Store the data map on window so the mock function can access it
      (window as unknown as { __mockCVDataMap: Record<string, unknown> }).__mockCVDataMap = cvDataMap;

      const original = window.api.getCV;

      window.api.getCV = async (cvId: string) => {
        // Access the data map from window (not closure) to ensure it's available
        const dataMap = (window as unknown as { __mockCVDataMap: Record<string, unknown> }).__mockCVDataMap;
        const data = dataMap?.[cvId];
        if (!data) {
          return { success: false, error: `CV not found: ${cvId}. Available: ${Object.keys(dataMap || {}).join(', ')}` };
        }
        return { success: true, data };
      };

      (window as unknown as { __originalGetCV: typeof original }).__originalGetCV = original;
    },
    { cvDataMap }
  );
}

/**
 * Mock the updateCVField IPC handler.
 *
 * @param page - The Playwright page instance
 * @param shouldFail - Whether updates should fail
 */
export async function mockUpdateCVField(
  page: Page,
  shouldFail = false
): Promise<void> {
  await page.evaluate(
    ({ shouldFail }) => {
      const original = window.api.updateCVField;

      window.api.updateCVField = async (_cvId: string, _fieldPath: string, _value: unknown) => {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (shouldFail) {
          return { success: false, error: 'Update failed' };
        }

        return { success: true };
      };

      (window as unknown as { __originalUpdateCVField: typeof original }).__originalUpdateCVField =
        original;
    },
    { shouldFail }
  );
}

/**
 * Mock the deleteCV IPC handler.
 *
 * @param page - The Playwright page instance
 * @param shouldFail - Whether deletes should fail
 */
export async function mockDeleteCV(
  page: Page,
  shouldFail = false
): Promise<void> {
  await page.evaluate(
    ({ shouldFail }) => {
      const original = window.api.deleteCV;

      window.api.deleteCV = async (_cvId: string) => {
        if (shouldFail) {
          return { success: false, error: 'Delete failed' };
        }
        return { success: true };
      };

      (window as unknown as { __originalDeleteCV: typeof original }).__originalDeleteCV = original;
    },
    { shouldFail }
  );
}

/**
 * Mock the selectCVFile IPC handler (file dialog).
 *
 * @param page - The Playwright page instance
 * @param filePath - Path to return (or null for cancel)
 * @param fileName - Filename to return
 */
export async function mockSelectCVFile(
  page: Page,
  filePath: string | null,
  fileName?: string
): Promise<void> {
  await page.evaluate(
    ({ filePath, fileName }) => {
      const original = window.api.selectCVFile;

      window.api.selectCVFile = async () => {
        if (!filePath) {
          return { success: false, canceled: true };
        }

        return {
          success: true,
          filePath,
          fileName: fileName || filePath.split(/[\\/]/).pop() || 'unknown.pdf',
        };
      };

      (window as unknown as { __originalSelectCVFile: typeof original }).__originalSelectCVFile =
        original;
    },
    { filePath, fileName }
  );
}

/**
 * Restore all mocked IPC handlers.
 *
 * @param page - The Playwright page instance
 */
export async function restoreAllMocks(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;

    if (w.__originalExtractCV) {
      window.api.extractCV = w.__originalExtractCV as typeof window.api.extractCV;
    }
    if (w.__originalGetAllCVs) {
      window.api.getAllCVs = w.__originalGetAllCVs as typeof window.api.getAllCVs;
    }
    if (w.__originalGetCV) {
      window.api.getCV = w.__originalGetCV as typeof window.api.getCV;
    }
    if (w.__originalUpdateCVField) {
      window.api.updateCVField = w.__originalUpdateCVField as typeof window.api.updateCVField;
    }
    if (w.__originalDeleteCV) {
      window.api.deleteCV = w.__originalDeleteCV as typeof window.api.deleteCV;
    }
    if (w.__originalSelectCVFile) {
      window.api.selectCVFile = w.__originalSelectCVFile as typeof window.api.selectCVFile;
    }
  });
}

/**
 * Setup test data by injecting CVs directly into the store.
 *
 * This is useful for tests that need pre-populated data without
 * going through the full extraction flow.
 *
 * @param page - The Playwright page instance
 * @param items - Queue items to add
 */
export async function injectQueueItems(
  page: Page,
  items: MockQueueItem[]
): Promise<void> {
  await page.evaluate(
    ({ items }) => {
      // Access the Zustand store directly (exposed in dev mode)
      const queueStore = (window as unknown as { __queueStore?: {
        getState: () => { addItem: (item: unknown) => void };
      } }).__queueStore;

      if (!queueStore) {
        console.error('Queue store not exposed on window. Make sure the app is in dev mode.');
        return;
      }

      const { addItem } = queueStore.getState();

      // Add items in reverse order so first item appears at top
      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        addItem({
          id: item.id,
          fileName: item.fileName,
          fileType: item.fileType,
          filePath: item.filePath,
          status: item.status,
          stage: item.stage,
          error: item.error,
          data: item.data,
          parseConfidence: item.parseConfidence,
        });
      }
    },
    { items }
  );
}

/**
 * Clear all items from the queue store.
 *
 * @param page - The Playwright page instance
 */
export async function clearQueueItems(page: Page): Promise<void> {
  await page.evaluate(() => {
    const queueStore = (window as unknown as { __queueStore?: {
      setState: (state: { items: never[]; selectedIds: Set<string>; lastSelectedId: null }) => void;
    } }).__queueStore;

    if (queueStore) {
      queueStore.setState({ items: [], selectedIds: new Set(), lastSelectedId: null });
    }
  });
}

/**
 * Directly open a CV in the editor by setting store state.
 *
 * This bypasses IPC calls and directly manipulates the editor store,
 * which is useful for testing since contextBridge-exposed APIs cannot
 * be mocked from the renderer.
 *
 * @param page - The Playwright page instance
 * @param cvId - The CV ID to open
 * @param cvData - The CV data to display
 */
export async function openCVInEditor(
  page: Page,
  cvId: string,
  cvData: MockCVData
): Promise<void> {
  await page.evaluate(
    ({ cvId, cvData }) => {
      const editorStore = (window as unknown as { __editorStore?: {
        setState: (state: {
          viewMode: 'cv';
          activeCVId: string;
          activeCV: unknown;
          failedItem: null;
          isDirty: boolean;
          pendingChanges: Map<string, unknown>;
        }) => void;
      } }).__editorStore;

      if (editorStore) {
        editorStore.setState({
          viewMode: 'cv',
          activeCVId: cvId,
          activeCV: cvData,
          failedItem: null,
          isDirty: false,
          pendingChanges: new Map(),
        });
      }
    },
    { cvId, cvData }
  );
}

/**
 * Setup a click handler on completed items to directly open in editor.
 *
 * Since contextBridge APIs can't be mocked, this patches the editorStore's
 * loadCV function to directly set state instead of making IPC calls.
 *
 * @param page - The Playwright page instance
 * @param cvDataMap - Map of CV ID to CV data
 */
export async function patchLoadCVForTesting(
  page: Page,
  cvDataMap: Record<string, MockCVData>
): Promise<void> {
  await page.evaluate(
    ({ cvDataMap }) => {
      // Store data map on window for access
      (window as unknown as { __testCVDataMap: Record<string, unknown> }).__testCVDataMap = cvDataMap;

      const editorStore = (window as unknown as { __editorStore?: {
        getState: () => {
          loadCV: (id: string) => Promise<void>;
        };
        setState: (state: unknown) => void;
      } }).__editorStore;

      if (editorStore) {
        // Override the loadCV action to use test data
        const originalState = editorStore.getState();

        // Zustand stores don't let us easily override actions, but we can
        // monkey-patch the store's internal methods
        const originalLoadCV = originalState.loadCV;

        // Store original for restoration
        (window as unknown as { __originalLoadCV: typeof originalLoadCV }).__originalLoadCV = originalLoadCV;

        // Create patched version that uses test data
        editorStore.setState({
          loadCV: async (id: string) => {
            const dataMap = (window as unknown as { __testCVDataMap: Record<string, unknown> }).__testCVDataMap;
            const data = dataMap?.[id];
            if (data) {
              editorStore.setState({
                viewMode: 'cv',
                activeCVId: id,
                activeCV: data,
                failedItem: null,
                isDirty: false,
                pendingChanges: new Map(),
              });
            } else {
              console.error(`Test data not found for CV ID: ${id}`);
            }
          },
        });
      }
    },
    { cvDataMap }
  );
}

/**
 * Create a set of test CVs for populating the queue.
 * Uses the generated fixture data.
 *
 * @param fixturesDir - Path to fixtures directory
 */
export function createTestCVSet(fixturesDir: string): Array<{
  id: string;
  file_name: string;
  file_path: string;
  parse_confidence: number;
  created_at: string;
}> {
  const path = require('path');
  return [
    {
      id: 'test-cv-1',
      file_name: 'john-doe-senior-developer.pdf',
      file_path: path.join(fixturesDir, 'john-doe-senior-developer.pdf'),
      parse_confidence: MOCK_CV_JOHN_DOE.parse_confidence,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'test-cv-2',
      file_name: 'jane-smith-product-manager.pdf',
      file_path: path.join(fixturesDir, 'jane-smith-product-manager.pdf'),
      parse_confidence: MOCK_CV_JANE_SMITH.parse_confidence,
      created_at: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 'test-cv-3',
      file_name: 'alex-chen-data-scientist.docx',
      file_path: path.join(fixturesDir, 'alex-chen-data-scientist.docx'),
      parse_confidence: MOCK_CV_ALEX_CHEN.parse_confidence,
      created_at: new Date(Date.now() - 10800000).toISOString(),
    },
    {
      id: 'test-cv-4',
      file_name: 'maria-garcia-ux-designer.docx',
      file_path: path.join(fixturesDir, 'maria-garcia-ux-designer.docx'),
      parse_confidence: MOCK_CV_MARIA_GARCIA.parse_confidence,
      created_at: new Date(Date.now() - 14400000).toISOString(),
    },
  ];
}

/**
 * Create queue items with full mock data for injection.
 *
 * @param fixturesDir - Path to fixtures directory
 */
export function createMockQueueItemsForInjection(fixturesDir: string): MockQueueItem[] {
  const path = require('path');
  return [
    {
      id: 'test-cv-1',
      fileName: 'john-doe-senior-developer.pdf',
      fileType: 'pdf',
      filePath: path.join(fixturesDir, 'john-doe-senior-developer.pdf'),
      status: 'completed',
      data: MOCK_CV_JOHN_DOE,
      parseConfidence: MOCK_CV_JOHN_DOE.parse_confidence,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'test-cv-2',
      fileName: 'jane-smith-product-manager.pdf',
      fileType: 'pdf',
      filePath: path.join(fixturesDir, 'jane-smith-product-manager.pdf'),
      status: 'completed',
      data: MOCK_CV_JANE_SMITH,
      parseConfidence: MOCK_CV_JANE_SMITH.parse_confidence,
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 'test-cv-3',
      fileName: 'alex-chen-data-scientist.docx',
      fileType: 'docx',
      filePath: path.join(fixturesDir, 'alex-chen-data-scientist.docx'),
      status: 'completed',
      data: MOCK_CV_ALEX_CHEN,
      parseConfidence: MOCK_CV_ALEX_CHEN.parse_confidence,
      createdAt: new Date(Date.now() - 10800000).toISOString(),
    },
    {
      id: 'test-cv-4',
      fileName: 'maria-garcia-ux-designer.docx',
      fileType: 'docx',
      filePath: path.join(fixturesDir, 'maria-garcia-ux-designer.docx'),
      status: 'completed',
      data: MOCK_CV_MARIA_GARCIA,
      parseConfidence: MOCK_CV_MARIA_GARCIA.parse_confidence,
      createdAt: new Date(Date.now() - 14400000).toISOString(),
    },
  ];
}

/**
 * Create a failed queue item for testing error scenarios.
 *
 * @param fixturesDir - Path to fixtures directory
 */
export function createFailedQueueItem(fixturesDir: string): MockQueueItem {
  const path = require('path');
  return {
    id: 'test-cv-failed',
    fileName: 'corrupt-file.pdf',
    fileType: 'pdf',
    filePath: path.join(fixturesDir, 'invalid.pdf'),
    status: 'failed',
    error: 'Failed to parse PDF: Invalid or corrupted file format',
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  };
}

/**
 * Map of CV IDs to their mock data for getCV mocking.
 */
export const CV_ID_TO_MOCK_DATA: Record<string, MockCVData> = {
  'test-cv-1': MOCK_CV_JOHN_DOE,
  'test-cv-2': MOCK_CV_JANE_SMITH,
  'test-cv-3': MOCK_CV_ALEX_CHEN,
  'test-cv-4': MOCK_CV_MARIA_GARCIA,
};
