# Phase 6: Bulk Processing & OS Integration - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable bulk CV processing via folder drag-drop onto the existing queue infrastructure. Users drop a folder (or multiple files), files are scanned and queued through the existing pipeline (Submitted/Completed/Failed tabs). OS context menu integration is deferred.

</domain>

<decisions>
## Implementation Decisions

### Queue progress UX

- No new progress UI — use existing tab structure (Completed/Submitted/Failed) with counts as the progress indicator
- Files appear in Submitted tab as they're registered in the queue (trickle, not all at once)
- Soft warning toast at 200+ files: "Processing X files — this may take a while"
- Bulk processing reuses all existing queue infrastructure (QueueManager, status updates, tab rendering)

### Failure handling

- Both individual retry button per failed item AND a bulk "Retry All Failed" button
- Existing Failed tab infrastructure handles error display — no new failure UI needed
- LLM backend is now OpenAI (not Ollama) — network-dependent failure profile
- Individual failures do not stop the batch

### Folder drop behavior

- Recursive folder scan — finds PDF/DOCX/DOC at any depth
- Accepted file types: .pdf, .docx, .doc
- Confirmation dialog before processing: "Found X CVs (.pdf, .docx, .doc). Process all?"
- One drop at a time (single folder or file selection per drop, not mixed)
- Non-matching files silently ignored

### Claude's Discretion

- Failure notification strategy (silent to Failed tab vs toast per failure)
- List virtualization approach for large queues (100+ items in Submitted tab)
- Batch IPC chunking size (10-50 file paths per message)
- Memory management strategy for large batches

</decisions>

<specifics>
## Specific Ideas

- "Keeping it simple" — bulk is just the existing queue at scale, not a new paradigm
- Existing infrastructure (QueueManager, tabs, status updates) handles the heavy lifting

</specifics>

<deferred>
## Deferred Ideas

- OS context menu integration (right-click "Format with Samsara" in Explorer/Finder) — future phase
- Mixed drops (folders + individual files in same drop) — simplify to one at a time for now

</deferred>

---

_Phase: 06-bulk-processing_
_Context gathered: 2026-01-30_
