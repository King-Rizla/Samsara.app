# Phase 6: Bulk Processing & OS Integration - Research

**Researched:** 2026-01-31
**Domain:** Electron drag-drop, batch IPC, list virtualization, memory management
**Confidence:** HIGH

## Summary

Phase 6 scales the existing queue infrastructure (QueueManager, DropZone, QueueTabs) to handle 100+ files from folder drops. The existing architecture is well-suited: QueueManager already processes one CV at a time serially, the queue store already handles status push updates, and the tab UI already shows counts. The three key additions are: (1) folder drag-drop with recursive file scanning in the main process, (2) batch IPC to send file paths in chunks rather than one-by-one, and (3) list virtualization for the QueueList component when item counts exceed ~50.

No new major dependencies are needed. The only addition is `@tanstack/react-virtual` for list virtualization. All folder scanning uses Node.js `fs` APIs already available in the main process. The confirmation dialog uses Electron's existing `dialog.showMessageBox`.

**Primary recommendation:** Route folder drops through a new `batch-enqueue` IPC handler that accepts an array of file paths, scans folders recursively in the main process, and enqueues files in chunks of 25. Virtualize QueueList with @tanstack/react-virtual.

## Standard Stack

### Core

| Library                          | Version  | Purpose                                    | Why Standard                                                                                                              |
| -------------------------------- | -------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Node.js `fs/promises` + `path`   | built-in | Recursive folder scanning                  | Already available in main process. `fs.readdir` with `{ recursive: true }` (Node 18.17+) handles recursive scan natively. |
| Electron `dialog.showMessageBox` | built-in | Confirmation dialog before bulk processing | Already used for other dialogs in the app.                                                                                |
| `@tanstack/react-virtual`        | 3.13.x   | List virtualization for 100+ items         | Standard React virtualization library (821 dependents on npm). Headless, works with existing Tailwind styling. 10-15kb.   |

### Supporting

| Library                   | Version     | Purpose                                      | When to Use                                                  |
| ------------------------- | ----------- | -------------------------------------------- | ------------------------------------------------------------ |
| `webUtils.getPathForFile` | Electron 40 | Get filesystem path from dropped File object | Already exposed via `window.electronFile.getPath` in preload |

### Alternatives Considered

| Instead of                          | Could Use                        | Tradeoff                                                                                                                                                 |
| ----------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@tanstack/react-virtual`           | `react-window`                   | react-window is older, less maintained, fixed-size-only without hacks. TanStack is the modern successor.                                                 |
| `@tanstack/react-virtual`           | No virtualization                | Works fine up to ~50 items. At 100+ items, rendering 100 DOM nodes with status updates causes jank.                                                      |
| Node.js `fs.readdir({ recursive })` | `webkitGetAsEntry()` in renderer | Renderer-side recursive scan works but is async/callback-heavy and doesn't give absolute paths directly. Main process scan is simpler and more reliable. |

**Installation:**

```bash
npm install @tanstack/react-virtual
```

## Architecture Patterns

### Recommended Flow: Folder Drop to Queue

```
[Renderer: DropZone]
    |
    | User drops folder (or files)
    | e.dataTransfer.files → get paths via webUtils.getPathForFile
    | Detect if any path is a directory (send to main to check)
    |
    v
[IPC: "batch-enqueue"]
    |
    | Main process receives array of paths
    | For each path that is a directory: fs.readdir({ recursive: true })
    | Filter for .pdf/.docx/.doc
    | Show confirmation dialog: "Found X CVs. Process all?"
    | If confirmed: enqueue in chunks of 25
    |
    v
[QueueManager.enqueue()] × N
    |
    | Each file persisted to DB immediately (existing behavior)
    | Status push updates flow to renderer (existing behavior)
    | Files appear in Submitted tab one by one (trickle)
    |
    v
[Renderer: QueueList (virtualized)]
    |
    | @tanstack/react-virtual renders only visible items
    | Tab counts update via existing memoized selectors
```

### Pattern 1: Batch IPC Handler

**What:** Single IPC handler that accepts an array of paths, scans folders, confirms with user, and enqueues in chunks.
**When to use:** Every folder/multi-file drop and any future "Import Folder" button.
**Example:**

```typescript
// Main process - new IPC handler
ipcMain.handle(
  "batch-enqueue",
  async (_event, paths: string[], projectId?: string) => {
    // 1. Resolve all paths: expand directories, filter by extension
    const filePaths: string[] = [];
    for (const p of paths) {
      const stat = await fs.promises.stat(p);
      if (stat.isDirectory()) {
        const entries = await fs.promises.readdir(p, { recursive: true });
        for (const entry of entries) {
          const fullPath = path.join(p, entry as string);
          const ext = path.extname(fullPath).toLowerCase();
          if ([".pdf", ".docx", ".doc"].includes(ext)) {
            const entryStat = await fs.promises.stat(fullPath);
            if (entryStat.isFile()) filePaths.push(fullPath);
          }
        }
      } else {
        const ext = path.extname(p).toLowerCase();
        if ([".pdf", ".docx", ".doc"].includes(ext)) {
          filePaths.push(p);
        }
      }
    }

    if (filePaths.length === 0) {
      return { success: true, count: 0, message: "No CV files found" };
    }

    // 2. Confirmation dialog
    const { response } = await dialog.showMessageBox({
      type: "question",
      buttons: ["Process All", "Cancel"],
      defaultId: 0,
      title: "Bulk Import",
      message: `Found ${filePaths.length} CV files (.pdf, .docx, .doc). Process all?`,
    });
    if (response !== 0) {
      return { success: true, count: 0, canceled: true };
    }

    // 3. Soft warning for 200+
    // (Renderer shows toast based on count in response)

    // 4. Enqueue in chunks
    const ids: string[] = [];
    const qm = getQueueManager();
    for (const fp of filePaths) {
      const fileName = path.basename(fp);
      const id = qm.enqueue({ fileName, filePath: fp, projectId });
      ids.push(id);
    }

    return { success: true, count: filePaths.length, ids };
  },
);
```

### Pattern 2: Virtualized QueueList

**What:** Replace direct `.map()` rendering with @tanstack/react-virtual virtualizer.
**When to use:** When QueueList renders 50+ items (always safe to use, near-zero overhead for small lists).
**Example:**

```tsx
// Source: https://tanstack.com/virtual/latest/docs/framework/react/react-virtual
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

export function QueueList({ status, onExport }: QueueListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const allItems = useQueueStore((state) => state.items);
  const items = useMemo(
    () => allItems.filter(/* existing filter */),
    [allItems, status],
  );

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // estimated row height in px
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="h-full overflow-y-auto p-2">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          return (
            <div
              key={item.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <QueueItem item={item} onExport={onExport} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### Pattern 3: Detecting Folder vs File in Renderer

**What:** The renderer's DropZone gets File objects from `e.dataTransfer.files`. In Electron, folders appear as File objects with size 0 (or similar). The reliable approach: send all paths to main process and let it `stat()` them.
**Example:**

```typescript
// In DropZone handleDrop:
const paths: string[] = [];
for (const file of Array.from(e.dataTransfer.files)) {
  const filePath = window.electronFile.getPath(file);
  if (filePath) paths.push(filePath);
}

if (paths.length > 0) {
  const result = await window.api.batchEnqueue(
    paths,
    activeProjectId || undefined,
  );
  // result.count tells how many were queued
  // Show toast for 200+ if result.count >= 200
}
```

### Anti-Patterns to Avoid

- **One IPC call per file from renderer:** Sending 100 individual `enqueue-cv` calls creates IPC overhead and race conditions. Use batch handler.
- **Scanning folders in renderer process:** The renderer should not use Node.js `fs` directly (even though Electron allows it). Keep filesystem ops in main process for security.
- **Rendering all 100+ DOM nodes:** Without virtualization, 100+ QueueItem components with status update re-renders will cause visible jank.
- **Blocking main process during scan:** For very large directories (1000+ files), use async iteration. `fs.promises.readdir({ recursive: true })` is already async.

## Don't Hand-Roll

| Problem               | Don't Build               | Use Instead                       | Why                                                                                             |
| --------------------- | ------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------- |
| List virtualization   | Custom windowed rendering | `@tanstack/react-virtual`         | Scroll position, overscan, dynamic sizing, resize handling — all solved.                        |
| Confirmation dialog   | Custom React modal        | `dialog.showMessageBox`           | Native OS dialog, already used in app, blocks main process appropriately for user confirmation. |
| Recursive folder scan | Custom recursive walk     | `fs.readdir({ recursive: true })` | Built into Node.js since 18.17. One function call.                                              |

**Key insight:** This phase has no novel technical problems. Every component exists either in the codebase (QueueManager, DropZone, status updates) or in the platform (Node.js fs, Electron dialog, TanStack Virtual). The work is integration, not invention.

## Common Pitfalls

### Pitfall 1: Memory Growth from Zustand Store

**What goes wrong:** Storing 100+ QueueItem objects in Zustand, each with full `data` (parsed CV JSON), causes memory to grow unbounded. After processing 500 CVs, the store holds 500 complete CV parse results in memory.
**Why it happens:** `completeCVProcessing` stores full parsed data in `update.data`, which the store keeps.
**How to avoid:** For completed items, only store metadata (id, fileName, status, parseConfidence) in the queue store. Full CV data is already in SQLite — load on demand when user clicks a CV. The store's `handleQueueStatusUpdate` for `completed` status should NOT store `update.data` in the item; only store a flag that data is available.
**Warning signs:** Electron's process memory growing linearly with processed CV count.

### Pitfall 2: IPC Flooding from Status Updates

**What goes wrong:** QueueManager sends `queue-status-update` via `webContents.send` for every status change. With 100 files enqueued rapidly, the renderer gets 100 `queued` events followed by status transitions, causing excessive re-renders.
**Why it happens:** Each `enqueue()` call triggers `notifyStatus()` synchronously.
**How to avoid:** Batch status notifications. After enqueuing a chunk of files, send a single `queue-batch-update` event with all new items, rather than individual updates. The existing individual update path remains for processing/completed/failed transitions.
**Warning signs:** UI freezing during initial folder drop, visible in React DevTools as cascading re-renders.

### Pitfall 3: File Path Encoding Issues

**What goes wrong:** File paths with Unicode characters (accented names, CJK characters) or spaces fail during Python sidecar processing.
**Why it happens:** JSON serialization of paths works fine, but the Python subprocess may have different filesystem encoding.
**How to avoid:** Already handled — the existing `extractCV` passes `file_path` as a JSON string to Python via stdin. Verify with test files that have Unicode names.
**Warning signs:** Specific CVs failing with "file not found" errors when the file clearly exists.

### Pitfall 4: Drop Event Not Detecting Folders

**What goes wrong:** `e.dataTransfer.files` in Electron gives File objects for both files and folders. You cannot reliably distinguish them in the renderer.
**Why it happens:** The File API represents folders as zero-byte files with no extension. Some browsers/Electron versions handle this differently.
**How to avoid:** Send ALL dropped paths to the main process. The main process uses `fs.stat()` to determine if each path is a file or directory. Never try to detect folders in the renderer.
**Warning signs:** Folders being silently ignored when dropped.

### Pitfall 5: React 19 + TanStack Virtual flushSync Warning

**What goes wrong:** Console warning about `flushSync` being called inside a lifecycle method.
**Why it happens:** TanStack Virtual uses `flushSync` internally; React 19 warns about this pattern.
**How to avoid:** Set `useFlushSync: false` in the virtualizer options. This is documented in TanStack Virtual's React 19 compatibility notes.
**Warning signs:** Console warnings on every scroll.

## Code Examples

### Recursive Folder Scan (Main Process)

```typescript
// Source: Node.js fs.readdir with recursive option (Node 18.17+)
import * as fs from "fs/promises";
import * as path from "path";

const VALID_EXTENSIONS = new Set([".pdf", ".docx", ".doc"]);

async function scanForCVFiles(inputPaths: string[]): Promise<string[]> {
  const results: string[] = [];

  for (const inputPath of inputPaths) {
    const stat = await fs.stat(inputPath);

    if (stat.isFile()) {
      const ext = path.extname(inputPath).toLowerCase();
      if (VALID_EXTENSIONS.has(ext)) {
        results.push(inputPath);
      }
    } else if (stat.isDirectory()) {
      const entries = await fs.readdir(inputPath, {
        recursive: true,
        withFileTypes: true,
      });
      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (VALID_EXTENSIONS.has(ext)) {
            // entry.parentPath available in Node 20+, use entry.path for Node 18
            const fullPath = path.join(
              entry.parentPath || entry.path,
              entry.name,
            );
            results.push(fullPath);
          }
        }
      }
    }
  }

  return results;
}
```

### Batch Enqueue with Chunked Notifications

```typescript
// Enqueue files and send batch notification
function batchEnqueue(filePaths: string[], projectId?: string): string[] {
  const qm = getQueueManager();
  const ids: string[] = [];

  for (const fp of filePaths) {
    const fileName = path.basename(fp);
    // enqueue() already persists to DB and calls processNext()
    const id = qm.enqueue({ fileName, filePath: fp, projectId });
    ids.push(id);
  }

  return ids;
}
```

### Retry All Failed

```typescript
// In QueueControls or QueueTabs — "Retry All Failed" button
const handleRetryAllFailed = async () => {
  const failedItems = items.filter((i) => i.status === "failed");
  const failedIds = failedItems.map((i) => i.id);
  await retryFailed(failedIds);
};
```

## State of the Art

| Old Approach                           | Current Approach                  | When Changed      | Impact                                                          |
| -------------------------------------- | --------------------------------- | ----------------- | --------------------------------------------------------------- |
| Custom recursive `fs.readdirSync` walk | `fs.readdir({ recursive: true })` | Node 18.17 (2023) | Single async call replaces manual recursion                     |
| `react-virtualized` (legacy)           | `@tanstack/react-virtual` 3.x     | 2022              | Headless, smaller bundle, framework-agnostic core               |
| `react-window`                         | `@tanstack/react-virtual` 3.x     | 2023+             | TanStack is actively maintained; react-window has fewer updates |

**Deprecated/outdated:**

- `react-virtualized`: Superseded by react-window and then TanStack Virtual. Do not use.
- Manual `webkitGetAsEntry()` recursion: Unnecessary in Electron where you have Node.js `fs` in the main process.

## Open Questions

1. **`entry.parentPath` vs `entry.path` in `withFileTypes` + `recursive`**
   - What we know: Node 20+ uses `parentPath`, Node 18 uses `path` on Dirent objects when `recursive: true`.
   - What's unclear: Which Node version Electron 40 ships with.
   - Recommendation: Check `process.versions.node` at dev time. Electron 40 likely ships Node 20+. Use `entry.parentPath ?? entry.path` for safety.

2. **Failure notification strategy (Claude's discretion)**
   - Recommendation: Silent failures to Failed tab. No individual toast per failure — 20 failure toasts would be overwhelming. Instead, when a batch has failures, show a single summary toast after batch completes: "Batch complete: X succeeded, Y failed." This requires tracking batch membership, which can be done with a `batchId` field on queued items.

3. **Batch IPC chunk size (Claude's discretion)**
   - Recommendation: No chunking needed for the IPC message itself. Send all file paths in a single `batch-enqueue` call. The chunking happens in the main process for enqueue operations — enqueue all immediately (they're just DB inserts, very fast). The bottleneck is Python processing (serial, one at a time), not enqueueing.

4. **Memory management strategy (Claude's discretion)**
   - Recommendation: Two measures: (a) Don't store full parsed CV data in the Zustand store for completed items — just metadata. Load full data on demand. (b) The Python sidecar already processes one CV at a time, so its memory is bounded. No additional memory management needed for the main process since files are processed serially.

## Sources

### Primary (HIGH confidence)

- Existing codebase: `src/main/queueManager.ts`, `src/renderer/components/queue/DropZone.tsx`, `src/renderer/stores/queueStore.ts` — current queue infrastructure
- Existing codebase: `src/main/pythonManager.ts` — Python sidecar serial processing model
- Existing codebase: `src/main/preload.ts` — `webUtils.getPathForFile` already exposed
- Existing codebase: `src/main/index.ts` — `enqueue-cv` IPC handler pattern
- [TanStack Virtual npm](https://www.npmjs.com/package/@tanstack/react-virtual) — v3.13.18, React 19 compatibility note
- [TanStack Virtual docs](https://tanstack.com/virtual/latest/docs/introduction) — useVirtualizer API

### Secondary (MEDIUM confidence)

- [Electron drag-drop folder behavior](https://github.com/electron/electron/issues/11265) — folder detection behavior
- [MDN DataTransferItem.webkitGetAsEntry()](https://developer.mozilla.org/en-US/docs/Web/API/DataTransferItem/webkitGetAsEntry) — File System Entry API
- [Node.js fs.readdir recursive option](https://nodejs.org/api/fs.html#fsreaddirpath-options-callback) — `{ recursive: true }` since Node 18.17

### Tertiary (LOW confidence)

- None — all findings verified against codebase or official docs.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — only one new dependency (@tanstack/react-virtual), everything else is built-in
- Architecture: HIGH — pattern is clear: batch IPC handler + folder scan in main + virtualized list
- Pitfalls: HIGH — identified from direct codebase analysis (Zustand memory, IPC flooding, React 19 compat)

**Research date:** 2026-01-31
**Valid until:** 2026-03-31 (stable domain, no fast-moving dependencies)
