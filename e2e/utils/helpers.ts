import { Page, expect, Locator } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * Queue tab names matching the UI.
 */
export type TabName = 'Completed' | 'Submitted' | 'Failed';

/**
 * Click a tab to switch views.
 *
 * @param page - The Playwright page instance
 * @param tabName - The name of the tab to click
 */
export async function clickTab(page: Page, tabName: TabName): Promise<void> {
  // Tab triggers contain the tab name followed by count in parentheses
  const tabTrigger = page.locator(`[role="tab"]:has-text("${tabName}")`);
  await tabTrigger.click();

  // Wait for the tab to become active
  await expect(tabTrigger).toHaveAttribute('data-state', 'active');
}

/**
 * Get the count displayed on a tab.
 *
 * @param page - The Playwright page instance
 * @param tabName - The name of the tab
 * @returns The count shown in parentheses
 */
export async function getTabCount(page: Page, tabName: TabName): Promise<number> {
  const tabTrigger = page.locator(`[role="tab"]:has-text("${tabName}")`);
  const text = await tabTrigger.textContent();

  // Extract number from "TabName (N)" format
  const match = text?.match(/\((\d+)\)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Get all queue items currently visible.
 *
 * @param page - The Playwright page instance
 * @returns Array of locators for each queue item
 */
export function getQueueItems(page: Page): Locator {
  // Queue items have checkboxes and filenames
  return page.locator('[role="tabpanel"][data-state="active"] .divide-y > div');
}

/**
 * Get a queue item by filename.
 *
 * @param page - The Playwright page instance
 * @param filename - The filename to find
 * @returns Locator for the queue item
 */
export function getQueueItemByFilename(page: Page, filename: string): Locator {
  return page.locator(`[role="tabpanel"][data-state="active"] .divide-y > div:has-text("${filename}")`);
}

/**
 * Get the checkbox for a queue item.
 *
 * @param item - The queue item locator
 * @returns Locator for the checkbox
 */
export function getItemCheckbox(item: Locator): Locator {
  return item.locator('input[type="checkbox"]');
}

/**
 * Click the filename in a queue item to open the editor.
 *
 * @param page - The Playwright page instance
 * @param filename - The filename to click
 */
export async function clickFilename(page: Page, filename: string): Promise<void> {
  const item = getQueueItemByFilename(page, filename);
  const filenameSpan = item.locator(`span.font-medium:has-text("${filename}")`);
  await filenameSpan.click();
}

/**
 * Get the selected items count displayed in the controls.
 *
 * @param page - The Playwright page instance
 * @returns The number of selected items, or 0 if controls not visible
 */
export async function getSelectedCount(page: Page): Promise<number> {
  const countText = page.locator('text=/\\d+ selected/');

  if (!(await countText.isVisible())) {
    return 0;
  }

  const text = await countText.textContent();
  const match = text?.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Click the Clear button in the controls.
 *
 * @param page - The Playwright page instance
 */
export async function clickClearSelection(page: Page): Promise<void> {
  await page.click('button:has-text("Clear")');
}

/**
 * Click the Delete button in the controls.
 *
 * @param page - The Playwright page instance
 */
export async function clickDelete(page: Page): Promise<void> {
  await page.click('button:has-text("Delete")');
}

/**
 * Click the Retry button in the controls.
 *
 * @param page - The Playwright page instance
 */
export async function clickRetry(page: Page): Promise<void> {
  await page.click('button:has-text("Retry")');
}

/**
 * Check if the editor panel is visible.
 *
 * @param page - The Playwright page instance
 * @returns true if editor is visible
 */
export async function isEditorVisible(page: Page): Promise<boolean> {
  return page.locator('h2:has-text("CV Editor")').isVisible();
}

/**
 * Click the Close button on the editor panel.
 *
 * @param page - The Playwright page instance
 */
export async function closeEditor(page: Page): Promise<void> {
  await page.click('button:has-text("Close")');
}

/**
 * Get an editor section by name.
 *
 * @param page - The Playwright page instance
 * @param sectionName - The section name (e.g., "Contact Information", "Work History")
 * @returns Locator for the section
 */
export function getEditorSection(page: Page, sectionName: string): Locator {
  return page.locator(`section:has(h2:has-text("${sectionName}"))`);
}

/**
 * Get an editable field by its label within a section.
 *
 * @param section - The section locator
 * @param label - The field label
 * @returns Locator for the editable field's clickable span
 */
export function getEditableField(section: Locator, label: string): Locator {
  // Fields are in a div with a label followed by the editable span
  return section.locator(`div:has(label:has-text("${label}")) span.cursor-pointer, div:has(label:has-text("${label}")) span:has-text("Click to add")`).first();
}

/**
 * Get the input that appears when an editable field is in edit mode.
 *
 * @param page - The Playwright page instance
 * @returns Locator for the input element
 */
export function getEditInput(page: Page): Locator {
  return page.locator('input.bg-input, textarea.bg-input');
}

/**
 * Simulate drag and drop of a file onto the drop zone.
 *
 * Note: Due to Electron security restrictions, we can't directly simulate
 * native file drag-drop. Instead, we'll use the file picker dialog mock
 * or IPC to inject files for testing.
 *
 * @param page - The Playwright page instance
 * @param filePath - Path to the file to drop
 */
export async function simulateFileDrop(page: Page, filePath: string): Promise<void> {
  const dropZone = page.locator('text=Drop CV files here or click to select').locator('..');

  // Create a DataTransfer-like object and dispatch dragenter, dragover, drop events
  // This is a simplified simulation - actual file data must be provided via IPC

  const fileName = path.basename(filePath);
  const fileType = path.extname(filePath).slice(1).toLowerCase();

  // Evaluate in page context to dispatch drop event with file info
  await dropZone.evaluate(
    async (element, { filePath, fileName, fileType }) => {
      // Create a mock File object
      // Note: In real E2E tests, this would trigger the IPC call
      // which we need to mock or use actual test files

      // Dispatch events
      const dragEnter = new DragEvent('dragenter', { bubbles: true });
      element.dispatchEvent(dragEnter);

      const dragOver = new DragEvent('dragover', { bubbles: true });
      element.dispatchEvent(dragOver);

      // For actual testing, we need to use IPC to inject the file
      // The drop event can't include real file data in the browser context
      const drop = new DragEvent('drop', { bubbles: true });
      element.dispatchEvent(drop);
    },
    { filePath, fileName, fileType }
  );
}

/**
 * Click the drop zone to open file picker (then we'd need to mock the dialog).
 *
 * @param page - The Playwright page instance
 */
export async function clickDropZone(page: Page): Promise<void> {
  const dropZone = page.locator('text=Drop CV files here or click to select').locator('..');
  await dropZone.click();
}

/**
 * Wait for a queue item to reach a specific status.
 *
 * @param page - The Playwright page instance
 * @param filename - The filename to watch
 * @param expectedStatus - The status to wait for
 * @param timeout - Maximum time to wait in ms
 */
export async function waitForItemStatus(
  page: Page,
  filename: string,
  expectedStatus: 'completed' | 'failed' | 'submitted',
  timeout = 30000
): Promise<void> {
  // The item will move tabs, so we need to check the appropriate tab
  if (expectedStatus === 'completed') {
    await clickTab(page, 'Completed');
    await expect(getQueueItemByFilename(page, filename)).toBeVisible({ timeout });
  } else if (expectedStatus === 'failed') {
    await clickTab(page, 'Failed');
    await expect(getQueueItemByFilename(page, filename)).toBeVisible({ timeout });
  } else {
    await clickTab(page, 'Submitted');
    await expect(getQueueItemByFilename(page, filename)).toBeVisible({ timeout });
  }
}

/**
 * Get the status badge text for a queue item.
 *
 * @param item - The queue item locator
 * @returns The badge text
 */
export async function getItemStatusBadge(item: Locator): Promise<string | null> {
  const badge = item.locator('.bg-status-submitted, .bg-status-completed, .bg-status-failed, .bg-warning').first();

  if (!(await badge.isVisible())) {
    return null;
  }

  return badge.textContent();
}

/**
 * Create a test PDF file with minimal valid content.
 *
 * @param outputPath - Path where the PDF should be created
 */
export function createTestPDF(outputPath: string): void {
  // Minimal valid PDF structure
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(John Doe - Software Engineer) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000206 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
300
%%EOF`;

  fs.writeFileSync(outputPath, pdfContent);
}

/**
 * Create a test DOCX file with minimal valid content.
 * Note: DOCX is a ZIP archive with XML content.
 *
 * @param outputPath - Path where the DOCX should be created
 */
export async function createTestDOCX(outputPath: string): Promise<void> {
  // For simplicity, we'll create a minimal DOCX structure
  // A real implementation would use a library like docx
  // For testing, we'll copy from fixtures or create a simple one

  const archiver = await import('archiver').catch(() => null);

  if (!archiver) {
    // Fallback: create a placeholder file
    // In real tests, use a pre-created fixture file
    console.warn('archiver not available, creating placeholder DOCX');
    fs.writeFileSync(outputPath, 'PK placeholder');
    return;
  }

  // Create a valid minimal DOCX using archiver
  const output = fs.createWriteStream(outputPath);
  const archive = archiver.default('zip', { zlib: { level: 9 } });

  archive.pipe(output);

  // [Content_Types].xml
  archive.append(
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    { name: '[Content_Types].xml' }
  );

  // _rels/.rels
  archive.append(
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    { name: '_rels/.rels' }
  );

  // word/document.xml
  archive.append(
    `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>Jane Smith - Product Manager</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>Email: jane.smith@example.com</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>Experience: 5 years in product management</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`,
    { name: 'word/document.xml' }
  );

  await archive.finalize();

  // Wait for the file to be written
  await new Promise<void>((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
  });
}

/**
 * Get the fixtures directory path.
 */
export function getFixturesPath(): string {
  return path.resolve(__dirname, '..', 'fixtures');
}

/**
 * Get the path to a fixture file.
 *
 * @param filename - Name of the fixture file
 */
export function getFixturePath(filename: string): string {
  return path.join(getFixturesPath(), filename);
}

/**
 * Ensure the fixtures directory exists.
 */
export function ensureFixturesDir(): void {
  const fixturesDir = getFixturesPath();
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }
}
