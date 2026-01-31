---
status: diagnosed
phase: 06-bulk-processing
source: 06-01-SUMMARY.md, 06-02-SUMMARY.md
started: 2026-01-31T12:00:00Z
updated: 2026-01-31T12:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Folder Drag-Drop

expected: Drag a folder containing PDF/DOCX files onto the drop zone. A confirmation dialog appears showing the file count found. Clicking OK enqueues all files and they appear in the queue.
result: issue
reported: "I drag in the folder and it fails and displays the folder name in the failed tab."
severity: major

### 2. Single File Drop (Backward Compat)

expected: Drag a single PDF or DOCX file onto the drop zone. It processes normally through the existing single-file path (no confirmation dialog).
result: pass

### 3. Multi-File Drop

expected: Drag multiple files (2+) onto the drop zone. They route through batch enqueue with a confirmation dialog showing count.
result: pass

### 4. File Picker - Multi-File & Folder Selection

expected: Click the drop zone to open file picker. You can select multiple files or a folder. Selected items enqueue through batch processing.
result: pass

### 5. Queue Virtualization (100+ items)

expected: Enqueue 100+ files (via folder drop). The queue list scrolls smoothly without lag or jank. Items render on demand as you scroll.
result: skipped
reason: User only has 6 CVs, cannot test at scale

### 6. Correct Filenames in Queue

expected: After bulk-enqueuing files, each queue item shows its actual filename (not "Processing...unknown" or placeholder text).
result: pass

### 7. Retry All Failed

expected: After some files fail processing, a "Retry All Failed" button appears. Clicking it re-enqueues all failed items.
result: pass

### 8. Batch Summary Toast

expected: After a batch of files finishes processing, a toast/notification appears showing success and failure counts (e.g., "95 succeeded, 5 failed").
result: pass

## Summary

total: 8
passed: 6
issues: 1
pending: 0
skipped: 1

## Gaps

- truth: "Drag a folder onto the drop zone, confirmation dialog appears, files enqueue successfully"
  status: failed
  reason: "User reported: I drag in the folder and it fails and displays the folder name in the failed tab."
  severity: major
  test: 1
  root_cause: "DropZone handleDrop folder detection heuristic fails — dataTransfer.files excludes folders in Chromium; needs webkitGetAsEntry() for directory detection. Also handleClick routes single folder to processFile instead of batchEnqueue (checks length > 1 but single folder = length 1)."
  artifacts:
  - path: "src/renderer/components/queue/DropZone.tsx"
    issue: "handleDrop folder heuristic and handleClick single-folder routing"
  - path: "src/main/index.ts"
    issue: "enqueue-cv rejects folder paths due to missing extension"
    missing:
  - "Use webkitGetAsEntry() or dataTransfer.items for directory detection in handleDrop"
  - "Check if single path is directory in handleClick before routing to processFile"
    debug_session: ".planning/debug/folder-drag-drop.md"
