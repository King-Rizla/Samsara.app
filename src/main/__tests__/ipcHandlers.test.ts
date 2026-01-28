/**
 * IPC Handler input validation and error handling tests.
 *
 * Tests that each IPC handler validates inputs correctly,
 * returns consistent error format, and handles edge cases.
 */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Track registered handlers - must use vi.hoisted so it's available in vi.mock factories
const { handlers } = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => any>(),
}));

// Mock electron
vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/tmp/test"),
    isPackaged: false,
    whenReady: vi.fn(
      () =>
        new Promise(() => {
          /* never resolves in test */
        }),
    ),
    on: vi.fn(),
    quit: vi.fn(),
  },
  BrowserWindow: vi.fn(() => ({
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    webContents: { openDevTools: vi.fn(), send: vi.fn() },
    on: vi.fn(),
  })),
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
      handlers.set(channel, handler);
    }),
  },
  dialog: {
    showOpenDialog: vi.fn(() => ({
      canceled: true,
      filePaths: [],
    })),
  },
}));

// Mock fs
vi.mock("fs", () => ({
  existsSync: vi.fn((p: string) => {
    if (p.includes("nonexistent")) return false;
    if (p.includes("exists")) return true;
    return false;
  }),
}));

// Mock electron-squirrel-startup
vi.mock("electron-squirrel-startup", () => ({ default: false }));

// Mock database
const mockGetCVFull = vi.fn();
const mockGetCV = vi.fn();
const mockGetAllCVs = vi.fn(() => []);
const mockDeleteCV = vi.fn(() => true);
const mockUpdateCVField = vi.fn(() => true);
const mockInsertCV = vi.fn(() => "cv-new-id");
const mockInsertJD = vi.fn(() => "jd-new-id");
const mockGetJD = vi.fn();
const mockGetAllJDs = vi.fn(() => []);
const mockDeleteJD = vi.fn(() => true);
const mockCreateProject = vi.fn(() => ({
  id: "p1",
  name: "Test",
  client_name: null,
  description: null,
  is_archived: 0,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
}));
const mockGetAllProjects = vi.fn(() => []);
const mockGetProject = vi.fn();
const mockUpdateProject = vi.fn(() => true);
const mockDeleteProject = vi.fn(() => true);
const mockGetAggregateStats = vi.fn(() => ({ total_cvs: 0, total_jds: 0 }));
const mockGetQueuedCVsByProject = vi.fn(() => []);
const mockGetAllUsageStats = vi.fn(() => ({
  global: { totalTokens: 0, requestCount: 0 },
  byProject: {},
}));
const mockUpdateProjectPinned = vi.fn(() => true);
const mockGetPinnedProjects = vi.fn(() => []);
const mockReorderPinnedProjects = vi.fn();
const mockGetMatchResultsForJD = vi.fn(() => []);
const mockInsertMatchResult = vi.fn();
const mockRecordUsageEvent = vi.fn();

vi.mock("../database", () => ({
  initDatabase: vi.fn(() => ({})),
  closeDatabase: vi.fn(),
  insertCV: (...args: unknown[]) => mockInsertCV(...args),
  getCV: (...args: unknown[]) => mockGetCV(...args),
  getAllCVs: (...args: unknown[]) => mockGetAllCVs(...args),
  getCVFull: (...args: unknown[]) => mockGetCVFull(...args),
  deleteCV: (...args: unknown[]) => mockDeleteCV(...args),
  updateCVField: (...args: unknown[]) => mockUpdateCVField(...args),
  insertJD: (...args: unknown[]) => mockInsertJD(...args),
  getJD: (...args: unknown[]) => mockGetJD(...args),
  getAllJDs: (...args: unknown[]) => mockGetAllJDs(...args),
  deleteJD: (...args: unknown[]) => mockDeleteJD(...args),
  createProject: (...args: unknown[]) => mockCreateProject(...args),
  getAllProjects: (...args: unknown[]) => mockGetAllProjects(...args),
  getProject: (...args: unknown[]) => mockGetProject(...args),
  updateProject: (...args: unknown[]) => mockUpdateProject(...args),
  deleteProject: (...args: unknown[]) => mockDeleteProject(...args),
  getAggregateStats: () => mockGetAggregateStats(),
  getQueuedCVsByProject: (...args: unknown[]) =>
    mockGetQueuedCVsByProject(...args),
  insertQueuedCV: vi.fn(() => "queued-cv-id"),
  updateCVStatus: vi.fn(() => true),
  completeCVProcessing: vi.fn(() => true),
  getNextQueuedCV: vi.fn(() => null),
  resetProcessingCVs: vi.fn(() => 0),
  recordUsageEvent: (...args: unknown[]) => mockRecordUsageEvent(...args),
  getAllUsageStats: () => mockGetAllUsageStats(),
  updateProjectPinned: (...args: unknown[]) => mockUpdateProjectPinned(...args),
  getPinnedProjects: () => mockGetPinnedProjects(),
  reorderPinnedProjects: (...args: unknown[]) =>
    mockReorderPinnedProjects(...args),
  getMatchResultsForJD: (...args: unknown[]) =>
    mockGetMatchResultsForJD(...args),
  insertMatchResult: (...args: unknown[]) => mockInsertMatchResult(...args),
}));

// Mock pythonManager
const mockExtractCV = vi.fn();
const mockSendToPython = vi.fn();
vi.mock("../pythonManager", () => ({
  startPython: vi.fn(),
  stopPython: vi.fn(),
  extractCV: (...args: unknown[]) => mockExtractCV(...args),
  sendToPython: (...args: unknown[]) => mockSendToPython(...args),
  restartWithMode: vi.fn(),
}));

// Mock settings
vi.mock("../settings", () => ({
  loadSettings: vi.fn(() => ({ llmMode: "local" })),
  saveSettings: vi.fn((updates: any) => ({ llmMode: "local", ...updates })),
  getRecruiterSettings: vi.fn(() => ({})),
  setRecruiterSettings: vi.fn(),
}));

// Mock queueManager
vi.mock("../queueManager", () => ({
  createQueueManager: vi.fn(() => ({
    setMainWindow: vi.fn(),
    enqueue: vi.fn(() => "queued-id"),
  })),
  getQueueManager: vi.fn(() => ({
    enqueue: vi.fn(() => "queued-id"),
  })),
}));

// Import index.ts to register handlers
import "../index";

// Helper to call a handler
function callHandler(channel: string, ...args: unknown[]) {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`No handler for channel: ${channel}`);
  const mockEvent = {} as any;
  return handler(mockEvent, ...args);
}

describe("IPC Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Handler Registration
  // ============================================================================

  describe("handler registration", () => {
    it("should register all expected IPC handlers", () => {
      const expectedChannels = [
        "extract-cv",
        "get-all-cvs",
        "select-cv-file",
        "get-cv",
        "update-cv-field",
        "delete-cv",
        "extract-jd",
        "get-all-jds",
        "get-jd",
        "delete-jd",
        "match-cvs-to-jd",
        "get-match-results",
        "get-llm-settings",
        "set-llm-settings",
        "create-project",
        "get-all-projects",
        "get-project",
        "update-project",
        "delete-project",
        "get-aggregate-stats",
        "enqueue-cv",
        "get-queued-cvs",
        "get-usage-stats",
        "set-pinned-project",
        "get-pinned-projects",
        "reorder-pinned-projects",
        "export-cv",
      ];
      for (const channel of expectedChannels) {
        expect(handlers.has(channel), `Missing handler: ${channel}`).toBe(true);
      }
    });
  });

  // ============================================================================
  // extract-cv handler
  // ============================================================================

  describe("extract-cv", () => {
    it("should reject null file path", async () => {
      const result = await callHandler("extract-cv", null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid file path");
    });

    it("should reject empty string file path", async () => {
      const result = await callHandler("extract-cv", "");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid file path");
    });

    it("should reject non-string file path", async () => {
      const result = await callHandler("extract-cv", 42);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid file path");
    });

    it("should reject nonexistent file", async () => {
      const result = await callHandler("extract-cv", "/nonexistent/file.pdf");
      expect(result.success).toBe(false);
      expect(result.error).toContain("File not found");
    });

    it("should reject unsupported file extension", async () => {
      const result = await callHandler("extract-cv", "/exists/file.txt");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unsupported file type");
    });

    it("should return success with valid PDF extraction", async () => {
      mockExtractCV.mockResolvedValueOnce({
        contact: { name: "John" },
        parse_confidence: 0.9,
      });
      const result = await callHandler("extract-cv", "/exists/cv.pdf");
      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
    });

    it("should handle extraction failure gracefully", async () => {
      mockExtractCV.mockRejectedValueOnce(new Error("Python crashed"));
      const result = await callHandler("extract-cv", "/exists/cv.pdf");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Python crashed");
    });
  });

  // ============================================================================
  // get-cv handler
  // ============================================================================

  describe("get-cv", () => {
    it("should return CV when found", async () => {
      mockGetCVFull.mockReturnValueOnce({
        contact: { name: "Test" },
        parse_confidence: 0.8,
      });
      const result = await callHandler("get-cv", "cv-1");
      expect(result.success).toBe(true);
      expect(result.data.contact.name).toBe("Test");
    });

    it("should return error when CV not found", async () => {
      mockGetCVFull.mockReturnValueOnce(null);
      const result = await callHandler("get-cv", "nonexistent");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  // ============================================================================
  // get-all-cvs handler
  // ============================================================================

  describe("get-all-cvs", () => {
    it("should return CVs array", async () => {
      mockGetAllCVs.mockReturnValueOnce([{ id: "1" }]);
      const result = await callHandler("get-all-cvs");
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it("should pass projectId filter", async () => {
      mockGetAllCVs.mockReturnValueOnce([]);
      await callHandler("get-all-cvs", "proj-1");
      expect(mockGetAllCVs).toHaveBeenCalledWith("proj-1");
    });
  });

  // ============================================================================
  // delete-cv handler
  // ============================================================================

  describe("delete-cv", () => {
    it("should return success on delete", async () => {
      mockDeleteCV.mockReturnValueOnce(true);
      const result = await callHandler("delete-cv", "cv-1");
      expect(result.success).toBe(true);
    });

    it("should return false when not found", async () => {
      mockDeleteCV.mockReturnValueOnce(false);
      const result = await callHandler("delete-cv", "nope");
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // update-cv-field handler
  // ============================================================================

  describe("update-cv-field", () => {
    it("should update field and return success", async () => {
      mockUpdateCVField.mockReturnValueOnce(true);
      const result = await callHandler(
        "update-cv-field",
        "cv-1",
        "contact.name",
        "New Name",
      );
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // extract-jd handler
  // ============================================================================

  describe("extract-jd", () => {
    it("should reject null text", async () => {
      const result = await callHandler("extract-jd", null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid or empty");
    });

    it("should reject empty text", async () => {
      const result = await callHandler("extract-jd", "");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid or empty");
    });

    it("should reject whitespace-only text", async () => {
      const result = await callHandler("extract-jd", "   \n  ");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid or empty");
    });

    it("should reject non-string text", async () => {
      const result = await callHandler("extract-jd", 123);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid or empty");
    });

    it("should extract JD with valid text", async () => {
      mockSendToPython.mockResolvedValueOnce({
        title: "Engineer",
        required_skills: [],
        preferred_skills: [],
        certifications: [],
      });
      mockGetJD.mockReturnValueOnce({
        id: "jd-1",
        title: "Engineer",
      });
      const result = await callHandler("extract-jd", "Looking for an engineer");
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // get-jd handler
  // ============================================================================

  describe("get-jd", () => {
    it("should return JD when found", async () => {
      mockGetJD.mockReturnValueOnce({ id: "jd-1", title: "Dev" });
      const result = await callHandler("get-jd", "jd-1");
      expect(result.success).toBe(true);
    });

    it("should return error when not found", async () => {
      mockGetJD.mockReturnValueOnce(null);
      const result = await callHandler("get-jd", "nope");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  // ============================================================================
  // delete-jd handler
  // ============================================================================

  describe("delete-jd", () => {
    it("should return success on delete", async () => {
      mockDeleteJD.mockReturnValueOnce(true);
      const result = await callHandler("delete-jd", "jd-1");
      expect(result.success).toBe(true);
    });

    it("should return error when not found", async () => {
      mockDeleteJD.mockReturnValueOnce(false);
      const result = await callHandler("delete-jd", "nope");
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // Project handlers
  // ============================================================================

  describe("create-project", () => {
    it("should create project with valid input", async () => {
      const result = await callHandler("create-project", { name: "Test" });
      expect(result.success).toBe(true);
      expect(result.data.name).toBe("Test");
    });
  });

  describe("get-all-projects", () => {
    it("should return projects array", async () => {
      mockGetAllProjects.mockReturnValueOnce([{ id: "p1" }]);
      const result = await callHandler("get-all-projects");
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe("get-project", () => {
    it("should return project when found", async () => {
      mockGetProject.mockReturnValueOnce({ id: "p1", name: "P" });
      const result = await callHandler("get-project", "p1");
      expect(result.success).toBe(true);
    });

    it("should return error when not found", async () => {
      mockGetProject.mockReturnValueOnce(null);
      const result = await callHandler("get-project", "nope");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("update-project", () => {
    it("should update and return success", async () => {
      mockUpdateProject.mockReturnValueOnce(true);
      const result = await callHandler("update-project", "p1", {
        name: "New",
      });
      expect(result.success).toBe(true);
    });

    it("should return error when not found", async () => {
      mockUpdateProject.mockReturnValueOnce(false);
      const result = await callHandler("update-project", "nope", {
        name: "X",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("delete-project", () => {
    it("should delete and return success", async () => {
      mockDeleteProject.mockReturnValueOnce(true);
      const result = await callHandler("delete-project", "p1");
      expect(result.success).toBe(true);
    });

    it("should return error when not found", async () => {
      mockDeleteProject.mockReturnValueOnce(false);
      const result = await callHandler("delete-project", "nope");
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // Queue handlers
  // ============================================================================

  describe("enqueue-cv", () => {
    it("should reject null file path", async () => {
      const result = await callHandler("enqueue-cv", "name.pdf", null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid file path");
    });

    it("should reject nonexistent file", async () => {
      const result = await callHandler(
        "enqueue-cv",
        "name.pdf",
        "/nonexistent/f.pdf",
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("File not found");
    });

    it("should reject unsupported extension", async () => {
      const result = await callHandler(
        "enqueue-cv",
        "name.txt",
        "/exists/f.txt",
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unsupported file type");
    });

    it("should enqueue valid PDF", async () => {
      const result = await callHandler(
        "enqueue-cv",
        "name.pdf",
        "/exists/f.pdf",
      );
      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
    });
  });

  describe("get-queued-cvs", () => {
    it("should return queued CVs", async () => {
      mockGetQueuedCVsByProject.mockReturnValueOnce([{ id: "1" }]);
      const result = await callHandler("get-queued-cvs");
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Usage & Pinning handlers
  // ============================================================================

  describe("get-usage-stats", () => {
    it("should return usage stats", async () => {
      const result = await callHandler("get-usage-stats");
      expect(result.success).toBe(true);
      expect(result.data.global).toBeDefined();
    });
  });

  describe("set-pinned-project", () => {
    it("should pin a project", async () => {
      const result = await callHandler("set-pinned-project", "p1", true);
      expect(result.success).toBe(true);
      expect(mockUpdateProjectPinned).toHaveBeenCalledWith("p1", true);
    });
  });

  describe("get-pinned-projects", () => {
    it("should return pinned projects", async () => {
      mockGetPinnedProjects.mockReturnValueOnce([]);
      const result = await callHandler("get-pinned-projects");
      expect(result.success).toBe(true);
    });
  });

  describe("reorder-pinned-projects", () => {
    it("should reorder projects", async () => {
      const result = await callHandler("reorder-pinned-projects", ["p1", "p2"]);
      expect(result.success).toBe(true);
      expect(mockReorderPinnedProjects).toHaveBeenCalledWith(["p1", "p2"]);
    });
  });

  // ============================================================================
  // Export handler
  // ============================================================================

  describe("export-cv", () => {
    it("should return error when CV not found", async () => {
      mockGetCV.mockReturnValueOnce(null);
      const result = await callHandler("export-cv", "nope", "client");
      expect(result.success).toBe(false);
      expect(result.error).toContain("CV not found");
    });

    it("should reject invalid export mode", async () => {
      mockGetCV.mockReturnValueOnce({ id: "cv-1", file_path: "/p" });
      mockGetCVFull.mockReturnValueOnce({ contact: {} });
      const result = await callHandler("export-cv", "cv-1", "invalid_mode");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid mode");
    });
  });

  // ============================================================================
  // Error response format consistency
  // ============================================================================

  describe("error response format", () => {
    it("all error responses should have success:false and error:string", async () => {
      // Test a sample of error cases
      const errorCases = [
        () => callHandler("extract-cv", null),
        () => callHandler("extract-jd", null),
        () => callHandler("enqueue-cv", "a", null),
      ];

      for (const getError of errorCases) {
        const result = await getError();
        expect(result.success).toBe(false);
        expect(typeof result.error).toBe("string");
        expect(result.error.length).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================================
  // Reprocess handler
  // ============================================================================

  describe("reprocess-cv", () => {
    it("should reject invalid file path", async () => {
      const result = await callHandler("reprocess-cv", null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid file path");
    });

    it("should reject nonexistent file", async () => {
      const result = await callHandler("reprocess-cv", "/nonexistent/f.pdf");
      expect(result.success).toBe(false);
      expect(result.error).toContain("File not found");
    });

    it("should reject unsupported file type", async () => {
      const result = await callHandler("reprocess-cv", "/exists/f.txt");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unsupported file type");
    });
  });

  // ============================================================================
  // Settings handlers
  // ============================================================================

  describe("get-llm-settings", () => {
    it("should return LLM settings", async () => {
      const result = await callHandler("get-llm-settings");
      expect(result.success).toBe(true);
      expect(result.data.llmMode).toBeDefined();
    });
  });

  describe("get-aggregate-stats", () => {
    it("should return aggregate stats", async () => {
      const result = await callHandler("get-aggregate-stats");
      expect(result.success).toBe(true);
      expect(result.data.total_cvs).toBeDefined();
    });
  });
});
