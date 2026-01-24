// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer, webUtils } from 'electron';

/**
 * Expose protected methods to the renderer process.
 * This maintains security by using contextBridge instead of nodeIntegration.
 */
contextBridge.exposeInMainWorld('api', {
  /**
   * Extract CV from a file path.
   * Returns { success: boolean, data?: ParsedCV, id?: string, error?: string }
   */
  extractCV: (filePath: string) => ipcRenderer.invoke('extract-cv', filePath),

  /**
   * Get all stored CVs (summary info).
   * Returns { success: boolean, data?: CVSummary[], error?: string }
   */
  getAllCVs: () => ipcRenderer.invoke('get-all-cvs'),

  /**
   * Open native file dialog to select a CV file.
   * Returns { success: boolean, filePath?: string, fileName?: string, canceled?: boolean }
   */
  selectCVFile: () => ipcRenderer.invoke('select-cv-file'),
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
