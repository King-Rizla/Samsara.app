# E2E Tests for Samsara

End-to-end tests using Playwright for the Electron application.

## Setup

1. Install dependencies (if not already done):
   ```bash
   npm install
   ```

2. Ensure the app builds successfully:
   ```bash
   npm run package
   ```

## Running Tests

### Headless (default)
```bash
npm run test:e2e
```

### Headed (visible browser)
```bash
npm run test:e2e:headed
```

### Debug mode (step through tests)
```bash
npm run test:e2e:debug
```

### UI mode (interactive test runner)
```bash
npm run test:e2e:ui
```

## Test Structure

```
e2e/
  fixtures/           # Test data and sample files
    sample-cv.pdf     # Valid PDF for testing
    another-cv.pdf    # Second valid PDF
    invalid.pdf       # Invalid file for error testing
    resume.txt        # Unsupported format
    test-data.ts      # Mock CV data
  utils/
    electron-app.ts   # Electron launch/close helpers
    helpers.ts        # UI interaction helpers
    ipc-mock.ts       # IPC mocking utilities
    index.ts          # Exports
  queue.spec.ts       # Queue UI tests
  processing.spec.ts  # File processing tests
  selection.spec.ts   # Item selection tests
  bulk-operations.spec.ts  # Delete/retry tests
  editor.spec.ts      # CV editor panel tests
  editing.spec.ts     # Inline editing tests
  global-setup.ts     # Pre-test setup
  global-teardown.ts  # Post-test cleanup
```

## Test Suites

### Queue Tests (`queue.spec.ts`)
- App launches correctly
- Three tabs visible (Completed, Submitted, Failed)
- Tab switching works
- Empty states display

### Processing Tests (`processing.spec.ts`)
- File selection via drop zone
- Processing stages (Parsing, Extracting, Saving)
- Item moves to Completed/Failed
- Error handling

### Selection Tests (`selection.spec.ts`)
- Single checkbox selection
- Shift-click range selection
- Selection count updates
- Clear button
- Selection clears on tab switch

### Bulk Operations Tests (`bulk-operations.spec.ts`)
- Delete removes selected items
- Delete closes editor if active CV deleted
- Retry button for failed items
- Retry reprocesses items

### Editor Tests (`editor.spec.ts`)
- Click filename opens editor
- Split view layout (50/50)
- All sections visible
- Confidence badges
- Close button

### Editing Tests (`editing.spec.ts`)
- Click field enters edit mode
- Typing updates value
- Blur saves to database
- ESC cancels edit
- Changes persist
- Low-confidence field styling

## Writing New Tests

### Basic Test Structure
```typescript
import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { launchElectronApp, closeElectronApp, waitForAppReady } from './utils';

test.describe('Feature Name', () => {
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

  test('should do something', async () => {
    // Your test code
  });
});
```

### Using Helper Functions
```typescript
import {
  clickTab,
  getQueueItems,
  clickFilename,
  getSelectedCount,
} from './utils';

// Switch tabs
await clickTab(page, 'Completed');

// Get queue items
const items = getQueueItems(page);
await expect(items).toHaveCount(5);

// Open editor
await clickFilename(page, 'resume.pdf');
```

### Mocking IPC
```typescript
import { mockExtractCV, mockGetAllCVs, restoreAllMocks } from './utils';

// Mock extraction to succeed
await mockExtractCV(page, MOCK_CV_HIGH_CONFIDENCE);

// Mock extraction to fail
await mockExtractCV(page, undefined, true, 'Parse error');

// Restore original handlers
await restoreAllMocks(page);
```

## Notes

- Tests that require the Python backend are marked with `test.skip()` until the backend is available or mocked
- Each test launches a fresh Electron instance for isolation
- Test data is stored in a separate user data directory to avoid affecting the real app
- Screenshots are saved to `e2e/screenshots/` on failure

## Troubleshooting

### Tests timeout on launch
- Ensure the app builds successfully first
- Check that Vite output exists in `.vite/`

### Tests fail to find elements
- Use `await waitForAppReady(page)` after launch
- Check that selectors match the actual DOM

### IPC mocks don't work
- Mocks must be set up before the action that triggers IPC
- Call `restoreAllMocks(page)` in afterEach to clean up
