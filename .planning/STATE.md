# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-23)

**Core value:** Architecture as the Advantage - Zero Latency, Zero Egress, Zero Per-Seat Tax
**Current focus:** Phase 7 - Testing and Bug Fixing Protocol (Plan 1 of 4 complete)

## Current Position

Phase: 7 (Testing and Bug Fixing Protocol)
Plan: 1 of 4 in current phase
Status: In progress
Last activity: 2026-01-28 - Completed 07-01-PLAN.md (Quality Gate Infrastructure)

Progress: [########################░░] 95% (41/43 plans through Phase 7-01)

## Performance Metrics

**Velocity:**

- Total plans completed: 41
- Average duration: 11 min
- Total execution time: ~6.6 hours

**By Phase:**

| Phase                                | Plans | Total   | Avg/Plan |
| ------------------------------------ | ----- | ------- | -------- |
| 1. Foundation & Distribution         | 3/3   | 58 min  | 19 min   |
| 2. Parsing Pipeline                  | 3/3   | 44 min  | 15 min   |
| 2.1. LLM Extraction                  | 2/2   | 50 min  | 25 min   |
| 3. Visual Editor                     | 5/5   | 40 min  | 8 min    |
| 3.T. E2E Test Foundation             | 1/1   | 45 min  | 45 min   |
| 4. JD Matching                       | 3/3   | ~45 min | 15 min   |
| 4.T. JD Matching Tests               | 1/1   | ~30 min | 30 min   |
| 4.5. Project Homepage                | 4/4   | 29 min  | 7 min    |
| 4.6. Queue Infrastructure            | 5/5   | 18 min  | 4 min    |
| 4.7. Dashboard Enhancements          | 5/5   | 32 min  | 6 min    |
| 5. Anonymization & Branding          | 3/3   | 26 min  | 9 min    |
| 5.T. Export & Branding Tests         | 0/1   | -       | -        |
| 6. Bulk Processing & OS Integration  | 0/3   | -       | -        |
| 6.T. Performance & Integration Tests | 0/1   | -       | -        |
| 7. Testing & Bug Fixing Protocol     | 1/4   | 5 min   | 5 min    |

**Recent Trend:**

- Last 5 plans: 6 min, 6 min, 6 min, 6 min, 5 min
- Trend: Consistent execution velocity

_Updated after each plan completion_

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Research]: PyInstaller `--onedir` required (not `--onefile`) for faster startup to meet <2s requirement
- [Research]: spaCy en_core_web_sm model (12MB) for NER, preload at startup
- [Research]: Code signing must happen in Phase 1, not as a last step
- [Questioning]: JD Matching is equally important as formatting - added as Phase 4
- [01-01]: Use concurrent:false in VitePlugin to prevent OOM during builds
- [01-01]: Mark better-sqlite3 as external in Vite rollup options
- [01-01]: WAL mode + synchronous=NORMAL for SQLite performance
- [01-02]: Python 3.12 required - spaCy incompatible with Python 3.14
- [01-02]: Model path detection handles frozen/dev contexts via get_model_path()
- [01-03]: spawn + readline for Python IPC (not python-shell library)
- [01-03]: extraResource for Python sidecar in packaged app
- [02-01]: suppress_stdout() context manager for PyMuPDF to preserve JSON lines IPC
- [02-01]: Multi-column detection via X position gap analysis (>100px threshold)
- [02-01]: Cascading parser strategy: PyMuPDF first, pdfplumber for tables
- [02-02]: British date format with dayfirst=True (3/2/2020 = 3rd Feb)
- [02-02]: Partial dates default to 1st (Jan 2020 -> 01/01/2020)
- [02-02]: Company indicators filtered from PERSON entities (Ltd, Inc, LLC)
- [02-02]: Preserve candidate skill groupings rather than re-categorizing
- [02-03]: webUtils.getPathForFile for context-isolated file access (Electron)
- [02-03]: Native dialog.showOpenDialog as fallback for click-to-select
- [02-03]: 70% confidence threshold for low-confidence field highlighting
- [User]: Local LLM extraction for improved work/education/skills deferred to Phase 2.1
- [02.1-01]: Qwen 2.5 7B default model (Qwen3 breaks JSON with thinking tags)
- [02.1-01]: 60s timeout for extraction, 5m keep_alive to avoid cold-start delays
- [02.1-01]: Never raise exceptions in OllamaClient - return None for fallback
- [02.1-02]: Single unified LLM call instead of 4 separate calls (cost + speed efficiency)
- [02.1-02]: Pass full raw_text to LLM for better multi-column PDF handling
- [02.1-02]: 120s timeout for unified extraction (complex schema)
- [User]: 1 API call always preferred over multiple for cost efficiency
- [03-01]: Tailwind v3 required for shadcn/ui compatibility (v4 incompatible)
- [03-01]: esbuild JSX automatic transform for ESM compatibility with electron-forge
- [03-01]: Terminal dark mode only - no light mode support
- [03-01]: CSS variables-based theming for future customization
- [03-02]: Field path format uses dots for objects, brackets for arrays
- [03-02]: Selection state uses Set for O(1) membership checks
- [03-02]: Pending changes tracked in Map for batch save operations
- [03-03]: Click-to-view loads CV in editorStore for Plan 04 editor pane
- [03-03]: Processing stages update in real-time: Parsing -> Extracting -> Saving
- [03-03]: Low confidence (<70%) items get warning styling on badge
- [03-04]: 400ms debounce delay for auto-save (balances responsiveness with IPC overhead)
- [03-04]: Skills section read-only for now (array editing deferred to future phase)
- [03-04]: 50/50 split-view layout keeps queue visible while editing
- [04-03]: Three-column layout with queue/JD/editor panels (w-1/3 each when editor open)
- [E2E]: DevTools disabled during E2E tests to prevent window capture issues
- [E2E]: Scoped selectors via data-testid (queue-panel, jd-panel, drop-zone) for multi-panel layout
- [04.5-01]: Schema versioning via PRAGMA user_version (simple integer increment)
- [04.5-01]: Idempotent migration with column existence checks before ALTER TABLE
- [04.5-01]: Default Project (id='default-project') created for orphaned CVs/JDs
- [04.5-02]: IPC handlers return { success: boolean, data?: T, error?: string } for uniform response
- [04.5-03]: MemoryRouter for Electron navigation (no URL bar manipulation)
- [04.5-03]: Cross-store state access via useProjectStore.getState() in queueStore/jdStore
- [04.5-03]: useEffect-based data reload on project change in ProjectView
- [04.5-04]: shadcn component imports fixed from @/ alias to relative paths (project doesn't use TS path aliases)
- [04.5-04]: SidebarProvider + SidebarInset layout pattern for all routes
- [04.5-04]: Time saved calculation: 4.97 min per CV (5 min manual - 2s automated)
- [04.6-01]: Four status values (queued/processing/completed/failed) for CV lifecycle
- [04.6-01]: DEFAULT 'completed' for backward compatibility with existing CVs
- [04.6-01]: Separate processing_started_at column for timeout calculation from actual processing start
- [04.6-02]: QueueManager initialized after database init, before window creation
- [04.6-02]: Singleton pattern with createQueueManager/getQueueManager for global access
- [04.6-02]: 120 second timeout per CV (matches Python extractCV timeout)
- [04.6-02]: Stuck 'processing' CVs reset to 'queued' on startup for crash recovery
- [04.6-03]: Keep 'submitted' in QueueStatus for backward compatibility
- [04.6-03]: Use removeAllListeners for cleanup (single listener pattern)
- [04.6-04]: Map DB 'processing' status to UI 'submitted' for backward compatibility
- [04.6-04]: Add 'Queued...' to ProcessingStage type for pre-processing state
- [04.6-04]: Subscribe to queue updates at App level (single listener, global scope)
- [04.6-05]: ACK pattern for timeout coordination: Python sends processing_started ACK
- [04.6-05]: Timeout starts on ACK, not submission - queue fairness guaranteed
- [04.6-05]: Single timeout boundary (QueueManager only, not pythonManager)
- [04.7-01]: SQLite trigger update_daily_usage auto-aggregates tokens into usage_daily on INSERT
- [04.7-01]: Current month filtering via strftime('%Y-%m-01', 'now') for usage stats
- [04.7-01]: Pin order uses simple incrementing integers, transactions for reorder
- [04.7-03]: Usage recorded with 'default-project' if no projectId provided
- [04.7-03]: Token usage captured from Python response's token_usage field
- [04.7-03]: warningThreshold defaults to 80 (warn at 80% of limit)
- [04.7-04]: 8px activation distance prevents accidental drags
- [04.7-04]: DragOverlay renders ghost preview outside DOM hierarchy for z-index
- [04.7-04]: Two unpin methods: X button on hover AND drag project out of sidebar
- [04.7-05]: Token format abbreviated (1.2K, 45.3K, 1.1M) with cost for cloud mode
- [04.7-05]: GPT-4o-mini blended rate ~$0.30 per 1M tokens for cost estimation
- [04.7-05]: Toast duration: Infinity (stays until user dismisses)
- [04.7-05]: Settings aggregated into single unified page (LLM + usage limits)
- [05-01]: White fill (1,1,1) for redaction produces blank space, not black bars
- [05-01]: apply_redactions() physically removes text (not just overlay) for true PDF redaction
- [05-01]: Default export mode is 'client' (remove phone+email)
- [05-01]: Output filename: {Name}\_CV.pdf or Candidate_CV.pdf for punt mode
- [05-02]: Purple terminal aesthetic (#6B21A8) as default theme primary color
- [05-02]: Helvetica fonts (built-in) for cross-platform PDF compatibility
- [05-02]: Recruiter settings stored in existing settings.json
- [05-02]: Blind profile prepended using PyMuPDF insert_pdf for PDF merging
- [04.8-02]: Forward reference with model_rebuild() for matching_metadata on LLMJDExtraction
- [04.8-04]: Radix collapsible primitive for SearchTools UI (consistent with existing component library)
- [07-01]: Husky 9 pre-commit hook needs shebang for Windows Git compatibility
- [07-01]: Semgrep deferred from pre-commit hooks (Windows compatibility)
- [07-01]: Python pre-commit framework hooks commented out (requires separate install)

### Pending Todos

- **[PERFORMANCE]** LLM extraction takes ~50 seconds - needs optimization in future phase
  - Consider smaller/faster model
  - Consider simplified schema
  - Consider parallel processing or caching

### Blockers/Concerns

- [Research] PDF parsing may fail on 30-40% of real resumes - need adversarial corpus testing
- [Research] macOS Gatekeeper rejects unsigned Python binaries - sign ALL binaries including PyInstaller output
- [02.1-02] LLM extraction time (~50s) is too long - future optimization needed

### Roadmap Evolution

- Phase 7 added: Testing and Bug Fixing Protocol (2026-01-26)
- Phase 4.5 inserted after Phase 4.T: Project Homepage & Organization (2026-01-26) - Enables multi-project workflow for recruiters working on multiple job roles simultaneously
- Phase 4.6 inserted: Queue Infrastructure & Persistence (2026-01-27) - Fix timeout bug, status column, queue manager, real-time updates
- Phase 4.7 inserted: Dashboard Enhancements (2026-01-27) - Project drag-drop to sidebar, token/API tracking, usage limits

## Session Continuity

Last session: 2026-01-28
Stopped at: Completed 07-01-PLAN.md (Quality Gate Infrastructure)
Resume file: None

## Next Steps

**Phase 7: Testing & Bug Fixing Protocol** - IN PROGRESS

- [x] Plan 07-01: Quality Gate Infrastructure
- [ ] Plan 07-02: Next plan
- [ ] Plan 07-03: Next plan
- [ ] Plan 07-04: Next plan
