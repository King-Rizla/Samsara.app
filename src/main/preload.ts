// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer, webUtils } from 'electron';

// Type definitions for better TypeScript support
interface ExtractResult {
  success: boolean;
  data?: unknown;
  id?: string;
  totalTime?: number;
  error?: string;
}

interface SelectFileResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  canceled?: boolean;
}

interface CVSummary {
  id: string;
  file_name: string;
  file_path?: string;
  contact_json: string;
  parse_confidence: number;
  created_at: string;
}

interface GetAllCVsResult {
  success: boolean;
  data?: CVSummary[];
  error?: string;
}

interface GetCVResult {
  success: boolean;
  data?: unknown;  // ParsedCV
  error?: string;
}

interface UpdateFieldResult {
  success: boolean;
  error?: string;
}

interface DeleteResult {
  success: boolean;
  error?: string;
}

/**
 * Expose protected methods to the renderer process.
 * This maintains security by using contextBridge instead of nodeIntegration.
 */
contextBridge.exposeInMainWorld('api', {
  /**
   * Extract CV from a file path.
   * Returns { success: boolean, data?: ParsedCV, id?: string, error?: string }
   */
  extractCV: (filePath: string): Promise<ExtractResult> =>
    ipcRenderer.invoke('extract-cv', filePath),

  /**
   * Get all stored CVs (summary info).
   * Returns { success: boolean, data?: CVSummary[], error?: string }
   */
  getAllCVs: (): Promise<GetAllCVsResult> =>
    ipcRenderer.invoke('get-all-cvs'),

  /**
   * Open native file dialog to select a CV file.
   * Returns { success: boolean, filePath?: string, fileName?: string, canceled?: boolean }
   */
  selectCVFile: (): Promise<SelectFileResult> =>
    ipcRenderer.invoke('select-cv-file'),

  /**
   * Get full CV data by ID.
   * Returns { success: boolean, data?: ParsedCV, error?: string }
   */
  getCV: (cvId: string): Promise<GetCVResult> =>
    ipcRenderer.invoke('get-cv', cvId),

  /**
   * Update a specific field in a CV.
   * fieldPath format: "contact.email", "work_history[0].company"
   * Returns { success: boolean, error?: string }
   */
  updateCVField: (cvId: string, fieldPath: string, value: unknown): Promise<UpdateFieldResult> =>
    ipcRenderer.invoke('update-cv-field', cvId, fieldPath, value),

  /**
   * Delete a CV by ID.
   * Returns { success: boolean, error?: string }
   */
  deleteCV: (cvId: string): Promise<DeleteResult> =>
    ipcRenderer.invoke('delete-cv', cvId),

  /**
   * Reprocess a CV (retry extraction).
   * Returns { success: boolean, data?: ParsedCV, error?: string }
   */
  reprocessCV: (filePath: string): Promise<ExtractResult> =>
    ipcRenderer.invoke('reprocess-cv', filePath),

  // JD (Job Description) operations

  /**
   * Extract JD from text and persist to database.
   * Returns { success: boolean, data?: JobDescription, error?: string }
   */
  extractJD: (text: string): Promise<{ success: boolean; data?: unknown; error?: string }> =>
    ipcRenderer.invoke('extract-jd', text),

  /**
   * Get all stored JDs (summary info).
   * Returns { success: boolean, data?: JDSummary[], error?: string }
   */
  getAllJDs: (): Promise<{ success: boolean; data?: unknown[]; error?: string }> =>
    ipcRenderer.invoke('get-all-jds'),

  /**
   * Get full JD data by ID.
   * Returns { success: boolean, data?: JobDescription, error?: string }
   */
  getJD: (jdId: string): Promise<{ success: boolean; data?: unknown; error?: string }> =>
    ipcRenderer.invoke('get-jd', jdId),

  /**
   * Delete a JD by ID.
   * Returns { success: boolean, error?: string }
   */
  deleteJD: (jdId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('delete-jd', jdId),
});

/**
 * Expose webUtils.getPathForFile directly.
 * This must be separate from the api object because File objects cannot be
 * serialized through contextBridge. We expose it on a separate namespace.
 */
contextBridge.exposeInMainWorld('electronFile', {
  /**
   * Get the file system path for a File object from drag-drop.
   * Only works in Electron, not in a browser.
   */
  getPath: (file: File): string | null => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return null;
    }
  },
});
