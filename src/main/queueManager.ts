/**
 * Queue Manager
 *
 * Manages CV processing queue in the main process.
 * - Persists CVs to database immediately on enqueue (status: 'queued')
 * - Processes one CV at a time (Python sidecar constraint)
 * - Starts timeout when processing begins, not on submission
 * - Pushes status updates to renderer via webContents.send
 */
import { BrowserWindow } from 'electron';
import {
  insertQueuedCV, updateCVStatus, completeCVProcessing,
  getNextQueuedCV, resetProcessingCVs, ParsedCV,
} from './database';
import { extractCV } from './pythonManager';

export interface QueueStatusUpdate {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  data?: ParsedCV;
  error?: string;
  parseConfidence?: number;
}

export interface EnqueueInput {
  fileName: string;
  filePath: string;
  projectId?: string;
}

export class QueueManager {
  private processing = false;
  private mainWindow: BrowserWindow | null = null;
  private readonly timeoutMs = 120000; // 120 seconds per CV

  constructor() {
    // Reset any 'processing' CVs from previous session
    const resetCount = resetProcessingCVs();
    if (resetCount > 0) {
      console.log(`QueueManager: Reset ${resetCount} stuck CVs to queued`);
    }
  }

  /**
   * Set the main window for push notifications.
   * Must be called after window is created.
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;

    // Handle window close - clear reference
    window.on('closed', () => {
      this.mainWindow = null;
    });
  }

  /**
   * Enqueue a CV for processing.
   * Immediately persists to database with status='queued'.
   * Returns the generated CV ID.
   */
  enqueue(input: EnqueueInput): string {
    // 1. Persist to database immediately
    const id = insertQueuedCV({
      filePath: input.filePath,
      fileName: input.fileName,
      projectId: input.projectId,
    });

    console.log(`QueueManager: Enqueued CV ${id} (${input.fileName})`);

    // 2. Notify UI
    this.notifyStatus({ id, status: 'queued' });

    // 3. Trigger processing (async, don't await)
    this.processNext();

    return id;
  }

  /**
   * Process the next queued CV.
   * Called automatically after enqueue and after each completion.
   */
  private async processNext(): Promise<void> {
    // Only one at a time
    if (this.processing) {
      return;
    }

    // Get next pending CV
    const next = getNextQueuedCV();
    if (!next) {
      return;
    }

    this.processing = true;
    const { id, file_path } = next;

    console.log(`QueueManager: Processing CV ${id} (${file_path})`);

    // Mark as processing in DB and notify UI
    // Timeout starts NOW (when processing actually begins)
    const startedAt = new Date().toISOString();
    updateCVStatus(id, 'processing', { startedAt });
    this.notifyStatus({ id, status: 'processing' });

    // Set up timeout
    const timeoutId = setTimeout(() => {
      this.handleTimeout(id);
    }, this.timeoutMs);

    try {
      // Extract CV using Python sidecar
      const result = await extractCV(file_path) as ParsedCV;

      // Clear timeout - processing succeeded
      clearTimeout(timeoutId);

      // Save extracted data and mark completed
      completeCVProcessing(id, result);

      console.log(`QueueManager: Completed CV ${id}`);

      // Notify UI with result
      this.notifyStatus({
        id,
        status: 'completed',
        data: result,
        parseConfidence: result.parse_confidence,
      });
    } catch (error) {
      // Clear timeout
      clearTimeout(timeoutId);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`QueueManager: Failed CV ${id}:`, errorMessage);

      // Mark as failed in DB
      updateCVStatus(id, 'failed', { error: errorMessage });

      // Notify UI
      this.notifyStatus({
        id,
        status: 'failed',
        error: errorMessage,
      });
    }

    this.processing = false;

    // Process next in queue
    this.processNext();
  }

  /**
   * Handle timeout for a CV.
   * Called when processing takes longer than timeoutMs.
   */
  private handleTimeout(id: string): void {
    console.warn(`QueueManager: Timeout for CV ${id}`);

    const errorMessage = 'Extraction timed out. The LLM may be overloaded - try again.';

    // Mark as failed in DB
    updateCVStatus(id, 'failed', { error: errorMessage });

    // Notify UI
    this.notifyStatus({
      id,
      status: 'failed',
      error: errorMessage,
    });

    // Note: processing flag will be cleared by the extractCV promise
    // eventually rejecting or the Python process crashing
  }

  /**
   * Push status update to renderer.
   */
  private notifyStatus(update: QueueStatusUpdate): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('queue-status-update', update);
    }
  }

  /**
   * Get current processing state (for debugging).
   */
  isProcessing(): boolean {
    return this.processing;
  }
}

// Singleton instance
let queueManager: QueueManager | null = null;

/**
 * Create and return the queue manager singleton.
 * Call once at app startup.
 */
export function createQueueManager(): QueueManager {
  if (!queueManager) {
    queueManager = new QueueManager();
  }
  return queueManager;
}

/**
 * Get the queue manager instance.
 * Throws if not initialized.
 */
export function getQueueManager(): QueueManager {
  if (!queueManager) {
    throw new Error('QueueManager not initialized. Call createQueueManager() first.');
  }
  return queueManager;
}
