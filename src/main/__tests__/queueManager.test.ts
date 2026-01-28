/**
 * QueueManager unit tests.
 *
 * Tests queue enqueue, processing order, status transitions,
 * timeout handling, and crash recovery.
 */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock electron
vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => "/tmp/test") },
  BrowserWindow: vi.fn(),
}));

// Mock database functions
const mockInsertQueuedCV = vi.fn(() => "cv-id-1");
const mockUpdateCVStatus = vi.fn(() => true);
const mockCompleteCVProcessing = vi.fn(() => true);
const mockGetNextQueuedCV = vi.fn(() => null);
const mockResetProcessingCVs = vi.fn(() => 0);
const mockRecordUsageEvent = vi.fn();

vi.mock("../database", () => ({
  insertQueuedCV: (...args: unknown[]) => mockInsertQueuedCV(...args),
  updateCVStatus: (...args: unknown[]) => mockUpdateCVStatus(...args),
  completeCVProcessing: (...args: unknown[]) =>
    mockCompleteCVProcessing(...args),
  getNextQueuedCV: () => mockGetNextQueuedCV(),
  resetProcessingCVs: () => mockResetProcessingCVs(),
  recordUsageEvent: (...args: unknown[]) => mockRecordUsageEvent(...args),
}));

// Mock pythonManager
const mockExtractCV = vi.fn();
vi.mock("../pythonManager", () => ({
  extractCV: (...args: unknown[]) => mockExtractCV(...args),
}));

// Mock settings
vi.mock("../settings", () => ({
  loadSettings: () => ({ llmMode: "local" as const }),
}));

import {
  QueueManager,
  createQueueManager,
  getQueueManager,
} from "../queueManager";

describe("QueueManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResetProcessingCVs.mockReturnValue(0);
    mockGetNextQueuedCV.mockReturnValue(null);
  });

  describe("constructor", () => {
    it("should reset processing CVs on creation", () => {
      new QueueManager();
      expect(mockResetProcessingCVs).toHaveBeenCalled();
    });

    it("should log when stuck CVs are reset", () => {
      mockResetProcessingCVs.mockReturnValue(3);
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {
        /* noop */
      });
      new QueueManager();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Reset 3"),
      );
      consoleSpy.mockRestore();
    });
  });

  describe("enqueue", () => {
    it("should persist CV to database and return ID", () => {
      const qm = new QueueManager();
      const id = qm.enqueue({ fileName: "cv.pdf", filePath: "/path/cv.pdf" });
      expect(id).toBe("cv-id-1");
      expect(mockInsertQueuedCV).toHaveBeenCalledWith({
        filePath: "/path/cv.pdf",
        fileName: "cv.pdf",
        projectId: undefined,
      });
    });

    it("should pass projectId to database", () => {
      const qm = new QueueManager();
      qm.enqueue({ fileName: "cv.pdf", filePath: "/p", projectId: "proj-1" });
      expect(mockInsertQueuedCV).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: "proj-1" }),
      );
    });

    it("should trigger processNext after enqueue", () => {
      // When enqueuing, getNextQueuedCV will be called to check for work
      const qm = new QueueManager();
      qm.enqueue({ fileName: "a.pdf", filePath: "/a" });
      // processNext is called internally - getNextQueuedCV proves it
      expect(mockGetNextQueuedCV).toHaveBeenCalled();
    });
  });

  describe("processNext", () => {
    it("should not process when queue is empty", () => {
      mockGetNextQueuedCV.mockReturnValue(null);
      const qm = new QueueManager();
      // enqueue triggers processNext, but no item to process
      qm.enqueue({ fileName: "a.pdf", filePath: "/a" });
      // extractCV should NOT be called since queue returns null after enqueue's own insert
      // (The enqueue inserts, then processNext checks queue - which returns null in our mock)
      expect(mockExtractCV).not.toHaveBeenCalled();
    });

    it("should process queued CV when available", async () => {
      mockGetNextQueuedCV.mockReturnValueOnce({
        id: "cv-1",
        file_path: "/path/cv.pdf",
        file_name: "cv.pdf",
        project_id: "proj-1",
        created_at: "2026-01-01",
      });
      mockExtractCV.mockResolvedValueOnce({
        contact: { name: "John" },
        parse_confidence: 0.9,
      });

      const qm = new QueueManager();
      // Manually trigger - we need to let the promise settle
      qm.enqueue({ fileName: "b.pdf", filePath: "/b" });

      // Wait for async processing
      await vi.waitFor(
        () => {
          expect(mockCompleteCVProcessing).toHaveBeenCalledWith(
            "cv-1",
            expect.any(Object),
          );
        },
        { timeout: 1000 },
      );
    });

    it("should mark CV as failed on extraction error", async () => {
      mockGetNextQueuedCV.mockReturnValueOnce({
        id: "cv-err",
        file_path: "/bad.pdf",
        file_name: "bad.pdf",
        project_id: null,
        created_at: "2026-01-01",
      });
      mockExtractCV.mockRejectedValueOnce(new Error("Python crashed"));

      const qm = new QueueManager();
      qm.enqueue({ fileName: "x.pdf", filePath: "/x" });

      await vi.waitFor(
        () => {
          expect(mockUpdateCVStatus).toHaveBeenCalledWith(
            "cv-err",
            "failed",
            expect.objectContaining({ error: "Python crashed" }),
          );
        },
        { timeout: 1000 },
      );
    });

    it("should record token usage when present in result", async () => {
      mockGetNextQueuedCV.mockReturnValueOnce({
        id: "cv-tok",
        file_path: "/tok.pdf",
        file_name: "tok.pdf",
        project_id: "proj-1",
        created_at: "2026-01-01",
      });
      mockExtractCV.mockResolvedValueOnce({
        contact: {},
        parse_confidence: 0.8,
        token_usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300,
          model: "qwen2.5",
        },
      });

      const qm = new QueueManager();
      qm.enqueue({ fileName: "tok.pdf", filePath: "/tok" });

      await vi.waitFor(
        () => {
          expect(mockRecordUsageEvent).toHaveBeenCalledWith(
            expect.objectContaining({
              projectId: "proj-1",
              totalTokens: 300,
            }),
          );
        },
        { timeout: 1000 },
      );
    });
  });

  describe("status notifications", () => {
    it("should send status updates to main window", () => {
      const mockSend = vi.fn();
      const mockWindow = {
        isDestroyed: () => false,
        webContents: { send: mockSend },
        on: vi.fn(),
      } as unknown as import("electron").BrowserWindow;

      const qm = new QueueManager();
      qm.setMainWindow(mockWindow);
      qm.enqueue({ fileName: "a.pdf", filePath: "/a" });

      expect(mockSend).toHaveBeenCalledWith(
        "queue-status-update",
        expect.objectContaining({ status: "queued" }),
      );
    });

    it("should not crash if window is destroyed", () => {
      const mockWindow = {
        isDestroyed: () => true,
        webContents: { send: vi.fn() },
        on: vi.fn(),
      } as unknown as import("electron").BrowserWindow;

      const qm = new QueueManager();
      qm.setMainWindow(mockWindow);
      // Should not throw
      expect(() =>
        qm.enqueue({ fileName: "a.pdf", filePath: "/a" }),
      ).not.toThrow();
    });

    it("should not crash with no window set", () => {
      const qm = new QueueManager();
      expect(() =>
        qm.enqueue({ fileName: "a.pdf", filePath: "/a" }),
      ).not.toThrow();
    });
  });

  describe("isProcessing", () => {
    it("should return false when idle", () => {
      const qm = new QueueManager();
      expect(qm.isProcessing()).toBe(false);
    });
  });

  describe("singleton pattern", () => {
    it("createQueueManager should return same instance", () => {
      const qm1 = createQueueManager();
      const qm2 = createQueueManager();
      expect(qm1).toBe(qm2);
    });

    it("getQueueManager should return created instance", () => {
      createQueueManager();
      const qm = getQueueManager();
      expect(qm).toBeDefined();
    });
  });

  describe("one-at-a-time processing", () => {
    it("should not process multiple CVs simultaneously", async () => {
      // First CV takes time to process
      let resolveFirst: (v: unknown) => void;
      const firstPromise = new Promise((r) => {
        resolveFirst = r;
      });
      mockExtractCV.mockReturnValueOnce(firstPromise);

      mockGetNextQueuedCV
        .mockReturnValueOnce({
          id: "cv-1",
          file_path: "/1.pdf",
          file_name: "1.pdf",
          project_id: null,
          created_at: "2026-01-01",
        })
        .mockReturnValue(null);

      const qm = new QueueManager();
      qm.enqueue({ fileName: "1.pdf", filePath: "/1" });
      qm.enqueue({ fileName: "2.pdf", filePath: "/2" });

      // extractCV should only be called once (one at a time)
      expect(mockExtractCV).toHaveBeenCalledTimes(1);

      // Resolve first
      resolveFirst!({ contact: {}, parse_confidence: 0.5 });
      await vi.waitFor(
        () => {
          expect(mockCompleteCVProcessing).toHaveBeenCalledTimes(1);
        },
        { timeout: 1000 },
      );
    });
  });
});
