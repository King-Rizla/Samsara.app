import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import * as fs from 'fs';
import started from 'electron-squirrel-startup';
import { initDatabase, closeDatabase, insertCV, getAllCVs, getCVFull, updateCVField, deleteCV, ParsedCV, insertJD, getJD, getAllJDs, deleteJD, ParsedJD } from './database';
import { startPython, stopPython, extractCV, sendToPython } from './pythonManager';

// Vite global variables for dev server and renderer name
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  console.log('App is ready, userData path:', app.getPath('userData'));
  // Initialize database before creating window
  try {
    initDatabase();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
  }

  // Start Python sidecar
  try {
    await startPython();
  } catch (error) {
    console.error('Failed to start Python sidecar:', error);
    // Continue app startup even if Python fails (for debugging)
  }

  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  stopPython();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Close database and Python before app quits
app.on('before-quit', () => {
  stopPython();
  closeDatabase();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// IPC Handlers

/**
 * Extract CV from a file and persist to database.
 * Returns { success: true, data: ParsedCV, id: string } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle('extract-cv', async (_event, filePath: string) => {
  const startTime = Date.now();

  // Validate file path
  if (!filePath || typeof filePath !== 'string') {
    return { success: false, error: 'Invalid file path' };
  }

  // Check file exists
  if (!fs.existsSync(filePath)) {
    return { success: false, error: `File not found: ${filePath}` };
  }

  // Check file extension
  const ext = path.extname(filePath).toLowerCase();
  const validExtensions = ['.pdf', '.docx', '.doc'];
  if (!validExtensions.includes(ext)) {
    return {
      success: false,
      error: `Unsupported file type: ${ext}. Supported formats: PDF, DOCX, DOC`
    };
  }

  try {
    // Extract CV using Python sidecar
    const cvData = await extractCV(filePath) as ParsedCV;

    // Persist to database
    const id = insertCV(cvData, filePath);

    const totalTime = Date.now() - startTime;
    console.log(`CV extraction and persistence completed in ${totalTime}ms`);

    return {
      success: true,
      data: cvData,
      id,
      totalTime
    };
  } catch (error) {
    console.error('CV extraction failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during CV extraction'
    };
  }
});

/**
 * Get all stored CVs (summary info only).
 */
ipcMain.handle('get-all-cvs', async () => {
  try {
    const cvs = getAllCVs();
    return { success: true, data: cvs };
  } catch (error) {
    console.error('Failed to get CVs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

/**
 * Open file dialog to select a CV file.
 * Returns { success: true, filePath: string, fileName: string } on selection
 * Returns { success: false, canceled: true } if user cancels
 */
ipcMain.handle('select-cv-file', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select CV File',
    filters: [
      { name: 'CV Documents', extensions: ['pdf', 'docx', 'doc'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true };
  }

  const filePath = result.filePaths[0];
  const fileName = path.basename(filePath);

  return { success: true, filePath, fileName };
});

/**
 * Get file path from a dropped file by reading it from the main process.
 * The renderer sends the file name and we validate it exists.
 * For drag-drop with webkitGetAsEntry, we need the full path.
 */
ipcMain.handle('get-dropped-file-path', async (_event, webkitRelativePath: string) => {
  // This handler exists as a fallback, but in Electron, dropped files
  // should have the path property available. If we get here, something went wrong.
  console.warn('get-dropped-file-path called with:', webkitRelativePath);
  return { success: false, error: 'File path not available. Please use the file picker instead.' };
});

/**
 * Get full CV data by ID.
 * Returns { success: true, data: ParsedCV } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle('get-cv', async (_event, cvId: string) => {
  try {
    const data = getCVFull(cvId);
    if (!data) {
      return { success: false, error: 'CV not found' };
    }
    return { success: true, data };
  } catch (error) {
    console.error('get-cv error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Update a specific field in a CV.
 * fieldPath format: "contact.email", "work_history[0].company"
 * Returns { success: true } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle('update-cv-field', async (_event, cvId: string, fieldPath: string, value: unknown) => {
  try {
    const success = updateCVField(cvId, fieldPath, value);
    return { success };
  } catch (error) {
    console.error('update-cv-field error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Delete a CV by ID.
 * Returns { success: true } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle('delete-cv', async (_event, cvId: string) => {
  try {
    const success = deleteCV(cvId);
    return { success };
  } catch (error) {
    console.error('delete-cv error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Reprocess a CV (retry extraction).
 * This re-uses the extract-cv logic for retrying failed CVs.
 * Returns { success: true, data: ParsedCV, id: string } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle('reprocess-cv', async (_event, filePath: string) => {
  const startTime = Date.now();

  // Validate file path
  if (!filePath || typeof filePath !== 'string') {
    return { success: false, error: 'Invalid file path' };
  }

  // Check file exists
  if (!fs.existsSync(filePath)) {
    return { success: false, error: `File not found: ${filePath}` };
  }

  // Check file extension
  const ext = path.extname(filePath).toLowerCase();
  const validExtensions = ['.pdf', '.docx', '.doc'];
  if (!validExtensions.includes(ext)) {
    return {
      success: false,
      error: `Unsupported file type: ${ext}. Supported formats: PDF, DOCX, DOC`
    };
  }

  try {
    // Extract CV using Python sidecar (same as extract-cv)
    const cvData = await extractCV(filePath) as ParsedCV;

    // Persist to database (creates new entry)
    const id = insertCV(cvData, filePath);

    const totalTime = Date.now() - startTime;
    console.log(`CV reprocess completed in ${totalTime}ms`);

    return {
      success: true,
      data: cvData,
      id,
      totalTime
    };
  } catch (error) {
    console.error('CV reprocess failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during CV reprocessing'
    };
  }
});

// ============================================================================
// JD (Job Description) IPC Handlers
// ============================================================================

/**
 * Extract JD from text and persist to database.
 * Returns { success: true, data: JobDescription } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle('extract-jd', async (_event, text: string) => {
  // Validate text
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return { success: false, error: 'Invalid or empty JD text' };
  }

  try {
    // Send to Python sidecar for LLM extraction
    const result = await sendToPython({
      action: 'extract_jd',
      text,
    }, 120000) as {
      title: string;
      company?: string;
      required_skills: Array<{ skill: string; importance: string; category?: string }>;
      preferred_skills: Array<{ skill: string; importance: string; category?: string }>;
      experience_min?: number;
      experience_max?: number;
      education_level?: string;
      certifications: string[];
      extract_time_ms: number;
    };

    // Store in database
    const jdData: ParsedJD = {
      title: result.title,
      company: result.company,
      raw_text: text,
      required_skills: result.required_skills,
      preferred_skills: result.preferred_skills,
      experience_min: result.experience_min,
      experience_max: result.experience_max,
      education_level: result.education_level,
      certifications: result.certifications || [],
    };

    const id = insertJD(jdData);

    // Return full JD with ID
    const jd = getJD(id);
    return { success: true, data: jd };
  } catch (error) {
    console.error('JD extraction failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract JD'
    };
  }
});

/**
 * Get all stored JDs (summary info only).
 */
ipcMain.handle('get-all-jds', async () => {
  try {
    const jds = getAllJDs();
    return { success: true, data: jds };
  } catch (error) {
    console.error('Failed to get JDs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

/**
 * Get full JD data by ID.
 * Returns { success: true, data: JobDescription } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle('get-jd', async (_event, jdId: string) => {
  try {
    const jd = getJD(jdId);
    if (!jd) {
      return { success: false, error: 'JD not found' };
    }
    return { success: true, data: jd };
  } catch (error) {
    console.error('get-jd error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Delete a JD by ID.
 * Returns { success: true } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle('delete-jd', async (_event, jdId: string) => {
  try {
    const deleted = deleteJD(jdId);
    return { success: deleted, error: deleted ? undefined : 'JD not found' };
  } catch (error) {
    console.error('delete-jd error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});
