/**
 * Database module unit tests.
 *
 * Strategy: Mock better-sqlite3 and electron to test database functions
 * in isolation. We verify that the correct SQL statements are prepared
 * and executed with proper parameters.
 */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock electron before importing database
vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/tmp/test-app"),
  },
}));

// Create mock DB instance
const mockRun = vi.fn(() => ({ changes: 1 }));
const mockGet = vi.fn();
const mockAll = vi.fn(() => []);
const mockPrepare = vi.fn(() => ({
  run: mockRun,
  get: mockGet,
  all: mockAll,
}));
const mockExec = vi.fn();
const mockPragma = vi.fn(() => 0);
const mockClose = vi.fn();
const mockTransaction = vi.fn((fn: () => void) => fn);

const mockDbInstance = {
  prepare: mockPrepare,
  exec: mockExec,
  pragma: mockPragma,
  close: mockClose,
  transaction: mockTransaction,
};

vi.mock("better-sqlite3", () => {
  // Return mockDbInstance from constructor - using `return` in a constructor
  // overrides `this` and returns the specified object
  function MockDatabase() {
    return mockDbInstance;
  }
  return { default: MockDatabase };
});

// Import after mocks
import {
  initDatabase,
  getDatabase,
  closeDatabase,
  insertCV,
  getCV,
  getAllCVs,
  deleteCV,
  updateCVField,
  getCVFull,
  insertJD,
  getJD,
  getAllJDs,
  deleteJD,
  createProject,
  getAllProjects,
  getProject,
  updateProject,
  deleteProject,
  getAggregateStats,
  insertQueuedCV,
  updateCVStatus,
  getNextQueuedCV,
  resetProcessingCVs,
  getQueuedCVsByProject,
  insertMatchResult,
  getMatchResultsForJD,
  getMatchResult,
  deleteMatchResultsForJD,
  recordUsageEvent,
  getUsageStatsByProject,
  getGlobalUsageStats,
  updateProjectPinned,
  getPinnedProjects,
  reorderPinnedProjects,
} from "../database";
import type { ParsedCV, ParsedJD } from "../database";

// Helper to create a minimal ParsedCV
function makeParsedCV(overrides?: Partial<ParsedCV>): ParsedCV {
  return {
    contact: { name: "John Doe", email: "john@example.com" },
    work_history: [],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    other_sections: {},
    raw_text: "Sample CV text",
    section_order: ["contact"],
    parse_confidence: 0.85,
    warnings: [],
    ...overrides,
  };
}

describe("Database Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module-level db by closing, so initDatabase() re-creates it
    closeDatabase();
    // The pragma mock returns table info for migrations
    mockPragma.mockImplementation((query: string) => {
      if (typeof query === "string" && query.startsWith("user_version"))
        return 99; // Skip migrations
      if (query === "journal_mode = WAL") return "wal";
      if (query === "synchronous = NORMAL") return "normal";
      if (query === "foreign_keys = ON") return 1;
      return 0;
    });
  });

  // ============================================================================
  // Initialization
  // ============================================================================

  describe("initDatabase", () => {
    it("should create database with WAL mode", () => {
      initDatabase();
      expect(mockPragma).toHaveBeenCalledWith("journal_mode = WAL");
      expect(mockPragma).toHaveBeenCalledWith("synchronous = NORMAL");
      expect(mockPragma).toHaveBeenCalledWith("foreign_keys = ON");
    });

    it("should create required tables", () => {
      initDatabase();
      // Should exec CREATE TABLE statements
      expect(mockExec).toHaveBeenCalled();
      const execCalls = mockExec.mock.calls.map(
        (c: unknown[]) => c[0] as string,
      );
      const hasAppMeta = execCalls.some((sql: string) =>
        sql.includes("app_meta"),
      );
      const hasCvs = execCalls.some((sql: string) => sql.includes("cvs"));
      expect(hasAppMeta).toBe(true);
      expect(hasCvs).toBe(true);
    });

    it("should return same instance on repeated calls", () => {
      const db1 = initDatabase();
      const db2 = initDatabase();
      expect(db1).toBe(db2);
    });
  });

  describe("getDatabase", () => {
    it("should return database after init", () => {
      initDatabase();
      const db = getDatabase();
      expect(db).toBeDefined();
    });
  });

  describe("closeDatabase", () => {
    it("should close the database connection", () => {
      initDatabase();
      closeDatabase();
      expect(mockClose).toHaveBeenCalled();
    });

    it("should handle close when not initialized gracefully", () => {
      // After closeDatabase, calling again should not throw
      closeDatabase();
      expect(() => closeDatabase()).not.toThrow();
    });
  });

  // ============================================================================
  // CV CRUD
  // ============================================================================

  describe("insertCV", () => {
    beforeEach(() => initDatabase());

    it("should insert a valid CV and return an ID", () => {
      const cv = makeParsedCV();
      const id = insertCV(cv, "/path/to/cv.pdf");
      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
      expect(mockPrepare).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalled();
    });

    it("should pass projectId when provided", () => {
      const cv = makeParsedCV();
      insertCV(cv, "/path/to/cv.pdf", "proj-123");
      const runArgs = mockRun.mock.calls[mockRun.mock.calls.length - 1];
      // projectId should be the last argument
      expect(runArgs[runArgs.length - 1]).toBe("proj-123");
    });

    it("should pass null projectId when not provided", () => {
      const cv = makeParsedCV();
      insertCV(cv, "/path/to/cv.pdf");
      const runArgs = mockRun.mock.calls[mockRun.mock.calls.length - 1];
      expect(runArgs[runArgs.length - 1]).toBeNull();
    });

    it("should serialize JSON fields", () => {
      const cv = makeParsedCV({
        contact: { name: "Test", email: "test@test.com", phone: "+44123" },
      });
      insertCV(cv, "/path/to/cv.pdf");
      const runArgs = mockRun.mock.calls[mockRun.mock.calls.length - 1];
      // contact_json should be serialized JSON
      const contactArg = runArgs.find(
        (a: unknown) => typeof a === "string" && a.includes('"name"'),
      );
      expect(contactArg).toBeDefined();
      expect(JSON.parse(contactArg)).toEqual(cv.contact);
    });

    it("should handle CV with empty contact", () => {
      const cv = makeParsedCV({ contact: {} });
      const id = insertCV(cv, "/path/to/cv.pdf");
      expect(id).toBeDefined();
    });

    it("should handle CV with unicode in name", () => {
      const cv = makeParsedCV({
        contact: { name: "Jean-Pierre Dupont" },
      });
      const id = insertCV(cv, "/path/to/cv.pdf");
      expect(id).toBeDefined();
    });

    it("should handle very long raw text", () => {
      const cv = makeParsedCV({ raw_text: "x".repeat(100000) });
      const id = insertCV(cv, "/path/to/cv.pdf");
      expect(id).toBeDefined();
    });
  });

  describe("getCV", () => {
    beforeEach(() => initDatabase());

    it("should return CV record when found", () => {
      const mockRecord = { id: "cv-1", file_name: "test.pdf" };
      mockGet.mockReturnValueOnce(mockRecord);
      const result = getCV("cv-1");
      expect(result).toEqual(mockRecord);
    });

    it("should return null when not found", () => {
      mockGet.mockReturnValueOnce(undefined);
      const result = getCV("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("getAllCVs", () => {
    beforeEach(() => initDatabase());

    it("should return all completed CVs", () => {
      const mockCvs = [
        {
          id: "1",
          file_name: "a.pdf",
          contact_json: "{}",
          parse_confidence: 0.9,
          created_at: "2026-01-01",
        },
      ];
      mockAll.mockReturnValueOnce(mockCvs);
      const result = getAllCVs();
      expect(result).toEqual(mockCvs);
    });

    it("should filter by projectId when provided", () => {
      mockAll.mockReturnValueOnce([]);
      getAllCVs("proj-1");
      const prepareCall = mockPrepare.mock.calls[
        mockPrepare.mock.calls.length - 1
      ][0] as string;
      expect(prepareCall).toContain("project_id = ?");
    });
  });

  describe("deleteCV", () => {
    beforeEach(() => initDatabase());

    it("should return true when CV is deleted", () => {
      mockRun.mockReturnValueOnce({ changes: 1 });
      expect(deleteCV("cv-1")).toBe(true);
    });

    it("should return false when CV not found", () => {
      mockRun.mockReturnValueOnce({ changes: 0 });
      expect(deleteCV("nonexistent")).toBe(false);
    });
  });

  describe("getCVFull", () => {
    beforeEach(() => initDatabase());

    it("should parse JSON fields and return ParsedCV", () => {
      mockGet.mockReturnValueOnce({
        id: "cv-1",
        contact_json: '{"name":"John"}',
        work_history_json: "[]",
        education_json: "[]",
        skills_json: "[]",
        certifications_json: "[]",
        languages_json: "[]",
        other_sections_json: "{}",
        raw_text: "text",
        section_order_json: '["contact"]',
        parse_confidence: 0.9,
        warnings_json: "[]",
        parse_time_ms: 500,
      });
      const result = getCVFull("cv-1");
      expect(result).not.toBeNull();
      expect(result!.contact.name).toBe("John");
      expect(result!.parse_confidence).toBe(0.9);
    });

    it("should return null for nonexistent CV", () => {
      mockGet.mockReturnValueOnce(undefined);
      expect(getCVFull("nope")).toBeNull();
    });

    it("should handle null JSON columns gracefully", () => {
      mockGet.mockReturnValueOnce({
        id: "cv-1",
        contact_json: null,
        work_history_json: null,
        education_json: null,
        skills_json: null,
        certifications_json: null,
        languages_json: null,
        other_sections_json: null,
        raw_text: null,
        section_order_json: null,
        parse_confidence: 0,
        warnings_json: null,
        parse_time_ms: null,
      });
      const result = getCVFull("cv-1");
      expect(result).not.toBeNull();
      expect(result!.contact).toEqual({});
      expect(result!.work_history).toEqual([]);
    });
  });

  describe("updateCVField", () => {
    beforeEach(() => initDatabase());

    it("should update a contact field", () => {
      mockGet.mockReturnValueOnce({
        id: "cv-1",
        contact_json: '{"name":"Old"}',
      });
      const result = updateCVField("cv-1", "contact.name", "New");
      expect(result).toBe(true);
    });

    it("should return false for nonexistent CV", () => {
      mockGet.mockReturnValueOnce(undefined);
      expect(updateCVField("nope", "contact.name", "val")).toBe(false);
    });

    it("should return false for unknown section", () => {
      mockGet.mockReturnValueOnce({ id: "cv-1" });
      expect(updateCVField("cv-1", "nonexistent.field", "val")).toBe(false);
    });
  });

  // ============================================================================
  // JD CRUD
  // ============================================================================

  describe("insertJD", () => {
    beforeEach(() => initDatabase());

    it("should insert a valid JD and return ID", () => {
      const jd: ParsedJD = {
        title: "Software Engineer",
        company: "Acme",
        raw_text: "Looking for...",
        required_skills: [{ skill: "TypeScript", importance: "required" }],
        preferred_skills: [],
        certifications: [],
      };
      const id = insertJD(jd, "proj-1");
      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
    });

    it("should handle JD without company", () => {
      const jd: ParsedJD = {
        title: "Dev",
        raw_text: "text",
        required_skills: [],
        preferred_skills: [],
        certifications: [],
      };
      const id = insertJD(jd);
      expect(id).toBeDefined();
    });
  });

  describe("getJD", () => {
    beforeEach(() => initDatabase());

    it("should return parsed JD when found", () => {
      mockGet.mockReturnValueOnce({
        id: "jd-1",
        title: "Engineer",
        company: "Co",
        raw_text: "text",
        required_skills_json: '[{"skill":"TS","importance":"required"}]',
        preferred_skills_json: "[]",
        experience_min: 2,
        experience_max: 5,
        education_level: "Bachelor",
        certifications_json: "[]",
        matching_metadata_json: null,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      });
      const result = getJD("jd-1");
      expect(result).not.toBeNull();
      expect(result!.title).toBe("Engineer");
      expect(result!.required_skills).toHaveLength(1);
    });

    it("should return null when not found", () => {
      mockGet.mockReturnValueOnce(undefined);
      expect(getJD("nope")).toBeNull();
    });
  });

  describe("getAllJDs", () => {
    beforeEach(() => initDatabase());

    it("should return JD summaries with skill counts", () => {
      mockAll.mockReturnValueOnce([
        {
          id: "jd-1",
          title: "Dev",
          company: "Co",
          created_at: "2026-01-01",
          required_skills_json: '[{"skill":"A"},{"skill":"B"}]',
          preferred_skills_json: '[{"skill":"C"}]',
        },
      ]);
      const result = getAllJDs();
      expect(result).toHaveLength(1);
      expect(result[0].required_count).toBe(2);
      expect(result[0].preferred_count).toBe(1);
    });
  });

  describe("deleteJD", () => {
    beforeEach(() => initDatabase());

    it("should return true on successful delete", () => {
      mockRun.mockReturnValueOnce({ changes: 1 });
      expect(deleteJD("jd-1")).toBe(true);
    });

    it("should return false when not found", () => {
      mockRun.mockReturnValueOnce({ changes: 0 });
      expect(deleteJD("nope")).toBe(false);
    });
  });

  // ============================================================================
  // Match Results
  // ============================================================================

  describe("insertMatchResult", () => {
    beforeEach(() => initDatabase());

    it("should insert match result with serialized JSON", () => {
      insertMatchResult({
        cv_id: "cv-1",
        jd_id: "jd-1",
        match_score: 85,
        matched_skills: ["TypeScript", "React"],
        missing_required: ["Go"],
        missing_preferred: [],
        calculated_at: "2026-01-01T00:00:00Z",
      });
      expect(mockRun).toHaveBeenCalled();
    });
  });

  describe("getMatchResultsForJD", () => {
    beforeEach(() => initDatabase());

    it("should return match results sorted by score", () => {
      const mockResults = [
        { cv_id: "cv-1", jd_id: "jd-1", match_score: 90 },
        { cv_id: "cv-2", jd_id: "jd-1", match_score: 70 },
      ];
      mockAll.mockReturnValueOnce(mockResults);
      const results = getMatchResultsForJD("jd-1");
      expect(results).toHaveLength(2);
      expect(results[0].match_score).toBe(90);
    });
  });

  describe("getMatchResult", () => {
    beforeEach(() => initDatabase());

    it("should return specific CV-JD match", () => {
      mockGet.mockReturnValueOnce({
        cv_id: "cv-1",
        jd_id: "jd-1",
        match_score: 80,
      });
      const result = getMatchResult("cv-1", "jd-1");
      expect(result).not.toBeNull();
      expect(result!.match_score).toBe(80);
    });

    it("should return null when no match", () => {
      mockGet.mockReturnValueOnce(undefined);
      expect(getMatchResult("cv-1", "jd-2")).toBeNull();
    });
  });

  describe("deleteMatchResultsForJD", () => {
    beforeEach(() => initDatabase());

    it("should delete all matches for a JD", () => {
      deleteMatchResultsForJD("jd-1");
      expect(mockRun).toHaveBeenCalledWith("jd-1");
    });
  });

  // ============================================================================
  // Projects
  // ============================================================================

  describe("createProject", () => {
    beforeEach(() => initDatabase());

    it("should create project and return record", () => {
      const project = createProject({ name: "Test Project" });
      expect(project.name).toBe("Test Project");
      expect(project.id).toBeDefined();
      expect(project.is_archived).toBe(0);
    });

    it("should handle optional fields", () => {
      const project = createProject({
        name: "P",
        client_name: "Client",
        description: "Desc",
      });
      expect(project.client_name).toBe("Client");
      expect(project.description).toBe("Desc");
    });
  });

  describe("getAllProjects", () => {
    beforeEach(() => initDatabase());

    it("should return projects with is_archived as boolean", () => {
      mockAll.mockReturnValueOnce([
        { id: "p1", name: "P1", is_archived: 0, cv_count: 3, jd_count: 1 },
      ]);
      const projects = getAllProjects();
      expect(projects[0].is_archived).toBe(false);
    });
  });

  describe("getProject", () => {
    beforeEach(() => initDatabase());

    it("should return project when found", () => {
      mockGet.mockReturnValueOnce({
        id: "p1",
        name: "P1",
        is_archived: 1,
        cv_count: 0,
        jd_count: 0,
      });
      const p = getProject("p1");
      expect(p).not.toBeNull();
      expect(p!.is_archived).toBe(true);
    });

    it("should return null when not found", () => {
      mockGet.mockReturnValueOnce(undefined);
      expect(getProject("nope")).toBeNull();
    });
  });

  describe("updateProject", () => {
    beforeEach(() => initDatabase());

    it("should update name", () => {
      mockRun.mockReturnValueOnce({ changes: 1 });
      expect(updateProject("p1", { name: "New" })).toBe(true);
    });

    it("should return false when not found", () => {
      mockRun.mockReturnValueOnce({ changes: 0 });
      expect(updateProject("nope", { name: "X" })).toBe(false);
    });
  });

  describe("deleteProject", () => {
    beforeEach(() => initDatabase());

    it("should delete project and associated data", () => {
      mockRun.mockReturnValue({ changes: 1 });
      const callsBefore = mockRun.mock.calls.length;
      expect(deleteProject("p1")).toBe(true);
      // Should have run 3 deletes: cvs, jds, project
      expect(mockRun).toHaveBeenCalledTimes(callsBefore + 3);
    });
  });

  describe("getAggregateStats", () => {
    beforeEach(() => initDatabase());

    it("should return total counts", () => {
      mockGet
        .mockReturnValueOnce({ count: 10 })
        .mockReturnValueOnce({ count: 5 });
      const stats = getAggregateStats();
      expect(stats.total_cvs).toBe(10);
      expect(stats.total_jds).toBe(5);
    });
  });

  // ============================================================================
  // Queue Functions
  // ============================================================================

  describe("insertQueuedCV", () => {
    beforeEach(() => initDatabase());

    it("should insert queued CV and return ID", () => {
      const id = insertQueuedCV({
        filePath: "/path/cv.pdf",
        fileName: "cv.pdf",
      });
      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
    });

    it("should pass projectId when provided", () => {
      insertQueuedCV({ filePath: "/p", fileName: "f", projectId: "proj-1" });
      const lastArgs = mockRun.mock.calls[mockRun.mock.calls.length - 1];
      expect(lastArgs[lastArgs.length - 1]).toBe("proj-1");
    });
  });

  describe("updateCVStatus", () => {
    beforeEach(() => initDatabase());

    it("should update status", () => {
      mockRun.mockReturnValueOnce({ changes: 1 });
      expect(updateCVStatus("cv-1", "processing")).toBe(true);
    });

    it("should include error message when provided", () => {
      mockRun.mockReturnValueOnce({ changes: 1 });
      updateCVStatus("cv-1", "failed", { error: "timeout" });
      // Verify the prepare call includes error_message
      const lastPrepare = mockPrepare.mock.calls[
        mockPrepare.mock.calls.length - 1
      ][0] as string;
      expect(lastPrepare).toContain("error_message");
    });

    it("should include startedAt when provided", () => {
      mockRun.mockReturnValueOnce({ changes: 1 });
      updateCVStatus("cv-1", "processing", {
        startedAt: "2026-01-01T00:00:00Z",
      });
      const lastPrepare = mockPrepare.mock.calls[
        mockPrepare.mock.calls.length - 1
      ][0] as string;
      expect(lastPrepare).toContain("processing_started_at");
    });
  });

  describe("getNextQueuedCV", () => {
    beforeEach(() => initDatabase());

    it("should return next queued CV", () => {
      mockGet.mockReturnValueOnce({
        id: "cv-1",
        file_path: "/p",
        file_name: "f",
        project_id: null,
        created_at: "2026",
      });
      const next = getNextQueuedCV();
      expect(next).not.toBeNull();
      expect(next!.id).toBe("cv-1");
    });

    it("should return null when queue empty", () => {
      mockGet.mockReturnValueOnce(undefined);
      expect(getNextQueuedCV()).toBeNull();
    });
  });

  describe("resetProcessingCVs", () => {
    beforeEach(() => initDatabase());

    it("should reset processing CVs and return count", () => {
      mockRun.mockReturnValueOnce({ changes: 3 });
      expect(resetProcessingCVs()).toBe(3);
    });

    it("should return 0 when none stuck", () => {
      mockRun.mockReturnValueOnce({ changes: 0 });
      expect(resetProcessingCVs()).toBe(0);
    });
  });

  describe("getQueuedCVsByProject", () => {
    beforeEach(() => initDatabase());

    it("should return non-completed CVs", () => {
      mockAll.mockReturnValueOnce([
        { id: "1", file_name: "a.pdf", status: "queued" },
        { id: "2", file_name: "b.pdf", status: "failed" },
      ]);
      const result = getQueuedCVsByProject();
      expect(result).toHaveLength(2);
    });

    it("should filter by projectId", () => {
      mockAll.mockReturnValueOnce([]);
      getQueuedCVsByProject("proj-1");
      const sql = mockPrepare.mock.calls[
        mockPrepare.mock.calls.length - 1
      ][0] as string;
      expect(sql).toContain("project_id = ?");
    });
  });

  // ============================================================================
  // Usage Tracking
  // ============================================================================

  describe("recordUsageEvent", () => {
    beforeEach(() => initDatabase());

    it("should insert usage event", () => {
      recordUsageEvent({
        projectId: "p1",
        eventType: "cv_extraction",
        promptTokens: 100,
        completionTokens: 200,
        totalTokens: 300,
        llmMode: "local",
        model: "qwen2.5",
      });
      expect(mockRun).toHaveBeenCalled();
    });
  });

  describe("getUsageStatsByProject", () => {
    beforeEach(() => initDatabase());

    it("should return usage stats", () => {
      mockGet.mockReturnValueOnce({ totalTokens: 1000, requestCount: 5 });
      const stats = getUsageStatsByProject("p1");
      expect(stats.totalTokens).toBe(1000);
      expect(stats.requestCount).toBe(5);
    });

    it("should return zeros when no usage", () => {
      mockGet.mockReturnValueOnce(undefined);
      const stats = getUsageStatsByProject("p1");
      expect(stats.totalTokens).toBe(0);
      expect(stats.requestCount).toBe(0);
    });
  });

  describe("getGlobalUsageStats", () => {
    beforeEach(() => initDatabase());

    it("should return global stats", () => {
      mockGet.mockReturnValueOnce({ totalTokens: 5000, requestCount: 20 });
      const stats = getGlobalUsageStats();
      expect(stats.totalTokens).toBe(5000);
    });
  });

  // ============================================================================
  // Pinning
  // ============================================================================

  describe("updateProjectPinned", () => {
    beforeEach(() => initDatabase());

    it("should pin a project with next order", () => {
      mockGet.mockReturnValueOnce({ maxOrder: 2 });
      mockRun.mockReturnValueOnce({ changes: 1 });
      expect(updateProjectPinned("p1", true)).toBe(true);
    });

    it("should unpin a project", () => {
      mockRun.mockReturnValueOnce({ changes: 1 });
      expect(updateProjectPinned("p1", false)).toBe(true);
    });
  });

  describe("getPinnedProjects", () => {
    beforeEach(() => initDatabase());

    it("should return pinned projects sorted by order", () => {
      mockAll.mockReturnValueOnce([
        { id: "p1", name: "A", is_archived: 0, cv_count: 1, jd_count: 0 },
      ]);
      const projects = getPinnedProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].is_archived).toBe(false);
    });
  });

  describe("reorderPinnedProjects", () => {
    beforeEach(() => initDatabase());

    it("should reorder projects in a transaction", () => {
      const callsBefore = mockRun.mock.calls.length;
      reorderPinnedProjects(["p2", "p1", "p3"]);
      expect(mockTransaction).toHaveBeenCalled();
      // Each project should get an update
      expect(mockRun).toHaveBeenCalledTimes(callsBefore + 3);
    });
  });

  // ============================================================================
  // SQL Injection Protection (parameterized queries)
  // ============================================================================

  describe("SQL injection protection", () => {
    beforeEach(() => initDatabase());

    it("should use parameterized queries for CV insertion", () => {
      const cv = makeParsedCV({
        contact: { name: "Robert'; DROP TABLE cvs;--" },
      });
      insertCV(cv, "/path/cv.pdf");
      // The malicious string should be passed as a parameter, not in SQL
      const runArgs = mockRun.mock.calls[mockRun.mock.calls.length - 1];
      const contactJson = runArgs.find(
        (a: unknown) => typeof a === "string" && a.includes("DROP TABLE"),
      );
      // It should be in a JSON parameter, not executed as SQL
      expect(contactJson).toBeDefined();
      expect(JSON.parse(contactJson!).name).toContain("DROP TABLE");
      // The exec mock should NOT have been called with the injection
      const execCalls = mockExec.mock.calls.map(
        (c: unknown[]) => c[0] as string,
      );
      expect(execCalls.some((s: string) => s.includes("DROP TABLE cvs"))).toBe(
        false,
      );
    });

    it("should use parameterized queries for JD insertion", () => {
      const jd: ParsedJD = {
        title: "'; DROP TABLE job_descriptions;--",
        raw_text: "safe text",
        required_skills: [],
        preferred_skills: [],
        certifications: [],
      };
      insertJD(jd);
      // Title with injection is a parameter
      const runArgs = mockRun.mock.calls[mockRun.mock.calls.length - 1];
      expect(runArgs).toContain("'; DROP TABLE job_descriptions;--");
    });
  });
});
