import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import * as fs from 'fs';
import started from 'electron-squirrel-startup';
import {
  initDatabase, closeDatabase,
  insertCV, getAllCVs, getCV, getCVFull, updateCVField, deleteCV, ParsedCV,
  insertJD, getJD, getAllJDs, deleteJD, ParsedJD,
  insertMatchResult, getMatchResultsForJD,
  createProject, getAllProjects, getProject, updateProject, deleteProject, getAggregateStats,
  getQueuedCVsByProject,
  recordUsageEvent,
  getAllUsageStats,
  updateProjectPinned,
  getPinnedProjects,
  reorderPinnedProjects,
} from './database';
import type { AppSettings } from './settings';
import { startPython, stopPython, extractCV, sendToPython, restartWithMode } from './pythonManager';
import { loadSettings, saveSettings, getRecruiterSettings, setRecruiterSettings } from './settings';
import { createQueueManager, getQueueManager } from './queueManager';

// Vite global variables for dev server and renderer name
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = (): BrowserWindow => {
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

  return mainWindow;
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

  // Initialize queue manager after database (resets stuck 'processing' CVs)
  const queueManager = createQueueManager();
  console.log('QueueManager initialized');

  // Load settings and start Python sidecar with configured mode
  try {
    const settings = loadSettings();
    console.log('Loaded settings:', { llmMode: settings.llmMode, hasApiKey: !!settings.openaiApiKey });
    await startPython(settings.llmMode, settings.openaiApiKey);
  } catch (error) {
    console.error('Failed to start Python sidecar:', error);
    // Continue app startup even if Python fails (for debugging)
  }

  // Create window and connect to queue manager for push notifications
  const mainWindow = createWindow();
  queueManager.setMainWindow(mainWindow);
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
ipcMain.handle('extract-cv', async (_event, filePath: string, projectId?: string) => {
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
    // Response includes token_usage from Python LLM clients
    const result = await extractCV(filePath) as ParsedCV & {
      token_usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        model?: string;
      };
    };

    // Persist to database with project association
    const id = insertCV(result, filePath, projectId);

    // Record usage for ALL extractions that consumed tokens
    // Use 'default-project' if no projectId provided
    const tokenUsage = result.token_usage;
    if (tokenUsage) {
      const settings = loadSettings();
      recordUsageEvent({
        projectId: projectId || 'default-project',
        eventType: 'cv_extraction',
        promptTokens: tokenUsage.prompt_tokens || 0,
        completionTokens: tokenUsage.completion_tokens || 0,
        totalTokens: tokenUsage.total_tokens || 0,
        llmMode: settings.llmMode,
        model: tokenUsage.model,
      });
    }

    const totalTime = Date.now() - startTime;
    console.log(`CV extraction and persistence completed in ${totalTime}ms`);

    return {
      success: true,
      data: result,
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
 * Optionally filter by projectId.
 */
ipcMain.handle('get-all-cvs', async (_event, projectId?: string) => {
  try {
    const cvs = getAllCVs(projectId);
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
ipcMain.handle('reprocess-cv', async (_event, filePath: string, projectId?: string, existingCvId?: string) => {
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

    let id: string;
    if (existingCvId) {
      // Retry: update existing failed record in-place
      completeCVProcessing(existingCvId, cvData);
      id = existingCvId;
    } else {
      // Fresh reprocess: create new entry
      id = insertCV(cvData, filePath, projectId);
    }

    const totalTime = Date.now() - startTime;
    console.log(`CV reprocess completed in ${totalTime}ms (${existingCvId ? 'retry' : 'new'})`);

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
ipcMain.handle('extract-jd', async (_event, text: string, projectId?: string) => {
  // Validate text
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return { success: false, error: 'Invalid or empty JD text' };
  }

  try {
    // Send to Python sidecar for LLM extraction
    // Response includes token_usage from Python LLM clients
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
      token_usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        model?: string;
      };
    };

    // Store in database with project association
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

    const id = insertJD(jdData, projectId);

    // Record usage for JD extraction that consumed tokens
    // Use 'default-project' if no projectId provided
    const tokenUsage = result.token_usage;
    if (tokenUsage) {
      const settings = loadSettings();
      recordUsageEvent({
        projectId: projectId || 'default-project',
        eventType: 'jd_extraction',
        promptTokens: tokenUsage.prompt_tokens || 0,
        completionTokens: tokenUsage.completion_tokens || 0,
        totalTokens: tokenUsage.total_tokens || 0,
        llmMode: settings.llmMode,
        model: tokenUsage.model,
      });
    }

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
 * Optionally filter by projectId.
 */
ipcMain.handle('get-all-jds', async (_event, projectId?: string) => {
  try {
    const jds = getAllJDs(projectId);
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

// ============================================================================
// CV-JD Matching IPC Handlers
// ============================================================================

/**
 * Helper: Flatten CV skills from grouped format into a normalized array.
 */
function flattenSkills(skillGroups: Array<{ category: string; skills: string[] }>): string[] {
  const skills: string[] = [];
  for (const group of skillGroups) {
    skills.push(...group.skills.map(s => s.toLowerCase().trim()));
  }
  return skills;
}

/**
 * Helper: Check if a skill matches any CV skill (exact or substring).
 */
function skillMatches(needle: string, haystack: string[]): boolean {
  const normalized = needle.toLowerCase().trim();

  // Exact match
  if (haystack.includes(normalized)) return true;

  // Substring match
  for (const skill of haystack) {
    if (skill.includes(normalized) || normalized.includes(skill)) {
      return true;
    }
  }

  return false;
}

/**
 * Helper: Calculate match score for a CV-JD pair.
 */
function calculateMatch(
  cvId: string,
  jdId: string,
  cvSkills: string[],
  requiredSkills: Array<{ skill: string }>,
  preferredSkills: Array<{ skill: string }>
) {
  const matchedRequired: string[] = [];
  const missingRequired: string[] = [];
  const matchedPreferred: string[] = [];
  const missingPreferred: string[] = [];

  for (const req of requiredSkills) {
    if (skillMatches(req.skill, cvSkills)) {
      matchedRequired.push(req.skill);
    } else {
      missingRequired.push(req.skill);
    }
  }

  for (const pref of preferredSkills) {
    if (skillMatches(pref.skill, cvSkills)) {
      matchedPreferred.push(pref.skill);
    } else {
      missingPreferred.push(pref.skill);
    }
  }

  // 70% required, 30% preferred
  const requiredScore = requiredSkills.length > 0
    ? (matchedRequired.length / requiredSkills.length) * 0.7
    : 0.7;

  const preferredScore = preferredSkills.length > 0
    ? (matchedPreferred.length / preferredSkills.length) * 0.3
    : 0.3;

  return {
    cv_id: cvId,
    jd_id: jdId,
    match_score: Math.round((requiredScore + preferredScore) * 100),
    matched_skills: [...matchedRequired, ...matchedPreferred],
    missing_required: missingRequired,
    missing_preferred: missingPreferred,
    calculated_at: new Date().toISOString(),
  };
}

/**
 * Match multiple CVs against a JD.
 * Calculates match scores and stores results in database.
 * Returns { success: true, results: MatchResult[] } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle('match-cvs-to-jd', async (_event, jdId: string, cvIds: string[]) => {
  try {
    const jd = getJD(jdId);
    if (!jd) {
      return { success: false, error: 'JD not found' };
    }

    // Parse JD skills from JSON
    const requiredSkills = jd.required_skills || [];
    const preferredSkills = jd.preferred_skills || [];

    const results = [];

    for (const cvId of cvIds) {
      const cv = getCVFull(cvId);
      if (!cv) continue;

      // Calculate match using simplified main-process logic
      const cvSkills = flattenSkills(cv.skills);
      const matchResult = calculateMatch(
        cvId,
        jdId,
        cvSkills,
        requiredSkills,
        preferredSkills
      );

      // Store in database
      insertMatchResult(matchResult);
    }

    // Return ALL match results for this JD (not just newly calculated ones)
    // This ensures previously matched CVs are preserved in the results
    const allResults = getMatchResultsForJD(jdId);
    const parsedResults = allResults.map(r => ({
      cv_id: r.cv_id,
      jd_id: r.jd_id,
      match_score: r.match_score,
      matched_skills: JSON.parse(r.matched_skills_json || '[]'),
      missing_required: JSON.parse(r.missing_required_json || '[]'),
      missing_preferred: JSON.parse(r.missing_preferred_json || '[]'),
      calculated_at: r.calculated_at,
    }));

    return { success: true, results: parsedResults };
  } catch (error) {
    console.error('match-cvs-to-jd error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Match calculation failed'
    };
  }
});

/**
 * Get match results for a JD.
 * Returns { success: true, data: MatchResult[] } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle('get-match-results', async (_event, jdId: string) => {
  try {
    const results = getMatchResultsForJD(jdId);

    // Parse JSON fields
    const parsed = results.map(r => ({
      cv_id: r.cv_id,
      jd_id: r.jd_id,
      match_score: r.match_score,
      matched_skills: JSON.parse(r.matched_skills_json || '[]'),
      missing_required: JSON.parse(r.missing_required_json || '[]'),
      missing_preferred: JSON.parse(r.missing_preferred_json || '[]'),
      calculated_at: r.calculated_at,
    }));

    return { success: true, data: parsed };
  } catch (error) {
    console.error('get-match-results error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get match results'
    };
  }
});

// ============================================================================
// Settings IPC Handlers
// ============================================================================

/**
 * Get current LLM settings.
 * Returns { llmMode: 'local' | 'cloud', hasApiKey: boolean }
 */
ipcMain.handle('get-llm-settings', async () => {
  try {
    const settings = loadSettings();
    return {
      success: true,
      data: {
        llmMode: settings.llmMode,
        hasApiKey: !!settings.openaiApiKey,
      }
    };
  } catch (error) {
    console.error('get-llm-settings error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get settings'
    };
  }
});

/**
 * Set LLM mode and optionally API key.
 * Will restart Python sidecar with new settings.
 */
ipcMain.handle('set-llm-settings', async (_event, mode: 'local' | 'cloud', apiKey?: string) => {
  console.log('set-llm-settings called:', { mode, hasApiKey: !!apiKey, apiKeyLength: apiKey?.length });
  try {
    // Save settings
    const updates: { llmMode: 'local' | 'cloud'; openaiApiKey?: string } = { llmMode: mode };
    if (apiKey !== undefined) {
      updates.openaiApiKey = apiKey;
    }
    console.log('Saving settings with updates:', { ...updates, openaiApiKey: updates.openaiApiKey ? '[REDACTED]' : undefined });
    const settings = saveSettings(updates);
    console.log('Settings saved:', { llmMode: settings.llmMode, hasApiKey: !!settings.openaiApiKey });

    // Restart Python with new mode
    await restartWithMode(mode, settings.openaiApiKey);

    return {
      success: true,
      data: {
        llmMode: settings.llmMode,
        hasApiKey: !!settings.openaiApiKey,
      }
    };
  } catch (error) {
    console.error('set-llm-settings error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save settings'
    };
  }
});

// ============================================================================
// Project IPC Handlers
// ============================================================================

/**
 * Create a new project.
 * Returns { success: true, data: ProjectSummary } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle('create-project', async (_event, input: { name: string; client_name?: string; description?: string }) => {
  try {
    const project = createProject(input);
    return { success: true, data: project };
  } catch (error) {
    console.error('Failed to create project:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create project' };
  }
});

/**
 * Get all projects with CV/JD counts.
 * Returns { success: true, data: ProjectSummary[] } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle('get-all-projects', async (_event, includeArchived?: boolean) => {
  try {
    const projects = getAllProjects(includeArchived);
    return { success: true, data: projects };
  } catch (error) {
    console.error('Failed to get projects:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get projects' };
  }
});

/**
 * Get a single project by ID.
 * Returns { success: true, data: ProjectSummary } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle('get-project', async (_event, id: string) => {
  try {
    const project = getProject(id);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }
    return { success: true, data: project };
  } catch (error) {
    console.error('Failed to get project:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get project' };
  }
});

/**
 * Update a project.
 * Returns { success: true } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle('update-project', async (_event, id: string, updates: { name?: string; client_name?: string; description?: string; is_archived?: boolean }) => {
  try {
    const success = updateProject(id, updates);
    if (!success) {
      return { success: false, error: 'Project not found' };
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to update project:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update project' };
  }
});

/**
 * Delete a project and all its data.
 * Returns { success: true } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle('delete-project', async (_event, id: string) => {
  try {
    const success = deleteProject(id);
    if (!success) {
      return { success: false, error: 'Project not found' };
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to delete project:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete project' };
  }
});

/**
 * Get aggregate stats across all projects.
 * Returns { success: true, data: { total_cvs, total_jds } } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle('get-aggregate-stats', async () => {
  try {
    const stats = getAggregateStats();
    return { success: true, data: stats };
  } catch (error) {
    console.error('Failed to get aggregate stats:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get aggregate stats' };
  }
});

// ============================================================================
// Queue IPC Handlers (Phase 4.6)
// ============================================================================

/**
 * Enqueue a CV for processing.
 * Immediately persists to database with status='queued'.
 * Returns { success: true, id: string } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle('enqueue-cv', async (_event, fileName: string, filePath: string, projectId?: string) => {
  try {
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

    // Enqueue via queue manager
    const id = getQueueManager().enqueue({ fileName, filePath, projectId });

    return { success: true, id };
  } catch (error) {
    console.error('Failed to enqueue CV:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to enqueue CV'
    };
  }
});

/**
 * Get all queued/processing CVs for a project.
 * Returns { success: true, data: QueuedCV[] } on success
 */
ipcMain.handle('get-queued-cvs', async (_event, projectId?: string) => {
  try {
    const cvs = getQueuedCVsByProject(projectId);
    return { success: true, data: cvs };
  } catch (error) {
    console.error('Failed to get queued CVs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get queued CVs'
    };
  }
});

// ============================================================================
// Usage Tracking & Pinning IPC Handlers (Phase 4.7)
// ============================================================================

/**
 * Get usage stats for current month.
 * Returns global and per-project token counts.
 */
ipcMain.handle('get-usage-stats', async () => {
  try {
    const stats = getAllUsageStats();
    return { success: true, data: stats };
  } catch (error) {
    console.error('get-usage-stats error:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Pin or unpin a project for quick sidebar access.
 */
ipcMain.handle('set-pinned-project', async (_event, projectId: string, isPinned: boolean) => {
  try {
    const success = updateProjectPinned(projectId, isPinned);
    return { success };
  } catch (error) {
    console.error('set-pinned-project error:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Get all pinned projects in order.
 */
ipcMain.handle('get-pinned-projects', async () => {
  try {
    const projects = getPinnedProjects();
    return { success: true, data: projects };
  } catch (error) {
    console.error('get-pinned-projects error:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Reorder pinned projects after drag-drop.
 * @param projectIds - Array of project IDs in new order
 */
ipcMain.handle('reorder-pinned-projects', async (_event, projectIds: string[]) => {
  try {
    reorderPinnedProjects(projectIds);
    return { success: true };
  } catch (error) {
    console.error('reorder-pinned-projects error:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Get all app settings including usage limits.
 */
ipcMain.handle('get-app-settings', async () => {
  try {
    const settings = loadSettings();
    // Don't expose API key directly, just whether it exists
    return {
      success: true,
      data: {
        llmMode: settings.llmMode,
        hasApiKey: Boolean(settings.openaiApiKey),
        globalTokenLimit: settings.globalTokenLimit,
        warningThreshold: settings.warningThreshold ?? 80,
      },
    };
  } catch (error) {
    console.error('get-app-settings error:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Update app settings (excluding API key - use setLLMSettings for that).
 */
ipcMain.handle('update-app-settings', async (_event, updates: Partial<Omit<AppSettings, 'openaiApiKey'>>) => {
  try {
    const updated = saveSettings(updates);
    return {
      success: true,
      data: {
        llmMode: updated.llmMode,
        hasApiKey: Boolean(updated.openaiApiKey),
        globalTokenLimit: updated.globalTokenLimit,
        warningThreshold: updated.warningThreshold ?? 80,
      },
    };
  } catch (error) {
    console.error('update-app-settings error:', error);
    return { success: false, error: String(error) };
  }
});

// ============================================================================
// CV Export IPC Handlers (Phase 5)
// ============================================================================

/**
 * Export CV with optional redaction and blind profile.
 * mode: 'full' | 'client' | 'punt'
 *   - full: No redaction
 *   - client: Remove phone and email (default)
 *   - punt: Remove phone, email, AND name
 * includeBlindProfile: Whether to prepend one-page summary (default: true)
 * Returns { success: true, outputPath: string } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle('export-cv', async (_event, cvId: string, mode: string, outputDir?: string, includeBlindProfile: boolean = true) => {
  try {
    // Get CV record for file_path
    const cvRecord = getCV(cvId);
    if (!cvRecord) {
      return { success: false, error: 'CV not found' };
    }

    // Get CV data for contact info and blind profile
    const cvData = getCVFull(cvId);
    if (!cvData) {
      return { success: false, error: 'CV data not found' };
    }

    // Validate mode
    const validModes = ['full', 'client', 'punt'];
    if (!validModes.includes(mode)) {
      return { success: false, error: `Invalid mode: ${mode}. Must be one of: full, client, punt` };
    }

    // Default output directory to Downloads folder
    const actualOutputDir = outputDir || app.getPath('downloads');

    // Ensure output directory exists
    if (!fs.existsSync(actualOutputDir)) {
      return { success: false, error: `Output directory does not exist: ${actualOutputDir}` };
    }

    // Get recruiter settings for blind profile footer
    const recruiter = getRecruiterSettings();

    // Call Python sidecar for export
    const result = await sendToPython({
      action: 'export_cv',
      cv_id: cvId,
      source_path: cvRecord.file_path,
      contact_info: cvData.contact || {},
      mode: mode,
      output_dir: actualOutputDir,
      include_blind_profile: includeBlindProfile,
      recruiter: recruiter,
      cv_data: cvData  // Full CV data for blind profile generation
    }) as { output_path: string; mode: string; redacted_fields: string[]; has_blind_profile?: boolean };

    console.log(`CV export completed: ${result.output_path} (mode: ${result.mode}, blind_profile: ${result.has_blind_profile ?? false})`);

    return {
      success: true,
      outputPath: result.output_path
    };
  } catch (error) {
    console.error('export-cv error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export CV'
    };
  }
});

// ============================================================================
// Recruiter Settings IPC Handlers (Phase 5)
// ============================================================================

/**
 * Get recruiter settings for blind profile footer.
 * Returns { success: true, data: RecruiterSettings } on success
 */
ipcMain.handle('get-recruiter-settings', async () => {
  try {
    const settings = getRecruiterSettings();
    return { success: true, data: settings };
  } catch (error) {
    console.error('get-recruiter-settings error:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Set recruiter settings for blind profile footer.
 * Returns { success: true } on success
 */
ipcMain.handle('set-recruiter-settings', async (_event, settings: { name?: string; phone?: string; email?: string }) => {
  try {
    setRecruiterSettings(settings);
    return { success: true };
  } catch (error) {
    console.error('set-recruiter-settings error:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Open folder selection dialog.
 * Returns { canceled: false, path: string } on selection
 * Returns { canceled: true } if user cancels
 */
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select export folder'
  });
  return {
    canceled: result.canceled,
    path: result.filePaths[0]
  };
});
