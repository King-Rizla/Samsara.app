---
phase: "07-03"
subsystem: "testing"
tags: ["vitest", "unit-tests", "main-process", "electron", "mocking"]
dependency-graph:
  requires: ["07-01"]
  provides: ["152 vitest unit tests for main process modules"]
  affects: ["07-04"]
tech-stack:
  added: []
  patterns:
    [
      "vi.mock for electron/better-sqlite3",
      "vi.hoisted for mock factories",
      "vi.waitFor for async tests",
    ]
key-files:
  created:
    - src/main/__tests__/database.test.ts
    - src/main/__tests__/queueManager.test.ts
    - src/main/__tests__/pythonManager.test.ts
    - src/main/__tests__/ipcHandlers.test.ts
  modified: []
decisions:
  - key: "mock-better-sqlite3"
    choice: "Function constructor returning mock object"
    reason: "better-sqlite3 uses `new Database()` - mock must be callable as constructor"
  - key: "vi-hoisted-handlers"
    choice: "vi.hoisted() for IPC handler map"
    reason: "vi.mock factories are hoisted above variable declarations; vi.hoisted ensures availability"
  - key: "module-reset-pattern"
    choice: "closeDatabase() in beforeEach to reset module singleton"
    reason: "Database module caches db instance; must reset between tests"
metrics:
  duration: "8 min"
  completed: "2026-01-28"
---

# Phase 7 Plan 03: TypeScript Unit Tests Summary

152 vitest unit tests for critical Electron main-process modules with mocked dependencies.

## Task Results

### Task 1: Database and Queue Manager Tests (83 tests)

**database.test.ts (67 tests):**

- Initialization: WAL mode, table creation, singleton pattern
- CV CRUD: insert, get, getAll, delete, getCVFull, updateCVField
- JD CRUD: insert, get, getAll, delete
- Match results: insert, getForJD, getSpecific, delete
- Projects: create, getAll, get, update, delete, aggregate stats
- Queue functions: insertQueued, updateStatus, getNext, reset, getByProject
- Usage tracking: recordEvent, getByProject, getGlobal
- Pinning: pin/unpin, getPinned, reorder
- SQL injection protection: parameterized queries verified

**queueManager.test.ts (16 tests):**

- Constructor: resets stuck processing CVs on creation
- Enqueue: persists to DB, passes projectId, triggers processNext
- ProcessNext: processes queued CV, handles failure, records token usage
- Status notifications: sends to window, handles destroyed/null window
- Singleton pattern: createQueueManager/getQueueManager
- One-at-a-time processing: serial execution verified

### Task 2: IPC Handler and Python Manager Tests (69 tests)

**ipcHandlers.test.ts (49 tests):**

- Handler registration: all 27+ IPC channels registered
- extract-cv: null/empty/non-string/nonexistent/unsupported file validation
- extract-jd: null/empty/whitespace/non-string text validation
- get-cv, get-jd, get-project: not-found error handling
- delete-cv, delete-jd, delete-project: success and not-found cases
- enqueue-cv: file validation (null, nonexistent, unsupported)
- reprocess-cv: file path validation
- export-cv: CV not found, invalid mode
- Error response format: consistent {success: false, error: string}

**pythonManager.test.ts (20 tests):**

- isPythonReady: returns false before start
- getLLMMode: returns valid mode
- sendToPython: rejects when not running
- extractCV: rejects when not ready, accepts callback
- JSON-lines protocol: valid JSON, malformed, partial, empty, ACK, error, status
- Request ID generation: uniqueness
- Process exit handling: codes, signals, pending request rejection
- Timeout behavior: 0 (no timeout) and custom values

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Mock constructor pattern for better-sqlite3**

- Found during: Task 1
- Issue: `vi.mock('better-sqlite3', () => ({ default: vi.fn(() => obj) }))` fails because arrow functions cannot be called with `new`
- Fix: Used plain function constructor `function MockDatabase() { return mockDbInstance; }`

**2. [Rule 3 - Blocking] vi.hoisted for IPC handler map**

- Found during: Task 2
- Issue: `vi.mock` factories are hoisted above variable declarations, so `handlers` Map was undefined when electron mock factory tried to use it
- Fix: Used `vi.hoisted()` to make the Map available in hoisted context

**3. [Rule 1 - Bug] Database test files accidentally committed in 07-02**

- Found during: Task 1 commit
- Issue: lint-staged stash/restore cycle during concurrent plan execution included database.test.ts and queueManager.test.ts in the 07-02 commit (04747fb)
- Impact: Files are correctly tracked in git with proper content; attribution is split across commits

## Decisions Made

1. Mock better-sqlite3 with function constructor (not arrow function) for `new Database()` compatibility
2. Use `vi.hoisted()` for variables needed in `vi.mock` factory callbacks
3. Call `closeDatabase()` in `beforeEach` to reset module-level singleton between tests
4. Use `vi.waitFor()` for async queue processing assertions

## Test Count Verification

| File                  | Tests   |
| --------------------- | ------- |
| database.test.ts      | 67      |
| queueManager.test.ts  | 16      |
| ipcHandlers.test.ts   | 49      |
| pythonManager.test.ts | 20      |
| **Total**             | **152** |

All 152 tests pass in <1 second.
