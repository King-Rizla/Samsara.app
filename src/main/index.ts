import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import * as fs from 'fs';
import started from 'electron-squirrel-startup';
import { initDatabase, closeDatabase, insertCV, getAllCVs, ParsedCV } from './database';
import { startPython, stopPython, extractCV } from './pythonManager';

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
