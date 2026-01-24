// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

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
});
