---
status: investigating
trigger: "When a user drags a folder onto the DropZone, instead of scanning the folder for PDF/DOCX files and batch-enqueuing them, the app fails and displays the folder name in the 'failed' tab."
created: 2026-01-31T00:00:00Z
updated: 2026-01-31T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Found the root cause. When user CLICKS DropZone to open file picker, the picker allows directory selection. Single folder selection goes through processFile() instead of batchEnqueue(), causing folder to be treated as a file and fail.
test: Verify the file picker dialog properties and handleClick logic
expecting: Dialog allows folders, single folder path goes to processFile, fails on enqueueCV
next_action: Update resolution with confirmed root cause

## Symptoms

expected: Folder drag triggers batchEnqueue IPC which recursively scans for PDF/DOCX files, shows confirmation dialog, and enqueues them
actual: Folder drag fails and displays the folder name in the "failed" tab
errors: No specific error messages reported
reproduction: Drag a folder onto the DropZone component
started: Unknown - reported as current bug

## Eliminated

## Evidence

- timestamp: 2026-01-31T00:01:00Z
  checked: DropZone.tsx handleDrop logic and batch-enqueue handler
  found: The folder detection heuristic uses `files.some((f) => !f.name.includes("."))` which checks if any file has no dot in its name. The batch-enqueue handler correctly uses `fs.stat()` to detect directories and recursively scans them.
  implication: The folder detection heuristic is syntactically correct, but the question is whether `event.dataTransfer.files` in Electron actually provides folder entries when dragging folders.

- timestamp: 2026-01-31T00:02:00Z
  checked: Web research on dataTransfer.files and folder support
  found: dataTransfer.files ONLY contains File objects, NOT directory entries. Browsers filter out folders from this list. To detect folders, must use the File and Directory Entries API via dataTransfer.items[i].webkitGetAsEntry() which returns FileSystemDirectoryEntry for folders.
  implication: The current DropZone implementation at line 65 `const files = Array.from(e.dataTransfer.files)` will NEVER see folders, so the folder detection heuristic on line 83 never triggers. Folders are silently dropped/ignored.

- timestamp: 2026-01-31T00:03:00Z
  checked: Re-examining user symptom and DropZone behavior
  found: User says folder "displays in the failed tab" - this means the folder IS being processed, not silently ignored. If dataTransfer.files doesn't include folders, how is the folder being detected as a "file"?
  implication: Need to reconsider. Either: (1) On Windows, dataTransfer.files DOES include folders as File objects, or (2) There's another code path adding the folder to failed queue.

- timestamp: 2026-01-31T00:04:00Z
  checked: GitHub issue #11265 on Electron repository about directory drop support
  found: When a directory is dropped in Electron, it is AUTOMATICALLY EXPANDED to the files within that directory, RECURSIVELY. So dataTransfer.files receives all individual files from the folder, not the folder itself as an entry.
  implication: The folder "name" displayed in failed tab is likely the folder path being treated as if it were a file. The folder path might be coming from somewhere else, or one of the files in the folder has the folder name somehow.

- timestamp: 2026-01-31T00:05:00Z
  checked: Reconsidering GitHub #11265 behavior
  found: Need to verify whether "automatically expanded" means folders NEVER appear in dataTransfer.files, or if they appear ALONGSIDE the expanded files. The issue discussion is ambiguous.
  implication: If folders ARE included in dataTransfer.files (as File objects) PLUS all the files they contain, then the folder detection would trigger. But if folders are REPLACED by their contents, the detection heuristic wouldn't see them.

- timestamp: 2026-01-31T00:06:00Z
  checked: File picker dialog configuration in select-cv-file handler (src/main/index.ts:255-273)
  found: Dialog has properties: ["openFile", "openDirectory", "multiSelections"]. This allows users to select folders. When a SINGLE folder is selected, result.filePaths.length === 1, so the condition on line 124 (> 1) is FALSE. Falls through to line 129-130 which calls processFile() with the folder path and name.
  implication: ROOT CAUSE FOUND - Single folder selection via click goes to processFile(), which calls enqueueCV(), which fails because folder has no file extension.

- timestamp: 2026-01-31T00:07:00Z
  checked: Drag-drop behavior clarification
  found: User report says "drag a folder" but the actual bug is in the CLICK flow (file picker), not drag-drop. OR both are broken. Need to determine if drag-drop ALSO has this issue or if user was actually clicking.
  implication: The fix needs to check if path is a directory in handleClick BEFORE deciding whether to call processFile or batchEnqueue.

## Resolution

root_cause: |
The file picker dialog (select-cv-file handler in src/main/index.ts:255) is configured with properties: ["openFile", "openDirectory", "multiSelections"], which allows users to select folders. However, the handleClick logic in DropZone.tsx only routes to batchEnqueue when result.filePaths.length > 1 (line 124).

When a user selects a SINGLE folder via the file picker:

1. result.filePaths contains one folder path
2. Line 124 condition (length > 1) is FALSE
3. Falls through to line 129-130: processFile(folderName, folderPath)
4. processFile calls enqueueCV with folder path
5. enqueueCV checks file extension (line 1016 in index.ts) - folder has no extension
6. Validation fails, returns { success: false, error: "Unsupported file type: ..." }
7. processFile adds folder to queue with status="failed"

The bug affects BOTH click-to-select AND drag-drop flows, but the manifestation depends on platform behavior:

- Click flow: Always broken for single folder selection
- Drag-drop flow: Depends on whether Chromium includes folder as File object in dataTransfer.files on Windows

fix:
verification:
files_changed: []
