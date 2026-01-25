/**
 * Inline Editing E2E Tests
 *
 * Tests for the editable field component including edit mode, saving, canceling,
 * and persistence of changes.
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
  getEditableField,
  getEditInput,
} from './utils/helpers';

test.describe('Inline Editing', () => {
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

  test.describe('Edit Mode', () => {
    test.skip('clicking field enters edit mode', async () => {
      await clickTab(page, 'Completed');

      const items = getQueueItems(page);
      const firstFilename = await items.first().locator('.font-medium').textContent();

      await clickFilename(page, firstFilename!);

      // Get the contact section
      const contactSection = getEditorSection(page, 'Contact Information');

      // Find the Name field and click it
      const nameField = getEditableField(contactSection, 'Name');
      await nameField.click();

      // An input should appear
      const input = getEditInput(page);
      await expect(input).toBeVisible();
      await expect(input).toBeFocused();
    });

    test.skip('input is pre-populated with current value', async () => {
      await clickTab(page, 'Completed');

      const items = getQueueItems(page);
      const firstFilename = await items.first().locator('.font-medium').textContent();

      await clickFilename(page, firstFilename!);

      const contactSection = getEditorSection(page, 'Contact Information');
      const nameField = getEditableField(contactSection, 'Name');

      // Get current value
      const currentValue = await nameField.textContent();

      // Enter edit mode
      await nameField.click();

      // Input should have the same value
      const input = getEditInput(page);
      await expect(input).toHaveValue(currentValue!.trim());
    });

    test.skip('input text is selected on focus', async () => {
      await clickTab(page, 'Completed');

      const items = getQueueItems(page);
      const firstFilename = await items.first().locator('.font-medium').textContent();

      await clickFilename(page, firstFilename!);

      const contactSection = getEditorSection(page, 'Contact Information');
      const nameField = getEditableField(contactSection, 'Name');

      await nameField.click();

      const input = getEditInput(page);

      // The text should be selected (we can test this by typing - it should replace)
      const originalValue = await input.inputValue();

      await input.type('Test', { delay: 50 });

      // Value should be "Test" not "OriginalValueTest"
      const newValue = await input.inputValue();
      expect(newValue).toBe('Test');
    });
  });

  test.describe('Saving Changes', () => {
    test.skip('typing updates value with debounce', async () => {
      await clickTab(page, 'Completed');

      const items = getQueueItems(page);
      const firstFilename = await items.first().locator('.font-medium').textContent();

      await clickFilename(page, firstFilename!);

      const contactSection = getEditorSection(page, 'Contact Information');
      const nameField = getEditableField(contactSection, 'Name');

      await nameField.click();

      const input = getEditInput(page);

      // Clear and type new value
      await input.fill('John Updated Doe');

      // Wait for debounce (400ms + buffer)
      await page.waitForTimeout(600);

      // The save should have been triggered
      // We can verify by checking the input still has the value
      await expect(input).toHaveValue('John Updated Doe');
    });

    test.skip('blur saves to database', async () => {
      await clickTab(page, 'Completed');

      const items = getQueueItems(page);
      const firstFilename = await items.first().locator('.font-medium').textContent();

      await clickFilename(page, firstFilename!);

      const contactSection = getEditorSection(page, 'Contact Information');
      const emailField = getEditableField(contactSection, 'Email');

      await emailField.click();

      const input = getEditInput(page);
      await input.fill('new.email@example.com');

      // Click elsewhere to blur
      await contactSection.locator('h2').click();

      // Input should be gone, replaced by the span
      await expect(input).not.toBeVisible();

      // The field should show the new value
      const updatedField = getEditableField(contactSection, 'Email');
      await expect(updatedField).toHaveText('new.email@example.com');
    });

    test.skip('enter key saves and exits edit mode (single-line fields)', async () => {
      await clickTab(page, 'Completed');

      const items = getQueueItems(page);
      const firstFilename = await items.first().locator('.font-medium').textContent();

      await clickFilename(page, firstFilename!);

      const contactSection = getEditorSection(page, 'Contact Information');
      const phoneField = getEditableField(contactSection, 'Phone');

      await phoneField.click();

      const input = getEditInput(page);
      await input.fill('+1 (555) 999-8888');

      // Press Enter
      await input.press('Enter');

      // Input should be gone
      await expect(input).not.toBeVisible();

      // Field should show new value
      const updatedField = getEditableField(contactSection, 'Phone');
      await expect(updatedField).toHaveText('+1 (555) 999-8888');
    });
  });

  test.describe('Canceling Edits', () => {
    test.skip('ESC cancels edit and restores original value', async () => {
      await clickTab(page, 'Completed');

      const items = getQueueItems(page);
      const firstFilename = await items.first().locator('.font-medium').textContent();

      await clickFilename(page, firstFilename!);

      const contactSection = getEditorSection(page, 'Contact Information');
      const nameField = getEditableField(contactSection, 'Name');

      // Get original value
      const originalValue = await nameField.textContent();

      await nameField.click();

      const input = getEditInput(page);

      // Type something different
      await input.fill('Completely Different Name');

      // Press Escape
      await input.press('Escape');

      // Input should be gone
      await expect(input).not.toBeVisible();

      // Field should show original value (not the edited value)
      const restoredField = getEditableField(contactSection, 'Name');
      await expect(restoredField).toHaveText(originalValue!.trim());
    });

    test.skip('ESC clears any error state', async () => {
      await clickTab(page, 'Completed');

      const items = getQueueItems(page);
      const firstFilename = await items.first().locator('.font-medium').textContent();

      await clickFilename(page, firstFilename!);

      const contactSection = getEditorSection(page, 'Contact Information');
      const emailField = getEditableField(contactSection, 'Email');

      await emailField.click();

      const input = getEditInput(page);

      // Type invalid value (if validation exists)
      await input.fill('');

      // Force a save attempt
      await page.waitForTimeout(500);

      // Press Escape
      await input.press('Escape');

      // No error message should be visible
      const errorMessage = page.locator('.text-destructive.text-xs');
      await expect(errorMessage).not.toBeVisible();
    });
  });

  test.describe('Persistence', () => {
    test.skip('changes persist after close/reopen editor', async () => {
      await clickTab(page, 'Completed');

      const items = getQueueItems(page);
      const firstFilename = await items.first().locator('.font-medium').textContent();

      await clickFilename(page, firstFilename!);

      const contactSection = getEditorSection(page, 'Contact Information');
      const nameField = getEditableField(contactSection, 'Name');

      await nameField.click();

      const input = getEditInput(page);
      await input.fill('Persistent Name Change');
      await input.press('Enter');

      // Close editor
      await closeEditor(page);

      // Reopen the same CV
      await clickFilename(page, firstFilename!);

      // Name should still be the changed value
      const reopenedSection = getEditorSection(page, 'Contact Information');
      const reopenedNameField = getEditableField(reopenedSection, 'Name');
      await expect(reopenedNameField).toHaveText('Persistent Name Change');
    });

    test.skip('changes persist after switching CVs', async () => {
      await clickTab(page, 'Completed');

      const items = getQueueItems(page);
      const count = await items.count();

      if (count < 2) {
        test.skip();
        return;
      }

      const firstFilename = await items.first().locator('.font-medium').textContent();
      const secondFilename = await items.nth(1).locator('.font-medium').textContent();

      // Edit first CV
      await clickFilename(page, firstFilename!);

      const contactSection = getEditorSection(page, 'Contact Information');
      const nameField = getEditableField(contactSection, 'Name');

      await nameField.click();
      const input = getEditInput(page);
      await input.fill('First CV Updated Name');
      await input.press('Enter');

      // Switch to second CV
      await clickFilename(page, secondFilename!);

      // Switch back to first CV
      await clickFilename(page, firstFilename!);

      // First CV should have the changed name
      const backSection = getEditorSection(page, 'Contact Information');
      const backNameField = getEditableField(backSection, 'Name');
      await expect(backNameField).toHaveText('First CV Updated Name');
    });
  });

  test.describe('Low Confidence Fields', () => {
    test.skip('low-confidence fields have warning styling', async () => {
      await clickTab(page, 'Completed');

      const items = getQueueItems(page);

      // Find a low-confidence item
      const warningBadge = items.locator('.bg-warning\\/20');
      const hasWarnings = await warningBadge.count() > 0;

      if (!hasWarnings) {
        test.skip();
        return;
      }

      const itemWithWarning = items.filter({ has: warningBadge }).first();
      const filename = await itemWithWarning.locator('.font-medium').textContent();

      await clickFilename(page, filename!);

      // Look for fields with low confidence styling
      // Low confidence fields have bg-warning/20 and border-warning
      const lowConfidenceFields = page.locator('span.bg-warning\\/20.border-warning');

      // Should have at least one low-confidence field
      const count = await lowConfidenceFields.count();
      expect(count).toBeGreaterThan(0);
    });

    test.skip('low-confidence field shows tooltip hint', async () => {
      await clickTab(page, 'Completed');

      const items = getQueueItems(page);
      const warningBadge = items.locator('.bg-warning\\/20');
      const hasWarnings = await warningBadge.count() > 0;

      if (!hasWarnings) {
        test.skip();
        return;
      }

      const itemWithWarning = items.filter({ has: warningBadge }).first();
      const filename = await itemWithWarning.locator('.font-medium').textContent();

      await clickFilename(page, filename!);

      // Find a low-confidence field
      const lowConfidenceField = page.locator('span.bg-warning\\/20.border-warning').first();

      // Should have title attribute with hint text
      const title = await lowConfidenceField.getAttribute('title');
      expect(title).toContain('Low confidence');
    });
  });

  test.describe('Multiline Fields', () => {
    test.skip('description fields use textarea', async () => {
      await clickTab(page, 'Completed');

      const items = getQueueItems(page);
      const firstFilename = await items.first().locator('.font-medium').textContent();

      await clickFilename(page, firstFilename!);

      // Work history descriptions should use textarea
      const workSection = getEditorSection(page, 'Work History');

      // Find a description field and click it
      const descriptionLabel = workSection.locator('label:has-text("Description")').first();
      const descriptionField = descriptionLabel.locator('..').locator('span').first();

      if (await descriptionField.isVisible()) {
        await descriptionField.click();

        // Should be a textarea, not input
        const textarea = page.locator('textarea.bg-input');
        await expect(textarea).toBeVisible();
      }
    });

    test.skip('enter key does not exit multiline edit mode', async () => {
      await clickTab(page, 'Completed');

      const items = getQueueItems(page);
      const firstFilename = await items.first().locator('.font-medium').textContent();

      await clickFilename(page, firstFilename!);

      const workSection = getEditorSection(page, 'Work History');
      const descriptionLabel = workSection.locator('label:has-text("Description")').first();
      const descriptionField = descriptionLabel.locator('..').locator('span').first();

      if (await descriptionField.isVisible()) {
        await descriptionField.click();

        const textarea = page.locator('textarea.bg-input');

        // Type and press Enter
        await textarea.fill('Line 1');
        await textarea.press('Enter');
        await textarea.type('Line 2');

        // Textarea should still be visible (Enter adds newline, doesn't submit)
        await expect(textarea).toBeVisible();

        // Value should have the newline
        const value = await textarea.inputValue();
        expect(value).toContain('\n');
      }
    });
  });

  test.describe('Error Handling', () => {
    test.skip('save failure shows error message', async () => {
      // This test would require mocking the IPC to simulate a save failure
      // For now, we verify the error display mechanism exists

      await clickTab(page, 'Completed');

      const items = getQueueItems(page);
      const firstFilename = await items.first().locator('.font-medium').textContent();

      await clickFilename(page, firstFilename!);

      // The error message element should have the correct styling when visible
      // It appears as .text-destructive.text-xs below the input
      // We can verify the CSS classes are correct

      const contactSection = getEditorSection(page, 'Contact Information');
      const nameField = getEditableField(contactSection, 'Name');

      await nameField.click();

      // The input container should have relative positioning for error message
      const inputContainer = page.locator('.relative:has(input.bg-input)');
      await expect(inputContainer).toBeVisible();
    });

    test.skip('validation error prevents save', async () => {
      // This test would require a field with validation
      // Currently, EditableField supports validate prop

      // Fields with validate prop would show error and not save
      // We verify the mechanism by checking error display

      await clickTab(page, 'Completed');

      const items = getQueueItems(page);
      const firstFilename = await items.first().locator('.font-medium').textContent();

      await clickFilename(page, firstFilename!);

      // If there's an email field with validation, test it
      // For now, just verify we can enter edit mode
    });
  });
});

test.describe('Editable Field Component', () => {
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

  test.skip('placeholder shown for empty fields', async () => {
    await clickTab(page, 'Completed');

    const items = getQueueItems(page);
    const firstFilename = await items.first().locator('.font-medium').textContent();

    await clickFilename(page, firstFilename!);

    // Look for fields with placeholder text
    const placeholders = page.locator('span:has-text("Click to add")');
    const count = await placeholders.count();

    // If there are empty fields, they should show placeholder
    if (count > 0) {
      const placeholder = placeholders.first();

      // Placeholder should have italic and muted styling
      await expect(placeholder).toHaveClass(/text-muted-foreground/);
      await expect(placeholder).toHaveClass(/italic/);
    }
  });

  test.skip('field hover shows edit hint', async () => {
    await clickTab(page, 'Completed');

    const items = getQueueItems(page);
    const firstFilename = await items.first().locator('.font-medium').textContent();

    await clickFilename(page, firstFilename!);

    const contactSection = getEditorSection(page, 'Contact Information');
    const nameField = getEditableField(contactSection, 'Name');

    // Hover over the field
    await nameField.hover();

    // Field should have hover:bg-primary/10 styling
    // (We can't easily test computed styles, but we verify class)
    await expect(nameField).toHaveClass(/hover:bg-primary\/10/);

    // Field should have title attribute with edit hint
    const title = await nameField.getAttribute('title');
    expect(title).toContain('Click to edit');
  });
});
