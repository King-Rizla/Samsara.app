# Phase 6 Plan 1: Folder Drop + Batch Enqueue Summary

**One-liner:** Recursive folder drag-drop with confirmation dialog and chunked enqueue via batch-enqueue IPC handler

## What Was Done

### Task 1: Add batch-enqueue IPC handler in main process

- Added `batch-enqueue` IPC handler that accepts file/folder paths, stats each to detect directories, recursively scans directories for .pdf/.docx/.doc files using `fs/promises.readdir({ recursive: true, withFileTypes: true })`
- Shows `dialog.showMessageBox` confirmation with file count; appends "This may take a while." warning at 200+ files
- Enqueues in chunks of 25 with 50ms setTimeout delays between chunks for UI trickle effect
- Added `batchEnqueue` to preload bridge and `ElectronAPI` type interface
- **Commit:** `67e9cff`

### Task 2: Update DropZone to handle folder drops

- Updated `handleDrop` to detect folder/multi-file drops and route to `window.api.batchEnqueue()`
- Single file drops with valid extension still use existing `processFile` path (backward compatible)
- Folder detection heuristic: any dropped item without a file extension, or more than 1 file dropped
- Updated drop zone text to "Drop CV files or folders here or click to select"
- **Commit:** `a2b4a1a`

## Files Modified

- `src/main/index.ts` - Added `fsPromises` import, `batch-enqueue` IPC handler (~100 lines)
- `src/main/preload.ts` - Added `batchEnqueue` bridge method
- `src/renderer/types/cv.ts` - Added `batchEnqueue` to `ElectronAPI` interface
- `src/renderer/components/queue/DropZone.tsx` - Rewrote `handleDrop` for folder/batch support

## Verification

- `npx tsc --noEmit` - no source file errors
- `npx vitest run` - 152/152 tests pass
- batch-enqueue handler exists in index.ts
- preload bridge exposes batchEnqueue
- DropZone calls batchEnqueue for folder/multi-file drops
- Single file drops still use existing processFile path

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

| Decision                                              | Rationale                                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| Folder detection via missing file extension heuristic | Simplest approach; main process does authoritative stat() check anyway            |
| Always batchEnqueue for multi-file drops              | Main process handles validation uniformly; avoids duplicating logic in renderer   |
| Conditional dialog parent window                      | `BrowserWindow.getFocusedWindow()` can return null; handle both overloads cleanly |

## Duration

~5 minutes
