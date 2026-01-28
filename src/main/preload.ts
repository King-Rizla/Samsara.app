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

interface ProjectSummary {
  id: string;
  name: string;
  client_name: string | null;
  description: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  cv_count: number;
  jd_count: number;
}

interface CreateProjectInput {
  name: string;
  client_name?: string;
  description?: string;
}

interface ProjectResult {
  success: boolean;
  data?: ProjectSummary;
  error?: string;
}

interface ProjectsResult {
  success: boolean;
  data?: ProjectSummary[];
  error?: string;
}

interface AggregateStatsResult {
  success: boolean;
  data?: { total_cvs: number; total_jds: number };
  error?: string;
}

interface EnqueueResult {
  success: boolean;
  id?: string;
  error?: string;
}

interface QueueStatusUpdate {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  data?: unknown;  // ParsedCV
  error?: string;
  parseConfidence?: number;
}

interface QueuedCV {
  id: string;
  file_name: string;
  file_path: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface GetQueuedCVsResult {
  success: boolean;
  data?: QueuedCV[];
  error?: string;
}

// Usage tracking and pinning types (Phase 4.7)
interface UsageStats {
  totalTokens: number;
  requestCount: number;
}

interface ProjectUsageStats {
  global: UsageStats;
  byProject: Record<string, UsageStats>;
}

interface UsageStatsResult {
  success: boolean;
  data?: ProjectUsageStats;
  error?: string;
}

interface AppSettingsData {
  llmMode: 'local' | 'cloud';
  hasApiKey: boolean;
  globalTokenLimit?: number;
  warningThreshold: number;
}

interface AppSettingsResult {
  success: boolean;
  data?: AppSettingsData;
  error?: string;
}

interface PinnedProjectsResult {
  success: boolean;
  data?: ProjectSummary[];
  error?: string;
}

// Export CV result type (Phase 5)
interface ExportCVResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

// Recruiter settings type (Phase 5)
interface RecruiterSettings {
  name?: string;
  phone?: string;
  email?: string;
}

interface RecruiterSettingsResult {
  success: boolean;
  data?: RecruiterSettings;
  error?: string;
}

/**
 * Expose protected methods to the renderer process.
 * This maintains security by using contextBridge instead of nodeIntegration.
 */
contextBridge.exposeInMainWorld('api', {
  /**
   * Extract CV from a file path.
   * Optionally associate with a project.
   * Returns { success: boolean, data?: ParsedCV, id?: string, error?: string }
   */
  extractCV: (filePath: string, projectId?: string): Promise<ExtractResult> =>
    ipcRenderer.invoke('extract-cv', filePath, projectId),

  /**
   * Get all stored CVs (summary info).
   * Optionally filter by projectId.
   * Returns { success: boolean, data?: CVSummary[], error?: string }
   */
  getAllCVs: (projectId?: string): Promise<GetAllCVsResult> =>
    ipcRenderer.invoke('get-all-cvs', projectId),

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
   * Optionally associate with a project.
   * Returns { success: boolean, data?: ParsedCV, error?: string }
   */
  reprocessCV: (filePath: string, projectId?: string): Promise<ExtractResult> =>
    ipcRenderer.invoke('reprocess-cv', filePath, projectId),

  // JD (Job Description) operations

  /**
   * Extract JD from text and persist to database.
   * Optionally associate with a project.
   * Returns { success: boolean, data?: JobDescription, error?: string }
   */
  extractJD: (text: string, projectId?: string): Promise<{ success: boolean; data?: unknown; error?: string }> =>
    ipcRenderer.invoke('extract-jd', text, projectId),

  /**
   * Get all stored JDs (summary info).
   * Optionally filter by projectId.
   * Returns { success: boolean, data?: JDSummary[], error?: string }
   */
  getAllJDs: (projectId?: string): Promise<{ success: boolean; data?: unknown[]; error?: string }> =>
    ipcRenderer.invoke('get-all-jds', projectId),

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

  // Match operations

  /**
   * Match CVs against a JD.
   * Returns { success: boolean, results?: MatchResult[], error?: string }
   */
  matchCVsToJD: (jdId: string, cvIds: string[]): Promise<{ success: boolean; results?: unknown[]; error?: string }> =>
    ipcRenderer.invoke('match-cvs-to-jd', jdId, cvIds),

  /**
   * Get match results for a JD.
   * Returns { success: boolean, data?: MatchResult[], error?: string }
   */
  getMatchResults: (jdId: string): Promise<{ success: boolean; data?: unknown[]; error?: string }> =>
    ipcRenderer.invoke('get-match-results', jdId),

  // Settings API

  /**
   * Get current LLM settings.
   * Returns { success: boolean, data?: { llmMode: string, hasApiKey: boolean }, error?: string }
   */
  getLLMSettings: (): Promise<{ success: boolean; data?: { llmMode: string; hasApiKey: boolean }; error?: string }> =>
    ipcRenderer.invoke('get-llm-settings'),

  /**
   * Set LLM mode and optionally API key. Restarts Python sidecar.
   * Returns { success: boolean, data?: { llmMode: string, hasApiKey: boolean }, error?: string }
   */
  setLLMSettings: (mode: 'local' | 'cloud', apiKey?: string): Promise<{ success: boolean; data?: { llmMode: string; hasApiKey: boolean }; error?: string }> =>
    ipcRenderer.invoke('set-llm-settings', mode, apiKey),

  // Project operations

  /**
   * Create a new project.
   * Returns { success: boolean, data?: ProjectSummary, error?: string }
   */
  createProject: (input: CreateProjectInput): Promise<ProjectResult> =>
    ipcRenderer.invoke('create-project', input),

  /**
   * Get all projects with CV/JD counts.
   * Returns { success: boolean, data?: ProjectSummary[], error?: string }
   */
  getAllProjects: (includeArchived?: boolean): Promise<ProjectsResult> =>
    ipcRenderer.invoke('get-all-projects', includeArchived),

  /**
   * Get a single project by ID.
   * Returns { success: boolean, data?: ProjectSummary, error?: string }
   */
  getProject: (id: string): Promise<ProjectResult> =>
    ipcRenderer.invoke('get-project', id),

  /**
   * Update a project.
   * Returns { success: boolean, error?: string }
   */
  updateProject: (id: string, updates: { name?: string; client_name?: string; description?: string; is_archived?: boolean }): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('update-project', id, updates),

  /**
   * Delete a project and all its data.
   * Returns { success: boolean, error?: string }
   */
  deleteProject: (id: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('delete-project', id),

  /**
   * Get aggregate stats across all projects.
   * Returns { success: boolean, data?: { total_cvs, total_jds }, error?: string }
   */
  getAggregateStats: (): Promise<AggregateStatsResult> =>
    ipcRenderer.invoke('get-aggregate-stats'),

  // Queue operations

  /**
   * Enqueue a CV for processing.
   * Immediately persists to database with status='queued'.
   * Returns { success: boolean, id?: string, error?: string }
   */
  enqueueCV: (fileName: string, filePath: string, projectId?: string): Promise<EnqueueResult> =>
    ipcRenderer.invoke('enqueue-cv', fileName, filePath, projectId),

  /**
   * Get all queued/processing CVs for a project.
   * Returns { success: boolean, data?: QueuedCV[], error?: string }
   */
  getQueuedCVs: (projectId?: string): Promise<GetQueuedCVsResult> =>
    ipcRenderer.invoke('get-queued-cvs', projectId),

  /**
   * Subscribe to queue status updates from main process.
   * Called when CV status changes (queued -> processing -> completed/failed).
   */
  onQueueStatusUpdate: (callback: (update: QueueStatusUpdate) => void): void => {
    ipcRenderer.on('queue-status-update', (_event, update) => callback(update));
  },

  /**
   * Unsubscribe from queue status updates.
   * Call in cleanup/useEffect return to prevent memory leaks.
   */
  removeQueueStatusListener: (): void => {
    ipcRenderer.removeAllListeners('queue-status-update');
  },

  // Usage tracking (Phase 4.7)

  /**
   * Get usage statistics for current month.
   * Returns global and per-project token counts.
   */
  getUsageStats: (): Promise<UsageStatsResult> =>
    ipcRenderer.invoke('get-usage-stats'),

  // Project pinning operations (Phase 4.7)

  /**
   * Pin or unpin a project for quick sidebar access.
   */
  setPinnedProject: (projectId: string, isPinned: boolean): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('set-pinned-project', projectId, isPinned),

  /**
   * Get all pinned projects in order.
   */
  getPinnedProjects: (): Promise<PinnedProjectsResult> =>
    ipcRenderer.invoke('get-pinned-projects'),

  /**
   * Reorder pinned projects after drag-drop.
   * @param projectIds - Array of project IDs in new order
   */
  reorderPinnedProjects: (projectIds: string[]): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('reorder-pinned-projects', projectIds),

  // App Settings (extended) (Phase 4.7)

  /**
   * Get all app settings including usage limits.
   */
  getAppSettings: (): Promise<AppSettingsResult> =>
    ipcRenderer.invoke('get-app-settings'),

  /**
   * Update app settings (excluding API key - use setLLMSettings for that).
   */
  updateAppSettings: (updates: { globalTokenLimit?: number; warningThreshold?: number }): Promise<AppSettingsResult> =>
    ipcRenderer.invoke('update-app-settings', updates),

  // CV Export operations (Phase 5)

  /**
   * Export CV with optional redaction and blind profile.
   * mode: 'full' | 'client' | 'punt'
   *   - full: No redaction
   *   - client: Remove phone and email (default)
   *   - punt: Remove phone, email, AND name
   * includeBlindProfile: Whether to prepend one-page summary (default: true)
   * Returns { success: boolean, outputPath?: string, error?: string }
   */
  exportCV: (cvId: string, mode: 'full' | 'client' | 'punt', outputDir?: string, includeBlindProfile?: boolean): Promise<ExportCVResult> =>
    ipcRenderer.invoke('export-cv', cvId, mode, outputDir, includeBlindProfile),

  // Recruiter settings operations (Phase 5)

  /**
   * Get recruiter settings for blind profile footer.
   * Returns { success: boolean, data?: RecruiterSettings, error?: string }
   */
  getRecruiterSettings: (): Promise<RecruiterSettingsResult> =>
    ipcRenderer.invoke('get-recruiter-settings'),

  /**
   * Set recruiter settings for blind profile footer.
   * Returns { success: boolean, error?: string }
   */
  setRecruiterSettings: (settings: RecruiterSettings): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('set-recruiter-settings', settings),
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
