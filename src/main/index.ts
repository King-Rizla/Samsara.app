import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "node:path";
import * as fs from "fs";
import * as fsPromises from "fs/promises";
import started from "electron-squirrel-startup";
import {
  initDatabase,
  closeDatabase,
  insertCV,
  getAllCVs,
  getCV,
  getCVFull,
  updateCVField,
  deleteCV,
  ParsedCV,
  insertJD,
  getJD,
  getAllJDs,
  deleteJD,
  ParsedJD,
  insertMatchResult,
  getMatchResultsForJD,
  createProject,
  getAllProjects,
  getProject,
  updateProject,
  deleteProject,
  getAggregateStats,
  getQueuedCVsByProject,
  recordUsageEvent,
  getAllUsageStats,
  updateProjectPinned,
  getPinnedProjects,
  reorderPinnedProjects,
  createTemplate,
  getTemplate,
  getTemplatesByProject,
  updateTemplate,
  deleteTemplate,
  getMessagesByCV,
  getMessagesByProject,
  completeCVProcessing,
} from "./database";
import {
  previewTemplate,
  AVAILABLE_VARIABLES,
  renderTemplate,
} from "./templateEngine";
import type { AppSettings } from "./settings";
import {
  startPython,
  stopPython,
  extractCV,
  sendToPython,
  restartWithMode,
} from "./pythonManager";
import {
  loadSettings,
  saveSettings,
  getRecruiterSettings,
  setRecruiterSettings,
} from "./settings";
import { createQueueManager, getQueueManager } from "./queueManager";
import {
  storeCredential,
  deleteCredential,
  hasCredential,
  isEncryptionAvailable,
  testTwilioCredentials,
  testSmtpCredentials,
  type ProviderType,
  type CredentialType,
} from "./credentialManager";
import { startVoicePoller, stopVoicePoller } from "./voicePoller";
import { isVoiceConfigured } from "./voiceService";

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
      preload: path.join(__dirname, "preload.js"),
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
  console.log("App is ready, userData path:", app.getPath("userData"));
  // Initialize database before creating window
  try {
    initDatabase();
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Database initialization failed:", error);
  }

  // Initialize queue manager after database (resets stuck 'processing' CVs)
  const queueManager = createQueueManager();
  console.log("QueueManager initialized");

  // Initialize workflow service (restores active workflows from database)
  try {
    initializeWorkflows();
    console.log("Workflow service initialized");
  } catch (error) {
    console.error("Workflow initialization failed:", error);
  }

  // Start voice poller for in-progress screening calls (Phase 11)
  try {
    startVoicePoller();
    console.log("Voice poller started");
  } catch (error) {
    console.error("Voice poller failed to start:", error);
  }

  // Load settings and start Python sidecar with configured mode
  try {
    const settings = loadSettings();
    console.log("Loaded settings:", {
      llmMode: settings.llmMode,
      hasApiKey: !!settings.openaiApiKey,
    });
    await startPython(settings.llmMode, settings.openaiApiKey);
  } catch (error) {
    console.error("Failed to start Python sidecar:", error);
    // Continue app startup even if Python fails (for debugging)
  }

  // Create window and connect to queue manager for push notifications
  const mainWindow = createWindow();
  queueManager.setMainWindow(mainWindow);
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  stopPython();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Close database, Python, workflows, and voice poller before app quits
app.on("before-quit", () => {
  stopVoicePoller();
  stopAllWorkflows();
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
ipcMain.handle(
  "extract-cv",
  async (_event, filePath: string, projectId?: string) => {
    const startTime = Date.now();

    // Validate file path
    if (!filePath || typeof filePath !== "string") {
      return { success: false, error: "Invalid file path" };
    }

    // Check file exists
    if (!fs.existsSync(filePath)) {
      return { success: false, error: `File not found: ${filePath}` };
    }

    // Check file extension
    const ext = path.extname(filePath).toLowerCase();
    const validExtensions = [".pdf", ".docx", ".doc"];
    if (!validExtensions.includes(ext)) {
      return {
        success: false,
        error: `Unsupported file type: ${ext}. Supported formats: PDF, DOCX, DOC`,
      };
    }

    try {
      // Extract CV using Python sidecar
      // Response includes token_usage from Python LLM clients
      const result = (await extractCV(filePath)) as ParsedCV & {
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
          projectId: projectId || "default-project",
          eventType: "cv_extraction",
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
        totalTime,
      };
    } catch (error) {
      console.error("CV extraction failed:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error during CV extraction",
      };
    }
  },
);

/**
 * Get all stored CVs (summary info only).
 * Optionally filter by projectId.
 */
ipcMain.handle("get-all-cvs", async (_event, projectId?: string) => {
  try {
    const cvs = getAllCVs(projectId);
    return { success: true, data: cvs };
  } catch (error) {
    console.error("Failed to get CVs:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});

/**
 * Open file dialog to select a CV file.
 * Returns { success: true, filePath: string, fileName: string } on selection
 * Returns { success: false, canceled: true } if user cancels
 */
ipcMain.handle("select-cv-file", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select CV File",
    filters: [{ name: "CV Documents", extensions: ["pdf", "docx", "doc"] }],
    properties: ["openFile", "openDirectory", "multiSelections"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true };
  }

  return {
    success: true,
    filePaths: result.filePaths,
    // Keep single-file compat
    filePath: result.filePaths[0],
    fileName: path.basename(result.filePaths[0]),
  };
});

/**
 * Get file path from a dropped file by reading it from the main process.
 * The renderer sends the file name and we validate it exists.
 * For drag-drop with webkitGetAsEntry, we need the full path.
 */
ipcMain.handle(
  "get-dropped-file-path",
  async (_event, webkitRelativePath: string) => {
    // This handler exists as a fallback, but in Electron, dropped files
    // should have the path property available. If we get here, something went wrong.
    console.warn("get-dropped-file-path called with:", webkitRelativePath);
    return {
      success: false,
      error: "File path not available. Please use the file picker instead.",
    };
  },
);

/**
 * Get full CV data by ID.
 * Returns { success: true, data: ParsedCV } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle("get-cv", async (_event, cvId: string) => {
  try {
    const data = getCVFull(cvId);
    if (!data) {
      return { success: false, error: "CV not found" };
    }
    return { success: true, data };
  } catch (error) {
    console.error("get-cv error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});

/**
 * Update a specific field in a CV.
 * fieldPath format: "contact.email", "work_history[0].company"
 * Returns { success: true } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle(
  "update-cv-field",
  async (_event, cvId: string, fieldPath: string, value: unknown) => {
    try {
      const success = updateCVField(cvId, fieldPath, value);
      return { success };
    } catch (error) {
      console.error("update-cv-field error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
);

/**
 * Delete a CV by ID.
 * Returns { success: true } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle("delete-cv", async (_event, cvId: string) => {
  try {
    const success = deleteCV(cvId);
    return { success };
  } catch (error) {
    console.error("delete-cv error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});

/**
 * Reprocess a CV (retry extraction).
 * This re-uses the extract-cv logic for retrying failed CVs.
 * Returns { success: true, data: ParsedCV, id: string } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle(
  "reprocess-cv",
  async (
    _event,
    filePath: string,
    projectId?: string,
    existingCvId?: string,
  ) => {
    const startTime = Date.now();

    // Validate file path
    if (!filePath || typeof filePath !== "string") {
      return { success: false, error: "Invalid file path" };
    }

    // Check file exists
    if (!fs.existsSync(filePath)) {
      return { success: false, error: `File not found: ${filePath}` };
    }

    // Check file extension
    const ext = path.extname(filePath).toLowerCase();
    const validExtensions = [".pdf", ".docx", ".doc"];
    if (!validExtensions.includes(ext)) {
      return {
        success: false,
        error: `Unsupported file type: ${ext}. Supported formats: PDF, DOCX, DOC`,
      };
    }

    try {
      // Extract CV using Python sidecar (same as extract-cv)
      const cvData = (await extractCV(filePath)) as ParsedCV;

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
      console.log(
        `CV reprocess completed in ${totalTime}ms (${existingCvId ? "retry" : "new"})`,
      );

      return {
        success: true,
        data: cvData,
        id,
        totalTime,
      };
    } catch (error) {
      console.error("CV reprocess failed:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error during CV reprocessing",
      };
    }
  },
);

// ============================================================================
// JD (Job Description) IPC Handlers
// ============================================================================

/**
 * Extract JD from text and persist to database.
 * Returns { success: true, data: JobDescription } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle(
  "extract-jd",
  async (_event, text: string, projectId?: string) => {
    // Validate text
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return { success: false, error: "Invalid or empty JD text" };
    }

    try {
      // Send to Python sidecar for LLM extraction
      // Response includes token_usage from Python LLM clients
      const result = (await sendToPython(
        {
          action: "extract_jd",
          text,
        },
        120000,
      )) as {
        title: string;
        company?: string;
        required_skills: Array<{
          skill: string;
          importance: string;
          category?: string;
        }>;
        preferred_skills: Array<{
          skill: string;
          importance: string;
          category?: string;
        }>;
        experience_min?: number;
        experience_max?: number;
        education_level?: string;
        certifications: string[];
        matching_metadata?: unknown;
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
        matching_metadata: result.matching_metadata,
      };

      const id = insertJD(jdData, projectId);

      // Record usage for JD extraction that consumed tokens
      // Use 'default-project' if no projectId provided
      const tokenUsage = result.token_usage;
      if (tokenUsage) {
        const settings = loadSettings();
        recordUsageEvent({
          projectId: projectId || "default-project",
          eventType: "jd_extraction",
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
      console.error("JD extraction failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to extract JD",
      };
    }
  },
);

/**
 * Get all stored JDs (summary info only).
 * Optionally filter by projectId.
 */
ipcMain.handle("get-all-jds", async (_event, projectId?: string) => {
  try {
    const jds = getAllJDs(projectId);
    return { success: true, data: jds };
  } catch (error) {
    console.error("Failed to get JDs:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});

/**
 * Get full JD data by ID.
 * Returns { success: true, data: JobDescription } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle("get-jd", async (_event, jdId: string) => {
  try {
    const jd = getJD(jdId);
    if (!jd) {
      return { success: false, error: "JD not found" };
    }
    return { success: true, data: jd };
  } catch (error) {
    console.error("get-jd error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});

/**
 * Delete a JD by ID.
 * Returns { success: true } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle("delete-jd", async (_event, jdId: string) => {
  try {
    const deleted = deleteJD(jdId);
    return { success: deleted, error: deleted ? undefined : "JD not found" };
  } catch (error) {
    console.error("delete-jd error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});

// ============================================================================
// CV-JD Matching IPC Handlers
// ============================================================================

/**
 * Helper: Flatten CV skills from grouped format into a normalized array.
 */
function flattenSkills(
  skillGroups: Array<{ category: string; skills: string[] }>,
): string[] {
  const skills: string[] = [];
  for (const group of skillGroups) {
    skills.push(...group.skills.map((s) => s.toLowerCase().trim()));
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
  preferredSkills: Array<{ skill: string }>,
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
  const requiredScore =
    requiredSkills.length > 0
      ? (matchedRequired.length / requiredSkills.length) * 0.7
      : 0.7;

  const preferredScore =
    preferredSkills.length > 0
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
ipcMain.handle(
  "match-cvs-to-jd",
  async (_event, jdId: string, cvIds: string[]) => {
    try {
      const jd = getJD(jdId);
      if (!jd) {
        return { success: false, error: "JD not found" };
      }

      // Parse JD skills from JSON
      const requiredSkills = jd.required_skills || [];
      const preferredSkills = jd.preferred_skills || [];

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
          preferredSkills,
        );

        // Store in database
        insertMatchResult(matchResult);
      }

      // Return ALL match results for this JD (not just newly calculated ones)
      // This ensures previously matched CVs are preserved in the results
      const allResults = getMatchResultsForJD(jdId);
      const parsedResults = allResults.map((r) => ({
        cv_id: r.cv_id,
        jd_id: r.jd_id,
        match_score: r.match_score,
        matched_skills: JSON.parse(r.matched_skills_json || "[]"),
        missing_required: JSON.parse(r.missing_required_json || "[]"),
        missing_preferred: JSON.parse(r.missing_preferred_json || "[]"),
        calculated_at: r.calculated_at,
      }));

      return { success: true, results: parsedResults };
    } catch (error) {
      console.error("match-cvs-to-jd error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Match calculation failed",
      };
    }
  },
);

/**
 * Get match results for a JD.
 * Returns { success: true, data: MatchResult[] } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle("get-match-results", async (_event, jdId: string) => {
  try {
    const results = getMatchResultsForJD(jdId);

    // Parse JSON fields
    const parsed = results.map((r) => ({
      cv_id: r.cv_id,
      jd_id: r.jd_id,
      match_score: r.match_score,
      matched_skills: JSON.parse(r.matched_skills_json || "[]"),
      missing_required: JSON.parse(r.missing_required_json || "[]"),
      missing_preferred: JSON.parse(r.missing_preferred_json || "[]"),
      calculated_at: r.calculated_at,
    }));

    return { success: true, data: parsed };
  } catch (error) {
    console.error("get-match-results error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to get match results",
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
ipcMain.handle("get-llm-settings", async () => {
  try {
    const settings = loadSettings();
    return {
      success: true,
      data: {
        llmMode: settings.llmMode,
        hasApiKey: !!settings.openaiApiKey,
      },
    };
  } catch (error) {
    console.error("get-llm-settings error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get settings",
    };
  }
});

/**
 * Set LLM mode and optionally API key.
 * Will restart Python sidecar with new settings.
 */
ipcMain.handle(
  "set-llm-settings",
  async (_event, mode: "local" | "cloud", apiKey?: string) => {
    console.log("set-llm-settings called:", {
      mode,
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length,
    });
    try {
      // Save settings
      const updates: { llmMode: "local" | "cloud"; openaiApiKey?: string } = {
        llmMode: mode,
      };
      if (apiKey !== undefined) {
        updates.openaiApiKey = apiKey;
      }
      console.log("Saving settings with updates:", {
        ...updates,
        openaiApiKey: updates.openaiApiKey ? "[REDACTED]" : undefined,
      });
      const settings = saveSettings(updates);
      console.log("Settings saved:", {
        llmMode: settings.llmMode,
        hasApiKey: !!settings.openaiApiKey,
      });

      // Restart Python with new mode
      await restartWithMode(mode, settings.openaiApiKey);

      return {
        success: true,
        data: {
          llmMode: settings.llmMode,
          hasApiKey: !!settings.openaiApiKey,
        },
      };
    } catch (error) {
      console.error("set-llm-settings error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to save settings",
      };
    }
  },
);

// ============================================================================
// Project IPC Handlers
// ============================================================================

/**
 * Create a new project.
 * Returns { success: true, data: ProjectSummary } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle(
  "create-project",
  async (
    _event,
    input: { name: string; client_name?: string; description?: string },
  ) => {
    try {
      const project = createProject(input);
      return { success: true, data: project };
    } catch (error) {
      console.error("Failed to create project:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create project",
      };
    }
  },
);

/**
 * Get all projects with CV/JD counts.
 * Returns { success: true, data: ProjectSummary[] } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle(
  "get-all-projects",
  async (_event, includeArchived?: boolean) => {
    try {
      const projects = getAllProjects(includeArchived);
      return { success: true, data: projects };
    } catch (error) {
      console.error("Failed to get projects:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get projects",
      };
    }
  },
);

/**
 * Get a single project by ID.
 * Returns { success: true, data: ProjectSummary } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle("get-project", async (_event, id: string) => {
  try {
    const project = getProject(id);
    if (!project) {
      return { success: false, error: "Project not found" };
    }
    return { success: true, data: project };
  } catch (error) {
    console.error("Failed to get project:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get project",
    };
  }
});

/**
 * Update a project.
 * Returns { success: true } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle(
  "update-project",
  async (
    _event,
    id: string,
    updates: {
      name?: string;
      client_name?: string;
      description?: string;
      is_archived?: boolean;
    },
  ) => {
    try {
      const success = updateProject(id, updates);
      if (!success) {
        return { success: false, error: "Project not found" };
      }
      return { success: true };
    } catch (error) {
      console.error("Failed to update project:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update project",
      };
    }
  },
);

/**
 * Delete a project and all its data.
 * Returns { success: true } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle("delete-project", async (_event, id: string) => {
  try {
    const success = deleteProject(id);
    if (!success) {
      return { success: false, error: "Project not found" };
    }
    return { success: true };
  } catch (error) {
    console.error("Failed to delete project:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete project",
    };
  }
});

/**
 * Get aggregate stats across all projects.
 * Returns { success: true, data: { total_cvs, total_jds } } on success
 * Returns { success: false, error: string } on failure
 */
ipcMain.handle("get-aggregate-stats", async () => {
  try {
    const stats = getAggregateStats();
    return { success: true, data: stats };
  } catch (error) {
    console.error("Failed to get aggregate stats:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get aggregate stats",
    };
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
ipcMain.handle(
  "enqueue-cv",
  async (_event, fileName: string, filePath: string, projectId?: string) => {
    try {
      // Validate file path
      if (!filePath || typeof filePath !== "string") {
        return { success: false, error: "Invalid file path" };
      }

      // Check file exists
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `File not found: ${filePath}` };
      }

      // Check file extension
      const ext = path.extname(filePath).toLowerCase();
      const validExtensions = [".pdf", ".docx", ".doc"];
      if (!validExtensions.includes(ext)) {
        return {
          success: false,
          error: `Unsupported file type: ${ext}. Supported formats: PDF, DOCX, DOC`,
        };
      }

      // Enqueue via queue manager
      const id = getQueueManager().enqueue({ fileName, filePath, projectId });

      return { success: true, id };
    } catch (error) {
      console.error("Failed to enqueue CV:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to enqueue CV",
      };
    }
  },
);

/**
 * Batch-enqueue files/folders for processing.
 * Accepts an array of paths (files or directories).
 * Directories are scanned recursively for .pdf, .docx, .doc files.
 * Shows a confirmation dialog before enqueuing.
 * Enqueues in chunks of 25 with 50ms delays so files trickle into the UI.
 */
ipcMain.handle(
  "batch-enqueue",
  async (_event, paths: string[], projectId?: string) => {
    try {
      if (!Array.isArray(paths) || paths.length === 0) {
        return { success: false, error: "No paths provided" };
      }

      const validExtensions = [".pdf", ".docx", ".doc"];
      const discoveredFiles: { fileName: string; filePath: string }[] = [];

      for (const p of paths) {
        if (typeof p !== "string") continue;

        let stat: fs.Stats;
        try {
          stat = await fsPromises.stat(p);
        } catch {
          // Path doesn't exist, skip
          continue;
        }

        if (stat.isDirectory()) {
          // Recursively scan directory
          const entries = await fsPromises.readdir(p, {
            recursive: true,
            withFileTypes: true,
          });
          for (const entry of entries) {
            if (!entry.isFile()) continue;
            const ext = path.extname(entry.name).toLowerCase();
            if (!validExtensions.includes(ext)) continue;
            // Node 20+: entry.parentPath is available; fallback to entry.path
            const parentDir =
              (entry as unknown as { parentPath?: string }).parentPath ??
              (entry as unknown as { path: string }).path;
            const fullPath = path.join(parentDir, entry.name);
            discoveredFiles.push({ fileName: entry.name, filePath: fullPath });
          }
        } else if (stat.isFile()) {
          const ext = path.extname(p).toLowerCase();
          if (validExtensions.includes(ext)) {
            discoveredFiles.push({
              fileName: path.basename(p),
              filePath: p,
            });
          }
        }
      }

      if (discoveredFiles.length === 0) {
        return {
          success: false,
          error: "No supported files found (.pdf, .docx, .doc)",
        };
      }

      // Show confirmation dialog
      let message = `Found ${discoveredFiles.length} CV${discoveredFiles.length === 1 ? "" : "s"} (.pdf, .docx, .doc). Process all?`;
      if (discoveredFiles.length >= 200) {
        message += "\n\nThis may take a while.";
      }

      const parentWindow = BrowserWindow.getFocusedWindow();
      const dialogOptions: Electron.MessageBoxOptions = {
        type: "question",
        buttons: ["OK", "Cancel"],
        defaultId: 0,
        cancelId: 1,
        title: "Batch Process CVs",
        message,
      };
      const dialogResult = parentWindow
        ? await dialog.showMessageBox(parentWindow, dialogOptions)
        : await dialog.showMessageBox(dialogOptions);

      if (dialogResult.response !== 0) {
        return { success: false, error: "Cancelled by user" };
      }

      // Enqueue in chunks of 25 with 50ms delays
      const chunkSize = 25;
      for (let i = 0; i < discoveredFiles.length; i += chunkSize) {
        const chunk = discoveredFiles.slice(i, i + chunkSize);
        for (const file of chunk) {
          getQueueManager().enqueue({
            fileName: file.fileName,
            filePath: file.filePath,
            projectId,
          });
        }
        // Delay between chunks to let IPC flush to renderer
        if (i + chunkSize < discoveredFiles.length) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      return { success: true, fileCount: discoveredFiles.length };
    } catch (error) {
      console.error("Failed to batch enqueue:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to batch enqueue",
      };
    }
  },
);

/**
 * Get all queued/processing CVs for a project.
 * Returns { success: true, data: QueuedCV[] } on success
 */
ipcMain.handle("get-queued-cvs", async (_event, projectId?: string) => {
  try {
    const cvs = getQueuedCVsByProject(projectId);
    return { success: true, data: cvs };
  } catch (error) {
    console.error("Failed to get queued CVs:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to get queued CVs",
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
ipcMain.handle("get-usage-stats", async () => {
  try {
    const stats = getAllUsageStats();
    return { success: true, data: stats };
  } catch (error) {
    console.error("get-usage-stats error:", error);
    return { success: false, error: String(error) };
  }
});

/**
 * Pin or unpin a project for quick sidebar access.
 */
ipcMain.handle(
  "set-pinned-project",
  async (_event, projectId: string, isPinned: boolean) => {
    try {
      const success = updateProjectPinned(projectId, isPinned);
      return { success };
    } catch (error) {
      console.error("set-pinned-project error:", error);
      return { success: false, error: String(error) };
    }
  },
);

/**
 * Get all pinned projects in order.
 */
ipcMain.handle("get-pinned-projects", async () => {
  try {
    const projects = getPinnedProjects();
    return { success: true, data: projects };
  } catch (error) {
    console.error("get-pinned-projects error:", error);
    return { success: false, error: String(error) };
  }
});

/**
 * Reorder pinned projects after drag-drop.
 * @param projectIds - Array of project IDs in new order
 */
ipcMain.handle(
  "reorder-pinned-projects",
  async (_event, projectIds: string[]) => {
    try {
      reorderPinnedProjects(projectIds);
      return { success: true };
    } catch (error) {
      console.error("reorder-pinned-projects error:", error);
      return { success: false, error: String(error) };
    }
  },
);

/**
 * Get all app settings including usage limits.
 */
ipcMain.handle("get-app-settings", async () => {
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
        booleanSyntax: settings.booleanSyntax,
      },
    };
  } catch (error) {
    console.error("get-app-settings error:", error);
    return { success: false, error: String(error) };
  }
});

/**
 * Update app settings (excluding API key - use setLLMSettings for that).
 */
ipcMain.handle(
  "update-app-settings",
  async (_event, updates: Partial<Omit<AppSettings, "openaiApiKey">>) => {
    try {
      const updated = saveSettings(updates);
      return {
        success: true,
        data: {
          llmMode: updated.llmMode,
          hasApiKey: Boolean(updated.openaiApiKey),
          globalTokenLimit: updated.globalTokenLimit,
          warningThreshold: updated.warningThreshold ?? 80,
          booleanSyntax: updated.booleanSyntax,
        },
      };
    } catch (error) {
      console.error("update-app-settings error:", error);
      return { success: false, error: String(error) };
    }
  },
);

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
ipcMain.handle(
  "export-cv",
  async (
    _event,
    cvId: string,
    mode: string,
    outputDir?: string,
    includeBlindProfile = true,
  ) => {
    try {
      // Get CV record for file_path
      const cvRecord = getCV(cvId);
      if (!cvRecord) {
        return { success: false, error: "CV not found" };
      }

      // Get CV data for contact info and blind profile
      const cvData = getCVFull(cvId);
      if (!cvData) {
        return { success: false, error: "CV data not found" };
      }

      // Validate mode
      const validModes = ["full", "client", "punt"];
      if (!validModes.includes(mode)) {
        return {
          success: false,
          error: `Invalid mode: ${mode}. Must be one of: full, client, punt`,
        };
      }

      // Default output directory to Downloads folder
      const actualOutputDir = outputDir || app.getPath("downloads");

      // Ensure output directory exists
      if (!fs.existsSync(actualOutputDir)) {
        return {
          success: false,
          error: `Output directory does not exist: ${actualOutputDir}`,
        };
      }

      // Get recruiter settings for blind profile footer
      const recruiter = getRecruiterSettings();

      // Call Python sidecar for export
      const result = (await sendToPython({
        action: "export_cv",
        cv_id: cvId,
        source_path: cvRecord.file_path,
        contact_info: cvData.contact || {},
        mode: mode,
        output_dir: actualOutputDir,
        include_blind_profile: includeBlindProfile,
        recruiter: recruiter,
        cv_data: cvData, // Full CV data for blind profile generation
      })) as {
        output_path: string;
        mode: string;
        redacted_fields: string[];
        has_blind_profile?: boolean;
      };

      console.log(
        `CV export completed: ${result.output_path} (mode: ${result.mode}, blind_profile: ${result.has_blind_profile ?? false})`,
      );

      return {
        success: true,
        outputPath: result.output_path,
      };
    } catch (error) {
      console.error("export-cv error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to export CV",
      };
    }
  },
);

// ============================================================================
// Recruiter Settings IPC Handlers (Phase 5)
// ============================================================================

/**
 * Get recruiter settings for blind profile footer.
 * Returns { success: true, data: RecruiterSettings } on success
 */
ipcMain.handle("get-recruiter-settings", async () => {
  try {
    const settings = getRecruiterSettings();
    return { success: true, data: settings };
  } catch (error) {
    console.error("get-recruiter-settings error:", error);
    return { success: false, error: String(error) };
  }
});

/**
 * Set recruiter settings for blind profile footer.
 * Returns { success: true } on success
 */
ipcMain.handle(
  "set-recruiter-settings",
  async (
    _event,
    settings: { name?: string; phone?: string; email?: string },
  ) => {
    try {
      setRecruiterSettings(settings);
      return { success: true };
    } catch (error) {
      console.error("set-recruiter-settings error:", error);
      return { success: false, error: String(error) };
    }
  },
);

/**
 * Open folder selection dialog.
 * Returns { canceled: false, path: string } on selection
 * Returns { canceled: true } if user cancels
 */
ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
    title: "Select export folder",
  });
  return {
    canceled: result.canceled,
    path: result.filePaths[0],
  };
});

// ============================================================================
// Template IPC Handlers (Phase 9)
// ============================================================================

/**
 * Create a new message template.
 * Returns { success: true, data: TemplateRecord } on success
 */
ipcMain.handle(
  "create-template",
  async (
    _event,
    input: {
      projectId: string;
      name: string;
      type: "sms" | "email";
      subject?: string;
      body: string;
    },
  ) => {
    try {
      const template = createTemplate(input);
      return { success: true, data: template };
    } catch (error) {
      console.error("create-template error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create template",
      };
    }
  },
);

/**
 * Get a template by ID.
 * Returns { success: true, data: TemplateRecord } on success
 */
ipcMain.handle("get-template", async (_event, id: string) => {
  try {
    const template = getTemplate(id);
    if (!template) {
      return { success: false, error: "Template not found" };
    }
    return { success: true, data: template };
  } catch (error) {
    console.error("get-template error:", error);
    return { success: false, error: String(error) };
  }
});

/**
 * Get all templates for a project.
 * Returns { success: true, data: TemplateRecord[] } on success
 */
ipcMain.handle(
  "get-templates-by-project",
  async (_event, projectId: string) => {
    try {
      const templates = getTemplatesByProject(projectId);
      return { success: true, data: templates };
    } catch (error) {
      console.error("get-templates-by-project error:", error);
      return { success: false, error: String(error) };
    }
  },
);

/**
 * Update a template.
 * Returns { success: true } on success
 */
ipcMain.handle(
  "update-template",
  async (
    _event,
    id: string,
    updates: {
      name?: string;
      subject?: string;
      body?: string;
      isDefault?: boolean;
    },
  ) => {
    try {
      const success = updateTemplate(id, updates);
      return { success };
    } catch (error) {
      console.error("update-template error:", error);
      return { success: false, error: String(error) };
    }
  },
);

/**
 * Delete a template by ID.
 * Returns { success: true } on success
 */
ipcMain.handle("delete-template", async (_event, id: string) => {
  try {
    const success = deleteTemplate(id);
    return { success };
  } catch (error) {
    console.error("delete-template error:", error);
    return { success: false, error: String(error) };
  }
});

/**
 * Preview a template with example data.
 * Returns { success: true, data: string } on success
 */
ipcMain.handle("preview-template", async (_event, template: string) => {
  try {
    const preview = previewTemplate(template);
    return { success: true, data: preview };
  } catch (error) {
    console.error("preview-template error:", error);
    return { success: false, error: String(error) };
  }
});

/**
 * Get available template variables.
 * Returns { success: true, data: TemplateVariable[] } on success
 */
ipcMain.handle("get-available-variables", async () => {
  return { success: true, data: AVAILABLE_VARIABLES };
});

// ============================================================================
// Credential IPC Handlers (Phase 9)
// ============================================================================

/**
 * Store a credential with safeStorage encryption.
 * Returns { success: true, id: string } on success
 */
ipcMain.handle(
  "store-credential",
  async (
    _event,
    projectId: string | null,
    provider: string,
    credentialType: string,
    value: string,
  ) => {
    try {
      const id = storeCredential(
        projectId,
        provider as ProviderType,
        credentialType as CredentialType,
        value,
      );
      return { success: true, id };
    } catch (error) {
      console.error("store-credential error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to store credential",
      };
    }
  },
);

/**
 * Check if a credential is configured (without decrypting).
 * Returns { success: true, configured: boolean } on success
 */
ipcMain.handle(
  "get-credential-status",
  async (
    _event,
    projectId: string | null,
    provider: string,
    credentialType: string,
  ) => {
    try {
      const exists = hasCredential(
        projectId,
        provider as ProviderType,
        credentialType as CredentialType,
      );
      return { success: true, configured: exists };
    } catch (error) {
      console.error("get-credential-status error:", error);
      return { success: false, error: String(error) };
    }
  },
);

/**
 * Delete a credential.
 * Returns { success: true, deleted: boolean } on success
 */
ipcMain.handle(
  "delete-credential",
  async (
    _event,
    projectId: string | null,
    provider: string,
    credentialType: string,
  ) => {
    try {
      const deleted = deleteCredential(
        projectId,
        provider as ProviderType,
        credentialType as CredentialType,
      );
      return { success: true, deleted };
    } catch (error) {
      console.error("delete-credential error:", error);
      return { success: false, error: String(error) };
    }
  },
);

/**
 * Test Twilio credentials by fetching account info.
 * Returns { success: true, data: { friendlyName, status } } on success
 */
ipcMain.handle(
  "test-twilio-credentials",
  async (_event, projectId: string | null) => {
    return testTwilioCredentials(projectId);
  },
);

/**
 * Test SMTP credentials by verifying connection.
 * Returns { success: true } on success
 */
ipcMain.handle(
  "test-smtp-credentials",
  async (_event, projectId: string | null) => {
    return testSmtpCredentials(projectId);
  },
);

/**
 * Check if safeStorage encryption is available on this system.
 * Returns { available: boolean }
 */
ipcMain.handle("is-encryption-available", async () => {
  return { available: isEncryptionAvailable() };
});

/**
 * Check if voice calling is configured for a project.
 * Returns { configured: boolean }
 */
ipcMain.handle(
  "is-voice-configured",
  async (_event, projectId: string | null) => {
    return { configured: isVoiceConfigured(projectId) };
  },
);

// ============================================================================
// Messaging IPC Handlers (Phase 9 Plan 03)
// ============================================================================

import {
  sendSMS,
  sendEmail,
  startDeliveryPolling,
  stopDeliveryPolling,
  addToDNC,
  isOnDNC,
  removeFromDNC,
  getDNCList,
} from "./communicationService";
import {
  initializeWorkflows,
  graduateCandidate,
  graduateCandidates,
  sendWorkflowEvent,
  getWorkflowsByProject,
  getWorkflowCandidateData,
  stopAllWorkflows,
  type GraduateContext,
} from "./workflowService";
import type { WorkflowEvent } from "./workflowMachine";
import { startReplyPolling, stopReplyPolling } from "./replyPoller";
import {
  getProjectOutreachSettings,
  updateProjectOutreachSettings,
} from "./workingHours";

/**
 * Send SMS to a candidate.
 * Returns { success: boolean, messageId?: string, dbId?: string, error?: string }
 */
ipcMain.handle(
  "send-sms",
  async (
    _event,
    params: {
      projectId: string;
      cvId: string;
      toPhone: string;
      body: string;
      templateId?: string;
    },
  ) => {
    return sendSMS(params);
  },
);

/**
 * Send email to a candidate.
 * Returns { success: boolean, messageId?: string, dbId?: string, error?: string }
 */
ipcMain.handle(
  "send-email",
  async (
    _event,
    params: {
      projectId: string;
      cvId: string;
      toEmail: string;
      subject: string;
      body: string;
      templateId?: string;
    },
  ) => {
    return sendEmail(params);
  },
);

/**
 * Get all messages for a CV.
 * Returns { success: boolean, data?: MessageRecord[], error?: string }
 */
ipcMain.handle("get-messages-by-cv", async (_event, cvId: string) => {
  try {
    const messages = getMessagesByCV(cvId);
    return { success: true, data: messages };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

/**
 * Get all messages for a project.
 * Returns { success: boolean, data?: MessageRecord[], error?: string }
 */
ipcMain.handle(
  "get-messages-by-project",
  async (_event, projectId: string, limit?: number) => {
    try {
      const messages = getMessagesByProject(projectId, limit);
      return { success: true, data: messages };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
);

// ============================================================================
// DNC IPC Handlers (Phase 9 Plan 03)
// ============================================================================

/**
 * Add a phone or email to the DNC list.
 * Returns { success: boolean, id?: string, error?: string }
 */
ipcMain.handle(
  "add-to-dnc",
  async (
    _event,
    type: "phone" | "email",
    value: string,
    reason: "opt_out" | "bounce" | "manual",
  ) => {
    try {
      const id = addToDNC(type, value, reason);
      return { success: true, id };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
);

/**
 * Check if a phone or email is on the DNC list.
 * Returns { onDNC: boolean }
 */
ipcMain.handle(
  "check-dnc",
  async (_event, type: "phone" | "email", value: string) => {
    return { onDNC: isOnDNC(type, value) };
  },
);

/**
 * Remove a phone or email from the DNC list.
 * Returns { success: boolean, removed?: boolean, error?: string }
 */
ipcMain.handle(
  "remove-from-dnc",
  async (_event, type: "phone" | "email", value: string) => {
    try {
      const removed = removeFromDNC(type, value);
      return { success: true, removed };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
);

/**
 * Get the full DNC list.
 * Returns { success: boolean, data?: DNCEntry[], error?: string }
 */
ipcMain.handle("get-dnc-list", async () => {
  try {
    const list = getDNCList();
    return { success: true, data: list };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// ============================================================================
// Polling Control IPC Handlers (Phase 9 Plan 03)
// ============================================================================

/**
 * Start delivery status polling for a project.
 * Returns { success: boolean }
 */
ipcMain.handle("start-delivery-polling", async (_event, projectId: string) => {
  startDeliveryPolling(projectId);
  return { success: true };
});

/**
 * Stop delivery status polling.
 * Returns { success: boolean }
 */
ipcMain.handle("stop-delivery-polling", async () => {
  stopDeliveryPolling();
  return { success: true };
});

/**
 * Render a template with real candidate/role variables.
 * Returns { success: boolean, data?: string, error?: string }
 */
ipcMain.handle(
  "render-template-with-variables",
  async (_event, template: string, variables: Record<string, string>) => {
    try {
      const rendered = renderTemplate(template, variables);
      return { success: true, data: rendered };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
);

// ============================================================================
// Workflow IPC Handlers (Phase 10)
// ============================================================================

/**
 * Graduate a single candidate to outreach pipeline.
 * Creates workflow actor and sends GRADUATE event.
 * Returns { success: boolean, error?: string }
 */
ipcMain.handle(
  "graduate-candidate",
  async (
    _event,
    candidateId: string,
    projectId: string,
    context: GraduateContext,
  ) => {
    try {
      const success = await graduateCandidate(candidateId, projectId, context);
      return {
        success,
        error: success ? undefined : "Candidate already graduated or not found",
      };
    } catch (error) {
      console.error("graduate-candidate error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to graduate candidate",
      };
    }
  },
);

/**
 * Batch graduate multiple candidates to outreach pipeline.
 * Returns { success: boolean, data?: { success: string[], failed: string[] }, error?: string }
 */
ipcMain.handle(
  "graduate-candidates",
  async (
    _event,
    candidateIds: string[],
    projectId: string,
    escalationTimeoutMs?: number,
  ) => {
    try {
      const result = await graduateCandidates(
        candidateIds,
        projectId,
        escalationTimeoutMs,
      );
      return { success: true, data: result };
    } catch (error) {
      console.error("graduate-candidates error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to batch graduate",
      };
    }
  },
);

/**
 * Send an event to a workflow.
 * eventType: PAUSE | RESUME | CANCEL | FORCE_CALL | SKIP_TO_SCREENING | REPLY_DETECTED | SCREENING_COMPLETE
 * Returns { success: boolean, error?: string }
 */
ipcMain.handle(
  "send-workflow-event",
  async (
    _event,
    candidateId: string,
    eventType: string,
    payload?: Record<string, unknown>,
  ) => {
    try {
      const event = { type: eventType, ...payload } as WorkflowEvent;
      const success = sendWorkflowEvent(candidateId, event);
      return { success, error: success ? undefined : "Workflow not found" };
    } catch (error) {
      console.error("send-workflow-event error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send event",
      };
    }
  },
);

/**
 * Get all workflows for a project.
 * Returns { success: boolean, data?: WorkflowSummary[], error?: string }
 */
ipcMain.handle(
  "get-workflows-by-project",
  async (_event, projectId: string) => {
    try {
      const workflows = getWorkflowsByProject(projectId);
      return { success: true, data: workflows };
    } catch (error) {
      console.error("get-workflows-by-project error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get workflows",
      };
    }
  },
);

/**
 * Get workflow data for a single candidate.
 * Returns { success: boolean, data?: WorkflowCandidateData, error?: string }
 */
ipcMain.handle(
  "get-workflow-candidate",
  async (_event, candidateId: string) => {
    try {
      const data = getWorkflowCandidateData(candidateId);
      if (!data) {
        return { success: false, error: "Workflow not found" };
      }
      return { success: true, data };
    } catch (error) {
      console.error("get-workflow-candidate error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get workflow",
      };
    }
  },
);

// ============================================================================
// Reply Polling IPC Handlers (Phase 10 Plan 02)
// ============================================================================

/**
 * Start reply polling for a project.
 * Polls Twilio every 30 seconds for inbound SMS.
 * Returns { success: boolean }
 */
ipcMain.handle("start-reply-polling", async (_event, projectId: string) => {
  try {
    startReplyPolling(projectId);
    return { success: true };
  } catch (error) {
    console.error("start-reply-polling error:", error);
    return { success: false, error: String(error) };
  }
});

/**
 * Stop reply polling.
 * Returns { success: boolean }
 */
ipcMain.handle("stop-reply-polling", async () => {
  try {
    stopReplyPolling();
    return { success: true };
  } catch (error) {
    console.error("stop-reply-polling error:", error);
    return { success: false, error: String(error) };
  }
});

// ============================================================================
// Project Outreach Settings IPC Handlers (Phase 10 Plan 02)
// ============================================================================

/**
 * Get outreach settings for a project.
 * Includes escalation timeout and working hours config.
 * Returns { success: boolean, data?: ProjectOutreachSettings, error?: string }
 */
ipcMain.handle(
  "get-project-outreach-settings",
  async (_event, projectId: string) => {
    try {
      const settings = getProjectOutreachSettings(projectId);
      return { success: true, data: settings };
    } catch (error) {
      console.error("get-project-outreach-settings error:", error);
      return { success: false, error: String(error) };
    }
  },
);

/**
 * Update outreach settings for a project.
 * Returns { success: boolean, data?: ProjectOutreachSettings, error?: string }
 */
ipcMain.handle(
  "update-project-outreach-settings",
  async (
    _event,
    projectId: string,
    settings: {
      escalation_timeout_ms?: number;
      ai_call_enabled?: number;
      working_hours_enabled?: number;
      working_hours_start?: string;
      working_hours_end?: string;
      working_hours_timezone?: string;
      working_hours_days?: string;
    },
  ) => {
    try {
      const updated = updateProjectOutreachSettings(projectId, settings);
      return { success: true, data: updated };
    } catch (error) {
      console.error("update-project-outreach-settings error:", error);
      return { success: false, error: String(error) };
    }
  },
);
