---
phase: 06-bulk-processing
plan: 02
subsystem: queue-ui
tags: [virtualization, batch-ux, react-virtual, retry]
dependency-graph:
  requires: ["06-01"]
  provides:
    [
      "virtualized-queue-list",
      "retry-all-failed",
      "batch-summary-toast",
      "multi-file-picker",
    ]
  affects: []
tech-stack:
  added: ["@tanstack/react-virtual@^3.13.0"]
  patterns: ["virtualized-list", "batch-completion-detection"]
key-files:
  created: []
  modified:
    - src/renderer/components/queue/QueueList.tsx
    - src/renderer/components/queue/QueueControls.tsx
    - src/renderer/components/queue/QueueTabs.tsx
    - src/renderer/components/queue/DropZone.tsx
    - src/renderer/stores/queueStore.ts
    - src/renderer/types/cv.ts
    - src/main/queueManager.ts
    - src/main/preload.ts
    - src/main/index.ts
    - package.json
decisions:
  - id: d-0602-01
    decision: "Use @tanstack/react-virtual with useFlushSync:false for React 19 compat"
    rationale: "Prevents flushSync warnings while providing smooth virtualization"
  - id: d-0602-02
    decision: "Batch completion detected by tracking submitted count drop from >5 to 0"
    rationale: "Simple heuristic that avoids explicit batch ID tracking"
metrics:
  duration: ~15 min
  completed: 2026-01-31
---

# Phase 06 Plan 02: List Virtualization and Batch UX Summary

**One-liner:** Virtualized QueueList with @tanstack/react-virtual, Retry All Failed button, batch summary toast, and multi-file/folder picker support.

## Tasks Completed

| Task | Name                                                   | Commit  | Key Changes                                                                                            |
| ---- | ------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------ |
| 1    | Virtualize QueueList with @tanstack/react-virtual      | 163189a | Installed react-virtual, rewrote QueueList with useVirtualizer (overscan 5, estimateSize 72px)         |
| 2    | Retry All Failed + batch summary toast                 | 8f724d7 | Added Retry All Failed button in QueueControls, batch completion toast in QueueTabs                    |
| 3    | Checkpoint fixes: multi-file picker + filename display | c78f853 | Fixed select-cv-file to support multiSelections/openDirectory, fixed bulk enqueue filename propagation |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] File picker only supported single file selection**

- **Found during:** Checkpoint verification (Task 3)
- **Issue:** `select-cv-file` IPC handler only had `openFile` property, preventing multi-file or folder selection via click
- **Fix:** Added `openDirectory` and `multiSelections` to dialog properties; updated handleClick to route multi-selection through batchEnqueue; updated return type to include `filePaths` array
- **Files modified:** src/main/index.ts, src/main/preload.ts, src/renderer/types/cv.ts, src/renderer/components/queue/DropZone.tsx
- **Commit:** c78f853

**2. [Rule 1 - Bug] Bulk-enqueued CVs showed "Processing...unknown" filename**

- **Found during:** Checkpoint verification (Task 3)
- **Issue:** QueueManager.enqueue() sent status update without fileName/filePath, so renderer created placeholder items with "Processing..." as filename
- **Fix:** Added fileName and filePath to QueueStatusUpdate interface; included them in enqueue notification; updated queueStore to use real values when creating new items
- **Files modified:** src/main/queueManager.ts, src/main/preload.ts, src/renderer/types/cv.ts, src/renderer/stores/queueStore.ts
- **Commit:** c78f853

## Verification

- `npx vitest run` -- 152 tests pass
- `npx tsc --noEmit` -- no project-level type errors (only pre-existing node_modules issues)
- Manual verification of file picker and filename display confirmed by user checkpoint

## Next Phase Readiness

Phase 06 (Bulk Processing) is complete. All success criteria met:

1. Folder drag-drop with recursive scanning works
2. Batch IPC sends in chunks of 25 with 50ms delays
3. QueueList is virtualized for 100+ items
4. Retry All Failed requeues all failed CVs
5. Batch summary toast shows success/fail counts
6. File picker supports multi-file and folder selection
7. Bulk-enqueued CVs display correct filenames
